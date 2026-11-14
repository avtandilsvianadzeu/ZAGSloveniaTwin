#!/usr/bin/env node
/* Checks of the published Data API (api/v1): every JSON and GeoJSON file parses, every feature has a geometry,
   every coordinate lies within Slovenia and its border area, and the object list and the per-object files match.
   Exit code 1 on any problem. Usage: node tools/qa/check_api.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = path.join(ROOT, 'api', 'v1');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(API).filter(f => /\.(json|geojson)$/.test(f));
const bad = [];
const coords = g => { if (!g) return []; const c = g.coordinates;
  switch (g.type) { case 'Point': return [c]; case 'LineString': case 'MultiPoint': return c; case 'Polygon': case 'MultiLineString': return c.flat();
    case 'MultiPolygon': return c.flat(2); case 'GeometryCollection': return g.geometries.flatMap(coords); default: return []; } };
for (const f of files) {
  let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { bad.push(`${path.relative(ROOT, f)}: does not parse (${e.message.slice(0, 60)})`); continue; }
  if (d && d.type === 'FeatureCollection') for (const ft of d.features) {
    const id = (ft.properties || {}).id || '?';
    if (!ft.geometry) { bad.push(`${path.relative(ROOT, f)}: ${id} has no geometry`); continue; }
    const out = coords(ft.geometry).find(([x, y]) => !(x >= 13.3 && x <= 16.7 && y >= 45.3 && y <= 46.95));
    if (out) bad.push(`${path.relative(ROOT, f)}: ${id} has a point outside Slovenia (${out[0]}, ${out[1]})`);
  }
}
const list = JSON.parse(fs.readFileSync(path.join(API, 'objects.json'), 'utf8'));
const ids = new Set((Array.isArray(list) ? list : list.objects || []).map(o => o.id));
const per = new Set(fs.readdirSync(path.join(API, 'objects')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)));
for (const id of ids) if (!per.has(id)) bad.push(`objects/${id}.json is missing`);
for (const id of per) if (!ids.has(id)) bad.push(`objects/${id}.json is not in objects.json`);
console.log(`API: ${files.length} files, ${ids.size} objects, ${bad.length} problems`);
bad.slice(0, 40).forEach(b => console.log('  ' + b));
process.exit(bad.length ? 1 : 0);
