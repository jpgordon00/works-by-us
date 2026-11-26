"""Compare measured circular speeds to a Newtonian stellar-and-gas mass model."""

import argparse
import hashlib
import io
import math
import statistics
from pathlib import Path
from typing import NamedTuple
from urllib.request import urlopen
from zipfile import ZipFile

SOURCE = "https://astroweb.case.edu/SPARC/Rotmod_LTG.zip"
ARCHIVE_SHA256 = "0a80cc90714828cc28b7dd57923576714d209f2490328c087c4a4ad607faf588"
DISK_RATIOS = (0.3, 0.5, 0.8)
BULGE_RATIO = 0.7


class Point(NamedTuple):
    radius: float
    observed: float
    error: float
    gas: float
    disk: float
    bulge: float


def load_outer_points(galaxy, archive_path):
    if archive_path:
        data = archive_path.read_bytes()
    else:
        with urlopen(SOURCE, timeout=30) as response:
            data = response.read()
    if hashlib.sha256(data).hexdigest() != ARCHIVE_SHA256:
        raise ValueError("Archive differs from the pinned SPARC release")
    with ZipFile(io.BytesIO(data)) as archive:
        member = galaxy + "_rotmod.dat"
        if member not in archive.namelist():
            raise ValueError("Galaxy missing from SPARC: " + galaxy)
        lines = archive.read(member).decode("ascii").splitlines()

    points = [Point(*map(float, line.split()[:6])) for line in lines
              if line.strip() and not line.startswith("#")]
    outer_edge = max(p.radius for p in points)
    return len(points), sorted(p for p in points if p.radius >= outer_edge / 2)


def baryonic_speed(point, disk_ratio):
    # SPARC encodes the direction of the radial force in the sign of each speed.
    squared_speed = (point.gas * abs(point.gas)
                     + disk_ratio * point.disk * abs(point.disk)
                     + BULGE_RATIO * point.bulge * abs(point.bulge))
    if squared_speed < 0:
        raise ValueError(f"Net outward baryonic force at {point.radius:g} kpc, disk ratio {disk_ratio}")
    return math.sqrt(squared_speed)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--galaxy", default="NGC3198", help="Exact SPARC identifier")
    parser.add_argument("--archive", type=Path, help="Previously downloaded Rotmod_LTG.zip")
    args = parser.parse_args()
    total, outer = load_outer_points(args.galaxy, args.archive)
    print(f"{args.galaxy}: {total} measured radii; {len(outer)} in the outer half by radius")
    print("Disk M/L = 0.5, bulge M/L = 0.7 (solar units at 3.6 microns)")
    print("radius_kpc observed_km/s err_km/s baryonic_km/s difference_km/s")
    for point in outer:
        predicted = baryonic_speed(point, 0.5)
        print(f"{point.radius:.2f} {point.observed:.2f} {point.error:.2f} "
              f"{predicted:.2f} {point.observed - predicted:.2f}")

    print("disk_M/L median_outer_difference_km/s")
    for ratio in DISK_RATIOS:
        median_gap = statistics.median(p.observed - baryonic_speed(p, ratio) for p in outer)
        print(f"{ratio:.1f} {median_gap:.2f}")


if __name__ == "__main__":
    main()
