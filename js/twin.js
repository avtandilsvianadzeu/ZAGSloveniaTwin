'use strict';
/* Digital twin page: one screen per record with a 3D view, key figures, specifications with sources, geometry, ZAG involvement, news and sources.
   twin.html?id=<record id> shows one object. twin.html without an id lists all objects. Data: the same files the map uses. Nothing is invented here:
   every figure shown comes from the record, its twin sheet, the official GURS building or the drawn geometry. */
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';
const DEM_URL='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const SAT_URL='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const PREC={surveyed:'Published coordinate',matched:'Matched to the mapped structure',site:'Site area, not the exact object',epicentre:'Epicentre of a study area',derived:'Derived from river alignment',
  locality:'Locality centre, approximate',address:'Street address',approximate:'Approximate, from the road alignment',settlement:'Settlement centre, approximate',municipality:'Municipality centre, approximate',user:'Placed by a user, not verified'};
const EXACT=p=>p==='surveyed'||p==='address'||p==='matched';
const UNC={site:300,locality:600,settlement:600,approximate:400,derived:300,municipality:2500,epicentre:3000};
const INV_LABEL={research:'Research',inspection:'Inspection','structural assessment':'Structural assessment',monitoring:'Monitoring','materials testing':'Materials testing',rehabilitation:'Rehabilitation',
  BIM:'BIM',digitalisation:'Digitalisation',LiDAR:'LiDAR survey',UAV:'UAV survey','energy assessment':'Energy assessment','fire testing':'Fire testing',other:'Other'};
const SRC_KIND={journal:'Journal article',conference:'Conference paper',report:'Report',web:'Web page',inst:'Institutional page',enc:'Encyclopedia',zag_publication:'ZAG publication',db:'Database',data:'Open data',reg:'Regulation',news:'News article'};
const GROUP_ORDER=['bridge','footbridge','road structure','tunnel','dam / hydropower','cableway','tower / mast','building','institution','company','landslide','geotechnical site','study area (earthquake)','other'];
const GROUP_NAME={bridge:'Bridges and viaducts',footbridge:'Footbridges','road structure':'Road structures',tunnel:'Tunnels','dam / hydropower':'Dams and hydropower plants',cableway:'Cableways','tower / mast':'Towers and masts',
  building:'Buildings',institution:'Institutions',company:'Companies',landslide:'Landslides','geotechnical site':'Geotechnical sites','study area (earthquake)':'Earthquake study areas',other:'Other sites'};

const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* house style for visible text: no en or em dashes, no semicolons, no middle dots */
const clean=s=>String(s==null?'':s).replace(/\s*—\s*/g,', ').replace(/(\d)\s*–\s*(\d)/g,'$1 to $2').replace(/–/g,'-').replace(/\s*;\s*/g,', ').replace(/\s+·\s+/g,', ').replace(/~(?=\d)/g,'about ').replace(/→/g,' to ');
const T=s=>esc(clean(s));
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):'';
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch(_){return u;}};
/* evidence: the sentence a value was read from, with the value marked, and a link that opens the source at that sentence */
const evNums=v=>(String(v).match(/\d+(?:[.,]\d+)?/g)||[]).map(x=>x.replace(',','.'));
function evShows(s){ const q=String(s.quote||''), v=String(s.value), n1=x=>x.replace(/(\d),(\d)/g,'$1.$2'), n2=x=>x.replace(/(\d)[\s.,](?=\d{3}(?!\d))/g,'$1').replace(/(\d),(\d)/g,'$1.$2');
  const hit=(N)=>{ const qn=N(q), nums=(N(v).match(/\d+(?:\.\d+)?/g)||[]); return nums.length?nums.some(n=>new RegExp('(^|[^\\d.])'+n.replace('.','\\.')+'(?![\\d])').test(qn)||(/\.0+$/.test(n)&&new RegExp('(^|[^\\d.])'+n.replace(/\.0+$/,'')+'(?![\\d.])').test(qn))):null; };
  const a=hit(n1); if(a) return true; const b=hit(n2); if(b) return true; if(a===null){ const ws=v.toLowerCase().match(/[a-zà-ž]{5,}/g)||[]; return ws.some(w=>q.toLowerCase().includes(w)); } return false; }
function evMark(s){ let h=esc(clean(s.quote)); for(const n of new Set(evNums(s.value))){ const alt=n.includes('.')?n.replace('.','[.,]'):n; h=h.replace(new RegExp('(^|[^\\d.,>])('+alt+')(?![\\d])','g'),'$1<mark>$2</mark>'); } return h; }
const evDeep=s=>{ const u=s.quote_source||s.source||''; if(/\.pdf(\?|#|$)|\/PDF$|\/retrieve$|download/i.test(u)) return null; const w=String(s.quote).replace(/\s+/g,' ').trim().split(' ').slice(0,7).join(' '); return w?u.split('#')[0]+'#:~:text='+encodeURIComponent(w):null; };
function evid(s){ if(s&&!s.quote&&s.basis) return '<details class="ev"><summary>How it was obtained</summary><p>'+esc(s.basis)+'</p></details>'; if(!s||!s.quote) return ''; const ok=evShows(s)||/^(Attribute values|Values of the GURS)/.test(s.quote_note||''), deep=s.quote.includes(' … ')||/restated/.test(s.quote_note||'')?null:evDeep(s);
  return `<details class="ev"><summary>${ok?'Evidence':'Evidence, check'}</summary><blockquote>${evMark(s)}</blockquote><p>${ok?'Sentence as read from the source in November 2026.':'The value is not in this sentence in the same form. It may be a translation or a table row. Check it in the source.'}${s.quote_note?' '+esc(s.quote_note):''} ${deep?`<a href="${esc(deep)}" target="_blank" rel="noopener">Open the source at this sentence</a>`:`<a href="${esc(s.quote_source||s.source)}" target="_blank" rel="noopener">Open the source document</a>`}</p></details>`; }
const link=(u,t)=>u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t||host(u))}</a>`:'';
const fmtDate=d=>{try{return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch(_){return String(d).slice(0,10);}};
const num=n=>Number(n).toLocaleString('en-GB');
const RAD=Math.PI/180, R=6371008.8;
const meters=(a,b)=>{const x=(b[0]-a[0])*RAD*Math.cos((a[1]+b[1])/2*RAD),y=(b[1]-a[1])*RAD;return Math.hypot(x,y)*R;};
const lineLen=l=>l.reduce((s,c,i)=>i?s+meters(l[i-1],c):0,0);
function circle(c,m,n){n=n||72;const out=[];for(let i=0;i<=n;i++){const a=i/n*2*Math.PI;out.push([c[0]+m*Math.cos(a)/(R*Math.cos(c[1]*RAD))/RAD,c[1]+m*Math.sin(a)/R/RAD]);}return {type:'Polygon',coordinates:[out]};}

const D={features:[],byId:{},twins:{},gurs:{},gursMeta:null,news:{},newsUpdated:null,images:{},insp:{},contacts:{default:'',by_id:{}}};
async function getJSON(u){try{const r=await fetch(u);return r.ok?await r.json():null;}catch(_){return null;}}
async function load(){
  const g=await getJSON('data/zag_projects.geojson'); if(!g) throw new Error('The atlas data did not load.');
  D.features=g.features; D.byId=Object.fromEntries(g.features.map(f=>[f.properties.id,f]));
  const [tw,gu,nw,im]=await Promise.all([getJSON('data/twins.json'),getJSON('data/gurs_buildings.json'),getJSON('data/news.json'),getJSON('data/images.json')]);
  if(tw) D.twins=tw.objects||{}; if(gu){D.gurs=gu.buildings||{};D.gursMeta=gu.meta||null;} if(nw){D.news=nw.items||{};D.newsUpdated=nw.updated||null;} if(im) D.images=im;
  const [ins,con,ow,oc]=await Promise.all([getJSON('data/inspections.json'),getJSON('data/contacts.json'),getJSON('data/ownership.json'),getJSON('data/official_check.json')]); if(oc){ D.off=oc.items||{}; D.offNote=oc.note||''; } if(ow){ D.own=ow.items||{}; D.ownMeta=ow; } if(ins&&ins.items) D.insp=ins.items; if(con) D.contacts={default:con.default||'',by_id:con.by_id||{}};
  adoptUser((await getJSON('data/user_objects.json')||{}).features,'published'); adoptUser(localUser().features,'this browser');
}
/* inspection log: entries published in data/inspections.json plus entries kept in this browser. Entries are what a person typed in, not measurements. */
const INSP_KEY='zag_inspections', COND={good:['Good','ok'],fair:['Fair','warn'],poor:['Poor','bad'],critical:['Critical','bad'],none:['Not rated','']};
const KINDS=['Visual inspection','Detailed inspection','Load test','Monitoring visit','Other'];
function inspLocal(){ try{ const j=JSON.parse(localStorage.getItem(INSP_KEY)||'{}'); return j&&typeof j==='object'?j:{}; }catch(_){ return {}; } }
function inspFor(id){ const pub=(D.insp[id]||[]).map(e=>Object.assign({origin:'published'},e)), loc=(inspLocal()[id]||[]).map(e=>Object.assign({origin:'this browser'},e)); return [...pub,...loc].filter(e=>e&&/^\d{4}-\d{2}-\d{2}$/.test(e.date||'')).sort((a,b)=>a.date<b.date?1:-1); }
function inspText(p,e){ return `Inspection record, ZAG Digital Atlas\n\nObject: ${p.name_en||p.name}\nDate: ${e.date}\nKind: ${e.kind||''}\nInspector: ${e.inspector||''}\nCondition: ${(COND[e.condition]||COND.none)[0]}\nNotes: ${e.notes||''}\n${e.report?'Report: '+e.report+'\n':''}Object page: ${location.origin+location.pathname}?id=${p.id}\n`; }
const mailto=(to,subject,body)=>'mailto:'+encodeURIComponent(to||'').replace(/%40/g,'@').replace(/%2C/g,',')+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
function inspHTML(p){ const list=inspFor(p.id);
  return `${list.length?list.map(e=>`<div class="nitem"><b>${esc(e.date)}</b> <span class="tag ${(COND[e.condition]||COND.none)[1]}">${esc((COND[e.condition]||COND.none)[0])}</span> <span class="tag">${T(e.kind||'Inspection')}</span>${e.origin==='this browser'?' <span class="tag warn">in this browser only</span>':''}
      <div class="note">${e.inspector?T(e.inspector)+'. ':''}${T(e.notes||'')}${e.report&&/^https?:\/\//i.test(e.report)?' '+link(e.report,'report'):''}</div></div>`).join(''):'<p class="note" style="padding:12px 18px 0">No inspection is recorded for this object.</p>'}
    <form class="in iform" id="iform" autocomplete="off"><h3>Add an inspection record</h3>
      <div class="igrid"><label class="fld"><span>Date</span><input id="iDate" type="date" required></label><label class="fld"><span>Kind</span><select id="iKind">${KINDS.map(k=>`<option>${k}</option>`).join('')}</select></label>
        <label class="fld"><span>Condition</span><select id="iCond"><option value="none">Not rated</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option><option value="critical">Critical</option></select></label>
        <label class="fld"><span>Inspector</span><input id="iWho" maxlength="80"></label></div>
      <label class="fld"><span>Findings and notes</span><textarea id="iNotes" maxlength="1500" style="font-family:inherit;font-size:inherit;min-height:70px"></textarea></label>
      <label class="fld"><span>Link to the report, if there is one</span><input id="iRep" type="url" placeholder="https://"></label>
      <div class="btnrow"><button class="tbtn solid" type="submit">Save record</button><button class="tbtn" type="button" id="iMail">Send by email</button></div>
      <p class="note" id="iMsg" role="status">Records are kept in this browser. Download them from the dashboard to publish them for everyone.</p></form>`; }
function inspWire(p){ const f=$('iform'); if(!f) return; $('iDate').value=new Date().toISOString().slice(0,10);
  const entry=()=>({date:$('iDate').value,kind:$('iKind').value,condition:$('iCond').value,inspector:$('iWho').value.trim(),notes:$('iNotes').value.trim(),report:/^https?:\/\//i.test($('iRep').value.trim())?$('iRep').value.trim():'',created:new Date().toISOString()});
  f.onsubmit=e=>{ e.preventDefault(); const en=entry(); if(!en.date){ $('iMsg').textContent='Give the date of the inspection.'; return; } const all=inspLocal(); (all[p.id]=all[p.id]||[]).push(en);
    try{ localStorage.setItem(INSP_KEY,JSON.stringify(all)); }catch(_){ $('iMsg').textContent='This browser did not allow saving. Use Send by email instead.'; return; }
    const body=document.querySelector('#inspect .ibody'); body.innerHTML=inspHTML(p); inspWire(p); $('iMsg').textContent='Saved in this browser.'; };
  $('iMail').onclick=()=>{ const en=entry(); location.href=mailto(D.contacts.by_id[p.id]||D.contacts.default,'Inspection record: '+(p.name_en||p.name),'Dear colleague,\n\n'+inspText(p,en)+'\nHvala.\nKind regards,\n'); }; }
/* objects added with the Add object tool: published in data/user_objects.json or kept in this browser. Always marked as not verified. */
const USER_KEY='zag_user_objects';
function localUser(){ try{ const j=JSON.parse(localStorage.getItem(USER_KEY)||'null'); return j&&Array.isArray(j.features)?j:{type:'FeatureCollection',features:[]}; }catch(_){ return {type:'FeatureCollection',features:[]}; } }
function adoptUser(list,origin){
  for(const f of list||[]){ const p=f&&f.properties; if(!p||typeof p.id!=='string'||!/^user_[a-z0-9_]+$/.test(p.id)||D.byId[p.id]||!isFinite(p.latitude)||!isFinite(p.longitude)) continue;
    p.category='user_object'; p.evidence_level='user'; p.position_precision='user'; p.user_origin=origin; p.name_en=p.name_en||p.name||'Unnamed object'; p.object_type=p.object_type||'other';
    p.sources=(p.sources||[]).filter(x=>x&&/^https?:\/\//i.test(x.url||'')); p.zag_involvement_types=[]; p.facts=null; p.people=null; p.partners=null; p.image=null; p.position_sources=[];
    const u=p.user||{}, specs=[], S=(l,v)=>{ if(v!=null&&v!==''&&isFinite(+v)&&+v>0) specs.push({label:l,value:String(+v),unit:'m',source:null}); };
    S('Length',u.length); S('Width',u.width); S('Height',u.height);
    D.twins[p.id]={summary:null,specs,anchors:[],differences:[],open:(u.ai?'everything on this sheet. It began as a draft read by AI from a description or a picture, was saved by a user, and has not been checked against a source.':'everything on this sheet. It was entered by a user and has not been checked against a source.'),kind:'User object'};
    if(Array.isArray(u.polygon)&&u.polygon.length>3) D.gurs[p.id]={user:true,geometry:{type:'Polygon',coordinates:[u.polygon]},height_m:isFinite(+u.height)&&+u.height>0?+u.height:null,area_m2:null};
    D.features.push(f); D.byId[p.id]=f; }
}

/* ---------- key figures: only values that exist in the data, each with where it comes from ---------- */
const FIG_RULES=[['length',/^(total length|length total|length|slope length|line length|mapped length)\b/i],['height',/^(height|dam height|structural height|tower height|vertical rise)\b/i],
  ['span',/^(span|main span|spans)\b/i],['width',/^width\b/i],['capacity',/^(installed capacity|capacity|turbine capacity)\b/i],['year',/^(opened|opening date|year built|built|commissioned|completed|event date|date time)\b/i],
  ['volume',/^volume\b/i],['magnitude',/^magnitude\b/i],['tubes',/^tubes\b/i],['area',/^(gross floor area|floor area|footprint area)\b/i]];
function keyFigures(p,t,g,lines){
  const out=[], seen=new Set();
  const add=(cls,k,v,unit,src,srcText)=>{ if(v==null||v===''||seen.has(cls)||out.length>=6) return; seen.add(cls); out.push({k,v:String(v),unit:unit||'',src,srcText}); };
  if(g&&g.parts&&g.parts[0].kn!=null){ const top=g.parts.reduce((m,q)=>(q.h||0)>(m.h||0)?q:m,g.parts[0]); add('site','Buildings on the site',g.parts.length,'',g.outline.url,'GURS cadastre'); if(top.h!=null) add('height','Tallest building, '+top.kn,top.h.toFixed(1),'m',g.outline.url,'GURS cadastre'); if(g.site&&g.site.parcels) add('parcels','Site parcels',g.site.parcels.length,'',g.outline.url,'GURS cadastre'); add('area','Footprint of all buildings',num(g.area_m2),'m²',g.outline.url,'GURS cadastre'); if(g.parts.length>1) add('year','Built, oldest to newest',Math.min(...g.parts.map(q=>q.year||9999))+' to '+Math.max(...g.parts.map(q=>q.year||0)),'',g.outline.url,'GURS cadastre'); }
  for(const s of (t&&t.specs)||[]){ const v=clean(s.value); if(!v||v.length>20||!s.source) continue;
    for(const [cls,re] of FIG_RULES) if(re.test(s.label)){ add(cls,s.label,v,s.unit,s.source); break; } }
  if(g){ if(g.height_m!=null) add('height','Height above ground',g.height_m.toFixed(1),'m',g.user?'#specs':g.height_source?'https://ipi.eprostor.gov.si/jv/':'https://ipi.eprostor.gov.si/jgp/data',g.user?'entered by the user':g.height_source?'GURS cadastre':'GURS');
         if(g.area_m2) add('area','Footprint area',num(g.area_m2),'m²',g.user?'#specs':g.outline?g.outline.url:'https://ipi.eprostor.gov.si/jgp/data',g.user?'entered by the user':g.outline?(g.outline.way?'OpenStreetMap':'GURS cadastre'):'GURS'); }
  const S=p.structure||{};
  if(S.length_m) add('length','Length',num(S.length_m),'m','#sources','record sources');
  if(S.spans) add('span','Spans',S.spans,'','#sources','record sources');
  if(S.built) add('year','Built',S.built,'','#sources','record sources');
  if(lines&&lines.length&&!seen.has('length')) add('length','Mapped length',num(Math.round(Math.max(...lines.map(lineLen)))),'m','#geometry','drawn geometry');
  if(p.year) add('zag','ZAG involvement',clean(p.year).replace(/-$/,' onwards'),'','#sources','record sources');
  return out;
}

/* ---------- one object ---------- */
function renderTwin(f){
  const p=f.properties, id=p.id, t=D.twins[id]||null, g=D.gurs[id]||null;
  const lines=p.lines||(p.line?[p.line]:[]), labels=p.line_labels||[];
  const kind=p.category==='zag_facility'?'ZAG facility':p.category==='partner'?(p.object_type==='company'?'Partner company':'Partner institution'):p.category==='user_object'?'Object added by a user':'ZAG project';
  const where=[p.locality&&p.locality!==p.name_en?p.locality:p.municipality].filter(Boolean).join(', ');
  const exact=EXACT(p.position_precision);
  const im=D.images[id], hero=p.image?{src:p.image,credit:p.image_credit?'Photo: '+p.image_credit:null}:im?{src:im.url,credit:`Photo: ${im.author||'unknown author'}, ${im.licence}, via Wikimedia Commons`}:null;
  const figs=keyFigures(p,t,g,lines);
  const inv=(p.zag_involvement_types||[]).map(x=>INV_LABEL[x]||cap(x));
  const S=p.structure||{}, sRows=[['Crosses',S.crosses],['Carries',S.carries],['Structure',S.typ],['Built',S.built],['Spans',S.spans],['Length',S.length_m&&num(S.length_m)+' m']].filter(a=>a[1]);
  const news=D.news[id]||[], fresh=d=>Date.now()-Date.parse(d)<7*864e5;
  const coord=`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;
  const secs=[];
  const OPEN=new Set(['about','zag','specs','check']);
  const sec=(sid,title,html)=>{ if(html) secs.push({sid,title,html:`<section class="blk" id="${sid}"><h3 class="blk-h">${esc(title)}</h3>${html}</section>`}); };

  sec('about','About',(p.description||t&&t.summary)?`<div class="in">${p.description?`<p>${T(p.description)}</p>`:''}${t&&t.summary?`<p class="muted">${T(t.summary)}</p>`:''}</div>`:'');
  sec('zag','ZAG involvement',!(p.zag_role||inv.length||p.year||(p.people||[]).length||(p.partners||[]).length)?'':`<div class="in">${p.zag_role?`<p>${T(p.zag_role)}</p>`:''}${inv.length?`<div class="tags">${inv.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>`:''}
    ${p.year?`<h3>Years</h3><p>${T(p.year)}</p>`:''}${(p.people||[]).length?`<h3>Named in the sources</h3><ul>${p.people.map(x=>`<li>${T(x)}</li>`).join('')}</ul>`:''}
    ${(p.partners||[]).length?`<h3>Partners and clients</h3><ul>${p.partners.map(x=>`<li>${T(x)}</li>`).join('')}</ul>`:''}</div>`);
  sec('specs','Specifications',(t&&(t.specs||[]).length)?`<div class="tscroll"><table><thead><tr><th>Property</th><th>Value</th><th>Source</th></tr></thead><tbody>${t.specs.map(s=>`<tr><td class="l">${T(s.label)}</td><td class="v">${T(s.value)}${s.unit?' '+esc(s.unit):''}</td><td class="s">${s.source?link(s.source)+evid(s):(p.category==='user_object'?'<span class="muted">entered by the user</span>':'<span class="muted">from the record</span>')}</td></tr>`).join('')}</tbody></table></div>`:'');
  const geo=[];
  if(lines.length) geo.push(`<div class="tscroll"><table><thead><tr><th>Drawn part</th><th>Length on the map</th><th>Points</th></tr></thead><tbody>${lines.map((l,i)=>`<tr class="pick" data-line="${i}" tabindex="0" title="Show on the 3D view"><td class="l">${T(labels[i]||(lines.length>1?'Part '+(i+1):'Alignment'))}</td><td class="v">${num(Math.round(lineLen(l)))} m</td><td class="n">${l.length}</td></tr>`).join('')}</tbody></table></div><p class="note" style="padding:8px 18px 0">Lengths are measured along the drawn line and can differ from surveyed lengths.</p>`);
  if(t&&(t.anchors||[]).length) geo.push(`<div class="tscroll"><table><thead><tr><th>Reference point</th><th>Latitude, longitude</th><th>Source</th></tr></thead><tbody>${t.anchors.map((a,i)=>`<tr class="pick" data-anchor="${i}" tabindex="0" title="Show on the 3D view"><td class="l">${T(a.label)}</td><td class="n">${(+a.lat).toFixed(6)}, ${(+a.lon).toFixed(6)}</td><td class="s">${a.source?link(a.source):''}</td></tr>`).join('')}</tbody></table></div>`);
  if(g){ const M=D.gursMeta, cad=!!(g.parts&&g.parts[0].kn!=null)||!!g.height_source, topo=g.captured?' (GURS topographic survey)':'', rows=[[g.user?'Height above ground':cad?(g.parts&&g.parts[0].kn!=null&&g.parts.length>1?'Highest point above terrain, tallest building (GURS cadastre)':'Highest point above terrain (GURS cadastre)'):'Height above ground'+topo,g.height_m!=null?g.height_m.toFixed(1)+' m':null],['Footprint area',g.area_m2?num(g.area_m2)+' m²':null],['Ground level'+topo,g.ground_m!=null?g.ground_m.toFixed(1)+' m above sea level':null],
      ['Eave level'+topo,g.eave_m!=null?g.eave_m.toFixed(1)+' m above sea level':null],['Ridge level'+topo,g.ridge_m!=null?g.ridge_m.toFixed(1)+' m above sea level':null],['Use',g.use],['Date of the topographic survey',g.captured],['Building ID in the topographic survey',g.dtm_id],['Outline',g.outline?(g.outline.way?`OpenStreetMap way ${g.outline.way}, last edit ${g.outline.edited}`:`${g.outline.source}, read ${g.outline.edited}`):null],['Site boundary',g.site?g.site.source:null],['Outline before',g.outline_before?`${g.outline_before.source}, ${g.outline_before.captured||'no date'}, ${num(g.outline_before.area_m2)} m²`:null],['Height note',g.height_note],['Parts',g.parts?(g.parts[0].kn!=null?`${g.parts.length} cadastre buildings`:`${g.parts.length} parts with storey counts`):null],...[g.scan&&g.scan.stats?['inside the outline',g.scan.stats]:null,g.scan&&g.scan.group?['inside the outline of the whole group',g.scan.group]:null].filter(Boolean).flatMap(([w,k])=>[['Laser scan, middle height '+w,k.median_m.toFixed(1)+' m'],['Laser scan, 99 % level '+w,k.p99_m.toFixed(1)+' m'],['Laser scan, highest pixel '+w,k.max_m.toFixed(1)+' m']])].filter(a=>a[1]!=null);
    geo.push(`<div class="tscroll"><table><thead><tr><th>${g.user?'Outline entered by the user':g.outline?(g.outline.way?'Building (outline OpenStreetMap, height GURS)':'Site buildings (GURS cadastre)'):'Official building (GURS)'}</th><th>Value</th></tr></thead><tbody>${rows.map(([a,b])=>`<tr><td class="l">${esc(a)}</td><td class="v">${T(b)}</td></tr>`).join('')}</tbody></table></div>${M&&!g.user?`<p class="note" style="padding:8px 18px 0">${g.outline&&g.outline.way?'Outline from OpenStreetMap contributors (ODbL). ':''}${g.captured||!g.outline?T(M.source)+'. '+T(M.licence)+'.':''}${cad?' Cadastre values: GURS Kataster nepremičnin, read 12 November 2026.':''}${g.captured&&cad?' Ground, eave and ridge levels come from the topographic survey and can describe another building of the site than the cadastre height.':''}${g.parts_note?' '+T(g.parts_note):''}</p>`:''}${g.parts&&g.parts[0].kn!=null?`<div class="tscroll" style="margin-top:10px"><table><thead><tr><th>Cadastre building</th><th>Built</th><th>Storeys, below and above ground</th><th>Highest point above terrain</th><th>Footprint</th>${g.scan?'<th>Laser scan, middle</th><th>Laser scan, 99 % level</th>':''}</tr></thead><tbody>${g.parts.map(q=>`<tr><td class="l">${q.kn}</td><td class="n">${q.year||''}</td><td class="n">${q.storeys_all||''}</td><td class="v">${q.h!=null?q.h.toFixed(1)+' m':'not recorded'}</td><td class="v">${num(q.area_m2)} m²</td>${g.scan?`<td class="v">${q.scan?q.scan.median_m.toFixed(1)+' m':''}</td><td class="v">${q.scan?q.scan.p99_m.toFixed(1)+' m':''}</td>`:''}</tr>`).join('')}</tbody></table></div>`:''}${g.parts&&g.parts[0].kn==null&&g.parts[0].scan?`<div class="tscroll" style="margin-top:10px"><table><thead><tr><th>Building part</th><th>Storeys (OpenStreetMap)</th><th>Laser scan, middle</th><th>Laser scan, 99 % level</th></tr></thead><tbody>${g.parts.map((q,i)=>`<tr><td class="l">Part ${i+1}</td><td class="n">${q.levels||''}</td><td class="v">${q.scan.median_m.toFixed(1)} m</td><td class="v">${q.scan.p99_m.toFixed(1)} m</td></tr>`).join('')}</tbody></table></div>`:''}${g.scan&&M&&M.laser_scan?`<p class="note" style="padding:8px 18px 0">${T(M.laser_scan)} Files: ${g.scan.files.map(f=>link('https://ipi.eprostor.gov.si/javne-datoteke/DALJINSKO_ZAZNAVANJE/CLSS/ndmp/'+f,f)).join(', ')}.</p>`:''}<div id="kn"></div>`); if(!g.user) setTimeout(()=>liveCadastre(p),0); }
  if(lines.length){ geo.push('<div class="prof" id="prof"><p class="note" style="padding:8px 18px 0">Reading the ground profile</p></div>'); setTimeout(()=>drawProfiles(lines,labels),0); }
  sec('geometry','Geometry',geo.join(''));
  { const o=(D.own||{})[id], M=D.ownMeta||{}; if(o){ const li=a=>a&&a.length?a.map(x=>T(x)).join('<br>'):'<span class="muted">none listed</span>', rows=[];
      for(const b of o.buildings||[]){ rows.push(['Cadastre building',`${b.ko} / ${b.st}${b.checked?`, ${b.checked} of ${b.parts} building parts read`:''}`]); rows.push(['Owner of the building',li(b.owners)+(b.other?`<br><span class="muted">and ${b.other} ${b.other===1?'holder':'holders'} not listed here</span>`:'')]); rows.push(['Manager of the building',li(b.managers)]); }
      for(const q of o.parcels||[]){ rows.push(['Parcel at the point',`${q.ko} / ${T(q.st)}${q.area?', '+num(q.area)+' m²':''}`]); rows.push(['Owner of the parcel',li(q.owners)+(q.other?`<br><span class="muted">and ${q.other} ${q.other===1?'holder':'holders'} not listed here</span>`:'')]); rows.push(['Manager of the parcel',li(q.managers)]); }
      if(!rows.length) rows.push(['Cadastre','No building and no parcel was returned at the stored point']);
      sec('owner','Owner and manager',`<div class="tscroll"><table><tbody>${rows.map(([a,b])=>`<tr><td class="l">${esc(a)}</td><td class="v">${b}</td></tr>`).join('')}</tbody></table></div><p class="note" style="padding:8px 18px 0">${T(M.note||'')}</p>`); } }
  sec('record','Record data',(sRows.length||(p.facts||[]).length)?`<div class="tscroll"><table><tbody>${sRows.map(([a,b])=>`<tr><td class="l">${esc(a)}</td><td class="v">${T(b)}</td></tr>`).join('')}${(p.facts||[]).map(([a,b])=>`<tr><td class="l">${T(a)}</td><td class="v">${T(b)}</td></tr>`).join('')}</tbody></table></div>`:'');
  sec('history','History and engineering',p.hist?`<div class="in"><p>${T(p.hist)}</p></div>`:'');
  const nd=t?(t.differences||[]).length:0;
  sec('check','Verification',(nd||t&&t.open)?`${nd?`<details class="sub"${nd<=4?' open':''}><summary>Where the sources differ (${nd})</summary><ul>${t.differences.map(x=>`<li>${T(x)}</li>`).join('')}</ul></details>`:''}${t&&t.open?`<p class="open"><b>Not yet verified.</b> ${T(cap(t.open))}</p>`:''}`:'');
  sec('inspect','Inspection log',`<div class="ibody">${inspHTML(p)}</div>`);
  sec('news','Recent news',news.length?`${news.map(n=>`<div class="nitem${fresh(n.date)?' fresh':''}"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a><div class="note">${esc(n.source)}, ${fmtDate(n.date)}${n.outlets>1?`, reported by ${n.outlets} outlets`:''}</div></div>`).join('')}<p class="note" style="padding:8px 18px">Matched automatically on Slovenian keywords from Google News, so an unrelated article can slip through.${D.newsUpdated?' Checked '+fmtDate(D.newsUpdated)+'.':''}</p>`:'');
  sec('position','Position',`<div class="tscroll"><table><tbody><tr><td class="l">Basis</td><td class="v">${esc(PREC[p.position_precision]||p.position_precision)}</td></tr><tr><td class="l">WGS84</td><td class="n">${coord}</td></tr>
    ${p.address?`<tr><td class="l">Address</td><td class="v">${T(p.address)}</td></tr>`:''}${(()=>{ const o=(D.off||{})[id]; if(!o) return ''; const row=(a,b)=>`<tr><td class="l">${esc(a)}</td><td class="v">${T(b)}</td></tr>`, ln=(k,w)=>o[k]?row(`Official ${w} centre line (GURS infrastructure cadastre)`,`${o[k].point_m} m from the stored point`+(o[k].line_vertices?`, drawn line within ${o[k].line_max_m} m of it at ${o[k].line_vertices} checked points`:'')):''; return (o.municipality.length?row('Municipality at the point (GURS register)',o.municipality.join(', ')):'')+(o.municipalities_along_line?row('Municipalities at the two ends of the line (GURS register)',o.municipalities_along_line.join(' and ')):'')+(o.settlement.length?row('Settlement at the point (GURS register)',o.settlement.join(', ')):'')+ln('road','road')+ln('railway','railway'); })()}${(p.position_sources||[]).length?`<tr><td class="l">Position sources</td><td class="v">${p.position_sources.map(u=>link(u)).join(', ')}</td></tr>`:''}</tbody></table></div>
    <div class="in">${exact?'':'<p class="note">The position is approximate. The shaded circle on the view marks the area, not the object.</p>'}<div class="btnrow"><a class="tbtn" href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}" target="_blank" rel="noopener">Open in Google Maps</a><button class="tbtn" id="copy" type="button">Copy coordinates</button></div></div>`);
  sec('sources','Sources',(p.sources||[]).length?p.sources.map(s=>`<div class="src"><span>${T(s.title||s.key)}${s.type?`<br><span class="note">${esc(SRC_KIND[s.type]||cap(s.type))}</span>`:''}</span>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">Open source</a>`:''}</div>`).join(''):'');

  document.title=`${clean(p.name_en||p.name)}, asset record, ZAG Digital Atlas`;
  $('crumb').textContent=`Assets, ${GROUP_NAME[p.object_type]||cap(p.object_type)}`;
  const order=D.features.map(x=>x.properties.id), sheet=order.indexOf(id)+1;
  const model=buildModel(p,t,g,lines,labels), hasModel=model.els.length>0, EMBED=document.body.classList.contains('embed');
  const dataRows=[...((t&&t.specs)||[]).map(x=>[x.label,clean(x.value)+(x.unit?' '+x.unit:''),x.source,x]),...sRows.map(x=>[x[0],x[1],null]),...((p.facts||[]).map(x=>[x[0],x[1],null]))];
  const anchors=(t&&t.anchors)||[], nd0=t?(t.differences||[]).length:0, nSrc=dataRows.filter(r=>r[2]).length;
  const blk=ids=>secs.filter(x=>ids.includes(x.sid)).sort((x,y)=>ids.indexOf(x.sid)-ids.indexOf(y.sid)).map(x=>x.html).join('')||'<p class="note pad">Nothing is recorded here for this asset.</p>';
  const modelPane=hasModel?`<div class="pane pane-model" id="paneModel"><canvas id="fem" tabindex="0" aria-label="Model of ${T(p.name_en||p.name)}. Drag to turn it any way, scroll to zoom, double click to reset."></canvas>
      <div class="ptools"><div class="seg" role="group" aria-label="Model view"><button id="m3d" type="button" aria-pressed="true">3D</button><button id="mTop" type="button" aria-pressed="false">Top</button><button id="mSide" type="button" aria-pressed="false">Side</button></div><button class="tbtn" id="mScan" type="button" aria-pressed="true" hidden title="Show the roof surface measured by the national laser scanning, or the plain blocks">Laser scan</button><button class="tbtn" id="mMeasure" type="button" aria-pressed="false" title="Click two nodes to read the distance between them">Measure</button><button class="tbtn" id="mReset" type="button">Reset</button></div>
      <div class="plabel" id="plabel">${t&&t.model?'Rebuilt from published dimensions':'Schematic model'}</div></div>`:'';
  if(EMBED){ $('main').innerHTML=`<div class="embedbox">${modelPane}<div class="pickbox" id="pick" aria-live="polite"></div><p class="note stage-note">${T(model.note||'')}</p></div>`; }
  else $('main').innerHTML=`<div class="ws${hasModel?'':' nomodel'}">
    <aside class="tree" aria-label="Asset and its parts">
      <div class="asset"><p class="kind">${esc(kind)}</p><h1>${T(p.name_en||p.name)}</h1>${p.name_sl&&p.name_sl!==p.name_en?`<p class="sl" lang="sl">${T(p.name_sl)}</p>`:''}
        <div class="tags"><span class="tag">${esc(cap(p.object_type))}</span>${where?`<span class="tag">${T(where)}</span>`:''}<span class="tag ${p.evidence_level==='documented'?'ok':'warn'}">${esc({documented:'Documented',referenced:'Referenced',location_only:'Location only',user:'Added by a user, not verified'}[p.evidence_level]||p.evidence_level)}</span></div>
        <dl class="meta"><div><dt>Asset ID</dt><dd class="mono">${esc(id)}</dd></div><div><dt>Position basis</dt><dd class="${exact?'okc':'warnc'}">${esc(PREC[p.position_precision]||p.position_precision)}</dd></div><div><dt>WGS 84</dt><dd class="mono">${coord}</dd></div><div><dt>Register</dt><dd>${sheet} of ${order.length}</dd></div></dl>
        <div class="btnrow"><a class="tbtn solid" id="req" href="#">Request latest information</a><a class="tbtn" id="toinsp" href="#inspect">Add inspection</a></div><div class="btnrow two"><button class="tbtn" type="button" id="prt" title="Print this record with all its data, or save it as a PDF">Print report</button><a class="tbtn" href="api/v1/objects/${encodeURIComponent(p.id)}.json" target="_blank" rel="noopener" title="All data of this record as one file">Data file</a></div></div>
      ${figs.length?`<div class="tsec"><h2>Key figures</h2>${figs.map(x=>`<div class="kf"><span>${T(x.k)}</span><b>${T(x.v)}${x.unit?` <small>${esc(x.unit)}</small>`:''}</b>${x.src?(x.src[0]==='#'?`<a href="${x.src}">${esc(x.srcText)}</a>`:link(x.src,x.srcText)):''}</div>`).join('')}</div>`:''}
      <div class="tsec"><h2>Structure breakdown</h2>
        ${hasModel?`<ul class="nodes">${model.parts.map((pt,i)=>`<li><button type="button" class="trow" data-part="${i}"><span class="tic ${pt.kind==='building'?'b':'l'}"></span><span class="tn">${T(pt.name)}</span><span class="tv">${pt.kind==='building'&&pt.height?pt.height.toFixed(1)+' m high':num(Math.round(pt.len))+' m'}</span></button></li>`).join('')}
          ${anchors.map((a,i)=>`<li><button type="button" class="trow" data-ref="${i}"><span class="tic r"></span><span class="tn">${T(a.label)}</span><span class="tv">ref</span></button></li>`).join('')}</ul>
          <p class="note">${model.nodes.length} nodes and ${model.els.length} elements in the schematic mesh.</p>`
          :`<p class="note">${exact?'No drawn geometry is recorded for this asset, so it has no parts and no model. The map shows the recorded position.':'The position is approximate. The map shows an area, not a point, and there is no model.'}</p>`}</div>
      <div class="tsec"><h2>Tools</h2><div class="btncol"><button class="tbtn" id="share" type="button">Copy link to this asset</button>${hasModel?'<button class="tbtn" id="csv" type="button">Export mesh as CSV</button>':''}<button class="tbtn" id="print" type="button">Print data sheet</button></div></div>
    </aside>
    <section class="view" aria-label="Viewport">
      <div class="vtools">
        ${hasModel?`<div class="seg" role="group" aria-label="Layout"><button id="lSplit" type="button" aria-pressed="true">Split</button><button id="lMap" type="button" aria-pressed="false">Site</button><button id="lModel" type="button" aria-pressed="false">Model</button></div>`:''}
        <div class="seg" role="group" aria-label="Background"><button id="vMap" type="button" aria-pressed="true">Map</button><button id="vSat" type="button" aria-pressed="false">Satellite</button></div>
        <div class="seg" role="group" aria-label="Tilt"><button id="v3d" type="button" aria-pressed="true">3D</button><button id="v2d" type="button" aria-pressed="false">Flat</button></div>
        <button class="tbtn" id="vReset" type="button">Fit</button>
      </div>
      <div class="panes" id="panes" data-layout="split">
        <div class="pane pane-map" id="paneMap"><div id="tmap" role="application" aria-label="Site map with the structure in place"></div><div class="plabel">Site</div></div>
        ${modelPane}
      </div>
      <div class="vstatus"><span class="mono" id="readout">WGS 84</span><span>${hasModel?T(model.note):'Site view only'}</span></div>
    </section>
    <aside class="insp" aria-label="Inspector">
      <div class="tabs" role="tablist">${[['props','Properties'],['data','Data'],['quality','Quality'+(nd0?' '+nd0:'')],['insp','Inspections'],['src','Sources']].map((x,i)=>`<button role="tab" id="tab-${x[0]}" aria-controls="pan-${x[0]}" aria-selected="${i===0}" type="button">${x[1]}</button>`).join('')}</div>
      <div class="tabpan" id="pan-props" role="tabpanel"><div class="pickbox" id="pick" aria-live="polite"></div>
        <div class="alldata"><h3 class="blk-h">All data on this asset <small>${dataRows.length} values, ${nSrc} with a source link</small></h3>${dataRows.length?dataRows.map(r=>`<div class="row"><span>${T(r[0])}</span><span>${T(r[1])}${r[2]?` ${link(r[2])}`:''}</span></div>${r[3]?evid(r[3]):''}`).join(''):'<p class="note">No specifications are recorded for this asset yet.</p>'}</div>
        ${hero?`<figure class="photo"><img alt="" src="${esc(hero.src)}">${hero.credit?`<figcaption>${T(hero.credit)}</figcaption>`:''}</figure>`:''}</div>
      <div class="tabpan" id="pan-data" role="tabpanel" hidden>${blk(['about','zag','specs','geometry','owner','record','history'])}</div>
      <div class="tabpan" id="pan-quality" role="tabpanel" hidden>
        <section class="blk"><h3 class="blk-h">Data quality</h3><div class="qgrid"><div><b>${dataRows.length}</b><span>values</span></div><div><b>${nSrc}</b><span>with source</span></div><div><b>${nd0}</b><span>source conflicts</span></div><div><b>${t&&t.open?1:0}</b><span>open question</span></div><div><b>${((t&&t.specs)||[]).filter(x=>x.quote).length}</b><span>with quoted sentence</span></div><div><b>${((t&&t.specs)||[]).filter(x=>x.quote&&!evShows(x)).length}</b><span>quotes to check</span></div></div></section>${blk(['check','position'])}</div>
      <div class="tabpan" id="pan-insp" role="tabpanel" hidden>${blk(['inspect'])}</div>
      <div class="tabpan" id="pan-src" role="tabpanel" hidden>${blk(['sources','news'])}</div>
    </aside></div>`;
  document.title=`${clean(p.name_en||p.name)}, ZAG Digital Atlas`;
  const cr=$('crumb'); if(cr) cr.innerHTML=`<a href="twin.html">Assets</a> / ${esc(GROUP_NAME[p.object_type]||cap(p.object_type))} / <b>${T(p.name_en||p.name)}</b>`;
  const i0=order.indexOf(id), pv=$('prev'), nx=$('next'); if(pv&&nx){ pv.hidden=nx.hidden=false; pv.href='twin.html?id='+encodeURIComponent(order[(i0-1+order.length)%order.length]); nx.href='twin.html?id='+encodeURIComponent(order[(i0+1)%order.length]); }
  const tm=$('tomap'); if(tm) tm.href='index.html#'+encodeURIComponent(id);
  const home=()=>{ const el=$('pick'); if(el) el.innerHTML=`<h3 class="blk-h">Selection</h3><b>${T(p.name_en||p.name)}</b><div class="row"><span>Type</span><span>${esc(cap(p.object_type))}</span></div><div class="row"><span>Position</span><span>${esc(PREC[p.position_precision]||p.position_precision)}</span></div>${hasModel?'<p>Nothing selected. Click a part on the site map, in the model or in the structure breakdown.</p>':''}`; };
  const ctl={fem:null,map:null}; home();
  const markTree=sel=>{ document.querySelectorAll('.trow').forEach(b=>b.classList.toggle('on',!!sel&&((sel.part!=null&&b.dataset.part==sel.part&&sel.kind!=='ref')||(sel.kind==='ref'&&b.dataset.ref==sel.ref)))); };
  if(hasModel) ctl.fem=initModel(model,p,{home,onView:(y,pt)=>{ if(ctl.map&&ctl.map.setCamera) ctl.map.setCamera(y/RAD,pt/RAD); },onSelect:sel=>{ if(ctl.map&&ctl.map.highlight) ctl.map.highlight(sel&&sel.part!=null?sel.part:null); markTree(sel); if(sel&&!EMBED) tab('props'); }});
  if($('prt')) $('prt').onclick=()=>window.print();
  if(ctl.fem&&g&&g.scan&&g.scan.grid) getJSON(g.scan.grid).then(S=>{ if(!S||!ctl.fem.setScan(S)) return; const b=$('mScan'), lab=$('plabel'), base=lab?lab.textContent:'', show=on=>{ if(b) b.setAttribute('aria-pressed',on?'true':'false'); if(lab) lab.textContent=on?'Surface from laser scanning (GURS), read as height above ground':base; };
    if(b){ b.hidden=false; b.onclick=()=>show(ctl.fem.scan(b.getAttribute('aria-pressed')!=='true')); } show(true); });
  if(EMBED){ const mb=$('mMeasure'); if(mb&&ctl.fem) mb.onclick=()=>{ const on=mb.getAttribute('aria-pressed')!=='true'; mb.setAttribute('aria-pressed',on?'true':'false'); ctl.fem.measure(on); }; return; }
  ctl.map=initView(p,t,g,lines,labels,{camera:(b,pt)=>{ if(ctl.fem) ctl.fem.setView(b*RAD,pt*RAD); },select:(type,i)=>{ if(!ctl.fem) return; if(type==='part') ctl.fem.pickPart(i); else ctl.fem.pickRef(i); }})||{};
  /* inspector tabs, in-page links, tree, layout, tools */
  function tab(k){ document.querySelectorAll('.tabs [role=tab]').forEach(b=>b.setAttribute('aria-selected',b.id==='tab-'+k?'true':'false')); document.querySelectorAll('.tabpan').forEach(x=>x.hidden=x.id!=='pan-'+k); }
  document.querySelectorAll('.tabs [role=tab]').forEach(b=>b.onclick=()=>tab(b.id.slice(4)));
  const goto=h=>{ const el=document.getElementById(String(h).replace('#','')); if(!el) return false; const pan=el.closest('.tabpan'); if(pan) tab(pan.id.slice(4)); el.scrollIntoView({block:'start',behavior:'smooth'}); return true; };
  document.querySelector('.ws').addEventListener('click',e=>{ const a=e.target.closest('a[href^="#"]'); if(a&&a.getAttribute('href').length>1&&goto(a.getAttribute('href'))) e.preventDefault(); });
  document.querySelectorAll('.trow').forEach(b=>b.onclick=()=>{ if(b.dataset.part!=null){ const i=+b.dataset.part; if(ctl.fem) ctl.fem.pickPart(i); if(ctl.map&&ctl.map.focusLine&&i<lines.length) ctl.map.focusLine(i); } else { const i=+b.dataset.ref; if(ctl.fem) ctl.fem.pickRef(i); if(ctl.map&&ctl.map.focusAnchor) ctl.map.focusAnchor(i); markTree({kind:'ref',ref:i}); } });
  const layout=k=>{ $('panes').dataset.layout=k; [['lSplit','split'],['lMap','map'],['lModel','model']].forEach(([b,v])=>{ const el=$(b); if(el) el.setAttribute('aria-pressed',v===k?'true':'false'); }); setTimeout(()=>{ if(ctl.map&&ctl.map.resize) ctl.map.resize(); if(ctl.fem) ctl.fem.wake(); },30); };
  [['lSplit','split'],['lMap','map'],['lModel','model']].forEach(([b,v])=>{ const el=$(b); if(el) el.onclick=()=>layout(v); });
  const flash=(el,txt)=>{ const o=el.textContent; el.textContent=txt; setTimeout(()=>el.textContent=o,1600); };
  $('share').onclick=async()=>{ const u=location.origin+location.pathname+'?id='+encodeURIComponent(id); try{ await navigator.clipboard.writeText(u); flash($('share'),'Link copied'); }catch(_){ prompt('Copy this link',u); } };
  $('print').onclick=()=>{ document.querySelectorAll('.tabpan').forEach(x=>x.hidden=false); window.print(); tab('props'); };
  if($('csv')) $('csv').onclick=()=>{ const blob=new Blob([ctl.fem.csv()],{type:'text/csv'}), x=document.createElement('a'); x.href=URL.createObjectURL(blob); x.download=id+'_mesh.csv'; document.body.appendChild(x); x.click(); x.remove(); };
  if($('mMeasure')) $('mMeasure').onclick=()=>{ const on=$('mMeasure').getAttribute('aria-pressed')!=='true'; $('mMeasure').setAttribute('aria-pressed',on?'true':'false'); ctl.fem.measure(on); if(on) tab('props'); };
  { const open=t&&t.open?'\nStill to confirm: '+clean(t.open):'', last=inspFor(id)[0];
    $('req').href=mailto(D.contacts.by_id[id]||D.contacts.default,'Latest information needed: '+(p.name_en||p.name),
      `Dear colleague,\n\nPlease send the latest information on this structure for the ZAG Digital Atlas.\n\nObject: ${p.name_en||p.name}${p.name_sl&&p.name_sl!==p.name_en?' ('+p.name_sl+')':''}\nType: ${p.object_type}\nPlace: ${where||''}\nPage: ${location.origin+location.pathname}?id=${id}\n${open}${nd0?'\nSources disagree on '+nd0+(nd0===1?' point':' points')+', listed on the page.':''}\nLast inspection in the atlas: ${last?last.date+', '+(COND[last.condition]||COND.none)[0].toLowerCase():'none recorded'}\n\nUseful to have: current condition, date and kind of the last inspection, any change to the structure, and a link to the report.\n\nHvala.\nKind regards,\n`);
    inspWire(p); }
  const cp=$('copy'); if(cp) cp.onclick=async()=>{try{await navigator.clipboard.writeText(coord);cp.textContent='Copied';}catch(_){cp.textContent='Copy is not available here';}setTimeout(()=>cp.textContent='Copy coordinates',1800);};
  document.querySelectorAll('tr.pick').forEach(tr=>{ const act=()=>{ if(tr.dataset.line!=null){ const i=+tr.dataset.line; if(ctl.fem) ctl.fem.pickPart(i); if(ctl.map.focusLine) ctl.map.focusLine(i); } else { const i=+tr.dataset.anchor; if(ctl.fem) ctl.fem.pickRef(i); if(ctl.map.focusAnchor) ctl.map.focusAnchor(i); } }; tr.onclick=act; tr.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } }; });
}

/* ---------- schematic model ----------
   A mesh in the manner of a finite element model, generated only from geometry the atlas already holds:
   the drawn alignment of each part (OpenStreetMap), a deck width where a source states one, and the official building outline and height (GURS).
   Element size is a drawing choice. Nothing here is a structural analysis model, and no pier, span or cross section is assumed. */
function buildModel(p,t,g,lines,labels){
  const all=[...lines.flat()], ring0=g&&g.geometry?(g.geometry.type==='Polygon'?[g.geometry.coordinates]:g.geometry.type==='MultiPolygon'?g.geometry.coordinates:[]).map(x=>x[0]):[];
  ring0.forEach(r=>all.push(...r)); const M={nodes:[],els:[],parts:[],refs:[],faces:[],note:'',R:1};
  if(!all.length) return M;
  const o=[all.reduce((a,c)=>a+c[0],0)/all.length,all.reduce((a,c)=>a+c[1],0)/all.length], kx=RAD*Math.cos(o[1]*RAD)*R, ky=RAD*R;
  const xy=c=>[(c[0]-o[0])*kx,(c[1]-o[1])*ky], ll=(x,y)=>[o[0]+x/kx,o[1]+y/ky];
  const node=(x,y,z,part,extra)=>{ const l=ll(x,y); M.nodes.push(Object.assign({id:M.nodes.length+1,x,y,z,part,lon:l[0],lat:l[1]},extra||{})); return M.nodes.length-1; };
  const el=(a,b,part,kind)=>{ const A=M.nodes[a],B=M.nodes[b]; M.els.push({id:M.els.length+1,a,b,part,kind,len:Math.hypot(B.x-A.x,B.y-A.y,B.z-A.z)}); };
  const mdl=(t&&t.model)||null;
  const wSpec=((t&&t.specs)||[]).find(s=>/^width$/i.test(s.label)&&/^m$/i.test(s.unit||'')&&isFinite(parseFloat(s.value))), W=mdl&&mdl.deck_width_m?mdl.deck_width_m:wSpec?parseFloat(wSpec.value):null;
  lines.forEach((l,i)=>{ const P=l.map(xy), cum=[0]; for(let k=1;k<P.length;k++) cum.push(cum[k-1]+Math.hypot(P[k][0]-P[k-1][0],P[k][1]-P[k-1][1]));
    const L=cum[cum.length-1]; if(!(L>0)) return; const part=M.parts.length, axis=[], left=[], right=[];
    /* a model block holds published dimensions: the true length replaces the mapped one, and stations fall on supports and segment joints */
    const Lm=mdl&&mdl.length_m?mdl.length_m:L, sc=Lm/L, mx=(P[0][0]+P[P.length-1][0])/2, my=(P[0][1]+P[P.length-1][1])/2, sup=(mdl&&mdl.supports_at_m)||[];
    let st=[];
    if(mdl&&mdl.segments){ const run=mdl.segments.count*mdl.segments.length_m, a=(Lm-run)/2; st.push(0); for(let k=0;k<=mdl.segments.count;k++) st.push(a+k*mdl.segments.length_m); st.push(Lm); }
    else if(sup.length){ const br=[0,...sup,Lm].sort((a,b)=>a-b); for(let k=1;k<br.length;k++){ const d=br[k]-br[k-1]; if(d<1e-6) continue; const m=Math.max(1,Math.min(24,Math.round(d/6))); for(let q=0;q<m;q++) st.push(br[k-1]+d*q/m); } st.push(Lm); }
    else { const n=Math.max(8,Math.min(48,Math.round(L/25))); for(let k=0;k<=n;k++) st.push(L*k/n); }
    st=st.filter((v,k)=>k===0||v-st[k-1]>1e-6); const n=st.length-1, s0=sup.length?Math.min(...sup):0, s1=sup.length?Math.max(...sup):Lm;
    const supAt=d=>{ const q=sup.findIndex(v=>Math.abs(v-d)<1e-6); return q<0?null:q+1; };
    for(let k=0;k<=n;k++){ const d=st[k], dg=d/sc; let j=1; while(j<cum.length-1&&cum[j]<dg) j++; const u=(dg-cum[j-1])/((cum[j]-cum[j-1])||1); let x=P[j-1][0]+(P[j][0]-P[j-1][0])*u, y=P[j-1][1]+(P[j][1]-P[j-1][1])*u;
      x=mx+(x-mx)*sc; y=my+(y-my)*sc;
      const tx=P[j][0]-P[j-1][0], ty=P[j][1]-P[j-1][1], tl=Math.hypot(tx,ty)||1, nx=-ty/tl, ny=tx/tl, f=(d-s0)/((s1-s0)||1), z=mdl&&mdl.sag_m&&f>0&&f<1?-4*mdl.sag_m*f*(1-f):0, sp=supAt(d);
      axis.push(node(x,y,z,part,{ch:d,role:'axis',sup:sp}));
      if(W){ left.push(node(x+nx*W/2,y+ny*W/2,z,part,{ch:d,role:'edge',sup:sp})); right.push(node(x-nx*W/2,y-ny*W/2,z,part,{ch:d,role:'edge',sup:sp})); } }
    for(let k=0;k<n;k++){ el(axis[k],axis[k+1],part,'axis'); if(W){ el(left[k],left[k+1],part,'edge'); el(right[k],right[k+1],part,'edge'); } }
    if(W) for(let k=0;k<=n;k++){ const kd=M.nodes[axis[k]].sup?'support':'cross'; el(left[k],axis[k],part,kd); el(axis[k],right[k],part,kd); }
    if(W) for(let k=0;k<n;k++) M.faces.push({v:[left[k],left[k+1],right[k+1],right[k]],part,kind:'deck'});
    M.parts.push({name:labels[i]||(lines.length>1?'Part '+(i+1):p.name_en||p.name),len:Lm,track:axis,kind:'line',width:W}); });
  /* building volumes: the parts with storey counts where the source has them, else the single outline at its surveyed height */
  const STOREY=(g&&g.storey_m)||3;
  const vols=g&&g.parts?g.parts.map((q,i)=>q.kn!=null?{ring:q.ring,h:q.h!=null?q.h:q.scan?q.scan.median_m:0,name:`Building ${q.kn}, ${q.year||'year not recorded'}`,info:[['Cadastre building',String(q.kn)],['Year built',q.year?String(q.year):null],['Storeys, below and above ground',q.storeys_all?String(q.storeys_all):null],['Highest point above terrain (cadastre)',q.h!=null?q.h.toFixed(1)+' m':'not recorded']]}:q.scan?{ring:q.ring,h:q.scan.median_m,name:`Part ${i+1}, ${q.levels} ${q.levels===1?'storey':'storeys'}`}:{ring:q.ring,h:q.levels*STOREY,derived:true,name:`Part ${i+1}, ${q.levels} ${q.levels===1?'storey':'storeys'}`}):ring0.map((r,i)=>({ring:r,h:g.height_m||0,name:ring0.length>1?'Outline '+(i+1):'Building outline'}));
  vols.forEach(v=>{ const P=v.ring.slice(0,-1).map(xy); if(P.length<3) return; const h=v.h, lv=h?1:0, part=M.parts.length, rings=[];
    for(let k=0;k<=lv;k++){ const z=lv?h*k/lv:0; rings.push(P.map(c=>node(c[0],c[1],z,part,{role:k===0?'ground':k===lv?'top':'level'}))); }
    rings.forEach(rg=>rg.forEach((a,q)=>el(a,rg[(q+1)%rg.length],part,'ring')));
    for(let k=0;k<lv;k++) rings[k].forEach((a,q)=>el(a,rings[k+1][q],part,'vertical'));
    if(lv){ const r0=rings[0], rT=rings[lv]; const sa=P.reduce((a,c,q)=>a+c[0]*P[(q+1)%P.length][1]-P[(q+1)%P.length][0]*c[1],0)>0?1:-1; r0.forEach((a,q)=>{ const c=P[q], d=P[(q+1)%P.length], ex=d[0]-c[0], ey=d[1]-c[1], el2=Math.hypot(ex,ey)||1; M.faces.push({v:[a,r0[(q+1)%r0.length],rT[(q+1)%r0.length],rT[q]],part,kind:'wall',h,n:[sa*ey/el2,-sa*ex/el2]}); }); M.faces.push({v:rT.slice(),part,kind:'roof'}); }
    const top=rings[rings.length-1]; M.parts.push({name:v.name,len:P.reduce((a,c,q)=>a+Math.hypot(P[(q+1)%P.length][0]-c[0],P[(q+1)%P.length][1]-c[1]),0),track:[...top,top[0]],kind:'building',height:v.derived?null:(h||null),info:v.info||null}); });
  ((t&&t.anchors)||[]).forEach((a,i)=>{ const c=xy([+a.lon,+a.lat]); M.refs.push({i,x:c[0],y:c[1],z:0,label:a.label,lat:+a.lat,lon:+a.lon,source:a.source}); });
  M.R=Math.max(1,...M.nodes.map(n=>Math.hypot(n.x,n.y,n.z)),...M.refs.map(n=>Math.hypot(n.x,n.y)),...(g&&g.site?(g.site.rings||[g.site.ring]).flat().map(c=>Math.hypot(...xy(c))):[]));
  const bits=[]; if(lines.length) bits.push('the drawn alignment'+(W?' and the deck width of '+W+(p.category==='user_object'?' m entered by the user':' m given in the sources'):'')); if(ring0.length) bits.push(g.parts&&g.parts[0].kn!=null?`${g.parts.length} ${g.parts.length===1?'building':'buildings'} of the GURS cadastre, each raised to its own recorded height`:g.parts?g.parts[0].scan?`${g.parts.length} building parts from OpenStreetMap, each raised to the middle height that the laser scanning measured inside its outline`:`${g.parts.length} building parts from OpenStreetMap, each drawn in proportion to its storey count, since only the highest point of the whole building is measured`:(g.user?'the outline entered by the user':g.outline?`the OpenStreetMap outline (edit of ${g.outline.edited})`:'the official GURS outline')+(g.height_m?(g.user?' raised to the entered height of ':' raised to the height surveyed by GURS, ')+g.height_m.toFixed(1)+' m':''));
  if(ring0.length&&(g.height_m||g.parts)) bits.push('plain blocks with no roof shape, storeys or windows, because the sources do not give them');
  if(g&&g.site) M.site=(g.site.rings||[g.site.ring]).map(r=>r.map(c=>xy(c)));
  M.xy=xy; M.ll=ll;
  if(mdl){ M.recon=true; M.note='Model rebuilt from published dimensions: '+(mdl.basis||[]).join(', ')+'. '+(mdl.assumed||'')+' It is not a structural analysis model.'; }
  else M.note='Schematic mesh generated from '+bits.join(' and ')+'. It is not a structural analysis model. Element size is a drawing choice'+(lines.length?', and heights along the alignment are not in the sources, so those parts are drawn flat':'')+'.'+(g&&g.scan?' The Laser scan view replaces the blocks with the surface heights measured by the national laser scanning inside the same outlines, in 1 m cells.':'');
  return M;
}
function initModel(M,p,opt){
  opt=opt||{}; const cv=$('fem'), ctx=cv.getContext('2d'), info=$('pick');
  const HOME={yaw:-.6,pitch:.95}; let yaw=HOME.yaw,pitch=HOME.pitch,zoom=1,panX=0,panY=0,w=0,h=0,dpr=1,sel=null,hov=null,P=[],PR=[],queued=0,awake=true,meas=false,mp=[],scan=null,scanOn=false;
  const bld=i=>M.parts[i]&&M.parts[i].kind==='building';
  const tiltLim=v=>opt.onView?Math.max(0,Math.min(85*RAD,v)):v;
  const press=(id,on)=>{ const el=$(id); if(el) el.setAttribute('aria-pressed',on?'true':'false'); };
  const size=()=>{ const r=cv.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1); w=r.width; h=r.height; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); };
  const proj=(x,y,z)=>{ const c=Math.cos(yaw),s=Math.sin(yaw),x1=x*c-y*s,y1=x*s+y*c,k=Math.min(w,h)*.47/M.R*zoom; return [w/2+panX+x1*k,h/2+panY-(y1*Math.cos(pitch)+z*Math.sin(pitch))*k]; };
  const along=(tr,f)=>{ const m=tr.length-1, q=Math.max(0,Math.min(m-1e-6,f*m)), i=Math.floor(q), u=q-i, A=M.nodes[tr[i]], B=M.nodes[tr[i+1]]; return proj(A.x+(B.x-A.x)*u,A.y+(B.y-A.y)*u,A.z+(B.z-A.z)*u); };
  function draw(){ queued=0; if(!awake||!w) return;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    const span=M.R*2.4, raw=span/10, pw=Math.pow(10,Math.floor(Math.log10(raw))), step=[1,2,5,10].map(m=>m*pw).find(v=>v>=raw), half=Math.ceil(span/2/step)*step;
    ctx.lineWidth=1; ctx.strokeStyle='rgba(32,52,105,.10)'; ctx.beginPath();
    for(let v=-half;v<=half+1e-6;v+=step){ let a=proj(v,-half,0),b=proj(v,half,0); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); a=proj(-half,v,0); b=proj(half,v,0); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); } ctx.stroke();
    P=M.nodes.map(n=>proj(n.x,n.y,n.z)); PR=M.refs.map(n=>proj(n.x,n.y,n.z));
    if(M.site){ ctx.beginPath(); for(const rg of M.site){ rg.forEach((c,k)=>{ const q=proj(c[0],c[1],0); k?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); }); ctx.closePath(); } ctx.fillStyle='rgba(10,102,216,.07)'; ctx.fill(); ctx.strokeStyle='rgba(10,102,216,.45)'; ctx.lineWidth=1; ctx.stroke(); }
    const selPart=sel&&sel.type==='part'?sel.i:null;
    if(M.faces.length){ const cy=Math.cos(yaw), sy=Math.sin(yaw), sp=Math.sin(pitch), cp=Math.cos(pitch), dep=n=>(n.x*sy+n.y*cy)*sp-n.z*cp, L=[-.45,-.55,.7];
      const fs=M.faces.map(f=>{ const A=M.nodes[f.v[0]],B=M.nodes[f.v[1]],C=M.nodes[f.v[2]], ux=B.x-A.x,uy=B.y-A.y,uz=B.z-A.z,vx=C.x-A.x,vy=C.y-A.y,vz=C.z-A.z; let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx; const nl=Math.hypot(nx,ny,nz)||1;
        return {f,d:f.v.reduce((a,i)=>a+dep(M.nodes[i]),0)/f.v.length,sh:f.kind==='wall'?.62+.38*Math.abs((nx*L[0]+ny*L[1])/nl):f.kind==='roof'?1:.94}; });
      /* building volumes are drawn far to near, each as its camera-facing walls and then its roof. Sorting single faces fails on large concave roofs. */
      const pd={}; M.parts.forEach((pt,i)=>{ if(pt.kind==='building'){ const ns=pt.track.map(k=>M.nodes[k]), cx=(Math.min(...ns.map(n=>n.x))+Math.max(...ns.map(n=>n.x)))/2, cyy=(Math.min(...ns.map(n=>n.y))+Math.max(...ns.map(n=>n.y)))/2; pd[i]=(cx*sy+cyy*cy)*sp; } });
      for(let k=fs.length-1;k>=0;k--){ const f=fs[k].f; if((scanOn&&bld(f.part))||(f.kind==='wall'&&f.n&&sp>.02&&(f.n[0]*sy+f.n[1]*cy)>0)) fs.splice(k,1); }
      fs.sort((a,b)=>{ const pa=pd[a.f.part], pb=pd[b.f.part]; if(pa!=null&&pb!=null&&a.f.part!==b.f.part) return pb-pa; if(pa!=null&&pb!=null){ const ra=a.f.kind==='roof'?1:0, rb=b.f.kind==='roof'?1:0; if(ra!==rb) return ra-rb; } return b.d-a.d; });
      for(const {f,sh} of fs){ const on=selPart===f.part, base=on?[158,196,246]:f.kind==='roof'?[226,231,240]:f.kind==='deck'?[205,213,228]:[186,197,219];
        ctx.beginPath(); f.v.forEach((i,k)=>k?ctx.lineTo(P[i][0],P[i][1]):ctx.moveTo(P[i][0],P[i][1])); ctx.closePath(); ctx.fillStyle=`rgba(${Math.round(base[0]*sh)},${Math.round(base[1]*sh)},${Math.round(base[2]*sh)},${f.kind==='deck'?.93:1})`; ctx.fill(); if(f.kind!=='deck'){ ctx.strokeStyle=on?'#0A66D8':'#203469'; ctx.lineWidth=f.kind==='roof'?1.6:1.1; ctx.lineJoin='round'; ctx.stroke(); }
      } }
    if(scanOn) drawScan(selPart);
    /* solid volumes carry their own outlines, so their hidden edges are not drawn through the roof */
    const solid=new Set(M.faces.filter(f=>f.kind!=='deck').map(f=>f.part));
    for(const pass of [0,1]){ ctx.beginPath(); for(const e of M.els){ if(solid.has(e.part)) continue; const main=e.kind==='axis'||e.kind==='ring'||e.kind==='edge'; if((pass===1)!==main) continue; ctx.moveTo(P[e.a][0],P[e.a][1]); ctx.lineTo(P[e.b][0],P[e.b][1]); }
      ctx.strokeStyle=pass?'#203469':'rgba(32,52,105,.35)'; ctx.lineWidth=pass?2:1; ctx.stroke(); }
    ctx.beginPath(); for(const e of M.els) if(e.kind==='support'){ ctx.moveTo(P[e.a][0],P[e.a][1]); ctx.lineTo(P[e.b][0],P[e.b][1]); } ctx.strokeStyle='#203469'; ctx.lineWidth=3.5; ctx.stroke();
    if(selPart!=null){ ctx.beginPath(); for(const e of M.els) if(e.part===selPart&&e.kind!=='cross'&&!solid.has(e.part)){ ctx.moveTo(P[e.a][0],P[e.a][1]); ctx.lineTo(P[e.b][0],P[e.b][1]); } ctx.strokeStyle='#0A66D8'; ctx.lineWidth=2.5; ctx.stroke(); }
    const mark=(o,col)=>{ if(o&&o.type==='el'){ const e=M.els[o.i]; ctx.beginPath(); ctx.moveTo(P[e.a][0],P[e.a][1]); ctx.lineTo(P[e.b][0],P[e.b][1]); ctx.strokeStyle=col; ctx.lineWidth=5; ctx.lineCap='round'; ctx.stroke(); ctx.lineCap='butt'; } };
    mark(hov,'rgba(0,122,255,.4)'); mark(sel,'#007AFF');
    ctx.fillStyle='#203469'; const ns=M.nodes.length>260?2:3; P.forEach((q,k)=>{ const nd=M.nodes[k]; if((scanOn&&bld(nd.part))||(solid.has(nd.part)&&nd.role!=='top')) return; ctx.fillRect(q[0]-ns/2,q[1]-ns/2,ns,ns); });
    M.nodes.forEach((nd,k)=>{ if(nd.sup&&nd.role==='axis'){ const q=P[k]; ctx.beginPath(); ctx.moveTo(q[0],q[1]+2); ctx.lineTo(q[0]-6,q[1]+12); ctx.lineTo(q[0]+6,q[1]+12); ctx.closePath(); ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=1.8; ctx.strokeStyle='#203469'; ctx.stroke(); } });
    const dot=(o,r,col)=>{ if(o&&o.type==='node'){ const q=P[o.i]; ctx.beginPath(); ctx.arc(q[0],q[1],r,0,7); ctx.fillStyle=col; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke(); } };
    dot(hov,5,'rgba(0,122,255,.5)'); dot(sel,6,'#007AFF');
    PR.forEach((q,i)=>{ const on=sel&&sel.type==='ref'&&sel.i===i; ctx.beginPath(); ctx.moveTo(q[0],q[1]-6); ctx.lineTo(q[0]+6,q[1]); ctx.lineTo(q[0],q[1]+6); ctx.lineTo(q[0]-6,q[1]); ctx.closePath(); ctx.fillStyle=on?'#007AFF':'#fff'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=on?'#fff':'#5856D6'; ctx.stroke(); });
    if(mp.length){ ctx.strokeStyle='#D9480F'; ctx.fillStyle='#D9480F'; ctx.lineWidth=2; const Q=mp.map(m=>proj(m.x,m.y,m.z)); if(mp.length===2){ ctx.setLineDash([6,4]); ctx.beginPath(); ctx.moveTo(Q[0][0],Q[0][1]); ctx.lineTo(Q[1][0],Q[1][1]); ctx.stroke(); ctx.setLineDash([]); const tx=num(Math.round(mDist()*10)/10)+' m', mx=(Q[0][0]+Q[1][0])/2, my=(Q[0][1]+Q[1][1])/2; ctx.font='600 12.5px Inter,system-ui,sans-serif'; const tw=ctx.measureText(tx).width; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.roundRect(mx-tw/2-7,my-22,tw+14,20,10); ctx.fill(); ctx.fillStyle='#D9480F'; ctx.fillText(tx,mx-tw/2,my-12); } for(const q of Q){ ctx.beginPath(); ctx.arc(q[0],q[1],5,0,7); ctx.fillStyle='#D9480F'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke(); } }
    if(meas){ ctx.font='600 12.5px Inter,system-ui,sans-serif'; ctx.textBaseline='middle'; const tx=mp.length===0?'Measure: click the first point':mp.length===1?'Now click the second point':'Distance '+num(Math.round(mDist()*10)/10)+' m. Click again for a new measure'; const tw=ctx.measureText(tx).width; ctx.fillStyle='rgba(255,255,255,.95)'; ctx.beginPath(); ctx.roundRect(w/2-tw/2-12,54,tw+24,28,14); ctx.fill(); ctx.strokeStyle='rgba(217,72,15,.35)'; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle='#D9480F'; ctx.fillText(tx,w/2-tw/2,68); }
    ctx.font='500 11.5px Inter,system-ui,sans-serif'; ctx.textBaseline='middle'; ctx.fillStyle='#6E6E73'; ctx.fillText('Grid '+(step>=1000?step/1000+' km':step+' m'),10,h-12);
    if(scanOn){ const gx=10, gy=h-70, gw=120, gr=ctx.createLinearGradient(gx,0,gx+gw,0); for(let k=0;k<=4;k++) gr.addColorStop(k/4,scanCol(k/4,1)); ctx.fillStyle=gr; ctx.fillRect(gx,gy,gw,8); ctx.strokeStyle='rgba(32,52,105,.35)'; ctx.lineWidth=1; ctx.strokeRect(gx+.5,gy+.5,gw-1,7); ctx.fillStyle='#6E6E73'; ctx.fillText('0 m',gx,gy-9); const tx=scan.zmax.toFixed(1)+' m above ground'; ctx.fillText(tx,gx+gw-ctx.measureText(scan.zmax.toFixed(1)+' m').width,gy-9); }
    const c0=proj(0,0,0), cn=proj(0,M.R*.25,0), dx=cn[0]-c0[0], dy=cn[1]-c0[1], dl=Math.hypot(dx,dy); if(dl>1){ const ax=w-30, ay=h-30; ctx.strokeStyle='#203469'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ax+dx/dl*16,ay+dy/dl*16); ctx.stroke(); ctx.fillStyle='#203469'; ctx.font='700 11px Inter,system-ui,sans-serif'; ctx.fillText('N',ax+dx/dl*24-4,ay+dy/dl*24); }
  }
  const scanCol=(t,sh)=>{ const a=[226,232,243], b=[36,84,170], q=Math.pow(Math.max(0,Math.min(1,t)),.85); return 'rgb('+Math.round((a[0]+(b[0]-a[0])*q)*sh)+','+Math.round((a[1]+(b[1]-a[1])*q)*sh)+','+Math.round((a[2]+(b[2]-a[2])*q)*sh)+')'; };
  const scanGeo=()=>{ const {o,u,v}=scan, A=proj(o[0],o[1],0), B=proj(o[0]+u[0],o[1]+u[1],0), C=proj(o[0]+v[0],o[1]+v[1],0), Z=proj(o[0],o[1],1), cy=Math.cos(yaw), sy=Math.sin(yaw), sp=Math.sin(pitch);
    return {A,ux:B[0]-A[0],uy:B[1]-A[1],vx:C[0]-A[0],vy:C[1]-A[1],zx:Z[0]-A[0],zy:Z[1]-A[1],du:(u[0]*sy+u[1]*cy)*sp,dv:(v[0]*sy+v[1]*cy)*sp}; };
  /* Every cell is a column from the ground to its measured height. Columns run from the far side to the near side, so nearer ones cover farther ones.
     A side face is drawn only where the neighbour towards the viewer is lower. */
  function drawScan(selPart){ const {nx,ny,z,zmax,own}=scan, G=scanGeo(), {A,ux,uy,vx,vy,zx,zy}=G, fi=G.du>0, fj=G.dv>0;
    const quad=(x0,y0,x1,y1,x2,y2,x3,y3,col)=>{ ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fillStyle=col; ctx.fill(); ctx.strokeStyle=col; ctx.stroke(); };
    ctx.lineWidth=.7; ctx.lineJoin='round';
    for(let jj=0;jj<ny;jj++){ const j=fj?ny-1-jj:jj; for(let ii=0;ii<nx;ii++){ const i=fi?nx-1-ii:ii, k=j*nx+i, hh=z[k]; if(hh!==hh) continue;
        const x=A[0]+i*ux+j*vx, y=A[1]+i*uy+j*vy, t=hh/zmax, on=selPart!=null&&own[k]===selPart, tint=(c,sh)=>on?'rgb('+Math.round(120*sh)+','+Math.round(172*sh)+','+Math.round(246*sh)+')':scanCol(c,sh);
        const ni=i+(fi?-1:1), nj=j+(fj?-1:1), hi=ni<0||ni>=nx||z[j*nx+ni]!==z[j*nx+ni]?0:z[j*nx+ni], hj=nj<0||nj>=ny||z[nj*nx+i]!==z[nj*nx+i]?0:z[nj*nx+i];
        if(hi<hh-.05){ const ex=x+(fi?0:ux), ey=y+(fi?0:uy); quad(ex+hh*zx,ey+hh*zy,ex+vx+hh*zx,ey+vy+hh*zy,ex+vx+hi*zx,ey+vy+hi*zy,ex+hi*zx,ey+hi*zy,tint(t,.70)); }
        if(hj<hh-.05){ const ex=x+(fj?0:vx), ey=y+(fj?0:vy); quad(ex+hh*zx,ey+hh*zy,ex+ux+hh*zx,ey+uy+hh*zy,ex+ux+hj*zx,ey+uy+hj*zy,ex+hj*zx,ey+hj*zy,tint(t,.84)); }
        const tx=x+hh*zx, ty=y+hh*zy; quad(tx,ty,tx+ux,ty+uy,tx+ux+vx,ty+uy+vy,tx+vx,ty+vy,tint(t,1)); } }
    for(const [o2,col,lw] of [[hov,'rgba(0,122,255,.55)',2],[sel,'#007AFF',2.5]]) if(o2&&o2.type==='cell'){ const hh=z[o2.k], i=o2.k%nx, j=(o2.k-i)/nx, tx=A[0]+i*ux+j*vx+hh*zx, ty=A[1]+i*uy+j*vy+hh*zy; ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx+ux,ty+uy); ctx.lineTo(tx+ux+vx,ty+uy+vy); ctx.lineTo(tx+vx,ty+vy); ctx.closePath(); ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.stroke(); } }
  /* the cell under the pointer: the nearest column whose top contains the point */
  function cellAt(px,py){ const {nx,ny,z}=scan, G=scanGeo(), {A,ux,uy,vx,vy,zx,zy}=G, det=ux*vy-uy*vx; if(Math.abs(det)<1e-9) return null; const fi=G.du>0, fj=G.dv>0;
    for(let jj=ny-1;jj>=0;jj--){ const j=fj?ny-1-jj:jj; for(let ii=nx-1;ii>=0;ii--){ const i=fi?nx-1-ii:ii, k=j*nx+i, hh=z[k]; if(hh!==hh) continue;
        const dx=px-(A[0]+i*ux+j*vx+hh*zx), dy=py-(A[1]+i*uy+j*vy+hh*zy), a=(dx*vy-dy*vx)/det, b=(ux*dy-uy*dx)/det; if(a>=0&&a<=1&&b>=0&&b<=1) return {type:'cell',k}; } }
    return null; }
  const redraw=()=>{ if(!queued) queued=requestAnimationFrame(draw); };
  const row=(k,v,html)=>v==null||v===''?'':`<div class="row"><span>${esc(k)}</span><span>${html?v:T(v)}</span></div>`;
  function describe(){
    if(opt.onSelect) opt.onSelect(!sel?null:sel.type==='ref'?{kind:'ref',ref:M.refs[sel.i].i,part:null}:sel.type==='cell'?{kind:'cell',part:scan.own[sel.k]>=0?scan.own[sel.k]:null}:{kind:sel.type,part:sel.type==='part'?sel.i:sel.type==='node'?M.nodes[sel.i].part:M.els[sel.i].part});
    if(!info) return; if(sel&&sel.type==='cell'){ const i=sel.k%scan.nx, j=(sel.k-i)/scan.nx, c=[scan.o[0]+(i+.5)*scan.u[0]+(j+.5)*scan.v[0],scan.o[1]+(i+.5)*scan.u[1]+(j+.5)*scan.v[1]], l=M.ll(c[0],c[1]), pi=scan.own[sel.k];
      info.innerHTML=`<h3 class="blk-h">Selection</h3><b>Laser scan cell</b>${row('Part',pi>=0?M.parts[pi].name:null)}${row('Height above ground',scan.z[sel.k].toFixed(1)+' m')}${row('Cell size','1 m by 1 m')}${row('Latitude',l[1].toFixed(6))}${row('Longitude',l[0].toFixed(6))}${row('Source',scan.files.map(u=>link(u,u.split('/').pop())).join(', '),true)}<p>${T(scan.source)}, read ${T(scan.read)}. The value is the mean of the 0.5 m pixels of the cell that lie inside the building outline.</p>`; return; }
    if(!sel){ if(opt.home) opt.home(); else info.innerHTML='<b>Model</b><p>Click a node or an element for its data.</p>'; return; }
    if(sel.type==='node'){ const n=M.nodes[sel.i], pt=M.parts[n.part];
      info.innerHTML=`<h3 class="blk-h">Selection</h3><b>Node ${n.id}</b>${row('Part',pt.name)}${row('Role',{axis:'on the centre line',edge:'deck edge',ground:'ground level',top:'top of the building',level:'mesh level'}[n.role])}${row('Distance along the part',n.ch!=null?num(Math.round(n.ch*10)/10)+' m':null)}${row('Support axis',n.sup?String(n.sup):null)}${row('Level relative to the supports',M.recon&&pt.kind==='line'&&n.z?n.z.toFixed(2)+' m':null)}${row('Height above ground',pt.kind==='building'?n.z.toFixed(1)+' m':null)}${row('Latitude',n.lat.toFixed(6))}${row('Longitude',n.lon.toFixed(6))}`; }
    else if(sel.type==='el'){ const e=M.els[sel.i], pt=M.parts[e.part];
      info.innerHTML=`<h3 class="blk-h">Selection</h3><b>Element ${e.id}</b>${row('Part',pt.name)}${row('Kind',{axis:'centre line',edge:'deck edge',cross:'across the deck',ring:'outline',vertical:'vertical'}[e.kind])}${row('Length',num(Math.round(e.len*10)/10)+' m')}${row('Nodes',M.nodes[e.a].id+' to '+M.nodes[e.b].id)}`; }
    else if(sel.type==='part'){ const pt=M.parts[sel.i], ne=M.els.filter(e=>e.part===sel.i).length, nn=M.nodes.filter(n=>n.part===sel.i).length;
      info.innerHTML=`<h3 class="blk-h">Selection</h3><b>${T(pt.name)}</b>${pt.kind==='building'?'':row('Length on the map',num(Math.round(pt.len))+' m')}${row('Deck width',pt.width?pt.width+' m':null)}${row('Height above ground',pt.height&&!pt.info?pt.height.toFixed(1)+' m':null)}${(pt.info||[]).map(([a,b])=>row(a,b)).join('')}${pt.kind==='building'?'':row('Mesh',nn+' nodes, '+ne+' elements')}${row('Object',p.name_en||p.name)}`; }
    else { const r=M.refs[sel.i]; info.innerHTML=`<h3 class="blk-h">Selection</h3><b>${T(r.label)}</b>${row('Kind','reference point')}${row('Latitude',r.lat.toFixed(6))}${row('Longitude',r.lon.toFixed(6))}${row('Source',r.source?link(r.source):'',true)}`; }
  }
  const segD=(x,y,a,b)=>{ const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy; let u=l?((x-a[0])*dx+(y-a[1])*dy)/l:0; u=Math.max(0,Math.min(1,u)); return Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy); };
  function hit(x,y,nodesOnly){ let best=null,bd=11; if(nodesOnly){ bd=14; P.forEach((q,i)=>{ if(scanOn&&bld(M.nodes[i].part)) return; const d=Math.hypot(q[0]-x,q[1]-y); if(d<bd){bd=d;best={type:'node',i};} }); return best; }
    PR.forEach((q,i)=>{ const d=Math.hypot(q[0]-x,q[1]-y); if(d<bd){bd=d;best={type:'ref',i};} }); if(best) return best;
    bd=9; P.forEach((q,i)=>{ if(scanOn&&bld(M.nodes[i].part)) return; const d=Math.hypot(q[0]-x,q[1]-y); if(d<bd){bd=d;best={type:'node',i};} }); if(best) return best;
    bd=7; M.els.forEach((e,i)=>{ if(scanOn&&bld(e.part)) return; const d=segD(x,y,P[e.a],P[e.b]); if(d<bd){bd=d;best={type:'el',i};} }); if(best||!scanOn) return best; return cellAt(x,y); }
  /* free handling: drag turns the model about both axes without limits, the wheel zooms at once, Shift or the right button moves it */
  const pts=new Map(); let moved=0, pinch=0, btn=0;
  const pos=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
  const clampZ=z=>Math.max(.15,Math.min(80,z));
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{ try{cv.setPointerCapture(e.pointerId);}catch(_){} pts.set(e.pointerId,pos(e)); moved=0; btn=e.button; cv.style.cursor='grabbing'; if(pts.size===2){ const a=[...pts.values()]; pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]); } });
  cv.addEventListener('pointermove',e=>{ const q=pos(e);
    if(!pts.has(e.pointerId)){ const hh=hit(q[0],q[1]); if(JSON.stringify(hh)!==JSON.stringify(hov)){ hov=hh; cv.style.cursor=hh?'pointer':'grab'; redraw(); } return; }
    const o=pts.get(e.pointerId), dx=q[0]-o[0], dy=q[1]-o[1]; pts.set(e.pointerId,q); moved+=Math.abs(dx)+Math.abs(dy);
    if(pts.size===2){ const a=[...pts.values()], d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]); if(pinch) zoom=clampZ(zoom*d/pinch); pinch=d; }
    else if(e.shiftKey||btn===2||btn===1){ panX+=dx; panY+=dy; } else { yaw+=dx*.009; pitch=tiltLim(pitch+dy*.009); ['m3d','mTop','mSide'].forEach(k=>press(k,false)); if(opt.onView) opt.onView(yaw,pitch); }
    redraw(); });
  const up=e=>{ const had=pts.has(e.pointerId); pts.delete(e.pointerId); pinch=0; cv.style.cursor='grab'; if(had&&moved<5&&btn===0){ const q=pos(e); if(meas){ let pt=null; const hn=hit(q[0],q[1],true); if(hn){ const n=M.nodes[hn.i]; pt={x:n.x,y:n.y,z:n.z,name:'Node '+n.id}; } else if(scanOn){ const c=cellAt(q[0],q[1]); if(c){ const i=c.k%scan.nx, j=(c.k-i)/scan.nx; pt={x:scan.o[0]+(i+.5)*scan.u[0]+(j+.5)*scan.v[0],y:scan.o[1]+(i+.5)*scan.u[1]+(j+.5)*scan.v[1],z:scan.z[c.k],name:'Surface point'}; } } if(pt){ if(mp.length>=2) mp=[]; mp.push(pt); showMeasure(); redraw(); } return; } const hh=hit(q[0],q[1],false); sel=hh; describe(); redraw(); } };
  const mDist=()=>mp.length===2?Math.hypot(mp[1].x-mp[0].x,mp[1].y-mp[0].y,mp[1].z-mp[0].z):null;
  function showMeasure(){ if(!info) return; if(mp.length<2){ info.innerHTML=`<h3 class="blk-h">Measure</h3><b>${mp.length?mp[0].name+' picked':'Pick the first point'}</b><p>Click ${mp.length?'a second':'a'} point: a node of the model${scan?' or a place on the scanned surface':''}.</p>`; return; }
    const A=mp[0],Bn=mp[1],dx=Bn.x-A.x,dy=Bn.y-A.y,dz=Bn.z-A.z,dh=Math.hypot(dx,dy),brg=((Math.atan2(dx,dy)/RAD)%360+360)%360;
    info.innerHTML=`<h3 class="blk-h">Measure</h3><b>${A.name} to ${Bn.name.toLowerCase()}</b>${row('Distance',num(Math.round(Math.hypot(dh,dz)*100)/100)+' m')}${row('Horizontal distance',num(Math.round(dh*100)/100)+' m')}${row('Height difference',(Math.round(dz*100)/100)+' m')}${row('Bearing from north',brg.toFixed(1)+'°')}<p>Measured on the model, so it is as exact as the mapped geometry. Surface points are centres of 1 m cells.</p>`; }
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',e=>{pts.delete(e.pointerId);pinch=0;});
  cv.addEventListener('wheel',e=>{ e.preventDefault(); const q=pos(e), k0=zoom; zoom=clampZ(zoom*Math.exp(-e.deltaY*.0022)); const f=zoom/k0; panX=(q[0]-w/2)-(q[0]-w/2-panX)*f; panY=(q[1]-h/2)-(q[1]-h/2-panY)*f; redraw(); },{passive:false});
  const view=(y,pt,id)=>{ yaw=y; pitch=tiltLim(pt); panX=panY=0; zoom=1; ['m3d','mTop','mSide'].forEach(k=>press(k,k===id)); redraw(); if(opt.onView) opt.onView(yaw,pitch); };
  cv.addEventListener('dblclick',()=>view(HOME.yaw,HOME.pitch,'m3d'));
  cv.addEventListener('keydown',e=>{ const k=e.key; let ok=true; if(k==='ArrowLeft') yaw-=.1; else if(k==='ArrowRight') yaw+=.1; else if(k==='ArrowUp') pitch=tiltLim(pitch+.08); else if(k==='ArrowDown') pitch=tiltLim(pitch-.08); else if(k==='+'||k==='=') zoom=clampZ(zoom*1.25); else if(k==='-') zoom=clampZ(zoom/1.25); else if(k==='Escape'){ sel=null; describe(); } else ok=false; if(ok){ e.preventDefault(); redraw(); if(opt.onView&&/^Arrow/.test(k)) opt.onView(yaw,pitch); } });
  const on=(id,fn)=>{ const el=$(id); if(el) el.onclick=fn; };
  on('m3d',()=>view(HOME.yaw,HOME.pitch,'m3d')); on('mTop',()=>view(0,0,'mTop')); on('mSide',()=>view(0,Math.PI/2,'mSide')); on('mReset',()=>{ sel=null; describe(); view(HOME.yaw,HOME.pitch,'m3d'); });
  if('ResizeObserver' in window) new ResizeObserver(()=>{ if(cv.hidden) return; size(); redraw(); }).observe(cv);
  size(); draw();
  const pip=(x,y,R)=>{ let c=false; for(let i=0,j=R.length-1;i<R.length;j=i++){ const a=R[i], b=R[j]; if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; };
  const api={ wake(){ awake=true; size(); redraw(); }, sleep(){ awake=false; },
    /* S is a file of data/lidar: 1 m cells of measured height inside the outlines, georeferenced by three corners */
    setScan(S){ try{ const g=S.grid, n=g.nx*g.ny, bin=atob(S.z); if(bin.length!==n*2) return false; const z=new Float32Array(n); let zmax=0; for(let k=0;k<n;k++){ const v=bin.charCodeAt(2*k)|(bin.charCodeAt(2*k+1)<<8); z[k]=v===65535?NaN:v/10; if(v!==65535&&v/10>zmax) zmax=v/10; }
        const o=M.xy(g.sw), e=M.xy(g.se), nw=M.xy(g.nw), u=[(e[0]-o[0])/g.nx,(e[1]-o[1])/g.nx], v=[(nw[0]-o[0])/g.ny,(nw[1]-o[1])/g.ny], own=new Int16Array(n).fill(-1);
        const rings=M.parts.map((pt,i)=>pt.kind==='building'?pt.track.map(q=>[M.nodes[q].x,M.nodes[q].y]):null);
        for(let j=0;j<g.ny;j++) for(let i=0;i<g.nx;i++){ const k=j*g.nx+i; if(z[k]!==z[k]) continue; for(const [fa,fb] of [[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){ const px=o[0]+(i+fa)*u[0]+(j+fb)*v[0], py=o[1]+(i+fa)*u[1]+(j+fb)*v[1]; for(let q=0;q<rings.length;q++) if(rings[q]&&pip(px,py,rings[q])){ own[k]=q; break; } if(own[k]>=0) break; } }
        scan={nx:g.nx,ny:g.ny,z,zmax:zmax||1,o,u,v,own,files:S.files||[],source:S.source||'',read:S.read||''}; scanOn=true; redraw(); return true; }catch(_){ return false; } },
    setView(y,pt){ if(Math.abs(y-yaw)<1e-6&&Math.abs(pt-pitch)<1e-6) return; yaw=y; pitch=pt; ['m3d','mTop','mSide'].forEach(k=>press(k,false)); redraw(); },
    scan(on){ if(!scan) return false; scanOn=!!on; if(!scanOn&&sel&&sel.type==='cell'){ sel=null; describe(); } hov=null; redraw(); return scanOn; },
    pickPart(i){ if(M.parts[i]){ sel={type:'part',i}; describe(); redraw(); } }, pickRef(i){ const k=M.refs.findIndex(r=>r.i===i); if(k>=0){ sel={type:'ref',i:k}; describe(); redraw(); } },
    measure(on){ meas=!!on; mp=[]; cv.classList.toggle('measuring',meas); if(meas) showMeasure(); else { sel=null; describe(); } redraw(); },
    csv(){ const L=['node,part,role,latitude,longitude,height_m,distance_along_part_m']; for(const n of M.nodes) L.push([n.id,'"'+M.parts[n.part].name.replace(/"/g,'')+'"',n.role,n.lat.toFixed(7),n.lon.toFixed(7),n.z.toFixed(2),n.ch!=null?n.ch.toFixed(2):''].join(',')); L.push('','element,part,kind,node_a,node_b,length_m'); for(const e of M.els) L.push([e.id,'"'+M.parts[e.part].name.replace(/"/g,'')+'"',e.kind,M.nodes[e.a].id,M.nodes[e.b].id,e.len.toFixed(2)].join(',')); return L.join('\n'); },
    state:()=>({nodes:M.nodes.length,els:M.els.length,parts:M.parts.length,sel,yaw,pitch,zoom,meas,mp,scan:scan?{on:scanOn,cells:scan.z.reduce((a,x)=>a+(x===x?1:0),0),zmax:scan.zmax,owned:scan.own.reduce((a,x)=>a+(x>=0?1:0),0)}:null}), cellAt:(x,y)=>scan?cellAt(x,y):null, screen:(type,i)=>type==='node'?P[i]:type==='ref'?PR[i]:[(P[M.els[i].a][0]+P[M.els[i].b][0])/2,(P[M.els[i].a][1]+P[M.els[i].b][1])/2] };
  window.__fem=api; return api;
}

/* ---------- map view: the structure in its real place on terrain, with satellite. Plain handling: drag, scroll, right button or Ctrl and drag to turn. ---------- */
function initView(p,t,g,lines,labels,opt){
  opt=opt||{}; const box=$('tmap'), fail=m=>{box.outerHTML=`<div class="vfail">${esc(m)}</div>`;const n=document.querySelector('.readout');if(n)n.remove();};
  if(typeof maplibregl==='undefined') return fail('The map could not load. The data sheet is complete without it.');
  const ll=[p.longitude,p.latitude], exact=EXACT(p.position_precision), unc=UNC[p.position_precision];
  const zoom=g?17:p.position_precision==='address'?16.8:p.position_precision==='municipality'?11.8:exact?15.5:13.2;
  let map; try{ map=new maplibregl.Map({container:box,style:STYLE_URL,center:ll,zoom,pitch:55,bearing:-20,maxPitch:85,attributionControl:{compact:true},fadeDuration:0,maxTileCacheSize:600,pixelRatio:Math.min(window.devicePixelRatio||1,2)}); }catch(_){ return fail('The map is not available in this browser. The data sheet is complete without it.'); }
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-right'); window.__map=map; { const paint=()=>{ try{ if(window.iosMap) iosMap(map); }catch(_){} }; map.on('style.load',paint); map.once('load',paint); }
  if('ResizeObserver' in window) new ResizeObserver(()=>{ try{ map.resize(); }catch(e){} }).observe(map.getContainer());
  const anchors=(t&&t.anchors)||[], mid=l=>l[Math.floor(l.length/2)];
  let is3d=true; const B=()=>is3d?-20:0, Pch=()=>is3d?55:0;
  function fit(animate){ const pts=[...lines.flat(),...anchors.map(a=>[+a.lon,+a.lat])];
    if(g&&g.geometry){ (g.parts?g.parts.map(q=>q.ring):(g.geometry.type==='Polygon'?[g.geometry.coordinates[0]]:g.geometry.coordinates.map(q=>q[0]))).forEach(r=>pts.push(...r)); if(g.site) (g.site.rings||[g.site.ring]).forEach(r=>pts.push(...r)); }
    if(pts.length>1){ const b=pts.reduce((bb,c)=>bb.extend(c),new maplibregl.LngLatBounds(pts[0],pts[0])); map.fitBounds(b,{padding:Math.max(18,Math.min(60,Math.round(box.clientWidth*.09))),maxZoom:18.3,pitch:Pch(),bearing:B(),duration:animate?700:0}); }
    else map[animate?'easeTo':'jumpTo']({center:ll,zoom,pitch:Pch(),bearing:B(),duration:700}); }
  const ro=$('readout'), readout=()=>{ if(!ro) return; const c=map.getCenter(); ro.textContent=`WGS 84  ${c.lat.toFixed(5)} N  ${c.lng.toFixed(5)} E  zoom ${map.getZoom().toFixed(1)}  pitch ${map.getPitch().toFixed(0)}°`; };
  let mute=false; map.on('move',()=>{ readout(); if(opt.camera&&!mute) opt.camera(map.getBearing(),map.getPitch()); });
  /* MapLibre 5 can leave the camera at its old height after a programmatic move when terrain tiles arrive later, which puts the view under the ground. Release it. */
  const unfreeze=()=>{ try{ if(map.terrain&&map._elevationFreeze===true){ map._elevationFreeze=false; map.triggerRepaint(); } }catch(_){} };
  map.on('moveend',unfreeze); map.on('sourcedata',e=>{ if(e.sourceId==='dem'&&e.isSourceLoaded) unfreeze(); });
  const hover=id=>{ map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer'); map.on('mouseleave',id,()=>map.getCanvas().style.cursor=''); };
  const highlight=i=>{ try{ if(map.getLayer('ln-sel')){ const f=['==',['get','i'],i==null?-1:i]; map.setFilter('ln-sel',f); map.setFilter('ln-sel-c',f); map.setPaintProperty('ln','line-opacity',i==null?1:.45); } if(map.getLayer('bld')) map.setPaintProperty('bld','fill-extrusion-color',['case',['==',['get','i'],i==null?-1:i],'#3D8BF2',GLASS]); }catch(_){} };
  const GLASS='#8EC2FA';
  const pick=(type,i)=>{ if(type==='part') highlight(i); if(opt.select) opt.select(type,i); };
  map.on('load',()=>{
    try{ if(lines.length||!(g&&g.geometry)){ map.addSource('dem',{type:'raster-dem',tiles:[DEM_URL],tileSize:256,maxzoom:15,encoding:'terrarium',attribution:'Terrain: Mapzen, AWS Terrain Tiles'}); map.setTerrain({source:'dem',exaggeration:1}); } }catch(_){}
    const firstSym=(map.getStyle().layers.find(l=>l.type==='symbol')||{}).id;
    try{ map.addSource('sat',{type:'raster',tiles:[SAT_URL],tileSize:256,maxzoom:19,attribution:'Imagery: Esri, Maxar, Earthstar Geographics'}); map.addLayer({id:'sat',type:'raster',source:'sat',layout:{visibility:'none'}},firstSym); }catch(_){}
    if(unc&&!lines.length){ map.addSource('unc',{type:'geojson',data:{type:'Feature',properties:{},geometry:circle(ll,unc)}});
      map.addLayer({id:'unc-f',type:'fill',source:'unc',paint:{'fill-color':'#FF9500','fill-opacity':.12}}); map.addLayer({id:'unc-l',type:'line',source:'unc',paint:{'line-color':'#C76A00','line-width':1.5,'line-dasharray':[3,3]}}); }
    if(g&&g.geometry){ map.addSource('bld',{type:'geojson',data:g.parts?{type:'FeatureCollection',features:g.parts.map((q,k)=>({type:'Feature',properties:{i:lines.length+k,h:q.h!=null?q.h:q.scan?q.scan.median_m:q.levels*(g.storey_m||3)},geometry:{type:'Polygon',coordinates:[q.ring]}}))}:{type:'Feature',properties:{i:lines.length,h:g.height_m||0.5},geometry:g.geometry}});
      map.addLayer({id:'bld-edge',type:'line',source:'bld',paint:{'line-color':'#5B9BE6','line-width':1.4}});
      map.addLayer({id:'bld',type:'fill-extrusion',source:'bld',paint:{'fill-extrusion-color':GLASS,'fill-extrusion-height':['get','h'],'fill-extrusion-opacity':.56,'fill-extrusion-vertical-gradient':true}});
      map.on('click','bld',e=>pick('part',e.features[0].properties.i)); hover('bld');
      if(g.site){ map.addSource('site',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'MultiPolygon',coordinates:(g.site.rings||[g.site.ring]).map(r=>[r])}}}); map.addLayer({id:'site-f',type:'fill',source:'site',paint:{'fill-color':'#0A66D8','fill-opacity':.08}},'bld-edge'); map.addLayer({id:'site-l',type:'line',source:'site',paint:{'line-color':'#0A66D8','line-width':1,'line-opacity':.6}},'bld-edge'); if(g.site.excluded){ const X=g.site.excluded; map.addSource('site-x',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:[...(X.rings||[]),...(X.buildings||[]).map(q=>q.ring)]}}}); map.addLayer({id:'site-x',type:'line',source:'site-x',paint:{'line-color':'#8A94A6','line-width':1,'line-dasharray':[3,3]}},'bld-edge'); } } }
    const ownR=g&&g.geometry?(g.parts?g.parts.map(q=>q.ring):(g.geometry.type==='Polygon'?[g.geometry.coordinates[0]]:g.geometry.coordinates.map(q=>q[0]))):[], ownN=new Set(g&&g.parts?g.parts.filter(q=>q.kn!=null).map(q=>q.kn):[]);
    const mine=f=>f.rings.some(rg=>{ const c=[rg.reduce((a,v)=>a+v[0],0)/rg.length,rg.reduce((a,v)=>a+v[1],0)/rg.length]; return ownR.some(r=>ptIn(c,r)); })||(ownN.has(f.q.ST_STAVBE)&&f.rings.some(rg=>ownR.some(r=>ptIn(rg[0],r)||ptIn(r[0],rg))));
    const addCtx=ctx0=>{ try{ const ctx=ctx0.filter(f=>!mine(f)), fc={type:'FeatureCollection',features:ctx.flatMap(f=>f.rings.map(rg=>({type:'Feature',properties:{h:f.h!=null?f.h:0.5},geometry:{type:'Polygon',coordinates:[rg]}})))}; for(const l of map.getStyle().layers) if(l.type==='fill-extrusion'&&l.source!=='bld'&&l.source!=='ctx') map.setLayoutProperty(l.id,'visibility','none'); if(map.getSource('ctx')) map.getSource('ctx').setData(fc); else { map.addSource('ctx',{type:'geojson',data:fc}); map.addLayer({id:'ctx',type:'fill-extrusion',source:'ctx',paint:{'fill-extrusion-color':'#D5DAE3','fill-extrusion-height':['get','h'],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}},map.getLayer('bld-edge')?'bld-edge':map.getLayer('bld')?'bld':undefined); } }catch(_){} };
    if(KN_CTX[p.id]) addCtx(KN_CTX[p.id]); document.addEventListener('kn-ready',e=>{ if(e.detail===p.id&&KN_CTX[p.id]) addCtx(KN_CTX[p.id]); });
    if(lines.length){ map.addSource('ln',{type:'geojson',data:{type:'FeatureCollection',features:lines.map((l,i)=>({type:'Feature',properties:{i},geometry:{type:'LineString',coordinates:l}}))}});
      const lay={'line-cap':'round','line-join':'round'};
      map.addLayer({id:'ln-c',type:'line',source:'ln',layout:lay,paint:{'line-color':'#ffffff','line-width':9}});
      map.addLayer({id:'ln',type:'line',source:'ln',layout:lay,paint:{'line-color':'#203469','line-width':5}});
      map.addLayer({id:'ln-sel-c',type:'line',source:'ln',layout:lay,filter:['==',['get','i'],-1],paint:{'line-color':'#ffffff','line-width':13}});
      map.addLayer({id:'ln-sel',type:'line',source:'ln',layout:lay,filter:['==',['get','i'],-1],paint:{'line-color':'#0A66D8','line-width':7}});
      map.on('click','ln-c',e=>pick('part',e.features[0].properties.i)); hover('ln-c'); }
    if(anchors.length){ map.addSource('an',{type:'geojson',data:{type:'FeatureCollection',features:anchors.map((a,i)=>({type:'Feature',properties:{i},geometry:{type:'Point',coordinates:[+a.lon,+a.lat]}}))}});
      map.addLayer({id:'an',type:'circle',source:'an',paint:{'circle-radius':5.5,'circle-color':'#FFFFFF','circle-stroke-color':'#5856D6','circle-stroke-width':2.5}});
      map.on('click','an',e=>pick('ref',e.features[0].properties.i)); hover('an'); }
    if(!lines.length&&!(g&&g.geometry)&&(exact||p.position_precision==='user')){ const el=document.createElement('div'); el.className='beacon'; new maplibregl.Marker({element:el}).setLngLat(ll).addTo(map); }
    fit(false); readout(); unfreeze();
  });
  const set=(id,on)=>{ const b=$(id); if(b) b.setAttribute('aria-pressed',on?'true':'false'); };
  const setSat=on=>{ try{map.setLayoutProperty('sat','visibility',on?'visible':'none');}catch(_){} try{ if(map.getLayer('bld')) map.setPaintProperty('bld','fill-extrusion-opacity',on?.45:.56); }catch(_){} set('vMap',!on); set('vSat',on); };
  const tilt=on=>{ is3d=on; set('v3d',on); set('v2d',!on); map.easeTo({pitch:Pch(),bearing:B(),duration:500}); };
  const bind=(id,fn)=>{ const b=$(id); if(b) b.onclick=fn; };
  bind('vMap',()=>setSat(false)); bind('vSat',()=>setSat(true)); bind('v3d',()=>tilt(true)); bind('v2d',()=>tilt(false)); bind('vReset',()=>{ highlight(null); fit(true); });
  return {highlight, setCamera:(b,pt)=>{ mute=true; try{ map.jumpTo({center:map.getCenter(),zoom:map.getZoom(),bearing:b,pitch:Math.max(0,Math.min(85,pt))}); }catch(_){} mute=false; }, resize:()=>map.resize(), focusLine:i=>{ if(lines[i]){ highlight(i); map.easeTo({center:mid(lines[i]),duration:600}); } }, focusAnchor:i=>{ const a=anchors[i]; if(a) map.easeTo({center:[+a.lon,+a.lat],zoom:Math.max(map.getZoom(),16),duration:600}); }};
}

/* ---------- platform home: all objects with counts, a type filter and a text filter ---------- */

/* ---------- live cadastre: the official building record at the point, read from the GURS service when the page opens ---------- */
const KN_URL='https://ipi.eprostor.gov.si/wfs-si-gurs-kn/ogc/features/collections/SI.GURS.KN:STAVBE/items';
const ptIn=(pt,r)=>{ let c=false; for(let i=0,j=r.length-1;i<r.length;j=i++){ const [x1,y1]=r[i],[x2,y2]=r[j]; if((y1>pt[1])!==(y2>pt[1])&&pt[0]<(x2-x1)*(pt[1]-y1)/(y2-y1)+x1) c=!c; } return c; };
const KN_CTX={};
async function liveCadastre(p){ const box=$('kn'); if(!box) return; const lo=p.longitude, la=p.latitude; box.innerHTML='<p class="note" style="padding:8px 18px 0">Asking the GURS cadastre for the current record</p>';
  try{ const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),25000); const bb=`${(lo-0.003).toFixed(6)},${(la-0.002).toFixed(6)},${(lo+0.003).toFixed(6)},${(la+0.002).toFixed(6)}`, feats=[]; for(let off=0;off<200;off+=50){ const r=await fetch(`${KN_URL}?f=json&limit=50&offset=${off}&bbox=${bb}`,{signal:ctl.signal}); if(!r.ok){ if(!off) throw new Error('status '+r.status); break; } const jj=await r.json(); feats.push(...(jj.features||[])); if((jj.features||[]).length<50) break; await new Promise(z=>setTimeout(z,250)); } clearTimeout(tm);
    const j={features:feats}, fs=(j.features||[]).map(f=>{ const g=f.properties.TLORIS_GEOM||f.geometry, rings=g?(g.type==='Polygon'?[g.coordinates[0]]:g.type==='MultiPolygon'?g.coordinates.map(q=>q[0]):[]):[]; const q=f.properties, gl=q.VISINA_H3!=null?q.VISINA_H3:q.VISINA_H1, h=gl!=null&&q.VISINA_H2!=null&&q.VISINA_H2>gl?q.VISINA_H2-gl:null; return {q,rings,h}; }).filter(f=>f.rings.length);
    const at=fs.find(f=>f.rings.some(rg=>ptIn([lo,la],rg))), today=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
    const rows=at?[['Cadastral community',at.q.NAZIV],['Building number',at.q.ST_STAVBE],['Storeys, below and above ground',at.q.STEVILO_ETAZ],['Year built',at.q.LETO_IZGRADNJE],['Lowest height, floor of the first storey (H1)',at.q.VISINA_H1!=null?at.q.VISINA_H1+' m above sea level':null],['Highest height, top of roof or wall (H2)',at.q.VISINA_H2!=null?at.q.VISINA_H2+' m above sea level':null],['Characteristic height, terrain at the main entrance (H3)',at.q.VISINA_H3!=null?at.q.VISINA_H3+' m above sea level':null],['Highest point above the terrain at the entrance (H2 minus H3)',at.h!=null?at.h.toFixed(1)+' m':null],['Type',at.q.TIPI_STAVB_NAZIV_SL],['Structure',at.q.NOSILNE_KONSTRUKCIJE_NAZIV_SL],['Position accuracy',at.q.POLOZAJNE_NATANCNOSTI_STAVBE_NAZIV_SL]].filter(a=>a[1]!=null&&a[1]!==''):[];
    const gb=(D.gurs||{})[p.id]||{}, noAt='<tr><td class="l" colspan="2">'+(gb.parts&&gb.parts[0]&&gb.parts[0].kn!=null?'The stored point marks the site and lies between its buildings. The buildings are listed in the table above.':'No cadastre building contains the stored point.')+'</td></tr>';
    box.innerHTML=`<div class="tscroll" style="margin-top:10px"><table><thead><tr><th>Cadastre record at the point, read live</th><th>Value</th></tr></thead><tbody>${rows.length?rows.map(([a,b])=>`<tr><td class="l">${esc(a)}</td><td class="v">${T(String(b))}</td></tr>`).join(''):noAt}</tbody></table></div><p class="note" style="padding:8px 18px 0">GURS Kataster nepremičnin, read on ${today}. ${fs.length} cadastre buildings within about 230 m of the point are drawn on the site map at their recorded heights. They replace the 3D buildings of the base map there. Licence CC BY 4.0. The cadastre gives the total number of storeys only, so the number above ground is not known from it.</p>`;
    KN_CTX[p.id]=fs; document.dispatchEvent(new CustomEvent('kn-ready',{detail:p.id}));
  }catch(e){ box.innerHTML='<p class="note" style="padding:8px 18px 0">The GURS cadastre service did not answer, so no live record is shown.</p>'; } }

/* ---------- ground profile along the drawn alignment ----------
   Heights are read from the same public terrain tiles the map uses (terrarium encoding), one tile zoom for the whole line. */
const PROF_Z=13, TILE_CACHE={};
function demTile(x,y){ const k=x+'/'+y; if(!TILE_CACHE[k]) TILE_CACHE[k]=new Promise(res=>{ const im=new Image(); im.crossOrigin='anonymous';
    im.onload=()=>{ try{ const c=document.createElement('canvas'); c.width=c.height=256; const cx=c.getContext('2d',{willReadFrequently:true}); cx.drawImage(im,0,0,256,256); res(cx.getImageData(0,0,256,256).data); }catch(_){ res(null); } };
    im.onerror=()=>res(null); im.src=DEM_URL.replace('{z}',PROF_Z).replace('{x}',x).replace('{y}',y); }); return TILE_CACHE[k]; }
async function groundAt(lon,lat){ const n=Math.pow(2,PROF_Z), fx=(lon+180)/360*n, sl=Math.sin(lat*RAD), fy=(.5-Math.log((1+sl)/(1-sl))/(4*Math.PI))*n, tx=Math.floor(fx), ty=Math.floor(fy);
  const d=await demTile(tx,ty); if(!d) return null; const px=Math.min(255,Math.floor((fx-tx)*256)), py=Math.min(255,Math.floor((fy-ty)*256)), i=(py*256+px)*4; return d[i]*256+d[i+1]+d[i+2]/256-32768; }
async function drawProfiles(lines,labels){ const box=$('prof'); if(!box) return; const out=[];
  for(let li=0;li<lines.length;li++){ const l=lines[li], cum=[0]; for(let k=1;k<l.length;k++) cum.push(cum[k-1]+meters(l[k-1],l[k])); const L=cum[cum.length-1]; if(!(L>0)) continue;
    const n=Math.max(30,Math.min(160,Math.round(L/15))), pts=[];
    for(let k=0;k<=n;k++){ const d=L*k/n; let j=1; while(j<cum.length-1&&cum[j]<d) j++; const u=(d-cum[j-1])/((cum[j]-cum[j-1])||1), lon=l[j-1][0]+(l[j][0]-l[j-1][0])*u, lat=l[j-1][1]+(l[j][1]-l[j-1][1])*u, h=await groundAt(lon,lat); if(h==null){ pts.length=0; break; } pts.push([d,h]); }
    if(pts.length) out.push({name:labels[li]||(lines.length>1?'Part '+(li+1):'Alignment'),L,pts}); }
  if(!out.length){ box.innerHTML='<p class="note" style="padding:8px 18px 0">The ground profile could not be read from the terrain tiles.</p>'; return; }
  const W=360,H=110,pl=40,pr=8,pt=8,pb=20;
  box.innerHTML='<h4 class="prof-h">Ground profile along the alignment</h4>'+out.map((o,qi)=>{ const hs=o.pts.map(q=>q[1]), lo=Math.min(...hs), hi=Math.max(...hs), sp=Math.max(1,hi-lo), X=d=>pl+(W-pl-pr)*d/o.L, Y=h=>pt+(H-pt-pb)*(1-(h-lo)/sp);
    const path=o.pts.map((q,k)=>(k?'L':'M')+X(q[0]).toFixed(1)+' '+Y(q[1]).toFixed(1)).join(' ');
    return `<figure class="prof-f" data-q="${qi}"><figcaption>${T(o.name)}${/\d\s*m\b/.test(o.name)?'':', '+num(Math.round(o.L))+' m'}, ground from ${num(Math.round(lo))} to ${num(Math.round(hi))} m above sea level</figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ground profile of ${esc(o.name)}"><path d="${path} L${X(o.L).toFixed(1)} ${H-pb} L${pl} ${H-pb} Z" fill="rgba(10,102,216,.10)"/><path d="${path}" fill="none" stroke="#0A66D8" stroke-width="1.6"/>
      <line x1="${pl}" y1="${H-pb}" x2="${W-pr}" y2="${H-pb}" stroke="#C7CCD6"/><text x="${pl-4}" y="${pt+4}" text-anchor="end">${Math.round(hi)} m</text><text x="${pl-4}" y="${H-pb}" text-anchor="end">${Math.round(lo)} m</text><text x="${pl}" y="${H-5}">0</text><text x="${W-pr}" y="${H-5}" text-anchor="end">${num(Math.round(o.L))} m</text>
      <line class="cur" x1="0" y1="${pt}" x2="0" y2="${H-pb}" stroke="#203469" stroke-dasharray="3 3" visibility="hidden"/></svg><p class="prof-r" aria-live="polite">Move over the chart for the level at a point.</p></figure>`; }).join('')
    +`<p class="note" style="padding:6px 18px 0">Terrain surface from the Mapzen terrain tiles, read about every ${Math.round(156543*Math.cos(lines[0][0][1]*RAD)/Math.pow(2,PROF_Z))} m. It is the ground, not the deck level or the tunnel floor.</p>`;
  box.querySelectorAll('.prof-f').forEach(f=>{ const o=out[+f.dataset.q], svg=f.querySelector('svg'), cur=f.querySelector('.cur'), r=f.querySelector('.prof-r');
    const mv=e=>{ const b=svg.getBoundingClientRect(), x=((e.touches?e.touches[0].clientX:e.clientX)-b.left)/b.width*W, d=Math.max(0,Math.min(o.L,(x-pl)/(W-pl-pr)*o.L)), k=Math.round(d/o.L*(o.pts.length-1)), q=o.pts[k]; const cx=pl+(W-pl-pr)*q[0]/o.L; cur.setAttribute('x1',cx); cur.setAttribute('x2',cx); cur.setAttribute('visibility','visible'); r.textContent=`At ${num(Math.round(q[0]))} m along the part the ground is at ${num(Math.round(q[1]))} m above sea level.`; };
    svg.addEventListener('mousemove',mv); svg.addEventListener('touchmove',mv,{passive:true}); });
}
function renderIndex(){
  document.title='Assets, ZAG Digital Atlas';
  const groups={}; for(const f of D.features){const k=f.properties.object_type||'other';(groups[k]=groups[k]||[]).push(f.properties);}
  const order=[...GROUP_ORDER.filter(k=>groups[k]),...Object.keys(groups).filter(k=>!GROUP_ORDER.includes(k))];
  const hasGeo=p=>!!(p.lines||p.line||D.gurs[p.id]);
  const nGeo=D.features.filter(f=>hasGeo(f.properties)).length, nExact=D.features.filter(f=>EXACT(f.properties.position_precision)).length;
  const nSpec=Object.values(D.twins).reduce((a,t)=>a+((t.specs||[]).length),0), nNews=Object.keys(D.news).filter(k=>(D.news[k]||[]).length).length;
  const host=u=>{ try{ return new URL(u).host.replace(/^www\./,''); }catch(_){ return ''; } };
  const FACTS={}; for(const f of D.features){ const p=f.properties, t=D.twins[p.id]||{}; FACTS[p.id]=[...(t.specs||[]).map(s=>[s.label+': '+s.value+(s.unit?' '+s.unit:''),(s.label+' '+s.value+' '+(s.unit||'')+' '+host(s.source)+' '+(s.quote||'')).toLowerCase()]),...(t.differences||[]).map(x=>[x,x.toLowerCase()]),...(t.summary?[[t.summary,String(t.summary).toLowerCase()]]:[])]; }
  const nameOf=p=>(p.name_en+' '+(p.name_sl||'')+' '+(p.locality||'')+' '+(p.municipality||'')).toLowerCase();
  const factHit=(p,qq)=>{ const w=qq.split(/\s+/).filter(Boolean); return (FACTS[p.id]||[]).find(f=>w.every(x=>f[1].includes(x)))||null; };
  const matches=(p,qq)=>!qq||qq.split(/\s+/).filter(Boolean).every(x=>nameOf(p).includes(x))||!!factHit(p,qq);
  const card=p=>{const t=D.twins[p.id],n=t?(t.specs||[]).length:0;
    return `<a class="obj" href="twin.html?id=${encodeURIComponent(p.id)}" data-g="${esc(p.object_type||'other')}" data-id="${esc(p.id)}"><b>${T(p.name_en||p.name)}</b><span>${T(p.locality||p.municipality||'')}</span><small class="hit" hidden></small>
      <div class="tags">${n?`<span class="tag">${n} ${n===1?'specification':'specifications'}</span>`:''}${hasGeo(p)?'<span class="tag ok">3D geometry</span>':''}${EXACT(p.position_precision)?'':'<span class="tag warn">approximate position</span>'}</div></a>`;};
  const COLS=[['Name',p=>p.name_en||p.name],['Type',p=>GROUP_NAME[p.object_type]||cap(p.object_type||'other')],['Place',p=>p.locality||p.municipality||''],['ZAG work',p=>String(p.year||'').replace(/^(\d{4})-(\d{4})$/,'$1 to $2').replace(/^(\d{4})-$/,'since $1')],['Built',p=>p.built||''],['Position',p=>EXACT(p.position_precision)?'exact':'approximate'],['Sourced values',p=>{const t=D.twins[p.id];return t?(t.specs||[]).filter(x=>x.source).length:0;}]];
  $('main').innerHTML=`<div class="wrap home"><h1>Assets</h1><p class="lead">Structures and sites where ZAG has documented work. Each opens its own sheet with a 3D view, key figures and specifications with sources.</p>
    <section class="dims" aria-label="Platform figures">
      <div class="dim"><div class="v">${D.features.length}</div><div class="k">objects</div></div>
      <div class="dim"><div class="v">${nGeo}</div><div class="k">with 3D geometry</div></div>
      <div class="dim"><div class="v">${nExact}</div><div class="k">placed exactly</div></div>
      <div class="dim"><div class="v">${num(nSpec)}</div><div class="k">facts and figures, each with its source</div></div>
      <div class="dim"><div class="v">${nNews}</div><div class="k">with recent news</div></div>
    </section>
    <div class="filters"><input class="find" id="find" type="search" placeholder="Search names, places, values, sources and quotes" aria-label="Search names, places, values, sources and quotes">
      <div class="pills" role="group" aria-label="Type"><button class="pill" type="button" data-g="" aria-pressed="true">All</button>${order.map(k=>`<button class="pill" type="button" data-g="${esc(k)}" aria-pressed="false">${esc(GROUP_NAME[k]||cap(k))} <i>${groups[k].length}</i></button>`).join('')}</div></div>
    <div class="viewbar"><div class="seg" role="group" aria-label="View"><button type="button" id="vwCards" aria-pressed="true">Cards</button><button type="button" id="vwTable" aria-pressed="false">Table</button></div><span style="display:flex;gap:8px;flex-wrap:wrap"><a class="tbtn" href="questions.html" style="display:inline-flex;align-items:center;text-decoration:none">Open questions</a><button type="button" class="tbtn" id="csvAll">Download table as CSV</button></span></div>
    <p class="note" id="count" aria-live="polite"></p>
    <div class="tscroll regwrap" id="regwrap" hidden><table class="reg" id="reg"><thead><tr>${COLS.map((c,i)=>`<th><button type="button" data-col="${i}">${c[0]}</button></th>`).join('')}</tr></thead><tbody></tbody></table></div>
    ${order.map(k=>`<section class="grp" data-g="${esc(k)}"><h3>${esc(GROUP_NAME[k]||cap(k))}</h3><div class="grid">${groups[k].map(card).join('')}</div></section>`).join('')}</div>`;
  let grp='', q='', sortC=0, sortD=1, view='cards';
  const rowsNow=()=>D.features.map(f=>f.properties).filter(p=>(!grp||(p.object_type||'other')===grp)&&matches(p,q)).sort((a,b)=>{ const x=COLS[sortC][1](a), y=COLS[sortC][1](b); return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'sl',{numeric:true}))*sortD; });
  const drawTable=()=>{ $('reg').querySelector('tbody').innerHTML=rowsNow().map(p=>`<tr>${COLS.map((c,i)=>i?`<td>${T(String(c[1](p)))}</td>`:`<td class="l"><a href="twin.html?id=${encodeURIComponent(p.id)}">${T(c[1](p))}</a></td>`).join('')}</tr>`).join(''); $('reg').querySelectorAll('th button').forEach(b=>b.setAttribute('aria-sort',+b.dataset.col===sortC?(sortD>0?'ascending':'descending'):'none')); };
  const setView=v=>{ view=v; $('vwCards').setAttribute('aria-pressed',v==='cards'?'true':'false'); $('vwTable').setAttribute('aria-pressed',v==='table'?'true':'false'); $('regwrap').hidden=v!=='table'; document.querySelectorAll('.grp').forEach(s=>s.style.display=v==='table'?'none':''); if(v==='table') drawTable(); };
  const apply=()=>{ let n=0; document.querySelectorAll('.obj').forEach(a=>{ const p=D.byId[a.dataset.id].properties, ok=(!grp||a.dataset.g===grp)&&matches(p,q); a.hidden=!ok; if(ok) n++; const h=a.querySelector('.hit'), fh=ok&&q&&!q.split(/\s+/).filter(Boolean).every(x=>nameOf(p).includes(x))?factHit(p,q):null; h.hidden=!fh; h.innerHTML=fh?'<b>Found in:</b> '+T(fh[0].length>150?fh[0].slice(0,150)+' ...':fh[0]):''; });
    document.querySelectorAll('.grp').forEach(s=>s.hidden=!s.querySelector('.obj:not([hidden])')); $('count').textContent=(grp||q)?`${n} of ${D.features.length} objects shown`:''; };
  $('find').oninput=e=>{ q=e.target.value.trim().toLowerCase(); apply(); if(view==='table') drawTable(); };
  $('vwCards').onclick=()=>setView('cards'); $('vwTable').onclick=()=>setView('table');
  $('reg').querySelectorAll('th button').forEach(b=>b.onclick=()=>{ const c=+b.dataset.col; if(c===sortC) sortD=-sortD; else { sortC=c; sortD=1; } drawTable(); });
  $('csvAll').onclick=()=>{ const cell=v=>'"'+String(v).replace(/"/g,'""')+'"', txt=[COLS.map(c=>cell(c[0])).concat(['"Latitude"','"Longitude"','"ID"']).join(',')].concat(rowsNow().map(p=>COLS.map(c=>cell(c[1](p))).concat([p.latitude,p.longitude,cell(p.id)]).join(','))).join('\r\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+txt],{type:'text/csv'})); a.download='zag_atlas_objects.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); };
  document.querySelectorAll('.pill').forEach(b=>b.onclick=()=>{ grp=b.dataset.g; document.querySelectorAll('.pill').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false')); apply(); if(view==='table') drawTable(); });
}

if(new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');
if(!window.TWIN_NO_BOOT) (async()=>{
  try{ await load(); }catch(e){ $('main').innerHTML=`<p class="loading">${esc(e.message)}</p>`; return; }
  const id=new URLSearchParams(location.search).get('id')||location.hash.slice(1), f=id&&D.byId[id];
  if(id&&!f){ $('main').innerHTML=`<div class="wrap"><p>No object with the id "${esc(id)}". <a href="twin.html">See all objects</a>.</p></div>`; return; }
  const jl=$('jumplist'), ji=$('jump'); if(jl&&ji){ const names=D.features.map(x=>[x.properties.name_en||x.properties.name,x.properties.id]); jl.innerHTML=names.map(n=>`<option value="${esc(n[0])}">`).join('');
    ji.onchange=()=>{ const q=ji.value.trim().toLowerCase(), hit=names.find(n=>n[0].toLowerCase()===q)||names.find(n=>n[0].toLowerCase().includes(q)); if(q&&hit) location.href='twin.html?id='+encodeURIComponent(hit[1]); }; }
  if(f){ if(!document.body.classList.contains('embed')) document.body.classList.add('wsbody'); renderTwin(f); } else renderIndex();
})();
