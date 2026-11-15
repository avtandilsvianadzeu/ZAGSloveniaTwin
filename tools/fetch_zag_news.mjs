#!/usr/bin/env node
/* Reads the latest items of "Aktualno" from zag.si (the public RSS feeds in Slovenian and English)
   and writes data/zag_news.json, so the atlas shows what ZAG itself has published. Run by the news workflow. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FEEDS = { sl: 'https://www.zag.si/aktualno/feed/', en: 'https://www.zag.si/en/news/feed/' };
/* ZAG in the Slovenian media, from Google News (title, outlet, link, date), as a third list */
/* the ZAG media monitor: Google News searches for the institute's names in Slovenian and English */
const GN = (q, lang) => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + (lang === 'en' ? '&hl=en&gl=SI&ceid=SI:en' : '&hl=sl&gl=SI&ceid=SI:sl');
const MEDIA = [GN('"Zavod za gradbeništvo Slovenije"', 'sl'), GN('"ZAG Ljubljana" OR "Inštitut ZAG" OR "ZAG-u" OR "na ZAG"', 'sl'), GN('"Zavodu za gradbeništvo" OR "Zavoda za gradbeništvo"', 'sl'),
  GN('"Slovenian National Building and Civil Engineering Institute"', 'en'), GN('"ZAG" Slovenia institute building', 'en')];
let SRC = {}; try { SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/media_sources.json'), 'utf8')); } catch (_) {}
const KINDS = Object.keys(SRC).filter(k => !k.startsWith('_') && Array.isArray(SRC[k]) && !/^block/.test(k));
const onDomain = (d, list) => (list || []).some(x => d === x || d.endsWith('.' + x));
const kindOf = d => KINDS.find(k => onDomain(d, SRC[k])) || null;
const BLOCK_WORDS = (SRC.block_words || []).map(w => new RegExp('(^|[^a-zčšž])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-zčšž]|$)', 'i'));
/* the atlas does not talk about money: headlines with amounts in euros or about costs are left out */
const MONEY = /(\d[\d.,]*\s*(mio|milijon\w*|milijard\w*|million|billion|tisoč)?\s*(evr\w*|eur\b|euros?\b|€))|€\s?\d/i;
const SPAM_DOMAIN = /(casino|bet|porn|xxx|adult|escort|crypto|loan|pharma|viagra|torrent|\.xyz$|\.top$|\.click$|\.loan$)/i;
const ZAG_RULES = [[/zavod\w* za gradbeni[sš]tvo/i, 'headline names Zavod za gradbeništvo Slovenije'], [/national building and civil engineering institute/i, 'headline names the institute in English'], [/\bZAG\b/, 'headline names ZAG']];
/* atlas records a zag.si item or a media item talks about, from the record keywords used for the news search */
let KW = {}; try { KW = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/news_keywords.json'), 'utf8')); } catch (_) {}
const nrm = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const recordsIn = text => { const h = nrm(text), ws = h.split(/[^a-z0-9]+/).filter(Boolean);
  /* a stem matches the start of a word, a phrase matches anywhere; the institute's own name tags nothing, since every item names it */
  const hit = m => { const s = nrm(m); return s.includes(' ') ? h.includes(s) : ws.some(w => w.startsWith(s)); };
  return Object.entries(KW).filter(([id, k]) => { if (id.startsWith('_') || id === 'zag') return false; const must = (k.must || []).filter(m => !/^(zag|zavod)/.test(nrm(m)));
    /* a generic word (earthquake, fire, bridge) links a record only together with the place its search names */
    const spec = must.filter(m => !GENERIC.test(nrm(m))), place = (String(k.q || '').replace(/"[^"]*"/g, ' ').match(/[A-ZČŠŽ][a-zčšž]{2,}/g) || []).filter(w => w !== 'OR');
    const ok = spec.some(hit) || (must.some(hit) && place.some(hit));
    return must.length && ok && (k.all || []).every(hit) && !(k.not || []).some(m => h.includes(nrm(m))); }).map(([id]) => id); };
const GENERIC = /^(potres|pozar|pozarn|most|predor|viadukt|zled|brv|klif|jez|elektrarn|laboratorij)/;
const MAX = 10;
const un = s => s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/&#8211;/g, ', ').replace(/&#8217;/g, "'").replace(/&#8220;|&#8221;|&quot;/g, '"')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/\s+/g, ' ').trim();
const tag = (x, t) => { const m = x.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')); return m ? un(m[1]) : ''; };
async function read(lang, url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (DigitalZAG news reader)' } });
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
const media = []; let dropped = 0;
for (const url of MEDIA) { try { const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (DigitalZAG news reader)' } }); if (!r.ok) continue; const xml = await r.text();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) { const x = m[1], d = tag(x, 'pubDate'), t = tag(x, 'title'), src = tag(x, 'source');
    const title = src && t.endsWith(' - ' + src) ? t.slice(0, -(src.length + 3)) : t.replace(/\s+-\s+[^-]+$/, ''); const rule = ZAG_RULES.find(([re]) => re.test(title));
    const domain = ((x.match(/<source[^>]*url="https?:\/\/(?:www\.)?([^/"]+)/) || [])[1] || '').toLowerCase();
    if (!rule || !title || media.some(y => nrm(y.title) === nrm(title))) continue;
    /* filters: blocked domains, spam domains and spam words never pass; old items are left out */
    if (onDomain(domain, SRC.block) || SPAM_DOMAIN.test(domain) || BLOCK_WORDS.some(re => re.test(title)) || MONEY.test(title)) { dropped++; continue; }
    if (d && Date.now() - Date.parse(d) > 400 * 864e5) continue;
    const kind = kindOf(domain);
    media.push({ title, outlet: src || (t.match(/\s-\s([^-]+)$/) || [])[1] || '', domain, kind: kind || 'not reviewed', reviewed: !!kind, url: tag(x, 'link'), date: d ? new Date(d).toISOString() : null, match: rule[1], records: recordsIn(title) }); } } catch (e) { console.error('media feed failed', e.message); } }
if (media.length) out.items.media = media.filter(i => i.url).sort((a, b) => (b.reviewed - a.reviewed) || (b.date || '').localeCompare(a.date || '')).slice(0, 40).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
out.media_check = { queries: MEDIA.length, kept: (out.items.media || []).length, reviewed: (out.items.media || []).filter(i => i.reviewed).length, dropped };
/* zag.si items: which atlas records they mention */
for (const l of ['sl', 'en', 'latest']) (out.items[l] || []).forEach(i => { const r = recordsIn(i.title + ' ' + (i.summary || '')); if (r.length) i.records = r; });
const file = path.join(ROOT, 'data/zag_news.json');
let prev = null; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
const same = prev && JSON.stringify(prev.items) === JSON.stringify(out.items);
if (!Object.keys(out.items).length) { console.error('no feed read, file kept'); process.exit(0); }
if (same) { console.log('zag.si news unchanged'); process.exit(0); }
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log('zag.si news written:', Object.entries(out.items).map(([l, a]) => l + ' ' + a.length).join(', '));
