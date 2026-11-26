# How does the contact point move when a box rotates on an edge?

In MuJoCo 3.17.0, the reported pose generated one contact near the lower-x end of a 75.14 mm overlap. A rotation of −0.25° around world Z moved the single contact to the opposite end, from x = 340.770 mm to x = 415.893 mm. The overlapping segment changed by less than 0.01 mm at either endpoint. [Upstream geometry and pose](https://github.com/google-deepmind/mujoco/issues/3755)

## Recorded measurements

The [recorded JSON](observations-macos-arm64.json) includes every contact's world position, signed distance in millimeters, and world normal oriented from the support toward the probe. Negative distance denotes penetration. The contact position is MuJoCo's reported midpoint between the geometries. The overlap interval comes from a separate geometry calculation that clips the support's top edge against the probe's oriented bounds. [MuJoCo 3.17.0 contact API](https://mujoco.readthedocs.io/en/3.17.0/APIreference/APItypes.html#mjcontact)

| Pose | Contacts | Contact x (mm) | Signed distance (mm) | Edge overlap x (mm) |
| --- | ---: | ---: | ---: | --- |
| Reported | 1 | 340.770 | −4.850 | 340.759–415.902 |
| World X −1° | 1 | 340.771 | −4.856 | 340.760–415.903 |
| World X +1° | 1 | 340.770 | −4.845 | 340.758–415.902 |
| World Z −0.25° | 1 | 415.893 | −4.829 | 340.766–415.901 |
| World Z +0.25° | 1 | 340.783 | −5.001 | 340.751–415.904 |
| Raised 50 mm vertically | 0 | — | — | — |

All eight rotated poses had one contact, while both sampled negative Z rotations placed it near the upper-x end. Each rotation was applied in world axes about the probe's center. Each pose was evaluated independently with `mj_forward`. This tests static collision geometry. Whether the contact movement changes dynamic stability, and which contact manifold best represents the overlap, remain open.

## Reproduce

The saved run used CPython 3.12.14 on arm64 macOS 15.7.4 with the official MuJoCo 3.17.0 wheel and NumPy 2.5.5. The two-box MJCF re-expresses the dimensions and pose from the upstream report. The script needs no renderer. [Official MuJoCo 3.17.0 wheels](https://pypi.org/project/mujoco/3.17.0/)

From the repository root, create an isolated environment and run the probe.

```sh
probe_dir=$(mktemp -d)
python3.12 -m venv "$probe_dir/env"
"$probe_dir/env/bin/python" -m pip install --no-cache-dir "mujoco==3.17.0" "numpy==2.5.5"
"$probe_dir/env/bin/python" contributions/mujoco-edge-contact/measure.py > "$probe_dir/observations.json"
```

Compare contact counts and values against the recorded JSON. Allow small floating-point differences across architectures.
