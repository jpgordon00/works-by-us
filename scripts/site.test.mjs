import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import worker from '../dist/server/index.js';

const origin = 'https://works.example';
const canonical = 'https://works-by-us.jacob-gordon255689.chatgpt.site';
const catalog = await (await worker.fetch(new Request(origin + '/api/problems'))).json();
const projectEndpoint = id => '/api/mcp/projects/' + id;
const fetchSite = (path, options) => worker.fetch(new Request(origin + path, options));

async function rpc(method, params, headers = {}, id = 1, path = '/api/mcp') {
  return fetchSite(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
}

test('catalog links resolve and category filtering and search agree', async () => {
  const catalog = await (await fetchSite('/api/problems')).json();
  assert.ok(catalog.categories.length >= 9);
  assert.ok(catalog.problems.length >= 38);
  const paths = [...catalog.problems.map(p => '/problems/' + p.id + '/'), ...catalog.categories.map(c => '/categories/' + c.id + '/')];
  for (const path of paths) assert.equal((await fetchSite(path)).status, 200, path);
  const software = await (await fetchSite('/categories/software/?q=Photoshop')).text();
  assert.match(software, /aria-current="page">Software/);
  assert.match(software, /1 result for “Photoshop”/);
  assert.match(software, /Can a free browser editor preserve editable layers and masks\?/);
  assert.doesNotMatch(software, /Can a local budget app import two bank CSVs/);
  const softwareIndex = await (await fetchSite('/categories/software/')).text();
  assert.match(softwareIndex, /Photoshop alternative/);
  assert.match(softwareIndex, /Monarch Money alternative/);
  assert.match(softwareIndex, /Acrobat Pro alternative/);
  assert.equal((await fetchSite('/problems/unknown/')).status, 404);
});

test('P versus NP and GTA VI lead to checkable questions and repository starter material', async () => {
  const catalog = await (await fetchSite('/api/problems')).json();
  const byId = new Map(catalog.problems.map(problem => [problem.id, problem]));
  const math = byId.get('p-versus-np');
  const pc = byId.get('gta-vi-pc-release');
  assert.ok(math.related.includes('3sat-to-clique'));
  assert.ok(pc.related.includes('godot-msaa-pipeline-stutter'));
  assert.match(pc.context, /An official PC date and requirements remained unconfirmed/);
  for (const problem of catalog.problems) {
    assert.match(problem.title, /\?$/, problem.id);
    for (const id of problem.related ?? []) {
      assert.notEqual(id, problem.id);
      assert.ok(byId.has(id), problem.id + ' links to missing ' + id);
    }
    if (problem.starter) {
      assert.ok(problem.starter.title);
      assert.match(problem.starter.path, /^contributions\/[a-z0-9-]+\/README\.md$/);
      const file = await readFile(new URL('../' + problem.starter.path, import.meta.url), 'utf8');
      assert.match(file, /^# /);
    }
  }
  const pcSearch = await (await fetchSite('/categories/games/?q=GTA+6+PC')).text();
  assert.match(pcSearch, /href="\/problems\/gta-vi-pc-release\/"/);
  const robotics = catalog.problems.filter(problem => problem.category === 'robotics');
  assert.ok(robotics.length >= 3);
  assert.ok(robotics.some(problem => problem.id === 'mujoco-box-edge-contact' && problem.starter));
  const dataSearch = await (await fetchSite('/categories/data/?q=USGS+discharge')).text();
  assert.match(dataSearch, /href="\/problems\/usgs-daily-api-parity\/"/);
});

test('the homepage opens with P vs NP and leads directly to each featured research brief', async () => {
  const home = await (await fetchSite('/')).text();
  const hero = home.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero);
  assert.deepEqual([...hero.matchAll(/<a class="hero-project" href="([^"]+)"( hidden)?>([^<]+)<\/a>/g)]
    .map(([, href, hidden, text]) => [href, Boolean(hidden), text]), [
    ['/problems/p-versus-np/', false, 'Does P equal NP?'],
    ['/problems/collatz-conjecture/', true, 'Does every number reach 1?'],
    ['/problems/dark-matter/', true, 'What is dark matter?']
  ]);
  assert.match(hero, /data-featured-brief href="\/problems\/p-versus-np\/"/);
  assert.equal([...hero.matchAll(/data-introduction/g)].length, 3);
  assert.equal([...hero.matchAll(/data-slide=/g)].length, 3);
  const shelves = [...home.matchAll(/class="project-shelf category-([a-z]+)"/g)].map(([, id]) => id);
  assert.deepEqual(shelves.slice(0, 2), ['math', 'science']);
});

test('home shelves cover the full catalog and link the site sections and community actions', async () => {
  const home = await (await fetchSite('/')).text();
  const catalog = await (await fetchSite('/api/problems')).json();
  for (const project of catalog.problems) assert.ok(home.includes('href="/problems/' + project.id + '/"'));
  assert.match(home, /Build a free layered photo editor/);
  assert.match(home, /Build a free household budget app/);
  assert.match(home, /Compare two PDFs offline/);
  const photo = await fetchSite('/media/richat.jpg');
  assert.equal(photo.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual([...new Uint8Array(await photo.arrayBuffer()).slice(0, 3)], [255, 216, 255]);
  assert.match(home, /<details class="extra-shelves"/);
  for (const section of ['problems', 'how-it-works', 'about', 'mcp']) {
    assert.ok(home.includes('href="#' + section + '"') && home.includes('id="' + section + '"'));
  }
  assert.match(home, /<form[^>]+action="https:\/\/github\.com\/jpgordon00\/works-by-us\/issues\/new"[^>]+data-proposal/);
  assert.match(home, /name="template" value="problem.yml"/);
  assert.match(home, /<textarea[^>]+name="problem"[^>]+required/);
  assert.match(home, /What problem will you solve\?/);
  assert.match(home, /Suggest a problem/);
  assert.match(home, /href="#propose">Submit a problem/);
  assert.match(home, /label%3Aproblem-proposal%20sort%3Areactions-%2B1-desc/);
  assert.match(home, /codex mcp add works-by-us --url https:\/\/works-by-us\.jacob-gordon255689\.chatgpt\.site\/api\/mcp/);
  assert.match(home, /linkedin\.com\/in\/jacob-gordon-6ab482215/);
});

test('query parameters remain text, and a brief offers both contribution routes', async () => {
  const search = await (await fetchSite('/problems/?q=%3Cscript%3E')).text();
  assert.match(search, /&lt;script&gt;/);
  assert.doesNotMatch(search, /<script>/);
  const problem = await (await fetchSite('/problems/free-photoshop-alternative/')).text();
  assert.match(problem, /Copy prompt for ChatGPT/);
  assert.match(problem, /How to check it/);
  assert.match(problem, /https:\/\/github\.com\/jpgordon00\/ci-free-photoshop-alternative\/issues\/new/);
  const connect = await (await fetchSite('/connect/')).text();
  assert.match(connect, /codex mcp add works-by-us --url https:\/\/works-by-us\.jacob-gordon255689\.chatgpt\.site\/api\/mcp/);
});

test('MCP modern discovery and legacy negotiation expose the same four tools', async () => {
  const version = '2026-07-28';
  const meta = { 'io.modelcontextprotocol/protocolVersion': version };
  const discover = await (await rpc('server/discover', { _meta: meta }, {
    'Mcp-Protocol-Version': version, 'Mcp-Method': 'server/discover'
  })).json();
  assert.deepEqual(discover.result.supportedVersions, [version]);
  assert.equal(discover.result.resultType, 'complete');
  assert.equal(discover.result._meta['io.modelcontextprotocol/serverInfo'].name, 'works-by-us');
  const modernListing = await (await rpc('tools/list', { _meta: meta }, {
    'Mcp-Protocol-Version': version, 'Mcp-Method': 'tools/list'
  })).json();
  assert.equal(modernListing.result.cacheScope, 'public');
  assert.ok(modernListing.result.ttlMs > 0);
  const legacy = await (await rpc('initialize', { protocolVersion: '2025-06-18' })).json();
  assert.equal(legacy.result.protocolVersion, '2025-06-18');
  const listing = await (await rpc('tools/list')).json();
  assert.deepEqual(listing.result.tools.map(tool => tool.name), [
    'list_categories', 'list_problems', 'get_problem', 'prepare_contribution'
  ]);
  const notification = await fetchSite('/api/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  });
  assert.equal(notification.status, 202);
});

test('MCP searches, reads sourced briefs and creates a preview-only GitHub draft', async () => {
  const call = async (name, args) => (await (await rpc('tools/call', { name, arguments: args })).json()).result;
  const search = await call('list_problems', { category: 'software', query: 'Photoshop' });
  const [problem] = search.structuredContent.problems;
  assert.equal(search.structuredContent.problems.length, 1);
  assert.equal(problem.id, 'free-photoshop-alternative');
  const brief = (await call('get_problem', { id: problem.id })).structuredContent.problem;
  assert.equal(brief.url, canonical + '/problems/' + problem.id + '/');
  assert.match(brief.brief, /Review criteria:/);
  assert.match(brief.sources[0].url, /adobe\.com\/products\/photoshop\.html$/);
  const draft = (await call('prepare_contribution', {
    id: problem.id, title: 'Synthetic fixture plan', summary: 'Compare the exported composite against a reference.', evidence: 'Record the pixel comparison and show reopen preserves layers.'
  })).structuredContent;
  assert.equal(draft.published, false);
  const url = new URL(draft.github_issue_url);
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.pathname, '/jpgordon00/ci-free-photoshop-alternative/issues/new');
  assert.equal(url.search, '');
  assert.match(draft.body, /    Compare the exported composite against a reference\./);
  assert.equal((await call('list_problems', { category: 'invalid' })).isError, true);
  assert.equal((await call('get_problem', { id: 'missing' })).isError, true);
});

test('MCP bounds request size and validates origin, media type and methods', async () => {
  assert.equal((await rpc('tools/list', {}, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await fetchSite('/api/mcp')).status, 405);
  assert.equal((await rpc('tools/list', {}, { 'Content-Type': 'application/jsonx' })).status, 415);
  assert.equal((await rpc('tools/list', { oversized: 'a'.repeat(16001) })).status, 413);
  assert.equal((await rpc('tools/list', {}, { 'Mcp-Method': 'tools/call' })).status, 400);
  const unsupported = await rpc('tools/list', {}, { 'Mcp-Protocol-Version': '1900-01-01' });
  assert.equal(unsupported.status, 400);
  assert.equal((await unsupported.json()).error.code, -32022);
  const missingHeaders = await rpc('server/discover');
  assert.equal(missingHeaders.status, 400);
  assert.equal((await missingHeaders.json()).error.code, -32020);
});

async function callAt(path, name, args, headers) {
  const response = await rpc('tools/call', { name, arguments: args }, headers, 1, path);
  assert.equal(response.status, 200);
  return (await response.json()).result;
}

for (const problem of catalog.problems) {
  test('project connects and stays within its scope: ' + problem.id, async () => {
    const path = projectEndpoint(problem.id);
    const page = await (await fetchSite('/problems/' + problem.id + '/')).text();
    assert.ok(page.includes('href="' + problem.repository + '"'));
    assert.ok(page.includes('href="' + problem.repository + '/issues/new"'));
    assert.ok(page.includes('href="' + problem.repository + '/issues"'));
    assert.ok(page.includes('href="' + problem.repository + '/pulls"'));
    const claude = new URL(page.match(/href="(claude:\/\/[^"]+)"/)[1]);
    assert.equal(claude.protocol, 'claude:');
    assert.equal(claude.host, 'claude.ai');
    assert.equal(claude.pathname, '/new');
    assert.ok(claude.searchParams.get('q').includes(problem.url));
    assert.ok(claude.searchParams.get('q').includes(problem.repository));
    assert.match(page, /href="https:\/\/chatgpt\.com\//);
    assert.ok(page.includes('href="/connect/?project=' + problem.id + '"'));
    assert.match(page, /Project seed/);
    if (problem.starter) {
      const starter = new URL(problem.starter_url);
      assert.equal(starter.origin, 'https://github.com');
      assert.match(starter.pathname, /^\/jpgordon00\/works-by-us\/blob\/(?:[0-9a-f]{40}|main)\//);
      assert.ok(starter.pathname.endsWith('/' + problem.starter.path));
      assert.ok(page.includes(problem.starter_url));
    }
    const setup = await (await fetchSite('/connect/?project=' + problem.id)).text();
    assert.ok(setup.includes('value="' + canonical + path + '"'));
    const ledger = await (await fetchSite('/api/problems/' + problem.id + '/contributions')).json();
    assert.equal(ledger.seed.commit, problem.seed);
    const categories = await callAt(path, 'list_categories', {});
    assert.deepEqual(categories.structuredContent.categories.map(x => [x.id, x.count]), [[problem.category, 1]]);
    const list = await callAt(path, 'list_problems', {});
    assert.deepEqual(list.structuredContent.problems.map(x => x.id), [problem.id]);
    const detail = await callAt(path, 'get_problem', { id: problem.id });
    assert.equal(detail.structuredContent.problem.repository, problem.repository);
    assert.equal(detail.structuredContent.problem.open_work_url, problem.repository + '/issues');
    assert.equal(detail.structuredContent.problem.review_queue_url, problem.repository + '/pulls');
    if (problem.workroom_issue) {
      const workroom = problem.repository + '/issues/' + problem.workroom_issue;
      assert.ok(page.includes('href="' + workroom + '"'));
      assert.equal(detail.structuredContent.problem.workroom_url, workroom);
      assert.ok(detail.structuredContent.problem.brief.includes(workroom));
    }
    assert.equal(detail.structuredContent.problem.mcp_url, canonical + path);
    assert.equal(detail.structuredContent.problem.contributions_url, canonical + '/api/problems/' + problem.id + '/contributions');
    const second = catalog.problems.find(candidate => candidate.id !== problem.id);
    assert.equal((await callAt(path, 'get_problem', { id: second.id })).isError, true);
    assert.equal((await callAt(path, 'prepare_contribution', {
      id: second.id, title: 'Draft', summary: 'Evidence', evidence: 'A public source'
    })).isError, true);
    const draft = await callAt(path, 'prepare_contribution', { id: problem.id, title: 'Draft', summary: 'Evidence', evidence: 'A public source' });
    assert.equal(draft.structuredContent.github_issue_url, problem.repository + '/issues/new');
  });
}

test('unknown scopes fail closed and main aliases expose only read tools', async () => {
  assert.equal((await rpc('tools/list', {}, {}, 1, projectEndpoint('not-a-project'))).status, 404);
  assert.equal((await fetchSite('/api/problems/not-a-project/contributions')).status, 404);
  for (const endpoint of ['/mcp', '/api/mcp', projectEndpoint(catalog.problems[0].id)]) {
    const listing = await (await rpc('tools/list', {}, {}, 1, endpoint)).json();
    assert.ok(listing.result.tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
    const result = await callAt(endpoint, 'publish_contribution', {});
    assert.equal(result.isError, true);
  }
});

test('draft data stays plain text and outside URLs, with stable public origin', async () => {
  const id = catalog.problems[0].id;
  const evidence = '# Synthetic result\n@example-reviewer & https://example.com/markers';
  const result = await callAt('/api/mcp', 'prepare_contribution', {
    id, title: 'Test route', summary: 'Plain notes', evidence
  }, { 'X-Forwarded-Host': 'untrusted.example' });
  const draft = result.structuredContent;
  assert.match(draft.body, /    # Synthetic result\n    @example-reviewer/);
  assert.ok(draft.body.includes(canonical + '/problems/' + id + '/'));
  assert.ok(!draft.body.includes(origin));
  assert.equal(draft.github_issue_url, 'https://github.com/jpgordon00/ci-' + id + '/issues/new');
  assert.equal(draft.published, false);
  assert.ok(!draft.github_issue_url.includes('example'));
});

test('MCP rejects malformed tool arguments, non-text, and untrusted routing overrides', async () => {
  const id = catalog.problems[0].id;
  for (const args of [null, [], { id, extra: 'strict' }, { id: false }, { id: 'a'.repeat(101) }]) {
    assert.equal((await callAt('/api/mcp', 'get_problem', args)).isError, true);
  }
  const malformed = await fetchSite('/api/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([0x22, 0xff, 0x22])
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, -32700);
  const draft = await callAt('/api/mcp', 'prepare_contribution', {
    id, title: 'Hidden character \u202e', summary: 'Plain description', evidence: 'Public fixture'
  });
  assert.equal(draft.isError, true);
  assert.equal((await rpc('tools/call', { name: 'get_problem', arguments: { id } }, { 'Mcp-Name': 'list_problems' })).status, 400);
});

test('RPC treats a forged request origin and malformed correlation ID as invalid', async () => {
  const competingOrigin = await rpc('tools/list', {}, { Origin: origin });
  assert.equal(competingOrigin.status, 403);
  const badId = await rpc('tools/list', {}, {}, { unusual: 'value' });
  assert.equal(badId.status, 400);
  assert.equal((await badId.json()).id, null);
  const modernVersion = '2026-07-28';
  const unknown = await rpc('unknown/method', { _meta: { 'io.modelcontextprotocol/protocolVersion': modernVersion } }, {
    'Mcp-Protocol-Version': modernVersion, 'Mcp-Method': 'unknown/method'
  });
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error.code, -32601);
});
