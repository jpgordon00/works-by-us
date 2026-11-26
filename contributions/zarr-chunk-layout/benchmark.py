import json
import platform
import statistics
import tempfile
import time
from pathlib import Path

import numpy as np
import zarr
from zarr.codecs import ZstdCodec
from zarr.storage import LocalStore, WrapperStore

LAYOUTS = {
    "time-oriented": (30, 15, 15),
    "map-oriented": (1, 90, 90),
}
WORKLOADS = {
    "point-history": (slice(0, 90), 45, 123),
    "region-snapshot": (45, slice(0, 90), slice(90, 180)),
}
EXPECTED_CHUNK_READS = {
    "time-oriented": {"point-history": 3, "region-snapshot": 36},
    "map-oriented": {"point-history": 90, "region-snapshot": 1},
}


class CountingStore(WrapperStore):
    def __init__(self, path):
        super().__init__(LocalStore(path, read_only=True))
        self.reads = []

    async def get(self, key, prototype, byte_range=None):
        data = await super().get(key, prototype, byte_range)
        self.reads.append((key, len(data) if data is not None else 0))
        return data

    async def get_partial_values(self, prototype, key_ranges):
        ranges = list(key_ranges)
        results = await super().get_partial_values(prototype, ranges)
        self.reads.extend(
            (key, len(data) if data is not None else 0)
            for (key, _), data in zip(ranges, results, strict=True)
        )
        return results


def run_workload(path, selection, expected):
    store = CountingStore(path)
    before = time.perf_counter()
    read = zarr.open_array(store=store, mode="r")[selection]
    elapsed_ms = 1000 * (time.perf_counter() - before)
    np.testing.assert_array_equal(read, expected)
    data_reads = [size for key, size in store.reads if key.startswith("c/")]
    return {
        "chunk_reads": len(data_reads),
        "data_bytes": sum(data_reads),
        "metadata_requests": len(store.reads) - len(data_reads),
        "metadata_bytes": sum(size for key, size in store.reads if not key.startswith("c/")),
    }, elapsed_ms


def main():
    values = np.random.default_rng(20261126).integers(
        1, 10_001, size=(120, 180, 360), dtype=np.int32
    )
    results = []
    with tempfile.TemporaryDirectory(prefix="chunk-layout-") as scratch:
        for layout, chunks in LAYOUTS.items():
            path = Path(scratch) / layout
            zarr.create_array(
                store=path, data=values, chunks=chunks, zarr_format=3,
                compressors=[ZstdCodec(level=3, checksum=False)],
            )
            for workload, selection in WORKLOADS.items():
                samples = [run_workload(path, selection, values[selection]) for _ in range(5)]
                counts, _ = samples[0]
                assert counts["chunk_reads"] == EXPECTED_CHUNK_READS[layout][workload]
                assert all(sample_counts == counts for sample_counts, _ in samples)
                timings = [round(elapsed, 3) for _, elapsed in samples]
                results.append({
                    "layout": layout, "chunk_shape": chunks, "workload": workload, **counts,
                    "elapsed_ms": timings, "median_ms": statistics.median(timings),
                })
    print(json.dumps({
        "python": platform.python_version(), "zarr": zarr.__version__, "numpy": np.__version__,
        "system": platform.system(), "architecture": platform.machine(),
        "storage": "local filesystem", "results": results,
    }, indent=2))


if __name__ == "__main__":
    main()
