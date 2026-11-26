import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { runWatchCommand } from './watch-run.mjs';

test('publisher protects its key and retries a lost response with the original sequence', async t => {
  const id = '78b8510b-c796-4e85-a227-50b34e52c407';
  const writeToken = 'example-write-token';
  const stateDir = await mkdtemp(join(tmpdir(), 'watch-publisher-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  let origin;
  let redirect = false;
  let followed = false;
  const received = [];
  const server = createServer(async (req, res) => {
    if (req.url === '/redirect-target') { followed = true; res.end(); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    if (req.url === '/api/watch/runs') {
      assert.deepEqual(data, { problemId: '3sat-to-clique' });
      res.end(JSON.stringify({ id, writeToken, watchUrl: origin + '/watch/' + id + '/' }));
      return;
    }
    assert.equal(req.url, '/api/watch/' + id + '/events');
    assert.equal(req.headers.authorization, 'Bearer ' + writeToken);
    if (redirect) {
      res.writeHead(307, { Location: '/redirect-target' }).end();
      return;
    }
    received.push(data);
    if (received.length === 1) { req.socket.destroy(); return; }
    res.end(JSON.stringify({ accepted: true, seq: data.seq }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  origin = 'http://127.0.0.1:' + server.address().port;
  const run = (...args) => runWatchCommand(args, { origin, stateDir });
  assert.equal(await run('start', '3sat-to-clique'), origin + '/watch/' + id + '/\n' + id);
  const privatePath = join(stateDir, id, 'publisher.json');
  assert.equal((await stat(join(stateDir, id))).mode & 0o777, 0o700);
  assert.equal((await stat(privatePath)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(privatePath, 'utf8')).writeToken, writeToken);
  await assert.rejects(run('step', id, 'Checked an edge', 'Two vertices are compatible.'), /not be confirmed/);
  await assert.rejects(run('finish', id, 'Done', 'The run finished.'), /different milestone is pending/);
  assert.equal(await run('retry', id), 'Posted milestone 1.');
  assert.equal(await run('step', id, 'Checked an edge', 'Two vertices are compatible.'), 'Milestone 1 already posted.');
  assert.deepEqual(received[0], received[1]);
  redirect = true;
  await assert.rejects(run('finish', id, 'Done', 'The run finished.'), /not be confirmed/);
  assert.equal(followed, false);
  redirect = false;
  assert.equal(await run('retry', id), 'Posted milestone 2.');
  assert.equal(received[2].seq, 2);
  assert.equal(received[2].status, 'completed');
  await assert.rejects(run('step', id, 'More work', 'This run already ended.'), /already ended/);
});
