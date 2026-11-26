import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildContributionLedger } from './project-receipts.mjs';

const id = 'example';
const repository = 'jpgordon00/ci-example';
const projectPath = 'repos/' + repository;
const seedSha = 'a'.repeat(40);
const mergeSha = 'b'.repeat(40);
const headSha = 'c'.repeat(40);
const manifest = { [id]: { repository: 'https://github.com/' + repository, seed: seedSha } };
const seedPath = projectPath + '/commits/' + seedSha + '?per_page=100';
const pullPath = projectPath + '/pulls/8';
const listPath = projectPath + '/pulls?state=closed&base=main&sort=created&direction=asc&per_page=100';
const filesPath = pullPath + '/files?per_page=100';
const seedAccount = { login: 'example-author', id: 31, type: 'User' };
const pullAccount = { login: 'example-app[bot]', id: 43, type: 'Bot' };
const mergedAt = '2026-11-25T13:00:00Z';
const file = (filename, additions, deletions, previous_filename = null) => ({ filename, additions, deletions, previous_filename });
const info = { full_name: repository, private: false, default_branch: 'main' };
const seed = { sha: seedSha, author: seedAccount, stats: { additions: 14, deletions: 0 }, files: [
  file('src/app.ts', 4, 0), file('tests/test_app.py', 3, 0), file('README.md', 6, 0), file('fixtures/input.js', 1, 0)
] };
const pull = { number: 8, merged: true, merged_at: mergedAt, base: { ref: 'main', repository },
  merge_commit_sha: mergeSha, head: headSha, user: pullAccount, changed_files: 6, additions: 26, deletions: 19 };
const pullFiles = [
  file('src/app.ts', 4, 2),
  file('dist/bundle.js', 3, 3),
  file('src/new.PY', 4, 2, 'data/old.py'),
  file('vendor/old.js', 5, 6, 'src/old.js'),
  file('.github/private.js', 8, 5),
  file('src/view.min.js', 2, 1)
];

function fixture(overrides = {}) {
  const calls = [];
  const endpoints = {
    [projectPath]: { projection: 'project', value: info },
    [seedPath]: { projection: 'seed', value: [seed], paginate: true },
    [listPath]: { projection: 'pullList', value: [[{ number: 8, merged_at: mergedAt }, { number: 7, merged_at: null }]], paginate: true },
    [pullPath]: { projection: 'pull', value: pull },
    [filesPath]: { projection: 'files', value: [pullFiles.slice(0, 2), pullFiles.slice(2)], paginate: true },
    ...overrides
  };
  const get = async (path, projection, paginate = false) => {
    const response = endpoints[path];
    assert.ok(response, 'Unexpected API route');
    assert.equal(projection, response.projection);
    assert.equal(paginate, response.paginate ?? false);
    const previousCalls = calls.filter(call => call === path).length;
    calls.push(path);
    return structuredClone(response.sequence?.[previousCalls] ?? response.value);
  };
  return { calls, get };
}

function response(projection, value, paginate = false) {
  return { projection, value, paginate };
}

test('reconciles seed and merged PR lines and publishes only the fixed receipt fields', async () => {
  const { calls, get } = fixture({
    [seedPath]: response('seed', [{ ...seed, message: 'private text', author: { ...seedAccount, email: 'private@example.org' } }], true),
    [pullPath]: response('pull', { ...pull, body: 'user text', user: { ...pullAccount, avatar_url: 'unneeded' } }),
    [filesPath]: response('files', [pullFiles.map(item => ({ ...item, patch: 'user text' }))], true)
  });
  assert.deepEqual(await buildContributionLedger(manifest, get), {
    example: {
      seed: { commit: seedSha, github_account: seedAccount, additions: 7, deletions: 0 },
      receipts: [{ number: 8, merge_commit: mergeSha, head: headSha, github_account: pullAccount, additions: 8, deletions: 8 }]
    }
  });
  assert.deepEqual(calls, [projectPath, seedPath, listPath, pullPath, filesPath, pullPath]);
});

test('preserves a null account and empty receipt list for a seeded repo with no merged PRs', async () => {
  const { get } = fixture({
    [seedPath]: response('seed', [{ ...seed, author: null, files: [] , stats: { additions: 0, deletions: 0 } }], true),
    [listPath]: response('pullList', [[{ number: 7, merged_at: null }]], true)
  });
  assert.deepEqual(await buildContributionLedger(manifest, get), {
    example: { seed: { commit: seedSha, github_account: null, additions: 0, deletions: 0 }, receipts: [] }
  });
});

test('combines paginated seed files with stable identity and totals', async () => {
  const { get } = fixture({
    [seedPath]: response('seed', [{ ...seed, files: seed.files.slice(0, 1) }, { ...seed, files: seed.files.slice(1) }], true)
  });
  const ledger = await buildContributionLedger(manifest, get);
  assert.equal(ledger.example.seed.additions, 7);
});

test('validates the registry before invoking any GitHub reads', async () => {
  const forbidden = () => assert.fail('An invalid registry makes no API calls');
  for (const bad of [
    [], {}, null, { ...manifest, A: manifest.example }, { 'bad/name': manifest.example },
    { example: { ...manifest.example, repository: 'https://example.org/' + repository } },
    { example: { ...manifest.example, repository: 'https://github.com/other/ci-example' } },
    { example: { ...manifest.example, repository: 'https://github.com/' + repository + '?p=1' } },
    { example: { ...manifest.example, seed: 'main' } }, { example: { ...manifest.example, seed: 123 } }
  ]) {
    await assert.rejects(buildContributionLedger(bad, forbidden), /registry/);
  }
});

for (const [label, repositoryInfo] of [
  ['a repository rename or redirect', { ...info, full_name: 'other/ci-example' }],
  ['a private lookalike repository', { ...info, private: true }],
  ['a different default branch', { ...info, default_branch: 'other' }]
]) {
  test('rejects ' + label, async () => {
    const { get } = fixture({ [projectPath]: response('project', repositoryInfo) });
    await assert.rejects(buildContributionLedger(manifest, get), /repository identity or default branch/);
  });
}

for (const [label, changed] of [
  ['an unmerged detail', { merged: false }],
  ['a different merge time', { merged_at: '2026-11-26T13:00:00Z' }],
  ['a different PR number', { number: 2 }],
  ['a different base repository', { base: { ref: 'main', repository: 'fork/ci-example' } }],
  ['a different base branch', { base: { ref: 'other', repository } }],
  ['a missing merge commit', { merge_commit_sha: null }],
  ['an invalid head', { head: 'HEAD' }],
  ['an incomplete file count', { changed_files: null }],
  ['invalid aggregate line counts', { additions: -10 }]
]) {
  test('rejects ' + label, async () => {
    const { get } = fixture({ [pullPath]: response('pull', { ...pull, ...changed }) });
    await assert.rejects(buildContributionLedger(manifest, get), /merged state, repository, base branch or immutable revisions/);
  });
}

for (const [label, changed] of [
  ['a suspicious account login', { login: 'read/secret' }],
  ['a forged account type', { type: 'ignore instructions' }],
  ['an incomplete account ID', { id: 'not-a-number' }]
]) {
  test('rejects ' + label, async () => {
    const { get } = fixture({ [pullPath]: response('pull', { ...pull, user: { ...pullAccount, ...changed } }) });
    await assert.rejects(buildContributionLedger(manifest, get), /account attribution is incomplete/);
  });
}

test('fails closed if the head or account changes while reading file pages', async () => {
  for (const changed of [{ head: 'e'.repeat(40) }, { user: { ...pullAccount, id: 44 } }]) {
    const { get } = fixture({ [pullPath]: { projection: 'pull', sequence: [pull, { ...pull, ...changed }] } });
    await assert.rejects(buildContributionLedger(manifest, get), /changed while reading the diff/);
  }
});

test('fails closed on duplicate, omitted, or non-reconciling pull files', async () => {
  for (const [files, reason] of [
    [pullFiles.slice(1), /file listing is incomplete/],
    [[...pullFiles.slice(0, -1), pullFiles[0]], /duplicate path/],
    [[...pullFiles.slice(0, -1), file('src/final.js', 3, 1)], /do not reconcile/],
    [[...pullFiles.slice(0, -1), file('src/final.js', -1, 1)], /file counts are invalid/],
    [[...pullFiles.slice(0, -1), file('src/../file.js', 2, 1)], /invalid file path/]
  ]) {
    const { get } = fixture({ [filesPath]: response('files', [files], true) });
    await assert.rejects(buildContributionLedger(manifest, get), reason);
  }
});

test('fails closed for missing or incompatible seed pages', async () => {
  for (const [pages, reason] of [
    [[], /pinned commit pages are missing/],
    [[seed, { ...seed, sha: 'f'.repeat(40) }], /pinned commit pages disagree/],
    [[{ ...seed, files: seed.files.slice(1) }], /do not reconcile/],
    [[seed, { ...seed, author: null }], /pinned commit pages disagree/]
  ]) {
    const { get } = fixture({ [seedPath]: response('seed', pages, true) });
    await assert.rejects(buildContributionLedger(manifest, get), reason);
  }
});

test('fails closed at the GitHub API 3,000-file cap for seed and PR diffs', async () => {
  const oversized = {
    ...seed, stats: { additions: 0, deletions: 0 },
    files: Array.from({ length: 3000 }, (_, index) => file('src/file' + index + '.js', 0, 0))
  };
  const seedFixture = fixture({ [seedPath]: response('seed', [oversized], true) });
  await assert.rejects(buildContributionLedger(manifest, seedFixture.get), /3,000-file limit/);
  const pullFixture = fixture({ [pullPath]: response('pull', { ...pull, changed_files: 3000 }) });
  await assert.rejects(buildContributionLedger(manifest, pullFixture.get), /3,000-file limit/);
  assert.ok(!pullFixture.calls.includes(filesPath));
});

test('revalidates the merged snapshot when the PR list spans pages', async () => {
  const stable = [[{ number: 7, merged_at: null }], [{ number: 8, merged_at: mergedAt }]];
  const { calls, get } = fixture({ [listPath]: response('pullList', stable, true) });
  await buildContributionLedger(manifest, get);
  assert.equal(calls.filter(path => path === listPath).length, 2);
  const changed = fixture({
    [listPath]: { projection: 'pullList', paginate: true, sequence: [stable, [[{ number: 7, merged_at: null }]]] }
  });
  await assert.rejects(buildContributionLedger(manifest, changed.get), /listing changed/);
});

test('rejects duplicate PR numbers and duplicate merge commits across different PRs', async () => {
  const one = { number: 8, merged_at: mergedAt };
  const duplicate = fixture({ [listPath]: response('pullList', [[one], [one]], true) });
  await assert.rejects(buildContributionLedger(manifest, duplicate.get), /duplicate or invalid record/);
  const repeated = fixture({
    [listPath]: response('pullList', [[one, { ...one, number: 9 }]], true),
    [projectPath + '/pulls/9']: response('pull', { ...pull, number: 9 }),
    [projectPath + '/pulls/9/files?per_page=100']: response('files', [pullFiles], true)
  });
  await assert.rejects(buildContributionLedger(manifest, repeated.get), /same merge commit/);
});

const disclosureCommit = 'd'.repeat(40);
const disclosedSource = 'contributions/3sat-clique/check.mjs';
const disclosedDoc = 'contributions/3sat-clique/README.md';
const sourceBlob = 'e'.repeat(40);
const docBlob = 'f'.repeat(40);
const operatorRow = {
  agent: 'math_starter (Codex)',
  work: 'Wrote the proof and checker.',
  source_commit: disclosureCommit,
  paths: [disclosedSource, disclosedDoc]
};
const hubContents = path => 'repos/jpgordon00/works-by-us/contents/' + path + '?ref=' + disclosureCommit;
const blob = (path, sha) => ({
  type: 'file', path, sha, html_url: 'https://github.com/jpgordon00/works-by-us/blob/' + disclosureCommit + '/' + path
});
const preparedFiles = [
  { ...file(disclosedSource, 69, 0), sha: sourceBlob, status: 'added' },
  { ...file(disclosedDoc, 20, 0), sha: docBlob, status: 'added' },
  { ...file('src/elsewhere.js', 10, 0), sha: docBlob, status: 'added' }
];

function disclosedFixture(overrides = {}) {
  return fixture({
    [seedPath]: response('seed', [{ ...seed, stats: { additions: 99, deletions: 0 }, files: preparedFiles }], true),
    [hubContents(disclosedSource)]: response('hubFile', blob(disclosedSource, sourceBlob)),
    [hubContents(disclosedDoc)]: response('hubFile', blob(disclosedDoc, docBlob)),
    ...overrides
  });
}

test('verifies the pinned hub blobs, attributes source lines only, and retains operator evidence paths', async () => {
  const { calls, get } = disclosedFixture();
  const ledger = await buildContributionLedger(manifest, get, { example: [operatorRow] });
  assert.equal(ledger.example.seed.additions, 79);
  assert.deepEqual(ledger.example.seed_disclosures, [{ ...operatorRow, additions: 69, deletions: 0 }]);
  assert.ok(calls.includes(hubContents(disclosedSource)));
  assert.ok(calls.includes(hubContents(disclosedDoc)));
});

test('leaves disclosure data absent for projects without operator attribution', async () => {
  const { calls, get } = disclosedFixture();
  const ledger = await buildContributionLedger(manifest, get, {});
  assert.equal(Object.hasOwn(ledger.example, 'seed_disclosures'), false);
  assert.ok(!calls.includes(hubContents(disclosedSource)));
});

test('rejects disclosure path duplication and invalid operator data before GitHub calls', async () => {
  const noReads = () => assert.fail('Expected validation before any GitHub call');
  for (const invalid of [
    null,
    { missing: [operatorRow] },
    { example: [] },
    { example: new Array(26).fill(operatorRow) },
    { example: [operatorRow, { ...operatorRow, agent: 'another (Codex)' }] },
    { example: [{ ...operatorRow, work: 'Contains\nnewlines' }] },
    { example: [{ ...operatorRow, work: 'Contains\u202Etext' }] },
    { example: [{ ...operatorRow, work: 'x'.repeat(501) }] },
    { example: [{ ...operatorRow, agent: '<script>' }] },
    { example: [{ ...operatorRow, paths: ['contributions/3sat-clique/../README.md'] }] },
    { example: [{ ...operatorRow, paths: ['contributions/3sat-clique/check.mjs?ref=other'] }] },
    { example: [{ ...operatorRow, paths: ['src/elsewhere.js'] }] },
    { example: [{ ...operatorRow, paths: ['CONTRIBUTIONS/3sat-clique/check.mjs'] }] },
    { example: [{ ...operatorRow, paths: ['contributions/3sat-clique/%2e%2e'] }] },
    { example: [{ ...operatorRow, paths: [disclosedSource, disclosedSource] }] },
    { example: [{ ...operatorRow, source_commit: 'main' }] },
    { example: [{ ...operatorRow, scope: 'seed' }] },
    { example: [{ ...operatorRow, scope: null }] },
    { example: [{ ...operatorRow, scope: 'hub', additions: 123 }] },
    { example: [operatorRow, { ...operatorRow, scope: 'hub' }] },
    { example: [{ ...operatorRow, additions: 10000 }] }
  ]) {
    await assert.rejects(buildContributionLedger(manifest, noReads, invalid), /[Ss]eed disclosure/);
  }
});

test('requires declared artifacts to be added in the exact seed', async () => {
  for (const changes of [
    { filename: 'contributions/3sat-clique/different.mjs' },
    { status: 'modified' },
    { sha: 'no-blob' },
    { deletions: 1 },
    { previous_filename: 'contributions/3sat-clique/other.mjs' }
  ]) {
    const files = [{ ...preparedFiles[0], ...changes }, ...preparedFiles.slice(1)];
    const { calls, get } = disclosedFixture({
      [seedPath]: response('seed', [{ ...seed, stats: { additions: 99, deletions: changes.deletions ?? 0 }, files }], true)
    });
    await assert.rejects(buildContributionLedger(manifest, get, { example: [operatorRow] }), /not a verified addition/);
    assert.ok(!calls.includes(hubContents(disclosedSource)));
  }
});

test('requires the same blob at the exact hub commit, file path and repository', async () => {
  for (const changes of [
    { sha: docBlob },
    { path: disclosedDoc },
    { html_url: 'https://github.com/jpgordon00/works-by-us/blob/main/' + disclosedSource },
    { html_url: 'https://github.com/elsewhere/works-by-us/blob/' + disclosureCommit + '/' + disclosedSource },
    { type: 'dir' }
  ]) {
    const { get } = disclosedFixture({
      [hubContents(disclosedSource)]: response('hubFile', { ...blob(disclosedSource, sourceBlob), ...changes })
    });
    await assert.rejects(buildContributionLedger(manifest, get, { example: [operatorRow] }), /does not match the pinned hub file/);
  }
});

const hubStarterPath = 'contributions/new-starter/check.py';
const hubStarterNotes = 'contributions/new-starter/README.md';
const hubCommitPath = 'repos/jpgordon00/works-by-us/commits/' + disclosureCommit + '?per_page=100';
const hubStarterFiles = [
  { ...file(hubStarterPath, 31, 0), sha: sourceBlob, status: 'added' },
  { ...file(hubStarterNotes, 11, 0), sha: docBlob, status: 'added' }
];
const hubStarterCommit = {
  sha: disclosureCommit, author: seedAccount, stats: { additions: 42, deletions: 0 },
  files: hubStarterFiles
};
const hubStarterRow = {
  agent: 'starter_author (Codex)',
  work: 'Added a standalone checker and usage notes.',
  source_commit: disclosureCommit,
  paths: [hubStarterPath, hubStarterNotes],
  scope: 'hub'
};

function hubStarterFixture(overrides = {}) {
  return disclosedFixture({
    [hubCommitPath]: response('seed', [hubStarterCommit], true),
    [hubContents(hubStarterPath)]: response('hubFile', blob(hubStarterPath, sourceBlob)),
    [hubContents(hubStarterNotes)]: response('hubFile', blob(hubStarterNotes, docBlob)),
    ...overrides
  });
}

test('reports independent hub starter and project seed attribution without changing either project total', async () => {
  const { calls, get } = hubStarterFixture({
    [hubCommitPath]: response('seed', [
      { ...hubStarterCommit, files: hubStarterFiles.slice(0, 1) },
      { ...hubStarterCommit, files: hubStarterFiles.slice(1) }
    ], true)
  });
  const { example } = await buildContributionLedger(manifest, get, { example: [operatorRow, hubStarterRow] });
  const { scope, ...row } = hubStarterRow;
  assert.deepEqual(example.hub_starter_disclosures, [{ ...row, additions: 31, deletions: 0 }]);
  assert.deepEqual(example.seed_disclosures, [{ ...operatorRow, additions: 69, deletions: 0 }]);
  assert.equal(example.seed.additions, 79);
  assert.equal(example.receipts[0].additions, 8);
  assert.equal(example.receipts[0].deletions, 8);
  assert.ok(calls.includes(hubCommitPath));
});

test('reuses the same audited hub commit for distinct rows and omits seed disclosures when empty', async () => {
  const { calls, get } = hubStarterFixture();
  const { example } = await buildContributionLedger(manifest, get, {
    example: [
      { ...hubStarterRow, paths: [hubStarterPath] },
      { ...hubStarterRow, agent: 'notes_author (Codex)', paths: [hubStarterNotes] }
    ]
  });
  assert.equal(Object.hasOwn(example, 'seed_disclosures'), false);
  assert.deepEqual(example.hub_starter_disclosures.map(row => row.additions), [31, 0]);
  assert.equal(calls.filter(call => call === hubCommitPath).length, 1);
});

test('requires a fresh zero-deletion addition in the exact hub commit for hub starters', async () => {
  for (const changes of [
    { status: 'modified' },
    { status: 'renamed', previous_filename: 'contributions/new-starter/other.py' },
    { deletions: 1 },
    { filename: 'contributions/new-starter/elsewhere.py' }
  ]) {
    const changed = {
      ...hubStarterCommit,
      stats: { additions: 42, deletions: changes.deletions ?? 0 },
      files: [{ ...hubStarterFiles[0], ...changes }, hubStarterFiles[1]]
    };
    const { calls, get } = hubStarterFixture({ [hubCommitPath]: response('seed', [changed], true) });
    await assert.rejects(buildContributionLedger(manifest, get, { example: [hubStarterRow] }),
      /not a verified addition in the pinned hub commit/);
    assert.ok(!calls.includes(hubContents(hubStarterPath)));
  }
});

test('fails closed when the pinned hub commit or hub blob differs', async () => {
  for (const [overrides, expected] of [
    [{ [hubCommitPath]: response('seed', [{ ...hubStarterCommit, sha: '1'.repeat(40) }], true) }, /pinned commit pages disagree/],
    [{ [hubContents(hubStarterPath)]: response('hubFile', blob(hubStarterPath, docBlob)) }, /does not match the pinned hub file/]
  ]) {
    const { get } = hubStarterFixture(overrides);
    await assert.rejects(buildContributionLedger(manifest, get, { example: [hubStarterRow] }), expected);
  }
});
