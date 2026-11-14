#!/usr/bin/env node
/* Reads the latest items of "Aktualno" from zag.si (the public RSS feeds in Slovenian and English)
   and writes data/zag_news.json, so the atlas shows what ZAG itself has published. Run by the news workflow. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEEDS = { sl: 'https://www.zag.si/feed/', en: 'https://www.zag.si/en/feed/' };
const MAX = 8;
const un = s => s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/&#8211;/g, ', ').replace(/&#8217;/g, "'").replace(/&#8220;|&#8221;|&quot;/g, '"')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/\s+/g, ' ').trim();
const tag = (x, t) => { const m = x.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')); return m ? un(m[1]) : ''; };
async function read(lang, url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (ZAG Digital Atlas news reader)' } });
  if (!r.ok) throw new Error(lang + ' ' + r.status);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, MAX).map(m => {
    const x = m[1], d = tag(x, 'pubDate');
    const text = un(tag(x, 'description').replace(/<[^>]+>/g, ' ')).replace(/\s*\[&#8230;\]|\s*\[…\]|\s*\.\.\.$/g, '');
    return { title: tag(x, 'title'), url: tag(x, 'link'), date: d ? new Date(d).toISOString() : null, summary: text.length > 260 ? text.slice(0, 260).replace(/\s+\S*$/, '') : text, category: tag(x, 'category') || 'Aktualno' };
  }).filter(i => i.title && i.url);
}
const out = { source: 'https://www.zag.si/', updated: new Date().toISOString(), items: {} };
for (const [lang, url] of Object.entries(FEEDS)) {
  try { out.items[lang] = await read(lang, url); } catch (e) { console.error('zag.si feed failed', e.message); }
}
const file = path.join(ROOT, 'data/zag_news.json');
let prev = null; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
const same = prev && JSON.stringify(prev.items) === JSON.stringify(out.items);
if (!Object.keys(out.items).length) { console.error('no feed read, file kept'); process.exit(0); }
if (same) { console.log('zag.si news unchanged'); process.exit(0); }
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log('zag.si news written:', Object.entries(out.items).map(([l, a]) => l + ' ' + a.length).join(', '));
