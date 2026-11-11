import json, math, unicodedata, osmq
R='recheck/'
T=json.load(open(R+'tunnels_out.json'))
recs={r['id']:r for r in json.load(open(R+'tunnels.json'))}
NAME={'karavanke_c':'kara','karavanke_r':'karawank','golovec':'golovec','sentvid':'sentvid','trojane':'trojane','podmilj':'podmilj','vzideh':None,'kastelec':'kastelec','dekani':'dekani','markovec':'markovec','lescevje':'lescevje','cenkova':'cenkova','pletovarje':'pletovarje','tabor_h4':'podnanos','golo_rebro':'golo rebro'}
KIND={'karavanke_r':'railway'}
norm=lambda s: unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
def chain(segs):
    # join segments sharing end points into continuous lines
    segs=[list(s) for s in segs]; lines=[]
    while segs:
        cur=segs.pop(0); grown=True
        while grown:
            grown=False
            for s in segs:
                if osmq.m(cur[-1],s[0])<1: cur+=s[1:]
                elif osmq.m(cur[-1],s[-1])<1: cur+=s[::-1][1:]
                elif osmq.m(cur[0],s[-1])<1: cur=s[:-1]+cur
                elif osmq.m(cur[0],s[0])<1: cur=s[::-1][:-1]+cur
                else: continue
                segs.remove(s); grown=True; break
        lines.append(cur)
    return lines
out={}
for t in T:
    k=t['id']; an=[(a['lon'],a['lat']) for a in t['anchors'] if a.get('lat')]
    if not an: an=[(recs[k]['current_lon'],recs[k]['current_lat'])]
    cx=sum(a[0] for a in an)/len(an); cy=sum(a[1] for a in an)/len(an)
    span=max([osmq.m((cx,cy),a) for a in an]+[300])
    want=NAME[k]; kind=KIND.get(k,'highway')
    seen={}
    for p in (an if span>1500 else [(cx,cy)]):
        d=osmq.fetch(p[0],p[1],400 if span>1500 else span+400); W,_=osmq.ways(d)
        for w in W:
            if w['tags'].get('tunnel')=='yes' and kind in w['tags'] and w['len']>20 and (want is None or want in norm(w['tags'].get('name','')+' '+w['tags'].get('tunnel:name',''))): seen[w['id']]=w
    cand=[osmq.way_full(i) for i in seen]
    # follow the tubes: search again at every loose end until no new way of the same tunnel turns up
    for _ in range(6):
        ends=[c for w in cand for c in (w['coords'][0],w['coords'][-1])]
        loose=[e for e in ends if sum(1 for f in ends if osmq.m(e,f)<1)==1]
        new=False
        for e in loose:
            d=osmq.fetch(e[0],e[1],250); W,_=osmq.ways(d)
            for w in W:
                if w['id'] in seen: continue
                if w['tags'].get('tunnel')=='yes' and kind in w['tags'] and (want is None and False or want and want in norm(w['tags'].get('name','')+' '+w['tags'].get('tunnel:name',''))):
                    seen[w['id']]=w; cand.append(osmq.way_full(w['id'])); new=True
        if not new: break
    if k=='vzideh': cand=[w for w in cand if 'trojane' not in norm(w['tags'].get('name',''))]
    if want is None: cand=[w for w in cand if osmq.dist_to((cx,cy),w['coords'])<200]
    lines=chain([w['coords'] for w in cand])
    lines=[l for l in lines if sum(osmq.m(l[i-1],l[i]) for i in range(1,len(l)))>60]
    L=[round(sum(osmq.m(l[i-1],l[i]) for i in range(1,len(l)))) for l in lines]
    names=sorted(set(w['tags'].get('name','') for w in cand)); refs=sorted(set(w['tags'].get('ref','') for w in cand))
    ids=sorted(set(w['id'] for w in cand))
    cur=(recs[k]['current_lon'],recs[k]['current_lat'])
    dcur=round(min(osmq.dist_to(cur,l) for l in lines)) if lines else None
    out[k]={'lines':[[[round(x,6),round(y,6)] for x,y in l] for l in lines],'lengths':L,'names':names,'refs':refs,'osm_ways':ids,'current_to_tunnel_m':dcur}
    print(k.ljust(12),'tubes',len(lines),L,names,refs,'| pin->tunnel',dcur,'m')
json.dump(out,open(R+'tunnels_osm.json','w'))
