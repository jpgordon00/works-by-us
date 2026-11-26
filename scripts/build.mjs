import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

import { attachCollaborationData } from './collaboration-data.mjs';

const readJson = async name => JSON.parse(await readFile('src/' + name + '.json', 'utf8'));
const [rawCatalog, repositories, ledgers, workrooms] = await Promise.all([
  readJson('catalog'), readJson('project-repositories'), readJson('contribution-ledger'), readJson('project-workrooms')
]);
const catalog = attachCollaborationData(rawCatalog, repositories, ledgers, workrooms);

const assets = {
  shareGlyphs: (await readFile('src/media/share-glyphs.bin')).toString('base64'),
  richat: (await readFile('src/media/richat.jpg')).toString('base64'),
  mark: (await readFile('src/media/mark.png')).toString('base64'),
  spaceGrotesk: (await readFile('src/media/space-grotesk.woff2')).toString('base64')
};
const exampleEvents = (await readFile('src/watch-example.jsonl', 'utf8')).trim().split('\n').map(line => JSON.parse(line));
for (const name of ['style.css', 'copy.js', 'work-on-this.js', 'home.js', 'network.js', 'watch.js', 'watch.css']) assets[name] = await readFile('src/' + name, 'utf8');
assets['style.css'] += '\n' + await readFile('src/project-art.css', 'utf8');

let commit = 'local';
try { commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
catch {}
const workerModules = await Promise.all(['site-info.mjs', 'project-art.mjs', 'home.mjs', 'share-image.mjs', 'share-pages.mjs', 'watch-experiment.mjs', 'watch-api.mjs', 'watch-page.mjs', 'worker.mjs'].map(
  path => readFile('src/' + path, 'utf8')
));
const worker = workerModules.join('\n');
const config = {
  repository: 'https://github.com/jpgordon00/works-by-us',
  origin: 'https://crowdsourced.si',
  legacyOrigin: 'https://works-by-us.jacob-gordon255689.chatgpt.site',
  commit
};
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await writeFile('dist/server/index.js', 'const watchExampleEvents = ' + JSON.stringify(exampleEvents) + ';\nconst catalog = ' + JSON.stringify(catalog) + ';\nconst ledgers = ' + JSON.stringify(ledgers) + ';\nconst assets = ' + JSON.stringify(assets) + ';\nconst config = ' + JSON.stringify(config) + ';\n' + worker);
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
