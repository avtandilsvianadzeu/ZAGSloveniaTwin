/* Copies the published site into desktop/site so the installer carries the whole atlas: pages, data, models, API files.
   The map tiles and the live news still come from the internet. Run before every build. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'site');
const KEEP = ['index.html', 'twin.html', 'dashboard.html', 'questions.html', 'api.html', 'add.html', '404.html', 'data.js', 'css', 'js', 'img', 'data', 'api', 'README.md'];
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
for (const k of KEEP) { const src = path.join(ROOT, k); if (fs.existsSync(src)) fs.cpSync(src, path.join(OUT, k), { recursive: true }); }
const n = fs.readdirSync(OUT).length; console.log('site copied,', n, 'top level entries');
