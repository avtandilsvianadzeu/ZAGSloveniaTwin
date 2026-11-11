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
const GROUP_ORDER=['bridge','footbridge','road structure','tunnel','dam / hydropower','cableway','tower / mast','building','institution','landslide','geotechnical site','study area (earthquake)','other'];
const GROUP_NAME={bridge:'Bridges and viaducts',footbridge:'Footbridges','road structure':'Road structures',tunnel:'Tunnels','dam / hydropower':'Dams and hydropower plants',cableway:'Cableways','tower / mast':'Towers and masts',
  building:'Buildings',institution:'Institutions',landslide:'Landslides','geotechnical site':'Geotechnical sites','study area (earthquake)':'Earthquake study areas',other:'Other sites'};

const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* house style for visible text: no en or em dashes, no semicolons, no middle dots */
const clean=s=>String(s==null?'':s).replace(/\s*—\s*/g,', ').replace(/(\d)\s*–\s*(\d)/g,'$1 to $2').replace(/–/g,'-').replace(/\s*;\s*/g,', ').replace(/\s+·\s+/g,', ').replace(/~(?=\d)/g,'about ').replace(/→/g,' to ');
const T=s=>esc(clean(s));
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):'';
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch(_){return u;}};
const link=(u,t)=>u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t||host(u))}</a>`:'';
const fmtDate=d=>{try{return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}catch(_){return String(d).slice(0,10);}};
const num=n=>Number(n).toLocaleString('en-GB');
const RAD=Math.PI/180, R=6371008.8;
const meters=(a,b)=>{const x=(b[0]-a[0])*RAD*Math.cos((a[1]+b[1])/2*RAD),y=(b[1]-a[1])*RAD;return Math.hypot(x,y)*R;};
const lineLen=l=>l.reduce((s,c,i)=>i?s+meters(l[i-1],c):0,0);
function circle(c,m,n){n=n||72;const out=[];for(let i=0;i<=n;i++){const a=i/n*2*Math.PI;out.push([c[0]+m*Math.cos(a)/(R*Math.cos(c[1]*RAD))/RAD,c[1]+m*Math.sin(a)/R/RAD]);}return {type:'Polygon',coordinates:[out]};}

const D={features:[],byId:{},twins:{},gurs:{},gursMeta:null,news:{},newsUpdated:null,images:{}};
async function getJSON(u){try{const r=await fetch(u);return r.ok?await r.json():null;}catch(_){return null;}}
async function load(){
  const g=await getJSON('data/zag_projects.geojson'); if(!g) throw new Error('The atlas data did not load.');
  D.features=g.features; D.byId=Object.fromEntries(g.features.map(f=>[f.properties.id,f]));
  const [tw,gu,nw,im]=await Promise.all([getJSON('data/twins.json'),getJSON('data/gurs_buildings.json'),getJSON('data/news.json'),getJSON('data/images.json')]);
  if(tw) D.twins=tw.objects||{}; if(gu){D.gurs=gu.buildings||{};D.gursMeta=gu.meta||null;} if(nw){D.news=nw.items||{};D.newsUpdated=nw.updated||null;} if(im) D.images=im;
  adoptUser((await getJSON('data/user_objects.json')||{}).features,'published'); adoptUser(localUser().features,'this browser');
}
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
  for(const s of (t&&t.specs)||[]){ const v=clean(s.value); if(!v||v.length>20||!s.source) continue;
    for(const [cls,re] of FIG_RULES) if(re.test(s.label)){ add(cls,s.label,v,s.unit,s.source); break; } }
  if(g){ if(g.height_m!=null) add('height','Height above ground',g.height_m.toFixed(1),'m',g.user?'#specs':'https://ipi.eprostor.gov.si/jgp/data',g.user?'entered by the user':'GURS');
         if(g.area_m2) add('area','Footprint area',num(g.area_m2),'m²',g.user?'#specs':'https://ipi.eprostor.gov.si/jgp/data',g.user?'entered by the user':'GURS'); }
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
  const kind=p.category==='zag_facility'?'ZAG facility':p.category==='partner'?'Partner institution':p.category==='user_object'?'Object added by a user':'ZAG project';
  const where=[p.locality&&p.locality!==p.name_en?p.locality:p.municipality].filter(Boolean).join(', ');
  const exact=EXACT(p.position_precision);
  const im=D.images[id], hero=p.image?{src:p.image,credit:p.image_credit?'Photo: '+p.image_credit:null}:im?{src:im.url,credit:`Photo: ${im.author||'unknown author'}, ${im.licence}, via Wikimedia Commons`}:null;
  const figs=keyFigures(p,t,g,lines);
  const inv=(p.zag_involvement_types||[]).map(x=>INV_LABEL[x]||cap(x));
  const S=p.structure||{}, sRows=[['Crosses',S.crosses],['Carries',S.carries],['Structure',S.typ],['Built',S.built],['Spans',S.spans],['Length',S.length_m&&num(S.length_m)+' m']].filter(a=>a[1]);
  const news=D.news[id]||[], fresh=d=>Date.now()-Date.parse(d)<7*864e5;
  const coord=`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;
  const secs=[];
  const OPEN=new Set(['about','zag','specs','geometry','check']);
  const sec=(sid,title,html)=>{ if(html) secs.push({sid,title,html:`<details class="sec" id="${sid}"${OPEN.has(sid)?' open':''}><summary><h2>${esc(title)}</h2><span class="chev" aria-hidden="true"></span></summary>${html}</details>`}); };

  sec('about','About',(p.description||t&&t.summary)?`<div class="in">${p.description?`<p>${T(p.description)}</p>`:''}${t&&t.summary?`<p class="muted">${T(t.summary)}</p>`:''}</div>`:'');
  sec('zag','ZAG involvement',!(p.zag_role||inv.length||p.year||(p.people||[]).length||(p.partners||[]).length)?'':`<div class="in">${p.zag_role?`<p>${T(p.zag_role)}</p>`:''}${inv.length?`<div class="tags">${inv.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>`:''}
    ${p.year?`<h3>Years</h3><p>${T(p.year)}</p>`:''}${(p.people||[]).length?`<h3>Named in the sources</h3><ul>${p.people.map(x=>`<li>${T(x)}</li>`).join('')}</ul>`:''}
    ${(p.partners||[]).length?`<h3>Partners and clients</h3><ul>${p.partners.map(x=>`<li>${T(x)}</li>`).join('')}</ul>`:''}</div>`);
  sec('specs','Specifications',(t&&(t.specs||[]).length)?`<div class="tscroll"><table><thead><tr><th>Property</th><th>Value</th><th>Source</th></tr></thead><tbody>${t.specs.map(s=>`<tr><td class="l">${T(s.label)}</td><td class="v">${T(s.value)}${s.unit?' '+esc(s.unit):''}</td><td class="s">${s.source?link(s.source):(p.category==='user_object'?'<span class="muted">entered by the user</span>':'<span class="muted">from the record</span>')}</td></tr>`).join('')}</tbody></table></div>`:'');
  const geo=[];
  if(lines.length) geo.push(`<div class="tscroll"><table><thead><tr><th>Drawn part</th><th>Length on the map</th><th>Points</th></tr></thead><tbody>${lines.map((l,i)=>`<tr class="pick" data-line="${i}" tabindex="0" title="Show on the 3D view"><td class="l">${T(labels[i]||(lines.length>1?'Part '+(i+1):'Alignment'))}</td><td class="v">${num(Math.round(lineLen(l)))} m</td><td class="n">${l.length}</td></tr>`).join('')}</tbody></table></div><p class="note" style="padding:8px 18px 0">Lengths are measured along the drawn line and can differ from surveyed lengths.</p>`);
  if(t&&(t.anchors||[]).length) geo.push(`<div class="tscroll"><table><thead><tr><th>Reference point</th><th>Latitude, longitude</th><th>Source</th></tr></thead><tbody>${t.anchors.map((a,i)=>`<tr class="pick" data-anchor="${i}" tabindex="0" title="Show on the 3D view"><td class="l">${T(a.label)}</td><td class="n">${(+a.lat).toFixed(6)}, ${(+a.lon).toFixed(6)}</td><td class="s">${a.source?link(a.source):''}</td></tr>`).join('')}</tbody></table></div>`);
  if(g){ const M=D.gursMeta, rows=[['Height above ground',g.height_m!=null?g.height_m.toFixed(1)+' m':null],['Footprint area',g.area_m2?num(g.area_m2)+' m²':null],['Ground level',g.ground_m!=null?g.ground_m.toFixed(1)+' m above sea level':null],
      ['Eave level',g.eave_m!=null?g.eave_m.toFixed(1)+' m above sea level':null],['Ridge level',g.ridge_m!=null?g.ridge_m.toFixed(1)+' m above sea level':null],['Use',g.use],['Surveyed',g.captured],['GURS building ID',g.dtm_id]].filter(a=>a[1]!=null);
    geo.push(`<div class="tscroll"><table><thead><tr><th>${g.user?'Outline entered by the user':'Official building (GURS)'}</th><th>Value</th></tr></thead><tbody>${rows.map(([a,b])=>`<tr><td class="l">${esc(a)}</td><td class="v">${T(b)}</td></tr>`).join('')}</tbody></table></div>${M&&!g.user?`<p class="note" style="padding:8px 18px 0">${T(M.source)}. ${T(M.licence)}.</p>`:''}`); }
  sec('geometry','Geometry',geo.join(''));
  sec('record','Record data',(sRows.length||(p.facts||[]).length)?`<div class="tscroll"><table><tbody>${sRows.map(([a,b])=>`<tr><td class="l">${esc(a)}</td><td class="v">${T(b)}</td></tr>`).join('')}${(p.facts||[]).map(([a,b])=>`<tr><td class="l">${T(a)}</td><td class="v">${T(b)}</td></tr>`).join('')}</tbody></table></div>`:'');
  sec('history','History and engineering',p.hist?`<div class="in"><p>${T(p.hist)}</p></div>`:'');
  const nd=t?(t.differences||[]).length:0;
  sec('check','Verification',(nd||t&&t.open)?`${nd?`<details class="sub"${nd<=4?' open':''}><summary>Where the sources differ (${nd})</summary><ul>${t.differences.map(x=>`<li>${T(x)}</li>`).join('')}</ul></details>`:''}${t&&t.open?`<p class="open"><b>Not yet verified.</b> ${T(cap(t.open))}</p>`:''}`:'');
  sec('news','Recent news',news.length?`${news.map(n=>`<div class="nitem${fresh(n.date)?' fresh':''}"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a><div class="note">${esc(n.source)}, ${fmtDate(n.date)}${n.outlets>1?`, reported by ${n.outlets} outlets`:''}</div></div>`).join('')}<p class="note" style="padding:8px 18px">Matched automatically on Slovenian keywords from Google News, so an unrelated article can slip through.${D.newsUpdated?' Checked '+fmtDate(D.newsUpdated)+'.':''}</p>`:'');
  sec('position','Position',`<div class="tscroll"><table><tbody><tr><td class="l">Basis</td><td class="v">${esc(PREC[p.position_precision]||p.position_precision)}</td></tr><tr><td class="l">WGS84</td><td class="n">${coord}</td></tr>
    ${p.address?`<tr><td class="l">Address</td><td class="v">${T(p.address)}</td></tr>`:''}${(p.position_sources||[]).length?`<tr><td class="l">Position sources</td><td class="v">${p.position_sources.map(u=>link(u)).join(', ')}</td></tr>`:''}</tbody></table></div>
    <div class="in">${exact?'':'<p class="note">The position is approximate. The shaded circle on the view marks the area, not the object.</p>'}<div class="btnrow"><a class="tbtn" href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}" target="_blank" rel="noopener">Open in Google Maps</a><button class="tbtn" id="copy" type="button">Copy coordinates</button></div></div>`);
  sec('sources','Sources',(p.sources||[]).length?p.sources.map(s=>`<div class="src"><span>${T(s.title||s.key)}${s.type?`<br><span class="note">${esc(SRC_KIND[s.type]||cap(s.type))}</span>`:''}</span>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">Open source</a>`:''}</div>`).join(''):'');

  document.title=`${clean(p.name_en||p.name)}, digital twin, ZAG Digital Atlas`;
  $('crumb').textContent=`Digital twins, ${GROUP_NAME[p.object_type]||cap(p.object_type)}`;
  const order=D.features.map(x=>x.properties.id), sheet=order.indexOf(id)+1;
  const model=buildModel(p,t,g,lines,labels), hasModel=model.els.length>0;
  $('main').innerHTML=`<div class="wrap">
    <header class="hero">
      <p class="kind">${esc(kind)}, ${esc(p.object_type)}</p>
      <h1>${T(p.name_en||p.name)}</h1>
      ${p.name_sl&&p.name_sl!==p.name_en?`<p class="sl" lang="sl">${T(p.name_sl)}</p>`:''}
      <div class="tags">${where?`<span class="tag">${T(where)}</span>`:''}<span class="tag ${p.evidence_level==='documented'?'ok':'warn'}">${esc({documented:'Documented',referenced:'Referenced',location_only:'Location only',user:'Added by a user, not verified'}[p.evidence_level]||p.evidence_level)}</span><span class="tag ${exact?'ok':'warn'}">${esc(PREC[p.position_precision]||p.position_precision)}</span><span class="tag">Sheet ${sheet} of ${order.length}</span></div>
    </header>
    <section class="glass stage" aria-label="Model and map">
      <div class="stagebar">
        <div class="seg" role="group" aria-label="View"><button id="tModel" type="button" aria-pressed="${hasModel}"${hasModel?'':' hidden'}>Model</button><button id="tMap" type="button" aria-pressed="${!hasModel}">Map</button></div>
        <div class="ctl" id="modelctl"${hasModel?'':' hidden'}>
          <div class="seg" role="group" aria-label="Model view"><button id="m3d" type="button" aria-pressed="true">3D</button><button id="mTop" type="button" aria-pressed="false">Top</button><button id="mSide" type="button" aria-pressed="false">Side</button></div>
          <div class="seg" role="group" aria-label="Motion"><button id="mSpin" type="button" aria-pressed="false">Rotate</button><button id="mLight" type="button" aria-pressed="false" title="Moving light along the elements. It is an animation, not measured data.">Light</button></div>
          <button class="tbtn" id="mReset" type="button">Reset</button>
        </div>
        <div class="ctl" id="mapctl"${hasModel?' hidden':''}>
          <div class="seg" role="group" aria-label="Background"><button id="vMap" type="button" aria-pressed="true">Map</button><button id="vSat" type="button" aria-pressed="false">Satellite</button></div>
          <div class="seg" role="group" aria-label="Map view"><button id="v3d" type="button" aria-pressed="true">3D</button><button id="vOrbit" type="button" aria-pressed="false">Orbit</button><button id="vLight" type="button" aria-pressed="true" title="Moving light along the structure. It is an animation, not measured data.">Light</button></div>
          <button class="tbtn" id="vReset" type="button">Reset</button>
        </div>
      </div>
      <div class="stagebody">
        <canvas id="fem" tabindex="0" aria-label="Schematic model of ${T(p.name_en||p.name)}. Drag to rotate, click a node or an element for its data."${hasModel?'':' hidden'}></canvas>
        <div id="mapwrap"${hasModel?' hidden':''}><div id="tmap" role="application" aria-label="3D map view of the object"></div><div class="readout" id="readout" aria-hidden="true"></div></div>
        <aside class="pickbox" id="pick" aria-live="polite"${hasModel?'':' hidden'}><b>Model</b><p>Click a node or an element for its data. Drag to rotate. Click the model first, then scroll to zoom.</p></aside>
      </div>
      <p class="note stage-note" id="snote">${hasModel?T(model.note):(exact?'No drawn geometry is recorded for this object yet, so there is no model. The map shows the recorded position.':'The position is approximate, so the map shows an area and not a point. There is no model for this object.')}</p>
    </section>
    ${figs.length?`<section class="dims" aria-label="Key figures">${figs.map(x=>`<div class="dim"><div class="v">${T(x.v)}${x.unit?`<small>${esc(x.unit)}</small>`:''}</div><div class="k">${T(x.k)}</div><div class="s">${x.src?(x.src[0]==='#'?`<a href="${x.src}">${esc(x.srcText)}</a>`:link(x.src,x.srcText)):''}</div></div>`).join('')}</section>`:''}
    <div class="cols">
      <nav class="toc" aria-label="Sections">${secs.map(s=>`<a href="#${s.sid}">${esc(s.title)}</a>`).join('')}<button class="tbtn" id="expand" type="button" aria-pressed="false">Expand all</button></nav>
      <div class="secs">${hero?`<figure class="photo"><img alt="" src="${esc(hero.src)}">${hero.credit?`<figcaption>${T(hero.credit)}</figcaption>`:''}</figure>`:''}${secs.map(s=>s.html).join('')}</div>
    </div></div>`;
  const ids=D.features.map(x=>x.properties.id), i=ids.indexOf(id), pv=$('prev'), nx=$('next');
  pv.hidden=nx.hidden=false; pv.href='twin.html?id='+encodeURIComponent(ids[(i-1+ids.length)%ids.length]); nx.href='twin.html?id='+encodeURIComponent(ids[(i+1)%ids.length]);
  $('tomap').href='index.html#'+encodeURIComponent(id);
  const openSec=h=>{ const d=h&&document.getElementById(h.replace('#','')); if(d&&d.tagName==='DETAILS') d.open=true; };
  document.querySelectorAll('.toc a, .dim .s a').forEach(a=>a.addEventListener('click',()=>openSec(a.getAttribute('href'))));
  const ex=$('expand'); ex.onclick=()=>{ const all=ex.getAttribute('aria-pressed')!=='true'; document.querySelectorAll('details.sec').forEach(d=>d.open=all); ex.setAttribute('aria-pressed',all?'true':'false'); ex.textContent=all?'Collapse all':'Expand all'; };
  const cp=$('copy'); if(cp) cp.onclick=async()=>{try{await navigator.clipboard.writeText(coord);cp.textContent='Copied';}catch(_){cp.textContent='Copy is not available here';}setTimeout(()=>cp.textContent='Copy coordinates',1800);};
  /* Model and Map share one stage. The map is created only when its tab is first opened. */
  const ctl={mode:hasModel?'model':'map',fem:null,map:null};
  const press=(el,on)=>el.setAttribute('aria-pressed',on?'true':'false');
  const openMap=()=>{ if(!ctl.map) ctl.map=initView(p,t,g,lines,labels)||{}; else if(ctl.map.resize) ctl.map.resize(); };
  const show=m=>{ ctl.mode=m; const isM=m==='model'; $('fem').hidden=!isM; $('pick').hidden=!isM; $('modelctl').hidden=!isM; $('mapwrap').hidden=isM; $('mapctl').hidden=isM; press($('tModel'),isM); press($('tMap'),!isM);
    if(isM){ if(ctl.fem) ctl.fem.wake(); } else { if(ctl.fem) ctl.fem.sleep(); openMap(); } };
  $('tModel').onclick=()=>show('model'); $('tMap').onclick=()=>show('map');
  if(hasModel) ctl.fem=initModel(model,p); else openMap();
  const rowAct=tr=>{ document.querySelector('.stage').scrollIntoView({block:'start',behavior:'smooth'});
    if(ctl.mode==='model'&&ctl.fem){ if(tr.dataset.line!=null) ctl.fem.pickPart(+tr.dataset.line); else ctl.fem.pickRef(+tr.dataset.anchor); } else if(ctl.map&&ctl.map.act) ctl.map.act(tr); };
  document.querySelectorAll('tr.pick').forEach(tr=>{tr.onclick=()=>rowAct(tr);tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();rowAct(tr);}};});
}

/* ---------- schematic model ----------
   A mesh in the manner of a finite element model, generated only from geometry the atlas already holds:
   the drawn alignment of each part (OpenStreetMap), a deck width where a source states one, and the official building outline and height (GURS).
   Element size is a drawing choice. Nothing here is a structural analysis model, and no pier, span or cross section is assumed. */
function buildModel(p,t,g,lines,labels){
  const all=[...lines.flat()], ring0=g&&g.geometry?(g.geometry.type==='Polygon'?[g.geometry.coordinates]:g.geometry.type==='MultiPolygon'?g.geometry.coordinates:[]).map(x=>x[0]):[];
  ring0.forEach(r=>all.push(...r)); const M={nodes:[],els:[],parts:[],refs:[],note:'',R:1};
  if(!all.length) return M;
  const o=[all.reduce((a,c)=>a+c[0],0)/all.length,all.reduce((a,c)=>a+c[1],0)/all.length], kx=RAD*Math.cos(o[1]*RAD)*R, ky=RAD*R;
  const xy=c=>[(c[0]-o[0])*kx,(c[1]-o[1])*ky], ll=(x,y)=>[o[0]+x/kx,o[1]+y/ky];
  const node=(x,y,z,part,extra)=>{ const l=ll(x,y); M.nodes.push(Object.assign({id:M.nodes.length+1,x,y,z,part,lon:l[0],lat:l[1]},extra||{})); return M.nodes.length-1; };
  const el=(a,b,part,kind)=>{ const A=M.nodes[a],B=M.nodes[b]; M.els.push({id:M.els.length+1,a,b,part,kind,len:Math.hypot(B.x-A.x,B.y-A.y,B.z-A.z)}); };
  const wSpec=((t&&t.specs)||[]).find(s=>/^width$/i.test(s.label)&&/^m$/i.test(s.unit||'')&&isFinite(parseFloat(s.value))), W=wSpec?parseFloat(wSpec.value):null;
  lines.forEach((l,i)=>{ const P=l.map(xy), cum=[0]; for(let k=1;k<P.length;k++) cum.push(cum[k-1]+Math.hypot(P[k][0]-P[k-1][0],P[k][1]-P[k-1][1]));
    const L=cum[cum.length-1]; if(!(L>0)) return; const n=Math.max(8,Math.min(48,Math.round(L/25))), part=M.parts.length, axis=[], left=[], right=[];
    for(let k=0;k<=n;k++){ const d=L*k/n; let j=1; while(j<cum.length-1&&cum[j]<d) j++; const u=(d-cum[j-1])/((cum[j]-cum[j-1])||1), x=P[j-1][0]+(P[j][0]-P[j-1][0])*u, y=P[j-1][1]+(P[j][1]-P[j-1][1])*u;
      const tx=P[j][0]-P[j-1][0], ty=P[j][1]-P[j-1][1], tl=Math.hypot(tx,ty)||1, nx=-ty/tl, ny=tx/tl;
      axis.push(node(x,y,0,part,{ch:d,role:'axis'}));
      if(W){ left.push(node(x+nx*W/2,y+ny*W/2,0,part,{ch:d,role:'edge'})); right.push(node(x-nx*W/2,y-ny*W/2,0,part,{ch:d,role:'edge'})); } }
    for(let k=0;k<n;k++){ el(axis[k],axis[k+1],part,'axis'); if(W){ el(left[k],left[k+1],part,'edge'); el(right[k],right[k+1],part,'edge'); } }
    if(W) for(let k=0;k<=n;k++){ el(left[k],axis[k],part,'cross'); el(axis[k],right[k],part,'cross'); }
    M.parts.push({name:labels[i]||(lines.length>1?'Part '+(i+1):p.name_en||p.name),len:L,track:axis,kind:'line',width:W}); });
  ring0.forEach((r,i)=>{ const P=r.slice(0,-1).map(xy); if(P.length<3) return; const h=g.height_m||0, lv=h?Math.max(2,Math.min(8,Math.round(h/4))):0, part=M.parts.length, rings=[];
    for(let k=0;k<=lv;k++){ const z=lv?h*k/lv:0; rings.push(P.map(c=>node(c[0],c[1],z,part,{role:k===0?'ground':k===lv?'top':'level'}))); }
    rings.forEach(rg=>rg.forEach((a,q)=>el(a,rg[(q+1)%rg.length],part,'ring')));
    for(let k=0;k<lv;k++) rings[k].forEach((a,q)=>el(a,rings[k+1][q],part,'vertical'));
    const top=rings[rings.length-1]; M.parts.push({name:ring0.length>1?'Outline '+(i+1):'Building outline',len:P.reduce((a,c,q)=>a+Math.hypot(P[(q+1)%P.length][0]-c[0],P[(q+1)%P.length][1]-c[1]),0),track:[...top,top[0]],kind:'building',height:h||null}); });
  ((t&&t.anchors)||[]).forEach((a,i)=>{ const c=xy([+a.lon,+a.lat]); M.refs.push({i,x:c[0],y:c[1],z:0,label:a.label,lat:+a.lat,lon:+a.lon,source:a.source}); });
  M.R=Math.max(1,...M.nodes.map(n=>Math.hypot(n.x,n.y,n.z)),...M.refs.map(n=>Math.hypot(n.x,n.y)));
  const bits=[]; if(lines.length) bits.push('the drawn alignment'+(W?' and the deck width of '+W+(p.category==='user_object'?' m entered by the user':' m given in the sources'):'')); if(ring0.length) bits.push((g.user?'the outline entered by the user':'the official GURS outline')+(g.height_m?(g.user?' raised to the entered height of ':' raised to its surveyed height of ')+g.height_m.toFixed(1)+' m':''));
  M.note='Schematic mesh generated from '+bits.join(' and ')+'. It is not a structural analysis model. Element size is a drawing choice'+(lines.length?', and heights along the alignment are not in the sources, so those parts are drawn flat':'')+'.'+(ring0.length?' The horizontal rings on the building are mesh levels, not floors.':'');
  return M;
}
function initModel(M,p){
  const cv=$('fem'), ctx=cv.getContext('2d'), info=$('pick'), reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOME={yaw:-.6,pitch:.95}; let yaw=HOME.yaw,pitch=HOME.pitch,zoom=1,panX=0,panY=0,w=0,h=0,dpr=1;
  let spin=!reduced, light=!reduced, active=false, awake=true, inView=true, raf=0, t0=performance.now(), sel=null, hov=null, P=[], PR=[];
  const press=(id,on)=>$(id).setAttribute('aria-pressed',on?'true':'false');
  const size=()=>{ const r=cv.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1); w=r.width; h=r.height; cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); };
  const proj=(x,y,z)=>{ const c=Math.cos(yaw),s=Math.sin(yaw),x1=x*c-y*s,y1=x*s+y*c,k=Math.min(w,h)*.40/M.R*zoom; return [w/2+panX+x1*k,h/2+panY-(y1*Math.cos(pitch)+z*Math.sin(pitch))*k]; };
  const along=(tr,f)=>{ const m=tr.length-1, q=Math.min(m-1e-6,f*m), i=Math.floor(q), u=q-i, A=M.nodes[tr[i]], B=M.nodes[tr[i+1]]; return proj(A.x+(B.x-A.x)*u,A.y+(B.y-A.y)*u,A.z+(B.z-A.z)*u); };
  function draw(now){
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    /* ground grid with a stated spacing */
    const span=M.R*2.4, raw=span/10, pw=Math.pow(10,Math.floor(Math.log10(raw))), step=[1,2,5,10].map(m=>m*pw).find(v=>v>=raw), half=Math.ceil(span/2/step)*step;
    ctx.lineWidth=1; ctx.strokeStyle='rgba(32,52,105,.10)'; ctx.beginPath();
    for(let v=-half;v<=half+1e-6;v+=step){ let a=proj(v,-half,0),b=proj(v,half,0); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); a=proj(-half,v,0); b=proj(half,v,0); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); } ctx.stroke();
    P=M.nodes.map(n=>proj(n.x,n.y,n.z)); PR=M.refs.map(n=>proj(n.x,n.y,n.z));
    const selPart=sel&&sel.type==='part'?sel.i:null;
    for(const pass of [0,1]){ ctx.beginPath(); for(const e of M.els){ const main=e.kind==='axis'||e.kind==='ring'||e.kind==='edge'; if((pass===1)!==main) continue; ctx.moveTo(P[e.a][0],P[e.a][1]); ctx.lineTo(P[e.b][0],P[e.b][1]); }
      ctx.strokeStyle=pass?'#007AFF':'rgba(0,122,255,.38)'; ctx.lineWidth=pass?2:1; ctx.stroke(); }
    if(selPart!=null){ ctx.beginPath(); for(const e of M.els) if(e.part===selPart){ ctx.moveTo(P[e.a][0],P[e.a][1]); ctx.lineTo(P[e.b][0],P[e.b][1]); } ctx.strokeStyle='#FF9500'; ctx.lineWidth=2.5; ctx.stroke(); }
    const mark=(o,col)=>{ if(!o) return; if(o.type==='el'){ const e=M.els[o.i]; ctx.beginPath(); ctx.moveTo(P[e.a][0],P[e.a][1]); ctx.lineTo(P[e.b][0],P[e.b][1]); ctx.strokeStyle=col; ctx.lineWidth=5; ctx.lineCap='round'; ctx.stroke(); ctx.lineCap='butt'; } };
    mark(hov,'rgba(255,149,0,.45)'); mark(sel,'#FF9500');
    ctx.fillStyle='#203469'; const ns=M.nodes.length>260?2:3; for(const q of P) ctx.fillRect(q[0]-ns/2,q[1]-ns/2,ns,ns);
    const dot=(o,r,col)=>{ if(o&&o.type==='node'){ const q=P[o.i]; ctx.beginPath(); ctx.arc(q[0],q[1],r,0,7); ctx.fillStyle=col; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke(); } };
    dot(hov,5,'rgba(255,149,0,.6)'); dot(sel,6,'#FF9500');
    PR.forEach((q,i)=>{ const on=sel&&sel.type==='ref'&&sel.i===i; ctx.beginPath(); ctx.moveTo(q[0],q[1]-6); ctx.lineTo(q[0]+6,q[1]); ctx.lineTo(q[0],q[1]+6); ctx.lineTo(q[0]-6,q[1]); ctx.closePath(); ctx.fillStyle=on?'#FF9500':'#fff'; ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=on?'#fff':'#5856D6'; ctx.stroke(); });
    if(light){ const sec=(now-t0)/1000; for(const pt of M.parts){ const T=Math.max(3.5,Math.min(9,pt.len/60)), n=pt.len>600?2:1;
        for(let j=0;j<n;j++){ const f=((((sec/T)+j/n)%1)+1)%1, q=along(pt.track,f), gr=ctx.createRadialGradient(q[0],q[1],0,q[0],q[1],16); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.25,'rgba(90,200,250,.9)'); gr.addColorStop(1,'rgba(90,200,250,0)');
          ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(q[0],q[1],16,0,7); ctx.fill(); } } }
    /* part names and the grid spacing */
    ctx.font='600 12px Inter,system-ui,sans-serif'; ctx.textBaseline='middle';
    if(M.parts.length<=6) M.parts.forEach((pt,i)=>{ const q=along(pt.track,.5), tx=pt.name, tw=ctx.measureText(tx).width+16, x=q[0]-tw/2, y=q[1]-34;
      ctx.fillStyle='rgba(255,255,255,.92)'; ctx.strokeStyle=selPart===i?'#FF9500':'rgba(32,52,105,.25)'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(x,y,tw,22,11); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(q[0],y+22); ctx.lineTo(q[0],q[1]-4); ctx.stroke(); ctx.fillStyle='#203469'; ctx.fillText(tx,x+8,y+11.5); });
    ctx.font='500 12px Inter,system-ui,sans-serif'; ctx.fillStyle='#6E6E73'; ctx.fillText('Grid '+(step>=1000?step/1000+' km':step+' m')+', north is '+(Math.abs(yaw)<.02?'up':'marked N'),14,h-16);
    const c0=proj(0,0,0), cn=proj(0,M.R*.25,0), dx=cn[0]-c0[0], dy=cn[1]-c0[1], dl=Math.hypot(dx,dy)||1, ax=w-44, ay=h-44;
    ctx.strokeStyle='#203469'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ax+dx/dl*22,ay+dy/dl*22); ctx.stroke(); ctx.fillStyle='#203469'; ctx.font='700 12px Inter,system-ui,sans-serif'; ctx.fillText('N',ax+dx/dl*31-4,ay+dy/dl*31);
  }
  const running=()=>awake&&inView&&!document.hidden&&(spin||light);
  function loop(now){ raf=0; if(spin) yaw+=.0032; draw(now); if(running()) raf=requestAnimationFrame(loop); }
  const kick=()=>{ if(!raf&&awake) raf=requestAnimationFrame(loop); };
  const row=(k,v,html)=>v==null||v===''?'':`<div class="row"><span>${esc(k)}</span><span>${html?v:T(v)}</span></div>`;
  function describe(){
    if(!sel){ info.innerHTML='<b>Model</b><p>Click a node or an element for its data. Drag to rotate. Click the model first, then scroll to zoom.</p>'; return; }
    if(sel.type==='node'){ const n=M.nodes[sel.i], pt=M.parts[n.part];
      info.innerHTML=`<b>Node ${n.id}</b>${row('Part',pt.name)}${row('Role',{axis:'on the centre line',edge:'deck edge',ground:'ground level',top:'top of the building',level:'mesh level'}[n.role])}${row('Distance along the part',n.ch!=null?num(Math.round(n.ch*10)/10)+' m':null)}${row('Height above ground',pt.kind==='building'?n.z.toFixed(1)+' m':null)}${row('Latitude',n.lat.toFixed(6))}${row('Longitude',n.lon.toFixed(6))}`; }
    else if(sel.type==='el'){ const e=M.els[sel.i], pt=M.parts[e.part];
      info.innerHTML=`<b>Element ${e.id}</b>${row('Part',pt.name)}${row('Kind',{axis:'centre line',edge:'deck edge',cross:'across the deck',ring:'outline',vertical:'vertical'}[e.kind])}${row('Length',num(Math.round(e.len*10)/10)+' m')}${row('Nodes',M.nodes[e.a].id+' to '+M.nodes[e.b].id)}`; }
    else if(sel.type==='part'){ const pt=M.parts[sel.i], ne=M.els.filter(e=>e.part===sel.i).length, nn=M.nodes.filter(n=>n.part===sel.i).length;
      info.innerHTML=`<b>${T(pt.name)}</b>${row(pt.kind==='building'?'Outline length':'Length on the map',num(Math.round(pt.len))+' m')}${row('Deck width',pt.width?pt.width+' m':null)}${row('Height above ground',pt.height?pt.height.toFixed(1)+' m':null)}${row('Mesh',nn+' nodes, '+ne+' elements')}${row('Object',p.name_en||p.name)}`; }
    else { const r=M.refs[sel.i]; info.innerHTML=`<b>${T(r.label)}</b>${row('Kind','reference point')}${row('Latitude',r.lat.toFixed(6))}${row('Longitude',r.lon.toFixed(6))}${row('Source',r.source?link(r.source):'',true)}`; }
  }
  const segD=(x,y,a,b)=>{ const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy; let u=l?((x-a[0])*dx+(y-a[1])*dy)/l:0; u=Math.max(0,Math.min(1,u)); return Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy); };
  function hit(x,y){ let best=null,bd=11; PR.forEach((q,i)=>{ const d=Math.hypot(q[0]-x,q[1]-y); if(d<bd){bd=d;best={type:'ref',i};} }); if(best) return best;
    bd=9; P.forEach((q,i)=>{ const d=Math.hypot(q[0]-x,q[1]-y); if(d<bd){bd=d;best={type:'node',i};} }); if(best) return best;
    bd=7; M.els.forEach((e,i)=>{ const d=segD(x,y,P[e.a],P[e.b]); if(d<bd){bd=d;best={type:'el',i};} }); return best; }
  const stopSpin=()=>{ if(spin){ spin=false; press('mSpin',false); } };
  const pts=new Map(); let moved=0, pinch=0;
  const pos=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); pts.set(e.pointerId,pos(e)); moved=0; active=true; cv.classList.add('active'); stopSpin(); if(pts.size===2){ const a=[...pts.values()]; pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]); } });
  cv.addEventListener('pointermove',e=>{ const q=pos(e);
    if(!pts.has(e.pointerId)){ const hh=hit(q[0],q[1]); if(JSON.stringify(hh)!==JSON.stringify(hov)){ hov=hh; cv.style.cursor=hh?'pointer':'grab'; if(!raf) draw(performance.now()); } return; }
    const o=pts.get(e.pointerId), dx=q[0]-o[0], dy=q[1]-o[1]; pts.set(e.pointerId,q); moved+=Math.abs(dx)+Math.abs(dy);
    if(pts.size===2){ const a=[...pts.values()], d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]); if(pinch) zoom=Math.max(.3,Math.min(30,zoom*d/pinch)); pinch=d; }
    else if(e.shiftKey||e.button===2){ panX+=dx; panY+=dy; } else { yaw+=dx*.008; pitch=Math.max(0,Math.min(Math.PI/2,pitch+dy*.006)); ['m3d','mTop','mSide'].forEach(k=>press(k,false)); }
    if(!raf) draw(performance.now()); });
  const up=e=>{ const had=pts.has(e.pointerId); pts.delete(e.pointerId); pinch=0; if(had&&moved<5){ const q=pos(e); sel=hit(q[0],q[1]); describe(); if(!raf) draw(performance.now()); } };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',e=>{pts.delete(e.pointerId);pinch=0;});
  cv.addEventListener('wheel',e=>{ if(!active) return; e.preventDefault(); stopSpin(); zoom=Math.max(.3,Math.min(30,zoom*Math.exp(-e.deltaY*.0015))); if(!raf) draw(performance.now()); },{passive:false});
  cv.addEventListener('blur',()=>{ active=false; cv.classList.remove('active'); });
  document.addEventListener('pointerdown',e=>{ if(e.target!==cv){ active=false; cv.classList.remove('active'); } });
  cv.addEventListener('keydown',e=>{ const k=e.key; let ok=true; if(k==='ArrowLeft') yaw-=.1; else if(k==='ArrowRight') yaw+=.1; else if(k==='ArrowUp') pitch=Math.min(Math.PI/2,pitch+.08); else if(k==='ArrowDown') pitch=Math.max(0,pitch-.08); else if(k==='+'||k==='=') zoom=Math.min(30,zoom*1.2); else if(k==='-') zoom=Math.max(.3,zoom/1.2); else if(k==='Escape'){ sel=null; describe(); } else ok=false;
    if(ok){ e.preventDefault(); stopSpin(); if(!raf) draw(performance.now()); } });
  const view=(y,pt,id)=>{ stopSpin(); yaw=y; pitch=pt; panX=panY=0; zoom=1; ['m3d','mTop','mSide'].forEach(k=>press(k,k===id)); if(!raf) draw(performance.now()); };
  $('m3d').onclick=()=>view(HOME.yaw,HOME.pitch,'m3d'); $('mTop').onclick=()=>view(0,0,'mTop'); $('mSide').onclick=()=>view(0,Math.PI/2,'mSide');
  $('mReset').onclick=()=>{ sel=null; describe(); view(HOME.yaw,HOME.pitch,'m3d'); };
  $('mSpin').onclick=()=>{ spin=!spin; press('mSpin',spin); kick(); };
  $('mLight').onclick=()=>{ light=!light; press('mLight',light); kick(); if(!light&&!raf) draw(performance.now()); };
  press('mSpin',spin); press('mLight',light);
  if('ResizeObserver' in window) new ResizeObserver(()=>{ if(cv.hidden) return; size(); if(!raf) draw(performance.now()); }).observe(cv);
  if('IntersectionObserver' in window) new IntersectionObserver(es=>{ inView=es[0].isIntersecting; if(inView) kick(); }).observe(cv);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) kick(); });
  size(); draw(performance.now()); kick();
  const api={ wake(){ awake=true; size(); draw(performance.now()); kick(); }, sleep(){ awake=false; },
    pickPart(i){ if(M.parts[i]){ sel={type:'part',i}; describe(); if(!raf) draw(performance.now()); } }, pickRef(i){ const k=M.refs.findIndex(r=>r.i===i); if(k>=0){ sel={type:'ref',i:k}; describe(); if(!raf) draw(performance.now()); } },
    state:()=>({nodes:M.nodes.length,els:M.els.length,parts:M.parts.length,sel,yaw,pitch,zoom,running:!!raf}), screen:(type,i)=>type==='node'?P[i]:type==='ref'?PR[i]:[(P[M.els[i].a][0]+P[M.els[i].b][0])/2,(P[M.els[i].a][1]+P[M.els[i].b][1])/2] };
  window.__fem=api; return api;
}

/* ---------- 3D view: terrain, satellite, the highlighted geometry with a moving light, reference points and the official building, all clickable ---------- */
function initView(p,t,g,lines,labels){
  const box=$('tmap'), fail=m=>{box.outerHTML=`<div class="vfail">${esc(m)}</div>`;for(const q of ['#mapctl','.readout']){const n=document.querySelector(q);if(n)n.remove();}};
  if(typeof maplibregl==='undefined') return fail('The 3D view could not load. The data sheet is complete without it.');
  const ll=[p.longitude,p.latitude], exact=EXACT(p.position_precision), unc=UNC[p.position_precision];
  const zoom=g?17:p.position_precision==='address'?16.8:p.position_precision==='municipality'?11.8:exact?15.5:13.2;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let map; try{ map=new maplibregl.Map({container:box,style:STYLE_URL,center:ll,zoom,pitch:58,bearing:-20,maxPitch:78,attributionControl:{compact:true},cooperativeGestures:true}); }catch(_){ return fail('The 3D view is not available in this browser. The data sheet is complete without it.'); }
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right'); window.__map=map;
  const anchors=(t&&t.anchors)||[];
  const pop=(at,title,rows)=>new maplibregl.Popup({maxWidth:'300px'}).setLngLat(at).setHTML(`<b>${T(title)}</b>${rows.filter(r=>r[1]!=null&&r[1]!=='').map(r=>`<div class="row"><span>${esc(r[0])}</span><span>${r[2]?r[1]:T(r[1])}</span></div>`).join('')}`).addTo(map);
  const mid=l=>l[Math.floor(l.length/2)];
  const partName=i=>labels[i]||(lines.length>1?'Part '+(i+1):p.name_en||p.name);
  const showLine=i=>{const l=lines[i]; pop(mid(l),partName(i),[['Length on the map',num(Math.round(lineLen(l)))+' m'],['Object',p.name_en||p.name],['Type',cap(p.object_type)]]);};
  const showAnchor=i=>{const a=anchors[i]; pop([+a.lon,+a.lat],a.label,[['Latitude',(+a.lat).toFixed(6)],['Longitude',(+a.lon).toFixed(6)],['Source',a.source?link(a.source):'',true]]);};
  const showBld=at=>pop(at,p.name_en||p.name,[['Height above ground',g.height_m!=null?g.height_m.toFixed(1)+' m':null],['Footprint area',g.area_m2?num(g.area_m2)+' m²':null],['Ridge level',g.ridge_m!=null?g.ridge_m.toFixed(1)+' m above sea level':null],['Surveyed',g.captured],['Source',g.user?'entered by the user':'GURS building register']]);
  let is3d=true, orbiting=false, lightOn=!reduced, inView=true, raf=0;
  const B=()=>is3d?-20:0, Pch=()=>is3d?58:0;
  function fit(animate){
    const pts=[...lines.flat(),...anchors.map(a=>[+a.lon,+a.lat])], wide=box.clientWidth>900;
    if(pts.length>1){ const b=pts.reduce((bb,c)=>bb.extend(c),new maplibregl.LngLatBounds(pts[0],pts[0])); map.fitBounds(b,{padding:{top:90,bottom:wide?90:50,left:70,right:70},maxZoom:18.3,pitch:Pch(),bearing:B(),duration:animate?900:0}); }
    else map[animate?'easeTo':'jumpTo']({center:ll,zoom,pitch:Pch(),bearing:B(),duration:900});
  }
  const ro=$('readout'), readout=()=>{ if(!ro) return; const c=map.getCenter(); ro.textContent=`${c.lat.toFixed(5)} N, ${c.lng.toFixed(5)} E, zoom ${map.getZoom().toFixed(1)}`; };
  map.on('move',readout);
  const set=(b,on)=>{ if(b) b.setAttribute('aria-pressed',on?'true':'false'); };
  const stopOrbit=()=>{ orbiting=false; set($('vOrbit'),false); };
  let spinT=0; const spinStep=ts=>{ if(!orbiting) return; if(spinT&&!document.hidden&&inView) map.setBearing(map.getBearing()+(ts-spinT)*0.0015); spinT=ts; requestAnimationFrame(spinStep); };
  const spin=()=>{ spinT=0; requestAnimationFrame(spinStep); };
  /* MapLibre 5 can leave the camera at its old height after a programmatic move when terrain tiles arrive later, which puts the view under the ground. Release it. */
  const unfreeze=()=>{ try{ if(map.terrain&&map._elevationFreeze===true){ map._elevationFreeze=false; map.triggerRepaint(); } }catch(_){} };
  map.on('moveend',unfreeze); map.on('sourcedata',e=>{ if(e.sourceId==='dem'&&e.isSourceLoaded) unfreeze(); });
  for(const ev of ['mousedown','touchstart','wheel']) box.addEventListener(ev,()=>{ if(orbiting){ stopOrbit(); map.stop(); } },{passive:true});
  const hover=id=>{ map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer'); map.on('mouseleave',id,()=>map.getCanvas().style.cursor=''); };

  /* moving light: points that travel along every drawn part and around the building outline. An animation only, it carries no measured data. */
  const tracks=[]; const addTrack=c=>{ if(!c||c.length<2) return; const cum=[0]; for(let i=1;i<c.length;i++) cum.push(cum[i-1]+meters(c[i-1],c[i])); const len=cum[cum.length-1]; if(len>0) tracks.push({c,cum,len,n:Math.max(1,Math.min(3,Math.round(len/900))),T:Math.max(3.5,Math.min(10,len/160))}); };
  lines.forEach(addTrack);
  if(g&&g.geometry) (g.geometry.type==='Polygon'?[g.geometry.coordinates]:g.geometry.type==='MultiPolygon'?g.geometry.coordinates:[]).forEach(poly=>addTrack(poly[0]));
  const at=(tr,f)=>{ const d=f*tr.len; let i=1; while(i<tr.cum.length-1&&tr.cum[i]<d) i++; const a=tr.c[i-1],b=tr.c[i],seg=tr.cum[i]-tr.cum[i-1]||1,u=(d-tr.cum[i-1])/seg; return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]; };
  let last=0;
  function frame(ts){ raf=0; if(!lightOn||!inView||document.hidden||!map.getSource('pulse')) return;
    if(ts-last>40){ last=ts; const sec=ts/1000, fs=[];
      for(const tr of tracks) for(let j=0;j<tr.n;j++) fs.push({type:'Feature',properties:{},geometry:{type:'Point',coordinates:at(tr,((((sec/tr.T)+j/tr.n)%1)+1)%1)}});
      map.getSource('pulse').setData({type:'FeatureCollection',features:fs});
      if(map.getLayer('bld')) map.setPaintProperty('bld','fill-extrusion-opacity',.74+.14*Math.sin(sec*1.6)); }
    raf=requestAnimationFrame(frame); }
  const startLight=()=>{ if(!raf&&lightOn&&tracks.length) raf=requestAnimationFrame(frame); };
  const clearLight=()=>{ try{ map.getSource('pulse').setData({type:'FeatureCollection',features:[]}); if(map.getLayer('bld')) map.setPaintProperty('bld','fill-extrusion-opacity',.85); }catch(_){} };
  if('IntersectionObserver' in window) new IntersectionObserver(es=>{ inView=es[0].isIntersecting; if(inView) startLight(); }).observe(box);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) startLight(); });

  map.on('load',()=>{
    try{ map.addSource('dem',{type:'raster-dem',tiles:[DEM_URL],tileSize:256,maxzoom:15,encoding:'terrarium',attribution:'Terrain: Mapzen, AWS Terrain Tiles'}); map.setTerrain({source:'dem',exaggeration:1}); }catch(_){}
    const firstSym=(map.getStyle().layers.find(l=>l.type==='symbol')||{}).id;
    try{ map.addSource('sat',{type:'raster',tiles:[SAT_URL],tileSize:256,maxzoom:19,attribution:'Imagery: Esri, Maxar, Earthstar Geographics'}); map.addLayer({id:'sat',type:'raster',source:'sat',layout:{visibility:'none'}},firstSym); }catch(_){}
    if(unc&&!lines.length){ map.addSource('unc',{type:'geojson',data:{type:'Feature',properties:{},geometry:circle(ll,unc)}});
      map.addLayer({id:'unc-f',type:'fill',source:'unc',paint:{'fill-color':'#FF9500','fill-opacity':.12}}); map.addLayer({id:'unc-l',type:'line',source:'unc',paint:{'line-color':'#C76A00','line-width':1.5,'line-dasharray':[3,3]}}); }
    if(g&&g.geometry){ map.addSource('bld',{type:'geojson',data:{type:'Feature',properties:{h:g.height_m||8},geometry:g.geometry}});
      map.addLayer({id:'bld-glow',type:'line',source:'bld',paint:{'line-color':'#007AFF','line-width':10,'line-blur':8,'line-opacity':.55}});
      map.addLayer({id:'bld',type:'fill-extrusion',source:'bld',paint:{'fill-extrusion-color':'#007AFF','fill-extrusion-height':['get','h'],'fill-extrusion-opacity':.85,'fill-extrusion-vertical-gradient':true}});
      map.on('click','bld',e=>showBld(e.lngLat)); hover('bld'); }
    if(lines.length){ map.addSource('ln',{type:'geojson',data:{type:'FeatureCollection',features:lines.map((l,i)=>({type:'Feature',properties:{i},geometry:{type:'LineString',coordinates:l}}))}});
      const lay={'line-cap':'round','line-join':'round'};
      map.addLayer({id:'ln-glow',type:'line',source:'ln',layout:lay,paint:{'line-color':'#007AFF','line-width':20,'line-blur':14,'line-opacity':.45}});
      map.addLayer({id:'ln-c',type:'line',source:'ln',layout:lay,paint:{'line-color':'#007AFF','line-width':7}});
      map.addLayer({id:'ln',type:'line',source:'ln',layout:lay,paint:{'line-color':'#FFFFFF','line-width':2,'line-opacity':.9}});
      map.on('click','ln-c',e=>showLine(e.features[0].properties.i)); hover('ln-c');
      if(lines.length<=4) lines.forEach((l,i)=>{ const el=document.createElement('button'); el.type='button'; el.className='callout'; el.innerHTML=`<span>${T(partName(i))}</span><b>${num(Math.round(lineLen(l)))} m</b>`; el.onclick=ev=>{ev.stopPropagation();showLine(i);};
        new maplibregl.Marker({element:el,anchor:'bottom',offset:[0,-10]}).setLngLat(mid(l)).addTo(map); }); }
    if(anchors.length){ map.addSource('an',{type:'geojson',data:{type:'FeatureCollection',features:anchors.map((a,i)=>({type:'Feature',properties:{i},geometry:{type:'Point',coordinates:[+a.lon,+a.lat]}}))}});
      map.addLayer({id:'an',type:'circle',source:'an',paint:{'circle-radius':5.5,'circle-color':'#FFFFFF','circle-stroke-color':'#203469','circle-stroke-width':2.5}});
      map.on('click','an',e=>showAnchor(e.features[0].properties.i)); hover('an'); }
    if(tracks.length){ map.addSource('pulse',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      map.addLayer({id:'pulse-glow',type:'circle',source:'pulse',paint:{'circle-radius':16,'circle-color':'#7FD4FF','circle-blur':1,'circle-opacity':.95}});
      map.addLayer({id:'pulse',type:'circle',source:'pulse',paint:{'circle-radius':4,'circle-color':'#FFFFFF','circle-stroke-color':'#7FD4FF','circle-stroke-width':1.5}}); }
    if(!lines.length&&!(g&&g.geometry)&&(exact||p.position_precision==='user')){ const el=document.createElement('div'); el.className='beacon'+(reduced?'':' live');
      new maplibregl.Marker({element:el}).setLngLat(ll).setPopup(new maplibregl.Popup({offset:14}).setHTML(`<b>${T(p.name_en||p.name)}</b><div class="row"><span>Position</span><span>${esc(PREC[p.position_precision]||'')}</span></div>`)).addTo(map); }
    fit(false); readout(); startLight(); unfreeze();
    if(!reduced&&(lines.length||g)){ orbiting=true; set($('vOrbit'),true); setTimeout(spin,900); }
  });
  const vL=$('vLight'); if(!tracks.length){ vL.hidden=true; } else set(vL,lightOn);
  vL.onclick=()=>{ lightOn=!lightOn; set(vL,lightOn); if(lightOn) startLight(); else clearLight(); };
  const setSat=on=>{ try{map.setLayoutProperty('sat','visibility',on?'visible':'none');}catch(_){} set($('vMap'),!on); set($('vSat'),on); };
  $('vMap').onclick=()=>setSat(false); $('vSat').onclick=()=>setSat(true);
  $('v3d').onclick=()=>{ stopOrbit(); is3d=!is3d; set($('v3d'),is3d); map.easeTo({pitch:Pch(),bearing:B(),duration:600}); };
  $('vOrbit').onclick=()=>{ if(orbiting){ stopOrbit(); map.stop(); } else { orbiting=true; set($('vOrbit'),true); if(!is3d){ is3d=true; set($('v3d'),true); map.jumpTo({pitch:58}); } spin(); } };
  $('vReset').onclick=()=>{ stopOrbit(); fit(true); };
  const act=tr=>{ stopOrbit();
    if(tr.dataset.line!=null){const i=+tr.dataset.line,l=lines[i];map.easeTo({center:mid(l),duration:600});showLine(i);} else {const i=+tr.dataset.anchor,a=anchors[i];map.easeTo({center:[+a.lon,+a.lat],zoom:Math.max(map.getZoom(),16),duration:600});showAnchor(i);} };
  return {act,resize:()=>map.resize()};
}

/* ---------- platform home: all objects with counts, a type filter and a text filter ---------- */
function renderIndex(){
  document.title='Digital twins, ZAG Digital Atlas';
  const groups={}; for(const f of D.features){const k=f.properties.object_type||'other';(groups[k]=groups[k]||[]).push(f.properties);}
  const order=[...GROUP_ORDER.filter(k=>groups[k]),...Object.keys(groups).filter(k=>!GROUP_ORDER.includes(k))];
  const hasGeo=p=>!!(p.lines||p.line||D.gurs[p.id]);
  const nGeo=D.features.filter(f=>hasGeo(f.properties)).length, nExact=D.features.filter(f=>EXACT(f.properties.position_precision)).length;
  const nSpec=Object.values(D.twins).reduce((a,t)=>a+((t.specs||[]).length),0), nNews=Object.keys(D.news).filter(k=>(D.news[k]||[]).length).length;
  const card=p=>{const t=D.twins[p.id],n=t?(t.specs||[]).length:0;
    return `<a class="obj" href="twin.html?id=${encodeURIComponent(p.id)}" data-g="${esc(p.object_type||'other')}" data-q="${esc((p.name_en+' '+(p.name_sl||'')+' '+(p.locality||'')).toLowerCase())}"><b>${T(p.name_en||p.name)}</b><span>${T(p.locality||p.municipality||'')}</span>
      <div class="tags">${n?`<span class="tag">${n} ${n===1?'specification':'specifications'}</span>`:''}${hasGeo(p)?'<span class="tag ok">3D geometry</span>':''}${EXACT(p.position_precision)?'':'<span class="tag warn">approximate position</span>'}</div></a>`;};
  $('main').innerHTML=`<div class="wrap home"><h1>Digital twins</h1><p class="lead">Structures and sites where ZAG has documented work. Each opens its own sheet with a 3D view, key figures and specifications with sources.</p>
    <section class="dims" aria-label="Platform figures">
      <div class="dim"><div class="v">${D.features.length}</div><div class="k">objects</div></div>
      <div class="dim"><div class="v">${nGeo}</div><div class="k">with 3D geometry</div></div>
      <div class="dim"><div class="v">${nExact}</div><div class="k">placed exactly</div></div>
      <div class="dim"><div class="v">${num(nSpec)}</div><div class="k">sourced specifications</div></div>
      <div class="dim"><div class="v">${nNews}</div><div class="k">with recent news</div></div>
    </section>
    <div class="filters"><input class="find" id="find" type="search" placeholder="Filter by name or place" aria-label="Filter by name or place">
      <div class="pills" role="group" aria-label="Type"><button class="pill" type="button" data-g="" aria-pressed="true">All</button>${order.map(k=>`<button class="pill" type="button" data-g="${esc(k)}" aria-pressed="false">${esc(GROUP_NAME[k]||cap(k))} <i>${groups[k].length}</i></button>`).join('')}</div></div>
    <p class="note" id="count" aria-live="polite"></p>
    ${order.map(k=>`<section class="grp" data-g="${esc(k)}"><h3>${esc(GROUP_NAME[k]||cap(k))}</h3><div class="grid">${groups[k].map(card).join('')}</div></section>`).join('')}</div>`;
  let grp='', q='';
  const apply=()=>{ let n=0; document.querySelectorAll('.obj').forEach(a=>{ const ok=(!grp||a.dataset.g===grp)&&(!q||a.dataset.q.includes(q)); a.hidden=!ok; if(ok) n++; });
    document.querySelectorAll('.grp').forEach(s=>s.hidden=!s.querySelector('.obj:not([hidden])')); $('count').textContent=(grp||q)?`${n} of ${D.features.length} objects shown`:''; };
  $('find').oninput=e=>{ q=e.target.value.trim().toLowerCase(); apply(); };
  document.querySelectorAll('.pill').forEach(b=>b.onclick=()=>{ grp=b.dataset.g; document.querySelectorAll('.pill').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false')); apply(); });
}

if(new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');
if(!window.TWIN_NO_BOOT) (async()=>{
  try{ await load(); }catch(e){ $('main').innerHTML=`<p class="loading">${esc(e.message)}</p>`; return; }
  const id=new URLSearchParams(location.search).get('id')||location.hash.slice(1), f=id&&D.byId[id];
  if(id&&!f){ $('main').innerHTML=`<div class="wrap"><p>No object with the id "${esc(id)}". <a href="twin.html">See all objects</a>.</p></div>`; return; }
  if(f) renderTwin(f); else renderIndex();
})();
