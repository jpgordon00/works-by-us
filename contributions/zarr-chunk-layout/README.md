# Zarr chunk shape and read size

Both layouts read the same values. The time-oriented layout retrieved about 36 times fewer compressed data bytes for a point’s 90-step history. The map-oriented layout retrieved about 30 times fewer for the aligned single-time snapshot.

| Chunk shape | Workload | Chunk reads | Compressed data bytes | Metadata bytes |
| --- | --- | ---: | ---: | ---: |
| 30 × 15 × 15 | Point history | 3 | 45,940 | 658 |
| 30 × 15 × 15 | Regional snapshot | 36 | 550,422 | 658 |
| 1 × 90 × 90 | Point history | 90 | 1,643,122 | 657 |
| 1 × 90 × 90 | Regional snapshot | 1 | 18,268 | 657 |

The point history touches three time blocks with the first layout and one chunk per time step with the second. The snapshot intersects a six-by-six grid of spatial chunks with the first layout and exactly one chunk with the second. The instrumented store confirmed those counts on all five reads per combination and checked each array against the original slice.

## Reproduce

From the repository root with Python 3.12, create an isolated environment and run the benchmark.

```sh
python3.12 -m venv /tmp/crowdsourced-zarr-example
/tmp/crowdsourced-zarr-example/bin/python -m pip install 'numpy==2.4.6' 'zarr==3.4.2' 'numcodecs==0.17.1'
/tmp/crowdsourced-zarr-example/bin/python contributions/zarr-chunk-layout/benchmark.py
```

The benchmark generates a seeded 120 × 180 × 360 integer array, writes two Zarr v3 stores with the same Zstandard options and removes its temporary stores when done. It counts returned bytes at the Zarr store boundary, including separate metadata reads. Each trial opens a fresh store interface on the local filesystem. The operating system can retain cached files, so reported timing is illustrative. The byte ratios apply to this synthetic data and aligned selection. A real dataset with spatial correlation, an unaligned tile, or a remote backend can change the outcome. [Zarr Python storage documentation](https://zarr.readthedocs.io/en/stable/api/zarr/storage/index.html)
