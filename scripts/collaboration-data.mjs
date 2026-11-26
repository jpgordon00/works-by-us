const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sha = /^[0-9a-f]{40}$/;
const login = /^[a-z0-9](?:[a-z0-9-]{0,38})(?:\[bot\])?$/i;
const unsafeText = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const disclosurePath = /^contributions\/[a-z0-9-]+\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const starterPath = /^contributions\/[a-z0-9-]+\/README\.md$/;
const githubOwner = 'https://github.com/jpgordon00/';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isSha = value => typeof value === 'string' && sha.test(value);
const isText = (value, max) => typeof value === 'string' && value.trim().length > 0
  && value.length <= max && !unsafeText.test(value) && String.prototype.toWellFormed.call(value) === value;

function isSource(source) {
  if (!isRecord(source) || !isText(source.title, 240) || !isText(source.url, 1500)) return false;
  try {
    const url = new URL(source.url);
    return source.url.startsWith('https://') && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

function hasExactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

function isAccount(value) {
  return value === null || (hasExactKeys(value, ['id', 'login', 'type'])
    && Number.isSafeInteger(value.id) && value.id > 0
    && typeof value.login === 'string' && login.test(value.login)
    && ['User', 'Bot', 'Organization', 'Mannequin'].includes(value.type));
}

const totalsValid = value => [value.additions, value.deletions].every(count => Number.isSafeInteger(count) && count >= 0);
const provenanceKeys = ['github_account', 'additions', 'deletions'];

function validateDisclosures(disclosures, id, maxAdditions, paths) {
  if (!Array.isArray(disclosures) || !disclosures.length || disclosures.length > 10) {
    throw new Error('Invalid starter disclosures for ' + id);
  }
  let additions = 0;
  for (const item of disclosures) {
    if (!hasExactKeys(item, ['agent', 'work', 'source_commit', 'paths', 'additions', 'deletions'])
        || !isText(item.agent, 100) || !isText(item.work, 300) || !isSha(item.source_commit) || !totalsValid(item)
        || item.deletions !== 0 || !Array.isArray(item.paths) || !item.paths.length || item.paths.length > 20) {
      throw new Error('Invalid seed disclosure for ' + id);
    }
    for (const path of item.paths) {
      if (typeof path !== 'string' || !disclosurePath.test(path) || paths.has(path)) {
        throw new Error('Invalid or double-counted seed disclosure path for ' + id);
      }
      paths.add(path);
    }
    additions += item.additions;
    if (!Number.isSafeInteger(additions) || additions > maxAdditions) throw new Error('Disclosures exceed source lines for ' + id);
  }
}

function validateLedger(ledger, seed, id) {
  const ledgerKeys = ['seed', 'receipts'];
  const optionalKeys = ['seed_disclosures', 'hub_starter_disclosures'];
  if (isRecord(ledger)) ledgerKeys.push(...optionalKeys.filter(field => Object.hasOwn(ledger, field)));
  if (!hasExactKeys(ledger, ledgerKeys)
      || !hasExactKeys(ledger.seed, ['commit', ...provenanceKeys])
      || ledger.seed.commit !== seed || !isAccount(ledger.seed.github_account) || !totalsValid(ledger.seed)
      || !Array.isArray(ledger.receipts)) throw new Error('Invalid contribution ledger for ' + id);
  const disclosurePaths = new Set();
  for (const field of optionalKeys) {
    if (ledgerKeys.includes(field)) {
      const maxAdditions = field === 'seed_disclosures' ? ledger.seed.additions : Number.MAX_SAFE_INTEGER;
      validateDisclosures(ledger[field], id, maxAdditions, disclosurePaths);
    }
  }
  const numbers = new Set();
  const merges = new Set([seed]);
  for (const receipt of ledger.receipts) {
    if (!hasExactKeys(receipt, ['number', 'merge_commit', 'head', ...provenanceKeys])
        || !Number.isSafeInteger(receipt.number) || receipt.number <= 0 || numbers.has(receipt.number)
        || !isSha(receipt.merge_commit) || merges.has(receipt.merge_commit) || !isSha(receipt.head)
        || !isAccount(receipt.github_account) || !totalsValid(receipt)) throw new Error('Invalid contribution receipt for ' + id);
    numbers.add(receipt.number);
    merges.add(receipt.merge_commit);
  }
}

export function attachCollaborationData(catalog, repositories, ledgers, workrooms = {}) {
  const categoryIds = new Set();
  const ids = new Set();
  for (const category of catalog.categories) {
    if (typeof category.id !== 'string' || !slug.test(category.id) || categoryIds.has(category.id)
        || !isText(category.title, 160) || !isText(category.description, 1200)) throw new Error('Invalid or duplicate category');
    categoryIds.add(category.id);
  }
  for (const problem of catalog.problems) {
    if (typeof problem.id !== 'string' || problem.id.length > 80 || !slug.test(problem.id) || ids.has(problem.id)) {
      throw new Error('Invalid or duplicate problem ID');
    }
    if (!categoryIds.has(problem.category)) throw new Error('Unknown category for ' + problem.id);
    for (const field of ['title', 'summary', 'context', 'task', 'review', 'kind']) {
      if (!isText(problem[field], 1800)) throw new Error('Invalid ' + field + ' for ' + problem.id);
    }
    if (problem.track !== undefined && !isText(problem.track, 150)) throw new Error('Invalid track for ' + problem.id);
    if (problem.keywords !== undefined && (!Array.isArray(problem.keywords)
        || !problem.keywords.every(keyword => isText(keyword, 100)))) throw new Error('Invalid keywords for ' + problem.id);
    if (!Array.isArray(problem.sources) || !problem.sources.length || problem.sources.length > 8
        || !problem.sources.every(isSource)) throw new Error('Expected trusted HTTPS source links for ' + problem.id);
    if (problem.starter !== undefined && (!hasExactKeys(problem.starter, ['title', 'path'])
        || !isText(problem.starter.title, 150) || !starterPath.test(problem.starter.path))) {
      throw new Error('Invalid starter for ' + problem.id);
    }
    ids.add(problem.id);
  }
  if (!ids.has(catalog.featured)) throw new Error('The featured problem is missing');
  if (!hasExactKeys(repositories, [...ids]) || !hasExactKeys(ledgers, [...ids])) {
    throw new Error('Every catalog problem requires exactly one verified repository and contribution ledger');
  }
  if (!isRecord(workrooms) || Object.entries(workrooms).some(([id, issue]) =>
    !ids.has(id) || !Number.isSafeInteger(issue) || issue <= 0)) throw new Error('Invalid project workroom mapping');
  const problems = catalog.problems.map(problem => {
    const { id, related } = problem;
    if (related !== undefined && (!Array.isArray(related) || new Set(related).size !== related.length
        || related.some(item => item === id || !ids.has(item)))) throw new Error('Invalid related problems for ' + id);
    const entry = repositories[id];
    if (!hasExactKeys(entry, ['repository', 'seed']) || entry.repository !== githubOwner + 'ci-' + id || !isSha(entry.seed)) {
      throw new Error('Invalid dedicated repository for ' + id);
    }
    validateLedger(ledgers[id], entry.seed, id);
    return {
      ...problem, repository: entry.repository, seed: entry.seed,
      ...(Object.hasOwn(workrooms, id) ? { workroom_issue: workrooms[id] } : {})
    };
  });
  return { ...catalog, problems };
}
