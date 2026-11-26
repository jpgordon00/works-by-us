import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachCollaborationData } from './collaboration-data.mjs';

const seed = '1'.repeat(40);
const repo = 'https://github.com/jpgordon00/ci-sample';

function fixture() {
  return [
    {
      categories: [{ id: 'math', title: 'Math', description: 'Example.' }],
      problems: [{
        id: 'sample', category: 'math', title: 'Is this checkable?', summary: 'An example.',
        context: 'Open question.', task: 'Count cases.', review: 'Check expected values.', kind: 'Research',
        sources: [{ title: 'Source', url: 'https://example.com/' }]
      }],
      featured: 'sample'
    },
    { sample: { repository: repo, seed } },
    {
      sample: {
        seed: { commit: seed, github_account: null, additions: 15, deletions: 0 },
        receipts: [
          { number: 3, merge_commit: '2'.repeat(40), head: '3'.repeat(40),
            github_account: { id: 10, login: 'known-contributor[bot]', type: 'Bot' }, additions: 8, deletions: 1 }
        ],
        seed_disclosures: [
          { agent: 'Example agent', work: 'Wrote the checker.', source_commit: '4'.repeat(40),
            paths: ['contributions/sample/check.mjs'], additions: 5, deletions: 0 }
        ]
      }
    }
  ];
}

test('validated collaboration data maps an exact project and preserves the seed', () => {
  const [catalog, registry, ledger] = fixture();
  const joined = attachCollaborationData(catalog, registry, ledger);
  assert.equal(joined.problems[0].repository, repo);
  assert.equal(joined.problems[0].seed, seed);
  assert.equal(catalog.problems[0].repository, undefined);
});

test('binding rejects credentials, alternate repositories and mismatched seeds', () => {
  for (const repository of ['https://attacker.example/ci-sample', repo + '?url=https://example.com', repo + '/forks']) {
    const [catalog, registry, ledger] = fixture();
    registry.sample.repository = repository;
    assert.throws(() => attachCollaborationData(catalog, registry, ledger), /Invalid dedicated repository/);
  }
  const [catalog, registry, ledger] = fixture();
  delete registry.sample;
  assert.throws(() => attachCollaborationData(catalog, registry, ledger), /Every catalog problem/);
  registry.sample = { repository: repo, seed: 'a'.repeat(40) };
  assert.throws(() => attachCollaborationData(catalog, registry, ledger), /Invalid contribution ledger/);
});

test('review links reject non-HTTPS and credentialed URLs, and related IDs are checked', () => {
  const [catalog, registry, ledger] = fixture();
  for (const url of ['javascript:void(0)', 'https://user@example.com/', 'https://example.com:90/']) {
    catalog.problems[0].sources[0].url = url;
    assert.throws(() => attachCollaborationData(catalog, registry, ledger), /Expected trusted HTTPS/);
  }
  catalog.problems[0].sources[0].url = 'https://example.com/';
  catalog.problems[0].related = ['elsewhere'];
  assert.throws(() => attachCollaborationData(catalog, registry, ledger), /Invalid related problems/);
});

test('receipts reject unsafe account labels and duplicate GitHub identifiers', () => {
  const [catalog, registry, ledger] = fixture();
  const receipt = ledger.sample.receipts[0];
  ledger.sample.receipts.push({ ...receipt });
  assert.throws(() => attachCollaborationData(catalog, registry, ledger), /Invalid contribution receipt/);
  ledger.sample.receipts.pop();
  receipt.github_account.login = 'someone@example.com';
  assert.throws(() => attachCollaborationData(catalog, registry, ledger), /Invalid contribution receipt/);
});

test('disclosures cannot double-count files, exceed the audited lines, or escape the evidence folder', () => {
  const [catalog, registry, ledger] = fixture();
  const row = ledger.sample.seed_disclosures[0];
  row.additions = 16;
  assert.throws(() => attachCollaborationData(catalog, registry, ledger), /exceed source lines/);
  row.additions = 5;
  ledger.sample.seed_disclosures.push({ ...row });
  assert.throws(() => attachCollaborationData(catalog, registry, ledger), /double-counted/);
  ledger.sample.seed_disclosures.pop();
  row.paths = ['contributions/sample/../../README.md'];
  assert.throws(() => attachCollaborationData(catalog, registry, ledger), /Invalid or double-counted/);
});

test('workroom references require a numeric issue in an existing project', () => {
  const args = fixture();
  assert.equal(attachCollaborationData(...args, { sample: 4 }).problems[0].workroom_issue, 4);
  for (const invalid of [{ missing: 4 }, { sample: 0 }, { sample: '/foreign/issue' }, []]) {
    assert.throws(() => attachCollaborationData(...args, invalid), /Invalid project workroom mapping/);
  }
});
