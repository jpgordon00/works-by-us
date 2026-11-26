import argparse
import csv
import hashlib
import subprocess
import tempfile
import time
from pathlib import Path


def decode_model(output, max_variable):
    literals = [
        int(token)
        for line in output.splitlines() if line.startswith("v ")
        for token in line.split()[1:]
    ]
    if not literals or literals[-1] != 0:
        raise ValueError("missing witness terminator")
    values = set(literals[:-1])
    for literal in values:
        if not 0 < abs(literal) <= max_variable or -literal in values:
            raise ValueError("out-of-range or contradictory witness literal")
    return values


def verify_model(path, output):
    with path.open(encoding="ascii") as formula:
        for line in formula:
            if line.startswith("p cnf "):
                _, _, max_variable, clause_count = line.split()
                break
            if line.strip() and not line.lstrip().startswith("c"):
                raise ValueError("invalid DIMACS header")
        else:
            raise ValueError("missing DIMACS header")

        values = decode_model(output, int(max_variable))
        matched = False
        clauses = 0
        for line in formula:
            if line.lstrip().startswith("c"):
                continue
            for token in line.split():
                literal = int(token)
                if literal == 0:
                    if not matched:
                        raise ValueError(f"witness fails clause {clauses + 1}")
                    clauses += 1
                    matched = False
                else:
                    matched |= literal in values
        if clauses != int(clause_count):
            raise ValueError("unexpected number of clauses")


def compare_case(path, expected, binary, checker, limit):
    with tempfile.TemporaryDirectory(prefix="sat-comparison-") as scratch:
        proof = Path(scratch) / "proof.drat"
        start = time.perf_counter()
        try:
            run = subprocess.run([binary, path, proof], capture_output=True, text=True, timeout=limit)
        except subprocess.TimeoutExpired:
            return "timeout", time.perf_counter() - start, ""
        elapsed = time.perf_counter() - start
        decision = {10: ("sat", "s SATISFIABLE"), 20: ("unsat", "s UNSATISFIABLE")}.get(run.returncode)
        if decision is None or decision[1] not in run.stdout.splitlines():
            return "solver-error", elapsed, f"exit code {run.returncode}"
        result, _ = decision
        if result != expected:
            return "disagreement", elapsed, f"reported {result}, published {expected}"
        if result == "sat":
            try:
                verify_model(path, run.stdout)
            except ValueError as error:
                return "invalid-model", elapsed, str(error)
            return "sat-verified", elapsed, ""
        try:
            verification = subprocess.run(
                [checker, path, proof], capture_output=True, text=True, timeout=limit
            )
        except subprocess.TimeoutExpired:
            return "proof-timeout", elapsed, ""
        if verification.returncode != 0 or "s VERIFIED" not in verification.stdout.splitlines():
            return "invalid-proof", elapsed, f"checker exit code {verification.returncode}"
        return "unsat-verified", elapsed, ""


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(block)
    return checksum.hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Compare two SAT solvers on the pinned competition subset.")
    parser.add_argument("--inputs", required=True, type=Path, help="Directory containing decompressed <instance>.cnf files.")
    parser.add_argument("--kissat", required=True, type=Path)
    parser.add_argument("--cadical", required=True, type=Path)
    parser.add_argument("--drat-trim", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=60, help="Wall seconds allowed for each solve and separately for proof checks.")
    parser.add_argument("--output", required=True, type=Path, help="CSV results, including status and solve time.")
    args = parser.parse_args()
    if args.limit <= 0:
        parser.error("--limit must be positive")
    solvers = [("kissat", args.kissat.resolve()), ("cadical", args.cadical.resolve())]
    for binary in [args.drat_trim, args.kissat, args.cadical]:
        if not binary.is_file():
            parser.error(f"binary missing: {binary}")
    with Path(__file__).with_name("instances.csv").open(newline="", encoding="utf-8") as stream:
        cases = list(csv.DictReader(stream))
    for case in cases:
        path = args.inputs / (case["instance"] + ".cnf")
        if not path.is_file() or digest(path) != case["sha256"]:
            parser.error(f"missing input or SHA-256 mismatch: {path}")

    with args.output.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(["instance", "family", "expected", "solver", "status", "solve_seconds", "detail"])
        for index, case in enumerate(cases):
            path = args.inputs / (case["instance"] + ".cnf")
            order = solvers if index % 2 == 0 else solvers[::-1]
            for name, binary in order:
                status, elapsed, detail = compare_case(path, case["expected"], binary, args.drat_trim.resolve(), args.limit)
                writer.writerow([case["instance"], case["family"], case["expected"], name, status, f"{elapsed:.3f}", detail])
                stream.flush()
                print(f"{case['family']}: {name} {status} ({elapsed:.3f}s)", flush=True)


if __name__ == "__main__":
    main()
