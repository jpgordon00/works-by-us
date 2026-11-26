const watchRoot = document.querySelector('[data-watch-id]');
if (watchRoot) initializeWatch(watchRoot.dataset.watchId);

function initializeWatch(id) {
  const get = name => document.getElementById('watch-' + name);
  const statusNames = {running: 'Live', completed: 'Completed', failed: 'Failed', stale: 'Awaiting update'};
  const phases = {setup: 'Set up', graph: 'Construct the graph', search: 'Search', verify: 'Verify', complete: 'Result'};
  const scrub = get('scrub');
  const play = get('play');
  const eventList = get('events');
  let run;
  let index = 0;
  let following = true;
  let playback;
  let pollTimer;
  let stopped = false;
  let previousButton;

  const terminal = state => state === 'completed' || state === 'failed';
  function stopPlayback() {
    clearInterval(playback);
    playback = undefined;
  }
  function playForward() {
    following = false;
    playback = setInterval(() => {
      if (index < run.events.length - 1) index++;
      if (index >= run.events.length - 1) {
        stopPlayback();
        following = run.status === 'running';
      }
      render();
    }, 1400);
  }
  get('end').addEventListener('click', () => {
    select(run.events.length - 1);
    get('title').focus();
  });
  function select(step) {
    stopPlayback();
    following = false;
    index = step;
    render();
  }
  scrub.addEventListener('input', () => select(Number(scrub.value) - 1));
  eventList.addEventListener('click', event => {
    const button = event.target.closest('button[data-index]');
    if (button) select(Number(button.dataset.index));
  });
  get('live').addEventListener('click', () => {
    stopPlayback();
    following = true;
    index = run.events.length - 1;
    render();
  });
  play.addEventListener('click', () => {
    if (!run?.events.length) return;
    if (playback || (following && !terminal(run.status))) {
      stopPlayback();
      following = false;
    } else if (!terminal(run.status) && index >= run.events.length - 1) {
      following = true;
    } else {
      following = false;
      if (index >= run.events.length - 1) index = 0;
      playForward();
    }
    render();
  });

  function addActivity(previousCount) {
    const fragment = document.createDocumentFragment();
    for (let i = run.events.length - 1; i >= previousCount; i--) {
      const item = run.events[i];
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'watch-event';
      button.dataset.index = i;
      button.append(element('span', 'watch-event-num', String(item.seq)), element('span', 'watch-event-label', item.title));
      if (item.at) button.title = new Date(item.at).toLocaleString();
      row.append(button);
      fragment.append(row);
    }
    eventList.prepend(fragment);
  }
  function render() {
    const events = run.events;
    const item = events[index];
    get('status').textContent = run.status === 'stale' && run.kind === 'solver' ? 'Interrupted' : (statusNames[run.status] ?? run.status);
    get('status').dataset.state = run.status;
    const intro = get('intro');
    if (intro) intro.hidden = run.kind !== 'solver';
    get('kind').textContent = (run.kind === 'solver' ? 'Solver' : 'Agent') + (terminal(run.status) ? ' replay' : ' run');
    get('start').hidden = run.kind !== 'solver' || (run.status !== 'stale' && !terminal(run.status));
    get('empty').hidden = events.length > 0;
    const updated = get('updated');
    updated.hidden = !run.updatedAt;
    if (run.updatedAt) {
      const date = new Date(run.updatedAt);
      updated.textContent = 'Last update ' + date.toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
    }
    get('step').textContent = item ? 'Step ' + (index + 1) + ' of ' + events.length : 'No steps yet';
    get('phase').textContent = item ? (run.kind === 'solver' && Object.hasOwn(phases, item.phase) ? phases[item.phase] : item.phase ?? '') : '';
    get('title').textContent = item?.title ?? (terminal(run.status) ? 'Run ended' : 'Waiting for the first step');
    get('detail').textContent = item?.detail ?? '';
    scrub.disabled = events.length < 2;
    scrub.max = Math.max(1, events.length);
    scrub.value = index + 1;
    scrub.setAttribute('aria-valuetext', item ? 'Step ' + item.seq + ', ' + item.title : 'No steps yet');
    play.disabled = !events.length || (events.length === 1 && terminal(run.status));
    play.textContent = playback || (following && !terminal(run.status)) ? 'Pause' : index === events.length - 1 ? (terminal(run.status) ? 'Replay' : 'Resume') : 'Play';
    get('end').hidden = !terminal(run.status) || index >= events.length - 1;
    get('live').textContent = run.status === 'stale' ? 'Latest step' : 'Jump to live';
    get('live').hidden = following || terminal(run.status) || !events.length;
    previousButton?.removeAttribute('aria-current');
    previousButton = eventList.querySelector('[data-index="' + index + '"]');
    previousButton?.setAttribute('aria-current', 'step');
    const graph = get('graph');
    const frame = item?.frame;
    graph.hidden = !frame?.vertices?.length;
    if (!graph.hidden) drawGraph(graph, frame);
    const checks = frame?.checks || [];
    get('checks-section').hidden = !checks.length;
    get('checks').replaceChildren(...checks.map(check => {
      const li = document.createElement('li');
      li.append(element('span', 'watch-check-mark' + (check.passed ? '' : ' failed'), check.passed ? '✓' : '×'), element('span', 'sr-only', check.passed ? 'Passed. ' : 'Failed. '), document.createTextNode(check.label));
      li.firstChild.setAttribute('aria-hidden', 'true');
      return li;
    }));
  }
  async function update() {
    let delay = 1800;
    try {
      const response = await fetch('/api/watch/' + encodeURIComponent(id), {cache: 'no-store'});
      if (!response.ok) throw new Error('Unable to load run');
      const next = await response.json();
      if (stopped) return;
      const previousCount = run?.events.length ?? 0;
      const changed = !run || !get('feedback').hidden || previousCount !== next.events.length || run.status !== next.status;
      run = next;
      get('feedback').hidden = true;
      if (changed) {
        if (next.events.length < previousCount) eventList.replaceChildren();
        addActivity(next.events.length < previousCount ? 0 : previousCount);
        index = following ? Math.max(0, next.events.length - 1) : Math.max(0, Math.min(index, next.events.length - 1));
        if (!previousCount && id === 'example' && next.events.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          index = 0;
          playForward();
        }
        render();
      }
      if (terminal(run.status)) return;
      if (run.status === 'stale') delay = 6000;
    } catch {
      if (stopped) return;
      if (!run) {
        get('status').textContent = 'Disconnected';
        get('title').textContent = 'Couldn’t load this run';
      } else {
        get('status').textContent = 'Reconnecting';
        get('status').removeAttribute('data-state');
      }
      get('feedback').textContent = 'Connection interrupted. Retrying in a few seconds.';
      get('feedback').hidden = false;
      delay = 4000;
    }
    if (!stopped) pollTimer = setTimeout(update, delay);
  }
  window.addEventListener('pagehide', () => { stopped = true; clearTimeout(pollTimer); stopPlayback(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { stopped = false; update(); } });
  update();
}

function element(tag, cls, text) {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
}

function drawGraph(container, frame) {
  const svgNS = 'http://www.w3.org/2000/svg';
  function svgElement(tag, attributes, text) {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const selected = new Set(frame.highlighted || []);
  const graph = svgElement('svg', {viewBox: '0 0 520 285', role: 'img', 'aria-labelledby': 'watch-graph-title watch-graph-desc'});
  const literals = n => (n < 0 ? '¬' : '') + 'x' + Math.abs(n);
  const picked = frame.vertices.filter(v => selected.has(v.id)).map(v => 'clause ' + (v.clause + 1) + ', ' + literals(v.literal));
  graph.append(svgElement('title', {id: 'watch-graph-title'}, 'Clause compatibility graph'), svgElement('desc', {id: 'watch-graph-desc'}, frame.vertices.length + ' vertices and ' + frame.edges.length + ' edges. ' + (picked.length ? 'Highlighted: ' + picked.join('; ') + '.' : 'No highlighted vertices.')));
  const centres = [[132,83], [388,83], [132,203], [388,203]];
  const positions = new Map();
  for (const [clause, [cx, cy]] of centres.entries()) {
    const group = frame.vertices.filter(vertex => vertex.clause === clause);
    group.forEach((vertex, i) => positions.set(vertex.id, {x: cx + (i-1)*55, y: cy + (i===1 ? (clause < 2 ? -18 : 18) : 0)}));
    graph.append(svgElement('text', {x: cx, y: clause < 2 ? 28 : 266, class: 'watch-clause-label'}, 'Clause ' + (clause + 1)));
  }
  const unselectedEdges = svgElement('g', {});
  const selectedEdges = svgElement('g', {});
  for (const [a,b] of frame.edges) {
    const start = positions.get(a), end = positions.get(b);
    if (!start || !end) continue;
    const active = selected.has(a) && selected.has(b);
    (active ? selectedEdges : unselectedEdges).append(svgElement('line', {x1:start.x,y1:start.y,x2:end.x,y2:end.y,class:'watch-edge' + (active ? ' selected' : '')}));
  }
  graph.append(unselectedEdges, selectedEdges);
  for (const vertex of frame.vertices) {
    const point = positions.get(vertex.id);
    if (!point) continue;
    const style = selected.has(vertex.id) ? ' selected' : '';
    graph.append(svgElement('circle', {cx:point.x,cy:point.y,r:19,class:'watch-node' + style}), svgElement('text', {x:point.x,y:point.y,class:'watch-node-label' + style}, literals(vertex.literal)));
  }
  const key = document.createElement('div');
  key.className = 'watch-graph-key';
  key.append(element('span', '', 'Highlighted vertices'), element('span', '', frame.edges.length + ' edges'));
  container.replaceChildren(graph, key);
}
