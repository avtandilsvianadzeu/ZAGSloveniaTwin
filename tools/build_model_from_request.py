"""Build a 3D model for one record from a "Model request" issue, with no manual step.

Run by .github/workflows/model_request.yml when the repository owner opens or edits a model request.
It can also be run by hand:  python tools/build_model_from_request.py request.md
(request.md holds the issue text, the same "### Field" layout that GitHub writes for an issue form).

What it does
1. Reads the form: record, OpenStreetMap ways (or finds the outline near the record itself), height with its source link, base level, photos.
2. Fetches each outline from the OpenStreetMap API.
3. Writes data/twins.json objects[<record>].model as an "outline" model: mapped outline raised by the height you gave.
4. Downloads the photos into img/requests/<record>/ and lists them as reference photos. Photos are never used as geometry.
5. Writes a short result to model_request_result.md, which the workflow posts back on the issue.

Only the Python standard library is used, so the workflow needs no installs.
"""
import json, math, os, re, sys, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
UA = {'User-Agent': 'ZAGSloveniaTwin model builder (github.com/avtandilsvianadzeu/ZAGSloveniaTwin)'}
OSM = 'https://api.openstreetmap.org/api/0.6/'
RESULT = os.path.join(ROOT, 'model_request_result.md')
SITE = 'https://avtandilsvianadzeu.github.io/ZAGSloveniaTwin/'


class Stop(Exception):
    """A problem the requester can fix by editing the issue."""


def get(url, binary=False, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else json.loads(data.decode('utf-8'))


# ---------- form ----------
def parse_form(text):
    """GitHub issue forms write each field as '### Label' followed by the answer."""
    out, key = {}, None
    for line in text.replace('\r\n', '\n').split('\n'):
        m = re.match(r'^###\s+(.*?)\s*$', line)
        if m:
            key = m.group(1).lower(); out[key] = []; continue
        if key is not None:
            out[key].append(line)
    clean = {}
    for k, v in out.items():
        s = '\n'.join(v).strip()
        clean[k] = '' if s in ('_No response_', 'None') else s
    return clean


def field(form, *names):
    for n in names:
        for k, v in form.items():
            if k.startswith(n):
                return v
    return ''


def number(s, what):
    s = (s or '').strip().replace(',', '.')
    if not s:
        return None
    m = re.match(r'^-?\d+(\.\d+)?$', s.split()[0])
    if not m:
        raise Stop(f'{what} should be a number in metres, for example 31.35. It reads "{s}".')
    return float(m.group(0))


# ---------- geometry ----------
def local(lat0):
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
    return (lambda p: ((p[0]) * kx, (p[1]) * ky))


def area_m2(ring):
    lat0 = sum(p[1] for p in ring) / len(ring); f = local(lat0)
    q = [f(p) for p in ring]
    return abs(sum(q[i][0] * q[i + 1][1] - q[i + 1][0] * q[i][1] for i in range(len(q) - 1))) / 2


def size(ring):
    lat0 = sum(p[1] for p in ring) / len(ring); f = local(lat0)
    q = [f(p) for p in ring]
    xs, ys = [a[0] for a in q], [a[1] for a in q]
    return max(xs) - min(xs), max(ys) - min(ys)


def inside(pt, ring):
    x, y, c = pt[0], pt[1], False
    for i in range(len(ring) - 1):
        (x1, y1), (x2, y2) = ring[i], ring[i + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def dist_m(pt, ring):
    f = local(pt[1]); p = f(pt); best = 1e18
    for i in range(len(ring) - 1):
        a, b = f(ring[i]), f(ring[i + 1])
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = 0 if dx == dy == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]))
    return best


def way_full(wid):
    try:
        d = get(f'{OSM}way/{wid}/full.json')
    except urllib.error.HTTPError as e:
        raise Stop(f'OpenStreetMap way {wid} could not be read (HTTP {e.code}). Check the number on openstreetmap.org.')
    nodes = {e['id']: (e['lon'], e['lat']) for e in d['elements'] if e['type'] == 'node'}
    w = next(e for e in d['elements'] if e['type'] == 'way')
    ring = [list(map(lambda v: round(v, 7), nodes[n])) for n in w['nodes']]
    return ring, w.get('tags', {})


INTEREST = ('building', 'man_made', 'waterway', 'bridge', 'power', 'aerialway', 'tower:type', 'building:part')


def find_near(lon, lat):
    """Closed mapped outlines around the record point: the one holding the point wins, else the nearest within 60 m."""
    d = 0.0015
    try:
        data = get(f'{OSM}map.json?bbox={lon - d},{lat - d},{lon + d},{lat + d}')
    except urllib.error.HTTPError as e:
        raise Stop(f'The automatic search on OpenStreetMap failed (HTTP {e.code}). Please give the way number.')
    nodes = {e['id']: (e['lon'], e['lat']) for e in data['elements'] if e['type'] == 'node'}
    cands = []
    for w in (e for e in data['elements'] if e['type'] == 'way'):
        t = w.get('tags', {})
        if len(w['nodes']) < 4 or w['nodes'][0] != w['nodes'][-1] or not any(k in t for k in INTEREST):
            continue
        if 'waterway' in t and t['waterway'] not in ('dam', 'weir', 'lock_gate'):
            continue
        if not all(n in nodes for n in w['nodes']):
            continue
        ring = [list(nodes[n]) for n in w['nodes']]
        hold = inside((lon, lat), ring)
        cands.append((0 if hold else 1, 0 if hold else dist_m((lon, lat), ring), area_m2(ring) if hold else 0, w['id']))
    cands.sort()
    if not cands or (cands[0][0] == 1 and cands[0][1] > 60):
        raise Stop('No mapped outline was found within 60 m of the record position. Please give the OpenStreetMap way number of the structure.')
    return [cands[0][3]]


# ---------- photos ----------
def photos(text, rid):
    urls = re.findall(r'(https://(?:github\.com/user-attachments/assets/[\w-]+|private-user-images\.githubusercontent\.com/[^\s)"]+|user-images\.githubusercontent\.com/[^\s)"]+))', text or '')
    out, folder = [], os.path.join(ROOT, 'img', 'requests', rid)
    tok = os.environ.get('GITHUB_TOKEN')
    for i, u in enumerate(dict.fromkeys(urls), 1):
        try:
            data = get(u, binary=True, headers={'Authorization': 'Bearer ' + tok} if tok and 'github.com' in u else None)
        except Exception:
            out.append({'url': u, 'stored': False}); continue
        if len(data) > 15_000_000:
            continue
        ext = '.png' if data[:4] == b'\x89PNG' else '.webp' if data[8:12] == b'WEBP' else '.jpg'
        os.makedirs(folder, exist_ok=True)
        name = f'photo_{i}{ext}'
        open(os.path.join(folder, name), 'wb').write(data)
        out.append({'url': f'img/requests/{rid}/{name}', 'stored': True})
    return out


# ---------- main ----------
def build(text):
    form = parse_form(text)
    rec = field(form, 'record', 'object')
    rid = re.split(r'[\s:]', rec.strip())[0] if rec.strip() else ''
    geo = json.load(open(os.path.join(ROOT, 'data/zag_projects.geojson'), encoding='utf-8'))
    feats = {f['properties']['id']: f['properties'] for f in geo['features']}
    if rid not in feats:
        raise Stop(f'The record "{rec}" is not one of the {len(feats)} records. Choose it from the list in the form.')
    p = feats[rid]

    h = number(field(form, 'height'), 'Height')
    hsrc = field(form, 'height source', 'source').strip()
    quote = field(form, 'quote').strip()
    z0 = number(field(form, 'base'), 'Base level') or 0
    if h is not None and not re.match(r'^https?://\S+$', hsrc):
        raise Stop('A height needs a source link (one web address) so every value on the page stays traceable. Leave the height empty to draw the outline flat.')

    ways_txt = field(form, 'openstreetmap')
    ids = [int(x) for x in re.findall(r'(?:way/)?(\d{4,})', ways_txt)]
    found = not ids
    if found:
        ids = find_near(p['longitude'], p['latitude'])

    blocks, basis, osm_heights = [], [], []
    for wid in ids:
        ring, tags = way_full(wid)
        if ring[0] != ring[-1]:
            raise Stop(f'OpenStreetMap way {wid} is a line, not a closed outline. Choose the outline of the structure (an area).')
        kind = next((f'{k}={tags[k]}' for k in INTEREST if k in tags), 'outline')
        w, l = size(ring)
        hh, hinfo = h, None
        if hh is None and tags.get('height'):
            v = number(tags['height'].split()[0], 'OpenStreetMap height')
            if v:
                hh, hinfo = v, f'{v:g} m, height tag in OpenStreetMap way {wid}, entered by a mapper'
                osm_heights.append(wid)
        info = [['Outline', f'OpenStreetMap way {wid}, {kind}, about {round(w)} x {round(l)} m'],
                ['Height', hinfo or (f'{hh:g} m, source {hsrc}' if hh is not None else 'not given, drawn flat')]]
        if z0:
            info.append(['Base level', f'{z0:g} m above the record ground level'])
        name = tags.get('name') or ('Outline' if len(ids) == 1 else f'Part {len(blocks) + 1}')
        blocks.append({'name': f'{name} (OpenStreetMap way {wid})', 'ring': ring, 'z0': z0, 'h': hh or 0, 'info': info})
        basis.append(f'outline from OpenStreetMap way {wid}')

    if h is not None:
        basis.append(f'height {h:g} m from {hsrc}')
    pics = photos(field(form, 'photo'), rid)
    assumed = ['The outline is drawn by OpenStreetMap mappers, not surveyed by the owner.']
    assumed.append('The outline was found automatically as the mapped area holding the record position.' if found else 'The outline was chosen by its way number in the request.')
    if h is None and not osm_heights:
        assumed.append('No height was given, so the outline is drawn flat.')
    elif osm_heights:
        assumed.append('The height is the OpenStreetMap height tag, not a published value.')
    else:
        assumed.append('The whole outline is raised to one height, details such as roofs, piers or gates are not drawn.')
    if any(x['stored'] for x in pics):
        assumed.append('The photos are kept as reference pictures only, they do not change the geometry.')

    twins_path = os.path.join(ROOT, 'data/twins.json')
    twins = json.load(open(twins_path, encoding='utf-8'))
    obj = twins['objects'].setdefault(rid, {})
    old = obj.get('model')
    replace = '[x]' in field(form, 'replace').lower()
    if old and old.get('level') in ('plan', 'full') and not replace:
        raise Stop(f'This record already has a more detailed model ({old.get("level")} level). Tick "Replace the existing model" if the new outline model should take its place.')

    gurs = json.load(open(os.path.join(ROOT, 'data/gurs_buildings.json'), encoding='utf-8')).get('buildings', {})
    if rid in gurs and not replace:
        raise Stop('This record already shows the official GURS building with its cadastre and laser scan heights, which is more exact than a mapped outline. Tick "Replace the existing model" only if the outline should be added anyway.')
    sources = [f'https://www.openstreetmap.org/way/{w}' for w in ids]
    if h is not None:
        sources.append(hsrc)
    model = {'level': 'outline', 'blocks': blocks, 'basis': basis, 'assumed': ' '.join(assumed), 'sources': sources,
             'built_by': 'model request', 'request': os.environ.get('ISSUE_URL') or None}
    if quote:
        model['height_quote'] = quote
    if pics:
        model['photos'] = [x['url'] for x in pics if x['stored']]
    obj['model'] = model
    json.dump(twins, open(twins_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # first stored photo becomes the page picture when the record has none
    stored = [x for x in pics if x['stored']]
    ipath = os.path.join(ROOT, 'data/images.json')
    imgs = json.load(open(ipath, encoding='utf-8'))
    if isinstance(imgs, list):
        imgs = {}
    if stored and rid not in imgs and not p.get('image'):
        imgs[rid] = {'url': stored[0]['url'], 'author': os.environ.get('ISSUE_AUTHOR') or 'the owner of this site', 'licence': 'own photo', 'commons': False}
        json.dump(imgs, open(ipath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    lines = [f'Model built for **{p.get("name_en") or rid}**.', '',
             f'- Outline: ' + ', '.join(f'[way {w}](https://www.openstreetmap.org/way/{w})' for w in ids) + (' (found automatically next to the record position)' if found else ''),
             f'- Height: ' + (f'{h:g} m from {hsrc}' if h is not None else 'OpenStreetMap height tag' if osm_heights else 'none given, drawn flat'),
             f'- Photos stored: {len(stored)}' + (f', {len(pics) - len(stored)} could not be downloaded' if len(pics) > len(stored) else ''),
             f'- Replaced: a previous {old.get("level")} model' if old else '- Replaced: nothing, this is the first model',
             '', f'Page: {SITE}twin.html?id={rid} (live about a minute after this message).',
             'To change it, edit this issue and the model is built again.']
    return '\n'.join(lines)


if __name__ == '__main__':
    text = open(sys.argv[1], encoding='utf-8').read() if len(sys.argv) > 1 else os.environ.get('ISSUE_BODY', '')
    try:
        msg, code = build(text), 0
    except Stop as e:
        msg, code = 'The model could not be built.\n\n' + str(e) + '\n\nEdit the issue to fix it, the build runs again on every edit.', 2
    open(RESULT, 'w', encoding='utf-8').write(msg)
    print(msg)
    sys.exit(code)
