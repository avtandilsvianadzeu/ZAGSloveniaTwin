#!/usr/bin/env node
/* Reads the latest items of "Aktualno" from zag.si (the public RSS feeds in Slovenian and English)
   and writes data/zag_news.json, so the atlas shows what ZAG itself has published. Run by the news workflow. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEEDS = { sl: 'https://www.zag.si/aktualno/feed/', en: 'https://www.zag.si/en/news/feed/' };
/* ZAG in the Slovenian media, from Google News (title, outlet, link, date), as a third list */
const MEDIA = 'https://news.google.com/rss/search?q=%22Zavod+za+gradbeni%C5%A1tvo+Slovenije%22+OR+%22ZAG+Ljubljana%22&hl=sl&gl=SI&ceid=SI:sl';
const MAX = 10;
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
/* the newest items in either language, without doubles: the English site publishes later than the Slovenian one,
   so an English reader is shown the Slovenian item until its translation exists */
const slug = u => String(u || '').replace(/^https?:\/\/(www\.)?zag\.si\/(en\/)?/, '').replace(/\/$/, '').toLowerCase();
const key = i => (i.date || '').slice(0, 10) + '|' + slug(i.url).slice(0, 24);
const toks = t => new Set(String(t || '').toUpperCase().match(/\d+|[A-ZČŠŽ]{3,}/g) || []);
const latest = [];
for (const lang of ['en', 'sl']) for (const i of out.items[lang] || []) { if (!i.date) continue; const day = i.date.slice(0, 10), T = toks(i.title);
  const dup = latest.find(x => x.lang !== lang && x.date.slice(0, 10) === day && (slug(x.url) === slug(i.url) || [...toks(x.title)].some(w => T.has(w) && !/^(ZAG|THE|AND|FOR|ZA|IN|NA)$/.test(w))));
  if (dup) continue; latest.push({ ...i, lang }); }
latest.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
out.items.latest = latest.slice(0, MAX);
try { const r = await fetch(MEDIA, { headers: { 'user-agent': 'Mozilla/5.0 (ZAG Digital Atlas news reader)' } }); if (r.ok) { const xml = await r.text();
  out.items.media = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map(m => { const x = m[1], d = tag(x, 'pubDate'), t = tag(x, 'title'), src = tag(x, 'source');
    return { title: t.replace(/\s+-\s+[^-]+$/, ''), outlet: src || (t.match(/\s-\s([^-]+)$/) || [])[1] || '', url: tag(x, 'link'), date: d ? new Date(d).toISOString() : null }; }).filter(i => i.title && i.url); } } catch (e) { console.error('media feed failed', e.message); }
const file = path.join(ROOT, 'data/zag_news.json');
let prev = null; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
const same = prev && JSON.stringify(prev.items) === JSON.stringify(out.items);
if (!Object.keys(out.items).length) { console.error('no feed read, file kept'); process.exit(0); }
if (same) { console.log('zag.si news unchanged'); process.exit(0); }
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log('zag.si news written:', Object.entries(out.items).map(([l, a]) => l + ' ' + a.length).join(', '));
