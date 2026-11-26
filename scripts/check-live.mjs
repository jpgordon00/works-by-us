import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const site = 'https://crowdsourced.si';
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const registry = JSON.parse(await readFile(new URL('../src/project-repositories.json', import.meta.url)));
const ledger = JSON.parse(await readFile(new URL('../src/contribution-ledger.json', import.meta.url)));
const workrooms = JSON.parse(await readFile(new URL('../src/project-workrooms.json', import.meta.url)));
const protocolVersion = '2026-07-28';
const protocolKey = 'io.modelcontextprotocol/protocolVersion';

async function request(path, options) {
  const response = await fetch(site + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get('x-works-by-us-revision'), revision, path + ' revision');
  return response;
}

async function rpc(path, method, params) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
    'Mcp-Protocol-Version': protocolVersion, 'Mcp-Method': method };
  if (params?.name) headers['Mcp-Name'] = params.name;
  const response = await request(path, {
    method: 'POST', headers, body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: { [protocolKey]: protocolVersion } }
    })
  });
  const payload = await response.json();
  assert.equal(payload.result?.resultType, 'complete', path + ' ' + method);
  return payload.result;
}

const { problems } = await (await request('/api/problems')).json();
assert.deepEqual(problems.map(problem => problem.id).sort(), Object.keys(registry).sort());
const discovery = await rpc('/api/mcp', 'server/discover');
assert.deepEqual(discovery.supportedVersions, [protocolVersion]);
const legacy = await (await request('/api/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'project-smoke', version: '1' }
  } })
})).json();
assert.equal(legacy.result.protocolVersion, '2025-06-18');
const projectList = await rpc('/api/mcp', 'tools/call', { name: 'list_problems' });
assert.equal(projectList.structuredContent.problems.length, problems.length);
for (let i = 0; i < problems.length; i += 4) {
  await Promise.all(problems.slice(i, i + 4).map(async ({ id }) => {
    const path = '/api/mcp/projects/' + id;
    const result = await rpc(path, 'tools/call', { name: 'get_problem', arguments: { id } });
    assert.equal(result.structuredContent.problem.repository, registry[id].repository, id);
    assert.equal(result.structuredContent.problem.mcp_url, site + path, id);
    const miss = problems.find(problem => problem.id !== id);
    const outside = await rpc(path, 'tools/call', { name: 'get_problem', arguments: { id: miss.id } });
    assert.equal(outside.isError, true, id + ' project isolation');
    const draft = await rpc(path, 'tools/call', { name: 'prepare_contribution', arguments: {
      id, title: 'Connectivity check', summary: 'A synthetic local draft.', evidence: 'No GitHub write.'
    } });
    assert.equal(draft.structuredContent.published, false);
    assert.equal(draft.structuredContent.github_issue_url, registry[id].repository + '/issues/new');
    const receipt = await (await request('/api/problems/' + id + '/contributions')).json();
    assert.deepEqual(receipt, ledger[id]);
    const page = await (await request('/problems/' + id + '/')).text();
    assert.ok(page.includes('href="' + registry[id].repository + '"'));
    assert.ok(page.includes('aria-controls="work-on-this"'));
    for (const base of ['claude://claude.ai/new?q=', 'codex://threads/new?prompt=',
      'https://claude.ai/new?q=', 'https://chatgpt.com/?prompt=']) {
      assert.ok(page.includes(base), id + ' handoff ' + base);
    }
    if (workrooms[id]) {
      const url = registry[id].repository + '/issues/' + workrooms[id];
      assert.equal(result.structuredContent.problem.workroom_url, url);
      assert.ok(page.includes('href="' + url + '"'));
    }
  }));
}
console.log('Live site, shared MCP, scoped MCP and GitHub receipt links verified for all ' + problems.length + ' projects at ' + revision);
