# PC game portability

## Grand Theft Auto VI release evidence

Checked November 26, 2026. Rockstar announced worldwide availability on PlayStation 5 and Xbox Series X|S on November 19. The official title page lists those platforms. The sources below did not provide a PC announcement, release date, system requirements, or PC store listing. [Rockstar launch announcement](https://www.rockstargames.com/newswire/article/39akk424a9oo53/grand-theft-auto-vi-now-available), [official title page](https://www.rockstargames.com/VI), [Take-Two launch release](https://ir.take2games.com/node/32696/pdf).

The console launch shows what counts as confirmation. For future PC updates, record the check date, publisher or authorized store, exact platform, and any stated release date or requirements. Preserve unknown fields until confirmed. Store availability can vary by region, so record the storefront region whenever a listing is used.

## First experiment

When a player changes 3D multisample anti-aliasing (MSAA), do slow frames occur when the setting changes, or when new materials first appear on screen? Godot issue #124873 has a revised sample demonstrating delayed draw compilations on one reported setup. Useful next evidence is a timed reproduction on a second configuration. [Godot issue and reproduction](https://github.com/godotengine/godot/issues/124873), [pipeline compilation documentation](https://docs.godotengine.org/en/stable/tutorials/performance/pipeline_compilations.html).

Use an original or redistributable 3D scene and a fixed camera path. Compare setting MSAA before loading with changing it at runtime, ending at the same MSAA level in both cases. Mark the setting change, load completion, and first appearance of each material variant. Collect separate traces for the settings/loading and traversal phases, with engine draw compilation counters alongside the frame timings. Record the engine version, renderer, resolution, frame cap, OS, GPU, driver and cache state. Use five runs per configuration and retain separate results for verified cold and warm cache runs. Report the time to load alongside traversal frame times so any shift in when the cost occurs is visible.

### Summarize a frame trace

Run this command from the repository root with Python 3.9 or later.

```sh
python3 contributions/pc-portability/analyze_frame_times.py contributions/pc-portability/sample.synthetic.csv
```

Supply one or more CSV files with a single `frame_ms` column and one positive, finite duration per rendered frame in milliseconds. Use a consistent definition of frame duration when comparing runs. Engine instrumentation can supply a common measurement across platforms. [PresentMon](https://github.com/GameTechDev/PresentMon) and [MangoHud](https://github.com/flightlessmango/MangoHud) can provide additional platform-specific timing evidence.

The script returns JSON with one summary per trace, including median and nearest-rank p99 frame time, plus the count and share of frames strictly above the chosen threshold. The default is 33.3 ms and can be changed using `--threshold-ms`.

The included sample is synthetic. It has 10 frames, a median of 16.5 ms, a p99 of 52 ms, and two frames above 33.3 ms. Hardware captures and comparisons remain open.
