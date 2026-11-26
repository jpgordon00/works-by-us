# Project contribution reports

The central project runner can publish an audit of accepted source changes for
each problem repository. Each report pins the project repository's seed and
accepted head by full Git commit ID. Keep the report and generator in the
central repository so a proposed project change cannot edit its own record.

## Regenerate a report

Use Node.js 22 or later and patched Git 2.45 or later. Create the bare mirror
yourself from the exact project repository you intend to review. Use an empty
Git template and a clean, isolated runner with a trusted Git executable.
Never point the audit at a contributor's Git directory or archive.

    mkdir -p "$AUDIT_ROOT/empty-template"
    git clone --bare --template="$AUDIT_ROOT/empty-template" \
      "https://github.com/jpgordon00/ci-example.git" "$AUDIT_ROOT/project.git"
    node scripts/contribution-audit.mjs \
      --git-dir "$AUDIT_ROOT/project.git" --base "$SEED_SHA" --head "$ACCEPTED_SHA" \
      > "$AUDIT_ROOT/contributions.json"

The caller identifies the accepted head from GitHub's protected default
branch and confirms that the catalog's recorded seed is the expected base.
Use the exact head SHA in the JSON. A report can be independently reproduced
from the same Git objects and identity snapshot. Without a base, the audit
includes root commits. An empty range yields a report with zero totals.
Choose a narrower range when there are more than 2,000 reachable commits.

The audit reads Git objects without checking out files, running source or
tests, fetching objects, calling a remote agent, or executing diff drivers
or text conversion. It uses an empty tree for tracked file attributes. A
caller-created bare mirror also keeps contributor-controlled Git config,
hooks, and local attributes outside the reporting process.

## Read the numbers

- Each non-merge commit records added and deleted lines from Git's text diff.
  Eligible text file types are listed in the report. Binary files, symlinks,
  submodules, type transitions, and files under dependency directories are
  excluded. A detected pure rename can count as one touched file and zero
  line changes. A rewrite that Git cannot match as a rename can count as a
  deletion and addition.
- The totals report **churn**. The same changed line may be counted in
  successive accepted commits. Counts measure neither current line
  ownership nor originality, quality, effort, or acceptance of a proof.
- Merge commits are listed separately. Otherwise, a merge diff could count
  branch changes twice. Edits made only during a merge are outside the
  attribution total. A squash commit has the recorded author and diff of
  that single commit. The report cannot reconstruct the original commits.
- A Git author is a self-reported commit field. The report groups exact
  author identities internally where provider evidence is absent and
  publishes display names with report-local contributor IDs. It omits
  email addresses, file paths, and commit messages.
- To claim agent assistance per commit, add a single final
  `Agent-Author: codex` trailer, changing `codex` to the agent label. Keep
  separately attributable changes in separate commits. The report credits
  that commit's churn to the declared agent under its author, retaining the
  author reference. This is a declaration from the Git author. It gives
  no independent evidence of the model or authorship. Multiple declarations
  leave the numbers assigned to the Git author. Git coauthor trailers can
  record credit in Git history, but they provide no line allocation and
  do not increase this report's counts.

## Optionally attach GitHub identity evidence

An operator can capture a trusted [GitHub commit API snapshot](https://docs.github.com/en/rest/commits/commits#get-a-commit)
for the exact audited repository and commits. Record the response's
top-level `author.login` as `authorLogin` (or null) and
`commit.verification.verified` as `signatureVerified`, keyed by commit SHA.
Pass the JSON with `--github-identities "$EVIDENCE_PATH"`. Preserve source
and collection time in the maintainer's publication record if relevant.

    {
      "0123456789012345678901234567890123456789": {
        "authorLogin": "example",
        "signatureVerified": false
      }
    }

`github-associated-author` reflects GitHub's account association, and the
recorded verification boolean reflects the GitHub signature result. Both
are separate from a verified real-world identity, PR submission, and any
agent declaration. The offline script cannot authenticate the supplied
file, so the publisher must use trusted evidence captured outside the
contributed repository.
