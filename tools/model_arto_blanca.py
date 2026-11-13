"""Model of the HE Arto-Blanca spillway dam (safe to run again).
Geometry: OpenStreetMap way 325991567 (waterway=dam), split into the deck strip and the five piers.
Elevations, all published in the twin sheet: crane track 175.90 m a.s.l., spillway sill 163.50 m a.s.l.,
normal water level 174.20 m a.s.l., structural height 31.35 m. Level 0 of the model is the foundation,
taken as 175.90 - 31.35 = 144.55 m a.s.l. (assumed: the source does not say from which top level the height is counted)."""
import json, math, os
from shapely.geometry import Polygon, box
from shapely import affinity
from shapely.ops import unary_union
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TP = os.path.join(ROOT, 'data', 'twins.json'); TW = json.load(open(TP, encoding='utf-8')); t = TW['objects']['he_arto']
SRC = 'https://www.openstreetmap.org/way/325991567'
DLIB = 'https://dlib.si/stream/URN:NBN:SI:DOC-HF6B1SCP/b5698d4e-db40-47d4-a427-c62faea0b814/PDF'
ring = next(b for b in t['model']['blocks'] if '325991567' in b['name'] or 'pier' in b['name'].lower() or 'Deck' in b['name'])['ring'] if t.get('model') else None
if not ring or 'deck' in json.dumps(t['model']).lower():  # rerun: take the original outline back from the saved OSM file
    o = json.load(open(os.path.join(ROOT, 'handover/research/recheck_2026_11/dam_outlines_osm_2026_11_13.json'), encoding='utf-8'))['he_arto']; ring = o['ring']
O = ring[0]; kx = 111320 * math.cos(math.radians(O[1])); ky = 111320
to_m = lambda c: ((c[0] - O[0]) * kx, (c[1] - O[1]) * ky); to_ll = lambda x, y: [round(O[0] + x / kx, 7), round(O[1] + y / ky, 7)]
P = Polygon([to_m(c) for c in ring]).buffer(0)
c = list(P.minimum_rotated_rectangle.exterior.coords)
i = max(range(4), key=lambda i: math.hypot(c[i+1][0]-c[i][0], c[i+1][1]-c[i][1])); ang = math.degrees(math.atan2(c[i+1][1]-c[i][1], c[i+1][0]-c[i][0]))
Q = affinity.rotate(P, 90 - ang, origin=(0, 0)); minx, miny, maxx, maxy = Q.bounds
back = lambda g: affinity.rotate(g, -(90 - ang), origin=(0, 0))
ringll = lambda g: [to_ll(x, y) for x, y in back(g).exterior.coords]
CUT = 2.0  # the deck strip lies west of this line in the rotated frame, the piers east of it
deck = Q.intersection(box(minx - 1, miny - 1, CUT, maxy + 1))
deck = max(getattr(deck, 'geoms', [deck]), key=lambda g: g.area)
tail = Q.intersection(box(CUT, miny - 1, maxx + 1, maxy + 1))
piers = sorted([g for g in getattr(tail, 'geoms', [tail]) if g.bounds[2] > 10 and g.area > 40], key=lambda g: g.bounds[1])
FOUND, CRANE, SILL, NWL, H, PW = 144.55, 175.90, 163.50, 174.20, 31.35, 3.0
z = lambda elev: round(elev - FOUND, 2)
def axis(g):  # centreline of a mapped pier: long side of its minimum rectangle
    c = list(g.minimum_rotated_rectangle.exterior.coords)
    i = max(range(4), key=lambda i: math.hypot(c[i+1][0]-c[i][0], c[i+1][1]-c[i][1]))
    ux, uy = c[i+1][0]-c[i][0], c[i+1][1]-c[i][1]; L = math.hypot(ux, uy); ux, uy = ux/L, uy/L
    if ux < 0: ux, uy = -ux, -uy  # point downstream (away from the deck)
    cx, cy = g.centroid.x, g.centroid.y
    return cx, cy, ux, uy, L
def rect(cx, cy, ux, uy, L, W):  # rectangle centred on (cx, cy), length L along (ux, uy), width W
    nx, ny = -uy, ux; hl, hw = L/2, W/2
    return Polygon([(cx-ux*hl-nx*hw, cy-uy*hl-ny*hw), (cx+ux*hl-nx*hw, cy+uy*hl-ny*hw), (cx+ux*hl+nx*hw, cy+uy*hl+ny*hw), (cx-ux*hl+nx*hw, cy-uy*hl+ny*hw)])
AX = [axis(g) for g in piers]
gaps = [math.hypot(AX[k+1][0]-AX[k][0], AX[k+1][1]-AX[k][1]) for k in range(len(AX)-1)]
blocks = []
for k, (cx, cy, ux, uy, L) in enumerate(AX, 1):
    blocks.append({'name': 'Pier %d' % k, 'ring': ringll(rect(cx, cy, ux, uy, L, PW)), 'z0': 0, 'h': H, 'info': [['Position and length', 'centreline of the mapped pier in OpenStreetMap way 325991567, about %.0f m long' % L], ['Width', '3 m (published)'], ['From', 'foundation, 144.55 m a.s.l. (assumed)'], ['To', 'crane track, 175.90 m a.s.l. (published)']]})
# gates: one per bay at the upstream end of the piers; the fifth bay lies between pier 1 and the abutment, one pier spacing further on
step = sum(gaps)/len(gaps); cx0, cy0, ux0, uy0, L0 = AX[0]; c1x, c1y = AX[1][0], AX[1][1]; dx, dy = (cx0-c1x)/gaps[0], (cy0-c1y)/gaps[0]
ux_ = sum(a[2] for a in AX); uy_ = sum(a[3] for a in AX); UX, UY = ux_/math.hypot(ux_, uy_), uy_/math.hypot(ux_, uy_)
centres = [(cx0+dx*step, cy0+dy*step)] + [(a[0], a[1]) for a in AX]
for k in range(len(centres)-1):
    (x0, y0), (x1, y1) = centres[k], centres[k+1]
    mx, my = (x0+x1)/2, (y0+y1)/2; ux, uy = UX, UY
    Lp = (AX[max(k-1, 0)][4] + AX[min(k, len(AX)-1)][4]) / 2; gx, gy = mx-ux*(Lp/2-0.5), my-uy*(Lp/2-0.5)  # upstream end of the bay
    span = math.hypot(x1-x0, y1-y0) - PW; bx, by = (x1-x0), (y1-y0); bl = math.hypot(bx, by); bx, by = bx/bl, by/bl
    g = rect(gx, gy, bx, by, span, 1.0)
    blocks.append({'name': 'Spillway gate, bay %d' % (k+1), 'ring': ringll(g), 'z0': z(SILL), 'h': round(NWL - SILL, 2), 'info': [['Clear width', '%.1f m from the mapped pier spacing, 15 m published' % span], ['From', 'spillway sill, 163.50 m a.s.l. (published)'], ['To', 'normal water level, 174.20 m a.s.l. (published)'], ['Gate shape', 'drawn as a flat panel, the gate type is not in the sources']]})
blocks.append({'name': 'Deck along the dam', 'ring': ringll(deck), 'z0': z(CRANE) - 1.5, 'h': 1.5, 'info': [['Outline', 'upstream strip of OpenStreetMap way 325991567'], ['Top', 'crane track, 175.90 m a.s.l. (published)'], ['Thickness', '1.5 m, assumed']]})
t['model'] = {'level': 'plan', 'blocks': blocks,
  'basis': ['dam outline from OpenStreetMap way 325991567, split into the deck strip and %d piers' % len(piers), 'structural height 31.35 m, crane track 175.90 m, spillway sill 163.50 m and normal water level 174.20 m above sea level from the sources', '5 spillway bays of 15 m and piers of 3 m from the sources'],
  'assumed': 'Level 0 is the foundation, taken as 144.55 m above sea level because the height of 31.35 m is assumed to run up to the crane track. Pier positions and lengths follow the mapped piers, their width is the published 3 m. The fifth bay is placed one pier spacing beyond pier 1, next to the mapped abutment. Gates are drawn as flat panels from the sill to the normal water level, the gate type and size are not published. The deck is drawn 1.5 m thick. The powerhouse is not drawn, its outline is not mapped.',
  'sources': [SRC, DLIB]}
json.dump(TW, open(TP, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('piers', len(piers), 'spacing', [round(x,1) for x in gaps], 'pier lengths', [round(a[4],1) for a in AX], 'gates', sum(1 for b in blocks if 'gate' in b['name']), 'clear widths', [b['info'][0][1][:4] for b in blocks if 'gate' in b['name']])
