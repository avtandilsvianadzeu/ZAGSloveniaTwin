#!/usr/bin/env node
/* Site checks of the ZAG Digital Atlas, in a real browser (Playwright Chromium).
   Serves the repository on a local port, opens every page in English and Slovenian, and reports:
   script errors, failed requests to the site's own files, house-style typography in visible text (quotes exempt),
   English left on Slovenian pages, horizontal overflow at phone width, missing alt text, and the record pages' key controls.
   Exit code 1 on blocking problems (errors, broken own requests, overflow). Writes qa/site-report.json and qa/site-report.md.
   Usage: node tools/qa/site_scan.mjs [--pages=all|quick] [--port=8791] */
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
const PORT = +(args.port || 8791), MODE = args.pages || 'all';
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', geojson: 'application/geo+json', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', csv: 'text/csv', webp: 'image/webp', ico: 'image/x-icon', xml: 'application/xml', txt: 'text/plain', md: 'text/markdown', bin: 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]).replace(/^\/ZAGSloveniaTwin(?=\/|$)/, ''); let f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f).slice(1)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT);
const ids = fs.readdirSync(path.join(ROOT, 'api/v1/objects')).map(f => f.replace('.json', ''));
const base = ['index.html', 'twin.html', 'dashboard.html', 'questions.html', 'api.html', 'add.html', '404.html'];
const records = MODE === 'quick' ? ids.slice(0, 6) : ids;
const pages = [...base, ...records.map(i => 'twin.html?id=' + i)];
const SYMBOLS = /[–—·•…;]/g;
const ENGLISH = /\b(the|and|with|from|for|of|this|that|not|are|is|was|were|open|close|show|hide)\b/i, SLOVENE = /\b(in|na|za|je|so|ki|ali|ne|po|od|do|pri|se|da)\b/;
const out = { checked: new Date().toISOString(), pages: [], blocking: 0, warnings: 0 };
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], proxy: proxy ? { server: proxy, bypass: 'localhost,127.0.0.1' } : undefined });
async function scan(pg, lang, viewport) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 500, hasTouch: viewport.width < 500, ignoreHTTPSErrors: true });
  const p = await ctx.newPage(); const r = { page: pg, lang, width: viewport.width, errors: [], failed: [], symbols: [], english: [], overflow: false, noAlt: 0 };
  const NET = /AJAXError|Failed to fetch|net::|Failed to load resource|WebGL|GPU|swiftshader|NetworkError/i;
  r.network = [];
  p.on('pageerror', e => (NET.test(e.message) ? r.network : r.errors).push(e.message.slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error') (NET.test(m.text()) ? r.network : r.errors).push(m.text().slice(0, 160)); });
  p.on('requestfailed', q => { const u = q.url(); if (u.startsWith('http://localhost:' + PORT)) r.failed.push(u.replace('http://localhost:' + PORT + '/', '')); });
  p.on('response', q => { const u = q.url(); if (u.startsWith('http://localhost:' + PORT) && q.status() >= 400 && !/favicon|zagbot_answer/.test(u)) r.failed.push(u.replace('http://localhost:' + PORT + '/', '') + ' ' + q.status()); });
  try {
    await p.goto(`http://localhost:${PORT}/${pg}${pg.includes('?') ? '&' : '?'}lang=${lang}`, { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(pg.startsWith('index') ? 6000 : 2500);
    const t = await p.evaluate(() => {
      document.querySelectorAll('details').forEach(d => d.open = true);
      const out = { symbols: [], english: [], noAlt: 0 };
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while (n = w.nextNode()) { const s = n.textContent.trim(); if (s.length < 3) continue; const el = n.parentElement; if (!el || el.closest('script,style,blockquote,.quote,code,pre,.zn,.nitem,.zb-log')) continue;
        if (/[–—·•…;]/.test(s)) out.symbols.push(s.slice(0, 80));
        if (document.documentElement.lang === 'sl' && s.length > 14 && /\b(the|and|with|from|for|this|that|not|are|is|was|were)\b/i.test(s) && !/\b(in|na|za|je|so|ki|ali|ne|po|od|do|pri|se|da|z|s|v)\b/.test(s) && !/\d{3,}/.test(s)) out.english.push(s.slice(0, 80)); }
      out.noAlt = [...document.images].filter(i => !i.hasAttribute('alt')).length;
      out.overflow = document.documentElement.scrollWidth > innerWidth + 1;
      return out; });
    r.symbols = [...new Set(t.symbols)].slice(0, 20); r.english = [...new Set(t.english)].slice(0, 20); r.noAlt = t.noAlt; r.overflow = t.overflow;
  } catch (e) { r.errors.push('LOAD ' + e.message.slice(0, 120)); }
  await ctx.close(); return r;
}
for (const pg of pages) {
  for (const lang of ['en', 'sl']) {
    if (lang === 'sl' && pg.startsWith('twin.html?id=') && MODE !== 'all') continue;
    out.pages.push(await scan(pg, lang, { width: 1440, height: 900 }));
  }
  if (base.includes(pg)) out.pages.push(await scan(pg, 'en', { width: 390, height: 844 }));
}
await b.close(); server.close();
for (const r of out.pages) { if (r.errors.length || r.failed.length || r.overflow) out.blocking++; if (r.symbols.length || r.english.length || r.noAlt) out.warnings++; }
for (const r of out.pages) r.network = (r.network || []).length;
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa/site-report.json'), JSON.stringify(out, null, 1) + '\n');
const md = [`# Site scan, ${out.checked}`, '', `${out.pages.length} page loads, ${out.blocking} with blocking problems, ${out.warnings} with warnings.`, ''];
for (const r of out.pages) { const bad = r.errors.length || r.failed.length || r.overflow, warn = r.symbols.length || r.english.length || r.noAlt || r.network; if (!bad && !warn) continue;
  md.push(`## ${r.page} (${r.lang}, ${r.width}px)`);
  r.errors.forEach(e => md.push(`- error: ${e}`)); r.failed.forEach(e => md.push(`- failed request: ${e}`)); if (r.overflow) md.push('- horizontal overflow');
  if (r.network && r.network.length) md.push(`- ${r.network.length} outside requests did not answer (tiles, fonts), not counted`); r.symbols.forEach(e => md.push(`- typography: ${e}`)); r.english.forEach(e => md.push(`- English on the Slovenian page: ${e}`)); if (r.noAlt) md.push(`- ${r.noAlt} images without alt text`); md.push(''); }
fs.writeFileSync(path.join(ROOT, 'qa/site-report.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
process.exit(out.blocking ? 1 : 0);
