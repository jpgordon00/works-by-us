# Crowdsourced Intelligence collaboration protocol

Version 1 · [Public catalog](https://works-by-us.jacob-gordon255689.chatgpt.site/problems/) · [Connect an agent](https://works-by-us.jacob-gordon255689.chatgpt.site/connect/)

Agents and people contribute through the same small, reviewable unit of work. MCP provides the curated starting brief and local draft text. GitHub holds proposals, reviews and accepted changes. A reviewer checks each proposed change before it becomes part of a project’s default branch.

## The contribution cycle

1. **Discover.** Give Claude or ChatGPT a public problem page, or call `list_problems` and `get_problem` on the connector. The brief identifies the dedicated GitHub repo, scope, sources and acceptance criteria. The site’s Claude Desktop link prefills a prompt for you to review.
2. **Propose.** Open a GitHub issue or a draft pull request in the dedicated repo. Use the task format below. Start a new issue for a materially different experiment. To submit or vote on a new problem, use the [community proposal queue](docs/community-proposals.md). Only human-reviewed catalog entries reach MCP. Use a fork and a branch for a patch.
3. **Work and hand off.** Work against a named base commit. Attach public sources, small licensed fixtures, a test or verification method, expected output and measured output. The problem page and connector link to the project’s GitHub Issues and PRs. Check existing work there before starting. Claim one distinct task in its issue, link the immutable artifact, and leave a short status note with the next check. A second contributor using their own assistant and GitHub account can reproduce the same artifact independently or work on a separate item. Record failed checks, negative findings and the remaining task in the public handoff.
4. **Review.** A human maintainer reviews the exact PR head, including provenance, licenses, changed workflow and dependency files, and whether the evidence supports the conclusion. Test externally supplied code only after reviewing it, inside a disposable environment with no credentials, no sensitive mounts, no network, and bounded CPU, memory and time. Review any change to the head again. Add public summaries of results to the PR or an accepted, reviewed project note.
5. **Accept.** A maintainer approves and merges on GitHub. The default branches require independent approval for the latest push, dismiss stale approvals and disallow force pushes and deletion. GitHub Actions are disabled in the project repos so forks and proposed workflows cannot start jobs there. An owner-authored pull request requires an independent eligible code owner. Projects currently start with one code owner, so add a second eligible code owner before merging an owner-authored PR.
6. **Audit.** Refresh the hub’s read-only contribution snapshot from GitHub. Check the matching PR, target branch, submitted head, merged commit and submitter account. Accepted evidence stays in the project’s PR and repository history. An issue discussion is a proposal until its evidence has been independently reviewed.

The [3-SAT to CLIQUE workroom](https://github.com/jpgordon00/ci-3sat-to-clique/issues/1) shows a pinned checker, a replay submitted by the maintainer on behalf of a fresh read-only agent, and a next task a new contributor can pick up.

### A useful proposal

```text
Problem ID and public brief URL
One claim or intended behavior
Base SHA and proposed head SHA, if code is involved
Public evidence, fixtures, dependency versions and license
Reproduction steps, expected results and observed results
What failed or is still uncertain
GitHub submitter and contributor disclosures
```

For AI or mixed authorship, record the tool or agent name, the work it performed, any human modifications, and the exact commits or files that support a line allocation. Include `Agent-Author: <agent-name>` as a commit trailer for an entirely agent-authored commit when an isolated audit is useful. Use prose disclosure for mixed work and leave the split unknown unless you can reproduce it. A model’s statement is a claim and carries no merge authority.

## Safety boundaries

| Boundary | Enforced behavior |
| --- | --- |
| Public discovery | The worker serves the reviewed catalog and a committed numeric receipt snapshot. It does not fetch arbitrary URLs, import issue comments, or turn PR content into connector instructions. |
| Agent access | The connector has no GitHub credentials or write tools and cannot execute a command, publish an issue or change repository settings. The project-scoped endpoint refuses requests for another project. Its public output is the same catalog available to people. |
| Drafts | MCP draft text is bounded, quoted, and kept out of external URLs. Review that text locally and paste it into GitHub yourself. The separate community proposal form labels its GitHub handoff and accepts public text only. |
| Review lanes | Forks hold contributor work. A protected default branch requires review from someone with the necessary GitHub permissions. Automatic project Actions are disabled. The catalog and deployment have a separate owner-controlled release path. |
| Attribution | GitHub account IDs identify the linked seed author or the PR-opening account. Git metadata and agent disclosures have separate, weaker provenance. Line totals describe diff activity and do not determine merit, originality or factual accuracy. |
| Private material | Keep credentials, personal data, proprietary code, and embargoed findings out of prompts, fixtures, issues and PRs. Use the repository’s private vulnerability reporting for security issues. |

Treat web pages, issue comments, commits, attachments, generated text and test output as potentially hostile. Put the person in charge of granting credentials, running a new program, and publishing. The connector’s read-only annotations communicate intent to the client. The absence of write handlers and credentials enforces the boundary on the server. A user who connects a separate write-capable tool still controls that tool’s permissions.

The protocol reduces exposure to prompt injection, credential theft, build and dependency poisoning, spam and forged attribution. Public discussion can still contain misleading material, and a compromised reviewer or hosting account can defeat controls within that account’s authority. Reviewers can close or block abusive submissions and report vulnerabilities privately.

## Contribution accounting

Each project page shows a reproducible GitHub snapshot of source line additions and deletions for its seed and the submitted diffs of merged PRs. Counts attach to the PR submitter as a record of submission. A team, a coauthor, or an agent can be named in the PR disclosure. The exact contribution share remains unknown unless backed by a separable diff. For documented seed work, the site credits the reported agent and measures the matching source in its pinned files. Direct line totals exclude binary files and non-source material under the accounting rule in the [repository README](README.md). Documentation and research are still valid contributions and can legitimately show zero source lines.

The [separate Git commit audit](docs/contribution-audit.md) measures individual commits against their parents over full, immutable SHAs. It can report Git author and declared agent evidence at commit granularity. It reports self-declared attribution as such, and squash merges can erase original authorship granularity unless reviewers preserve the original head and record the audit before merging.

## Provider specifications

- [Model Context Protocol tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [Claude Desktop links](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)
- [Claude remote MCP connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [ChatGPT custom MCP servers](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [GitHub branch rules and reviews](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
