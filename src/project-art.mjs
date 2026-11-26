const marks = count => '<i></i>'.repeat(count);
const sheet = (className = '') => '<span class="art-sheet ' + className + '">' + marks(4) + '</span>';
const graph = '<span class="art-plot">' + marks(10) + '</span>';
const cells = pattern => '<span class="art-cells">' + Array.from(pattern, cell =>
  '<i' + (cell === '+' ? ' class="art-on"' : cell === '*' ? ' class="art-hot"' : '') + '></i>'
).join('') + '</span>';
const dots = '<span class="art-nodes">' + marks(6) + '</span>';

const artByProject = {
  'free-photoshop-alternative': ['editor', '<div class="art-window"><div class="art-toolbar">' + marks(3) + '</div><div class="art-editor-body"><img src="/media/richat.jpg" width="1100" height="890" loading="lazy" alt=""><span class="art-layers"><b>Layers</b>' + marks(3) + '</span></div></div>'],
  'free-monarch-money-alternative': ['budget', '<div class="art-window"><div class="art-budget-heading"><b>Monthly spending</b><i></i></div><span class="art-budget-body"><span class="art-donut"></span><span class="art-ledger">' + marks(3) + '</span></span></div>'],
  'free-acrobat-pro-alternative': ['compare', sheet('art-before') + sheet('art-after')],
  'p-versus-np': ['formula', '<span class="art-equation"><b>P</b><strong>≟</strong><b>NP</b></span>'],
  'sparse-permanent-check': ['matrix', cells('+----+----+----++--+-----') + '<span class="art-matrix-result"><b>Σ</b>' + marks(2) + '</span>'],
  'sat-competition-comparison': ['solvers', graph],
  '3sat-to-clique': ['reduction', '<span class="art-clauses">' + marks(6) + '</span><b>→</b>' + dots],
  'unrestricted-circuit-lower-bound': ['circuit', dots + '<span class="art-circuit-output"></span>'],
  'hodge-conjecture': ['geometry', '<span class="art-geometry">' + marks(5) + '</span>'],
  'gta-vi-pc-release': ['forecast', '<span class="art-release-track">' + marks(3) + '</span><span class="art-release-label">PC</span>'],
  'godot-msaa-pipeline-stutter': ['frames', graph],
  'windows-linux-proton-compatibility': ['compatibility', '<span class="art-frame">' + marks(4) + '</span><b>→</b><span class="art-frame">' + marks(4) + '</span>'],
  'arc-agi-memory': ['puzzles', cells('----+++++---++*++---+++++') + '<b>→</b>' + cells('----+++++---+***+---+++++')],
  'mmlu-answer-order': ['answers', '<span class="art-answer-stack">' + marks(4) + '</span><b>⇄</b><span class="art-answer-stack">' + marks(4) + '</span>'],
  'join-datasets-openrefine': ['join', sheet('art-before') + '<b>+</b>' + sheet('art-after')],
  'transit-feed-notices': ['transit', '<span class="art-transit-line">' + marks(5) + '</span>'],
  'seattle-accessible-transit-routes': ['route', '<span class="art-transit-line">' + marks(5) + '</span>'],
  'link-to-manuscript-page': ['manuscript', sheet('art-before') + sheet('art-after')],
  'historic-newspaper-ocr': ['newspaper', sheet() + sheet()],
  'phoenix-night-heat': ['heat', cells('++--*++-**----+-+*++*++--')],
  'batch-job-electricity-emissions': ['energy', graph],
  'overlapping-galaxies': ['galaxies', '<span class="art-galaxy"></span><span class="art-galaxy"></span>']
};

const artByCategory = {
  software: ['editor', '<div class="art-window">' + sheet() + '</div>'],
  math: ['geometry', '<span class="art-geometry">' + marks(5) + '</span>'],
  games: ['frames', graph],
  ai: ['puzzles', cells('----+++++---+***+---+++++')],
  data: ['join', sheet('art-before') + '<b>+</b>' + sheet('art-after')],
  civic: ['transit', '<span class="art-transit-line">' + marks(5) + '</span>'],
  culture: ['manuscript', sheet('art-before') + sheet('art-after')],
  science: ['energy', graph],
  robotics: ['circuit', dots + '<span class="art-circuit-output"></span>']
};

export function renderProjectArt(problem) {
  const [variant, artwork] = (Object.hasOwn(artByProject, problem.id) && artByProject[problem.id])
    || (Object.hasOwn(artByCategory, problem.category) && artByCategory[problem.category])
    || artByCategory.math;
  return `<div class="project-art art-${variant}" aria-hidden="true">${artwork}</div>`;
}
