/* News of the FEHRL members, read from their own websites once a day (.github/workflows/fehrl.yml).
   Members, their projects with ZAG and where their news is: data/fehrl_members.json. Writes data/fehrl.json.
   1. Each member's news feed, or its news page and the article links on it. Without either, the home page is searched
      for a link to the news page (a history page whose name holds a news word is skipped).
   2. Dates: a date from a feed is used when it is believable. Some feeds give every article the time the feed was rebuilt,
      so a date after the day the article was first seen, or one shared by three articles to the second, is checked on the
      article page itself (published time in its metadata, structured data or time tag). Articles from news pages get
      their date the same way. Pages read once are remembered. Articles that stay without a date are kept as undated.
   3. Titles get an English and a Slovenian version (Google's free translation endpoint, in batches).
   Only public pages are read, at a gentle pace, and robots.txt is respected. Node 20, no packages. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DAY = 864e5, NOW = Date.now(), TODAY = new Date().toISOString().slice(0, 10);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (_) { return d; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = d => { const t = Date.parse(d); return isNaN(t) ? null : new Date(t).toISOString(); };
const host = u => { try { return new URL(u).host.replace(/^www\./, '').toLowerCase(); } catch (_) { return ''; } };
const unx = s => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, "'").replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();

const CFG = rd('data/fehrl_members.json', { members: [] }), PREV = rd('data/fehrl.json', { members: [], seen: {}, ad: {} });
const SEEN = PREV.seen || {}, AD = PREV.ad || {};
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

async function get(url, timeout = 20000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout);
  try { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'en,*;q=0.5' }, redirect: 'follow', signal: ac.signal });
    if (!r.ok) return null; const b = Buffer.from((await r.arrayBuffer()).slice(0, 3e6)), ct = r.headers.get('content-type') || '';
    const head = b.subarray(0, 4096).toString('latin1'), cs = ((ct.match(/charset=([\w-]+)/i) || head.match(/<\?xml[^>]+encoding=["']([\w-]+)/i) || head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8').toLowerCase();
    let text; try { text = new TextDecoder(/^utf-?8$/.test(cs) ? 'utf-8' : cs).decode(b); } catch (_) { text = b.toString('utf8'); }
    return { url: r.url, text };
  } catch (_) { return null; } finally { clearTimeout(t); } }

/* robots.txt: the paths it closes to every reader are left alone */
const ROBOTS = {};
async function allowed(u) {
  let x; try { x = new URL(u); } catch (_) { return false; }
  if (!(x.origin in ROBOTS)) { const r = await get(x.origin + '/robots.txt', 10000); const rules = []; let on = false;
    for (const line of String(r ? r.text : '').split(/\r?\n/)) { const [k, ...v] = line.split(':'); const key = (k || '').trim().toLowerCase(), val = v.join(':').trim();
      if (key === 'user-agent') on = val === '*'; else if (on && key === 'disallow' && val) rules.push(val); }
    ROBOTS[x.origin] = rules; }
  /* a rule is a path prefix, * stands for any text and $ ends the address */
  const at = x.pathname + x.search;
  return !ROBOTS[x.origin].some(p => new RegExp('^' + p.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')).test(at)); }

function parseFeed(xml) {
  const tag = (x, t) => { const m = x.match(new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>', 'i')); return m ? unx(m[1]) : ''; };
  const out = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) { const x = m[0]; out.push({ t: tag(x, 'title'), u: tag(x, 'link') || tag(x, 'guid'), d: iso(tag(x, 'pubDate') || tag(x, 'dc:date')) }); }
  for (const m of xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)) { const x = m[0], l = (x.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i) || [])[1]; out.push({ t: tag(x, 'title'), u: l || '', d: iso(tag(x, 'published') || tag(x, 'updated')) }); }
  return out.filter(i => i.t && /^https?:\/\//.test(i.u)); }

const NEWS = /(news|novice|novosti|vijesti|aktual|nachrichten|neuigkeiten|presse|press|actualit|noticias|nyheter|hirek|novinky|aktuality|not%C3%ADcias|noticias|haberler|duyuru|jaunumi|wiadomo|aktualnosci|uutiset|nieuws|novini|%D0%BD%D0%BE%D0%B2%D0%B8%D0%BD%D0%B8|articles|blog)/i;
const HIST = /(povijest|history|histoire|historia|geschicht|zgodovin|storia|dejiny|historie)/i;
const NAV = /^(home|news|more|read more|all news|archive|contact|about|search|menu|login|en|sl|de|fr|next|previous|older|newer|\d+)$/i;

/* the article links of a news page: same website, under the news page or with a news word or a year in the address */
function articleLinks(page, base) {
  const h = host(base), basePath = (() => { try { return new URL(base).pathname.replace(/\/+$/, ''); } catch (_) { return ''; } })(), best = new Map();
  for (const m of page.text.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, '&'), page.url).href; } catch (_) { continue; }
    if (host(u) !== h || /\.(pdf|docx?|xlsx?|jpe?g|png|zip)(\?|$)/i.test(u)) continue;
    const p = new URL(u).pathname.replace(/\/+$/, ''); if (!p || p === basePath) continue;
    const under = basePath && p.startsWith(basePath + '/'), deep = p.split('/').filter(Boolean).length >= 2;
    if (!under && !(deep && (NEWS.test(p) || /\/20\d\d\//.test(p) || /(detail|article|artikel|clanek|cikk|nyhet|novica|post)/i.test(p)))) continue;
    const title = unx(m[2]) || unx((m[0].match(/(?:title|aria-label)=["']([^"']+)["']/i) || [])[1] || '');
    if (title.length < 20 || title.split(/\s+/).length < 3 || NAV.test(title)) continue;
    const t = title.replace(/^(read more|more|lire la suite|weiterlesen|preberi več|več|čítať ďalej|číst dále)\s*:?\s*/i, '');
    const t2 = t.replace(/\s+(news item|nieuwsbericht|press release|persbericht|read more)$/i, '');
    if (!best.has(u) || best.get(u).length < t2.length) best.set(u, t2.slice(0, 220)); }
  return [...best].map(([u, t]) => ({ u, t })).slice(0, 20); }

async function findNewsPage(m) {
  const home = await get(m.w); if (!home) return null;
  const feed = (home.text.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi) || []).map(l => (l.match(/href=["']([^"']+)["']/i) || [])[1]).filter(Boolean)[0];
  if (feed) { try { return { feed: new URL(feed.replace(/&amp;/g, '&'), home.url).href }; } catch (_) {} }
  const h = host(home.url), links = [...home.text.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(x => { try { return { u: new URL(x[1].replace(/&amp;/g, '&'), home.url).href, t: unx(x[2]) }; } catch (_) { return null; } })
    .filter(l => l && host(l.u) === h && (NEWS.test(l.u) || NEWS.test(l.t)) && !HIST.test(l.u) && !HIST.test(l.t));
  const last = u => new URL(u).pathname.replace(/\/+$/, '').split('/').pop() || '';
  const pick = links.find(l => NEWS.test(last(l.u))) || links[0];
  return pick ? { news: pick.u } : null; }

/* a date written in the article's address (2026-11-19, /2026/11/19/) or next to its title (Nov 06, 2026, 6. 11. 2026, 06.11.2026) */
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const ok = (y, mo, d) => { const t = Date.UTC(+y, +mo - 1, +d); return +mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31 && t <= NOW + DAY && t > Date.parse('2000-01-01') ? new Date(t).toISOString().slice(0, 10) : null; };
function urlDate(u) { const m = String(u).match(/(?:^|[\/_-])(20\d\d)[-\/](\d{1,2})[-\/](\d{1,2})(?=[\/_-]|$)/); return m ? ok(m[1], m[2], m[3]) : null; }
const TXD = /\b(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? (\d{1,2}),? (20\d\d)|(\d{1,2})\.\s?(\d{1,2})\.\s?(20\d\d))\b/i;
function textDate(t) { const m = String(t).match(TXD); if (!m) return null; return m[1] ? ok(m[3], MON[m[1].toLowerCase().slice(0, 3)], m[2]) : ok(m[6], m[5], m[4]); }

/* the published date of an article, from its own page */
async function articleDate(u) {
  if (u in AD) return AD[u];
  const r = await get(u, 15000); let d = null;
  if (r) { const h = r.text.slice(0, 400000);
    for (const re of [/<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|date|dc\.date|DC\.date\.issued|publish[-_]?date|pubdate)["'][^>]*content=["']([^"']+)/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|date|pubdate)["']/i,
      /"datePublished"\s*:\s*"([^"]+)"/, /<time[^>]+datetime=["']([^"']+)["']/i]) {
      const m = h.match(re), t = m && iso(m[1]); if (t && Date.parse(t) <= NOW + DAY && Date.parse(t) > Date.parse('2000-01-01')) { d = t.slice(0, 10); break; } }
    /* without metadata: the first date written just after the article's heading */
    if (!d) { const k = h.search(/<h1[\s>]/i); if (k >= 0) { const near = unx(h.slice(k, k + 6000)); d = textDate(near) || (() => { const m = near.match(/\b(20\d\d)-(\d{2})-(\d{2})\b/); return m ? ok(m[1], m[2], m[3]) : null; })(); } }
    AD[u] = d; }
  return d; }

async function readMember(m) {
  if (m.skip) return { how: 'website', items: [] }; /* a website whose news cannot be read by its own rules (robots.txt) */
  let src = { feed: m.feed, news: m.news };
  if (!src.feed && !src.news) src = (await findNewsPage(m)) || {};
  let items = [], how = 'website';
  if (src.feed && await allowed(src.feed)) { const r = await get(src.feed); if (r && /<(rss|feed|rdf)/i.test(r.text.slice(0, 3000))) { items = parseFeed(r.text).slice(0, 30); how = 'feed'; } }
  if (!items.length && src.news && await allowed(src.news)) { const r = await get(src.news); if (r) { items = articleLinks(r, src.news).map(x => ({ ...x, d: null })); how = 'page'; } }
  if (!items.length) return { how: src.feed || src.news ? 'quiet' : 'none', items: [] };
  /* dates that cannot be trusted, and articles without one, are checked on their own page (up to 10 pages per member) */
  const cnt = {}; for (const i of items) if (i.d) cnt[i.d] = (cnt[i.d] || 0) + 1;
  const firstRead = items.every(i => !SEEN[i.u]), recent = items.filter(i => i.d && NOW - Date.parse(i.d) < 2 * DAY).length;
  let reads = 0;
  for (const i of items) {
    const first = SEEN[i.u] || TODAY;
    const bad = !!i.d && (cnt[i.d] >= 3 || Date.parse(i.d) > Date.parse(first) + 1.5 * DAY || (firstRead && recent >= 5 && NOW - Date.parse(i.d) < 2 * DAY));
    if (!bad && i.d) { i.d = i.d.slice(0, 10); continue; }
    if (!bad && !i.d) { const g = urlDate(i.u) || textDate(i.t); if (g) { i.d = g; i.t = i.t.replace(TXD, ' ').replace(/\s+/g, ' ').trim(); continue; } }
    if (!(i.u in AD) && reads >= 12) { i.d = null; continue; }
    if (!(i.u in AD)) { reads++; await sleep(500); }
    const d = await articleDate(i.u);
    i.d = d && (!bad || Date.parse(d) <= Date.parse(first) + 1.5 * DAY) ? d : null; }
  for (const i of items) SEEN[i.u] = SEEN[i.u] || TODAY;
  return { how, items: items.filter(i => !i.d || NOW - Date.parse(i.d) < 365 * DAY) }; }

/* titles in English and Slovenian, 25 at a time, kept from earlier runs */
const TR = PREV.tr || {};
async function translate(texts, tl) {
  const todo = [...new Set(texts.filter(t => t && !(TR[tl] && TR[tl][t])))]; TR[tl] = TR[tl] || {}; let fails = 0;
  for (let k = 0; k < todo.length && fails < 3; k += 25) { const part = todo.slice(k, k + 25);
    try { const body = new URLSearchParams(); part.forEach(x => body.append('q', x.slice(0, 500)));
      const r = await fetch('https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=' + tl, { method: 'POST', body, headers: { 'user-agent': UA } });
      const j = r.ok ? await r.json() : null;
      if (Array.isArray(j) && j.length === part.length) { part.forEach((x, n) => { const v = Array.isArray(j[n]) ? j[n][0] : j[n]; if (v) TR[tl][x] = unx(v); }); fails = 0; } else fails++; } catch (_) { fails++; }
    await sleep(800); } }

const out = [], pby = Object.fromEntries((PREV.members || []).map(x => [x.k, x]));
for (const m of CFG.members) {
  const prev = pby[m.k] || { news: [] };
  if (ONLY && !ONLY.has(m.k)) { out.push(prev.k ? prev : { k: m.k, how: 'none', news: [] }); continue; }
  let res; try { res = await readMember(m); } catch (e) { res = { how: 'quiet', items: [] }; }
  const by = new Map((prev.news || []).map(i => [i.u, i]));
  for (const i of res.items) by.set(i.u, { t: i.t, u: i.u, d: i.d || (by.get(i.u) || {}).d || null, f: (by.get(i.u) || {}).f || SEEN[i.u] || TODAY });
  const news = [...by.values()].filter(i => NOW - Date.parse(i.d || i.f) < 365 * DAY).sort((a, b) => String(b.d || '').localeCompare(String(a.d || '')) || String(b.f).localeCompare(String(a.f))).slice(0, 40);
  out.push({ k: m.k, how: res.items.length ? res.how : (prev.how && prev.news && prev.news.length ? prev.how : res.how), read: res.items.length ? TODAY : (prev.read || null), news });
  console.log(`${m.k}: ${res.how}, ${res.items.length} articles read, ${news.filter(i => i.d).length} dated kept`);
  await sleep(600); }

const titles = out.flatMap(m => m.news.map(i => i.t));
await translate(titles, 'en'); await translate(titles, 'sl');
for (const m of out) for (const i of m.news) { i.te = TR.en[i.t] && TR.en[i.t] !== i.t ? TR.en[i.t] : undefined; i.ts = TR.sl[i.t] && TR.sl[i.t] !== i.t ? TR.sl[i.t] : undefined; }
/* only what the page needs is kept: translations of current titles, the first-seen days and checked dates of the last year */
const keepU = new Set(out.flatMap(m => m.news.map(i => i.u))), keepT = new Set(titles);
const prune = (o, keep) => Object.fromEntries(Object.entries(o).filter(([k]) => keep.has(k)));
fs.writeFileSync(path.join(ROOT, 'data/fehrl.json'), JSON.stringify({
  about: 'News of the FEHRL members from their own websites, read once a day by tools/fehrl_news.mjs. d is the published date (empty when the website gives none), f the day the article was first seen.',
  updated: new Date().toISOString(), members: out,
  seen: Object.fromEntries(Object.entries(SEEN).filter(([, v]) => NOW - Date.parse(v) < 400 * DAY)), ad: prune(AD, keepU), tr: { en: prune(TR.en || {}, keepT), sl: prune(TR.sl || {}, keepT) },
}) + '\n');
console.log(`FEHRL news: ${out.reduce((a, m) => a + m.news.length, 0)} articles from ${out.filter(m => m.news.length).length} of ${out.length} members`);
