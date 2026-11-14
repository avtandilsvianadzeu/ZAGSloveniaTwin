#!/usr/bin/env node
/* Source link check of the ZAG Digital Atlas. Every value carries the link it was read from; this asks each distinct
   host once per link whether the page still answers (HEAD, then GET on refusal). Slow and dependent on other sites,
   so it runs on a schedule, never on every push. Writes qa/links-report.json; never fails the build. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const twins = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/twins.json'), 'utf8')).objects;
const links = new Map();
for (const [id, t] of Object.entries(twins)) for (const s of t.specs || []) if (s.source) { if (!links.has(s.source)) links.set(s.source, []); links.get(s.source).push(id); }
const UA = 'Mozilla/5.0 (ZAG Digital Atlas link check)';
async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000);
      const r = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*' }, signal: c.signal }); clearTimeout(t);
      if (r.ok || (method === 'HEAD' && [403, 405, 501].includes(r.status))) { if (r.ok) return { ok: true, status: r.status }; continue; }
      return { ok: false, status: r.status };
    } catch (e) { if (method === 'GET') return { ok: false, status: 0, error: e.name }; }
  }
  return { ok: false, status: 0 };
}
const out = { checked: new Date().toISOString(), total: links.size, broken: [] };
let i = 0; const list = [...links.entries()];
const pool = 6; const next = async () => { while (i < list.length) { const [url, ids] = list[i++]; const r = await probe(url); if (!r.ok) out.broken.push({ url, status: r.status, error: r.error, records: [...new Set(ids)] }); } };
await Promise.all(Array.from({ length: pool }, next));
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa/links-report.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`links: ${out.total} checked, ${out.broken.length} not answering`);
for (const b of out.broken.slice(0, 60)) console.log(' ', b.status || b.error || '?', b.url, '(' + b.records.join(', ') + ')');
