#!/usr/bin/env node
/* EU database sync for the International page. Asks CORDIS (the EU research project database) for every project that
   names ZAG, reads each project's official record and adds a project that the atlas does not have yet, but only when
   ZAG is listed among its participants. Countries come from the CORDIS participant list, with UK and EL written as GB and GR.
   Also reads the zag.si news feed for international projects it announces and records them for review.
   Writes data/international.json (projects added, country totals updated) and data/intl_updates.json.
   Run: node tools/sync_cordis.mjs   (Node 18 or newer, no packages) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data/international.json');
const D = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const UA = { 'user-agent': 'Mozilla/5.0 (DigitalZAG EU database sync)' };
const FIX = { UK: 'GB', EL: 'GR' };
const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tag = (x, t) => (x.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [, ''])[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
const isZag = o => /zavod\s+za\s+gradbeni[sš]tvo\s+slovenije/i.test(o.legalName || o.name || '');

async function cordisList() {
  const q = encodeURIComponent("'ZAVOD ZA GRADBENISTVO SLOVENIJE' AND contenttype='project'");
  const r = await fetch(`https://cordis.europa.eu/search?q=${q}&format=xml&p=1&num=100`, { headers: UA });
  if (!r.ok) throw new Error('CORDIS search ' + r.status);
  const xml = await r.text();
  return [...xml.matchAll(/<project[\s>][\s\S]*?<\/project>/g)].map(m => ({ id: tag(m[0], 'id'), acronym: tag(m[0], 'acronym'), title: tag(m[0], 'title'), start: tag(m[0], 'startDate'), end: tag(m[0], 'endDate'), fp: tag(m[0], 'frameworkProgramme') })).filter(p => p.id);
}
async function cordisProject(id) {
  const r = await fetch(`https://cordis.europa.eu/project/id/${id}/en?format=json`, { headers: UA });
  if (!r.ok) return null; const j = await r.json(); const P = j.payload || j;
  const A = ((P.relations || {}).associations) || [];
  const orgs = (Array.isArray(A) ? A : [A]).filter(a => a && a.contenttype === 'organization').map(o => ({ name: o.legalName || o.legalname || '', country: FIX[(o.address || {}).country] || (o.address || {}).country || '', role: String(((o.attributes || {}).type) || '').toLowerCase() }));
  return { orgs };
}
const FUND = { H2020: 'Horizon 2020', HORIZON: 'Horizon Europe', FP7: 'FP7' };

const have = new Set(D.projects.map(p => key(p.a))), haveId = new Set(D.projects.map(p => (String(p.s || '').match(/project\/id\/(\d+)/) || [])[1]).filter(Boolean));
const added = [], notZag = [];
try {
  const list = await cordisList();
  for (const p of list) {
    if (have.has(key(p.acronym)) || haveId.has(p.id)) continue;
    await sleep(700);
    const rec = await cordisProject(p.id); if (!rec || !rec.orgs.length) continue;
    const zag = rec.orgs.find(o => /zavod za gradbeni/i.test(o.name));
    if (!zag) { notZag.push({ acronym: p.acronym, id: p.id }); continue; }
    const countries = [...new Set(rec.orgs.map(o => o.country).filter(Boolean))].sort();
    const y0 = +(p.start || '').slice(0, 4) || null, y1 = +(p.end || '').slice(0, 4) || null;
    const coord = rec.orgs.find(o => /coordinator/.test(o.role));
    const item = { id: 'c_' + p.id, a: p.acronym, t: p.title, f: FUND[p.fp] || p.fp || 'EU', y: y0 && y1 ? `${y0} to ${y1}` : '', y0, y1, k: 'consortium', c: countries, s: `https://cordis.europa.eu/project/id/${p.id}/en`, r: /coordinator/.test(zag.role) ? 'coordinator' : 'participant', co: /coordinator/.test(zag.role), n: 'Added from CORDIS, where ZAG is listed among the participants' + (coord && !/zavod za gradbeni/i.test(coord.name) ? '' : '') };
    D.projects.push(item); have.add(key(p.acronym)); added.push({ acronym: p.acronym, id: p.id, countries: countries.length });
  }
} catch (e) { console.error('CORDIS sync failed:', e.message); }

/* country totals follow the project list */
const cnt = {}, fund = {}, first = {};
for (const p of D.projects) for (const c of p.c || []) { cnt[c] = (cnt[c] || 0) + 1; if (p.k === 'consortium') fund[c] = (fund[c] || 0) + 1; if (p.y0) first[c] = Math.min(first[c] || 9999, p.y0); }
const names = Object.fromEntries(D.countries.map(c => [c.iso, c.name]));
D.countries = Object.keys(cnt).filter(c => c !== 'SI').sort((a, b) => cnt[b] - cnt[a]).map(iso => ({ iso, name: names[iso] || iso, total: cnt[iso], funded: fund[iso] || 0, cost: cnt[iso] - (fund[iso] || 0), first: first[iso] || null }));

/* zag.si news that announces an international project not in the list: kept for review, never added by itself */
const announced = [];
try { const zn = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/zag_news.json'), 'utf8'));
  for (const i of [...(zn.items.sl || []), ...(zn.items.en || [])]) {
    const acr = (i.title + ' ' + (i.summary || '')).match(/\b[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9-]{2,}\b/g) || [];
    const projectWord = /projekt|project|interreg|horizon|obzorje|erasmus|cost action/i.test(i.title + ' ' + (i.summary || ''));
    for (const a of acr) if (projectWord && a.length >= 4 && (/[a-z]/.test(a) && /[A-Z].*[A-Z]/.test(a) || /\d/.test(a)) && !/^ZAG/i.test(a) && !have.has(key(a)) && !/^(ZAG|EU|ZAGBOT|AI|BIM|COST|HORIZON|INTERREG|ERASMUS|CE|LIFE)$/i.test(a) && !announced.some(x => key(x.acronym) === key(a)))
      announced.push({ acronym: a, title: i.title, url: i.url, date: i.date });
  } } catch (_) {}

fs.writeFileSync(FILE, JSON.stringify(D));
fs.writeFileSync(path.join(ROOT, 'data/intl_updates.json'), JSON.stringify({ checked: new Date().toISOString(), cordis_added: added, cordis_not_zag: notZag, announced_on_zag_si: announced }, null, 1) + '\n');
console.log(`CORDIS: ${added.length} added (${added.map(a => a.acronym).join(', ')}), ${notZag.length} found without ZAG as participant. zag.si announcements to review: ${announced.map(a => a.acronym).join(', ') || 'none'}`);
