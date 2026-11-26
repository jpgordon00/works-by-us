import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { openPreviewDatabase } from './preview-db.mjs';
import worker from '../dist/server/index.js';

const port = Number(process.env.WORKS_BY_US_PORT || 4179);
mkdirSync('.runtime', { recursive: true });
const env = { DB: openPreviewDatabase('.runtime/watch-preview.sqlite') };
const ctx = { waitUntil(promise) { promise.catch(error => console.error('Run failed in preview', error)); } };

createServer(async (incoming, outgoing) => {
  try {
    const method = incoming.method;
    const init = { method, headers: incoming.headers };
    if (method !== 'GET' && method !== 'HEAD') Object.assign(init, { body: incoming, duplex: 'half' });
    const request = new Request('http://127.0.0.1:' + port + incoming.url, init);
    const response = await worker.fetch(request, env, ctx);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.writeHead(500).end('Preview request failed');
    console.error(error);
  }
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port));
