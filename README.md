# Crowdsourced Intelligence

Crowdsourced Intelligence is a public catalog of open problems. Pick a small contribution, work on it yourself or with your own AI, then share evidence that another person can check.

Browse the [public site](https://works-by-us.jacob-gordon255689.chatgpt.site/) or find the [problem catalog](src/catalog.json) in this repository. Entries identify open-source project briefs, upstream issues, open conjectures, and proposed investigations. Each provides a starting point, review criteria, and primary sources.

## Sectors and questions

| Sector | Example questions |
| --- | --- |
| Math & algorithms | Does P equal NP? Which SAT solver finishes more public cases in 60 seconds? What does November’s matrix-multiplication proof check in Lean? |
| PC games | Has Rockstar announced GTA VI for PC? Does a Godot texture finish sharpening after the camera stops? Can a launcher see the game’s real exit code through Gamescope? |
| Software | Can a free editor preserve layers and masks? Can a budget app import two bank CSVs without double-counting? Does Audacity’s restored Plot Spectrum find the same peaks as Audacity 3? |
| AI evaluation | Does memory help an agent solve ARC-AGI-3 levels in fewer moves? How sensitive are AI time-horizon estimates to the mix of tasks? |
| Public data | Do both USGS APIs report the same river discharge? Are geometry measures and coordinate systems preserved in a GeoParquet round trip? |
| Civic & accessibility | Which mapped Seattle routes to transit leave wheelchair access uncertain? Can each validation notice in a shared timetable be attributed to the right operator? |
| Culture & archives | Can a shareable link open a manuscript at the right page? Can an archived Load More button replay results from its own capture date? |
| Science & energy | Do satellite and gauge elevation changes agree at Lake Powell? Which Zarr chunk shape reads fewer bytes for a point history and for a map? |
| Robotics simulation | When does a MuJoCo box-on-edge contact collapse to one point? Does Gazebo report a scripted actor at its actual simulated position? |

## Reproduce a starter contribution

- The [3-SAT to CLIQUE proof and checker](contributions/3sat-clique/) reproduces a known reduction on 1,773 bounded cases and checks witnesses in both directions.
- The [parity circuit proof and checker](contributions/parity-dnf/) verifies the exact DNF term counts for one to six variables and checks a linear-size unrestricted circuit.
- The [SAT solver comparison](contributions/sat-competition/) uses twelve pinned competition inputs and validates assignments and unsatisfiability proofs independently.
- The [PC portability starter](contributions/pc-portability/) records Rockstar’s November 2026 platform status and provides a Godot experiment protocol and a frame-trace analyzer. The sample frame trace is synthetic. Hardware timings are open work.
- The [USGS data reconciliation](contributions/usgs-daily-api/) matched all 21 gauge-days across two live APIs and verified pagination.
- The [Audacity spectrum fixture](contributions/audacity-spectrum/) generates a two-tone WAV and checks spectrum exports against independently verified peak frequencies and levels.
- The [MuJoCo box contact experiment](contributions/mujoco-edge-contact/) reproduces the reported one-contact geometry with a pinned runtime and tests nearby poses.
- The [Zarr chunk layout benchmark](contributions/zarr-chunk-layout/) measures how two chunk shapes change the bytes read for a point’s history and a regional snapshot.

## Free software projects

The Software category is for original, free, open-source alternatives to familiar paid workflows. The first briefs cover a layered image editor (Photoshop), local household budgeting (Monarch Money), and offline PDF comparison (Acrobat Pro). Each states a small milestone someone can implement and verify, with links to existing open-source work.

## Watch a run

Open the [solver replay](https://works-by-us.jacob-gordon255689.chatgpt.site/watch/example/) to see the 3-SAT to CLIQUE checker try assignments and verify a witness. **Start a new run** executes the same bounded experiment on the server and gives it a fresh watch link. Two viewers opening that link see the same recorded steps.

To broadcast work from your own agent on any catalog problem, use the [agent reporting instructions](docs/watch-runs.md). The watch link is public and read-only. You choose which milestones to send.

## Use MCP

Add this public Streamable HTTP URL to any remote MCP client.

    https://works-by-us.jacob-gordon255689.chatgpt.site/api/mcp

For Codex:

    codex mcp add works-by-us --url https://works-by-us.jacob-gordon255689.chatgpt.site/api/mcp

An example request is “Find the free Monarch Money alternative and suggest one thing I can contribute.”

| Tool | Use |
| --- | --- |
| list_categories | List categories, counts and links. |
| list_problems | Search by category ID, keywords, or both. |
| get_problem | Read a problem's source links, task and review criteria. |
| prepare_contribution | Format evidence as a draft and return a link to review it on GitHub. |

The catalog and MCP require no credentials. Publishing an issue or pull request uses GitHub and your own account. Drafts are prepared in the response and are not published by the server. A GitHub contribution is a proposal until someone else reviews its evidence.

## Contribute

Open a [GitHub issue](https://github.com/jpgordon00/works-by-us/issues) with a problem link, evidence, and reproduction steps. For a catalog addition, propose a description, primary source, small task and checkable acceptance criteria. Check the upstream project’s own contribution guidelines before sending it a patch.

## Run locally

Use a current Node.js release. There are no application dependencies.

    npm test
    npm run dev

The preview prints its local address. The Worker bundle is generated in dist/server. The application uses the same catalog for the website, JSON, and MCP.

## Design references

The idea of handing one well-scoped research step to an agent comes from [pequalnp.com](https://pequalnp.com/). The site uses a direct, browseable index and a separate MCP setup page. Clear actions, keyboard-readable navigation, and human review draw on [Apple’s Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines), [Microsoft’s Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/), and [Anthropic’s frontend design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design). The project is independent of the linked research and upstream projects.

The homepage layer preview uses the [Richat Structure photograph](https://images.nasa.gov/details/GSFC_20171208_Archive_e002163) by NASA/GSFC/Landsat 7/USGS. The budgeting and PDF examples use illustrative data.
