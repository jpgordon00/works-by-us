# Propose a problem

[Submit a problem][submit] · [Most supported][top] · [Newest][new]

Anyone with a GitHub account can propose a problem, add a comment, or vote. A question and a category are enough to start. Choose **Other or unsure** for ideas outside the current categories. Open a proposal and add a 👍 reaction to its original post if you want the community to work on it. Use **Newest** to find ideas that have had less time to gather support.

The proposal board is public. Share only material you can publish. If someone already proposed the same problem, add your context and vote there so contributors can find the discussion in one place.

## How a proposal becomes active

1. **Proposed.** GitHub posts the form as an issue with the `problem-proposal` label. People can vote, suggest sources, and help define a small first step or a way to check it. GitHub hosts the form, comments, and votes. The project pays for zero AI calls for this flow.
2. **Ready to work on.** A maintainer reviews both the newest and most supported proposals. A proposal is ready when it has a clear question, an in-scope first contribution, and evidence someone else can check. Add relevant public sources when available. Votes help prioritize review. There is no vote minimum.
3. **Active.** A contributor opens a catalog pull request that links to the proposal. The maintainer assigns a stable catalog ID, checks the brief and its sources, and reviews the pull request. After the entry is merged and published, close the proposal with a link to the active problem.

## Maintainer notes

- Keep duplicates linked to the original proposal. Ask for a specific missing detail when a proposal needs work. Use GitHub moderation for spam or abuse.
- Review unusual vote spikes in context. A 👍 is a signal from a GitHub account. GitHub account counts can include more than one account controlled by the same person.
- Give the approved brief a unique lowercase kebab-case ID and an existing category in [the catalog](../src/catalog.json). Add a question title, track, summary, context, first task, review criteria, kind, keywords, and titled first-party HTTPS sources when available. Any related IDs must already exist. Put starter material under `contributions/<id>/` and link its README from the brief.
- Publish only merged catalog entries to the site and MCP. Keep raw proposal text, comments, and attachments on GitHub. Review the proposed scope and rewrite or verify the content before promotion. Issue creation and reactions leave provisioning and agent dispatch untouched.

[submit]: https://github.com/jpgordon00/works-by-us/issues/new?template=problem.yml
[top]: https://github.com/jpgordon00/works-by-us/issues?q=is%3Aissue%20is%3Aopen%20label%3Aproblem-proposal%20sort%3Areactions-%2B1-desc
[new]: https://github.com/jpgordon00/works-by-us/issues?q=is%3Aissue%20is%3Aopen%20label%3Aproblem-proposal%20sort%3Acreated-desc
