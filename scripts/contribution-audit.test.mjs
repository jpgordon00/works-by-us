import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { auditContributions } from './contribution-audit.mjs';

const auditPath = fileURLToPath(new URL('./contribution-audit.mjs', import.meta.url));

function fixture(t, format = 'sha1') {
  const root = mkdtempSync(join(tmpdir(), 'contribution-audit-test-'));
  const work = join(root, 'work');
  const gitDir = join(root, 'mirror.git');
  t.after(() => {
    execFileSync('rm', ['-rf', '--', root]);
  });
  mkdirSync(work);
  mkdirSync(join(root, 'empty-template'));
  function git(args, options = {}) {
    return execFileSync('git', args, {
      cwd: work, encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        LC_ALL: 'C',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_AUTHOR_DATE: '2025-01-01T00:00:00Z',
        GIT_COMMITTER_DATE: '2025-01-01T00:00:00Z',
        ...options.env,
      },
      input: options.input,
    }).trim();
  }
  git(['init', '-q', '--initial-branch=main', '--object-format=' + format, '--template=' + join(root, 'empty-template')]);
  git(['config', 'user.name', 'Ana Example']);
  git(['config', 'user.email', 'private-ana@example.test']);
  function file(path, content) {
    mkdirSync(dirname(join(work, path)), { recursive: true });
    writeFileSync(join(work, path), content);
  }
  function commit(message, identity) {
    git(['add', '-A']);
    const env = identity && { GIT_AUTHOR_NAME: identity[0], GIT_AUTHOR_EMAIL: identity[1] };
    git(['commit', '-q', '--allow-empty', '-F', '-'], { env, input: message + '\n' });
    return git(['rev-parse', 'HEAD']);
  }
  function mirror() {
    git(['clone', '-q', '--bare', '--template=' + join(root, 'empty-template'), work, gitDir]);
    return gitDir;
  }
  return { root, work, git, file, commit, mirror };
}

function counts(object) {
  return [object.linesAdded, object.linesDeleted, object.codeFilesChanged];
}

test('counts source churn and publishes no paths or emails from commit history', t => {
  const f = fixture(t);
  f.file('source.js', 'first\nsecond\nthird\n');
  f.file('README.md', '# Docs\nSkip this prose\n');
  f.file('node_modules/dependency.js', 'skip\n');
  f.file('vendor/library.py', 'skip\n');
  f.file('binary.c', Buffer.from([0, 1, 2, 10]));
  f.file('unicode ü@\tnew\nline.ts', 'export const ID = 4;\n');
  symlinkSync('source.js', join(f.work, 'link.js'));
  const seed = f.commit('Initial import');
  f.file('source.js', 'first\nreplacement\nthird\nfourth\n');
  const head = f.commit('Fix the source\n\nCo-authored-by: Another Person <hidden@example.test>');
  const gitDir = f.mirror();

  const entire = auditContributions({ gitDir, head });
  assert.deepEqual(counts(entire.totals), [6, 1, 3]);
  assert.equal(entire.contributors[0].label, 'Ana Example');
  assert.deepEqual(counts(entire.commits.find(commit => commit.sha === seed)), [4, 0, 2]);
  assert.deepEqual(counts(entire.commits.find(commit => commit.sha === head)), [2, 1, 1]);
  assert.doesNotMatch(JSON.stringify(entire), /example\.test|unicode|another person/i);
  assert.deepEqual(auditContributions({ gitDir, head }), entire);
  assert.deepEqual(counts(auditContributions({ gitDir, base: seed, head }).totals), [2, 1, 1]);
  assert.equal(auditContributions({ gitDir, base: head, head }).totals.commits, 0);
});

test('counts an edited rename once and treats a pure rename as zero line churn', t => {
  const f = fixture(t);
  f.file('before\t.js', 'a\nb\nc\nd\ne\nf\ng\nh\n');
  const seed = f.commit('Initial import');
  f.git(['mv', 'before\t.js', 'middle\n.js']);
  const first = f.commit('Rename without contents changing');
  f.git(['mv', 'middle\n.js', 'after.js']);
  f.file('after.js', 'a\nb\nc\nd\ne\nf\ng\nh\nnew\n');
  const head = f.commit('Rename with a code change');
  const report = auditContributions({ gitDir: f.mirror(), base: seed, head });
  assert.deepEqual(counts(report.commits.find(commit => commit.sha === first)), [0, 0, 1]);
  assert.deepEqual(counts(report.commits.find(commit => commit.sha === head)), [1, 0, 1]);
});

test('counting keeps old and new source classifications separate on cross-extension renames', t => {
  const f = fixture(t);
  f.file('old.md', 'a\nb\nc\nd\ne\nf\ng\nh\n');
  const seed = f.commit('Initial import');
  f.git(['mv', 'old.md', 'new.js']);
  f.file('new.js', 'a\nb\nc\nd\ne\nf\ng\nadded\n');
  const head = f.commit('Change a line while moving to a code extension');
  const report = auditContributions({ gitDir: f.mirror(), base: seed, head });
  assert.deepEqual(counts(report.totals), [1, 0, 1]);
});

test('GitHub evidence and declared agents retain different authority and avoid double-counting', t => {
  const f = fixture(t);
  f.file('main.go', 'package main\n');
  const seed = f.commit('Seed');
  f.file('main.go', 'package main\nfunc a() {}\n');
  const declared = f.commit('Implement a function\n\nAgent-Author: CODEX-Local', ['Personal Name', 'hidden@example.test']);
  f.file('main.go', 'package main\nfunc a() {}\nfunc b() {}\n');
  const unsigned = f.commit('Add another function', ['Personal Name', 'unverified@example.test']);
  const head = f.commit('Apply review\n\nAgent-Author: Claimed\nAgent-Author: Multiple');
  const report = auditContributions({
    gitDir: f.mirror(), base: seed, head,
    githubIdentities: {
      [declared]: { authorLogin: 'maintainer', signatureVerified: true },
      [head]: { authorLogin: 'Maintainer', signatureVerified: false },
    },
  });
  const children = report.contributors.filter(contributor => contributor.kind === 'declared-agent');
  assert.equal(children.length, 1);
  assert.equal(children[0].label, 'codex-local');
  const authored = report.commits.find(commit => commit.sha === declared);
  const anonymous = report.commits.find(commit => commit.sha === unsigned);
  const reviewed = report.commits.find(commit => commit.sha === head);
  assert.equal(authored.githubEvidence.signatureVerified, true);
  assert.equal(authored.authorId, reviewed.authorId);
  assert.equal(authored.authorId, children[0].declaredBy);
  assert.equal(authored.contributorId, children[0].id);
  assert.notEqual(authored.authorId, anonymous.authorId);
  assert.equal(anonymous.githubEvidence, null);
  assert.equal(reviewed.declaredAgent, null);
  assert.equal(reviewed.githubEvidence.signatureVerified, false);
  assert.equal(report.contributors.reduce((sum, item) => sum + item.linesAdded, 0), 2);
});

test('redacts email-like labels and keeps distinct unverified people with the same display name', t => {
  const f = fixture(t);
  f.commit('Root', ['Same Name', 'email1@example.test']);
  f.commit('Second\n\nAgent-Author: bad@alias.test', ['Same Name', 'email2@example.test']);
  const head = f.commit('Third', ['private@example.test', 'email3@example.test']);
  const report = auditContributions({ gitDir: f.mirror(), head });
  assert.equal(report.contributors.filter(item => item.label === 'Same Name').length, 2);
  assert.equal(report.contributors.filter(item => item.label === 'Undisplayed Git author').length, 1);
  assert.doesNotMatch(JSON.stringify(report), /@|example\.test|alias\.test/);
});

test('ignores repository diff overrides, extension-shaped symlinks and file type changes', t => {
  const f = fixture(t);
  f.file('.gitattributes', '*.js -diff\n');
  f.file('file.js', 'a\nb\n');
  f.file('type.js', 'moving to symlink\n');
  const seed = f.commit('Root');
  f.file('file.js', 'a\nc\n');
  f.git(['rm', '-q', 'type.js']);
  symlinkSync('file.js', join(f.work, 'type.js'));
  const head = f.commit('Change types');
  const report = auditContributions({ gitDir: f.mirror(), base: seed, head });
  assert.deepEqual(counts(report.totals), [1, 1, 1]);
});

test('ignores inherited Git overrides and never invokes text conversion', t => {
  const f = fixture(t);
  f.file('.gitattributes', '*.js diff=external\n');
  const seed = f.commit('Root');
  f.file('file.js', 'only code\n');
  const head = f.commit('Add file');
  const gitDir = f.mirror();
  const configPath = join(gitDir, 'config');
  writeFileSync(configPath, readFileSync(configPath, 'utf8') +
    '\n[diff "external"]\n\ttextconv = exploit_fixture_must_not_run\n');
  const result = spawnSync(process.execPath, [auditPath, '--git-dir', gitDir, '--base', seed, '--head', head], {
    encoding: 'utf8',
    env: { ...process.env, GIT_EXTERNAL_DIFF: 'exploit_fixture_must_not_run', GIT_ATTR_SOURCE: head },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(counts(JSON.parse(result.stdout).totals), [1, 0, 1]);
});

test('excludes merge churn while retaining accepted, reachable branch commits', t => {
  const f = fixture(t);
  const seed = f.commit('Root');
  f.git(['checkout', '-qb', 'proposal']);
  f.file('proposal.py', 'print("evidence")\n');
  const proposal = f.commit('Propose evidence');
  f.git(['checkout', '-q', 'main']);
  f.file('main.sh', 'exit 0\n');
  const main = f.commit('Introduce build');
  f.git(['merge', '-q', '--no-ff', 'proposal', '-m', 'Merge proposal']);
  const head = f.git(['rev-parse', 'HEAD']);
  const report = auditContributions({ gitDir: f.mirror(), base: seed, head });
  assert.deepEqual(report.commits.map(item => item.sha).sort(), [proposal, main].sort());
  assert.deepEqual(report.excludedMerges, [{ sha: head, parentCount: 2 }]);
  assert.deepEqual(counts(report.totals), [2, 0, 2]);
});

test('rejects branches, non-commit objects, unrelated bases and non-bare repos', t => {
  const f = fixture(t);
  const seed = f.commit('Root');
  f.git(['checkout', '-qb', 'other']);
  const other = f.commit('Other');
  f.git(['checkout', '-q', 'main']);
  const head = f.commit('Main');
  const tree = f.git(['rev-parse', 'HEAD^{tree}']);
  const gitDir = f.mirror();
  for (const invalid of ['HEAD', '--output=any', seed.slice(0, 8), tree]) {
    assert.throws(() => auditContributions({ gitDir, head: invalid }), /full lowercase Git commit IDs/);
  }
  assert.throws(() => auditContributions({ gitDir, base: other, head }), /ancestor/);
  assert.throws(() => auditContributions({ gitDir: join(f.work, '.git'), head }), /bare Git repository/);
  assert.throws(() => auditContributions({
    gitDir, head, githubIdentities: { [head]: { authorLogin: 'someone@example.test', signatureVerified: true } },
  }), /invalid fields/);
});

test('accepts full SHA-256 immutable objects', t => {
  const f = fixture(t, 'sha256');
  f.file('file.py', 'import sys\n');
  const head = f.commit('Root');
  const report = auditContributions({ gitDir: f.mirror(), head });
  assert.equal(report.objectFormat, 'sha256');
  assert.equal(report.head.length, 64);
  assert.deepEqual(counts(report.totals), [1, 0, 1]);
});

test('accepts only explicit CLI parameters and prints no partial report on failure', t => {
  const f = fixture(t);
  const head = f.commit('Root');
  const gitDir = f.mirror();
  const output = args => spawnSync(process.execPath, [auditPath, '--git-dir', gitDir, ...args], { encoding: 'utf8' });
  assert.equal(JSON.parse(output(['--head', head]).stdout).head, head);
  assert.equal(output(['--head', 'main']).status, 1);
  assert.equal(output(['--head', 'main']).stdout, '');
  assert.equal(output(['--head', head, '--ignored']).status, 1);
});
