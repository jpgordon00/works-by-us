#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const maxCommits = 2_000;
const sourceExtensions = new Set([
  'asm', 'bash', 'c', 'cc', 'clj', 'cpp', 'cs', 'css', 'cxx', 'dart', 'el',
  'erl', 'ex', 'exs', 'fs', 'fsx', 'go', 'groovy', 'h', 'hpp', 'hs', 'html',
  'java', 'js', 'jsx', 'kt', 'kts', 'lua', 'm', 'mjs', 'mm', 'mts', 'nim',
  'php', 'pl', 'ps1', 'py', 'r', 'rb', 'rs', 'sc', 'scala', 'scss', 'sh',
  'sql', 'svelte', 'swift', 'ts', 'tsx', 'v', 'vue', 'zig', 'zsh',
]);
const sourceBasenames = ['Dockerfile', 'GNUmakefile', 'Makefile'];
const excludedDirectories = new Set(['node_modules', 'vendor']);
const githubLogin = /^[a-z0-9][a-z0-9-]{0,38}(?:\[bot\])?$/i;
const agentLabel = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

function gitCommand(gitDir, args, { input, acceptStatusOne = false, attrSource } = {}) {
  const env = {
    PATH: process.env.PATH,
    LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_ATTR_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
  };
  const command = [
    '--no-replace-objects', '--no-lazy-fetch', '--no-optional-locks', '--no-pager',
    '--git-dir=' + gitDir, '-c', 'core.attributesFile=/dev/null',
  ];
  if (attrSource) command.push('--attr-source=' + attrSource);
  const result = spawnSync('git', [...command, ...args], {
    env, input, timeout: 10_000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.signal) {
    throw new Error('Git ' + args[0] + ' could not complete within the audit limits.');
  }
  if (acceptStatusOne && result.status === 1) return null;
  if (result.status !== 0 || result.stderr.length) {
    throw new Error('Git ' + args[0] + ' failed or reported an incomplete audit.');
  }
  return result.stdout;
}

function nulRecords(buffer) {
  if (!buffer.length) return [];
  if (buffer.at(-1) !== 0) throw new Error('Git returned an incomplete diff record.');
  // Latin-1 preserves every filename byte, even when Git paths are not valid UTF-8.
  return buffer.toString('latin1').slice(0, -1).split('\0');
}

function isSource(path) {
  const components = path.split('/');
  const filename = components.pop();
  if (components.some(component => excludedDirectories.has(component))) return false;
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return sourceBasenames.includes(filename) || Boolean(match && sourceExtensions.has(match[1].toLowerCase()));
}

function diffCounts(buffer) {
  const records = nulRecords(buffer);
  const pairs = new Map();
  let cursor = 0;
  while (records[cursor]?.startsWith(':')) {
    const meta = /^:([0-7]{6}) ([0-7]{6}) [a-f0-9]+ [a-f0-9]+ ([ADMR])\d*$/.exec(records[cursor++]);
    if (!meta) throw new Error('Git returned unexpected file modes.');
    const oldPath = records[cursor++];
    const newPath = meta[3] === 'R' ? records[cursor++] : oldPath;
    if (!oldPath || !newPath) throw new Error('Git returned an empty file path.');
    const key = JSON.stringify([oldPath, newPath]);
    if (pairs.has(key)) throw new Error('Git returned a duplicate diff path.');
    pairs.set(key, {
      oldSource: /^(100644|100755)$/.test(meta[1]) && isSource(oldPath),
      newSource: /^(100644|100755)$/.test(meta[2]) && isSource(newPath),
    });
  }

  let linesAdded = 0;
  let linesDeleted = 0;
  let codeFilesChanged = 0;
  while (cursor < records.length) {
    const record = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(records[cursor++]);
    if (!record) throw new Error('Git returned unexpected line counts.');
    const oldPath = record[3] || records[cursor++];
    const newPath = record[3] || records[cursor++];
    const key = JSON.stringify([oldPath, newPath]);
    const paths = pairs.get(key);
    if (!paths) throw new Error('Git line counts did not match file modes.');
    pairs.delete(key);
    if ((!paths.oldSource && !paths.newSource) || record[1] === '-' || record[2] === '-') continue;
    const added = paths.newSource ? Number(record[1]) : 0;
    const deleted = paths.oldSource ? Number(record[2]) : 0;
    if (!Number.isSafeInteger(added) || !Number.isSafeInteger(deleted)) {
      throw new Error('Git returned line counts beyond the audit limits.');
    }
    linesAdded += added;
    linesDeleted += deleted;
    codeFilesChanged++;
  }
  if (pairs.size) throw new Error('Some diff paths had no Git line counts.');
  return { linesAdded, linesDeleted, codeFilesChanged };
}

function sortStrings(a, b) {
  return a < b ? -1 : Number(a > b);
}

function validateGithubIdentities(identities, objectId) {
  if (!identities || typeof identities !== 'object' || Array.isArray(identities)) {
    throw new Error('GitHub identity evidence must be an object keyed by full commit ID.');
  }
  const out = new Map();
  for (const [sha, evidence] of Object.entries(identities)) {
    if (!objectId.test(sha) || !evidence || typeof evidence !== 'object' ||
        !Object.hasOwn(evidence, 'authorLogin') || !Object.hasOwn(evidence, 'signatureVerified') ||
        Object.keys(evidence).length !== 2 ||
        (evidence.authorLogin !== null &&
          (typeof evidence.authorLogin !== 'string' || !githubLogin.test(evidence.authorLogin))) ||
        typeof evidence.signatureVerified !== 'boolean') {
      throw new Error('A GitHub identity record has invalid fields.');
    }
    out.set(sha, { authorLogin: evidence.authorLogin, signatureVerified: evidence.signatureVerified });
  }
  return out;
}

function authorName(name) {
  const label = name.toString('utf8').trim();
  return label.length <= 100 && /^[\p{L}\p{M}\p{N} ._’'-]+$/u.test(label)
    ? label : 'Undisplayed Git author';
}

/**
 * Audit immutable Git objects in a bare mirror created by a trusted operator.
 * Optional GitHub evidence must come from the caller's trusted GitHub API snapshot.
 */
export function auditContributions({ gitDir, base = null, head, githubIdentities = {} }) {
  if (!gitDir) throw new Error('Provide a trusted bare repository with --git-dir.');
  const git = (args, options) => gitCommand(resolve(gitDir), args, options);
  const gitText = (args, options) => git(args, options).toString('utf8').trim();
  if (gitText(['rev-parse', '--is-bare-repository']) !== 'true') {
    throw new Error('Audit requires a trusted bare Git repository.');
  }
  if (gitText(['rev-parse', '--is-shallow-repository']) !== 'false') {
    throw new Error('Audit requires complete history.');
  }
  const format = gitText(['rev-parse', '--show-object-format']);
  const formats = { sha1: /^[0-9a-f]{40}$/, sha256: /^[0-9a-f]{64}$/ };
  const objectId = formats[format];
  if (!objectId) throw new Error('Unsupported Git object format.');
  for (const oid of base === null ? [head] : [base, head]) {
    if (typeof oid !== 'string' || !objectId.test(oid) || gitText(['cat-file', '-t', oid]) !== 'commit') {
      throw new Error('Head and base must be full lowercase Git commit IDs.');
    }
  }
  if (base && git(['merge-base', '--is-ancestor', base, head], { acceptStatusOne: true }) === null) {
    throw new Error('Base must be an ancestor of head.');
  }
  const evidence = validateGithubIdentities(githubIdentities, objectId);
  const emptyTree = gitText(['hash-object', '-t', 'tree', '--stdin'], { input: '' });
  const revisions = gitText(['rev-list', '--parents', '--max-count=' + (maxCommits + 1),
    base ? base + '..' + head : head, '--']);
  const graph = revisions ? revisions.split('\n').map(line => line.split(' ')) : [];
  if (graph.length > maxCommits) throw new Error('Range exceeds the audit commit limit. Choose a narrower base.');
  graph.sort(([a], [b]) => sortStrings(a, b));

  const identities = new Map();
  const commits = [];
  const excludedMerges = [];
  const totals = { commits: 0, linesAdded: 0, linesDeleted: 0, codeFilesChanged: 0 };
  const register = (key, details) => {
    if (!identities.has(key)) {
      identities.set(key, {
        id: 'contributor-' + (identities.size + 1), ...details,
        commits: 0, linesAdded: 0, linesDeleted: 0, codeFilesChanged: 0,
      });
    }
    return identities.get(key);
  };

  for (const [sha, ...parents] of graph) {
    if (![sha, ...parents].every(id => objectId.test(id))) {
      throw new Error('Git returned an invalid commit graph.');
    }
    if (parents.length > 1) {
      excludedMerges.push({ sha, parentCount: parents.length });
      continue;
    }

    const meta = git(['show', '-s', '--no-show-signature', '--no-notes', '--encoding=UTF-8',
      '--format=format:%an%x00%ae%x00%(trailers:key=Agent-Author,valueonly,unfold=true,separator=%x00)', sha, '--']);
    const [name, email, ...trailers] = meta.toString('latin1').split('\0');
    if (email === undefined || !trailers.length) throw new Error('Git returned an incomplete author record.');
    const displayName = authorName(Buffer.from(name, 'latin1'));
    const githubEvidence = evidence.get(sha) ?? null;
    const login = githubEvidence?.authorLogin;
    const controller = login
      ? register('github:' + login.toLowerCase(), { kind: 'github-associated-author', label: login })
      : register('git:' + JSON.stringify([name, email]), { kind: 'git-author-header', label: displayName });
    const declaredAgent = trailers.length === 1 && agentLabel.test(trailers[0])
      ? trailers[0].toLowerCase() : null;
    const contributor = declaredAgent
      ? register('agent:' + controller.id + ':' + declaredAgent,
        { kind: 'declared-agent', label: declaredAgent, declaredBy: controller.id })
      : controller;
    const count = diffCounts(git([
      'diff-tree', '-r', '-z', '--raw', '--numstat', '--no-abbrev', '--no-commit-id',
      '--no-ext-diff', '--no-textconv', '--ignore-submodules=all', '--diff-filter=ADMR',
      '--diff-algorithm=myers', '--no-indent-heuristic', '--find-renames=50%', '-l1000',
      ...(parents.length ? [parents[0], sha] : ['--root', sha]), '--',
    ], { attrSource: emptyTree }));

    commits.push({
      sha, contributorId: contributor.id, authorId: controller.id,
      gitAuthor: displayName, githubEvidence, declaredAgent, ...count,
    });
    for (const aggregate of [contributor, totals]) {
      aggregate.commits++;
      aggregate.linesAdded += count.linesAdded;
      aggregate.linesDeleted += count.linesDeleted;
      aggregate.codeFilesChanged += count.codeFilesChanged;
    }
  }

  return {
    schemaVersion: 1,
    objectFormat: format,
    base,
    head,
    policy: {
      includesFileExtensions: [...sourceExtensions],
      includesBasenames: sourceBasenames,
      excludesDirectories: [...excludedDirectories],
      excludes: ['binary files', 'merge commits', 'symlinks', 'submodules', 'file type changes'],
    },
    totals,
    contributors: [...identities.values()],
    commits,
    excludedMerges,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: {
        'git-dir': { type: 'string' },
        base: { type: 'string' },
        head: { type: 'string' },
        'github-identities': { type: 'string' },
      },
    });
    const evidencePath = values['github-identities'];
    const githubIdentities = evidencePath ? JSON.parse(readFileSync(evidencePath, 'utf8')) : undefined;
    const report = auditContributions({
      gitDir: values['git-dir'], base: values.base, head: values.head, githubIdentities,
    });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (error) {
    process.stderr.write('Contribution audit: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
