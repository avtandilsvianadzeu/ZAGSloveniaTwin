#!/usr/bin/env node
/* Laser scan massing for the main map. Reads every file of data/lidar (1 m cells of measured height above the ground inside
   the cadastre outlines, GURS laser scanning, NDMP) and writes data/lidar_massing.json: the buildings as blocks that follow
   the real roofs, one block for each rectangle of cells with the same height band (0.5 m), merged across rows and columns.
   Also writes for each record one site outline (the cells' bounding hull, 3 m wider), so the map can hide the generic
   OpenStreetMap blocks there. Nothing is drawn from other maps: only the GURS measurement.
   Run: node tools/build_lidar_massing.js */
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data/lidar'), BAND = 1.0, MINH = 2.0, R = 2;
const out = [], hulls = [], sites = [];
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
  const id = f.replace(/\.json$/, ''), S = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), g = S.grid;
  const raw = Buffer.from(S.z, 'base64'), n = g.nx * g.ny; if (raw.length !== n * 2) { console.error('grid size', id); continue; }
  /* height band of each cell, -1 where no outline or below MINH (ground, low canopies, noise) */
  const z = new Float32Array(n); for (let k = 0; k < n; k++) { const v = raw.readUInt16LE(2 * k); z[k] = v === 65535 ? NaN : v / 10; }
  /* a 5 by 5 median inside the outline takes out noisy cells (chimneys, antennas, birds) and keeps real roof edges */
  const band = new Int16Array(n).fill(-1);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) { const k = j * g.nx + i; if (z[k] !== z[k]) continue; const w = [];
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const ii = i + x, jj = j + y; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue; const v = z[jj * g.nx + ii]; if (v === v) w.push(v); }
    w.sort((a, b) => a - b); const h = w[w.length >> 1]; if (h >= MINH) band[k] = Math.round(h / BAND); }
  /* cell corner (i, j) in longitude and latitude, from the three georeferenced corners of the grid */
  const ll = (i, j) => [g.sw[0] + (g.se[0] - g.sw[0]) * i / g.nx + (g.nw[0] - g.sw[0]) * j / g.ny, g.sw[1] + (g.se[1] - g.sw[1]) * i / g.nx + (g.nw[1] - g.sw[1]) * j / g.ny];
  const r6 = c => [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6];
  /* greedy rectangles: grow along the row, then upwards while the whole row segment has the same band */
  const used = new Uint8Array(n), rects = []; let blocks = 0, minI = 1e9, minJ = 1e9, maxI = -1, maxJ = -1;
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const k = j * g.nx + i, b = band[k]; if (b < 0 || used[k]) continue;
    let w = 1; while (i + w < g.nx && band[k + w] === b && !used[k + w]) w++;
    let h = 1; grow: while (j + h < g.ny) { for (let q = 0; q < w; q++) { const kk = (j + h) * g.nx + i + q; if (band[kk] !== b || used[kk]) break grow; } h++; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) used[(j + y) * g.nx + i + x] = 1;
    minI = Math.min(minI, i); minJ = Math.min(minJ, j); maxI = Math.max(maxI, i + w); maxJ = Math.max(maxJ, j + h);
    rects.push(i, j, w, h, b);
    blocks++;
  }
  if (maxI > 0) { const m = 3; hulls.push({ type: 'Feature', properties: { id }, geometry: { type: 'Polygon', coordinates: [[ll(minI - m, minJ - m), ll(maxI + m, minJ - m), ll(maxI + m, maxJ + m), ll(minI - m, maxJ + m), ll(minI - m, minJ - m)].map(r6)] } }); }
  sites.push({ id, nx: g.nx, ny: g.ny, sw: g.sw, se: g.se, nw: g.nw, r: rects }); console.log(id, blocks, 'blocks');
}
/* compact: per record the grid corners and the rectangles as cell numbers (i, j, width, height, band), the map turns them into blocks */
const doc = { about: 'Buildings of DigitalZAG records as blocks that follow the measured roofs: GURS laser scanning of Slovenia (CLSS, NDMP), 1 m cells inside the cadastre outlines, smoothed with a 5 by 5 median, heights above the ground in ' + BAND + ' m bands (height = band x ' + BAND + '), cells under ' + MINH + ' m left out. Rectangles r are i, j, width, height, band in grid cells, rows from south to north. Built by tools/build_lidar_massing.js from data/lidar.', band_m: BAND, sites, hulls };
fs.writeFileSync(path.join(ROOT, 'data/lidar_massing.json'), JSON.stringify(doc));
try { fs.unlinkSync(path.join(ROOT, 'data/lidar_massing.geojson')); } catch (_) {}
console.log('lidar_massing.json:', sites.reduce((a, x) => a + x.r.length / 5, 0), 'blocks,', (fs.statSync(path.join(ROOT, 'data/lidar_massing.json')).size / 1024).toFixed(0), 'KB');
