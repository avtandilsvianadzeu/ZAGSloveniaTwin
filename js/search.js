'use strict';
/* Search: one box, grouped results: projects, buildings, bridges (local records) and locations (Photon geocoder). */
const qIn=$('q'), resEl=$('results');
const norm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
let qTimer=0, qSeq=0, locItems=[];
function matchLocal(q){
  /* every word typed must appear somewhere in the record (name, place, address, what it carries or crosses, ZAG work); names rank first */
  const words=norm(q).replace(/[^a-z0-9 ]+/g,' ').split(' ').filter(Boolean), out={projects:[],buildings:[],bridges:[]}, hits=[];
  for(const f of ZA.features){ const p=f.properties, tw=(ZA.twins&&ZA.twins[p.id])||{};
    const name=norm([p.name_en,p.name_sl,p.id].join(' ')).replace(/[^a-z0-9 ]+/g,' ');
    const hay=name+' '+norm([p.municipality,p.locality,p.address,p.structure&&p.structure.crosses,p.structure&&p.structure.carries,p.zag_role,tw.summary].join(' ')).replace(/[^a-z0-9 ]+/g,' ');
    if(!words.length||!words.every(w=>hay.includes(w))) continue;
    hits.push([f,words.every(w=>name.includes(w))?0:1]); }
  hits.sort((a,b)=>a[1]-b[1]).forEach(([f])=>{ const g=GROUPS[f.properties.object_type]; (g==='buildings'?out.buildings:g==='bridges'?out.bridges:out.projects).push(f); });
  return out;
}
/* coordinates typed in the box: decimal degrees (either order) or Slovenian D96/TM easting and northing */
function parseCoord(q){ const m=q.replace(/[°'"NSEW]/gi,' ').replace(/,/g,' ').trim().split(/\s+/).map(Number); if(m.length!==2||m.some(isNaN)) return null;
  let [a,b]=m; if(typeof isD96==='function'&&isD96(a,b)) return {ll:fromD96([a,b]),label:`D96/TM e ${Math.round(a)}, n ${Math.round(b)}`};
  if(typeof isD96==='function'&&isD96(b,a)) return {ll:fromD96([b,a]),label:`D96/TM e ${Math.round(b)}, n ${Math.round(a)}`};
  if(Math.abs(a)<=90&&Math.abs(b)<=180){ let lat=a, lon=b; if(lat<30&&lon>30){ lat=b; lon=a; } if(Math.abs(lat)<=90) return {ll:[lon,lat],label:`${lat.toFixed(6)}, ${lon.toFixed(6)}`}; }
  return null; }
function draw(local){
  const sec=(t,items)=>items.length?`<h4>${t}</h4>${items.join('')}`:'';
  const loc=f=>f.map((x,i)=>`<button role="option" data-loc="${i}"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></button>`);
  const rec=fs=>fs.slice(0,6).map(f=>`<button role="option" data-id="${esc(f.properties.id)}"><b>${esc(dispName(f.properties))}</b><small>${esc([typeof typeLabel==='function'?typeLabel(f.properties.object_type):cap(f.properties.object_type),f.properties.municipality,f.properties.year].filter(Boolean).join(', '))}</small></button>`);
  const cq=parseCoord(qIn.value.trim()), coordHTML=cq?`<h4>Coordinates</h4><button role="option" data-coord="1"><b>Go to ${esc(cq.label)}</b><small>${esc(cq.ll[1].toFixed(6)+', '+cq.ll[0].toFixed(6)+' WGS 84')}</small></button>`:'';
  const html=coordHTML+sec('Bridges',rec(local.bridges))+sec('Buildings',rec(local.buildings))+sec('Infrastructure and other sites',rec(local.projects))+sec('Locations',loc(locItems));
  resEl.innerHTML=html||'<div class="none">No matches</div>'; resEl.hidden=false;
  resEl.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{pick();showInfo(b.dataset.id);});
  resEl.querySelectorAll('[data-coord]').forEach(b=>b.onclick=()=>{ pick(); showAddress({type:'Feature',geometry:{type:'Point',coordinates:cq.ll},properties:{name:cq.label,osm_value:'coordinate'}}); });
  resEl.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{const x=locItems[+b.dataset.loc];pick();showAddress(x.f);});
}
function pick(){resEl.hidden=true;qIn.blur();}
async function geocode(q,seq,local){
  try{ const r=await fetch(`${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=5&bbox=13.3,45.4,16.7,46.9&lang=en`); if(!r.ok) return; const j=await r.json();
    if(seq!==qSeq) return;
    locItems=(j.features||[]).map(f=>{const p=f.properties;return{f,title:p.housenumber?fmtAddr(p):(p.name||fmtAddr(p)),sub:[p.osm_value&&!p.housenumber?cap(p.osm_value):'Address',p.city||p.county].filter(Boolean).join(', ')};});
    draw(local);
  }catch(_){}
}
qIn.addEventListener('input',()=>{
  const q=qIn.value.trim(); clearTimeout(qTimer); const seq=++qSeq; locItems=[];
  if(q.length<2){resEl.hidden=true;return;}
  const local=matchLocal(q); draw(local);
  if(q.length>=3) qTimer=setTimeout(()=>geocode(q,seq,local),450);
});
qIn.addEventListener('keydown',e=>{
  const btns=[...resEl.querySelectorAll('button')]; let i=btns.findIndex(b=>b.getAttribute('aria-selected')==='true');
  if(e.key==='Escape'){resEl.hidden=true;return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault(); if(!btns.length) return; if(i>=0) btns[i].removeAttribute('aria-selected'); i=e.key==='ArrowDown'?(i+1)%btns.length:(i-1+btns.length)%btns.length; btns[i].setAttribute('aria-selected','true'); btns[i].scrollIntoView({block:'nearest'});}
  else if(e.key==='Enter'){const b=btns[Math.max(i,0)]; if(b) b.click();}
});
document.addEventListener('click',e=>{ if(!e.target.closest('.hsearch')) resEl.hidden=true; });
