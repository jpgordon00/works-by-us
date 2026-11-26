const featuredProjects = [
  ['free-photoshop-alternative', 'a free photo editor.'],
  ['free-monarch-money-alternative', 'a local budget app.'],
  ['free-acrobat-pro-alternative', 'an offline PDF diff.']
];

const projectNames = {
  'free-photoshop-alternative': 'Build a free layered photo editor',
  'free-monarch-money-alternative': 'Build a free household budget app',
  'free-acrobat-pro-alternative': 'Compare two PDFs offline'
};

const searchIcon = '<span class="search-icon" aria-hidden="true"></span>';

function renderHero(features) {
  const slides = features.map(([problem, headline], index) =>
    '<a class="hero-project" href="' + routeFor(problem) + '"' + (index ? ' hidden' : '') + '>' + escape(headline) + '</a>'
  ).join('');
  const selectors = features.map(([problem], index) =>
    '<button class="hero-selector" type="button" data-slide="' + index + '" aria-label="' + escape(projectNames[problem.id] ?? problem.title) + '" aria-pressed="' + (index === 0) + '"></button>'
  ).join('');
  return `<section class="hero" aria-labelledby="hero-title" data-hero>
    <div class="hero-visual" aria-hidden="true"><canvas data-network></canvas></div>
    <div class="hero-content">
      <p class="hero-label"><span class="hero-beacon" aria-hidden="true"></span>Open projects for people and AI</p>
      <h1 id="hero-title">Let’s build <span class="hero-projects">${slides}</span></h1>
      <p class="hero-summary">Pick a problem, work on it yourself or with your AI, and share what others can verify.</p>
      <div class="hero-actions"><a class="action filled" href="#problems">Explore problems</a><a class="action outline" href="#mcp">Connect via MCP</a></div>
      <div class="hero-controls" hidden>
        <div class="hero-selectors" role="group" aria-label="Featured projects">${selectors}</div>
        <button class="hero-pause" type="button" aria-label="Pause featured project rotation"><span aria-hidden="true"></span></button>
      </div>
    </div>
  </section>`;
}

function renderProjectShelf(category, projects) {
  const cards = projects.map(problem => {
    const title = projectNames[problem.id] ?? problem.title;
    return `<li class="project-card" data-project="${escape(problemKeywords(problem))}">
      <a href="${routeFor(problem)}" class="project-card-link">
        ${renderProjectArt(problem)}
        <div class="project-card-copy"><p>${escape(problem.track ?? problem.kind)}</p><h4>${escape(title)}</h4></div>
      </a>
    </li>`;
  }).join('');
  const rowId = 'shelf-' + category.id;
  return `<section class="project-shelf category-${category.id}" data-shelf aria-labelledby="${rowId}-title">
    <div class="shelf-header">
      <div class="shelf-title"><span aria-hidden="true"></span><h3 id="${rowId}-title">${escape(category.title)}</h3><span class="shelf-count" aria-label="${projects.length} problems">${projects.length}</span></div>
      <div class="shelf-actions">
        <a class="shelf-all" href="${categoryPath(category.id)}" aria-label="View all in ${escape(category.title)}">View all</a>
        <div class="shelf-controls" hidden>
          <button type="button" data-scroll="-1" aria-controls="${rowId}" aria-label="Previous projects in ${escape(category.title)}"><span aria-hidden="true"></span></button>
          <button type="button" data-scroll="1" aria-controls="${rowId}" aria-label="Next projects in ${escape(category.title)}"><span aria-hidden="true"></span></button>
        </div>
      </div>
    </div>
    <ul class="shelf-track" id="${rowId}" tabindex="0" aria-labelledby="${rowId}-title">${cards}</ul>
  </section>`;
}

function renderProblemEntry() {
  return `<section class="problem-entry" id="propose" aria-labelledby="proposal-title">
    <div class="info-heading">
      <h2 id="proposal-title">What problem will you solve?</h2>
      <p>Write a question for the community. Continuing puts your text in a GitHub draft link so you can review it before posting.</p>
    </div>
    <form class="problem-entry-form" action="${catalogIssueForm}" method="get" data-proposal>
      <input type="hidden" name="template" value="problem.yml">
      <label for="proposal-problem">Describe the problem</label>
      <textarea id="proposal-problem" name="problem" rows="3" maxlength="500" required placeholder="What would you like to build, test, or find out?"></textarea>
      <div class="problem-entry-actions">
        <button class="action outline" type="button" data-suggest hidden>Suggest a problem</button>
        <button class="action filled" type="submit">Continue to GitHub</button>
      </div>
      <div class="problem-entry-alternate">
        <button type="button" data-copy="proposal-problem" hidden disabled>Copy text</button><span class="sr-only" role="status"></span>
        <a href="${catalogIssueForm}?template=problem.yml">Open a blank GitHub form</a>
      </div>
    </form>
  </section>`;
}

function renderHome(origin) {
  const features = featuredProjects.flatMap(([id, headline]) => {
    const problem = problemsById.get(id);
    return problem ? [[problem, headline]] : [];
  });
  const shelves = catalog.categories.map(category => renderProjectShelf(category, findProblems(category.id)));
  const extraCategories = catalog.categories.length - 4;
  const agentNames = new Set(Object.values(ledgers).flatMap(ledger =>
    [...(ledger.seed_disclosures ?? []), ...(ledger.hub_starter_disclosures ?? [])].map(row => row.agent)
  ));
  const stats = [
    [catalog.problems.length, 'Open problems'],
    [catalog.categories.length, 'Categories'],
    [tools.length, 'MCP tools'],
    [agentNames.size, 'Disclosed AI contributors']
  ];
  return page('', `${renderHero(features)}
    <dl class="site-stats" aria-label="Collective Intelligence in numbers">
      ${stats.map(([total, label]) => '<div><dt>' + label + '</dt><dd>' + total + '</dd></div>').join('')}
    </dl>
    <section class="project-browser" id="problems" aria-labelledby="problems-title">
      <div class="browser-heading">
        <div><h2 id="problems-title">Explore problems</h2><p>Find a project you can move forward.</p></div>
        <form class="search browser-search" action="${browsePath}" role="search">
          <label class="sr-only" for="home-search">Search all problems</label>
          ${searchIcon}<input type="search" id="home-search" name="q" maxlength="100" placeholder="Search all problems" autocomplete="off">
          <button type="submit" aria-label="Search all problems">Search</button>
        </form>
      </div>
      <p class="browser-result" role="status"></p>
      ${shelves.slice(0, 4).join('')}
      ${extraCategories > 0 ? `<details class="extra-shelves" id="more-categories"><summary><span>More categories</span><span class="extra-count">${extraCategories}</span></summary><div>${shelves.slice(4).join('')}</div></details>` : ''}
      <nav class="browser-footer" aria-label="Catalog and community"><a href="${browsePath}">Browse all problems</a>${communityLinks('#propose')}</nav>
    </section>
    ${renderProblemEntry()}
    ${renderSiteInfo({ mcpUrl: origin + '/api/mcp', repoUrl: config.repository })}`,
    { active: 'home', origin, sharePath: '/', description: 'A public collection of open problems. Pick a brief, bring your own AI, and share evidence anyone can check.' });
}
