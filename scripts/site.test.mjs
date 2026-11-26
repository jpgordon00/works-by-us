import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import worker from '../dist/server/index.js';

const origin = 'https://works.example';
const fetchSite = (path, options) => worker.fetch(new Request(origin + path, options));

async function rpc(method, params, headers = {}, id = 1) {
  return fetchSite('/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  });
}

test('catalog links resolve and category filtering and search agree', async () => {
  const catalog = await (await fetchSite('/api/problems')).json();
  assert.ok(catalog.categories.length >= 8);
  assert.ok(catalog.problems.length >= 22);
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
  assert.match(home, /codex mcp add works-by-us --url https:\/\/works\.example\/api\/mcp/);
  assert.match(home, /linkedin\.com\/in\/jacob-gordon-6ab482215/);
});

test('query parameters remain text, and a brief offers both contribution routes', async () => {
  const search = await (await fetchSite('/problems/?q=%3Cscript%3E')).text();
  assert.match(search, /&lt;script&gt;/);
  assert.doesNotMatch(search, /<script>/);
  const problem = await (await fetchSite('/problems/free-photoshop-alternative/')).text();
  assert.match(problem, /Copy problem brief/);
  assert.match(problem, /How to check it/);
  assert.match(problem, /https:\/\/github\.com\/jpgordon00\/works-by-us\/issues\/new/);
  const connect = await (await fetchSite('/connect/')).text();
  assert.match(connect, /codex mcp add works-by-us --url https:\/\/works\.example\/api\/mcp/);
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
  assert.equal(brief.url, origin + '/problems/' + problem.id + '/');
  assert.match(brief.brief, /Review criteria:/);
  assert.match(brief.sources[0].url, /adobe\.com\/products\/photoshop\.html$/);
  const draft = (await call('prepare_contribution', {
    id: problem.id, title: 'Synthetic fixture plan', summary: 'Compare the exported composite against a reference.', evidence: 'Record the pixel comparison and show reopen preserves layers.'
  })).structuredContent;
  assert.equal(draft.published, false);
  const url = new URL(draft.github_issue_url);
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.pathname, '/jpgordon00/works-by-us/issues/new');
  assert.equal(url.searchParams.get('body'), draft.body);
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
