'use strict';
/* Atlas data: loads data/zag_projects.geojson and applies the active filters (section, layer toggles, timeline year). */
const ZA={features:[],byId:{},images:{},gurs:{},gursMeta:null,twins:{},news:{},newsUpdated:null,nav:'projects',showProj:true,showFac:true,upTo:null};
const GROUPS={building:'buildings',institution:'buildings',company:'buildings',bridge:'bridges',footbridge:'bridges','road structure':'bridges',
  tunnel:'infrastructure','dam / hydropower':'infrastructure',cableway:'infrastructure','tower / mast':'infrastructure'};
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):'';
const INV_LABEL={research:'Research','inspection':'Inspection','structural assessment':'Structural assessment',monitoring:'Monitoring',
  'materials testing':'Materials testing',rehabilitation:'Rehabilitation',BIM:'BIM',digitalisation:'Digitalisation',LiDAR:'LiDAR survey',UAV:'UAV survey',
  'energy assessment':'Energy assessment','fire testing':'Fire testing',other:'Other'};
const kindOf=p=>p.category==='zag_facility'?'fac':p.evidence_level==='documented'?'doc':'ref';

async function loadAtlas(){
  const r=await fetch('data/zag_projects.geojson'); if(!r.ok) throw new Error('dataset '+r.status);
  const j=await r.json(); ZA.features=j.features; ZA.byId=Object.fromEntries(j.features.map(f=>[f.properties.id,f]));
  try{ const ri=await fetch('data/images.json'); if(ri.ok) ZA.images=await ri.json(); }catch(_){}
  await loadNews();
  try{ const rt=await fetch('data/twins.json'); if(rt.ok){ const j=await rt.json(); ZA.twins=j.objects||{}; } }catch(_){}
  try{ const rg=await fetch('data/gurs_buildings.json'); if(rg.ok){ const j=await rg.json(); ZA.gurs=j.buildings||{}; ZA.gursMeta=j.meta||null; } }catch(_){}
}
/* recent Slovenian news per record (data/news.json, refreshed by a scheduled GitHub workflow) */
async function loadNews(){
  try{ const r=await fetch('data/news.json?t='+Date.now(),{cache:'no-store'}); if(!r.ok) return; const j=await r.json(); ZA.news=j.items||{}; ZA.newsUpdated=j.updated||null; }catch(_){}
  try{ if(typeof applyNewsRing==='function') applyNewsRing(); }catch(_){}
}
const recentNewsIds=(days=7)=>Object.entries(ZA.news).filter(([,v])=>v.some(n=>Date.now()-Date.parse(n.date)<days*864e5)).map(([k])=>k);
setInterval(loadNews,15*60*1000);
function isVisible(p){
  if(p.category==='zag_facility'){ if(!ZA.showFac) return false; } else if(!ZA.showProj) return false;
  if(ZA.nav!=='projects'&&GROUPS[p.object_type]!==ZA.nav) return false;
  if(ZA.upTo!=null&&p.year_start!=null&&p.year_start>ZA.upTo) return false;
  if(ZA.onlyTypes&&!ZA.onlyTypes.has(p.object_type)) return false;
  if(ZA.onlyKinds&&!ZA.onlyKinds.has(kindOf(p))) return false;
  if(ZA.onlyIds&&!ZA.onlyIds.has(p.id)) return false;
  return true;
}
const visibleFeatures=()=>ZA.features.filter(f=>isVisible(f.properties));
