'use strict';
/* Objects added with the Add object tool, shown on the main map as their own layer. They come from data/user_objects.json (published)
   and from this browser. They are never mixed into the ZAG records and are always labelled as not verified. */
(function(){
  const KEY='zag_user_objects', ok=p=>p&&typeof p.id==='string'&&/^user_[a-z0-9_]+$/.test(p.id)&&isFinite(p.latitude)&&isFinite(p.longitude);
  async function collect(){ const out=[], seen=new Set(), add=l=>{ for(const f of l||[]) if(f&&ok(f.properties)&&!seen.has(f.properties.id)){ seen.add(f.properties.id); out.push(f); } };
    try{ const r=await fetch('data/user_objects.json'); if(r.ok) add((await r.json()).features); }catch(_){}
    try{ add((JSON.parse(localStorage.getItem(KEY)||'{}')).features); }catch(_){}
    return out; }
  function show(p){ const hasModel=!!(p.lines||(p.user&&p.user.polygon));
    openShell(`<div class="body"><div class="kicker ref">Added by a user, not verified</div><h1>${esc(p.name_en||p.name||'Unnamed object')}</h1>
      <p class="where">${esc(cap(p.object_type||'other'))}</p>
      <p><a class="btn twinlink" href="twin.html?id=${encodeURIComponent(p.id)}">Open digital twin</a></p>
      ${hasModel?`<iframe class="twinframe" loading="lazy" title="Model" src="twin.html?id=${encodeURIComponent(p.id)}&embed=1"></iframe>`:''}
      ${p.description?`<h3>About</h3><p>${esc(p.description)}</p>`:''}
      <h3>Position</h3>${kv('Basis','Placed by a user, not verified')}${kv('WGS84',(+p.latitude).toFixed(6)+', '+(+p.longitude).toFixed(6))}
      <p class="note">This object is not a ZAG record. It was added with the Add object tool and has not been checked against a source.</p></div>`);
    try{ showLine(null); setSel({id:null,ll:[+p.longitude,+p.latitude],label:p.name_en||p.name,glyph:'pin'}); }catch(_){}
    map.easeTo({center:[+p.longitude,+p.latitude],zoom:Math.max(map.getZoom(),15),duration:800}); }
  async function start(){ const feats=await collect(); if(!feats.length) return; const byId=Object.fromEntries(feats.map(f=>[f.properties.id,f.properties]));
    const shapes=[]; for(const f of feats){ const p=f.properties; for(const l of p.lines||[]) shapes.push({type:'Feature',properties:{id:p.id},geometry:{type:'LineString',coordinates:l}}); if(p.user&&p.user.polygon) shapes.push({type:'Feature',properties:{id:p.id},geometry:{type:'LineString',coordinates:p.user.polygon}}); }
    map.addSource('userobj',{type:'geojson',data:{type:'FeatureCollection',features:feats.map(f=>({type:'Feature',properties:{id:f.properties.id,name:f.properties.name_en||f.properties.name||''},geometry:{type:'Point',coordinates:[+f.properties.longitude,+f.properties.latitude]}}))}});
    map.addSource('userobj-s',{type:'geojson',data:{type:'FeatureCollection',features:shapes}});
    map.addLayer({id:'userobj-s',type:'line',source:'userobj-s',paint:{'line-color':'#FF9500','line-width':3,'line-dasharray':[2,1.5]}});
    map.addLayer({id:'userobj',type:'circle',source:'userobj',paint:{'circle-radius':7,'circle-color':'#FF9500','circle-stroke-color':'#ffffff','circle-stroke-width':2.5}});
    map.on('click','userobj',ev=>{ ev.preventDefault(); const p=byId[ev.features[0].properties.id]; if(p) show(p); });
    map.on('mouseenter','userobj',()=>map.getCanvas().style.cursor='pointer'); map.on('mouseleave','userobj',()=>map.getCanvas().style.cursor='');
    const h=decodeURIComponent(location.hash.slice(1)); if(byId[h]) show(byId[h]);
    window.__userobj={show,byId}; }
  let tries=0; const wait=setInterval(()=>{ tries++; let okNow=false; try{ okNow=typeof ready!=='undefined'&&ready&&!!map; }catch(_){}
    if(okNow){ clearInterval(wait); start().catch(()=>{}); } else if(tries>120) clearInterval(wait); },500);
})();
