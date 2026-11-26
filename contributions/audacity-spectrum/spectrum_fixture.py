import argparse
import csv
import math
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 48_000
FFT_SIZE = 4096
REPEATS = 16
BIN_WIDTH_HZ = SAMPLE_RATE / FFT_SIZE
TONES = ((40, 0.5), (80, 0.125))
GRID_TOLERANCE_HZ = 0.001
LEVEL_TOLERANCE_DB = 1.0
TSV_HEADER = ["Frequency (Hz)", "Level (dB)"]


def generate(path: Path) -> None:
    period = []
    for index in range(FFT_SIZE):
        signal = sum(
            amplitude * math.sin(math.tau * number * index / FFT_SIZE)
            for number, amplitude in TONES
        )
        period.append(round(signal * 32767))

    pcm = struct.pack(f"<{FFT_SIZE}h", *period) * REPEATS
    with wave.open(str(path), "wb") as output:
        output.setparams((1, 2, SAMPLE_RATE, 0, "NONE", "not compressed"))
        output.writeframes(pcm)


def read_spectrum(path: Path) -> list[tuple[float, float]]:
    data = []
    with path.open(encoding="utf-8-sig", newline="") as stream:
        rows = csv.reader(stream, delimiter="\t", strict=True)
        if next(rows, None) != TSV_HEADER:
            raise ValueError("expected Frequency (Hz) and Level (dB) tab-separated columns")
        for row in rows:
            try:
                frequency, level = map(float, row)
            except ValueError as error:
                raise ValueError(f"line {rows.line_num}: expected two numbers") from error
            if not math.isfinite(frequency) or math.isnan(level) or level == math.inf:
                raise ValueError(f"line {rows.line_num}: invalid frequency or level")
            data.append((frequency, level))

    # Audacity 3 omits DC and Nyquist. Either endpoint may be present in normalized exports.
    if data and data[0][0] == 0:
        data = data[1:]
    if data and data[-1][0] == SAMPLE_RATE / 2:
        data = data[:-1]

    if len(data) != FFT_SIZE // 2 - 1 or any(
        abs(frequency - number * BIN_WIDTH_HZ) > GRID_TOLERANCE_HZ
        for number, (frequency, _) in enumerate(data, start=1)
    ):
        raise ValueError("expected the complete 48 kHz / 4096-point FFT frequency grid")
    return data


def check(path: Path) -> list[tuple[float, float]]:
    data = read_spectrum(path)
    peaks = [
        current
        for previous, current, following in zip(data, data[1:], data[2:])
        if previous[1] <= current[1] > following[1]
    ]
    peaks.sort(key=lambda row: row[1], reverse=True)
    peaks = sorted(peaks[:2])
    if len(peaks) != len(TONES):
        raise ValueError("could not find two spectral peaks")

    for (frequency, _), (number, _) in zip(peaks, TONES):
        expected_hz = number * BIN_WIDTH_HZ
        if abs(frequency - expected_hz) > BIN_WIDTH_HZ + GRID_TOLERANCE_HZ:
            raise ValueError(f"peak at {frequency:g} Hz is more than one bin from {expected_hz:g} Hz")

    expected_gap = 20 * math.log10(TONES[0][1] / TONES[1][1])
    observed_gap = peaks[0][1] - peaks[1][1]
    if abs(observed_gap - expected_gap) > LEVEL_TOLERANCE_DB:
        raise ValueError(f"peak level difference was {observed_gap:.3f} dB, expected {expected_gap:.3f} dB ± 1 dB")
    return peaks


def check_file(parser: argparse.ArgumentParser, path: Path) -> list[tuple[float, float]]:
    try:
        return check(path)
    except (OSError, ValueError, csv.Error) as error:
        parser.error(f"{path}: {error}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and check an Audacity spectral reference.")
    commands = parser.add_subparsers(dest="command", required=True)
    generator = commands.add_parser("generate", help="write the reference WAV")
    generator.add_argument("output", type=Path)
    checker = commands.add_parser("check", help="check an export and optionally compare a second export")
    checker.add_argument("baseline", type=Path)
    checker.add_argument("candidate", type=Path, nargs="?")
    args = parser.parse_args()

    if args.command == "generate":
        try:
            generate(args.output)
        except OSError as error:
            parser.error(str(error))
        return

    baseline = check_file(parser, args.baseline)
    print(f"{args.baseline}: {baseline}")
    if args.candidate:
        candidate = check_file(parser, args.candidate)
        for (baseline_hz, baseline_db), (candidate_hz, candidate_db) in zip(baseline, candidate):
            if abs(baseline_hz - candidate_hz) > BIN_WIDTH_HZ + GRID_TOLERANCE_HZ:
                parser.error(f"{args.candidate}: peak frequency differs from baseline by more than one bin")
            if abs(baseline_db - candidate_db) > LEVEL_TOLERANCE_DB:
                parser.error(f"{args.candidate}: peak near {baseline_hz:g} Hz differs from baseline by more than 1 dB")
        print(f"{args.candidate}: {candidate}")


if __name__ == "__main__":
    main()
