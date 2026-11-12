'use strict';
/* Add object tool. Runs fully in the browser: no server and no AI. It takes a shape (drawn, pasted or from a file) and optional dimensions,
   builds the same schematic model as the twin pages, and saves the object in this browser. Uses helpers and the model code from twin.js. */
const A={mode:'line',pts:[],map:null,fem:null,timer:0};
const HELP={line:'Line: for a bridge, tunnel, cableway or dam. Add at least two points along the structure.',poly:'Outline: for a building. Add the corners in order. The outline closes itself.',point:'Point: for a tower or a site without a shape. One point.'};
const say=(t,k)=>{ const m=$('msg'); m.textContent=t; m.className='msg'+(k?' '+k:''); };
const numv=id=>{ const v=parseFloat(String($(id).value).replace(',','.')); return isFinite(v)&&v>0?v:null; };
const okPt=c=>Array.isArray(c)&&isFinite(c[0])&&isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90;

/* ---------- readers: every reader returns {pts:[[lon,lat]...], kind, name, fields} ---------- */
function fromGeoJSON(j){ const fs=j.type==='FeatureCollection'?j.features:j.type==='Feature'?[j]:[{type:'Feature',properties:{},geometry:j}];
  for(const f of fs){ const g=f&&f.geometry; if(!g) continue; const name=f.properties&&(f.properties.name||f.properties.name_en)||null;
    if(g.type==='LineString') return {pts:g.coordinates,kind:'line',name}; if(g.type==='MultiLineString') return {pts:g.coordinates[0],kind:'line',name};
    if(g.type==='Polygon') return {pts:g.coordinates[0].slice(0,-1),kind:'poly',name}; if(g.type==='MultiPolygon') return {pts:g.coordinates[0][0].slice(0,-1),kind:'poly',name};
    if(g.type==='Point') return {pts:[g.coordinates],kind:'point',name}; }
  return null; }
function fromXML(txt){ const d=new DOMParser().parseFromString(txt,'application/xml'); if(d.querySelector('parsererror')) return null;
  const name=(d.querySelector('Placemark > name, trk > name, rte > name, name')||{}).textContent||null;
  const gp=[...d.querySelectorAll('trkpt, rtept')].map(e=>[+e.getAttribute('lon'),+e.getAttribute('lat')]); if(gp.length) return {pts:gp,kind:gp.length>1?'line':'point',name};
  const co=d.querySelector('Polygon coordinates, LineString coordinates, Point coordinates, coordinates'); if(!co) return null;
  const pts=co.textContent.trim().split(/\s+/).map(s=>s.split(',').map(Number)).map(a=>[a[0],a[1]]); const poly=!!co.closest('Polygon');
  return {pts:poly?pts.slice(0,-1):pts,kind:poly?'poly':pts.length>1?'line':'point',name}; }
function fromText(txt){ const fields={}, pts=[]; let lonFirst=false;
  const head=txt.split(/\r?\n/)[0].toLowerCase(); if(/lon|lng|\bx\b/.test(head)&&/lat|\by\b/.test(head)) lonFirst=head.search(/lon|lng|\bx\b/)<head.search(/lat|\by\b/);
  for(const raw of txt.split(/\r?\n/)){ const line=raw.trim(); if(!line) continue;
    const kv=/^([a-zA-Z ]{2,20})\s*[:=]\s*(.+)$/.exec(line); if(kv&&!/^-?\d/.test(kv[2].replace(/\s/g,''))||kv&&/^(name|type|description|source|length|width|height)$/i.test(kv[1].trim())){ fields[kv[1].trim().toLowerCase()]=kv[2].trim(); continue; }
    const m=line.match(/-?\d+(?:[.,]\d+)?/g); if(!m||m.length<2) continue; const a=parseFloat(m[0].replace(',','.')), b=parseFloat(m[1].replace(',','.'));
    pts.push(lonFirst?[a,b]:[b,a]); }
  return {pts,kind:pts.length>2&&/build|outline/i.test(fields.type||'')?'poly':pts.length>1?'line':'point',name:fields.name||null,fields}; }
function readAny(name,txt){ const ext=(name.split('.').pop()||'').toLowerCase(); let r=null;
  if(ext==='json'||ext==='geojson'||/^\s*\{/.test(txt)){ try{ r=fromGeoJSON(JSON.parse(txt)); }catch(_){ r=null; } }
  else if(ext==='kml'||ext==='gpx'||/^\s*</.test(txt)) r=fromXML(txt);
  if(!r) r=fromText(txt);
  if(r) r.pts=(r.pts||[]).map(c=>[+c[0],+c[1]]).filter(okPt);
  return r; }

/* ---------- state to feature ---------- */
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,30)||'object';
function feature(id){ const pts=A.pts, n=pts.length, c=[pts.reduce((a,p)=>a+p[0],0)/n,pts.reduce((a,p)=>a+p[1],0)/n], name=$('fName').value.trim()||'Unnamed object', src=$('fSrc').value.trim();
  const p={id:id||('user_'+slug(name)+'_'+Date.now().toString(36)),category:'user_object',name,name_en:name,name_sl:null,object_type:$('fType').value,description:$('fDesc').value.trim()||null,locality:'',municipality:'',
    latitude:c[1],longitude:c[0],year:null,zag_role:null,zag_involvement_types:[],sources:/^https?:\/\//i.test(src)?[{key:'user',title:'Source given by the user',url:src,type:'web'}]:[],evidence_level:'user',position_precision:'user',structure:{},
    created:new Date().toISOString(),user:{length:numv('fLen'),width:numv('fWid'),height:numv('fHei')}};
  if(A.ai) p.user.ai=true;
  if(A.mode==='line'&&n>1){ p.lines=[pts.slice()]; p.line_labels=[name]; if(!p.user.length) p.user.length=Math.round(lineLen(pts)*10)/10; }
  if(A.mode==='poly'&&n>2) p.user.polygon=[...pts,pts[0]];
  return {type:'Feature',geometry:{type:'Point',coordinates:c},properties:p}; }
const enough=()=>A.mode==='line'?A.pts.length>1:A.mode==='poly'?A.pts.length>2:A.pts.length===1;

/* ---------- preview ---------- */
function preview(){ clearTimeout(A.timer); A.timer=setTimeout(()=>{
  if(A.fem){ A.fem.sleep(); A.fem=null; }
  const body=$('pbody'); body.innerHTML='<canvas id="fem" tabindex="0" aria-label="Model preview"></canvas><aside class="pickbox" id="pick" aria-live="polite"><b>Model</b><p>The model appears when the shape has enough points.</p></aside>';
  drawShape();
  if(!A.pts.length||A.mode==='point'||!enough()){ $('snote').textContent=A.mode==='point'?'A point has no model. It is placed on the map as a marker.':'A line needs two points and an outline needs three.'; return; }
  const f=feature('user_preview'), p=f.properties, u=p.user, t={specs:u.width&&A.mode==='line'?[{label:'Width',value:String(u.width),unit:'m'}]:[],anchors:[]};
  const g=u.polygon?{user:true,geometry:{type:'Polygon',coordinates:[u.polygon]},height_m:u.height}:null, M=buildModel(p,t,g,p.lines||[],p.line_labels||[]);
  if(!M.els.length) return; $('snote').textContent=M.note; A.fem=initModel(M,p);
},160); }
function drawShape(){ const m=A.map; if(!m||!m.getSource('shape')) return; const fs=A.pts.map(c=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:c}}));
  if(A.mode!=='point'&&A.pts.length>1) fs.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:A.mode==='poly'&&A.pts.length>2?[...A.pts,A.pts[0]]:A.pts}});
  m.getSource('shape').setData({type:'FeatureCollection',features:fs}); }
function syncText(){ $('fPts').value=A.pts.map(c=>c[1].toFixed(6)+', '+c[0].toFixed(6)).join('\n'); }
function setMode(k){ A.mode=k; for(const [id,v] of [['gLine','line'],['gPoly','poly'],['gPoint','point']]) $(id).setAttribute('aria-pressed',v===k?'true':'false'); $('gHelp').textContent=HELP[k]; if(k==='point'&&A.pts.length>1) A.pts=[A.pts[0]]; syncText(); preview(); }
function setPts(pts,fit){ A.pts=pts; syncText(); preview(); if(fit&&A.map&&pts.length){ const b=pts.reduce((bb,c)=>bb.extend(c),new maplibregl.LngLatBounds(pts[0],pts[0])); A.map.fitBounds(b,{padding:60,maxZoom:17,duration:0}); } }

/* ---------- my objects ---------- */
function store(fc){ try{ localStorage.setItem(USER_KEY,JSON.stringify(fc)); return true; }catch(_){ say('This browser did not allow saving. Download the file to keep the object.','bad'); return false; } }
function listMine(){ const fc=localUser(), box=$('mine'); box.innerHTML=fc.features.length?fc.features.map(f=>{ const p=f.properties; return `<div class="it"><b>${T(p.name_en||p.name)}</b><span class="tag warn">not verified</span>${p.user&&p.user.ai?'<span class="tag warn">AI draft</span>':''}<span class="tag">${esc(p.object_type)}</span><a class="tbtn" href="twin.html?id=${encodeURIComponent(p.id)}">Open the twin</a><button class="tbtn danger" type="button" data-rm="${esc(p.id)}">Remove</button></div>`; }).join(''):'<p class="note">No objects yet.</p>';
  box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ const fc2=localUser(); fc2.features=fc2.features.filter(f=>f.properties.id!==b.dataset.rm); store(fc2); listMine(); say('Object removed from this browser.'); }); }

/* ---------- wiring ---------- */
$('gLine').onclick=()=>setMode('line'); $('gPoly').onclick=()=>setMode('poly'); $('gPoint').onclick=()=>setMode('point');
$('fType').onchange=()=>setMode($('fType').value==='building'?'poly':/tower|other/.test($('fType').value)?'point':'line');
for(const id of ['fLen','fWid','fHei','fName']) $(id).addEventListener('input',preview);
$('fPts').addEventListener('change',()=>{ const r=fromText($('fPts').value); const pts=r.pts.filter(okPt); A.pts=A.mode==='point'?pts.slice(0,1):pts; preview(); if(A.map&&A.pts.length) setPts(A.pts,true); say(pts.length?pts.length+' points read from the text.':'No coordinates found in the text.',pts.length?'':'bad'); });
$('undo').onclick=()=>{ A.pts.pop(); syncText(); preview(); }; $('clear').onclick=()=>{ A.pts=[]; syncText(); preview(); say('Shape cleared.'); };
$('fFile').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; if(f.size>2e6){ say('The file is larger than 2 MB. Use a smaller file.','bad'); return; }
  const r=readAny(f.name,await f.text()); if(!r||!r.pts.length){ say('No coordinates were found in this file.','bad'); return; }
  if(r.name&&!$('fName').value) $('fName').value=r.name; const F=r.fields||{};
  if(F.description&&!$('fDesc').value) $('fDesc').value=F.description; if(F.source&&!$('fSrc').value) $('fSrc').value=F.source;
  for(const [k,id] of [['length','fLen'],['width','fWid'],['height','fHei']]) if(F[k]&&!$(id).value){ const v=parseFloat(F[k].replace(',','.')); if(isFinite(v)) $(id).value=v; }
  if(F.type){ const o=[...$('fType').options].find(o=>o.value.includes(F.type.toLowerCase())||o.textContent.toLowerCase().includes(F.type.toLowerCase())); if(o) $('fType').value=o.value; }
  A.mode=r.kind; setMode(r.kind); setPts(r.kind==='point'?r.pts.slice(0,1):r.pts,true);
  const far=r.pts.some(c=>c[0]<13.2||c[0]>16.8||c[1]<45.3||c[1]>47); say(r.pts.length+' points read from '+f.name+'.'+(far?' Some points lie outside Slovenia. Check the order of latitude and longitude.':''),far?'bad':'good'); };
$('form').onsubmit=e=>{ e.preventDefault(); if(!$('fName').value.trim()){ say('Give the object a name.','bad'); $('fName').focus(); return; } if(!enough()){ say(A.mode==='line'?'A line needs at least two points.':A.mode==='poly'?'An outline needs at least three points.':'Add one point.','bad'); return; }
  const fc=localUser(), f=feature(); fc.features.push(f); if(!store(fc)) return; listMine(); say('Saved in this browser as not verified. Open its twin from the list below, or see it on the map.','good'); };
$('dl').onclick=()=>{ const fc=localUser(); if(!fc.features.length){ say('There are no objects to download yet.','bad'); return; } const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(fc,null,1)],{type:'application/json'})); a.download='user_objects.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); };
$('imp').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; try{ const j=JSON.parse(await f.text()), fc=localUser(), have=new Set(fc.features.map(x=>x.properties.id)); let n=0;
    for(const x of j.features||[]) if(x&&x.properties&&/^user_[a-z0-9_]+$/.test(x.properties.id||'')&&!have.has(x.properties.id)){ fc.features.push(x); n++; } store(fc); listMine(); say(n+' objects loaded from the file.','good'); }catch(_){ say('This file could not be read as saved objects.','bad'); } };

(function initMap(){ const box=$('amap'); if(typeof maplibregl==='undefined'){ box.innerHTML='<div class="vfail">The map could not load. Paste coordinates or load a file instead.</div>'; return; }
  let m; try{ m=new maplibregl.Map({container:box,style:STYLE_URL,center:[14.82,46.12],zoom:7.2,attributionControl:{compact:true}}); }catch(_){ box.innerHTML='<div class="vfail">The map is not available in this browser. Paste coordinates or load a file instead.</div>'; return; }
  m.addControl(new maplibregl.NavigationControl(),'top-right'); m.getCanvas().style.cursor='crosshair';
  { const paint=()=>{ try{ if(window.iosMap) iosMap(m); }catch(_){} }; m.on('style.load',paint); m.once('load',paint); }
  m.on('load',()=>{ m.addSource('shape',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    m.addLayer({id:'shape-l',type:'line',source:'shape',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#007AFF','line-width':4}});
    m.addLayer({id:'shape-p',type:'circle',source:'shape',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':5,'circle-color':'#fff','circle-stroke-color':'#203469','circle-stroke-width':2.5}});
    A.map=m; drawShape(); });
  m.on('click',e=>{ const c=[+e.lngLat.lng.toFixed(6),+e.lngLat.lat.toFixed(6)]; if(A.mode==='point') A.pts=[c]; else A.pts.push(c); syncText(); preview(); say(A.pts.length+(A.pts.length===1?' point':' points')+' on the map.'); }); })();
setMode('line'); listMine();
/* ---------- optional AI reader: sends the text or picture to the owner's service, which holds the AI key. Nothing here knows the key. ---------- */
const AI={url:''};
const aiSay=(t,k)=>{ const m=$('aiState'); m.textContent=t; m.className='msg'+(k?' '+k:''); };
const b64=file=>new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(',')[1]||''); r.onerror=rej; r.readAsDataURL(file); });
async function aiInit(){ let url=''; try{ const j=await getJSON('data/ai_service.json'); if(j&&/^https:\/\//.test(j.url||'')) url=j.url; }catch(_){}
  const fixed=!!url; if(!url){ try{ url=localStorage.getItem('zag_ai_url')||''; }catch(_){} }
  AI.url=url.replace(/\/+$/,''); $('aiUrl').value=AI.url; $('aiUrlRow').hidden=fixed; try{ $('aiCode').value=sessionStorage.getItem('zag_ai_code')||''; }catch(_){}
  aiSay(AI.url?'The AI reader is connected. Enter the access code, add a text or a picture, and press Read with AI.':'The AI reader is not connected yet. The owner sets its address in data/ai_service.json, or you can paste a service address here to try it.'); }
function aiShow(d){ const lab={name:'Name',object_type:'Type',description:'Description',length_m:'Length',width_m:'Width',height_m:'Height',coordinates:'Coordinates',shape:'Shape',place_name:'Place',source_url:'Source link'};
  $('aiOut').innerHTML=`<div class="aiout"><p class="msg bad" style="margin:0 0 4px">Draft read by AI. Check every value against your source before saving. It is not verified.</p>
    <h3>Where each value was read</h3>${d.evidence.length?`<ul>${d.evidence.map(e=>`<li>${T(lab[e.field]||e.field)}: <q>${T(e.quote)}</q></li>`).join('')}</ul>`:'<p class="note">The AI gave no quotes for its values. Treat them with extra care.</p>'}
    ${d.missing.length?`<h3>Not in your input</h3><ul>${d.missing.map(x=>`<li>${T(x)}</li>`).join('')}</ul>`:''}</div>`; }
async function aiApply(d){ A.ai=true; const filled=[]; const put=(id,v,name)=>{ if(v!=null&&v!==''){ $(id).value=v; filled.push(name); } };
  put('fName',d.name,'name'); put('fDesc',d.description,'description'); put('fSrc',d.source_url,'source link'); put('fLen',d.length_m,'length'); put('fWid',d.width_m,'width'); put('fHei',d.height_m,'height');
  if([...$('fType').options].some(o=>o.value===d.object_type)){ $('fType').value=d.object_type; filled.push('type'); }
  const pts=(d.coordinates||[]).map(c=>[c[1],c[0]]).filter(okPt);
  if(pts.length){ const k=d.shape==='outline'&&pts.length>2?'poly':pts.length===1||d.shape==='point'?'point':'line'; setMode(k); setPts(k==='point'?pts.slice(0,1):pts,true); filled.push(pts.length+' coordinates'); }
  else { setMode(d.object_type==='building'?'poly':/tower|other/.test(d.object_type)?'point':'line');
    if(d.place_name&&A.map){ try{ const r=await fetch('https://photon.komoot.io/api/?limit=1&q='+encodeURIComponent(d.place_name)); const j=r.ok?await r.json():null, f=j&&j.features&&j.features[0]; if(f){ A.map.flyTo({center:f.geometry.coordinates,zoom:15,duration:800}); say('The map moved to '+d.place_name+'. The AI does not place objects from a name, so draw the shape yourself.'); } }catch(_){} } }
  preview(); aiShow(d); aiSay('Draft filled in: '+(filled.join(', ')||'nothing usable was found')+'.',filled.length?'good':'bad'); }
$('aiGo').onclick=async()=>{ const url=($('aiUrl').value.trim()||AI.url).replace(/\/+$/,''), code=$('aiCode').value, btn=$('aiGo');
  if(!/^https:\/\//.test(url)){ aiSay('Enter the address of the AI reader service. It starts with https.','bad'); return; } if(!code){ aiSay('Enter the access code.','bad'); $('aiCode').focus(); return; }
  let text=$('aiText').value.trim(), image=null; const f=$('aiFile').files[0];
  try{ if(f){ if(/^image\//.test(f.type)){ if(f.size>4e6){ aiSay('The picture is larger than 4 MB. Use a smaller one.','bad'); return; } image={media_type:f.type,data:await b64(f)}; } else { if(f.size>2e5){ aiSay('The text file is larger than 200 kB. Paste the relevant part instead.','bad'); return; } text=(text?text+'\n\n':'')+(await f.text()); } } }catch(_){ aiSay('The file could not be read.','bad'); return; }
  if(!text&&!image){ aiSay('Add a description, a text file or a picture first.','bad'); return; }
  btn.disabled=true; aiSay('Reading. This can take up to half a minute.');
  try{ const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(),60000);
    const r=await fetch(url+'/convert',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+code},body:JSON.stringify({text:text.slice(0,20000),image}),signal:ctl.signal}); clearTimeout(to);
    let j=null; try{ j=await r.json(); }catch(_){}
    if(!r.ok||!j||!j.draft){ aiSay((j&&j.error)||'The AI reader answered with an error ('+r.status+').','bad'); return; }
    try{ sessionStorage.setItem('zag_ai_code',code); localStorage.setItem('zag_ai_url',url); }catch(_){} AI.url=url; await aiApply(j.draft);
  }catch(e){ aiSay(e&&e.name==='AbortError'?'The AI reader took too long. Try again.':'The AI reader could not be reached. Check the address and that this site is allowed to use it.','bad'); }
  finally{ btn.disabled=false; } };
aiInit();

window.__add={state:A,readAny,feature};
