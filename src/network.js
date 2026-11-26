export function initNetwork(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const palette = ['#bba4ff', '#84eada', '#ffd79d', '#cca6f7', '#8fbcff', '#fac2e8'];
  const origins = [
    [-.49, -.32], [-.51, .23], [-.17, -.43],
    [.47, -.26], [.49, .24], [.07, .40]
  ];
  const nodes = [{ x: 0, y: 0, color: '#e1d3ff', size: 5.7 }];
  const edges = [];
  const dust = [];
  let seed = 8197;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 146; i++) {
    dust.push({ x: random() - .5, y: random() - .5, strength: random() });
  }
  origins.forEach(([x, y], group) => {
    const color = palette[group];
    let parent = 0;
    for (const scale of [.38, .72, 1]) {
      const node = { x: x * scale, y: y * scale + (random() - .5) * .11, color, size: 1.9 + random() * 2.2 };
      const index = nodes.push(node) - 1;
      edges.push({ a: parent, b: index, color, phase: group * .17 + scale, lead: true });
      parent = index;
    }
    for (let i = 0; i < 5; i++) {
      const bearing = (i + random() * .6) * Math.PI * .4;
      const reach = .045 + random() * .115;
      const node = { x: x + Math.cos(bearing) * reach, y: y + Math.sin(bearing) * reach, color, size: .9 + random() * 1.55 };
      const index = nodes.push(node) - 1;
      edges.push({ a: parent, b: index, color, phase: group * .23 + i * .19 });
      if (i) edges.push({ a: index - 1, b: index, color, phase: group * .11 });
    }
  });
  for (const [a, b] of [[2, 18], [10, 42], [18, 26], [26, 34], [34, 42], [10, 1], [9, 34]]) {
    edges.push({ a, b, color: '#aaa2d5', phase: a * .1 });
  }

  let width = 0;
  let height = 0;
  let visible = true;
  let running = false;
  let frame = 0;
  let featured = 0;
  let recentTime = 0;

  function paint(time) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const centerX = width * .53;
    const centerY = height * .5;
    const scale = Math.min(width * .7, height * .94);
    const color = palette[featured % palette.length];
    const haze = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * .72);
    haze.addColorStop(0, color + '25');
    haze.addColorStop(.4, '#8972da13');
    haze.addColorStop(1, '#00000000');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    for (const dot of dust) {
      ctx.fillStyle = dot.strength > .94 ? '#c5b4ff72' : '#a89acb32';
      const size = dot.strength > .94 ? 1.15 : .7;
      ctx.fillRect(centerX + dot.x * width * .97, centerY + dot.y * height * .93, size, size);
    }

    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = '#bda8fa30';
    for (const radius of [.22, .38, .54]) {
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, scale * radius, scale * radius * .61, -.33, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const points = nodes.map((node, index) => ({
      ...node,
      x: centerX + (node.x + Math.sin(time * .45 + index) * .011) * scale,
      y: centerY + (node.y + Math.cos(time * .55 + index) * .012) * scale
    }));
    for (const edge of edges) {
      const start = points[edge.a];
      const end = points[edge.b];
      ctx.strokeStyle = edge.color + (edge.lead ? '79' : '36');
      ctx.lineWidth = edge.lead ? 1 : .75;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      if (edge.lead) {
        const offset = (time * .24 + edge.phase) % 1;
        ctx.fillStyle = edge.color + 'bb';
        ctx.beginPath();
        ctx.arc(start.x + (end.x - start.x) * offset, start.y + (end.y - start.y) * offset, 1.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const [index, point] of points.entries()) {
      const tint = index === 0 ? color : point.color;
      ctx.beginPath();
      ctx.fillStyle = tint + (index === 0 ? '25' : '17');
      ctx.arc(point.x, point.y, point.size * (index === 0 ? 4.1 : 2.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = index === 0 ? '#f3edff' : tint;
      ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tick(time) {
    recentTime = time / 1000;
    paint(recentTime);
    frame = requestAnimationFrame(tick);
  }

  function update() {
    if (running && visible && !document.hidden) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      if (visible) paint(recentTime);
    }
  }

  new ResizeObserver(([entry]) => {
    ({ width, height } = entry.contentRect);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    update();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  }).observe(canvas);
  document.addEventListener('visibilitychange', update);
  return (index, shouldRun) => {
    featured = index;
    running = shouldRun;
    update();
  };
}
