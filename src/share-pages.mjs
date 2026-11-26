// Each public page has one permanent address. Its card is rendered from the same catalog as the brief.
function createShareCards() {
  const byPage = new Map();
  const byImage = new Map();
  function add(path, imageName, title, label, category = '') {
    const imagePath = '/og/' + imageName + '.png';
    const card = { key: path, title, label, category, imagePath };
    byPage.set(path, card);
    byImage.set(imagePath, card);
  }
  add('/', 'home', 'Collective Intelligence', 'Open projects for people and AI');
  add('/problems/', 'problems', 'Explore open problems', 'Problem catalog');
  add('/how-it-works/', 'how-it-works', 'How it works', 'Contributing to a problem');
  add('/about/', 'about', 'About Collective Intelligence', 'People and AI');
  add('/connect/', 'connect', 'Connect your AI', 'MCP setup');
  for (const category of catalog.categories) {
    add(categoryPath(category.id), 'categories/' + category.id, category.title, 'Problem category', category.id);
  }
  for (const problem of catalog.problems) {
    const category = categoriesById.get(problem.category).title;
    add(routeFor(problem), 'problems/' + problem.id, problem.title, problem.track ?? category, problem.category);
    add('/connect/?project=' + problem.id, 'connect/' + problem.id, problem.title, 'MCP setup · ' + category, problem.category);
  }
  return { byPage, byImage };
}

function socialHead(origin, path, query, title, description) {
  const card = shareCards.byPage.get(path);
  const canonical = new URL(path, origin);
  if (query) canonical.searchParams.set('q', query);
  const imageUrl = new URL(card.imagePath, origin);
  imageUrl.searchParams.set('v', config.commit.slice(0, 12));
  const alt = card.label + ' — ' + card.title;
  return `<link rel="canonical" href="${escape(canonical.href)}">
<meta property="og:site_name" content="Collective Intelligence">
<meta property="og:type" content="${path.startsWith('/problems/') && path !== '/problems/' ? 'article' : 'website'}">
<meta property="og:url" content="${escape(canonical.href)}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="${escape(imageUrl.href)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escape(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="twitter:image" content="${escape(imageUrl.href)}">
<meta name="twitter:image:alt" content="${escape(alt)}">`;
}

function shareSitemap(origin) {
  const urls = Array.from(shareCards.byPage.keys(), path => '<url><loc>' + escape(origin + path) + '</loc></url>');
  return send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>', 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
}

async function shareImageResponse(request, card) {
  const headers = { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' };
  return send(request.method === 'HEAD' ? null : await renderShareImage(card), 200, headers);
}
