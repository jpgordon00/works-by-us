import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import worker from '../dist/server/index.js';

const origin = 'https://works-by-us.jacob-gordon255689.chatgpt.site';
const fetchSite = (path, method = 'GET') => worker.fetch(new Request(new URL(path, origin), {
  method, headers: { 'User-Agent': 'Twitterbot/1.0' }
}));

const entities = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>' };
const unescape = text => text.replace(/&(?:amp|quot|#39|apos|lt|gt);/g, entity => entities[entity]);
function attributes(tag) {
  return Object.fromEntries(Array.from(tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs),
    ([, key, , value]) => [key.toLowerCase(), unescape(value)]));
}

async function readPage(path) {
  let response = await fetchSite(path);
  if ([301, 302, 307, 308].includes(response.status)) response = await fetchSite(response.headers.get('location'));
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert.ok(head, path + ' has a server-rendered head');
  const meta = new Map();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const { name, property, content } = attributes(tag);
    const key = name || property;
    if (key?.startsWith('og:') || key?.startsWith('twitter:')) {
      assert.ok(!meta.has(key), path + ' declares ' + key + ' twice');
      meta.set(key, content);
    }
  }
  const links = Array.from(head.matchAll(/<link\b[^>]*>/gi), ([tag]) => attributes(tag));
  const canonical = links.filter(link => link.rel === 'canonical').map(link => link.href);
  assert.equal(canonical.length, 1, path + ' canonical link');
  return { html, meta, canonical: canonical[0] };
}

function catalogPages(catalog) {
  return [
    ...['/', '/problems/', '/connect/', '/about/', '/how-it-works/', '/watch/example/'].map(path => ({ path })),
    ...catalog.categories.map(category => ({
      path: '/categories/' + category.id + '/', title: category.title, description: category.description
    })),
    ...catalog.problems.flatMap(problem => [
      { path: '/problems/' + problem.id + '/', title: problem.title, description: problem.summary },
      { path: '/connect/?project=' + problem.id, title: problem.title }
    ])
  ];
}

function checkPng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1200, 630]);
  const data = [];
  let lastChunk;
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    lastChunk = bytes.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + length + 12 <= bytes.length, 'PNG chunk extends beyond body');
    if (lastChunk === 'IDAT') data.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  assert.equal(lastChunk, 'IEND');
  assert.ok(inflateSync(Buffer.concat(data)).length > 0, 'PNG contains decodable image data');
}

test('all public pages offer crawlable links and distinct, readable sharing cards', async () => {
  const pages = catalogPages(await (await fetchSite('/api/problems')).json());
  const linksByPage = new Map();
  const imageUrls = new Set();
  const imageHashes = new Set();
  for (const { path, title, description } of pages) {
    const { html, canonical, meta } = await readPage(path);
    assert.equal(canonical, origin + path);
    assert.equal(meta.get('og:url'), canonical);
    assert.ok(meta.get('og:title')?.trim(), path + ' preview title');
    assert.ok(meta.get('og:description')?.trim(), path + ' preview description');
    if (title) assert.ok(meta.get('og:title').includes(title), path + ' preview must name the project or category');
    if (description) assert.equal(meta.get('og:description'), description, path);
    assert.equal(meta.get('twitter:card'), 'summary_large_image');
    assert.equal(meta.get('twitter:title'), meta.get('og:title'));
    assert.equal(meta.get('twitter:description'), meta.get('og:description'));
    const image = meta.get('og:image');
    assert.equal(meta.get('twitter:image'), image);
    const alt = meta.get('og:image:alt');
    assert.ok(alt?.trim(), path + ' needs card alt text');
    if (title) assert.ok(alt.includes(title), path + ' alt text should identify the subject');
    assert.equal(meta.get('twitter:image:alt'), alt);
    assert.equal(new URL(image).origin, origin);
    assert.ok(!imageUrls.has(image), path + ' reuses another page’s image URL');
    imageUrls.add(image);

    const response = await fetchSite(image);
    assert.equal(response.status, 200, image);
    assert.equal(response.headers.get('content-type')?.split(';')[0], 'image/png');
    const bytes = Buffer.from(await response.arrayBuffer());
    checkPng(bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.ok(!imageHashes.has(hash), path + ' serves another page’s card');
    imageHashes.add(hash);

    const destinations = new Set();
    for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
      const href = attributes(tag).href;
      if (!href) continue;
      const url = new URL(href, canonical);
      if (url.origin === origin) destinations.add(url.pathname + url.search);
    }
    linksByPage.set(path, destinations);
  }
  const reachable = new Set(['/']);
  for (const path of reachable) {
    for (const destination of linksByPage.get(path) ?? []) reachable.add(destination);
  }
  for (const { path } of pages) assert.ok(reachable.has(path), path + ' needs a link from the site');
});

test('shared URL variants preserve the destination and discard tracking parameters', async () => {
  const { problems: [problem] } = await (await fetchSite('/api/problems')).json();
  const variants = [
    ['/problems/' + problem.id + '?utm_source=chat', '/problems/' + problem.id + '/'],
    ['/categories/' + problem.category + '?utm_medium=social', '/categories/' + problem.category + '/'],
    ['/?q=layers&utm_source=chat', '/problems/?q=layers'],
    ['/connect?utm_source=chat&project=' + problem.id, '/connect/?project=' + problem.id]
  ];
  for (const [input, target] of variants) {
    const { canonical, meta } = await readPage(input);
    assert.equal(canonical, origin + target, input);
    assert.equal(meta.get('og:url'), canonical);
    assert.equal(meta.get('og:image'), (await readPage(target)).meta.get('og:image'));
  }
});

test('sitemap advertises the catalog’s permanent links', async () => {
  const robots = await fetchSite('/robots.txt');
  assert.equal(robots.status, 200);
  assert.ok((await robots.text()).includes(origin + '/sitemap.xml'));
  const sitemap = await fetchSite('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  const locations = new Set(Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) => unescape(url)));
  const catalog = await (await fetchSite('/api/problems')).json();
  for (const { path } of catalogPages(catalog)) assert.ok(locations.has(origin + path), 'missing sitemap entry ' + path);
});

test('preview assets support HEAD and reject unsupported requests and missing URLs', async () => {
  const { meta } = await readPage('/');
  const image = meta.get('og:image');
  const head = await fetchSite(image, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type')?.split(';')[0], 'image/png');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal((await fetchSite(image, 'POST')).status, 405);
  const missing = new URL('missing-collective-card.png', image);
  for (const path of [missing.href, '/problems/unknown-problem/', '/categories/unknown-category/']) {
    assert.equal((await fetchSite(path)).status, 404, path);
  }
});
