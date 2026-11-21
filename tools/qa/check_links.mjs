#!/usr/bin/env node
/* Source link check of the DigitalZAG. Every value carries the link it was read from; this asks each distinct
   host once per link whether the page still answers (HEAD, then GET on refusal). Slow and dependent on other sites,
   so it runs on a schedule, never on every push. Writes qa/links-report.json; never fails the build. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const twins = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/twins.json'), 'utf8')).objects;
const links = new Map();
for (const [id, t] of Object.entries(twins)) for (const s of t.specs || []) if (s.source) { if (!links.has(s.source)) links.set(s.source, []); links.get(s.source).push(id); }
const UA = 'Mozilla/5.0 (DigitalZAG link check)';
async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000);
      const r = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*' }, signal: c.signal }); clearTimeout(t);
      if (r.ok) return { ok: true, status: r.status }; if (method === 'HEAD') continue; /* some servers answer HEAD wrongly, so every refusal is asked again with GET */
      return { ok: false, status: r.status };
    } catch (e) { if (method === 'GET') return { ok: false, status: 0, error: e.name }; }
  }
  return { ok: false, status: 0 };
}
/* 401, 403, 429 and 503 mean the website turned the checker away (many sites refuse automatic readers), not that the
   page is gone: those are listed apart as refused, and only the others count as broken */
const REFUSED = [401, 403, 429, 503];
const out = { checked: new Date().toISOString(), total: links.size, broken: [], refused: [] };
let i = 0; const list = [...links.entries()];
const pool = 6; const next = async () => { while (i < list.length) { const [url, ids] = list[i++]; const r = await probe(url); if (!r.ok) (REFUSED.includes(r.status) ? out.refused : out.broken).push({ url, status: r.status, error: r.error, records: [...new Set(ids)] }); } };
await Promise.all(Array.from({ length: pool }, next));
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa/links-report.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`links: ${out.total} checked, ${out.broken.length} broken, ${out.refused.length} refused the checker`);
for (const b of out.broken.slice(0, 60)) console.log(' ', b.status || b.error || '?', b.url, '(' + b.records.join(', ') + ')');
