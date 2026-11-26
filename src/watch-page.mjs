const watchPagePath = new RegExp('^/watch/(' + watchIdSegment + ')$');
const watchImagePath = new RegExp('^/og/watch/(' + watchIdSegment + ')\\.png$');

async function serveWatchView(request, db, id, image) {
  let run;
  try {
    // Share previews need only these public fields. Events can be much larger.
    run = await db.prepare('SELECT problem_id, kind, started_at FROM watch_runs WHERE id = ?').bind(id).first();
  } catch {
    if (image) return send(null, 503, { 'Cache-Control': 'no-store' });
    return page('Watch temporarily unavailable', '<section class="not-found"><h1>Run temporarily unavailable</h1><p>Please try this link again shortly.</p></section>', { status: 503 });
  }
  const problem = problemsById.get(run?.problem_id);
  if (!problem) {
    if (image) return send(null, 404, { 'Cache-Control': 'no-store' });
    return page('Run not found', '<section class="not-found"><h1>Run not found</h1><p>Check the watch link, or <a href="/watch/example/">open the solver example</a>.</p></section>', { status: 404 });
  }
  const started = new Date(run.started_at).toISOString().slice(0, 16).replace('T', ' ');
  const label = (run.kind === 'solver' ? 'Solver run' : 'Agent run') + ' · ' + started + ' UTC';
  const card = { key: id, title: problem.title, label, category: problem.category, imagePath: '/og/watch/' + id + '.png' };
  if (image) return shareImageResponse(request, card);
  return renderWatchPage({ id, problem, origin: new URL(request.url).origin, card });
}

function renderWatchPage({ id, problem, origin, card }) {
  const path = '/watch/' + encodeURIComponent(id) + '/';
  const isExample = id === 'example';
  const title = problem.id === '3sat-to-clique' ? '3-SAT to CLIQUE' : problem.title;
  const description = card ? card.label + '. Follow the work on this problem and replay its steps.' : 'Watch the work on this problem and replay the recorded steps.';
  return page('Watch ' + title, `<article class="watch" data-watch-id="${escape(id)}">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/problems/">Problems</a><span aria-hidden="true">/</span><a href="${escape(routeFor(problem))}">Problem brief</a></nav>
    <header class="watch-header"><div><p id="watch-kind">${isExample ? 'Solver replay' : 'Run viewer'}</p><h1>${escape(title)}</h1>${problem.id === '3sat-to-clique' ? '<p class="watch-intro" id="watch-intro">Can the solver make all four clauses true? Watch it try different values, then look for four dots that all connect.</p>' : ''}</div>
      <div class="watch-actions"><button type="button" class="action outline" data-copy="watch-url">Copy watch link</button><span class="sr-only" role="status"></span>
        <form id="watch-start" action="/watch/start" method="post" ${isExample ? '' : 'hidden'}><button class="action filled">Start a new run</button></form>
        <input id="watch-url" aria-label="Shareable watch link" readonly hidden value="${escape(origin + path)}"></div></header>
    <noscript><p>Enable JavaScript to follow this run and replay its steps.</p></noscript>
    <div class="watch-layout"><section class="watch-player" aria-label="Run viewer">
      <div class="watch-player-head"><span id="watch-status" role="status">Connecting</span><span id="watch-step">Waiting for run</span></div>
      <div class="watch-stage" id="watch-graph" hidden></div>
      <div class="watch-caption" aria-live="polite" aria-atomic="true"><p class="watch-phase" id="watch-phase"></p><h2 id="watch-title" tabindex="-1">Loading the run…</h2><p id="watch-detail"></p></div>
      <div class="watch-controls"><button id="watch-play" class="watch-play" type="button" disabled>Play</button><label class="sr-only" for="watch-scrub">Choose a recorded step</label><input id="watch-scrub" type="range" min="1" max="1" value="1" disabled><button id="watch-live" class="watch-control-link" type="button" hidden>Jump to live</button><button id="watch-end" class="watch-control-link" type="button" hidden>View result</button></div>
      <p class="watch-connection" id="watch-feedback" role="status" hidden></p>
    </section><section class="watch-activity" aria-labelledby="watch-activity-heading"><h2 id="watch-activity-heading">Run activity</h2><p class="watch-updated" id="watch-updated" hidden></p><p id="watch-empty">Waiting for the first step.</p><ol id="watch-events" aria-label="Steps, newest first"></ol></section></div>
    <section class="watch-results" id="watch-checks-section" hidden><h2>Witness checks</h2><ul id="watch-checks"></ul></section>
    <a class="watch-brief" href="${escape(routeFor(problem))}">Read the problem and review criteria</a>
  </article>`, { active: 'watch', origin, sharePath: path, shareCard: card, description });
}
