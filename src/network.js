/* The featured projects are rendered like an exploded diagram. Each layer is
   painted once at full resolution and projected onto the same work surface. */
const plateWidth = 500;
const plateHeight = 360;
const stageWidth = 700;
const stageHeight = 460;
const palette = ['#be9aff', '#80e7c7', '#ffc18c'];
const layerNames = [
  ['Witness', 'Graph', 'Vertices'],
  ['Trajectory', 'Rule', 'Seed'],
  ['Galaxy', 'Orbits', 'Halo model']
];

function pathThrough(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
}

// Traces and terminals belong to the illustration. They carry no activity data.
const traces = [
  [[4, 250], [73, 229], [106, 246], [175, 225], [225, 249]],
  [[51, 350], [106, 332], [122, 340], [202, 316], [245, 336], [276, 327]],
  [[125, 390], [182, 373], [219, 390], [290, 368], [331, 387], [359, 378]],
  [[654, 115], [596, 133], [575, 122], [515, 141], [477, 123]],
  [[697, 239], [638, 257], [593, 234], [563, 243], [527, 225]],
  [[645, 337], [597, 313], [572, 321], [531, 300], [503, 309]],
  [[68, 201], [107, 220], [143, 208], [171, 222]],
  [[602, 166], [578, 154], [553, 162], [524, 147]]
].map(points => {
  let length = 0;
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    cumulative.push(length);
  }
  return { points, cumulative, length };
});

function tracePosition(trace, distance) {
  let end = 1;
  while (end < trace.cumulative.length - 1 && distance > trace.cumulative[end]) end++;
  const segment = trace.cumulative[end] - trace.cumulative[end - 1];
  const amount = (distance - trace.cumulative[end - 1]) / segment;
  const [x, y] = trace.points[end - 1];
  return [x + (trace.points[end][0] - x) * amount, y + (trace.points[end][1] - y) * amount];
}

function buildFloor(accent) {
  const floor = document.createElement('canvas');
  const resolution = 1.5;
  floor.width = stageWidth * resolution;
  floor.height = stageHeight * resolution;
  const ctx = floor.getContext('2d');
  ctx.scale(resolution, resolution);
  const light = ctx.createRadialGradient(360, 251, 0, 360, 251, 273);
  light.addColorStop(0, accent + '2b');
  light.addColorStop(.54, accent + '10');
  light.addColorStop(1, accent + '00');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, stageWidth, stageHeight);

  for (let i = -17; i <= 17; i++) {
    for (let j = -17; j <= 17; j++) {
      const x = 350 + i * 15.2 + j * 11.2;
      const y = 271 - i * 4.8 + j * 6.2;
      const strength = 1 - Math.hypot((x - 350) / 353, (y - 255) / 180);
      if (strength <= 0) continue;
      ctx.globalAlpha = strength * .47;
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, 1.1, 1.1);
    }
  }
  ctx.globalAlpha = 1;
  for (const { points } of traces) {
    pathThrough(ctx, points);
    ctx.strokeStyle = accent + '4c';
    ctx.lineWidth = .9;
    ctx.stroke();
    const [x, y] = points[0];
    ctx.fillStyle = '#0f0e15';
    ctx.strokeStyle = accent + '88';
    ctx.beginPath();
    ctx.arc(x, y, 2.3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
  return floor;
}

function drawPackets(ctx, accent, time) {
  traces.forEach((trace, index) => {
    const progress = (time * (.13 + index % 3 * .015) + index * .247) % 1;
    const tip = progress * trace.length;
    const tail = Math.max(0, tip - 15);
    const start = tracePosition(trace, tail);
    const end = tracePosition(trace, tip);
    const trail = [start];
    for (let i = 1; i < trace.points.length; i++) {
      if (trace.cumulative[i] > tail && trace.cumulative[i] < tip) trail.push(trace.points[i]);
    }
    trail.push(end);
    pathThrough(ctx, trail);
    ctx.strokeStyle = accent + '9c';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(end[0], end[1], 1.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawStack(ctx, plates, index, time, openness, drift, scale) {
  const accent = palette[index];
  const ax = .506 + drift.x * .014;
  const ay = -.158 + drift.y * .012;
  const bx = .37 - drift.x * .026;
  const by = .31 + drift.y * .018;
  const centerX = 340 + drift.x * 7;
  const baseY = 289 + Math.sin(time * .55) * 2 + drift.y * 3;
  const gap = 7 + openness * (43 + Math.sin(time * .8) * 2.1 + drift.y * 2);
  const offset = openness * (6 + drift.x * 7);
  const faceX = centerX - (plateWidth * ax + plateHeight * bx) / 2;
  const faceY = baseY - (plateWidth * ay + plateHeight * by) / 2;

  // Fine registration lines link matching corners of the three planes.
  for (const [u, v] of [[18, 20], [480, 20], [20, 340], [480, 340]]) {
    const x = faceX + u * ax + v * bx;
    const y = faceY + u * ay + v * by;
    pathThrough(ctx, [[x, y], [x + 2 * offset, y - 2 * gap]]);
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = accent + '75';
    ctx.lineWidth = .9;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (let i = 0; i < plates.length; i++) {
    const x = faceX + i * offset;
    const y = faceY - i * gap;
    ctx.save();
    ctx.transform(ax, ay, bx, by, x, y);
    ctx.fillStyle = i === 2 ? accent + '9e' : '#3d3444';
    ctx.beginPath();
    ctx.roundRect(10, 16, 480, 340, 12);
    ctx.fill();
    ctx.drawImage(plates[i], 0, 0);
    ctx.restore();
  }

  // Annotate the exploded layers once there is enough room between the rules.
  if (openness > .45) {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, (openness - .45) * 2.5);
    const labelSize = Math.max(14, 11 / scale);
    ctx.font = labelSize + 'px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const startX = faceX + 482 * ax + 316 * bx;
    const startY = faceY + 482 * ay + 316 * by;
    for (let i = 0; i < 3; i++) {
      const x = startX + i * offset + 9;
      const y = startY - i * gap;
      pathThrough(ctx, [[x, y], [x + 13, y - 5], [559, y - 5]]);
      ctx.strokeStyle = accent + '66';
      ctx.lineWidth = .8;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillStyle = '#dcd8e2';
      const name = layerNames[index][2 - i];
      ctx.fillText(name, 566, y - 5);
    }
    ctx.restore();
  }
}

export function initNetwork(canvas) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return () => {};

  const buildScenes = [pathPlates, collatzPlates, galaxyPlates];
  const scenes = new Array(buildScenes.length);
  const floors = [];
  const drift = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let width = 0, height = 0, ratio = 1;
  let current = 0, previous = 0, elapsed = 0, transition = .15;
  let firstUpdate = true;
  let running = false, visible = true, frame = 0, last = null;

  function loadScene(index) {
    scenes[index] ??= buildScenes[index]();
    floors[index] ??= buildFloor(palette[index]);
  }

  function paint() {
    if (!width || !height) return;
    loadScene(current);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    // A short, wide phone stage crops the outer traces to keep the project legible.
    const compact = height < 238 && width / height > 1.4;
    const scale = compact ? Math.min(width / 620, height / 322) : Math.min(width / stageWidth, height / stageHeight);
    const focusX = compact ? 378 : stageWidth / 2;
    const focusY = compact ? 246 : stageHeight / 2;
    ctx.translate(width / 2 - focusX * scale, height / 2 - focusY * scale);
    ctx.scale(scale, scale);
    ctx.drawImage(floors[current], 0, 0, stageWidth, stageHeight);
    drawPackets(ctx, palette[current], elapsed);
    const progress = Math.min(1, transition / .86);
    const ease = value => 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
    // Fold the outgoing layers together, then open the selected project.
    if (previous !== current && progress < .38) {
      loadScene(previous);
      ctx.save();
      ctx.globalAlpha = 1 - ease(progress / .38);
      drawStack(ctx, scenes[previous], previous, elapsed, 1 - ease(progress / .38), drift, scale);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = previous === current ? 1 : ease((progress - .1) / .29);
    drawStack(ctx, scenes[current], current, elapsed, ease((progress - .1) / .9), drift, scale);
    ctx.restore();
  }

  function tick(now) {
    frame = 0;
    if (last === null) last = now;
    const delta = now - last;
    if (delta >= 1000 / 30 - 1) {
      const step = Math.min(delta / 1000, .08);
      elapsed += step;
      transition += step;
      drift.x += (target.x - drift.x) * .13;
      drift.y += (target.y - drift.y) * .13;
      last = now;
      paint();
    }
    frame = requestAnimationFrame(tick);
  }

  function update() {
    if (running && visible && !document.hidden) {
      if (!frame) {
        last = null;
        frame = requestAnimationFrame(tick);
      }
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      last = null;
    }
  }

  new ResizeObserver(([entry]) => {
    ({ width, height } = entry.contentRect);
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    paint();
    update();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(canvas);
  document.addEventListener('visibilitychange', update);

  const hero = canvas.closest('[data-hero]');
  hero?.addEventListener('pointermove', event => {
    if (!running || event.pointerType !== 'mouse') return;
    const bounds = hero.getBoundingClientRect();
    target.x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    target.y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
  }, { passive: true });
  hero?.addEventListener('pointerleave', () => { target.x = target.y = 0; });
  return (index, shouldRun) => {
    const next = index % scenes.length;
    if (current !== next) {
      previous = current;
      current = next;
      transition = shouldRun ? 0 : .9;
    }
    if (!shouldRun && (firstUpdate || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) transition = .9;
    firstUpdate = false;
    running = shouldRun;
    if (visible) paint();
    update();
  };
}
// Each illustration is drawn once and projected onto the animated layers.
function exhibitPlate(paper, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  const fill = ctx.createLinearGradient(40, 0, 450, 360);
  fill.addColorStop(0, paper[0]);
  fill.addColorStop(1, paper[1]);
  ctx.beginPath();
  ctx.roundRect(8, 8, 484, 344, 14);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  draw(ctx);
  ctx.restore();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath();
  ctx.roundRect(8.7, 8.7, 482.6, 342.6, 13.3);
  ctx.stroke();
  return canvas;
}

function exhibitText(ctx, value, x, y, size, color, weight = 500, align = 'left', mono = false) {
  ctx.font = weight + ' ' + size + 'px ' + (mono ? 'ui-monospace, Menlo, monospace' : '"Space Grotesk", Arial, sans-serif');
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function dot(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// An explicit Hamiltonian path. The edges in the witness join every vertex once.
function pathPlates() {
  const points = [[66, 178], [132, 92], [235, 134], [348, 83], [424, 193], [275, 264], [150, 252]];
  const edges = [[0, 2], [0, 6], [1, 5], [2, 4], [2, 5], [3, 5]];
  function graph(paper, stage) {
    return exhibitPlate(paper, ctx => {
      if (stage > 0) {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#92809f';
        for (const [a, b] of edges) {
          pathThrough(ctx, [points[a], points[b]]);
          ctx.stroke();
        }
        pathThrough(ctx, points);
        ctx.strokeStyle = stage === 2 ? '#582e83' : '#9486a7';
        ctx.lineWidth = stage === 2 ? 8 : 3;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      points.forEach(([x, y], i) => {
        dot(ctx, x, y, 17, stage === 2 ? '#482464' : '#5d4b74');
        exhibitText(ctx, String(i + 1), x, y + 7, 20, '#f6edff', 650, 'center', true);
      });
      exhibitText(ctx, ['7 vertices', 'Undirected graph', 'A path through every vertex'][stage], 40, 323, 26, stage === 2 ? '#512968' : '#fff1ff', 650);
    });
  }
  return [graph(['#453b5a', '#2e253b'], 0), graph(['#847399', '#695878'], 1), graph(['#f3e9ff', '#b69acb'], 2)];
}

function collatzPlates() {
  const values = [7];
  while (values.at(-1) > 1) {
    const n = values.at(-1);
    values.push(n % 2 ? 3 * n + 1 : n / 2);
  }
  const seed = exhibitPlate(['#32554f', '#183b34'], ctx => {
    exhibitText(ctx, 'Starting number', 42, 82, 28, '#c0ded0', 600);
    exhibitText(ctx, String(values[0]), 38, 251, 164, '#e0f6e6', 650);
  });
  const rules = exhibitPlate(['#a0d3b8', '#6fac90'], ctx => {
    exhibitText(ctx, 'Even', 43, 107, 31, '#235445', 600);
    exhibitText(ctx, 'n / 2', 460, 107, 42, '#12392d', 650, 'right', true);
    exhibitText(ctx, 'Odd', 43, 233, 31, '#235445', 600);
    exhibitText(ctx, '3n + 1', 460, 233, 42, '#12392d', 650, 'right', true);
  });
  const trajectory = exhibitPlate(['#e6f8dc', '#a8d6b9'], ctx => {
    exhibitText(ctx, '7 reaches 1', 37, 66, 41, '#164335', 650);
    const high = Math.max(...values);
    const points = values.map((n, i) => [42 + 415 * i / (values.length - 1), 261 - 155 * n / high]);
    for (let y = 111; y < 270; y += 50) {
      pathThrough(ctx, [[40, y], [461, y]]);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = '#8abb9f';
      ctx.stroke();
    }
    pathThrough(ctx, points);
    ctx.strokeStyle = '#205e45';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.stroke();
    points.forEach(([x, y]) => dot(ctx, x, y, 4, '#1d634b'));
    exhibitText(ctx, 'Start 7', 38, 318, 21, '#275642', 600);
    exhibitText(ctx, String(values.length - 1) + ' steps', 464, 318, 21, '#275642', 600, 'right');
  });
  return [seed, rules, trajectory];
}

// A schematic disk and halo. The public measurements live in the research brief.
function galaxyPlates() {
  const cx = 250, cy = 172;
  const halo = exhibitPlate(['#303344', '#211d31'], ctx => {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 164);
    glow.addColorStop(0, '#edb690');
    glow.addColorStop(.26, '#ac787d');
    glow.addColorStop(.64, '#4d405c');
    glow.addColorStop(1, '#34304800');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, plateWidth, plateHeight);
    for (const radius of [59, 99, 141]) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#debbbd7a';
      ctx.setLineDash([6, 7]);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  });
  const orbits = exhibitPlate(['#5d4147', '#312735'], ctx => {
    for (let ring = 1; ring <= 6; ring++) {
      const radius = 15 + 27 * ring;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius, radius * .7, -.16, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e6c0a899';
      ctx.lineWidth = 2;
      ctx.stroke();
      const angle = ring * 2.5;
      const x = radius * Math.cos(angle), y = radius * .7 * Math.sin(angle);
      dot(ctx, cx + x * Math.cos(.16) + y * Math.sin(.16), cy - x * Math.sin(.16) + y * Math.cos(.16), 4.5, '#ffd7af');
    }
  });
  const disk = exhibitPlate(['#353047', '#1a1b2a'], ctx => {
    let seed = 3729;
    function random() {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (let i = 0; i < 240; i++) dot(ctx, 12 + 476 * random(), 12 + 336 * random(), .6 + 1.2 * random(), '#d9c6c78f');
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 163);
    bloom.addColorStop(0, '#ffe4c6'); bloom.addColorStop(.12, '#d4a28e'); bloom.addColorStop(.42, '#825b7399'); bloom.addColorStop(1, '#705a7700');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.22, .75);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = bloom;
    ctx.fillRect(40, -30, 420, 410);
    for (let i = 0; i < 3500; i++) {
      const radius = 164 * Math.sqrt(random());
      const angle = i % 2 * Math.PI + radius * .025 + (random() - .5) * (.5 + 15 / (radius + 12));
      const color = ['#fff1cddd', '#eac9bca0', '#b292bd90', '#d6aed690'][i % 4];
      dot(ctx, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), .65 + random() * 1.6, color);
    }
    ctx.restore();
    exhibitText(ctx, 'Spiral galaxy · illustration', 38, 321, 23, '#f4d9c5', 600);
  });
  return [halo, orbits, disk];
}
