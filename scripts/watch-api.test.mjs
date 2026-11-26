import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../dist/server/index.js';
import { openPreviewDatabase } from './preview-db.mjs';

const origin = 'https://watch.example';
function client() {
  const DB = openPreviewDatabase();
  const pending = [];
  function call(path, method = 'GET', body, headers = {}) {
    return worker.fetch(new Request(origin + path, {
      method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      headers: { 'content-type': 'application/json', ...headers }
    }), { DB }, { waitUntil(promise) { pending.push(promise); } });
  }
  function start(headers) {
    return call('/api/watch/runs', 'POST', { problemId: '3sat-to-clique' }, headers);
  }
  return { DB, pending, call, start };
}

test('external progress is public, ordered and unchanged when identical publications are retried', async () => {
  const { call, start } = client();
  const created = await start();
  assert.equal(created.status, 201);
  const { id, watchUrl, writeToken } = await created.json();
  assert.equal(watchUrl, origin + '/watch/' + id + '/');
  const path = '/api/watch/' + id;
  const headers = { authorization: 'Bearer ' + writeToken };
  const publish = event => call(path + '/events', 'POST', event, headers);
  const first = { seq: 1, phase: 'work', title: 'Read the brief', detail: 'Reviewed four clauses.' };
  const done = { ...first, seq: 2, status: 'completed', phase: 'verify' };
  assert.equal((await call(path + '/events', 'POST', first)).status, 401);
  assert.equal((await call(path + '/events', 'POST', first, { authorization: 'Bearer ' + 'a'.repeat(72) })).status, 403);
  assert.equal((await publish(done)).status, 409);
  const same = await Promise.all([publish(first), publish(first)]);
  assert.deepEqual(same.map(result => result.status).sort(), [200, 201]);
  assert.equal((await publish({ ...first, title: 'Conflicting first event' })).status, 409);
  assert.equal((await publish(done)).status, 201);
  assert.equal((await publish(first)).status, 200);
  assert.equal((await publish(done)).status, 200);
  assert.equal((await publish({ ...done, status: 'failed' })).status, 409);
  assert.equal((await publish({ ...first, seq: 3 })).status, 409);
  const viewer = await call(path);
  assert.match(viewer.headers.get('cache-control'), /no-store/);
  const snapshot = await viewer.json();
  assert.equal(snapshot.status, 'completed');
  assert.equal(snapshot.kind, 'agent');
  assert.deepEqual(snapshot.events.map(event => event.seq), [1, 2]);
  assert.ok(snapshot.events.every(event => Number.isFinite(Date.parse(event.at))));
  assert.doesNotMatch(JSON.stringify(snapshot), /writeToken|write_hash|creator_bucket/);
  assert.ok(!JSON.stringify(snapshot).includes(writeToken));
});

test('creation caps are atomic, inactive agents can resume, and input is bounded', async () => {
  const { call, start, DB } = client();
  const attempts = await Promise.all([start(), start(), start(), start()]);
  assert.deepEqual(attempts.map(r => r.status).sort(), [201, 201, 201, 429]);
  const { id, writeToken } = await attempts.find(r => r.status === 201).json();
  const path = '/api/watch/' + id;
  DB.prepare('UPDATE watch_runs SET updated_at = ? WHERE id = ?').bind(Date.now() - 31 * 60000, id).run();
  assert.equal((await (await call(path)).json()).status, 'stale');
  const fourth = await start();
  assert.equal(fourth.status, 201);
  const headers = { authorization: 'Bearer ' + writeToken };
  const step = { seq: 1, phase: 'work', title: 'Resumed', detail: 'Checked the next case.' };
  assert.equal((await call(path + '/events', 'POST', step, headers)).status, 429);
  DB.prepare("UPDATE watch_runs SET status = 'failed' WHERE id = ?").bind((await fourth.json()).id).run();
  assert.equal((await call(path + '/events', 'POST', step, headers)).status, 201);
  assert.equal((await (await call(path)).json()).status, 'running');
  assert.equal((await call(path + '/events', 'POST', { ...step, detail: 'x'.repeat(501) }, headers)).status, 400);
  assert.equal((await call(path + '/events', 'POST', { ...step, seq: 64 }, headers)).status, 400);
  assert.equal((await call('/api/watch/runs', 'POST', { problemId: 'x'.repeat(4096) })).status, 413);
  assert.equal((await call('/api/watch/runs', 'POST', { problemId: 'unknown' })).status, 400);
  assert.equal((await start({ origin: 'https://other.example' })).status, 403);
  assert.equal((await call('/api/watch/runs')).status, 405);
  assert.equal((await worker.fetch(new Request(origin + path))).status, 503);
});

test('an empty browser form starts a solver, two readers see the same real intermediate and final events', async t => {
  const { DB, pending, call } = client();
  // Advance just the solver timer so this integration test need not spend 16 seconds sleeping.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const created = await worker.fetch(new Request(origin + '/watch/start', {
    method: 'POST', body: new URLSearchParams()
  }), { DB }, { waitUntil(promise) { pending.push(promise); } });
  assert.equal(created.status, 303);
  const id = new URL(created.headers.get('location')).pathname.split('/')[2];
  const path = '/api/watch/' + id;
  const first = await (await call(path)).json();
  assert.equal(first.kind, 'solver');
  assert.equal(first.status, 'running');
  assert.equal(first.events.length, 1);
  for (let i = 1; i < 19; i++) {
    t.mock.timers.tick(900);
    await new Promise(resolve => setImmediate(resolve));
    if (i === 7) {
      const snapshots = await Promise.all([call(path), call(path)]);
      const [a, b] = await Promise.all(snapshots.map(r => r.json()));
      assert.deepEqual(a, b);
      assert.equal(a.events.length, 8);
      assert.equal(a.events.at(-1).frame.seq, 8);
    }
  }
  await pending[0];
  const result = await (await call(path)).json();
  assert.equal(result.status, 'completed');
  assert.equal(result.events.length, 19);
  assert.equal(result.events.at(-1).phase, 'complete');
  assert.ok(result.events.at(-1).frame.checks.every(check => check.passed));
});

test('independent publishers share the global creation cap and an interrupted solver goes stale', async () => {
  const { DB, start, call } = client();
  const attempts = await Promise.all(Array.from({ length: 33 }, (_, i) => start({ 'CF-Connecting-IP': '2001:db8::' + i })));
  assert.equal(attempts.filter(response => response.status === 201).length, 32);
  assert.equal(attempts.filter(response => response.status === 429).length, 1);
  const { id } = await attempts.find(response => response.status === 201).json();
  DB.prepare("UPDATE watch_runs SET kind = 'solver', updated_at = ? WHERE id = ?").bind(Date.now() - 121_000, id).run();
  assert.equal((await (await call('/api/watch/' + id)).json()).status, 'stale');
  assert.equal((await start({ 'CF-Connecting-IP': '2001:db8::33' })).status, 201);
});
