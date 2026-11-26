// Public readers know the run ID. Only an external publisher receives the write token.
const watchIdSegment = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const watchApiRunPath = new RegExp('^/api/watch/(' + watchIdSegment + ')(/events)?$');
const watchMaxEvents = 64;
const watchSolverIdleMs = 120_000;
const watchAgentIdleMs = 1_800_000;
const watchActiveWhere = "status = 'running' AND updated_at > ? AND (kind = 'agent' OR updated_at > ?)";
const watchGlobalRoom = '(SELECT count(*) FROM watch_runs WHERE ' + watchActiveWhere + ') < 32';
const watchCreatorRoom = '(SELECT count(*) FROM watch_runs WHERE creator_bucket = ? AND ' + watchActiveWhere + ') < 3';

class WatchRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function watchResponse(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff', ...extra
  } });
}

async function readWatchBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
    throw new WatchRequestError(415, 'Use application/json.');
  }
  const limit = 4096;
  if (Number(request.headers.get('content-length')) > limit) throw new WatchRequestError(413, 'Body too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new WatchRequestError(400, 'A JSON object is required.');
  const buffer = new Uint8Array(limit);
  let count = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (count + value.length > limit) {
      await reader.cancel();
      throw new WatchRequestError(413, 'Body too large.');
    }
    buffer.set(value, count);
    count += value.length;
  }
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, count))); }
  catch { throw new WatchRequestError(400, 'Invalid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new WatchRequestError(400, 'A JSON object is required.');
  return data;
}

async function watchDigest(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function effectiveWatchStatus(row, now = Date.now()) {
  if (row.status !== 'running') return row.status;
  const timeout = row.kind === 'solver' ? watchSolverIdleMs : watchAgentIdleMs;
  return now - row.updated_at >= timeout ? 'stale' : 'running';
}

export async function getWatchRun(db, id) {
  const row = await db.prepare(
    'SELECT id, problem_id, kind, started_at, updated_at, status, events FROM watch_runs WHERE id = ?'
  ).bind(id).first();
  if (!row) return null;
  return {
    id: row.id, problemId: row.problem_id, kind: row.kind, status: effectiveWatchStatus(row),
    startedAt: new Date(row.started_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    events: JSON.parse(row.events)
  };
}

async function createWatchRun(db, request, problemId, kind) {
  const id = crypto.randomUUID();
  const writeToken = kind === 'agent' ? crypto.randomUUID() + crypto.randomUUID() : null;
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const bucket = await watchDigest(day + ':' + (request.headers.get('CF-Connecting-IP') || 'shared'));
  const writeHash = writeToken && await watchDigest(writeToken);
  // Each INSERT checks both quotas in the same write transaction, including concurrent starts.
  const result = await db.prepare(
    'INSERT INTO watch_runs (id, problem_id, kind, creator_bucket, write_hash, started_at, updated_at) ' +
    'SELECT ?, ?, ?, ?, ?, ?, ? ' +
    'WHERE (SELECT count(*) FROM watch_runs WHERE started_at >= ?) < 120 ' +
    'AND (SELECT count(*) FROM watch_runs WHERE started_at >= ? AND creator_bucket = ?) < 15 ' +
    'AND ' + watchGlobalRoom + ' AND ' + watchCreatorRoom
  ).bind(id, problemId, kind, bucket, writeHash, now, now,
    now - 3_600_000, now - 3_600_000, bucket, now - watchAgentIdleMs, now - watchSolverIdleMs,
    bucket, now - watchAgentIdleMs, now - watchSolverIdleMs).run();
  if (!result.meta.changes) throw new WatchRequestError(429, 'Too many watch runs. Try again later.');
  return { id, writeToken };
}

async function recordWatchEvent(db, id, event, status, tokenHash, kind) {
  const now = Date.now();
  const at = new Date(now).toISOString();
  // A quiet agent may resume once there is room. Closing a quiet run needs no active slot.
  let lifecycle = '';
  let params = [];
  if (kind === 'solver') {
    lifecycle = ' AND updated_at > ?';
    params = [now - watchSolverIdleMs];
  } else if (status === 'running') {
    lifecycle = ' AND (updated_at > ? OR (' + watchGlobalRoom +
      ' AND (SELECT count(*) FROM watch_runs AS active WHERE active.creator_bucket = target.creator_bucket AND ' + watchActiveWhere + ') < 3))';
    params = [now - watchAgentIdleMs, now - watchAgentIdleMs, now - watchSolverIdleMs, now - watchAgentIdleMs, now - watchSolverIdleMs];
  }
  // Compare-and-swap prevents a second writer from closing or reordering a run.
  const result = await db.prepare(
    "UPDATE watch_runs AS target SET events = json_insert(events, '$[#]', json(?)), updated_at = ?, last_seq = ?, status = ? " +
    "WHERE id = ? AND kind = ? AND write_hash IS ? AND last_seq = ? AND status = 'running'" + lifecycle
  ).bind(JSON.stringify({ ...event, at }), now, event.seq, status, id, kind, tokenHash, event.seq - 1, ...params).run();
  return Boolean(result.meta.changes);
}

function readWatchEvent(raw) {
  if (Object.keys(raw).some(key => !['seq', 'phase', 'title', 'detail', 'status'].includes(key))) {
    throw new WatchRequestError(400, 'Unknown event field.');
  }
  const { seq, phase, title, detail, status } = raw;
  if (!Number.isSafeInteger(seq) || seq < 1 || seq > watchMaxEvents ||
      (Object.hasOwn(raw, 'status') && !['completed', 'failed'].includes(status))) {
    throw new WatchRequestError(400, 'Invalid sequence or terminal status.');
  }
  if (seq === watchMaxEvents && !status) throw new WatchRequestError(400, 'The final event must close the run.');
  const event = { seq };
  for (const [field, value, max] of [['phase', phase, 40], ['title', title, 100], ['detail', detail, 500]]) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
      throw new WatchRequestError(400, 'Invalid ' + field + '.');
    }
    event[field] = value.trim();
  }
  return { event, status: status ?? 'running' };
}

async function publishWatchEvent(db, id, request) {
  const token = /^Bearer ([a-f0-9-]{72})$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) throw new WatchRequestError(401, 'Supply the run write token as a bearer credential.');
  const tokenHash = await watchDigest(token);
  const { event, status } = readWatchEvent(await readWatchBody(request));
  if (await recordWatchEvent(db, id, event, status, tokenHash, 'agent')) {
    return watchResponse({ seq: event.seq, accepted: true }, 201);
  }
  const row = await db.prepare(
    "SELECT kind, updated_at, last_seq, status, events FROM watch_runs WHERE id = ? AND kind = 'agent' AND write_hash = ?"
  ).bind(id, tokenHash).first();
  if (!row) throw new WatchRequestError(403, 'Invalid run or write token.');
  const old = JSON.parse(row.events)[event.seq - 1];
  const priorStatus = event.seq === row.last_seq ? row.status : 'running';
  if (old && priorStatus === status && Object.entries(event).every(([key, value]) => old[key] === value)) {
    return watchResponse({ seq: event.seq, accepted: true });
  }
  if (effectiveWatchStatus(row) === 'stale' && event.seq === row.last_seq + 1) {
    throw new WatchRequestError(429, 'Too many active watch runs. Resume later.');
  }
  throw new WatchRequestError(409, row.status === 'running'
    ? 'Conflicting event. The next sequence is ' + (row.last_seq + 1) + '.'
    : 'This run has closed.');
}

async function executeWatchSolver(db, id) {
  let seq = 0;
  try {
    for (const frame of runCliqueExperiment()) {
      const event = { seq: frame.seq, title: frame.title, detail: frame.detail, phase: frame.phase, frame };
      let status = 'running';
      if (frame.phase === 'complete') {
        status = frame.checks.length && frame.checks.every(check => check.passed) ? 'completed' : 'failed';
      }
      if (!await recordWatchEvent(db, id, event, status, null, 'solver')) throw new Error('Run no longer writable.');
      seq = frame.seq;
      if (status !== 'running') return;
      await new Promise(resolve => setTimeout(resolve, 900));
    }
    throw new Error('Missing verification frame.');
  } catch {
    const failure = { seq: seq + 1, title: 'Verification interrupted', detail: 'The solver stopped before recording its result.', phase: 'failed' };
    await recordWatchEvent(db, id, failure, 'failed', null, 'solver').catch(() => false);
  }
}

export async function handleWatchApi(request, env, ctx, url) {
  const path = url.pathname.replace(/\/$/, '');
  const externalStart = path === '/api/watch/runs';
  const solverStart = path === '/watch/start';
  const route = watchApiRunPath.exec(path);
  if (!externalStart && !solverStart && !route) return null;
  const reading = route && !route[2];
  const allowed = reading ? 'GET' : 'POST';
  if (request.method !== allowed) return watchResponse({ error: 'Method not allowed.' }, 405, { Allow: allowed });
  const origin = request.headers.get('origin');
  if (!reading && origin && origin !== url.origin) return watchResponse({ error: 'Invalid origin.' }, 403);
  const db = env?.DB;
  if (!db || (solverStart && typeof ctx?.waitUntil !== 'function')) return watchResponse({ error: 'Run storage unavailable.' }, 503);
  try {
    if (reading) {
      const run = await getWatchRun(db, route[1]);
      return run ? watchResponse(run) : watchResponse({ error: 'Run not found.' }, 404);
    }
    if (route) return await publishWatchEvent(db, route[1], request);
    let problemId = '3sat-to-clique';
    if (externalStart) {
      const data = await readWatchBody(request);
      if (Object.keys(data).length !== 1 || !problemsById.has(data.problemId)) throw new WatchRequestError(400, 'Choose a catalog problem ID.');
      problemId = data.problemId;
    } else if (request.body) {
      // An empty HTML form may still be delivered as a non-null body stream.
      const reader = request.body.getReader();
      let part;
      do { part = await reader.read(); } while (!part.done && !part.value.length);
      if (!part.done) {
        await reader.cancel();
        throw new WatchRequestError(400, 'Start a solver with an empty request body.');
      }
    }
    const { id, writeToken } = await createWatchRun(db, request, problemId, solverStart ? 'solver' : 'agent');
    const watchUrl = new URL('/watch/' + id + '/', url).href;
    if (solverStart) {
      ctx.waitUntil(executeWatchSolver(db, id));
      return new Response(null, { status: 303, headers: { Location: watchUrl, 'Cache-Control': 'no-store' } });
    }
    return watchResponse({ id, watchUrl, writeToken }, 201);
  } catch (error) {
    if (error instanceof WatchRequestError) return watchResponse({ error: error.message }, error.status);
    return watchResponse({ error: 'Run storage temporarily unavailable.' }, 503);
  }
}
