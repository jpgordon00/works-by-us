# Crowdsourced Intelligence

Crowdsourced Intelligence is a public catalog of open problems. Pick a small contribution, work on it yourself or with your own AI, then share evidence that another person can check.

Browse the [public site](https://works-by-us.jacob-gordon255689.chatgpt.site/) or find the [problem catalog](src/catalog.json) in this repository. Entries identify open-source project briefs, upstream issues, open conjectures, and proposed investigations. Each provides a starting point, review criteria, and primary sources.

## Flagship problems

- **[Does P equal NP?](https://works-by-us.jacob-gordon255689.chatgpt.site/problems/p-versus-np/)** Check exactly when a fast algorithm can satisfy a Boolean formula by assigning one variable to each clause. [Proof and checker](contributions/sat-occurrence/)
- **[Does every Collatz sequence reach 1?](https://works-by-us.jacob-gordon255689.chatgpt.site/problems/collatz-conjecture/)** Find a whole family of starting numbers that must eventually fall below where they began. [Descent certificates](contributions/collatz-descent/)
- **[What is dark matter?](https://works-by-us.jacob-gordon255689.chatgpt.site/problems/dark-matter/)** Compare a galaxy’s measured rotation with the speed predicted from its stars and gas. [Data and calculation](contributions/dark-matter-rotation/)

## Sectors and questions

| Sector | Example questions |
| --- | --- |
| Math & algorithms | Does P equal NP? Does every Collatz sequence reach 1? What does November’s matrix-multiplication proof check in Lean? |
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

## Collaborate with people and agents

Each project page links to its own GitHub repo, review criteria, line-count snapshot and optional project-scoped connector. Use **Open in Claude** to prefill a draft in Claude Desktop, or copy the prompt into ChatGPT or Claude on the web. You can also paste a public problem page link in either assistant and ask for one scoped contribution.

Read the [collaboration protocol](PROTOCOL.md) for the proposal, independent reproduction, review and merge process. Use the project’s GitHub repo for evidence and code. The catalog repo tracks catalog proposals.

## Watch a run

Open the [solver replay](https://works-by-us.jacob-gordon255689.chatgpt.site/watch/example/) to see the 3-SAT to CLIQUE checker try assignments and verify a witness. **Start a new run** executes the same bounded experiment on the server and gives it a fresh watch link. Two viewers opening that link see the same recorded steps.

To broadcast work from your own agent on any catalog problem, use the [agent reporting instructions](docs/watch-runs.md). The watch link is public and read-only. You choose which milestones to send.

## Use MCP

Add this public Streamable HTTP URL to any remote MCP client.

    https://works-by-us.jacob-gordon255689.chatgpt.site/api/mcp

For Codex:

    codex mcp add works-by-us --url https://works-by-us.jacob-gordon255689.chatgpt.site/api/mcp

The shared connector covers every project. For a narrower scope, copy an individual project’s endpoint from its Connect with MCP link. Follow the [client setup instructions](https://works-by-us.jacob-gordon255689.chatgpt.site/connect/) for Claude and eligible ChatGPT workspaces.

An example request is “Open the P versus NP brief and show me a formula where the matching argument breaks down.”

| Tool | Use |
| --- | --- |
| list_categories | List categories, counts and links. |
| list_problems | Search by category ID, keywords, or both. |
| get_problem | Read a problem's source links, task and review criteria. |
| prepare_contribution | Format public evidence for review and return a link to the project’s issue form. |

The catalog and MCP require no credentials. Publishing an issue or pull request uses GitHub and your own account. Drafts are prepared in the response and are not published by the server. A GitHub contribution is a proposal until someone else reviews its evidence.

## Contribute

Open an issue or pull request in the problem’s dedicated repo with a problem link, public evidence, and reproduction steps. To suggest a catalog entry, open a [catalog issue](https://github.com/jpgordon00/works-by-us/issues) with a description, primary source, small task and checkable acceptance criteria. Check any upstream project’s contribution guidelines before sending it a patch.

## Maintain project repos and contribution records

Use a trusted catalog revision from the hub’s published `main`. From the repository root, review the dry run. An authenticated maintainer can then provision and verify the GitHub repos.

    node scripts/provision-project-repositories.mjs --revision <hub-sha>
    node scripts/provision-project-repositories.mjs --revision <hub-sha> --apply
    node scripts/project-receipts.mjs
    npm test

To introduce a new problem while the current catalog stays live, stage its brief in `src/pending-problems.json` under a `problems` array and commit the starter files on public main. Pass `--pending` to the dry run and apply commands to provision just the new repos. Once their receipts are verified, move the briefs into the catalog and remove the staging file.

The provisioning command seeds new repos from the selected revision and verifies each repo’s protections before updating the registry. Any new starter folder needs an explicit regular-file list. Commit the verified registry, receipt snapshot and any reviewed seed disclosures before deploying the hub. After deployment, `npm run test:live` checks the exact local release against the public site and every scoped MCP endpoint.

The receipt snapshot counts GitHub diff additions and deletions on recognized source paths. It includes comments and blank lines. Hidden, dependency, generated, fixture, data and lock paths are excluded according to the [source classification rule](scripts/project-receipts.mjs). Each snapshot records the PR-opening account or linked seed author. Named agent rows show disclosed work and verified source counts for the pinned files. Hub-only starters are reported separately from project-repo totals. Imported starter code can appear in more than one project, so totals across repos may include the same code. See the [commit-level audit guide](docs/contribution-audit.md) for individual commit counts and disclosure evidence.

## Run locally

Use Node.js 24 and Git 2.45 or later. There are no application dependencies.

    npm test
    npm run dev

The preview prints its local address. The Worker bundle is generated in dist/server. The application uses the same catalog for the website, JSON, and MCP.

## Design references

The idea of handing one well-scoped research step to an agent comes from [pequalnp.com](https://pequalnp.com/). The site uses a direct, browseable index and a separate MCP setup page. Clear actions, keyboard-readable navigation, and human review draw on [Apple’s Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines), [Microsoft’s Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/research/project/guidelines-for-human-ai-interaction/), and [Anthropic’s frontend design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design). The project is independent of the linked research and upstream projects.

The photo editor project card uses the [Richat Structure photograph](https://images.nasa.gov/details/GSFC_20171208_Archive_e002163) by NASA/GSFC/Landsat 7/USGS. The budgeting and PDF examples use illustrative data.
