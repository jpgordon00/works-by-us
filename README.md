# Works by Us

Works by Us is a public catalog of open problems. Pick a small contribution, work on it yourself or with your own AI, then share evidence that another person can check.

Browse the [public site](https://works-by-us.jacob-gordon255689.chatgpt.site/) or find the [problem catalog](src/catalog.json) in this repository. Entries identify open-source project briefs, upstream issues, open conjectures, and proposed investigations. Each provides a starting point, review criteria, and primary sources.

## Free software projects

The Software category is for original, free, open-source alternatives to familiar paid workflows. The first briefs cover a layered image editor (Photoshop), local household budgeting (Monarch Money), and offline PDF comparison (Acrobat Pro). Each states a small milestone someone can implement and verify, with links to existing open-source work.

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
