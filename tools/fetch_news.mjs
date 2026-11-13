/* Fetch recent Slovenian news per record from Google News RSS and write data/news.json.
   Run: node tools/fetch_news.mjs   (Node 18 or newer, no packages needed)
   Keywords per record: data/news_keywords.json (q = query, must = any of these in the headline, all = every one of these, not = none of these). Links to hide: data/news_ignore.json (list of URLs).
   Only headline, outlet, date and link are stored; articles are linked, never copied. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const KW = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/news_keywords.json'), 'utf8'));
const OUT = path.join(ROOT, 'data/news.json');
const IGN = path.join(ROOT, 'data/news_ignore.json');
const ignore = new Set(fs.existsSync(IGN) ? JSON.parse(fs.readFileSync(IGN, 'utf8')) : []);
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { items: {} };

const MAX_AGE_DAYS = 365, PER_RECORD = 8, PAUSE_MS = 1200;
const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = s => new Set(norm(s).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(w => w.length > 3));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const unesc = s => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? unesc(m[1]) : ''; };

async function search(q) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=sl&gl=SI&ceid=SI:sl';
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (ZAG Digital Atlas news check)' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const it = m[1], source = tag(it, 'source');
    let title = tag(it, 'title'); if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    return { title, url: tag(it, 'link'), source, date: new Date(tag(it, 'pubDate')).toISOString() };
  });
}

/* same story in several outlets: headlines sharing most of their words */
function cluster(items) {
  const out = [];
  for (const it of items) {
    const w = words(it.title);
    const t = Date.parse(it.date);
    const hit = out.find(c => {
      const inter = [...w].filter(x => c.w.has(x)).length, share = inter / Math.max(1, Math.min(w.size, c.w.size));
      const days = Math.abs(t - c.t) / 864e5;
      return share >= 0.6 || (days <= 3 && (share >= 0.3 || inter >= 2)); // same story, reworded by another outlet within a few days
    });
    if (hit) { hit.outlets.add(it.source); for (const x of w) hit.w.add(x); }
    else out.push({ ...it, t, w, outlets: new Set([it.source]) });
  }
  return out.map(c => ({ title: c.title, source: c.source, date: c.date, url: c.url, outlets: c.outlets.size }));
}

const items = {}, errors = [];
const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
/* words that mark accident, crime or complaint headlines, left out for every record (key _not in news_keywords.json) */
const SHARED_NOT = Array.isArray(KW._not) ? KW._not : [];
for (const [id, k] of Object.entries(KW)) {
  if (id.startsWith('_') || !k.q) continue;
  try {
    const must = (k.must || []).map(norm);
    const found = (await search(k.q))
      .filter(it => it.title && it.url && !ignore.has(it.url) && Date.parse(it.date) > cutoff)
      .filter(it => !must.length || must.some(m => norm(it.title).includes(m)))
      .filter(it => (k.all || []).every(m => norm(it.title).includes(norm(m))))
      .filter(it => !(k.not || []).concat(SHARED_NOT).some(m => norm(it.title).includes(norm(m))))
      .sort((a, b) => b.date.localeCompare(a.date));
    const list = cluster(found).slice(0, PER_RECORD);
    if (list.length) items[id] = list;
  } catch (e) {
    errors.push(id + ': ' + e.message);
    if (prev.items && prev.items[id]) items[id] = prev.items[id]; // keep the last good result
  }
  await sleep(PAUSE_MS);
}

const body = { items };
const changed = JSON.stringify(body) !== JSON.stringify({ items: prev.items || {} });
if (changed || !prev.updated) {
  fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), source: 'Google News (sl-SI), headline match on Slovenian keywords', items }, null, 1));
}
console.log(`records with news: ${Object.keys(items).length}, articles: ${Object.values(items).reduce((a, b) => a + b.length, 0)}, ${changed ? 'changed' : 'no change'}${errors.length ? ', errors: ' + errors.join('; ') : ''}`);
