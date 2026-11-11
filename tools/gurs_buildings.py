"""Tie each building record of the atlas to its official GURS building.

Reads the GURS topographic building layer (DTM_SLO_ZGRADBE_BU_STAVBE_P, free download from
https://ipi.eprostor.gov.si/jgp/data) and writes data/gurs_buildings.json with the official
footprint, height and levels for every building record whose coordinate is surveyed or an address
and lies inside (or within 2 m of) a GURS building. Records further away are left out, so the
page keeps its OpenStreetMap fallback for them and nothing is guessed.

Usage (from the repository root):
    py -m pip install pyshp shapely pyproj
    py tools/gurs_buildings.py "C:/Users/<you>/Downloads/DTM_SLO_ZGRADBE_20261003"
"""
import json, os, sys
import shapefile
from shapely.geometry import shape, Point, mapping
from shapely.ops import transform
import warnings; warnings.filterwarnings('ignore', category=DeprecationWarning)
from pyproj import Transformer

MAX_DIST_M = 2.0
KINDS = ('building', 'institution')
PRECISION = ('surveyed', 'address')

folder = sys.argv[1]
shp = os.path.join(folder, 'DTM_SLO_ZGRADBE_BU_STAVBE_P_' + folder.rstrip('/\\')[-8:], 'DTM_SLO_ZGRADBE_BU_STAVBE_P_poligon')
if not os.path.exists(shp + '.shp'):
    shp = next(os.path.join(r, f[:-4]) for r, _, fs in os.walk(folder) for f in fs if f.endswith('STAVBE_P_poligon.shp'))
uses = {}
cl = os.path.join(folder, 'sifranti', 'CL_CURRENTUSE.CSV')
if os.path.exists(cl):
    for line in open(cl, encoding='utf-8', errors='replace').read().splitlines()[1:]:
        p = line.split(',')
        if len(p) > 2: uses[p[1]] = p[2].strip()

recs = [f['properties'] for f in json.load(open('data/zag_projects.geojson', encoding='utf-8'))['features']]
recs = [p for p in recs if p['object_type'] in KINDS and p['position_precision'] in PRECISION]
to96 = Transformer.from_crs('EPSG:4326', 'EPSG:3794', always_xy=True).transform
to84 = Transformer.from_crs('EPSG:3794', 'EPSG:4326', always_xy=True).transform
pts = {p['id']: to96(p['longitude'], p['latitude']) for p in recs}

r = shapefile.Reader(shp, encoding='utf-8')
names = [f[0] for f in r.fields[1:]]
cand = {k: [] for k in pts}
for i, (e, n) in enumerate(r.iterRecords(fields=['CENE', 'CENN'])):
    if e is None: continue
    for k, (x, y) in pts.items():
        if abs(e - x) < 150 and abs(n - y) < 150: cand[k].append(i)

out = {}
for k, (x, y) in pts.items():
    # GURS keeps overlapping outlines from different surveys: among the buildings at the point take the newest survey
    best = None
    for i in cand[k]:
        g = shape(r.shape(i).__geo_interface__); d = g.distance(Point(x, y))
        dv = str(r.record(i)['DVIR'] or '')
        key = (0 if d <= MAX_DIST_M else 1, '' if d > MAX_DIST_M else dv, -d)
        if best is None or (key[0], ) < (best[3][0], ) or (key[0] == best[3][0] and key[1:] > best[3][1:]): best = (d, g, i, key)
    if not best or best[0] > MAX_DIST_M:
        print('not tied  ', k, '' if not best else f'nearest building {best[0]:.0f} m away'); continue
    rec = dict(zip(names, r.record(best[2])))
    gw = json.loads(json.dumps(mapping(transform(lambda a, b, c=None: to84(a, b), best[1]))))
    rnd = lambda v: [rnd(q) for q in v] if isinstance(v[0], (list, tuple)) else [round(v[0], 7), round(v[1], 7)]
    gw['coordinates'] = rnd(gw['coordinates'])
    o = {'height_m': rec['VISINA'], 'area_m2': round(best[1].area), 'ground_m': rec['Z_TEM'] or None,
         'eave_m': rec['Z_KAP'] or None, 'ridge_m': rec['Z_SLEM'] or None, 'dtm_id': rec['BUI_DTM_ID'],
         'captured': str(rec['DVIR']), 'geometry': gw}
    if rec['RABA_STAV'] and uses.get(str(rec['RABA_STAV'])): o['use'] = uses[str(rec['RABA_STAV'])]
    out[k] = o
    print('tied      ', k, f"{o['height_m']} m, {o['area_m2']} m2, surveyed {o['captured']}")

stamp = folder.rstrip('/\\')[-8:]
meta = {'source': f'GURS, Državna topografska karta, stavbe (DTM_SLO_ZGRADBE_BU_STAVBE_P), extract of {stamp[6:8]}.{stamp[4:6]}.{stamp[:4]}',
        'licence': 'CC BY 4.0, Geodetska uprava Republike Slovenije', 'url': 'https://ipi.eprostor.gov.si/jgp/data'}
json.dump({'meta': meta, 'buildings': out}, open('data/gurs_buildings.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'buildings written to data/gurs_buildings.json')
