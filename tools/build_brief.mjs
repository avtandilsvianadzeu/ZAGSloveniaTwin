#!/usr/bin/env node
/* ZAG Radar: a short weekly brief for ZAG management, built only from public sources.
   Sections: open EU calls that match ZAG's fields, with past partners who work on the same topics;
   projects newly found in CORDIS or announced on zag.si; partners whose websites show new AI topics;
   ZAG in the media; news about structures in the atlas.
   Reads data/international.json, data/intl_updates.json, data/partners.json, data/zag_news.json, data/news.json
   and the EU Funding and Tenders portal. Writes data/brief.json, data/briefs/<year>-W<week>.json and data/brief_state.json.
   Run: node tools/build_brief.mjs   (Node 18 or newer, no packages) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (_) { return null; } };
const INT = rd('data/international.json') || { projects: [], countries: [] }, UPD = rd('data/intl_updates.json') || {}, PAR = rd('data/partners.json') || { items: [] };
const ZN = rd('data/zag_news.json') || { items: {} }, NEWS = rd('data/news.json') || { items: {} }, STATE = rd('data/brief_state.json') || {};
const now = new Date(), WEEK = 7 * 864e5, recent = d => d && now - Date.parse(d) < WEEK;
const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s*[–—]\s*/g, ', ').replace(/\s+/g, ' ').trim();

/* ZAG's fields, each with the words that mark a call topic as relevant */
const FIELDS = [
  ['Bridges and structures', /\bbridges?\b|viaduct|structural (health|integrity|safety)|load testing|weigh[- ]in[- ]motion|\bSHM\b/i],
  ['Transport infrastructure', /\b(road|railway|rail|motorway|highway)s? (infrastructure|assets?|pavements?|maintenance|resilience|monitoring|bridges?|tunnels?)|transport infrastructure|\btunnels?\b|\bpavements?\b/i],
  ['Construction materials', /\b(concrete|cement|binder|steel corrosion|asphalt|bitumen|aggregates?|geopolymer|construction materials?)\b/i],
  ['Circular construction', /circular (construction|economy in (the )?built|building)|construction and demolition waste|secondary raw materials? .{0,30}construction|reuse of building/i],
  ['Buildings and energy', /\b(building envelope|energy performance of buildings|renovation wave|deep renovation|zero[- ]emission buildings?|building stock|retrofit\w*)\b/i],
  ['Fire safety', /\bfire (safety|resistance|testing|engineering)|wildland[- ]urban/i],
  ['Earthquakes and natural hazards', /\b(seismic|earthquake|landslide|natural hazards?|flood resilience|climate[- ]resilient infrastructure)\b/i],
  ['Timber construction', /\b(timber|wood(en)?) (construction|buildings?|structures?)|engineered wood|bio[- ]based (building|construction)/i],
  ['Digital construction and AI', /\bBIM\b|building information model\w*|(digital twins?|artificial intelligence|machine learning|\bAI\b).{0,80}(construction|civil infrastructure|transport infrastructure|buildings?|bridges?|built environment)|(construction|civil infrastructure|transport infrastructure|buildings?|bridges?|built environment).{0,80}(digital twins?|artificial intelligence|machine learning|\bAI\b)/i],
  ['Cultural heritage', /\b(built heritage|historic buildings?|heritage science|monuments?)\b|cultural heritage (materials|sites|buildings|structures|conservation)/i],
  ['Metrology and testing', /(metrology|reference materials?|standardi[sz]ation|test methods?|testing facilit\w*).{0,80}(construction|buildings?|materials|infrastructure)/i]];

async function openCalls() {
  const form = new FormData();
  form.append('query', new Blob([JSON.stringify({ bool: { must: [{ terms: { type: ['1', '2'] } }, { terms: { status: ['31094501', '31094502'] } }] } })], { type: 'application/json' }));
  form.append('languages', new Blob(['["en"]'], { type: 'application/json' }));
  form.append('sort', new Blob([JSON.stringify({ field: 'sortStatus', order: 'ASC' })], { type: 'application/json' }));
  const out = [];
  for (let page = 1; page <= 30; page++) {
    const r = await fetch(`https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***&pageSize=100&pageNumber=${page}`, { method: 'POST', body: form });
    if (!r.ok) throw new Error('Funding and Tenders ' + r.status);
    const j = await r.json(), res = j.results || [];
    for (const x of res) { const m = x.metadata || {}, g = k => (m[k] || [])[0] || '';
      out.push({ id: g('identifier'), title: clean(g('title')), call: clean(g('callTitle')), desc: clean(g('description')).slice(0, 4000), status: g('status') === '31094501' ? 'forthcoming' : 'open',
        deadline: (m.deadlineDate || []).map(d => d.slice(0, 10)).sort().find(d => d >= now.toISOString().slice(0, 10)) || (m.deadlineDate || [])[0]?.slice(0, 10) || '', opens: g('startDate').slice(0, 10) }); }
    if (res.length < 100) break;
  }
  /* only calls that can still be answered: a deadline today or later */
  const today = now.toISOString().slice(0, 10);
  return [...new Map(out.filter(c => c.id && c.deadline && c.deadline >= today).map(c => [c.id, c])).values()];
}

/* partners who already worked with ZAG and whose websites show the same field */
const TOPIC_FIELD = { 'bridges': 'Bridges and structures', 'structural health monitoring': 'Bridges and structures', 'weigh-in-motion': 'Bridges and structures', 'railways': 'Transport infrastructure', 'construction materials': 'Construction materials', 'earthquake engineering': 'Earthquakes and natural hazards', 'BIM': 'Digital construction and AI', 'digital twin': 'Digital construction and AI', 'machine learning': 'Digital construction and AI', 'artificial intelligence': 'Digital construction and AI' };
const partnerFields = p => new Set([...(p.infra || []), ...(p.ai || [])].map(t => TOPIC_FIELD[t.topic]).filter(Boolean));
const suggest = fields => PAR.items.filter(p => (p.projects || []).length && [...partnerFields(p)].some(f => fields.includes(f))).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 4)
  .map(p => ({ name: p.name, country: p.country, shared: (p.projects || []).length, last: p.last || null }));

const brief = { generated: now.toISOString(), week: (() => { const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const y = d.getUTCFullYear(); return `${y}-W${String(Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`; })(), sections: {} };
try {
  const calls = await openCalls();
  const hits = calls.map(c => { const txt = c.title + ' ' + c.call + ' ' + c.desc; const f = FIELDS.filter(([, re]) => re.test(txt)).map(([n]) => n); return { ...c, fields: f }; }).filter(c => c.fields.length)
    .sort((a, b) => b.fields.length - a.fields.length || (a.deadline || '9').localeCompare(b.deadline || '9'));
  const seen = new Set(STATE.calls || []);
  brief.sections.calls = { checked: calls.length, items: hits.slice(0, 25).map(c => ({ id: c.id, title: c.title, call: c.call, status: c.status, opens: c.opens, deadline: c.deadline, fields: c.fields, isNew: !seen.has(c.id), url: `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${c.id.toLowerCase()}`, partners: suggest(c.fields) })) };
  STATE.calls = [...new Set([...(STATE.calls || []), ...hits.map(c => c.id)])].slice(-3000);
} catch (e) { brief.sections.calls = { error: 'The EU Funding and Tenders portal could not be read today: ' + e.message, items: [] }; }

const known = new Set(STATE.projects || []);
brief.sections.projects = { items: INT.projects.filter(p => !known.size ? /Added from CORDIS|announced on zag.si/i.test(p.n || '') : !known.has(p.id)).map(p => ({ acronym: p.a, title: p.t, funder: p.f, years: p.y, countries: (p.c || []).filter(c => c !== 'SI').length, role: p.r || '', url: p.s })),
  announced: (UPD.announced_on_zag_si || []).map(a => ({ acronym: a.acronym, title: a.title, url: a.url, date: a.date })) };
STATE.projects = INT.projects.map(p => p.id);

const prevAI = STATE.ai || {};
const aiNew = PAR.items.filter(p => (p.ai || []).length).map(p => ({ p, added: (p.ai || []).map(a => a.topic).filter(t => !(prevAI[p.key] || []).includes(t)) })).filter(x => Object.keys(prevAI).length ? x.added.length : true);
brief.sections.partners = { first: !Object.keys(prevAI).length, withAI: PAR.items.filter(p => (p.ai || []).length).length, read: (PAR.counts || {}).read || 0,
  items: aiNew.sort((a, b) => (b.p.score || 0) - (a.p.score || 0)).slice(0, 12).map(({ p, added }) => ({ name: p.name, country: p.country, topics: added, shared: (p.projects || []).length, last: p.last || null, website: p.website, contact: p.contact || null })) };
STATE.ai = Object.fromEntries(PAR.items.map(p => [p.key, (p.ai || []).map(a => a.topic)]));

brief.sections.media = { items: (ZN.items.media || []).filter(i => i.reviewed !== false && recent(i.date)).map(i => ({ title: i.title, outlet: i.outlet, date: i.date, url: i.url })) };
brief.sections.zag = { items: (ZN.items.latest || []).filter(i => recent(i.date)).map(i => ({ title: clean(i.title), date: i.date, url: i.url })) };
brief.sections.structures = { items: Object.entries(NEWS.items || {}).flatMap(([id, l]) => l.filter(i => recent(i.date)).map(i => ({ id, title: i.title, source: i.source, date: i.date, url: i.url }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15) };

const S = brief.sections;
brief.summary = { calls: (S.calls.items || []).length, newCalls: (S.calls.items || []).filter(c => c.isNew).length, projects: S.projects.items.length, partnersAI: S.partners.withAI, media: S.media.items.length, zag: S.zag.items.length, structures: S.structures.items.length };
fs.mkdirSync(path.join(ROOT, 'data/briefs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/brief.json'), JSON.stringify(brief, null, 1) + '\n');
fs.writeFileSync(path.join(ROOT, `data/briefs/${brief.week}.json`), JSON.stringify(brief) + '\n');
const idx = fs.readdirSync(path.join(ROOT, 'data/briefs')).filter(f => /^\d{4}-W\d{2}\.json$/.test(f)).sort().reverse();
fs.writeFileSync(path.join(ROOT, 'data/briefs/index.json'), JSON.stringify(idx.map(f => f.replace('.json', ''))) + '\n');
fs.writeFileSync(path.join(ROOT, 'data/brief_state.json'), JSON.stringify(STATE) + '\n');
console.log('ZAG Radar', brief.week, JSON.stringify(brief.summary));
