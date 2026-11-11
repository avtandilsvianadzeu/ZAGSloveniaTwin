import json, unicodedata, osmq
R='recheck/'
recs={r['id']:r for r in json.load(open(R+'dams.json'))}
norm=lambda s: unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
out={}
for k,r in recs.items():
    c=(r['current_lon'],r['current_lat'])
    W,P=osmq.ways(osmq.fetch(c[0],c[1],700 if k!='che_avce' else 1200))
    hits=[]
    for w in W:
        t=w['tags']
        if t.get('waterway') in ('dam','weir') or t.get('man_made')=='dyke' or t.get('power')=='plant' or t.get('plant:source')=='hydro' or (t.get('power')=='generator' and t.get('generator:source')=='hydro') or t.get('landuse')=='reservoir' or t.get('water')=='reservoir':
            hits.append({'id':w['id'],'kind':t.get('waterway') or t.get('power') or t.get('water') or t.get('landuse'),'name':t.get('name'),'len':round(w['len']),'d':round(osmq.dist_to(c,w['coords'])),'coords':[[round(x,6),round(y,6)] for x,y in w['coords']],'tags':{x:t[x] for x in t if x in('name','operator','plant:output:electricity','height','ele','start_date','waterway','power')}})
    for p in P:
        t=p['tags']
        if t.get('power') in ('plant','generator') or 'HE ' in (t.get('name') or ''):
            hits.append({'id':p['id'],'kind':'node:'+(t.get('power') or ''),'name':t.get('name'),'len':0,'d':round(osmq.m(c,p['coord'])),'coords':[[round(p['coord'][0],6),round(p['coord'][1],6)]],'tags':t})
    hits.sort(key=lambda h:h['d']); out[k]=hits
    print(k.ljust(14)); [print('    ',h['kind'],repr(h['name']),h['len'],'m d',h['d'],h['tags'].get('operator',''),h['tags'].get('plant:output:electricity','')) for h in hits[:6]]
json.dump(out,open(R+'dams_osm.json','w'))
