import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile('src/catalog.json', 'utf8'));
const ids = new Set();
for (const problem of catalog.problems) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problem.id) || ids.has(problem.id)) {
    throw new Error('Invalid or duplicate problem ID: ' + problem.id);
  }
  if (!catalog.categories.some(category => category.id === problem.category)) {
    throw new Error('Unknown category for ' + problem.id);
  }
  for (const field of ['title', 'summary', 'context', 'task', 'review', 'kind']) {
    if (typeof problem[field] !== 'string' || !problem[field].trim()) {
      throw new Error('Missing ' + field + ' for ' + problem.id);
    }
  }
  if (!problem.sources.length || !problem.sources.every(source => new URL(source.url).protocol === 'https:')) {
    throw new Error('Expected HTTPS sources for ' + problem.id);
  }
  ids.add(problem.id);
}
if (!ids.has(catalog.featured)) throw new Error('The featured problem is missing');

const assets = {};
for (const name of ['style.css', 'copy.js']) assets[name] = await readFile('src/' + name, 'utf8');

let commit = 'local';
try { commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
catch {}
const worker = await readFile('src/worker.mjs', 'utf8');
const config = { repository: 'https://github.com/jpgordon00/works-by-us', commit };
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await writeFile('dist/server/index.js', 'const catalog = ' + JSON.stringify(catalog) + ';\nconst assets = ' + JSON.stringify(assets) + ';\nconst config = ' + JSON.stringify(config) + ';\n' + worker);
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
