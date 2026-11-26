# Twelve public SAT Competition cases

Two sequential solver releases, Kissat 4.0.4 and CaDiCaL 3.1.0, get the same 60-second wall-clock limit on each case. SAT results count only when the emitted assignment satisfies every input clause. UNSAT results count only when an independent DRAT checker verifies the emitted proof within its separate 60-second limit.

## Sample

[instances.csv](instances.csv) freezes twelve SAT Competition 2026 Main Track instances by GBD identifier and SHA-256 of the decompressed DIMACS file. The sample has six published SAT cases and six published UNSAT cases, each from a different family.

The selection used previously verified times from the published `anders_satsuma-iter-kissat[main]` run as a reference. It intersected the competition URI list and family metadata, then filled two cases per result type for time targets of 2.5, 8 and 24 seconds in that order. Within each target and type it ranked candidates by distance on a logarithmic scale and then by identifier, skipping previously chosen families, reference runs over 45 seconds and archives over 10 MB. Those times are sampling inputs and reflect a different competition environment. The new solver measurements played no role in selecting inputs. [Competition results](https://satcompetition.github.io/2026/downloads/scores.csv) · [Family metadata](https://satcompetition.github.io/2026/downloads/benchmark-compilation-script/benchmarks2026.csv) · [Benchmark downloads](https://satcompetition.github.io/2026/downloads.html)

## Recorded run

On November 26, 2026, the pinned solvers completed the 24 scheduled runs on an Apple M4 Pro with arm64 macOS 15.7.4 and Apple Clang 17. The driver ran one scored solver at a time using sequential binaries. [Per-instance results](results.csv)

| Solver | Independently verified SAT | Independently verified UNSAT | Solve timeout | Proof check timeout | Witness failed check |
| --- | ---: | ---: | ---: | ---: | ---: |
| Kissat 4.0.4 | 5 | 2 | 5 | 0 | 0 |
| CaDiCaL 3.1.0 | 4 | 1 | 5 | 1 | 1 |

Kissat returned seven independently verified answers and CaDiCaL returned five on this fixed sample with default solver options. Both solvers reached the time limit on several families.

A diagnostic rerun reproduced CaDiCaL’s incomplete emitted witness on one SAT instance. Clause 2 was `-532 -533 0`, while the default output assigned `532` and omitted variable `533`. Running that case with `--modelalllits=1` printed all 53,487 variable assignments, including `-533`, and the checker verified every clause. The diagnostic uses a different option and leaves the default-run count as recorded.

## Reproduce

Run from the repository root with Python 3.9 or later, Git, a C and C++ toolchain, make, curl and xz. Allow for about 220 MB of decompressed inputs plus solver builds and temporary proof files. Build the published solver releases and pin the independent checker to its source commit.

```sh
set -e
sat_workspace=$(mktemp -d)
git clone --depth 1 --branch rel-4.0.4 https://github.com/arminbiere/kissat.git "$sat_workspace/kissat"
git clone --depth 1 --branch rel-3.1.0 https://github.com/arminbiere/cadical.git "$sat_workspace/cadical"
git clone https://github.com/marijnheule/drat-trim.git "$sat_workspace/drat-trim"
git -C "$sat_workspace/drat-trim" checkout 2e3b2dc0ecf938addbd779d42877b6ed69d9a985
test "$(git -C "$sat_workspace/kissat" rev-parse HEAD)" = 8af8e56f174b778aef3aa45af9f739b2a5f492c2
test "$(git -C "$sat_workspace/cadical" rev-parse HEAD)" = 6b3d70b9ce00ecbce3f829bab76d185f0e92618c
(cd "$sat_workspace/kissat" && ./configure && make -j2)
(cd "$sat_workspace/cadical" && ./configure && make -j2)
cc -O2 -o "$sat_workspace/drat-check" "$sat_workspace/drat-trim/drat-trim.c"
```

Download the predetermined instances and run the same driver. It verifies file hashes before starting, alternates solver order, and reports solver time separately from proof verification.

```sh
mkdir "$sat_workspace/inputs"
tail -n +2 contributions/sat-competition/instances.csv |
while IFS=, read -r case_id remaining_fields; do
  curl --fail --location --silent --show-error \
    "https://benchmark-database.de/file/$case_id" -o "$sat_workspace/instance.cnf.xz"
  xz -dc "$sat_workspace/instance.cnf.xz" > "$sat_workspace/inputs/$case_id.cnf"
done
python3 contributions/sat-competition/compare.py \
  --inputs "$sat_workspace/inputs" \
  --kissat "$sat_workspace/kissat/build/kissat" \
  --cadical "$sat_workspace/cadical/build/cadical" \
  --drat-trim "$sat_workspace/drat-check" \
  --output "$sat_workspace/results.csv"
```

A fresh run may complete a different set because of hardware, compiler, system load and decisions near the time limit. The results are for these twelve inputs and the pinned solver builds. [Kissat 4.0.4](https://github.com/arminbiere/kissat/releases/tag/rel-4.0.4) · [CaDiCaL 3.1.0](https://github.com/arminbiere/cadical/releases/tag/rel-3.1.0) · [SAT Competition certificate rules](https://satcompetition.github.io/2026/output.html)
