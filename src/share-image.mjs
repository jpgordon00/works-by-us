// One compressed atlas of Space Grotesk glyphs serves the whole catalog.
// See scripts/make-share-glyphs.py and src/media/space-grotesk-OFL.txt.
let shareFont;
async function loadShareFont() {
  const bytes = Uint8Array.from(atob(assets.shareGlyphs), char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  const data = await new Response(stream).arrayBuffer();
  const end = 4 + new DataView(data).getUint32(0);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 4, end - 4)));
  return { ...header, pixels: new Uint8Array(data, end) };
}

const cardWidth = 1200;
const cardHeight = 630;
const cardAccents = {
  software: [203, 181, 255], math: [243, 205, 135], games: [139, 223, 212],
  ai: [236, 174, 223], data: [151, 191, 255], civic: [156, 222, 197],
  culture: [255, 181, 153], science: [181, 216, 158], robotics: [174, 189, 255]
};

function cardPalette(category) {
  const background = [13, 12, 17];
  const accent = Object.hasOwn(cardAccents, category) ? cardAccents[category] : cardAccents.software;
  const palette = [];
  for (const foreground of [accent, [247, 245, 248]]) {
    for (let shade = 0; shade <= 31; shade++) {
      foreground.forEach((channel, index) => {
        palette.push(Math.round(background[index] + (channel - background[index]) * shade / 31));
      });
    }
  }
  return Uint8Array.from(palette);
}

function glyphFor(font, character) {
  return font.glyphs[character] ?? font.glyphs[character.normalize('NFKD')[0]] ?? font.glyphs['?'];
}

function cardTextWidth(font, text, size) {
  let width = 0;
  for (const character of text) width += glyphFor(font, character)[5];
  return width * size / font.size;
}

function drawCardText(pixels, font, text, x, baseline, size, paletteStart = 32) {
  const scale = size / font.size;
  for (const character of text) {
    const [start, width, height, left, top, advance] = glyphFor(font, character);
    const targetX = Math.round(x + left * scale);
    const targetY = Math.round(baseline + top * scale);
    for (let dy = 0; dy < Math.round(height * scale); dy++) {
      const y = targetY + dy;
      if (y < 0 || y >= cardHeight) continue;
      const source = start + Math.min(height - 1, Math.floor((dy + .5) / scale)) * width;
      for (let dx = 0; dx < Math.round(width * scale); dx++) {
        const shade = font.pixels[source + Math.min(width - 1, Math.floor((dx + .5) / scale))];
        const destX = targetX + dx;
        if (shade && destX >= 0 && destX < cardWidth) pixels[y * cardWidth + destX] = paletteStart + shade;
      }
    }
    x += advance * scale;
  }
}

function wrapCardTitle(font, title, size, maxWidth) {
  const rows = [];
  let row = '';
  for (const word of title.trim().split(/\s+/)) {
    const next = row ? row + ' ' + word : word;
    if (row && cardTextWidth(font, next, size) > maxWidth) {
      rows.push(row);
      row = word;
    } else {
      row = next;
    }
  }
  if (row) rows.push(row);
  return rows;
}

function fitCardTitle(font, title, maxWidth) {
  // The bounds also accommodate long scientific questions and compound words.
  for (let size = 88; size >= 20; size -= 2) {
    const rows = wrapCardTitle(font, title, size, maxWidth);
    if (rows.length * size * 1.09 <= 325 && rows.every(row => cardTextWidth(font, row, size) <= maxWidth)) {
      return { rows, size };
    }
  }
  return { rows: wrapCardTitle(font, title, 20, maxWidth), size: 20 };
}

function cardDisc(pixels, x, y, radius, shade) {
  for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
    const py = Math.round(y) + dy;
    if (py < 0 || py >= cardHeight) continue;
    const half = Math.floor(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
    const from = Math.max(0, Math.round(x) - half);
    const to = Math.min(cardWidth - 1, Math.round(x) + half);
    if (from <= to) pixels.fill(shade, py * cardWidth + from, py * cardWidth + to + 1);
  }
}

function cardLine(pixels, a, b, shade) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(a.x + dx * i / steps);
    const y = Math.round(a.y + dy * i / steps);
    if (x >= 0 && x < cardWidth && y >= 0 && y < cardHeight) {
      const offset = y * cardWidth + x;
      pixels[offset] = Math.max(pixels[offset], shade);
    }
  }
}

function cardArt(pixels, category, key) {
  // A wire sculpture echoes the homepage network. Its surface and orientation
  // vary by subject and by page, while the left text column stays unobstructed.
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const turn = .18 + (hash % 256) / 256 * .56;
  const tilt = -.79 + ((hash >>> 8) % 256) / 256 * .42;
  const ca = Math.cos(turn), sa = Math.sin(turn), cb = Math.cos(tilt), sb = Math.sin(tilt);
  const columns = 30, rings = 15;
  const periodic = ['math', 'culture', 'robotics'].includes(category);
  const grid = [];
  for (let j = 0; j < rings; j++) {
    const row = [];
    for (let i = 0; i < columns; i++) {
      const u = i / columns * Math.PI * 2;
      const v = periodic ? j / rings * Math.PI * 2 : (j + .25) / (rings - .5) * Math.PI;
      let x, y, z;
      if (periodic) {
        const ripple = category === 'culture' ? .12 * Math.sin(3 * u) : 0;
        const radius = .84 + .34 * Math.cos(v) + ripple;
        x = radius * Math.cos(u); z = radius * Math.sin(u);
        y = .43 * Math.sin(v) + (category === 'robotics' ? .16 * Math.cos(2 * u) : 0);
      } else {
        x = Math.sin(v) * Math.cos(u); y = Math.cos(v); z = Math.sin(v) * Math.sin(u);
        if (category === 'software' || category === 'games') {
          // A rounded cube for visual software and game projects.
          const scale = .84 / Math.pow(x ** 6 + y ** 6 + z ** 6, 1 / 6);
          x *= scale; y *= scale; z *= scale;
        } else if (category === 'science' || category === 'data') {
          const ripple = 1 + .15 * Math.sin(4 * u + 3 * v);
          x *= ripple; z *= ripple;
        }
      }
      const sideways = x * ca - z * sa, depth = x * sa + z * ca;
      const vertical = y * cb - depth * sb, distance = y * sb + depth * cb;
      row.push({ x: 1060 + 183 * (sideways - vertical * .13), y: 338 + 188 * (vertical + sideways * .18), distance });
    }
    grid.push(row);
  }
  const dots = [];
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < columns; i++) {
      const point = grid[j][i];
      const shade = Math.max(3, Math.round(9 + point.distance * 7));
      cardLine(pixels, point, grid[j][(i + 1) % columns], shade);
      if (periodic || j < rings - 1) cardLine(pixels, point, grid[(j + 1) % rings][i], shade);
      dots.push(point);
    }
  }
  for (const point of dots.sort((a, b) => a.distance - b.distance)) {
    cardDisc(pixels, point.x, point.y, Math.max(.9, 1.7 + point.distance * 1.5), Math.max(4, Math.round(16 + point.distance * 12)));
  }
}

const cardCrcTable = Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc;
});

function cardChunk(name, data) {
  const chunk = new Uint8Array(data.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(new TextEncoder().encode(name), 4);
  chunk.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < chunk.length - 4; i++) crc = (crc >>> 8) ^ cardCrcTable[(crc ^ chunk[i]) & 255];
  view.setUint32(chunk.length - 4, crc ^ 0xffffffff);
  return chunk;
}

async function encodeCardPng(pixels, palette) {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, cardWidth);
  view.setUint32(4, cardHeight);
  header[8] = 8; header[9] = 3; // Eight-bit indexed PNG.
  const stride = cardWidth + 1;
  const scanlines = new Uint8Array(stride * cardHeight);
  for (let row = 0; row < cardHeight; row++) {
    scanlines.set(pixels.subarray(row * cardWidth, (row + 1) * cardWidth), row * stride + 1);
  }
  const stream = new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  const png = new Blob([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    cardChunk('IHDR', header), cardChunk('PLTE', palette),
    cardChunk('IDAT', compressed), cardChunk('IEND', new Uint8Array())
  ]);
  return new Uint8Array(await png.arrayBuffer());
}

export async function renderShareImage({ title, label, category = '', key = '' }) {
  // Only decoded data can cross Cloudflare Worker request contexts.
  if (!shareFont) shareFont = await loadShareFont();
  const font = shareFont;
  const pixels = new Uint8Array(cardWidth * cardHeight);
  cardArt(pixels, category, key);
  const margin = 66;
  for (const [dx, dy, shade] of [[0, -11, 28], [11, 0, 16], [-11, 0, 22], [0, 11, 31]]) {
    cardDisc(pixels, margin + 14 + dx, 72 + dy, 6, shade);
  }
  drawCardText(pixels, font, 'Collective Intelligence', margin + 48, 83, 32);
  cardLine(pixels, { x: margin, y: 120 }, { x: cardWidth - margin, y: 120 }, 8);
  const maxWidth = 745;
  const { rows, size } = fitCardTitle(font, title, maxWidth);
  const lineHeight = size * 1.09;
  const top = 351 - (rows.length * lineHeight + (label ? 48 : 0)) / 2;
  if (label) {
    const labelSize = Math.min(28, 28 * maxWidth / Math.max(1, cardTextWidth(font, label, 28)));
    drawCardText(pixels, font, label, margin, top + 24, labelSize, 0);
  }
  rows.forEach((row, index) => {
    drawCardText(pixels, font, row, margin - 2, top + (label ? 54 : 0) + size * .77 + index * lineHeight, size);
  });
  return encodeCardPng(pixels, cardPalette(category));
}
