/* The featured projects are rendered like an exploded diagram. Each layer is
   painted once at full resolution and projected onto the same work surface. */
const plateWidth = 500;
const plateHeight = 360;
const stageWidth = 700;
const stageHeight = 460;
const palette = ['#be9aff', '#80e7c7', '#ffc18c'];
const layerNames = [
  ['Photo', 'Mask', 'Base'],
  ['Budget', 'Ledger', 'Import'],
  ['Changes', 'Insert', 'Original']
];

function newPlate() {
  const surface = document.createElement('canvas');
  surface.width = plateWidth;
  surface.height = plateHeight;
  return surface;
}

function plateFrame(ctx, fill, edge) {
  ctx.beginPath();
  ctx.roundRect(10, 10, 480, 340, 12);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function pathThrough(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
}

function satelliteLayers(photo) {
  const layers = [newPlate(), newPlate(), newPlate()];
  const [base, mask, image] = layers.map(layer => layer.getContext('2d'));

  plateFrame(base, '#312840', '#ccbae4');
  base.save();
  base.clip();
  for (let y = 10; y < 350; y += 22) {
    for (let x = 10; x < 490; x += 22) {
      base.fillStyle = ((x - 10) / 22 + (y - 10) / 22) % 2 ? '#5d5172' : '#3d354f';
      base.fillRect(x, y, 22, 22);
    }
  }
  base.restore();

  plateFrame(mask, '#262737', '#b2a7d4');
  mask.save();
  mask.clip();
  const field = mask.createRadialGradient(276, 190, 29, 276, 190, 197);
  field.addColorStop(0, '#efede9');
  field.addColorStop(.46, '#c2bfd3');
  field.addColorStop(.68, '#726781');
  field.addColorStop(1, '#282733');
  mask.fillStyle = field;
  mask.fillRect(10, 10, 480, 340);
  mask.restore();

  plateFrame(image, '#ddd6eb', '#f5ebff');
  image.save();
  image.beginPath();
  image.roundRect(15, 15, 470, 330, 8);
  image.clip();
  // Start with a recognizable mask contour while the local satellite photo loads.
  image.fillStyle = '#24243c';
  image.fillRect(15, 15, 470, 330);
  if (photo) {
    // Crop around the Richat Structure so the eye is visible on phone screens.
    image.drawImage(photo, 280, 170, 815, 573, 15, 15, 470, 330);
    // A restrained lavender grade keeps the topography and original highlights.
    image.globalCompositeOperation = 'color';
    image.fillStyle = '#8f7cc6';
    image.globalAlpha = .82;
    image.fillRect(15, 15, 470, 330);
    image.globalCompositeOperation = 'source-over';
    image.globalAlpha = 1;
  } else {
    for (let i = 0; i < 30; i++) {
      image.strokeStyle = i % 4 ? '#797288' : '#ccc0de';
      image.beginPath();
      image.ellipse(258, 181, 17 + i * 7.6, 12 + i * 6.3, -.34, 0, Math.PI * 2);
      image.stroke();
    }
  }
  image.restore();
  image.strokeStyle = '#fff8';
  image.lineWidth = 2;
  for (const [x, y, dx, dy] of [[30, 30, 1, 1], [470, 30, -1, 1], [30, 330, 1, -1], [470, 330, -1, -1]]) {
    pathThrough(image, [[x + dx * 14, y], [x, y], [x, y + dy * 14]]);
    image.stroke();
  }
  return layers;
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

  const scenes = [satelliteLayers(null), null, null];
  const floors = [];
  const drift = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let width = 0, height = 0, ratio = 1;
  let current = 0, previous = 0, elapsed = 0, transition = .15;
  let firstUpdate = true;
  let running = false, visible = true, frame = 0, last = null;

  function loadScene(index) {
    if (!scenes[index]) scenes[index] = index === 1 ? buildBudgetPlates() : buildPdfPlates();
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
  const photo = new Image();
  photo.onload = () => {
    scenes[0] = satelliteLayers(photo);
    if (visible && (current === 0 || previous === 0)) paint();
  };
  photo.src = '/media/richat.jpg';

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
// The six surfaces are drawn once. The exhibit positions and animates the cached plates.
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

function exhibitRule(ctx, x, y, end, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, end - x, 1.5);
}

function buildBudgetPlates() {
  const dark = '#133c35';
  const ink = '#0b342a';
  const mid = '#366451';
  const names = ['Studio', 'Market', 'Transit'];
  const amounts = [120, 64, 24];
  const spend = amounts.reduce((sum, amount) => sum + amount, 0);
  const plan = 300;
  const colors = ['#164c3a', '#4b9472', '#81c79d', '#d2e6c9'];

  const raw = exhibitPlate(['#295948', '#143a34'], ctx => {
    exhibitText(ctx, 'Checking.csv', 38, 67, 32, '#e0fce4', 700);
    exhibitRule(ctx, 38, 91, 462, '#709684');
    exhibitText(ctx, 'Date', 38, 138, 17, '#b3d7bc', 600, 'left', true);
    exhibitText(ctx, 'Description', 137, 138, 17, '#b3d7bc', 600, 'left', true);
    exhibitText(ctx, 'Amount', 460, 138, 17, '#b3d7bc', 600, 'right', true);
    names.forEach((name, i) => {
      const y = 179 + i * 40;
      exhibitText(ctx, ['11/02', '11/06', '11/08'][i], 38, y, 20, '#d5efdc', 500, 'left', true);
      exhibitText(ctx, name, 137, y, 20, '#d5efdc', 500, 'left', true);
      exhibitText(ctx, '−' + amounts[i] + '.00', 460, y, 20, '#d5efdc', 500, 'right', true);
    });
    exhibitRule(ctx, 38, 286, 462, '#709684');
    exhibitText(ctx, 'Source file', 38, 322, 20, '#c0dcc6', 600);
    exhibitText(ctx, '3 rows', 460, 322, 20, '#c0dcc6', 600, 'right');
  });

  const ledger = exhibitPlate(['#85c7a1', '#529c79'], ctx => {
    exhibitText(ctx, 'Import preview', 38, 67, 32, ink, 700);
    exhibitRule(ctx, 38, 91, 462, '#478467');
    names.forEach((name, i) => {
      const y = 145 + i * 56;
      ctx.beginPath();
      ctx.roundRect(40, y - 22, 28, 28, 6);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(47, y - 9);
      ctx.lineTo(52, y - 4);
      ctx.lineTo(61, y - 14);
      ctx.strokeStyle = '#d3f1ce';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      exhibitText(ctx, name, 84, y, 24, ink, 600);
      exhibitText(ctx, '$' + amounts[i] + '.00', 460, y, 24, ink, 600, 'right');
      exhibitRule(ctx, 38, y + 18, 462, '#64a380');
    });
    exhibitText(ctx, '3 transactions', 38, 323, 20, dark, 600);
    exhibitText(ctx, '$' + spend + '.00', 460, 323, 21, ink, 700, 'right');
  });

  const budget = exhibitPlate(['#e4f4d8', '#a8d5b5'], ctx => {
    exhibitText(ctx, 'Monthly budget', 38, 66, 34, ink, 700);
    exhibitRule(ctx, 38, 89, 462, '#9cbfa6');
    exhibitText(ctx, 'Spent', 38, 146, 19, mid, 600);
    exhibitText(ctx, '$' + spend, 35, 212, 66, ink, 700);
    exhibitText(ctx, 'of $' + plan + ' planned', 39, 247, 19, mid, 500);

    const cx = 363;
    const cy = 189;
    let angle = -Math.PI / 2;
    [...amounts, plan - spend].forEach((amount, i) => {
      const end = angle + 2 * Math.PI * amount / plan;
      ctx.beginPath();
      ctx.arc(cx, cy, 65, angle + .021, end - .021);
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 35;
      ctx.stroke();
      angle = end;
    });
    exhibitText(ctx, Math.round(spend / plan * 100) + '%', cx, cy + 9, 27, ink, 700, 'center');

    exhibitRule(ctx, 38, 288, 462, '#9cbfa6');
    names.forEach((name, i) => {
      const x = [39, 184, 336][i];
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, 309, 15, 15);
      exhibitText(ctx, name, x + 24, 323, 19, dark, 600);
    });
  });
  return [raw, ledger, budget];
}

// Parallel contour lines, made specifically for the two versions of the field note.
function exhibitTerrain(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.clip();
  ctx.fillStyle = '#e9b189';
  ctx.fillRect(x, y, w, h);
  const cx = x + w * .55;
  const cy = y + h * .54;
  for (let ring = 20; ring > 0; ring--) {
    const radius = (ring / 20) * .9;
    ctx.beginPath();
    for (let point = 0; point <= 180; point++) {
      const t = point / 180 * Math.PI * 2;
      const relief = 1 + .23 * Math.sin(t * 2.0 + .45) + .08 * Math.cos(t * 5 - radius * 2.4)
        + .062 * Math.sin(t * 3.0 + radius * 3) + .035 * Math.cos(t * 7.0 + radius);
      const px = cx + w * radius * relief * Math.cos(t);
      const py = cy + h * radius * relief * Math.sin(t) * .72;
      if (point === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (ring === 16 || ring === 10 || ring === 4) {
      ctx.fillStyle = ['#e8a176', '#e18e66', '#b6684d'][[16, 10, 4].indexOf(ring)];
      ctx.fill();
    }
    ctx.lineWidth = ring % 5 === 0 ? 2 : 1.15;
    ctx.strokeStyle = ring % 5 === 0 ? '#985e49' : '#b57859';
    ctx.stroke();
  }
  ctx.restore();
}

function buildPdfPlates() {
  const ink = '#4b291e';
  const mid = '#835d4e';
  const rule = '#cda98d';

  function fieldNote(revised) {
    return exhibitPlate(revised ? ['#fff0d5', '#efd1b0'] : ['#f4c29e', '#d89b79'], ctx => {
      exhibitText(ctx, 'Field notes', 38, 68, 36, ink, 700);
      exhibitText(ctx, revised ? 'v2' : 'v1', 461, 64, 24, mid, 600, 'right', true);
      exhibitRule(ctx, 38, 90, 462, rule);
      exhibitText(ctx, 'Survey route', 38, 145, 20, mid, 600);
      if (revised) {
        ctx.fillStyle = '#e9b99e';
        ctx.fillRect(38, 166, 177, 35);
        exhibitText(ctx, '− East ridge', 46, 191, 23, '#773c31', 600);
        ctx.fillStyle = '#773c31';
        ctx.fillRect(68, 182, 123, 2);
        ctx.fillStyle = '#b8cd98';
        ctx.fillRect(38, 208, 181, 38);
        exhibitText(ctx, '+ West ridge', 46, 235, 23, '#365137', 650);
      } else {
        exhibitText(ctx, 'East ridge', 38, 206, 27, ink, 600);
      }
      exhibitTerrain(ctx, 248, 113, 213, 152);
      exhibitRule(ctx, 38, 288, 462, rule);
      exhibitText(ctx, revised ? 'Revised document' : 'Original document', 38, 323, 21, mid, 600);
      exhibitText(ctx, revised ? 'p. 03' : 'p. 02', 460, 323, 20, ink, 600, 'right', true);
    });
  }

  const inserted = exhibitPlate(['#e8aa7d', '#c77c59'], ctx => {
    exhibitText(ctx, 'Elevation profile', 38, 68, 32, ink, 700);
    exhibitText(ctx, 'v2', 461, 64, 24, mid, 600, 'right', true);
    exhibitRule(ctx, 38, 90, 462, '#a97255');
    [139, 185, 231].forEach(y => exhibitRule(ctx, 38, y, 462, '#d49470'));
    const profile = [[38, 247], [88, 201], [117, 216], [167, 157], [208, 174],
      [255, 128], [279, 155], [323, 117], [368, 169], [397, 144], [462, 210]];
    ctx.beginPath();
    profile.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = '#784a37';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineTo(462, 260);
    ctx.lineTo(38, 260);
    ctx.closePath();
    ctx.fillStyle = 'rgba(139,72,45,.2)';
    ctx.fill();
    exhibitRule(ctx, 38, 288, 462, '#a97255');
    exhibitText(ctx, 'Inserted page', 38, 323, 21, ink, 600);
    exhibitText(ctx, 'p. 02', 460, 323, 20, ink, 600, 'right', true);
  });
  return [fieldNote(false), inserted, fieldNote(true)];
}
