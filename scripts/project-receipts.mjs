import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const owner = 'jpgordon00';
const branch = 'main';
const hubRepository = owner + '/works-by-us';
const fileLimit = 3000;
const perPage = 100;
const shaPattern = /^[a-f0-9]{40}$/;
const disclosedPath = /^contributions\/[a-z0-9]+(?:[-_][a-z0-9]+)*\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const idPattern = /^(?=.{1,96}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sourceExtensions = new Set((
  'asm bash c cc cjs clj cljs cmake cpp cs css dart el erl ex exs fs fsx go h hh hpp hs htm html ' +
  'java jl js jsx kt kts less lua m mjs ml mli mm nim php pl pm ps1 py r rb rs sass scala scss sh ' +
  'sql svelte swift ts tsx vue zig zsh'
).split(' '));
const excludedDirectories = new Set((
  'build coverage data dist fixture fixtures generated node_modules out snapshot snapshots target third_party third-party vendor vendored'
).split(' '));
const accountTypes = new Set(['User', 'Bot', 'Organization', 'Mannequin']);

const accountFields = '{id, login, type}';
const fileFields = '{filename, previous_filename, additions, deletions}';
const projections = {
  project: '{full_name, private, default_branch}',
  seed: '{sha, author: (.author | if . == null then null else ' + accountFields +
    ' end), stats: (.stats | {additions, deletions}), files: [.files[] | ' + fileFields + ' + {sha, status}]}',
  hubFile: '{path, type, sha, html_url}',
  pullList: '[.[] | {number, merged_at}]',
  pull: '{number, merged, merged_at, merge_commit_sha, user: (.user | if . == null then null else ' +
    accountFields + ' end), base: (.base | {ref, repository: .repo.full_name}), head: .head.sha, changed_files, additions, deletions}',
  files: '[.[] | ' + fileFields + ']'
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validSha(value) {
  return typeof value === 'string' && shaPattern.test(value);
}

function requireFact(valid, message) {
  if (!valid) throw new Error(message);
}

function publicAccount(account) {
  if (account === null) return null;
  requireFact(isRecord(account) && count(account.id) && account.id > 0
    && typeof account.login === 'string' && /^[a-z0-9][a-z0-9-]{0,99}(?:\[bot\])?$/i.test(account.login)
    && accountTypes.has(account.type), 'GitHub account attribution is incomplete');
  return { id: account.id, login: account.login, type: account.type };
}

function pathParts(filename) {
  requireFact(typeof filename === 'string' && filename.length <= 4096
    && !/[\u0000-\u001f\u007f\\]/u.test(filename), 'GitHub returned an invalid file path');
  const parts = filename.split('/');
  requireFact(parts.every(part => part && part !== '.' && part !== '..'), 'GitHub returned an invalid file path');
  return parts;
}

// These are GitHub text diff lines on recognized source paths, including comments and blanks.
// Evaluate additions against the new path, and deletions against the previous path on renames.
function isSourceFile(filename) {
  const parts = pathParts(filename).map(part => part.toLowerCase());
  const basename = parts.pop();
  const extension = basename.slice(basename.lastIndexOf('.') + 1);
  return basename.includes('.') && sourceExtensions.has(extension)
    && !basename.startsWith('.') && !/\.(?:bundle|generated|lock|min)\./.test(basename)
    && !parts.some(part => part.startsWith('.') || excludedDirectories.has(part));
}

function fileCounts(files, expected, expectedFileCount) {
  requireFact(Array.isArray(files) && files.length < fileLimit
    && (expectedFileCount === undefined || files.length === expectedFileCount),
  'GitHub file listing is incomplete or reached the 3,000-file limit');
  requireFact(count(expected?.additions) && count(expected?.deletions), 'GitHub diff totals are incomplete');

  const seen = new Set();
  let allAdded = 0;
  let allRemoved = 0;
  let additions = 0;
  let deletions = 0;
  for (const file of files) {
    requireFact(isRecord(file) && count(file.additions) && count(file.deletions), 'GitHub file counts are invalid');
    const source = isSourceFile(file.filename);
    const previousSource = file.previous_filename == null ? source : isSourceFile(file.previous_filename);
    requireFact(!seen.has(file.filename), 'GitHub file listing contains a duplicate path');
    seen.add(file.filename);
    allAdded += file.additions;
    allRemoved += file.deletions;
    if (source) additions += file.additions;
    if (previousSource) deletions += file.deletions;
  }
  requireFact(allAdded === expected.additions && allRemoved === expected.deletions,
    'GitHub file counts do not reconcile with the aggregate diff');
  return { additions, deletions };
}

function pullNumbers(pages) {
  requireFact(Array.isArray(pages) && pages.length > 0 && pages.every(Array.isArray), 'GitHub PR listing is incomplete');
  const numbers = new Set();
  const merged = [];
  for (const row of pages.flat()) {
    requireFact(isRecord(row) && count(row.number) && row.number > 0 && !numbers.has(row.number)
      && (row.merged_at === null || typeof row.merged_at === 'string' && row.merged_at.length > 0),
    'GitHub PR listing contains a duplicate or invalid record');
    numbers.add(row.number);
    if (row.merged_at) merged.push([row.number, row.merged_at]);
  }
  return merged.sort((left, right) => left[0] - right[0]);
}

function verifiedPull(pull, number, mergedAt, repository) {
  requireFact(pull?.number === number && pull.merged === true && pull.merged_at === mergedAt
    && pull.base?.ref === branch && pull.base.repository === repository
    && validSha(pull.merge_commit_sha) && validSha(pull.head) && count(pull.changed_files)
    && count(pull.additions) && count(pull.deletions),
  'GitHub PR did not match its merged state, repository, base branch or immutable revisions');
  return {
    number,
    merge_commit: pull.merge_commit_sha,
    head: pull.head,
    github_account: publicAccount(pull.user),
    changed_files: pull.changed_files,
    additions: pull.additions,
    deletions: pull.deletions
  };
}

function validManifest(manifest) {
  requireFact(isRecord(manifest) && Object.keys(manifest).length > 0, 'Expected a nonempty project repository registry');
  return Object.entries(manifest).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([id, project]) => {
      const fullName = owner + '/ci-' + id;
      requireFact(idPattern.test(id) && isRecord(project)
        && project.repository === 'https://github.com/' + fullName && validSha(project.seed),
      'Project repository registry contains an invalid entry');
      return [id, fullName, project.seed];
    });
}

function validDisclosures(disclosures, projects) {
  requireFact(isRecord(disclosures), 'Expected seed disclosures keyed by project ID');
  const projectIds = new Set(projects.map(([id]) => id));
  for (const [id, rows] of Object.entries(disclosures)) {
    requireFact(projectIds.has(id) && Array.isArray(rows) && rows.length > 0 && rows.length <= 25,
      'Seed disclosures contain an unknown project or invalid row list');
    const seen = new Set();
    for (const row of rows) {
      const scoped = isRecord(row) && Object.hasOwn(row, 'scope');
      requireFact(isRecord(row) && Object.keys(row).length === (scoped ? 5 : 4)
        && (!scoped || row.scope === 'hub')
        && typeof row.agent === 'string' && /^[a-z0-9][a-z0-9 _().+-]{0,95}$/i.test(row.agent) && row.agent === row.agent.trim()
        && typeof row.work === 'string' && row.work.length > 0 && row.work.length <= 500 && row.work === row.work.trim()
        && !/[\p{Cc}\p{Cf}]/u.test(row.work) && validSha(row.source_commit)
        && Array.isArray(row.paths) && row.paths.length > 0 && row.paths.length <= 50,
      'Seed disclosure has an invalid agent, work description, commit or path list');
      for (const path of row.paths) {
        requireFact(typeof path === 'string' && path.length <= 240 && disclosedPath.test(path),
          'Seed disclosure path is outside the supported contributions folder');
        requireFact(!seen.has(path), 'Seed disclosures contain a duplicate path for one project');
        seen.add(path);
      }
    }
  }
}

async function verifiedCommit(get, repository, commit) {
  const pages = await get('repos/' + repository + '/commits/' + commit + '?per_page=' + perPage, 'seed', true);
  requireFact(Array.isArray(pages) && pages.length > 0, 'GitHub pinned commit pages are missing');
  const account = publicAccount(pages[0]?.author);
  const stats = pages[0]?.stats;
  const files = [];
  for (const page of pages) {
    requireFact(page?.sha === commit && Array.isArray(page.files)
      && page.stats?.additions === stats?.additions && page.stats?.deletions === stats?.deletions
      && JSON.stringify(publicAccount(page.author)) === JSON.stringify(account), 'GitHub pinned commit pages disagree');
    files.push(...page.files);
  }
  return { account, counts: fileCounts(files, stats), files };
}

async function verifiedDisclosures(rows, seedFiles, get) {
  const seedByPath = new Map(seedFiles.map(file => [file.filename, file]));
  const hubCommits = new Map();
  const seed = [];
  const hub = [];
  for (const { agent, work, source_commit, paths, scope } of rows) {
    let byPath = seedByPath;
    if (scope === 'hub') {
      if (!hubCommits.has(source_commit)) {
        const source = await verifiedCommit(get, hubRepository, source_commit);
        hubCommits.set(source_commit, new Map(source.files.map(file => [file.filename, file])));
      }
      byPath = hubCommits.get(source_commit);
    }
    let additions = 0;
    for (const path of paths) {
      const file = byPath.get(path);
      requireFact(file?.status === 'added' && validSha(file.sha) && file.deletions === 0 && file.previous_filename == null,
        'Disclosed file is not a verified addition in the pinned ' + (scope === 'hub' ? 'hub commit' : 'project seed'));
      const hubFile = await get('repos/' + hubRepository + '/contents/' + path + '?ref=' + source_commit, 'hubFile');
      requireFact(hubFile?.type === 'file' && hubFile.path === path && hubFile.sha === file.sha
        && hubFile.html_url === 'https://github.com/' + hubRepository + '/blob/' + source_commit + '/' + path,
      'Disclosed file does not match the pinned hub file');
      if (isSourceFile(path)) additions += file.additions;
    }
    const receipts = scope === 'hub' ? hub : seed;
    receipts.push({ agent, work, source_commit, paths: [...paths], additions, deletions: 0 });
  }
  return {
    ...(seed.length > 0 && { seed_disclosures: seed }),
    ...(hub.length > 0 && { hub_starter_disclosures: hub })
  };
}

async function buildProjectLedger(get, repository, seedSha, disclosureRows) {
  const endpoint = 'repos/' + repository;
  const project = await get(endpoint, 'project');
  requireFact(project?.full_name === repository && project.private === false && project.default_branch === branch,
    'GitHub repository identity or default branch does not match the registry');

  const seedCommit = await verifiedCommit(get, repository, seedSha);
  const seed = { commit: seedSha, github_account: seedCommit.account, ...seedCommit.counts };
  const disclosures = disclosureRows ? await verifiedDisclosures(disclosureRows, seedCommit.files, get) : {};

  const listPath = endpoint + '/pulls?state=closed&base=' + branch + '&sort=created&direction=asc&per_page=' + perPage;
  const pullPages = await get(listPath, 'pullList', true);
  const merged = pullNumbers(pullPages);
  const receipts = [];
  const mergeCommits = new Set();
  for (const [number, mergedAt] of merged) {
    const path = endpoint + '/pulls/' + number;
    const before = verifiedPull(await get(path, 'pull'), number, mergedAt, repository);
    requireFact(before.changed_files < fileLimit, 'GitHub PR reached the 3,000-file limit');
    const filePages = await get(path + '/files?per_page=' + perPage, 'files', true);
    requireFact(Array.isArray(filePages) && filePages.length > 0 && filePages.every(Array.isArray),
      'GitHub PR file pages are missing');
    const totals = fileCounts(filePages.flat(), before, before.changed_files);
    const after = verifiedPull(await get(path, 'pull'), number, mergedAt, repository);
    requireFact(JSON.stringify(after) === JSON.stringify(before), 'GitHub PR changed while reading the diff');
    requireFact(!mergeCommits.has(after.merge_commit), 'Multiple GitHub PRs refer to the same merge commit');
    mergeCommits.add(after.merge_commit);
    receipts.push({ number, merge_commit: after.merge_commit, head: after.head, github_account: after.github_account, ...totals });
  }
  if (pullPages.length > 1) {
    requireFact(JSON.stringify(pullNumbers(await get(listPath, 'pullList', true))) === JSON.stringify(merged),
      'GitHub PR listing changed while reading paginated results');
  }
  return { seed, receipts, ...disclosures };
}

export async function buildContributionLedger(manifest, get = githubGet, disclosures = {}) {
  const projects = validManifest(manifest);
  validDisclosures(disclosures, projects);
  const ledger = [];
  for (const [id, repository, seed] of projects) {
    try {
      const rows = Object.hasOwn(disclosures, id) ? disclosures[id] : undefined;
      ledger.push([id, await buildProjectLedger(get, repository, seed, rows)]);
    } catch (error) {
      throw new Error('Could not verify contributions for ' + id + '. ' + error.message);
    }
  }
  return Object.fromEntries(ledger);
}

export function githubGet(endpoint, projection, paginate = false) {
  requireFact(Object.hasOwn(projections, projection), 'Unknown GitHub response projection');
  // Project away diffs, commit messages, email addresses and other contributor-controlled text
  // inside gh. Never check out code or consume raw output from a failed command.
  let stdout;
  try {
    stdout = execFileSync('gh', [
      'api', '--hostname', 'github.com', '--method', 'GET',
      '--header', 'Accept: application/vnd.github+json',
      '--header', 'X-GitHub-Api-Version: 2026-03-10',
      ...(paginate ? ['--paginate'] : []),
      '--jq', projections[projection], endpoint
    ], {
      encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GH_DEBUG: '', GH_FORCE_TTY: '', GH_PROMPT_DISABLED: '1', NO_COLOR: '1' }
    });
  } catch {
    throw new Error('GitHub read failed. Check gh authentication, rate limits and repository access before retrying.');
  }
  try {
    const output = stdout.trim();
    return paginate ? output.split('\n').map(page => JSON.parse(page)) : JSON.parse(output);
  } catch {
    throw new Error('Invalid GitHub response format');
  }
}

async function main(args) {
  requireFact(args.length === 0 || args.length === 1 && args[0] === '--check',
    'Usage: node scripts/project-receipts.mjs [--check]');
  const registry = new URL('../src/project-repositories.json', import.meta.url);
  const output = new URL('../src/contribution-ledger.json', import.meta.url);
  const manifest = JSON.parse(await readFile(registry, 'utf8'));
  const disclosurePath = new URL('../src/seed-disclosures.json', import.meta.url);
  const disclosureSource = await readFile(disclosurePath, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '{}';
    throw error;
  });
  const disclosures = JSON.parse(disclosureSource);
  const contents = JSON.stringify(await buildContributionLedger(manifest, githubGet, disclosures), null, 2) + '\n';
  if (args[0] === '--check') {
    requireFact(await readFile(output, 'utf8') === contents, 'The GitHub contribution snapshot needs refreshing');
    return;
  }
  const temp = new URL('../src/.contribution-ledger.' + randomUUID() + '.tmp', import.meta.url);
  try {
    await writeFile(temp, contents, { flag: 'wx' });
    await rename(temp, output);
  } finally {
    await rm(temp, { force: true });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
