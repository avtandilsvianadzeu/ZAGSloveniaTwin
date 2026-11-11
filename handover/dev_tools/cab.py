import json, unicodedata, osmq
R='recheck/'
recs={r['id']:r for r in json.load(open(R+'cableways.json'))}
A={r['id']:r for r in json.load(open(R+'cableways_out.json'))}
norm=lambda s: unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
# what each record is, per the research: (OSM key, acceptable types, name fragment or None, search centre)
SPEC={'krvavec':('aerialway',('gondola',),'krvavec',(14.4979,46.2848)),
      'velikaplanina':('aerialway',('cable_car',),'velika planina',(14.6086,46.3055)),
      'grad_vzpenjaca':('railway',('funicular',),None,(14.5097,46.0501)),
      'vogel':('aerialway',('cable_car',),'vogel',(13.8358,46.2758)),
      'golte':('aerialway',('cable_car',),None,(14.931,46.3565)),
      'kanin_z':('aerialway',('gondola','cable_car'),None,(13.5384,46.3326)),
      'straza_bled':('aerialway',('chair_lift',),'straza',(14.1055,46.3620))}
out={}
for k,(key,types,nm,c) in SPEC.items():
    seen={}
    d=osmq.fetch(c[0],c[1],900); W,_=osmq.ways(d)
    for w in W:
        t=w['tags']; typ=t.get(key) or t.get('disused:'+key) or t.get('abandoned:'+key)
        if typ in types and (nm is None or nm in norm(t.get('name',''))) and osmq.dist_to(c,w['coords'])<700: seen[w['id']]=osmq.way_full(w['id'])
    for _ in range(5):
        ends=[e for w in seen.values() for e in (w['coords'][0],w['coords'][-1])]
        loose=[e for e in ends if sum(1 for f in ends if osmq.m(e,f)<1)==1]; new=False
        for e in loose:
            W,_=osmq.ways(osmq.fetch(e[0],e[1],250))
            for w in W:
                t=w['tags']; typ=t.get(key) or t.get('disused:'+key)
                if w['id'] not in seen and typ in types and osmq.dist_to(e,w['coords'])<2: seen[w['id']]=osmq.way_full(w['id']); new=True
        if not new: break
    ws=list(seen.values())
    info=[(w['id'],w['tags'].get(key) or w['tags'].get('disused:'+key),w['tags'].get('name'),round(w['len']),w['tags'].get('ele'),[ (round(p[0],6),round(p[1],6)) for p in (w['coords'][0],w['coords'][-1])]) for w in ws]
    cur=(recs[k]['current_lon'],recs[k]['current_lat'])
    out[k]={'ways':[{'id':w['id'],'tags':w['tags'],'coords':[[round(x,6),round(y,6)] for x,y in w['coords']],'len':round(w['len'])} for w in ws],
            'pin_to_line':round(min(osmq.dist_to(cur,w['coords']) for w in ws)) if ws else None}
    print(k.ljust(14),'pin->line',out[k]['pin_to_line'],'m'); [print('    ',i) for i in info]
json.dump(out,open(R+'cableways_osm.json','w'))
