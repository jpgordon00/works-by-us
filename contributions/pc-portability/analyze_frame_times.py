import argparse
import csv
import json
import math
import statistics
from pathlib import Path


def read_frame_times(path: Path) -> list[float]:
    frame_times = []
    with path.open(encoding="utf-8-sig", newline="") as stream:
        rows = csv.reader(stream, strict=True)
        if next(rows, None) != ["frame_ms"]:
            raise ValueError("expected a single CSV column named frame_ms")
        for row in rows:
            if len(row) != 1:
                raise ValueError(f"line {rows.line_num}: expected one frame duration")
            try:
                frame_time = float(row[0])
            except ValueError:
                raise ValueError(f"line {rows.line_num}: invalid frame duration") from None
            if not math.isfinite(frame_time) or frame_time <= 0:
                raise ValueError(f"line {rows.line_num}: duration must be finite and positive")
            frame_times.append(frame_time)

    if not frame_times:
        raise ValueError("trace contains no frames")
    return frame_times


def summarize(path: Path, threshold_ms: float) -> dict:
    frame_times = sorted(read_frame_times(path))
    frame_count = len(frame_times)
    slow_frames = sum(frame_time > threshold_ms for frame_time in frame_times)
    middle = frame_count // 2
    if frame_count % 2 == 0:
        median_ms = statistics.mean(frame_times[middle - 1 : middle + 1])
    else:
        median_ms = frame_times[middle]

    return {
        "trace": str(path),
        "frames": frame_count,
        "median_ms": median_ms,
        "p99_ms": frame_times[math.ceil(0.99 * frame_count) - 1],
        "max_ms": frame_times[-1],
        "threshold_ms": threshold_ms,
        "frames_over_threshold": slow_frames,
        "percent_over_threshold": 100 * slow_frames / frame_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize per-frame duration CSV traces.")
    parser.add_argument("traces", type=Path, nargs="+")
    parser.add_argument("--threshold-ms", type=float, default=33.3)
    args = parser.parse_args()
    if not math.isfinite(args.threshold_ms) or args.threshold_ms <= 0:
        parser.error("--threshold-ms must be finite and positive")

    summaries = []
    for path in args.traces:
        try:
            summaries.append(summarize(path, args.threshold_ms))
        except (OSError, ValueError, csv.Error) as error:
            parser.error(f"{path}: {error}")
    print(json.dumps(summaries, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
