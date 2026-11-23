import { createServer } from 'node:http';
import worker from '../dist/server/index.js';

const port = Number(process.env.WORKS_BY_US_PORT || 4179);
createServer(async (incoming, outgoing) => {
  try {
    const method = incoming.method;
    const init = { method, headers: incoming.headers };
    if (method !== 'GET' && method !== 'HEAD') Object.assign(init, { body: incoming, duplex: 'half' });
    const request = new Request('http://127.0.0.1:' + port + incoming.url, init);
    const response = await worker.fetch(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.writeHead(500).end('Preview request failed');
    console.error(error);
  }
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port));
