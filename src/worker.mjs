const legacyVersions = ['2025-11-25', '2025-06-18', '2025-03-26'];
const modernVersion = '2026-07-28';
const supportedVersions = [modernVersion, ...legacyVersions];
const protocolVersionKey = 'io.modelcontextprotocol/protocolVersion';
const serverInfoKey = 'io.modelcontextprotocol/serverInfo';
const serverInfo = { name: 'works-by-us', title: 'Crowdsourced Intelligence', version: '1.0.0' };
const instructions = 'Find an open problem, fetch its brief, then prepare a contribution with reproducible evidence for human review on GitHub.';
const problemsById = new Map(catalog.problems.map(problem => [problem.id, problem]));
const categoriesById = new Map(catalog.categories.map(category => [category.id, category]));
const issuePath = config.repository + '/issues/new';
const browsePath = '/problems/';
const routeFor = problem => browsePath + problem.id + '/';
const categoryPath = id => id ? '/categories/' + id + '/' : browsePath;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function problemTitle(problem) {
  return problem.track ? problem.track + ' / ' + problem.title : problem.title;
}

function findProblems(category = '', query = '') {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return catalog.problems.filter(problem => {
    if (category && problem.category !== category) return false;
    const categoryName = categoriesById.get(problem.category).title;
    const keywords = [problem.id, problem.title, problem.track, problem.summary, problem.task, categoryName, ...(problem.keywords ?? [])].join(' ').toLowerCase();
    return terms.every(term => keywords.includes(term));
  });
}

function contributionBrief(problem, origin) {
  return [
    'Work on one scoped contribution to "' + problemTitle(problem) + '" for Crowdsourced Intelligence.',
    'Problem: ' + origin + routeFor(problem),
    'Task: ' + problem.task,
    'Review criteria: ' + problem.review,
    'Primary sources:',
    ...problem.sources.map(source => '- ' + source.title + ': ' + source.url),
    'Return a short finding, reproducible steps, evidence or a patch, and remaining uncertainty. If MCP is connected, call prepare_contribution with that evidence. Ask me to review any draft before publication.'
  ].join('\n');
}

function issueLink(title, body) {
  const url = new URL(issuePath);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  return url.href.length <= 6000 ? url.href : issuePath;
}

function draftContribution(problem, origin, title, summary, evidence) {
  const subject = '[' + (problem.track ?? categoriesById.get(problem.category).title) + '] ' + title;
  const body = 'Problem: ' + origin + routeFor(problem)
    + '\n\n## What I found\n\n' + summary
    + '\n\n## Evidence and reproduction\n\n' + evidence
    + '\n\n## Open questions\n\n<!-- Note anything a reviewer should know. -->';
  return { title: subject, body, github_issue_url: issueLink(subject, body), published: false };
}

function send(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Works-By-Us-Revision': config.commit,
    ...headers
  } });
}

function json(body, status = 200) {
  return send(JSON.stringify(body), status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}

function page(title, content, { status = 200, active = '', description = 'Open problems and practical ways to work on them.' } = {}) {
  const fullTitle = title ? title + ' | Crowdsourced Intelligence' : 'Crowdsourced Intelligence | Open problems';
  return send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(fullTitle)}</title><meta name="description" content="${escape(description)}"><meta name="theme-color" content="#ffffff">
<link rel="stylesheet" href="/style.css"><script defer src="/copy.js"></script></head>
<body>
<a href="#main" class="skip">Skip to content</a>
<header class="bar"><div class="wrap bar-inner">
<a class="wordmark" href="/" aria-label="Crowdsourced home"><span class="weave" aria-hidden="true">✳︎</span>crowdsourced<span class="suffix">.si</span></a>
<nav aria-label="Main navigation">
<a href="${browsePath}" ${active === 'problems' ? 'aria-current="page"' : ''}>Projects</a>
<a href="/connect/" ${active === 'connect' ? 'aria-current="page"' : ''}>Connect your AI</a>
</nav>
</div></header>
<main id="main" class="wrap" tabindex="-1">${content}</main>
<footer class="wrap footer"><span>Crowdsourced Intelligence</span><a href="${config.repository}">GitHub</a><a href="${config.repository}/issues">Contributions</a></footer>
</body></html>`, status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com",
    'Cache-Control': 'no-cache'
  });
}

function problemRows(problems) {
  if (!problems.length) return '<p class="empty">No problems match this search. Try a shorter phrase or another category.</p>';
  return '<ul class="problem-list">' + problems.map(problem => `<li><a class="problem-row" href="${routeFor(problem)}">
<span class="row-topic">${escape(problem.track ?? categoriesById.get(problem.category).title)}</span>
<span class="row-content"><strong>${escape(problem.title)}</strong><span>${escape(problem.summary)}</span></span>
<span class="chevron" aria-hidden="true"></span></a></li>`).join('') + '</ul>';
}

function categoryNav(active, query) {
  const search = query ? '?q=' + encodeURIComponent(query) : '';
  const link = (id, name) => `<a href="${categoryPath(id) + search}"${active === id ? ' aria-current="page"' : ''}>${escape(name)}</a>`;
  return '<nav class="category-nav" aria-label="Problem categories">' + link('', 'All') + catalog.categories.map(category => link(category.id, category.title)).join('') + '</nav>';
}

function projectGallery(entries) {
  const [editor, budget, pdf] = entries;
  return `<div class="showcase">
    <article class="lead-project">
      <figure class="layer-preview">
        <input type="checkbox" id="color-layer" checked aria-label="Show satellite image in color">
        <img src="/media/richat.jpg" width="1100" height="890" alt="Rock rings of the Richat Structure seen from orbit">
        <label for="color-layer"><span class="layer-switch" aria-hidden="true"></span>Color layer</label>
        <figcaption>Richat Structure · Landsat 7</figcaption>
      </figure>
      <div class="lead-copy"><p class="project-type">${escape(editor.track)}</p>
        <h2><a href="${routeFor(editor)}">Build a free layered photo editor</a></h2>
        <p>Start with two images, a layer mask, and a file you can reopen.</p>
        <a class="project-link" href="${routeFor(editor)}">Open project</a>
      </div>
    </article>
    <div class="side-projects">
      <article class="side-project"><a class="side-art budget-art" href="${routeFor(budget)}" aria-label="View the household budgeting project">
        <span class="receipt" aria-hidden="true"><b>Monthly budget</b><span>Groceries <em>$240</em></span><span>Transit <em>$60</em></span><strong>Total <em>$300</em></strong></span></a>
        <div><p class="project-type">${escape(budget.track)}</p><h2><a href="${routeFor(budget)}">Build a free household budget app</a></h2><p>Turn bank CSVs into a household spending plan.</p></div>
      </article>
      <article class="side-project"><a class="side-art pdf-art" href="${routeFor(pdf)}" aria-label="View the PDF comparison project">
        <span class="document back" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="document front" aria-hidden="true"><b>Revision</b><i></i><del>July 12</del><ins>July 14</ins><i></i></span></a>
        <div><p class="project-type">${escape(pdf.track)}</p><h2><a href="${routeFor(pdf)}">Compare two PDFs offline</a></h2><p>Compare revisions locally and export a page-by-page report.</p></div>
      </article>
    </div>
  </div>`;
}

function renderIndex(url, { home = false, category }) {
  const query = (url.searchParams.get('q') ?? '').slice(0, 100).trim();
  const categoryId = category?.id ?? '';
  const matches = findProblems(categoryId, query);
  const featuredIds = [catalog.featured, 'free-monarch-money-alternative', 'free-acrobat-pro-alternative'];
  const showGallery = home && !query && featuredIds.every(id => problemsById.has(id));
  const visible = showGallery ? matches.filter(problem => !featuredIds.includes(problem.id)) : matches;
  const title = category?.title ?? 'Open projects';
  const description = category?.description ?? 'Pick a project. Work on it yourself or with your AI. Share what you find.';
  return page(home ? '' : title, `<section class="index">
    <div class="index-top"><div><h1>${escape(title)}</h1><p>${escape(description)}</p></div>
    <form class="search" action="${categoryPath(categoryId)}" role="search"><label class="sr-only" for="search">Search projects</label><input id="search" name="q" type="search" maxlength="100" placeholder="Search projects" value="${escape(query)}"><button type="submit">Search</button></form></div>
    ${categoryNav(categoryId, query)}
    ${showGallery ? projectGallery(featuredIds.map(id => problemsById.get(id))) + '<h2 class="more-heading">More open projects</h2>' : ''}
    ${query ? '<p class="search-result">' + visible.length + ' ' + (visible.length === 1 ? 'result' : 'results') + ' for “' + escape(query) + '”</p>' : ''}
    ${problemRows(visible)}
    <p class="propose"><a href="${escape(issueLink('Propose a project', '## Problem\n\n## Primary source\n\n## A practical contribution\n\n## How someone can check it\n'))}">Propose a project on GitHub</a></p>
  </section>`, { active: 'problems', description });
}

function copyButton(target, text) {
  return `<button class="action outline" type="button" data-copy="${target}">${text}</button><span class="sr-only" role="status"></span>`;
}

function renderProblem(problem, origin) {
  const category = categoriesById.get(problem.category);
  const sources = problem.sources.map(source => `<li><a href="${escape(source.url)}">${escape(source.title)}</a></li>`).join('');
  const draft = draftContribution(problem, origin, problem.title, '<!-- Summarize your finding. -->', '<!-- Link to a patch, result or public artifact. Include commands and expected output. -->');
  return page(problemTitle(problem), `<article class="detail">
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="${browsePath}">Problems</a><span aria-hidden="true">/</span><a href="${categoryPath(category.id)}">${escape(category.title)}</a></nav>
<header class="detail-heading">${problem.track ? '<p class="track">' + escape(problem.track) + '</p>' : ''}<h1>${escape(problem.title)}</h1>
<p class="lede">${escape(problem.summary)}</p></header>
<div class="detail-grid"><div class="brief">
<section><h2>The problem</h2><p>${escape(problem.context)}</p></section>
<section><h2>What you can do</h2><p>${escape(problem.task)}</p></section>
<section><h2>How to check it</h2><p>${escape(problem.review)}</p></section>
<section><h2>Sources</h2><ul class="sources">${sources}</ul></section></div>
<aside class="contribution" aria-labelledby="contribute-title">
<p class="kind">${escape(problem.kind)}</p><h2 id="contribute-title">Make a contribution</h2>
<p>Take the brief to your own AI or work through it yourself. Share the result with enough detail for someone else to check it.</p>
<textarea class="sr-only" tabindex="-1" aria-label="Problem brief" id="problem-brief" readonly>${escape(contributionBrief(problem, origin))}</textarea>
<div class="contribution-actions">${copyButton('problem-brief', 'Copy problem brief')}
<a class="action filled" href="${escape(draft.github_issue_url)}">Draft GitHub contribution</a></div>
<a class="text-link" href="/connect/">Connect with MCP</a>
</aside></div></article>`, { active: 'problems', description: problem.summary });
}

function renderConnect(origin) {
  const endpoint = origin + '/api/mcp';
  return page('Connect MCP', `<article class="detail connect">
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="${browsePath}">Problems</a><span aria-hidden="true">/</span><span>Connect MCP</span></nav>
<header class="detail-heading"><h1>Bring your own AI.</h1><p class="lede">Give your MCP client this URL to browse the same problems and prepare a contribution for review.</p></header>
<section class="endpoint"><label for="endpoint">Server URL</label><div><input type="url" id="endpoint" value="${escape(endpoint)}" readonly>${copyButton('endpoint', 'Copy URL')}</div><p>Streamable HTTP. Public access.</p></section>
<div class="brief connection-help">
<section><h2>Add it to your client</h2><p>In a client with remote MCP support, add a Streamable HTTP server named <strong>Crowdsourced Intelligence</strong>. Use the URL above. For Codex, run this command.</p>
<pre id="codex-command"><code>codex mcp add works-by-us --url ${escape(endpoint)}</code></pre>
${copyButton('codex-command', 'Copy command')}</section>
<section><h2>Try it</h2><p>Ask your AI to find the free Photoshop alternative and suggest a small contribution. It can read the brief, explain what a reviewer needs, and prepare a GitHub draft for you to open.</p></section>
<section><h2>Available tools</h2><dl class="tool-list">${tools.map(tool => ' <div><dt><code>' + tool.name + '</code></dt><dd>' + escape(tool.description) + '</dd></div>').join('')}</dl></section>
</div></article>`, { active: 'connect' });
}

const string = (description, maxLength, minLength = 0) => ({ type: 'string', description, maxLength, minLength });
const schema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const tools = [
  { name: 'list_categories', title: 'List categories', description: 'See the subject areas and how many problems each contains.', inputSchema: schema(), annotations: readOnly },
  { name: 'list_problems', title: 'Find problems', description: 'Search open problems and free software projects by keywords, category, or both. Use the returned ID to fetch the full brief.', inputSchema: schema({
    category: { type: 'string', enum: catalog.categories.map(category => category.id), description: 'Subject area ID. Omit for all areas.' },
    query: string('Keywords, such as Photoshop, Monarch or transit.', 100)
  }), annotations: readOnly },
  { name: 'get_problem', title: 'Read a problem brief', description: 'Get a problem’s scope, primary sources, review criteria, and a copyable contribution brief.', inputSchema: schema({
    id: string('Problem ID returned by list_problems.', 100, 1)
  }, ['id']), annotations: readOnly },
  { name: 'prepare_contribution', title: 'Draft a contribution', description: 'Format a contribution and return a GitHub draft link for the user to review. This tool never posts the draft.', inputSchema: schema({
    id: string('Problem ID returned by list_problems.', 100, 1),
    title: string('Short title for the finding, fixture, proof or patch.', 100, 1),
    summary: string('What changed or what you found.', 900, 1),
    evidence: string('Public artifact links, commands, expected results and caveats.', 1400, 1)
  }, ['id', 'title', 'summary', 'evidence']), annotations: readOnly }
];

function runTool(name, args, origin) {
  const tool = tools.find(candidate => candidate.name === name);
  if (!tool) throw new Error('Unknown tool. Call tools/list for supported names.');
  const { properties, required } = tool.inputSchema;
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be an object.');
  for (const field of required) if (!Object.hasOwn(args, field)) throw new Error('Missing argument: ' + field);
  for (const [field, value] of Object.entries(args)) {
    const spec = Object.hasOwn(properties, field) && properties[field];
    if (!spec || typeof value !== 'string' || (spec.enum && !spec.enum.includes(value))
        || value.length > (spec.maxLength ?? Infinity) || value.trim().length < (spec.minLength ?? 0)) {
      throw new Error('Invalid argument: ' + field);
    }
  }
  if (name === 'list_categories') return { categories: catalog.categories.map(category => ({
    ...category, count: findProblems(category.id).length, url: origin + categoryPath(category.id)
  })) };
  if (name === 'list_problems') return { problems: findProblems(args.category, args.query).map(problem => ({
    id: problem.id, title: problemTitle(problem), category: problem.category, summary: problem.summary, kind: problem.kind, url: origin + routeFor(problem)
  })) };
  const problem = problemsById.get(args.id);
  if (!problem) throw new Error('Problem not found. Call list_problems to find a valid ID.');
  if (name === 'get_problem') return { problem: { ...problem, url: origin + routeFor(problem), brief: contributionBrief(problem, origin) } };
  return draftContribution(problem, origin, args.title.trim().replace(/\s+/g, ' '), args.summary.trim(), args.evidence.trim());
}

function decodeRoutingName(name) {
  const encoded = /^=\?base64\?(.+)\?=$/.exec(name ?? '');
  if (!encoded) return name;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(encoded[1]), char => char.charCodeAt(0)));
  } catch {
    return '';
  }
}

async function rpc(request, origin) {
  const source = request.headers.get('origin');
  if (source && source !== origin) return send(null, 403);
  if (request.method !== 'POST') return send(null, 405, { Allow: 'POST' });
  const version = request.headers.get('mcp-protocol-version');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return send('Use application/json', 415);
  let message;
  try {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let body = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16000) {
        await reader.cancel();
        return send('Request too large', 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    message = JSON.parse(body + decoder.decode());
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }, 400);
  }
  const id = message?.id ?? null;
  const { method, params } = message ?? {};
  const messageVersion = params?._meta?.[protocolVersionKey];
  const modern = version === modernVersion || messageVersion === modernVersion || method === 'server/discover';
  const cache = ['server/discover', 'tools/list'].includes(method) ? { ttlMs: 60000, cacheScope: 'public' } : {};
  const result = value => json({ jsonrpc: '2.0', id, result: modern ? { resultType: 'complete', ...cache, ...value } : value });
  const error = (code, message, status = 200, data) => json({ jsonrpc: '2.0', id, error: { code, message, data } }, status);
  if (message?.jsonrpc !== '2.0' || typeof message.method !== 'string'
      || (message.id !== undefined && typeof id !== 'string' && typeof id !== 'number')) {
    return error(-32600, 'Invalid request', 400);
  }
  if (!Object.hasOwn(message, 'id')) return send(null, 202);
  const requested = version ?? messageVersion;
  if (requested && !supportedVersions.includes(requested)) {
    return error(-32022, 'Unsupported protocol version', 400, { requested, supported: supportedVersions });
  }
  const routedMethod = request.headers.get('mcp-method');
  const routedName = decodeRoutingName(request.headers.get('mcp-name'));
  if ((version && messageVersion && version !== messageVersion)
      || (routedMethod !== null && routedMethod !== method)
      || (routedName !== null && routedName !== (params?.name ?? params?.uri))
      || (modern && (version !== modernVersion || messageVersion !== modernVersion || !routedMethod
        || (['tools/call', 'prompts/get', 'resources/read'].includes(method) && !routedName)))) {
    return error(-32020, 'MCP routing headers do not match the request', 400);
  }
  if (method === 'server/discover') return result({
    supportedVersions: [modernVersion], capabilities: { tools: {} }, instructions,
    _meta: { [serverInfoKey]: serverInfo }
  });
  if (method === 'initialize') {
    const offered = params?.protocolVersion;
    return result({ protocolVersion: legacyVersions.includes(offered) ? offered : legacyVersions[0], capabilities: { tools: {} }, serverInfo, instructions });
  }
  if (method === 'ping') return result({});
  if (method === 'tools/list') return result({ tools });
  if (method === 'tools/call') {
    try {
      const data = runTool(params?.name, params?.arguments ?? {}, origin);
      return result({ content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data });
    } catch (failure) {
      return result({ isError: true, content: [{ type: 'text', text: failure.message }] });
    }
  }
  return error(-32601, 'Unknown method');
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/mcp' || path === '/api/mcp') return rpc(request, url.origin);
    if (!['GET', 'HEAD'].includes(request.method)) return send(null, 405, { Allow: 'GET, HEAD' });
    if (path === '/media/richat.jpg') {
      return send(Uint8Array.from(atob(assets.richat), char => char.charCodeAt(0)), 200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
    }
    if (path === '/style.css') return send(assets['style.css'], 200, { 'Content-Type': 'text/css; charset=utf-8' });
    if (path === '/copy.js') return send(assets['copy.js'], 200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    if (path === '/api/problems') return json(catalog);
    if (path === '/') return renderIndex(url, { home: true });
    if (path === '/problems') return renderIndex(url, {});
    if (path === '/connect') return renderConnect(url.origin);
    const parts = path.split('/');
    if (parts.length === 3 && parts[1] === 'categories' && categoriesById.has(parts[2])) {
      return renderIndex(url, { category: categoriesById.get(parts[2]) });
    }
    if (parts.length === 3 && parts[1] === 'problems' && problemsById.has(parts[2])) {
      return renderProblem(problemsById.get(parts[2]), url.origin);
    }
    return page('Page not found', '<section class="not-found"><h1>Page not found</h1><p><a href="/problems/">Browse open problems</a></p></section>', { status: 404 });
  }
};
