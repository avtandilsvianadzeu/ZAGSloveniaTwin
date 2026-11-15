#!/usr/bin/env node
/* Accessibility check of the main pages with axe-core (WCAG 2 A and AA, and best practice), in a real browser.
   Fails on serious or critical problems; moderate and minor ones are listed in the report.
   Writes qa/a11y-report.json and prints a summary. Usage: node tools/qa/a11y_check.mjs [--port=8793] */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const req = n => { try { return require(n); } catch (_) { return require(path.join(execSync('npm root -g').toString().trim(), n)); } };
const { chromium } = req('playwright');
let axePath; try { axePath = require.resolve('axe-core/axe.min.js'); } catch (_) { axePath = path.join(execSync('npm root -g').toString().trim(), 'axe-core', 'axe.min.js'); }
const AXE = fs.readFileSync(axePath, 'utf8');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const PORT = +(args.port || 8793);
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', geojson: 'application/geo+json', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', webmanifest: 'application/manifest+json' };
const server = http.createServer((q, res) => {
  const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f).slice(1)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT);
const PAGES = [['index.html', 8000], ['twin.html?id=tomacevo', 6000], ['dashboard.html', 3000], ['questions.html', 3000], ['api.html', 2500], ['add.html', 3500]];
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], proxy: proxy ? { server: proxy, bypass: 'localhost,127.0.0.1' } : undefined });
const out = { checked: new Date().toISOString(), pages: {}, blocking: 0 };
for (const [u, wait] of PAGES) {
  for (const [lang, w] of [['en', 1440], ['sl', 1440], ['en', 1024]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 860 }, ignoreHTTPSErrors: true });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('zag_splash', '1'); localStorage.setItem('zb_teaser_day', new Date().toISOString().slice(0, 10)); } catch (_) {} });
    const p = await ctx.newPage();
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.goto(`http://localhost:${PORT}/${u}${u.includes('?') ? '&' : '?'}lang=${lang}`, { waitUntil: 'load' }).catch(() => {});
    await p.waitForTimeout(wait);
    await p.addScriptTag({ content: AXE });
    const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] } })).violations
      .map(x => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.slice(0, 5).map(n => n.target.join(' ')) })));
    const key = `${u} (${lang}, ${w} px)`; out.pages[key] = v;
    const bad = v.filter(x => x.impact === 'serious' || x.impact === 'critical'); out.blocking += bad.length;
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${key}: ${v.length ? v.map(x => `${x.impact} ${x.id}`).join(', ') : 'no problems'}`);
    await ctx.close();
  }
}
await b.close(); server.close();
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa/a11y-report.json'), JSON.stringify(out, null, 1));
console.log(`\nAccessibility: ${out.blocking} serious or critical problems on ${PAGES.length * 3} page views`);
process.exit(out.blocking ? 1 : 0);
