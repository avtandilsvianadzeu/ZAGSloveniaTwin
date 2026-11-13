"""Adds outline models for six dams to data/twins.json (safe to run again).
Outlines: OpenStreetMap waterway=dam ways, saved in handover/research/recheck_2026_11/dam_outlines_osm_2026_11_13.json.
Heights: only where a source in the twin sheet gives one, otherwise the outline is drawn flat and the model says so."""
import json, math, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TP = os.path.join(ROOT, 'data', 'twins.json')
OUT = json.load(open(os.path.join(ROOT, 'handover/research/recheck_2026_11/dam_outlines_osm_2026_11_13.json'), encoding='utf-8'))
TW = json.load(open(TP, encoding='utf-8')); T = TW['objects']
NAME = {'he_solkan': 'Dam', 'he_zlatolicje': 'Power plant structure', 'he_vuhred': 'Dam', 'he_vrhovo': 'Dam', 'jez_melje': 'Weir', 'he_arto': 'Dam'}
def height(t):
    for s in t.get('specs', []):
        if s['label'] == 'Height' and (s.get('unit') or '') == 'm':
            v = str(s['value']); n = v.split(' ')[0].replace(',', '.')
            try: return float(n), s['source'], v
            except ValueError: pass
    return None, None, None
for k, o in OUT.items():
    t = T[k]; ring = o['ring']; way = 'https://www.openstreetmap.org/way/%d' % o['id']
    h, hsrc, hraw = height(t); w, l = o['size']
    info = [['Outline', 'OpenStreetMap way %d, waterway=dam, about %d x %d m' % (o['id'], w, l)]]
    info.append(['Height', ('%s m, published' % hraw.split(' (')[0]) if h else 'not published, drawn flat'])
    basis = ['%s outline from OpenStreetMap way %d' % (NAME[k].lower(), o['id'])]
    if h: basis.append('height %s m from the sources' % ('{:g}'.format(h)))
    assumed = 'The outline is drawn by OpenStreetMap mappers, not surveyed by the operator. '
    assumed += ('It is raised as one block to the published height, starting at an assumed level 0, because the foundation and river bed elevations are not published. ' if h
                else 'No source gives the height of the structure, so the outline is drawn flat at level 0. ')
    assumed += 'Gates, piers and the powerhouse interior are not drawn.'
    if k == 'he_vrhovo': assumed += ' Sources differ on the height: 27 m (SEL) and 25.65 m (IBE 2010), the larger figure is drawn.'
    t['model'] = {'level': 'outline', 'blocks': [{'name': '%s (outline from OpenStreetMap way %d)' % (NAME[k], o['id']), 'ring': ring, 'z0': 0, 'h': h or 0, 'info': info}],
                  'basis': basis, 'assumed': assumed, 'sources': [way] + ([hsrc] if hsrc else [])}
    print(k, 'height', h, 'from', hsrc)
json.dump(TW, open(TP, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
