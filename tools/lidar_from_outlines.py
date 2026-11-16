#!/usr/bin/env python3
"""Laser scan for the records whose 3D model has drawn outlines (data/twins.json, model.blocks with a ring).

For each such record without a file in data/lidar, it downloads the GURS laser scanning sheets (CLSS, file series NDMP,
1 km sheets with 0.5 m pixels of height above the ground) that cover the outlines, and writes data/lidar/<id>.json in the
same form as tools/import_lidar.js: 1 m cells, each the mean of the 0.5 m pixels whose centre lies inside an outline,
heights in decimetres, 65535 where no outline covers the cell, rows from south to north.

Runs on GitHub (.github/workflows/lidar.yml), where the GURS server can be reached. Needs numpy, rasterio, pyproj.
Run: python tools/lidar_from_outlines.py [record id ...]
"""
import base64, datetime, io, json, math, os, sys, urllib.request
import numpy as np
import rasterio
from pyproj import Transformer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FILE = 'https://ipi.eprostor.gov.si/javne-datoteke/DALJINSKO_ZAZNAVANJE/CLSS/ndmp/NDMP_'
TO96 = Transformer.from_crs(4326, 3794, always_xy=True)
TOLL = Transformer.from_crs(3794, 4326, always_xy=True)
twins = json.load(open(os.path.join(ROOT, 'data/twins.json'), encoding='utf-8'))['objects']
have = {f[:-5] for f in os.listdir(os.path.join(ROOT, 'data/lidar')) if f.endswith('.json')}
want = sys.argv[1:]


def inside(px, py, ring):
    """even-odd rule for many points at once"""
    c = np.zeros(px.shape, bool)
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]; x2, y2 = ring[(i + 1) % n]
        if y1 == y2:
            continue
        m = ((y1 > py) != (y2 > py)) & (px < (x2 - x1) * (py - y1) / (y2 - y1) + x1)
        c ^= m
    return c


def sheet(e, n):
    url = f'{FILE}{e}_{n}.tif'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'DigitalZAG laser scan reader'}), timeout=120) as r:
        data = r.read()
    return url, data


done = []
for rid, o in twins.items():
    blocks = [b for b in ((o.get('model') or {}).get('blocks') or []) if b.get('ring')]
    if not blocks or (want and rid not in want) or (not want and rid in have):
        continue
    rings = [[TO96.transform(x, y) for x, y in b['ring']] for b in blocks]
    xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
    x0, y0 = math.floor(min(xs)) - 1, math.floor(min(ys)) - 1
    nx, ny = math.ceil(max(xs)) + 1 - x0, math.ceil(max(ys)) + 1 - y0
    if nx * ny > 4_000_000:
        print(rid, 'outline too large, skipped'); continue
    # 0.5 m pixel centres of the area, row 0 at the south
    hx = x0 + 0.25 + 0.5 * np.arange(nx * 2); hy = y0 + 0.25 + 0.5 * np.arange(ny * 2)
    PX, PY = np.meshgrid(hx, hy)
    mask = np.zeros(PX.shape, bool)
    for r in rings:
        mask |= inside(PX, PY, r)
    val = np.full(PX.shape, np.nan)
    files = []
    for e in range(int(x0 // 1000), int((x0 + nx) // 1000) + 1):
        for n in range(int(y0 // 1000), int((y0 + ny) // 1000) + 1):
            try:
                url, data = sheet(e, n)
            except Exception as ex:
                print(rid, 'sheet', e, n, 'not read:', ex); continue
            files.append(url)
            with rasterio.MemoryFile(data) as mf, mf.open() as ds:
                a = ds.read(1).astype(float); nod = ds.nodata
                if nod is not None:
                    a[a == nod] = np.nan
                inv = ~ds.transform
                cols, rows = inv * (PX, PY)
                cols = np.floor(cols).astype(int); rows = np.floor(rows).astype(int)
                ok = (cols >= 0) & (rows >= 0) & (cols < ds.width) & (rows < ds.height) & mask
                val[ok] = a[rows[ok], cols[ok]]
    if not files:
        print(rid, 'no sheet could be read'); continue
    val[~mask] = np.nan
    # 1 m cells: mean of the 0.5 m pixels inside the outline
    v4 = val.reshape(ny, 2, nx, 2)
    cnt = np.sum(~np.isnan(v4), axis=(1, 3)); s = np.nansum(v4, axis=(1, 3))
    cell = np.where(cnt > 0, s / np.maximum(cnt, 1), np.nan)
    z = np.where(np.isnan(cell), 65535, np.clip(np.round(np.maximum(cell, 0) * 10), 0, 65534)).astype('<u2')
    cells = int(np.sum(~np.isnan(cell)))
    if cells == 0 or np.nanmax(cell) < 2:
        print(rid, 'nothing above 2 m inside the outlines, kept out'); continue
    sw = TOLL.transform(x0, y0); se = TOLL.transform(x0 + nx, y0); nw = TOLL.transform(x0, y0 + ny)
    day = datetime.date.today().isoformat()
    out = {'source': 'GURS, laser scanning of Slovenia (CLSS), file series NDMP, 0.5 m pixels', 'files': files, 'read': day,
           'terms': 'Geodetska uprava Republike Slovenije, general terms of use of geodetic data',
           'method': 'Each 1 m cell is the mean of the 0.5 m pixels whose centre lies inside an outline of the record\'s 3D model ('
                     + ', '.join(b['name'] for b in blocks)[:300] + '). Heights above the ground in decimetres, 65535 where no outline covers the cell. Rows run from south to north, cells from west to east.',
           'grid': {'nx': nx, 'ny': ny, 'cell_m': 1, 'crs': 'EPSG:3794', 'x0': x0, 'y0': y0, 'sw': list(sw), 'se': list(se), 'nw': list(nw)},
           'cells': cells, 'z': base64.b64encode(z.tobytes()).decode()}
    json.dump(out, open(os.path.join(ROOT, 'data/lidar', rid + '.json'), 'w'))
    done.append(rid)
    print(rid, f'{nx}x{ny}', cells, 'cells, highest', round(float(np.nanmax(cell)), 1), 'm')
print('written:', ', '.join(done) or 'none')
