import json, math, os, sys, time, urllib.request, urllib.error, hashlib
C='/tmp/claude-0/-home-claude/0c288e72-a8b4-5e29-bc24-07a5b34113c3/scratchpad/osm/'
def m(a,b):
    x=(b[0]-a[0])*math.radians(1)*math.cos(math.radians((a[1]+b[1])/2)); y=(b[1]-a[1])*math.radians(1); return math.hypot(x,y)*6371008.8
def fetch(lon,lat,half_m=700):
    dy=half_m/111320; dx=half_m/(111320*math.cos(math.radians(lat)))
    bb='%.5f,%.5f,%.5f,%.5f'%(lon-dx,lat-dy,lon+dx,lat+dy)
    fn=C+hashlib.md5(bb.encode()).hexdigest()+'.json'
    if os.path.exists(fn): return json.load(open(fn))
    for i in range(3):
        try:
            r=urllib.request.urlopen(urllib.request.Request('https://api.openstreetmap.org/api/0.6/map.json?bbox='+bb,headers={'User-Agent':'ZAG-atlas-verify/1.0'}),timeout=90)
            d=json.load(r); json.dump(d,open(fn,'w')); time.sleep(1); return d
        except urllib.error.HTTPError as e:
            if e.code==400 and half_m>150: return fetch(lon,lat,half_m*0.6)
            err=e; time.sleep(3)
        except Exception as e:
            err=e; time.sleep(3)
    raise err
def ways(d):
    nodes={e['id']:(e['lon'],e['lat']) for e in d['elements'] if e['type']=='node'}
    ntags={e['id']:e.get('tags',{}) for e in d['elements'] if e['type']=='node' and e.get('tags')}
    out=[]
    for e in d['elements']:
        if e['type']=='way' and e.get('tags'):
            co=[nodes[n] for n in e['nodes'] if n in nodes]
            if len(co)>=2: out.append({'id':e['id'],'tags':e['tags'],'coords':co,'len':sum(m(co[i-1],co[i]) for i in range(1,len(co)))})
    pts=[{'id':k,'tags':v,'coord':nodes[k]} for k,v in ntags.items()]
    return out,pts
def dist_to(c,co): return min(m(c,p) for p in co)
def fetch_way(wid):
    fn=C+'way_%d.json'%wid
    if os.path.exists(fn): return json.load(open(fn))
    r=urllib.request.urlopen(urllib.request.Request('https://api.openstreetmap.org/api/0.6/way/%d/full.json'%wid,headers={'User-Agent':'ZAG-atlas-verify/1.0'}),timeout=90)
    d=json.load(r); json.dump(d,open(fn,'w')); time.sleep(0.5); return d
def way_full(wid):
    d=fetch_way(wid); w,_=ways(d); return [x for x in w if x['id']==wid][0]
