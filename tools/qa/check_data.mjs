#!/usr/bin/env node
/* Data checks of the ZAG Digital Atlas. Reads the published data and reports what would embarrass the site:
   typography that the house style excludes, working notes left in public fields, values without a source,
   records without a position, differences without a lead label, coordinates outside Slovenia, duplicate ids.
   Exit code 1 when a blocking problem is found, 0 otherwise. Writes qa/data-report.json. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const twins = JSON.parse(read('data/twins.json')).objects;
const geo = JSON.parse(read('data/zag_projects.geojson'));
const problems = []; // {level: 'block'|'warn', where, what}
const add = (level, where, what) => problems.push({ level, where, what });

/* 1. house style: no dashes, semicolons, middle dots or ellipses in text the atlas writes itself (quotes are exempt) */
const BAD = /[–—…·•;]/;
const own = [];
for (const [id, t] of Object.entries(twins)) {
  if (t.summary) own.push([id + ' summary', t.summary]);
  (t.differences || []).forEach((x, i) => own.push([`${id} difference ${i}`, x]));
  if (t.open) own.push([id + ' open', t.open]);
  (t.specs || []).forEach(s => { own.push([`${id} spec label "${s.label}"`, s.label]); if (s.quote_note) own.push([`${id} spec note "${s.label}"`, s.quote_note]); });
}
for (const [where, text] of own) { const m = String(text).match(BAD); if (m) add('warn', where, `house style: contains "${m[0]}"`); }

/* 2. working notes that belong in the editorial field, not on the site */
const NOTE = /\b(read (again )?(on )?\d{1,2} \w+ 20\d\d|could not be (opened|read|fetched)|not re-?(read|verified)|earlier note|an earlier|in this check|this check|not checked|NOT re|stored point|the record (says|text|wording|calls)|record says|unverified here|did not give its text|we |our )/i;
for (const [id, t] of Object.entries(twins)) {
  (t.differences || []).forEach((x, i) => { const m = x.match(NOTE); if (m) add('block', `${id} difference ${i}`, `working note on the site: "${m[0]}"`); });
  if (t.open && NOTE.test(t.open)) add('block', id + ' open', 'working note on the site');
}

/* 3. every difference opens with a lead label, "Length: ..." */
for (const [id, t] of Object.entries(twins)) (t.differences || []).forEach((x, i) => { if (!/^[^:]{3,80}:\s/.test(x)) add('warn', `${id} difference ${i}`, 'no lead label before a colon'); });

/* 4. values without a source link */
let specs = 0, unsourced = 0;
for (const [id, t] of Object.entries(twins)) for (const s of t.specs || []) { specs++; if (!s.source) { unsourced++; add('warn', `${id} spec "${s.label}"`, 'value without a source link'); } }

/* 5. records: unique ids, a position inside the Slovenian extent, a twin record */
const ids = new Set();
for (const f of geo.features) {
  const p = f.properties, [lon, lat] = f.geometry.coordinates;
  if (ids.has(p.id)) add('block', p.id, 'duplicate id'); ids.add(p.id);
  if (!(lon > 13.2 && lon < 16.8 && lat > 45.3 && lat < 47.0)) add('block', p.id, `position outside Slovenia: ${lat}, ${lon}`);
  if (!twins[p.id]) add('warn', p.id, 'no asset record in twins.json');
  if (!p.name && !p.name_en) add('block', p.id, 'no name');
}
for (const id of Object.keys(twins)) if (!ids.has(id)) add('warn', id, 'asset record without a map feature');

/* 6. source links are https and well formed */
for (const [id, t] of Object.entries(twins)) for (const s of t.specs || []) if (s.source && !/^https?:\/\/\S+$/.test(s.source)) add('block', `${id} spec "${s.label}"`, `malformed source link: ${s.source}`);

const blocks = problems.filter(p => p.level === 'block'), warns = problems.filter(p => p.level === 'warn');
const report = { checked: new Date().toISOString(), records: geo.features.length, assetRecords: Object.keys(twins).length, specifications: specs, unsourced, blocking: blocks.length, warnings: warns.length, problems };
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa/data-report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(`data: ${geo.features.length} records, ${specs} values (${unsourced} without a source), ${blocks.length} blocking, ${warns.length} warnings`);
for (const p of blocks) console.log('  BLOCK', p.where, ':', p.what);
for (const p of warns.slice(0, 40)) console.log('  warn ', p.where, ':', p.what);
if (warns.length > 40) console.log(`  ... ${warns.length - 40} more warnings in qa/data-report.json`);
process.exit(blocks.length ? 1 : 0);
