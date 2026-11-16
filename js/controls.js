'use strict';
/* Controls: header sections, background and 3D switches, layers panel, rotate/tilt tool, zoom, north. */
const layersEl=$('layers');
function syncView(){
  document.querySelectorAll('#bgSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.bg===base));
  if($('bSat')){ $('bSat').setAttribute('aria-pressed',base==='sat'); $('bSat').title=base==='sat'?'Satellite imagery on. Click for the street map':'Satellite imagery. Click again for the street map'; }
  if($('b3d')){ $('b3d').setAttribute('aria-pressed',is3d); $('b3d').title=is3d?'3D view: relief and buildings. Click for a flat view':'Flat view. Click for 3D relief and buildings'; }
  /* the two view switches say which view is on, under their icons */
  { const sl=window.LANG==='sl', L=(b,t)=>{ const e=$(b)&&$(b).querySelector('.vlbl'); if(e) e.textContent=t; };
    L('bSat',base==='sat'?(sl?'Satelit':'Satellite'):base==='dof'?(sl?'Ortofoto':'Orthophoto'):(sl?'Zemljevid':'Map')); L('b3d',is3d?'3D':(sl?'Ravno':'Flat')); }
    const box=document.querySelector('.vctl'); if(box){ box.classList.add('lbl-on'); clearTimeout(window.__vlblT); window.__vlblT=setTimeout(()=>box.classList.remove('lbl-on'),5000); }
  document.querySelectorAll('input[name=lyBg]').forEach(r=>r.checked=r.value===base);
  document.querySelectorAll('input[name=lyViz]').forEach(r=>r.checked=(r.value==='3d')===is3d);
  $('lyBld').checked=bldOn();
  const t={map:'Map © OpenStreetMap contributors via OpenFreeMap, relief: Mapzen / AWS Terrain Tiles',
    sat:'Imagery: Esri World Imagery (capture dates vary by area)',dof:'Orthophoto: GURS DOF025, 2020-2022, CC BY 4.0, via Level2.si'}[base];
  $('srcnote').textContent=t; const sc=document.getElementById('stCredit'); if(sc) sc.textContent=t;
}
document.addEventListener('atlas:view',syncView);
document.addEventListener('atlas:selected',e=>{ if(e.detail&&phone()&&!layersEl.hidden){layersEl.hidden=true;$('bLayers').setAttribute('aria-expanded',false);} });
document.querySelectorAll('#bgSeg button').forEach(b=>b.onclick=()=>{ theme='light'; setBase(b.dataset.bg); });
document.querySelectorAll('input[name=lyBg]').forEach(r=>r.onchange=()=>{ if(r.value==='map') theme='light'; setBase(r.value); });
document.querySelectorAll('input[name=lyViz]').forEach(r=>r.onchange=()=>set3d(r.value==='3d'));
if($('b3d')) $('b3d').onclick=()=>set3d(!is3d);
if($('bSat')) $('bSat').onclick=()=>{ theme='light'; setBase(base==='sat'?'map':'sat'); };
$('lyBld').onchange=e=>setBuildings(e.target.checked);
$('lyProj').onchange=e=>{ZA.showProj=e.target.checked;refreshProjects();};
$('lyFac').onchange=e=>{ZA.showFac=e.target.checked;refreshProjects();};
$('bLayers').onclick=function(){const o=layersEl.hidden;layersEl.hidden=!o;this.setAttribute('aria-expanded',o);};
/* the layers panel closes with its own button, with Esc, or by clicking the map */
const closeLayers=()=>{ if(layersEl.hidden) return; layersEl.hidden=true; $('bLayers').setAttribute('aria-expanded',false); };
if($('layersX')) $('layersX').onclick=closeLayers;
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeLayers(); });
document.addEventListener('pointerdown',e=>{ if(!layersEl.hidden&&!layersEl.contains(e.target)&&!e.target.closest('#bLayers')&&e.target.closest('#map')) closeLayers(); });

document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{
  if(b.dataset.nav==='about'){$('about').showModal();return;}
  ZA.nav=b.dataset.nav; syncNav(); refreshProjects(); openList();
});
document.querySelectorAll('[data-ic]').forEach(i=>{ i.innerHTML=ICON[i.dataset.ic]||''; });
function syncNav(){document.querySelectorAll('#nav button').forEach(b=>{const on=b.dataset.nav===ZA.nav;b.setAttribute('aria-pressed',on&&b.dataset.nav!=='about');});}
document.addEventListener('atlas:nav',syncNav);

const nudge=d=>{ if(!map) return; orbitOn=false; userMoved=true; map.easeTo({bearing:map.getBearing()+(d.b||0),pitch:Math.max(0,Math.min(80,map.getPitch()+(d.p||0))),duration:350,essential:true}); };
$('rotL').onclick=()=>nudge({b:-30}); $('rotR').onclick=()=>nudge({b:30});
$('tiltU').onclick=()=>{ if(!is3d) set3d(true); nudge({p:12}); }; $('tiltD').onclick=()=>nudge({p:-12});
$('north').onclick=()=>map&&map.easeTo({bearing:0,duration:500});
/* the floating controls fade after five seconds without a pointer, key or touch, so the map stays clean; anything hovered stays clear.
   Off with the display setting "Keep map controls visible" (html.a11y-keep). */
(function(){ let t=null; const wake=()=>{ document.body.classList.remove('idle'); clearTimeout(t); t=setTimeout(()=>{ if(!document.documentElement.classList.contains('a11y-keep')) document.body.classList.add('idle'); },5000); };
  ['pointermove','pointerdown','keydown','touchstart','wheel','focusin'].forEach(e=>document.addEventListener(e,wake,{passive:true})); wake(); })();
$('zin').onclick=()=>map&&map.zoomIn(); $('zout').onclick=()=>map&&map.zoomOut();
$('zhome').onclick=()=>{ closeInfo(); closeList(); if(map) home(); };
/* Esc closes the top-most panel, unless the cursor is in a text field or the chat */
document.addEventListener('keydown',e=>{ if(e.key!=='Escape') return; const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable||t.closest('.zb,dialog,.tips'))) return;
  if(!info.hidden){ closeInfo(); return; } if(!listEl.hidden){ $('listX').click(); } });
const fitHeader=()=>document.documentElement.style.setProperty('--hdr',document.querySelector('.hdr').offsetHeight+'px');
fitHeader();
let rz; addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{fitHeader();if(map)map.resize();},150);});

/* short hints beside the map buttons: on hover or keyboard focus, and all together for a few seconds on the first visit */
(function(){ const box=document.querySelector('.vctl'); if(!box) return; const sl=window.LANG==='sl';
  const TIP={b3d:sl?'3D relief in stavbe, ali ravni pogled':'3D relief and buildings, or flat',bSat:sl?'Satelit ali zemljevid':'Satellite or map',zin:sl?'Povečaj':'Zoom in',zout:sl?'Pomanjšaj':'Zoom out',
    rotL:sl?'Zavrti levo':'Rotate left',rotR:sl?'Zavrti desno':'Rotate right',tiltU:sl?'Bolj poševno':'Tilt up',tiltD:sl?'Bolj od zgoraj':'Tilt down',north:sl?'Sever gor':'North up',zhome:sl?'Vsa Slovenija':'All of Slovenia',bMeasure:sl?'Izmeri razdaljo':'Measure a distance'};
  for(const [id,t] of Object.entries(TIP)){ const b=document.getElementById(id); if(b) b.dataset.tip=t; }
  let seen=false; try{ seen=localStorage.getItem('zag_vtips')==='1'; }catch(_){}
  if(!seen&&innerWidth>700){ setTimeout(()=>{ box.classList.add('showtips'); setTimeout(()=>box.classList.remove('showtips'),5000); try{ localStorage.setItem('zag_vtips','1'); }catch(_){} },2500); }
})();
