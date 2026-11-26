import { execFile, spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const owner = 'jpgordon00';
const hub = 'https://github.com/jpgordon00/works-by-us';
const site = 'https://works-by-us.jacob-gordon255689.chatgpt.site';
const main = 'refs/heads/main';
const policyName = 'Crowdsourced Intelligence review';
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const commitId = /^[a-f0-9]{40}$/;
const model = 'works-by-us.problem.v1';
const allowedStarters = new Map([
  ['contributions/collatz-descent/README.md', [
    'contributions/collatz-descent/README.md',
    'contributions/collatz-descent/check.mjs'
  ]],
  ['contributions/dark-matter-rotation/README.md', [
    'contributions/dark-matter-rotation/README.md',
    'contributions/dark-matter-rotation/check.py'
  ]],
  ['contributions/sat-occurrence/README.md', [
    'contributions/sat-occurrence/README.md',
    'contributions/sat-occurrence/check.mjs'
  ]],
  ['contributions/audacity-spectrum/README.md', [
    'contributions/audacity-spectrum/README.md',
    'contributions/audacity-spectrum/spectrum_fixture.py'
  ]],
  ['contributions/3sat-clique/README.md', [
    'contributions/3sat-clique/README.md',
    'contributions/3sat-clique/check.mjs'
  ]],
  ['contributions/mujoco-edge-contact/README.md', [
    'contributions/mujoco-edge-contact/README.md',
    'contributions/mujoco-edge-contact/measure.py',
    'contributions/mujoco-edge-contact/scene.xml',
    'contributions/mujoco-edge-contact/observations-macos-arm64.json'
  ]],
  ['contributions/parity-dnf/README.md', [
    'contributions/parity-dnf/README.md',
    'contributions/parity-dnf/check.mjs'
  ]],
  ['contributions/pc-portability/README.md', [
    'contributions/pc-portability/README.md',
    'contributions/pc-portability/analyze_frame_times.py',
    'contributions/pc-portability/sample.synthetic.csv'
  ]],
  ['contributions/sat-competition/README.md', [
    'contributions/sat-competition/README.md',
    'contributions/sat-competition/compare.py',
    'contributions/sat-competition/instances.csv',
    'contributions/sat-competition/results.csv'
  ]],
  ['contributions/usgs-daily-api/README.md', [
    'contributions/usgs-daily-api/README.md',
    'contributions/usgs-daily-api/check.py',
    'contributions/usgs-daily-api/result.json'
  ]],
  ['contributions/zarr-chunk-layout/README.md', [
    'contributions/zarr-chunk-layout/README.md',
    'contributions/zarr-chunk-layout/benchmark.py',
    'contributions/zarr-chunk-layout/observations-macos-arm64.json'
  ]]
]);
const protectedFiles = {
  '.github/CODEOWNERS': '* @' + owner + '\n',
  '.github/PULL_REQUEST_TEMPLATE.md': [
    '## Problem and scope',
    '',
    'Link this problem and explain the specific question this PR addresses.',
    '',
    '## Evidence',
    '',
    'List public sources, exact reproduction steps, expected results, and limitations. Include focused tests or checkable fixtures.',
    '',
    '## Contribution disclosure',
    '',
    'List the submitting GitHub account and describe each person’s or agent’s work. Give changed files or reviewed commit references. Give added and deleted code lines only when supported by a separable diff. Label shared or uncertain authorship.',
    '',
    '## Review',
    '',
    '- [ ] I reviewed the complete diff and publication contents.',
    '- [ ] I checked that samples and outputs contain public, redistributable material.',
    '- [ ] I recorded the versions, inputs and steps needed to check the result.'
  ].join('\n') + '\n'
};

export const requiredRules = {
  name: policyName,
  target: 'branch',
  enforcement: 'active',
  bypass_actors: [],
  conditions: { ref_name: { include: [main], exclude: [] } },
  rules: [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    { type: 'pull_request', parameters: {
      allowed_merge_methods: ['squash'],
      dismiss_stale_reviews_on_push: true,
      require_code_owner_review: true,
      require_last_push_approval: true,
      required_approving_review_count: 1,
      required_review_thread_resolution: true
    } }
  ]
};

const repositorySettings = {
  has_issues: true,
  has_wiki: false,
  has_discussions: false,
  allow_auto_merge: false,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  allow_squash_merge: true
};

function safeText(value, field, limit = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)) {
    throw new Error('Invalid project field ' + field);
  }
  return value;
}

function sourceURL(value) {
  const href = safeText(value, 'source URL', 2048);
  const url = new URL(href);
  if (url.protocol !== 'https:' || url.username || url.password || /[<>\s]/u.test(href)) {
    throw new Error('Invalid project source URL');
  }
  return url.href;
}

function markdown(value) {
  return value.replace(/[\\`*_{}\[\]<>#+!|>]/gu, '\\$&');
}

function matchedFields(actual, expected) {
  return Object.entries(expected).every(([field, value]) => actual[field] === value);
}

export function planProjects(catalog, revision) {
  if (!commitId.test(revision) || !Array.isArray(catalog?.problems) || !catalog.problems.length) {
    throw new Error('Expected a catalog from a full Git commit ID');
  }
  const ids = new Set();
  return catalog.problems.map(problem => {
    const id = problem?.id;
    if (typeof id !== 'string' || id.length > 90 || !slug.test(id) || ids.has(id)) {
      throw new Error('Invalid or duplicate project ID ' + String(id));
    }
    ids.add(id);
    const name = 'ci-' + id;
    const repository = 'https://github.com/' + owner + '/' + name;
    const endpoint = site + '/api/mcp/projects/' + id;
    const url = site + '/problems/' + id + '/';
    const description = 'Crowdsourced Intelligence problem [' + id + ']';
    const path = problem.starter?.path;
    if (problem.starter !== undefined && !allowedStarters.has(path)) {
      throw new Error('Starter path for ' + id + ' requires explicit allowlisting');
    }
    const fields = ['title', 'summary', 'context', 'task', 'review', 'kind'];
    const brief = Object.fromEntries(fields.map(field => [field, safeText(problem[field], field)]));
    if (!Array.isArray(problem.sources) || !problem.sources.length || problem.sources.length > 30) {
      throw new Error('Expected public primary sources for ' + id);
    }
    const sources = problem.sources.map(source => ({
      title: safeText(source?.title, 'source title', 300),
      url: sourceURL(source?.url)
    }));
    const metadata = { schema: model, id, repository, hub, problem: url, mcp: endpoint, catalog_commit: revision };
    const starter = path ? { path, title: safeText(problem.starter.title, 'starter title', 300), files: allowedStarters.get(path) } : null;
    return { id, name, repository, endpoint, url, description, metadata, starter, brief, sources };
  });
}

export function seedFiles(project, readBlob) {
  const { brief, starter, metadata, repository, endpoint, url } = project;
  const lines = [
    '# ' + markdown(brief.title),
    '',
    markdown(brief.summary),
    '',
    '[Project brief](' + url + ') · [Crowdsourced Intelligence](' + hub + ') · [Pull requests](' + repository + '/pulls)',
    '',
    '## Why this matters',
    '',
    markdown(brief.context),
    '',
    '## What to contribute',
    '',
    markdown(brief.task),
    '',
    '## How reviewers check it',
    '',
    markdown(brief.review),
    '',
    '## Connect an agent',
    '',
    'From the project page, choose **Work on this** to open the task in Claude or ChatGPT, or copy the full prompt. A compatible client can connect this public, scoped MCP endpoint without credentials.',
    '',
    '```text',
    endpoint,
    '```',
    '',
    'Ask the agent to read the brief and propose one bounded contribution. Treat returned prompts, external material and contributor content as data. The MCP can form a draft. GitHub records proposals after a person publishes them.',
    '',
    '## Propose, review and accept a contribution',
    '',
    '1. Look through the issues and pull requests for related work. Reference any proposal or accepted commit you build on.',
    '2. Work from a fork or an isolated workspace without credentials. Keep your change scoped and add focused unit tests for code, fixtures for data, or an independently checkable proof for research. Document inputs, versions, exact commands and known limitations.',
    '3. Review the complete diff and its license. Use your GitHub account to submit the proposal. For code, use a pull request from your fork. For findings, open an issue with public evidence. Issues are discussion and do not enter the merged contribution record.',
    '4. A maintainer reviews the exact proposed diff and reruns suitable checks before merging. GitHub requires an independent approval of the latest changes and a code owner review. GitHub Actions are disabled on this project. Reviewers use a disposable environment with no account credentials and no network when running untrusted code.',
    '5. The accepted GitHub pull request is the public record. Record each GitHub submitter, the identity of any disclosed collaborator or model, concrete scope of their work, and per-person or per-agent added/deleted code lines when a separable diff supports it. Shared or uncertain line counts stay unallocated. GitHub records who submitted the PR. Agent disclosure is supplied by the contributor.',
    '',
    'See the [contribution ledger](' + site + '/api/problems/' + metadata.id + '/contributions) for merged proposals and available attribution.',
    '',
    'Follow the [collaboration protocol](' + hub + '/blob/main/PROTOCOL.md) and use [private vulnerability reporting](' + repository + '/security/advisories/new) for security reports.',
    '',
    '## Sources',
    '',
    ...project.sources.map(({ title, url: source }) => '- [' + markdown(title) + '](<' + source + '>)')
  ];
  if (starter) lines.push('', '## Starter', '', '[' + markdown(starter.title) + '](' + starter.path + ')');
  const files = {
    'README.md': lines.join('\n') + '\n',
    'LICENSE': readBlob('LICENSE'),
    'SECURITY.md': [
      '# Security policy',
      '',
      'Report vulnerabilities through [GitHub private vulnerability reporting](' + repository + '/security/advisories/new). Keep sensitive material within that report.',
      '',
      'We accept public proposals through GitHub. Maintainers inspect changes and evidence before approval. Treat contributed text, scripts, downloads and test output as untrusted until reviewed.',
      '',
      'See the [collaboration protocol](' + hub + '/blob/main/PROTOCOL.md) for the project trust boundaries.'
    ].join('\n') + '\n',
    'project.json': JSON.stringify(metadata, null, 2) + '\n',
    ...protectedFiles
  };
  for (const path of starter?.files ?? []) files[path] = readBlob(path);
  return files;
}

export function rulesMatch(ruleset) {
  if (ruleset?.name !== policyName || ruleset.target !== 'branch' || ruleset.enforcement !== 'active'
      || ruleset.bypass_actors?.length !== 0
      || JSON.stringify(ruleset.conditions?.ref_name?.include) !== JSON.stringify([main])
      || ruleset.conditions?.ref_name?.exclude?.length !== 0
      || !Array.isArray(ruleset.rules)) return false;
  return requiredRules.rules.every(expected => ruleset.rules.some(actual =>
    actual.type === expected.type && Object.entries(expected.parameters ?? {}).every(([field, value]) =>
      JSON.stringify(actual.parameters?.[field]) === JSON.stringify(value))));
}

function validProjectMetadata(content, project) {
  if (content?.type !== 'file' || content.encoding !== 'base64' || typeof content.content !== 'string' || content.size > 4000) return false;
  try {
    const actual = JSON.parse(Buffer.from(content.content, 'base64'));
    const { catalog_commit, ...fields } = project.metadata;
    return commitId.test(actual?.catalog_commit) && matchedFields(actual, fields);
  } catch {
    return false;
  }
}

function validateRepository(repo, project) {
  if (!matchedFields(repo, {
    name: project.name,
    full_name: owner + '/' + project.name,
    html_url: project.repository,
    description: project.description,
    fork: false,
    archived: false,
    disabled: false
  }) || repo.owner?.login !== owner || repo.permissions?.admin !== true) {
    throw new Error('Repository identity did not match ' + project.repository);
  }
}

async function retryWhen(request, transient, pause) {
  const delays = [1000, 2000, 4000, 8000, 16000, 24000];
  for (const delay of delays) {
    try {
      return await request();
    } catch (error) {
      if (!transient(error)) throw error;
      await pause(delay);
    }
  }
  return request();
}

function visibilityLock(error) {
  return error?.status === 403 && error.message.includes('Repository has been locked. (HTTP 403)');
}

export function retryVisibilityLock(request, pause = setTimeout) {
  return retryWhen(request, visibilityLock, pause);
}

export function retryRepositoryRead(request, pause = setTimeout) {
  return retryWhen(request, error => visibilityLock(error) || error?.status === 404
    || (error?.status === 409 && error.message.includes('Git Repository is empty. (HTTP 409)')), pause);
}

function apiStatus(error, status) {
  return error?.status === status;
}

async function getOptional(api, route, statuses = [404]) {
  try {
    return await api('GET', route);
  } catch (error) {
    if (statuses.some(status => apiStatus(error, status))) return null;
    throw error;
  }
}

async function verifySeed(api, path, project, ref) {
  const current = await getOptional(api, path + '/contents/project.json?ref=main');
  if (!validProjectMetadata(current, project)) {
    throw new Error('Missing or mismatched project.json in ' + project.repository);
  }
  const history = await api('GET', path + '/commits?sha=main&path=project.json&per_page=2');
  if (history?.length !== 1 || !commitId.test(history[0].sha) || history[0].parents?.length !== 0 || !commitId.test(ref?.object?.sha)) {
    throw new Error('Unable to establish a unique bootstrap commit for ' + project.repository);
  }
  const codeowners = await api('GET', path + '/contents/.github/CODEOWNERS?ref=main');
  if (codeowners?.type !== 'file' || codeowners.encoding !== 'base64'
      || Buffer.from(codeowners.content, 'base64').toString() !== protectedFiles['.github/CODEOWNERS']) {
    throw new Error('Unexpected CODEOWNERS in ' + project.repository);
  }
  return history[0].sha;
}

export async function provisionProject(project, files, api, pushSeed) {
  const path = 'repos/' + owner + '/' + project.name;
  const refPath = path + '/git/ref/heads/main';
  let repo = await getOptional(api, path);
  if (!repo) {
    await api('POST', 'user/repos', {
      name: project.name, description: project.description, homepage: project.url,
      private: true, auto_init: false, has_issues: true, has_discussions: false, has_wiki: false
    });
    repo = await retryRepositoryRead(() => api('GET', path));
  }
  validateRepository(repo, project);

  let ref = await getOptional(api, refPath, [404, 409]);
  if (!ref) {
    const branches = await getOptional(api, path + '/branches?per_page=1', [409]);
    if (!repo.private || branches?.length > 0) {
      throw new Error('Refusing to seed an existing repository with an unexpected branch state ' + project.repository);
    }
  }
  let seed = ref ? await verifySeed(api, path, project, ref) : null;

  const actions = await api('GET', path + '/actions/permissions');
  if (actions.enabled !== false) await api('PUT', path + '/actions/permissions', { enabled: false });
  if ((await api('GET', path + '/actions/permissions')).enabled !== false) {
    throw new Error('Actions are not disabled for ' + project.repository);
  }

  if (!seed) {
    const pushed = await pushSeed(project, files);
    const readSeed = (method, route) => retryRepositoryRead(() => api(method, route));
    ref = await readSeed('GET', refPath);
    seed = await verifySeed(readSeed, path, project, ref);
    if (seed !== pushed || ref.object.sha !== seed) throw new Error('Seed push did not match GitHub main');
  }

  const settings = { ...repositorySettings, homepage: project.url, default_branch: 'main', private: false, visibility: 'public' };
  if (!matchedFields(repo, settings)) await api('PATCH', path, settings);
  const publishedApi = (method, route, body) => {
    const request = () => api(method, route, body);
    return method === 'GET' ? retryRepositoryRead(request) : retryVisibilityLock(request);
  };
  const rulesetPath = path + '/rulesets';
  const named = (await publishedApi('GET', rulesetPath + '?per_page=100')).filter(rule => rule.name === policyName && rule.source_type === 'Repository' && rule.source === owner + '/' + project.name);
  if (named.length > 1) throw new Error('Multiple matching rulesets for ' + project.repository);
  let existingRuleset = named.length ? await publishedApi('GET', rulesetPath + '/' + named[0].id) : null;
  if (!rulesMatch(existingRuleset)) {
    existingRuleset = named.length
      ? await publishedApi('PUT', rulesetPath + '/' + named[0].id, requiredRules)
      : await publishedApi('POST', rulesetPath, requiredRules);
  }

  const vulnerabilityPath = path + '/private-vulnerability-reporting';
  if (!(await publishedApi('GET', vulnerabilityPath)).enabled) await publishedApi('PUT', vulnerabilityPath);
  repo = await publishedApi('GET', path);
  validateRepository(repo, project);
  const ruleset = await publishedApi('GET', rulesetPath + '/' + existingRuleset.id);
  const effectiveRules = await publishedApi('GET', path + '/rules/branches/main');
  if (!matchedFields(repo, settings) || !(await publishedApi('GET', vulnerabilityPath)).enabled
      || !rulesMatch(ruleset) || !requiredRules.rules.every(expected =>
        effectiveRules.some(effective => effective.ruleset_id === ruleset.id && effective.type === expected.type))) {
    throw new Error('Published safety settings failed verification for ' + project.repository);
  }
  return { repository: project.repository, seed };
}

const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
Object.assign(gitEnv, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0',
  GIT_NO_REPLACE_OBJECTS: '1'
});

function command(executable, args, { cwd, env = process.env, buffer = false } = {}) {
  const result = spawnSync(executable, args, {
    cwd, env, encoding: buffer ? 'buffer' : 'utf8', timeout: 45000,
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = String(result.stderr ?? '');
    const error = new Error(executable + ' exited with status ' + result.status + ': ' + details.trim().slice(0, 1000));
    error.status = Number(/\(HTTP (\d{3})\)/u.exec(details)?.[1]);
    throw error;
  }
  return result.stdout;
}

export function snapshotReader(root, revision) {
  const git = (args, options = {}) => command('git', args, { cwd: root, env: gitEnv, ...options });
  const commit = git(['rev-parse', '--verify', '--end-of-options', revision + '^{commit}']).trim();
  if (!commitId.test(commit)) throw new Error('Expected a SHA-1 Git commit');
  const read = path => {
    const record = git(['ls-tree', '-z', commit, '--', path]);
    const match = /^100644 blob ([a-f0-9]{40})\t([^\u0000]+)\u0000$/u.exec(record);
    if (match?.[2] !== path) throw new Error('Expected a non-executable regular file in Git: ' + path);
    return git(['cat-file', 'blob', match[1]], { buffer: true });
  };
  return { commit, read };
}

function remoteCommand(executable, args, { cwd, input, env }) {
  return new Promise((resolveCommand, rejectCommand) => {
    let inputError;
    const child = execFile(executable, args, {
      cwd, env, encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024
    }, (failure, stdout, stderr) => {
      if (!failure) {
        if (inputError) rejectCommand(inputError);
        else resolveCommand(stdout);
        return;
      }
      const error = new Error(executable + ' exited with status ' + (failure.code ?? failure.signal ?? 'unknown')
        + ': ' + (stderr || failure.message).trim().slice(0, 1000));
      error.status = Number(/\(HTTP (\d{3})\)/u.exec(stderr)?.[1]);
      rejectCommand(error);
    });
    child.stdin.on('error', error => { inputError = error; });
    child.stdin.end(input);
  });
}

export function mutationQueue({ interval = 1100, now = Date.now, pause = setTimeout } = {}) {
  let previous = Promise.resolve();
  let started = -Infinity;
  return operation => {
    const result = previous.then(async () => {
      const delay = interval - (now() - started);
      if (delay > 0) await pause(delay);
      started = now();
      return operation();
    });
    previous = result.catch(() => {});
    return result;
  };
}

function githubClient(env, mutate) {
  return async (method, route, body) => {
    try {
      const args = ['api', '--hostname', 'github.com', '--method', method, '--header', 'Accept: application/vnd.github+json',
        '--header', 'X-GitHub-Api-Version: 2026-03-10', route];
      if (body !== undefined) args.push('--input', '-');
      const request = () => remoteCommand('gh', args, { env, input: body === undefined ? undefined : JSON.stringify(body) });
      const response = (await (method === 'GET' ? request() : mutate(request))).trim();
      return response ? JSON.parse(response) : null;
    } catch (error) {
      error.message = method + ' ' + route + ' failed. ' + error.message;
      throw error;
    }
  };
}

async function pushInitialSeed(project, files, accountId, mutate) {
  const cwd = await mkdtemp(join(tmpdir(), 'works-by-us-seed-'));
  const git = args => command('git', args, { cwd, env: gitEnv });
  try {
    git(['init', '--quiet', '--initial-branch=main', '--template=']);
    for (const [path, contents] of Object.entries(files)) {
      const destination = join(cwd, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, contents, { flag: 'wx', mode: 0o644 });
    }
    git(['add', '--all']);
    git(['-c', 'user.name=Works by Us', '-c', 'user.email=' + accountId + '+' + owner + '@users.noreply.github.com',
      '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Initialize Crowdsourced Intelligence project']);
    const seed = git(['rev-parse', 'HEAD']).trim();
    await mutate(() => remoteCommand('git', [
      '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential',
      'push', '--quiet', project.repository + '.git', main + ':' + main
    ], { cwd, env: gitEnv }));
    return seed;
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

export async function provisionAll(projects, seedSets, provision, concurrency = 4) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || seedSets.length !== projects.length
      || new Set(projects.map(project => project.name)).size !== projects.length) {
    throw new Error('Invalid repository provisioning batch');
  }
  let next = 0;
  const results = [];
  const failures = [];
  async function worker() {
    while (next < projects.length && !failures.length) {
      const index = next++;
      const project = projects[index];
      try {
        results[index] = [project.id, await provision(project, seedSets[index])];
      } catch (error) {
        failures.push(project.repository + ': ' + error.message);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, projects.length) }, worker));
  if (failures.length) {
    throw new Error('Repository provisioning failed. Registry was not written.\n' + failures.join('\n'));
  }
  return Object.fromEntries(results);
}

async function writeRegistry(root, registry) {
  const src = join(root, 'src');
  if (!(await lstat(src)).isDirectory()) throw new Error('Expected a real src directory');
  const destination = join(src, 'project-repositories.json');
  const scratch = await mkdtemp(join(src, '.repository-registry-'));
  try {
    const draft = join(scratch, 'registry.json');
    await writeFile(draft, JSON.stringify(registry, null, 2) + '\n', { flag: 'wx' });
    await rename(draft, destination);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function cli(args) {
  let apply = false;
  let pending = false;
  let revision = 'HEAD';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') apply = true;
    else if (args[i] === '--pending') pending = true;
    else if (args[i] === '--revision' && args[i + 1]) revision = args[++i];
    else throw new Error('Usage: node scripts/provision-project-repositories.mjs [--revision COMMIT] [--pending] [--apply]');
  }
  const root = resolve('.');
  const snapshot = snapshotReader(root, revision);
  const catalog = JSON.parse(snapshot.read(pending ? 'src/pending-problems.json' : 'src/catalog.json').toString());
  const current = pending ? JSON.parse(snapshot.read('src/project-repositories.json').toString()) : {};
  const projects = planProjects(catalog, snapshot.commit);
  if (projects.some(project => Object.hasOwn(current, project.id))) {
    throw new Error('Pending projects must have new catalog IDs');
  }
  const seeds = projects.map(project => seedFiles(project, snapshot.read));
  if (!apply) {
    console.log(JSON.stringify({ revision: snapshot.commit, apply: false, repositories: projects.map(project => project.repository) }, null, 2));
    return;
  }

  const apiEnv = { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' };
  delete apiEnv.GH_DEBUG;
  const mutate = mutationQueue();
  const api = githubClient(apiEnv, mutate);
  const account = await api('GET', 'user');
  if (account.login !== owner || !Number.isSafeInteger(account.id)) throw new Error('Authenticate GitHub CLI as ' + owner);
  const upstream = await api('GET', 'repos/' + owner + '/works-by-us/git/ref/heads/main');
  if (upstream.object?.sha !== snapshot.commit) throw new Error('Provision from the exact published hub main commit');
  const registry = await provisionAll(projects, seeds, async (project, files) => {
    const result = await provisionProject(project, files, api, (item, seed) => pushInitialSeed(item, seed, account.id, mutate));
    console.log('Verified ' + project.repository + ' at ' + result.seed);
    return result;
  });
  await writeRegistry(root, { ...current, ...registry });
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  cli(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
