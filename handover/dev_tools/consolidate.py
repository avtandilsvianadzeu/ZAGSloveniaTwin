import json, math, osmq
R='recheck/'; P='/home/claude/ZAGMapLive/'
corr=json.load(open(P+'tools/position_corrections.json',encoding='utf-8'))
recs={}
for g in ('tunnels','cableways','dams','other_sites','buildings_bridges'):
    for r in json.load(open(R+g+'.json')): recs[r['id']]=r
res={}
for g in ('tunnels','cableways','dams','other_sites','buildings_bridges'):
    for r in json.load(open(R+g+'_out.json')): res.setdefault(r['id'],r)
TO=json.load(open(R+'tunnels_osm.json')); CO=json.load(open(R+'cableways_osm.json')); DO=json.load(open(R+'dams_osm.json'))
L=lambda l: sum(osmq.m(l[i-1],l[i]) for i in range(1,len(l)))
def mid(l):
    h=L(l)/2; s=0
    for i in range(1,len(l)):
        d=osmq.m(l[i-1],l[i])
        if s+d>=h and d>0: t=(h-s)/d; return [l[i-1][0]+t*(l[i][0]-l[i-1][0]), l[i-1][1]+t*(l[i][1]-l[i-1][1])]
        s+=d
    return l[0]
r6=lambda v: round(v,6)
OSMW='https://www.openstreetmap.org/way/'; OSMN='https://www.openstreetmap.org/node/'
changes={}; twin_geo={}
def setc(k,lat,lon,note,sources,lines=None,labels=None,conf='high',addr=None):
    old=(recs[k]['current_lon'],recs[k]['current_lat'])
    e={'lat':r6(lat),'lon':r6(lon),'confidence':conf,'status':'exact' if conf=='high' else 'improved','sources':sources,'note':note}
    if lines: e['line']=lines[0]; e['lines']=lines; e['line_labels']=labels
    if addr: e['addr']=addr
    corr[k]=e; changes[k]=round(osmq.m(old,(lon,lat)))
# ---------- tunnels
TNAME={'karavanke_c':'Karavanke motorway tunnel (A2/A11)','karavanke_r':'Karavanke railway tunnel','tabor_h4':'Podnanos tunnel (H4), the record\'s "Tabor"','vzideh':'tunnel on road 221 at Vzideh'}
for k,o in TO.items():
    lines=[[[r6(x),r6(y)] for x,y in l] for l in o['lines']]
    if k=='karavanke_r':  # three mapped tracks of one tube: keep the longest as the alignment
        lines=[max(lines,key=L)]
    ms=[mid(l) for l in lines]; cx=sum(p[0] for p in ms)/len(ms); cy=sum(p[1] for p in ms)/len(ms)
    lens=[round(L(l)) for l in lines]
    labels=['tube %d, %d m'%(i+1,x) for i,x in enumerate(lens)] if len(lines)>1 else ['tunnel, %d m'%lens[0]]
    conf='improved' if k=='vzideh' else 'high'
    note=('Matched in OpenStreetMap by name (%s, ref %s): %s mapped portal to portal. '%(', '.join(n for n in o['names'] if n) or 'unnamed', ', '.join(x for x in o['refs'] if x), ' and '.join('%d m'%x for x in lens)))
    if k=='vzideh': note='Unnamed 284 m tunnel on road 221 about 350 m east of Vzideh, matched by location and length only (the 1996 location plan gives 260 m, Lotsberg 296 m). Check on site before treating it as exact. '
    if k=='lescevje': note+='The old point was the village of Leščevje, about 15 km from the tunnel, which lies on the A2 near Belšinja vas (Trebnje). '
    if k=='tabor_h4': note+='The 1999 location plan\'s "Tabor I/II" chainages match the built Podnanos tunnel; "Tabor" is now the name of the neighbouring viaduct. The old point was the settlement, about 1 km away. '
    setc(k,cy,cx,note.strip(),[OSMW+str(w) for w in o['osm_ways'][:6]],lines,labels,'high' if conf=='high' else 'medium')
    twin_geo[k]=[{'label':('portal %s'%('A' if j==0 else 'B'))+(' (tube %d)'%(i+1) if len(lines)>1 else ''),'lat':r6(p[1]),'lon':r6(p[0]),'source':OSMW+str(o['osm_ways'][0])} for i,l in enumerate(lines) for j,p in enumerate((l[0],l[-1]))]
# ---------- cableways: chain ways, valley station = lower end per research anchor
for k,o in CO.items():
    ws=o['ways']; segs=[w['coords'] for w in ws if w['len']>20]
    line=segs[0]
    for s in segs[1:]:
        if osmq.m(line[-1],s[0])<2: line=line+s[1:]
        elif osmq.m(line[0],s[-1])<2: line=s[:-1]+line
    ra=[(a['lon'],a['lat']) for a in (res[k].get('anchors') or []) if a.get('lat')]
    if ra:  # orient so the valley end (nearest the researched valley-side point) comes first
        if osmq.m(ra[0],line[-1])<osmq.m(ra[0],line[0]): line=line[::-1]
    v,tp=line[0],line[-1]
    setc(k,v[1],v[0],'Matched in OpenStreetMap by lift type%s: %d m mapped from the valley to the top station. The point is the valley station.'%(' and name ('+ws[0]['tags'].get('name')+')' if ws[0]['tags'].get('name') else '',round(L(line))),[OSMW+str(w['id']) for w in ws],[line],['lift line'])
    twin_geo[k]=[{'label':'valley station','lat':r6(v[1]),'lon':r6(v[0]),'source':OSMW+str(ws[0]['id'])},{'label':'top station','lat':r6(tp[1]),'lon':r6(tp[0]),'source':OSMW+str(ws[-1]['id'])}]
# ---------- dams: dam line or area from OSM by name, plant
for k,hits in DO.items():
    dam=[h for h in hits if h['kind'] in('dam','weir') and h['d']<60]
    plant=[h for h in hits if h['kind']=='plant' and h['d']<80 and 'Sončna' not in (h['name'] or '')]
    g=[]
    if dam: g.append(dam[0])
    if plant: g.append(plant[0])
    if not g: continue
    d0=g[0]; co=d0['coords']; cx=sum(p[0] for p in co)/len(co); cy=sum(p[1] for p in co)/len(co)
    nm=', '.join(repr(h['name']) for h in g if h['name'])
    setc(k,cy,cx,'Matched in OpenStreetMap by type and name (%s); the point is the centre of the %s.'%(nm or 'unnamed dam','dam' if dam else 'power plant'),[ (OSMW if h['len'] else OSMN)+str(h['id']) for h in g])
    twin_geo[k]=[{'label':('dam' if h['kind'] in('dam','weir') else 'power plant')+(' ('+h['name']+')' if h['name'] else ''),'lat':r6(sum(p[1] for p in h['coords'])/len(h['coords'])),'lon':r6(sum(p[0] for p in h['coords'])/len(h['coords'])),'source':(OSMW if h['len'] else OSMN)+str(h['id'])} for h in g]
# ---------- single sites
setc('pecna_reber',45.778918,14.230264,'Communication tower on the summit of Pečna reber (763 m) east of Postojna, mapped in OpenStreetMap; the old point was Postojna town, about 1.3 km away.',[OSMW+'1009063075',OSMN+'2577615020'],conf='high')
twin_geo['pecna_reber']=[{'label':'communication tower','lat':45.778918,'lon':14.230264,'source':OSMW+'1009063075'},{'label':'summit, 763 m','lat':45.779065,'lon':14.230285,'source':OSMN+'2577615020'}]
setc('sitarjevec',46.04978,14.83038,'Entrance of the Sitarjevec mine as mapped in OpenStreetMap ("Rudnik Sitarjevec"), 56 m from the Visit Ljubljana GPS point.',[OSMN+'9173909694','https://www.visitljubljana.com/en/poi/sitarjevec-mine'])
twin_geo['sitarjevec']=[{'label':'mine entrance (OSM)','lat':46.04978,'lon':14.83038,'source':OSMN+'9173909694'},{'label':'mine (Visit Ljubljana)','lat':46.049342,'lon':14.830746,'source':'https://www.visitljubljana.com/en/poi/sitarjevec-mine'}]
cl=osmq.way_full(1243038403)['coords']; m=mid(cl)
setc('strunjan',m[1],m[0],'Flysch cliff above Mesečev zaliv (bay of Sv. Križ) as mapped in OpenStreetMap; the cliff line is drawn.',[OSMW+'1243038403','https://www.portoroz.si/en/objects/moon-bay-or-the-bay-of-the-cross/'],[[[r6(x),r6(y)] for x,y in cl]],['cliff edge'])
twin_geo['strunjan']=[{'label':'cliff, west end','lat':r6(cl[0][1]),'lon':r6(cl[0][0]),'source':OSMW+'1243038403'},{'label':'cliff, east end','lat':r6(cl[-1][1]),'lon':r6(cl[-1][0]),'source':OSMW+'1243038403'}]
setc('sij_acroni_pavers',46.423994,14.094645,'SIJ Acroni steel plant at Koroška Bela (GEM wiki, inside the mapped SIJ Acroni industrial area). The pavers lie at the bicycle parking in front of the plant, which no source places exactly; the old point was Jesenice centre, about 3 km away.',['https://gem.wiki/SIJ_Acroni_Jesenice_steel_plant',OSMW+'273554722'],conf='medium')
setc('livarna_crnomelj',45.571761,15.18388,'Address point of LIVAR d.d., Ulica heroja Stariha 17, Črnomelj, from the GURS address register (building 1535-857). The chimney itself is not placed by any source; the old point was about 850 m away.',['https://ipi.eprostor.gov.si/jgp/data'],conf='medium',addr='Ulica heroja Stariha 17, Črnomelj')
setc('soca_quake',46.32,13.63,'ARSO provisional epicentre of the 12 April 1998 earthquake (ML 4.9 per the source); the damage was mainly in Bovec and Čezsoča. This is a study area, the point marks the epicentre, not a structure. The old point was Kobarid, about 9 km away.',['https://ojs-gr.zrc-sazu.si/ujma/article/download/9062/8495/24359'],conf='medium')
json.dump(corr,open(P+'tools/position_corrections.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
json.dump({'changes':changes,'geo':twin_geo},open(R+'consolidated.json','w'),ensure_ascii=False)
for k,v in sorted(changes.items(),key=lambda x:-x[1]): print(k.ljust(18),v,'m')
