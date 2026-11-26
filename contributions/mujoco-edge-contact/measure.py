"""Measure a static two-box contact in MuJoCo and clip the overlapping support edge."""

import json
import math
import platform
from pathlib import Path

import mujoco
import numpy as np


SCENE = Path(__file__).with_name("scene.xml")


def vector(values, scale=1):
    return [round(float(value) * scale, 6) for value in values]


def clip_support_edge(model, data, support_id, probe_id):
    """Intersect the support's +Y/+Z edge with the probe's local box bounds."""
    half_x, half_y, half_z = model.geom_size[support_id]
    edge_origin = data.geom_xpos[support_id] + [0, half_y, half_z]
    world_to_probe = data.geom_xmat[probe_id].reshape(3, 3).T
    start = world_to_probe @ (edge_origin - data.geom_xpos[probe_id])
    step = world_to_probe[:, 0]
    low = -half_x
    high = half_x
    for offset, speed, half_width in zip(start, step, model.geom_size[probe_id]):
        if abs(speed) < 1e-12:
            if abs(offset) > half_width:
                return None
            continue
        crossings = [(-half_width - offset) / speed, (half_width - offset) / speed]
        low = max(low, min(crossings))
        high = min(high, max(crossings))
        if low > high:
            return None
    return low + edge_origin[0], high + edge_origin[0]


def measure_pose(model, axis=None, degrees=0, lift_mm=0):
    data = mujoco.MjData(model)
    if axis:
        direction = {"x": (1, 0, 0), "z": (0, 0, 1)}[axis]
        rotation = np.empty(4)
        orientation = np.empty(4)
        mujoco.mju_axisAngle2Quat(rotation, direction, math.radians(degrees))
        mujoco.mju_mulQuat(orientation, rotation, data.qpos[3:7])
        data.qpos[3:7] = orientation
    data.qpos[2] += lift_mm / 1000
    mujoco.mj_forward(model, data)

    support_id = model.geom("support").id
    probe_id = model.geom("probe_box").id
    contacts = []
    for contact in data.contact[:data.ncon]:
        if set(contact.geom) != {support_id, probe_id}:
            raise ValueError("Unexpected geom pair in the two-box fixture")
        normal_sign = 1 if contact.geom[0] == support_id else -1
        contacts.append({
            "world_position_mm": vector(contact.pos, scale=1000),
            "signed_distance_mm": round(float(contact.dist) * 1000, 6),
            "normal_support_to_probe": vector(contact.frame[:3], scale=normal_sign),
        })
    contacts.sort(key=lambda contact: contact["world_position_mm"])

    interval = clip_support_edge(model, data, support_id, probe_id)
    contact_x = [contact["world_position_mm"][0] for contact in contacts]
    return {
        "rotation_axis_world": axis,
        "rotation_degrees": degrees,
        "lift_mm": lift_mm,
        "contact_count": len(contacts),
        "contact_span_x_mm": round(max(contact_x) - min(contact_x), 6) if contact_x else None,
        "overlap_interval_x_mm": vector(interval, scale=1000) if interval else None,
        "contacts": contacts,
    }


def main():
    model = mujoco.MjModel.from_xml_path(str(SCENE))
    measurements = [measure_pose(model)]
    for axis in ("x", "z"):
        for degrees in (-1, -0.25, 0.25, 1):
            measurements.append(measure_pose(model, axis, degrees))
    measurements.append(measure_pose(model, lift_mm=50))
    print(json.dumps({
        "environment": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "mujoco_python": mujoco.__version__,
            "mujoco_engine": mujoco.mj_versionString(),
            "numpy": np.__version__,
        },
        "measurements": measurements,
    }, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
