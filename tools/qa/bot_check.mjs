#!/usr/bin/env node
/* ZAGBot answer checks, in a real browser (Playwright Chromium).
   Each case is a question as people type it or as a speech recogniser hears it, and the record the answer must name.
   Covers misheard names (Zack Institute, chatesh), Slovenian names in an English chat, and a name that is not in the
   atlas, which must be said so and never answered with the record already open.
   Exit code 1 when any case fails. Writes qa/bot-report.json.
   Usage: node tools/qa/bot_check.mjs [--port=8792] */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const PORT = +(args.port || 8792);
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', geojson: 'application/geo+json', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f).slice(1)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT);

/* [question, text the answer must contain, text it must not contain] */
const CASES = [
  ['show the photo and location of Zack Institute', 'Dimičeva ulica 12', 'Podnanos'],
  ['where is zag', 'Dimičeva ulica 12'],
  ['where is the ZAG institute', 'Dimičeva ulica 12'],
  ['where is Zavod za gradbeništvo Slovenije', 'Dimičeva ulica 12'],
  ['where is chatesh bridge', 'Čatež'],
  ['show me most čez Savo v Tomačevem', 'Most čez Savo v Tomačevem'],
  ['where is predor Karavanke', 'Karavanke'],
  ['kastelets', 'Kastelec'],
  ['where is the Blorpington laboratory', 'cannot find', 'Podnanos'],
  ['how many fire labs does zag have', 'Gameljne'],
];

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], proxy: proxy ? { server: proxy, bypass: 'localhost,127.0.0.1' } : undefined });
const p = await b.newPage({ viewport: { width: 1300, height: 850 } });
const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
/* the map tiles are not needed to answer, only the atlas data */
await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort());
await p.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
await p.waitForFunction(() => window.ZAGBot, null, { timeout: 30000 });
await p.waitForTimeout(3000);
const results = [];
for (const [q, must, mustNot] of CASES) {
  /* a record is open on the map, as when the person asks while looking at something else */
  await p.evaluate(() => { try { if (typeof window.showInfo === 'function') window.showInfo('tabor_h4'); } catch (_) {} });
  const text = await p.evaluate(async q => {
    const log = document.getElementById('zbLog'); if (!log || document.querySelector('.zb-panel').hidden) await ZAGBot.open();
    const before = log.children.length; ZAGBot.ask(q); await new Promise(r => setTimeout(r, 2800));
    return [...log.children].slice(before + 1).map(x => x.innerText.replace(/\s+/g, ' ')).join(' | '); }, q);
  const ok = text.includes(must) && !(mustNot && text.includes(mustNot));
  results.push({ q, must, mustNot: mustNot || null, ok, answer: text.slice(0, 240) });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${q}\n      ${text.slice(0, 160)}`);
}
await b.close(); server.close();
const failed = results.filter(r => !r.ok).length;
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa/bot-report.json'), JSON.stringify({ checked: new Date().toISOString(), failed, errors, results }, null, 1));
console.log(`\nZAGBot: ${CASES.length - failed} of ${CASES.length} answers as expected${errors.length ? ', script errors: ' + errors.length : ''}`);
if (errors.length) console.log(errors.join('\n'));
process.exit(failed || errors.length ? 1 : 0);
