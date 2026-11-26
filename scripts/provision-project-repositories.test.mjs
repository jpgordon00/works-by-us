import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  mutationQueue, planProjects, provisionAll, provisionProject, requiredRules, retryRepositoryRead,
  retryVisibilityLock, rulesMatch, seedFiles, snapshotReader
} from './provision-project-repositories.mjs';

const revision = 'ab'.repeat(20);
const head = 'cd'.repeat(20);
const newHead = 'ef'.repeat(20);
const slug = 'sample-experiment';
const repoPath = 'repos/jpgordon00/ci-' + slug;
const owner = 'jpgordon00';
const policy = () => ({ id: 123, source: 'jpgordon00/ci-' + slug, source_type: 'Repository', ...structuredClone(requiredRules) });
const makeProblem = (changes = {}) => ({
  id: slug,
  title: 'Test a theorem',
  summary: 'A concrete question.',
  context: 'A finite case.',
  task: 'Compare against direct enumeration.',
  review: 'Share a precise test.',
  kind: 'Reproduction',
  sources: [{ title: 'Primary paper', url: 'https://example.org/paper' }],
  ...changes
});
const plan = (...problems) => planProjects({ problems }, revision);
const metadata = (value, options = {}) => ({
  type: 'file', encoding: 'base64', size: 200, content: Buffer.from(value).toString('base64'), ...options
});
const fail = status => { throw Object.assign(new Error('Mock GitHub returned ' + status), { status }); };

function provider(project, { existing = false, publicRepo = false } = {}) {
  const calls = [];
  const state = {
    actions: true, privateReporting: false, ruleset: null, branches: [],
    repo: existing ? {
      name: project.name,
      full_name: owner + '/' + project.name,
      html_url: project.repository,
      owner: { login: owner },
      permissions: { admin: true },
      description: project.description,
      fork: false,
      archived: false,
      disabled: false,
      private: !publicRepo,
      visibility: publicRepo ? 'public' : 'private'
    } : null,
    ref: publicRepo ? { object: { sha: head } } : null,
    content: metadata(JSON.stringify(project.metadata)),
    codeowners: metadata('* @' + owner + '\n'),
    history: [{ sha: head, parents: [] }]
  };
  async function api(method, path, body) {
    calls.push([method, path, body]);
    if (path === 'user/repos' && method === 'POST') {
      assert.equal(body.private, true);
      state.repo = provider(project, { existing: true }).state.repo;
      return state.repo;
    }
    if (path === repoPath) {
      if (!state.repo) return fail(404);
      if (method === 'PATCH') {
        assert.ok(state.ref, 'seed must exist before publishing');
        assert.equal(state.actions, false, 'actions must be off before publishing');
        Object.assign(state.repo, body);
      }
      return structuredClone(state.repo);
    }
    if (path === repoPath + '/git/ref/heads/main') {
      if (!state.ref) return fail(409);
      return state.ref;
    }
    if (path === repoPath + '/branches?per_page=1') return state.branches;
    if (path === repoPath + '/contents/project.json?ref=main') return state.content;
    if (path === repoPath + '/contents/.github/CODEOWNERS?ref=main') return state.codeowners;
    if (path === repoPath + '/commits?sha=main&path=project.json&per_page=2') return state.history;
    if (path === repoPath + '/actions/permissions') {
      if (method === 'PUT') state.actions = body.enabled;
      return { enabled: state.actions };
    }
    if (path === repoPath + '/private-vulnerability-reporting') {
      assert.equal(state.repo.private, false);
      if (method === 'PUT') state.privateReporting = true;
      return { enabled: state.privateReporting };
    }
    if (path === repoPath + '/rulesets?per_page=100') return state.ruleset ? [state.ruleset] : [];
    if (path === repoPath + '/rulesets' || path === repoPath + '/rulesets/' + policy().id) {
      if (method !== 'GET') state.ruleset = { ...policy(), ...body };
      return state.ruleset;
    }
    if (path === repoPath + '/rules/branches/main') {
      return state.ruleset?.rules.map(rule => ({ ...rule, ruleset_id: state.ruleset.id })) ?? [];
    }
    throw new Error('Unexpected mock request ' + method + ' ' + path);
  }
  async function push(seedProject, files) {
    assert.equal(seedProject, project);
    assert.equal(state.actions, false);
    assert.equal(state.repo.private, true);
    assert.equal(typeof files['README.md'], 'string');
    calls.push(['PUSH', 'main']);
    state.ref = { object: { sha: head } };
    return head;
  }
  return { state, calls, api, push };
}

const makeSeed = project => seedFiles(project, file => 'trusted ' + file);

test('uses a single owner, repository prefix, canonical agent endpoint and complete seed metadata per problem', () => {
  const projects = plan(makeProblem(), makeProblem({ id: 'other' }));
  assert.deepEqual(projects.map(item => item.repository), [
    'https://github.com/jpgordon00/ci-sample-experiment',
    'https://github.com/jpgordon00/ci-other'
  ]);
  assert.equal(projects[0].metadata.catalog_commit, revision);
  assert.equal(projects[0].metadata.id, slug);
  assert.equal(projects[0].metadata.mcp, 'https://works-by-us.jacob-gordon255689.chatgpt.site/api/mcp/projects/sample-experiment');
});

test('rejects duplicate, malformed, traversal and oversized slugs before building a repository name', () => {
  for (const id of ['', 'test/', '../test', '-test', 'a'.repeat(91), 'UPPER', 'a--b']) {
    assert.throws(() => plan(makeProblem({ id })), /Invalid or duplicate/);
  }
  assert.throws(() => plan(makeProblem(), makeProblem()), /duplicate/);
  assert.throws(() => planProjects({ problems: [makeProblem()] }, 'main'), /full Git commit/);
});

test('rejects escaping or unallowlisted starter paths', () => {
  for (const path of ['./contributions/3sat-clique/README.md', 'contributions/../../secrets', 'contributions/new/README.md', '.github/workflows/test.yml']) {
    assert.throws(() => plan(makeProblem({ starter: { path, title: 'Test' } })), /allowlisting/);
  }
});

test('rejects dangerous sources and ambiguous title controls while escaping normal formatting', () => {
  for (const url of ['http://example.org/', 'https://a:b@example.org/', 'https://example.org/<x>', 'javascript:alert(1)']) {
    assert.throws(() => plan(makeProblem({ sources: [{ title: 'Paper', url }] })), /source URL/);
  }
  assert.throws(() => plan(makeProblem({ title: 'hidden\u202eX' })), /Invalid project field/);
  const [project] = plan(makeProblem({ title: 'Compare <a> & **b**' }));
  assert.ok(makeSeed(project)['README.md'].includes('# Compare \\<a\\> & \\*\\*b\\*\\*'));
});

test('seed contains only fixed process files and the explicitly allowlisted starter folder files', () => {
  const [project] = plan(makeProblem({ starter: { path: 'contributions/3sat-clique/README.md', title: 'Proof and checker' } }));
  const reads = [];
  const files = seedFiles(project, path => {
    reads.push(path);
    return path;
  });
  assert.deepEqual(reads, ['LICENSE', 'contributions/3sat-clique/README.md', 'contributions/3sat-clique/check.mjs']);
  assert.equal(Object.keys(files).length, 8);
  assert.match(files['README.md'], /no account credentials and no network/);
  assert.match(files['README.md'], /\/api\/problems\/sample-experiment\/contributions/);
  assert.match(files['SECURITY.md'], /private vulnerability reporting/);
  assert.equal(files['.github/CODEOWNERS'], '* @jpgordon00\n');
  assert.equal(Object.keys(files).some(path => path.includes('workflows')), false);
});

test('requires effective branch rules with no bypass and independent approval each time', () => {
  assert.equal(rulesMatch(policy()), true);
  const wrong = policy();
  wrong.bypass_actors.push({ actor_id: 1 });
  assert.equal(rulesMatch(wrong), false);
  for (const field of ['dismiss_stale_reviews_on_push', 'require_code_owner_review', 'require_last_push_approval', 'required_review_thread_resolution']) {
    const weak = policy();
    weak.rules[2].parameters[field] = false;
    assert.equal(rulesMatch(weak), false, field);
  }
  const inactive = policy();
  inactive.enforcement = 'disabled';
  assert.equal(rulesMatch(inactive), false);
  const noForceProtection = policy();
  noForceProtection.rules.splice(1, 1);
  assert.equal(rulesMatch(noForceProtection), false);
});

test('new repository is seeded privately, protects main and confirms public security settings', async () => {
  const [project] = plan(makeProblem());
  const remote = provider(project);
  const result = await provisionProject(project, makeSeed(project), remote.api, remote.push);
  assert.deepEqual(result, { repository: project.repository, seed: head });
  assert.deepEqual(remote.calls.filter(([method]) => method !== 'GET').map(([method, path]) => [method, path]), [
    ['POST', 'user/repos'],
    ['PUT', repoPath + '/actions/permissions'],
    ['PUSH', 'main'],
    ['PATCH', repoPath],
    ['POST', repoPath + '/rulesets'],
    ['PUT', repoPath + '/private-vulnerability-reporting']
  ]);
  assert.equal(remote.state.repo.visibility, 'public');
  assert.equal(remote.state.repo.default_branch, 'main');
  assert.equal(remote.state.repo.has_discussions, false);
  assert.equal(remote.state.repo.has_wiki, false);
  assert.equal(remote.state.actions, false);
  assert.equal(remote.state.privateReporting, true);
  assert.equal(rulesMatch(remote.state.ruleset), true);
});

test('rerun is read-only and keeps original seed as main advances', async () => {
  const [project] = plan(makeProblem());
  const remote = provider(project);
  const files = makeSeed(project);
  await provisionProject(project, files, remote.api, remote.push);
  remote.state.ref.object.sha = newHead;
  remote.calls.length = 0;
  assert.deepEqual(await provisionProject(project, files, remote.api, remote.push), { repository: project.repository, seed: head });
  assert.ok(remote.calls.every(([method]) => method === 'GET'));
});

test('can resume its own partially created private repository without creating a duplicate', async () => {
  const [project] = plan(makeProblem());
  const remote = provider(project, { existing: true });
  assert.equal((await provisionProject(project, makeSeed(project), remote.api, remote.push)).seed, head);
  assert.equal(remote.calls.some(([method, path]) => method === 'POST' && path === 'user/repos'), false);
});

test('never mutates a foreign collision or a preexisting unseeded public repository', async () => {
  const [project] = plan(makeProblem());
  const files = makeSeed(project);
  const foreign = provider(project, { existing: true });
  foreign.state.repo.description = 'Other project';
  await assert.rejects(provisionProject(project, files, foreign.api, foreign.push), /identity/);
  assert.ok(foreign.calls.every(([method]) => method === 'GET'));
  const publicEmpty = provider(project, { existing: true, publicRepo: true });
  publicEmpty.state.ref = null;
  await assert.rejects(provisionProject(project, files, publicEmpty.api, publicEmpty.push), /unexpected branch state/);
  assert.ok(publicEmpty.calls.every(([method]) => method === 'GET'));
  const otherBranch = provider(project, { existing: true });
  otherBranch.state.branches = [{ name: 'other' }];
  await assert.rejects(provisionProject(project, files, otherBranch.api, otherBranch.push), /unexpected branch state/);
  assert.ok(otherBranch.calls.every(([method]) => method === 'GET'));
});

test('fails closed for wrong metadata, modified bootstrap identity and unverified code owners', async () => {
  const [project] = plan(makeProblem());
  const cases = [
    { changes: { content: metadata(JSON.stringify({ ...project.metadata, id: 'unrelated' })) }, error: /project.json/ },
    { changes: { history: [{ sha: newHead, parents: [head] }, { sha: head, parents: [] }] }, error: /unique bootstrap/ },
    { changes: { codeowners: metadata('* @someone-else\n') }, error: /CODEOWNERS/ }
  ];
  for (const { changes, error } of cases) {
    const remote = provider(project, { existing: true, publicRepo: true });
    Object.assign(remote.state, changes);
    await assert.rejects(provisionProject(project, makeSeed(project), remote.api, remote.push), error);
    assert.ok(remote.calls.every(([method]) => method === 'GET'));
  }
});

test('repairs owner-identified ruleset drift and rejects a GitHub response that fails effective verification', async () => {
  const [project] = plan(makeProblem());
  const remote = provider(project, { existing: true, publicRepo: true });
  remote.state.ruleset = policy();
  remote.state.ruleset.enforcement = 'disabled';
  const api = (method, path, body) => path === repoPath + '/rules/branches/main' ? [] : remote.api(method, path, body);
  await assert.rejects(provisionProject(project, makeSeed(project), api, remote.push), /failed verification/);
  assert.equal(rulesMatch(remote.state.ruleset), true);
  assert.ok(remote.calls.some(([method, path]) => method === 'PUT' && path === repoPath + '/rulesets/123'));
});

test('waits only for the temporary GitHub repository visibility lock', async () => {
  const lock = Object.assign(new Error('gh: Repository has been locked. (HTTP 403)'), { status: 403 });
  const delays = [];
  let calls = 0;
  const result = await retryVisibilityLock(() => {
    if (calls++ < 2) throw lock;
    return 'public';
  }, async delay => { delays.push(delay); });
  assert.equal(result, 'public');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);

  await assert.rejects(retryVisibilityLock(() => fail(403), assert.fail), /Mock GitHub returned 403/);
  await assert.rejects(retryVisibilityLock(() => fail(422), assert.fail), /Mock GitHub returned 422/);
  calls = 0;
  await assert.rejects(retryVisibilityLock(() => { calls++; throw lock; }, async () => {}), error => error === lock);
  assert.equal(calls, 7);
});

test('allows temporary 404 and exact empty-repository 409 from a known write to settle', async () => {
  const empty = Object.assign(new Error('gh: Git Repository is empty. (HTTP 409)'), { status: 409 });
  const statuses = [404, empty];
  const delays = [];
  const result = await retryRepositoryRead(() => {
    const status = statuses.shift();
    if (status instanceof Error) throw status;
    if (status) return fail(status);
    return { object: { sha: head } };
  }, async delay => { delays.push(delay); });
  assert.equal(result.object.sha, head);
  assert.deepEqual(delays, [1000, 2000]);

  await assert.rejects(retryRepositoryRead(() => fail(409), assert.fail), /Mock GitHub returned 409/);
  await assert.rejects(retryRepositoryRead(() => fail(403), assert.fail), /Mock GitHub returned 403/);
});

test('serializes remote mutations and spaces starts globally, even when an operation fails', async () => {
  let time = 0;
  const starts = [];
  const finished = Promise.withResolvers();
  const queue = mutationQueue({
    now: () => time,
    pause: async delay => { time += delay; }
  });
  const first = queue(async () => {
    starts.push(time);
    await finished.promise;
    time += 50;
    throw new Error('remote conflict');
  });
  const second = queue(async () => {
    starts.push(time);
    time += 1200;
    return 2;
  });
  const third = queue(() => {
    starts.push(time);
    return 3;
  });
  await Promise.resolve();
  assert.deepEqual(starts, [0]);
  finished.resolve();
  await assert.rejects(first, /remote conflict/);
  assert.equal(await second, 2);
  assert.equal(await third, 3);
  assert.deepEqual(starts, [0, 1100, 2300]);
});

test('provisions independent repositories concurrently and preserves catalog order', async () => {
  const projects = plan(makeProblem(), makeProblem({ id: 'second' }), makeProblem({ id: 'third' }));
  const seeds = projects.map(makeSeed);
  const gates = projects.map(() => Promise.withResolvers());
  const started = [];
  const bulk = provisionAll(projects, seeds, (project, seed) => {
    const index = projects.indexOf(project);
    assert.equal(seed, seeds[index]);
    started.push(project.id);
    return gates[index].promise;
  }, 2);
  assert.deepEqual(started, [slug, 'second']);
  gates[1].resolve('second receipt');
  await Promise.resolve();
  assert.deepEqual(started, [slug, 'second', 'third']);
  gates[2].resolve('third receipt');
  gates[0].resolve('first receipt');
  const result = await bulk;
  assert.deepEqual(Object.keys(result), [slug, 'second', 'third']);
  assert.equal(result[slug], 'first receipt');

  await assert.rejects(provisionAll([projects[0], projects[0]], seeds.slice(0, 2), assert.fail), /Invalid repository provisioning batch/);
});

test('waits for in-flight jobs and reports each failure before refusing a partial registry', async () => {
  const projects = plan(makeProblem(), makeProblem({ id: 'second' }), makeProblem({ id: 'third' }));
  const started = [];
  const gates = projects.map(() => Promise.withResolvers());
  const bulk = provisionAll(projects, projects.map(makeSeed), project => {
    started.push(project.id);
    return gates[projects.indexOf(project)].promise;
  }, 2);
  const failed = assert.rejects(bulk, /Registry was not written[\s\S]*first failure[\s\S]*second failure/);
  gates[0].reject(new Error('first failure'));
  await Promise.resolve();
  assert.deepEqual(started, [slug, 'second']);
  gates[1].reject(new Error('second failure'));
  await failed;
  assert.deepEqual(started, [slug, 'second']);
});

test('reads only the selected Git snapshot and rejects symlinks and executable file modes', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'works-by-us-snapshot-test-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  try {
    git('init', '--quiet', '--template=');
    await mkdir(join(cwd, 'src'));
    await writeFile(join(cwd, 'src', 'catalog.json'), 'committed');
    await writeFile(join(cwd, 'executable'), 'tracked executable');
    git('add', '--all');
    git('update-index', '--chmod=+x', 'executable');
    await symlink('src/catalog.json', join(cwd, 'symlink'));
    git('add', 'symlink');
    git('-c', 'user.name=CI Tests', '-c', 'user.email=tests@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Test snapshot');
    await writeFile(join(cwd, 'src', 'catalog.json'), 'later working tree edit');
    assert.equal(snapshotReader(cwd, 'HEAD').read('src/catalog.json').toString(), 'committed');
    assert.throws(() => snapshotReader(cwd, 'HEAD').read('symlink'), /regular file/);
    assert.throws(() => snapshotReader(cwd, 'HEAD').read('executable'), /regular file/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
