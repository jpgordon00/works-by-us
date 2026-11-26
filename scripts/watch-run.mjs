import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const publicOrigin = 'https://works-by-us.jacob-gordon255689.chatgpt.site';
const idPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const usage = 'Usage: node scripts/watch-run.mjs start <problemId> | step|finish|fail <id> "<title>" "<detail>" | retry <id>';
const actions = {
  step: { phase: 'work' },
  finish: { phase: 'complete', status: 'completed' },
  fail: { phase: 'complete', status: 'failed' }
};

function originFrom(value) {
  const url = new URL(value);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use an HTTPS origin, or HTTP on localhost for a local preview.');
  }
  return url.origin;
}

async function post(url, payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers, body: JSON.stringify(payload)
    });
  } catch {
    throw new Error('The server response could not be confirmed.');
  }
  if (!res.ok) throw new Error('The server returned HTTP ' + res.status + '.');
  return res;
}

// Publish a complete file atomically and never overwrite a competing writer.
async function createOnce(path, data) {
  const tmp = path + '.' + randomUUID() + '.tmp';
  await writeFile(tmp, JSON.stringify(data), { flag: 'wx', mode: 0o600 });
  try {
    await link(tmp, path);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    return false;
  } finally {
    await unlink(tmp);
  }
  return true;
}

async function readJSON(path) {
  const contents = await readFile(path, 'utf8');
  try {
    return JSON.parse(contents);
  } catch {
    throw new Error('The saved publisher state could not be read.');
  }
}

function sameEvent(a, b) {
  return a.title === b.title && a.detail === b.detail && a.phase === b.phase && a.status === b.status;
}

export async function runWatchCommand(args, {
  origin = process.env.WATCH_ORIGIN || publicOrigin,
  stateDir = join(homedir(), '.works-by-us', 'watch-runs')
} = {}) {
  const [action, id, rawTitle, rawDetail] = args;
  if (action === 'start') {
    if (args.length !== 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(usage);
    const startOrigin = originFrom(origin);
    await mkdir(stateDir, { mode: 0o700, recursive: true });
    const res = await post(startOrigin + '/api/watch/runs', { problemId: id });
    let config;
    try {
      config = await res.json();
    } catch {
      throw new Error('The server returned an unreadable run.');
    }
    if (!config || !idPattern.test(config.id) || typeof config.watchUrl !== 'string' || typeof config.writeToken !== 'string' ||
        !config.writeToken || /[\r\n]/.test(config.writeToken)) {
      throw new Error('The server returned an invalid run.');
    }
    const url = new URL(config.watchUrl, startOrigin);
    if (url.origin !== startOrigin || url.username || url.password || url.search || url.hash ||
        !['/watch/' + config.id, '/watch/' + config.id + '/'].includes(url.pathname)) {
      throw new Error('The server returned an unexpected watch URL.');
    }
    const dir = join(stateDir, config.id);
    await mkdir(dir, { mode: 0o700 });
    await writeFile(join(dir, 'publisher.json'), JSON.stringify({
      origin: startOrigin, writeToken: config.writeToken
    }), { flag: 'wx', mode: 0o600 });
    return url.href + '\n' + config.id;
  }

  const retrying = action === 'retry';
  if ((!retrying && !Object.hasOwn(actions, action)) || !idPattern.test(id) ||
      args.length !== (retrying ? 2 : 4)) throw new Error(usage);
  let requested;
  if (!retrying) {
    const title = rawTitle.trim();
    const detail = rawDetail.trim();
    if (!title || title.length > 100 || !detail || detail.length > 500) {
      throw new Error('Use a title of 1–100 characters and detail of 1–500 characters.');
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(title + detail)) {
      throw new Error('Remove control characters from the public milestone.');
    }
    requested = { ...actions[action], title, detail };
  }
  const dir = join(stateDir, id);
  let config;
  try {
    config = await readJSON(join(dir, 'publisher.json'));
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('No local publisher key for this run. Use the account and machine that started it.');
    throw err;
  }

  const files = new Set(await readdir(dir));
  let seq = 1;
  while (files.has(seq + '.sent')) seq++;
  if (seq > 1) {
    const last = await readJSON(join(dir, (seq - 1) + '.json'));
    if (requested && sameEvent(last, requested)) return 'Milestone ' + (seq - 1) + ' already posted.';
    if (last.status) {
      if (retrying) return 'No pending milestone.';
      throw new Error('This run has already ended.');
    }
  }
  const path = join(dir, seq + '.json');
  if (retrying && !files.has(seq + '.json')) return 'No pending milestone.';
  if (seq > 64) throw new Error('This run has reached its 64-event limit.');
  if (seq === 64 && action === 'step') throw new Error('Use the final event to finish or fail this run.');
  if (!retrying && !files.has(seq + '.json')) {
    await createOnce(path, { seq, ...requested });
  }
  const event = await readJSON(path);
  if (requested && !sameEvent(event, requested)) {
    throw new Error('A different milestone is pending. Run retry with this run ID before sending another.');
  }
  try {
    const response = await post(originFrom(config.origin) + '/api/watch/' + id + '/events', event, config.writeToken);
    const receipt = await response.json().catch(() => null);
    if (!receipt?.accepted || receipt.seq !== seq) throw new Error('The server did not acknowledge the sequence.');
  } catch (err) {
    throw new Error(err.message + ' The milestone is saved. Run retry ' + id + ' to resend the same event.');
  }
  await createOnce(join(dir, seq + '.sent'), true);
  return 'Posted milestone ' + seq + '.';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(await runWatchCommand(process.argv.slice(2)));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
