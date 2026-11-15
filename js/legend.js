'use strict';
/* Legend of the main map, also a filter.
   Click a symbol or a colour to show only those records on the map, click it again to show all.
   Ctrl, Cmd or Shift click adds or removes one more. Quick filters pick records with news, a 3D model or an exact position.
   The map zooms to what is left, and the line at the bottom says how many are shown. */
(function(){
  const box=document.getElementById('lgd'), body=document.getElementById('lgdBody'), show=document.getElementById('lgdShow'), hide=document.getElementById('lgdHide'); if(!box||!body) return;
  const CAP=[[['bridge','footbridge','road structure'],'Bridges, viaducts and footbridges'],[['tunnel'],'Tunnels and underground structures'],[['dam / hydropower'],'Dams and hydropower plants'],[['cableway'],'Cableway installations'],[['tower / mast'],'Transmission and other towers'],
    [['building','company'],'Buildings and companies'],[['institution'],'Institutions'],[['landslide'],'Landslides'],[['geotechnical site'],'Geotechnical sites'],[['study area (earthquake)'],'Earthquake study areas'],[['other'],'Other sites']];
  const KINDS=[['doc','#007AFF','Blue: project with ZAG work'],['fac','#5856D6',"Violet: ZAG's own site"],['ref','#8E8E93','Grey: partner or referenced only']];
  const EXACT=new Set(['surveyed','address','matched']);
  const QUICK=[['news','With news this week',p=>{ try{ return recentNewsIds(7).includes(p.id); }catch(_){ return false; } }],
    ['model','With a 3D model',p=>!!(p.lines||p.line||(ZA.gurs&&ZA.gurs[p.id])||(ZA.twins&&ZA.twins[p.id]&&ZA.twins[p.id].model&&(ZA.twins[p.id].model.blocks||[]).length))],
    ['exact','Exact position',p=>EXACT.has(p.position_precision)]];
  const img=(t,k)=>{ try{ const d=markerImage(t,k), c=document.createElement('canvas'); c.width=d.width; c.height=d.height; c.getContext('2d').putImageData(d,0,0); return '<img alt="" width="26" height="26" src="'+c.toDataURL()+'">'; }catch(_){ return ''; } };
  const pref=()=>{ if(innerWidth<700) return true; try{ const v=localStorage.getItem('zag_lgd_hidden'); if(v===null) return innerWidth<1100; return v==='1'; }catch(_){ return innerWidth<1100; } };
  /* a choice made by hand is kept for wide screens only; the automatic fold on phones is never saved */
  const vis=on=>{ box.hidden=!on; show.hidden=on; };
  const set=on=>{ vis(on); if(innerWidth>=700) try{ localStorage.setItem('zag_lgd_hidden',on?'0':'1'); }catch(_){} };
  const sel={types:new Set(),kinds:new Set(),quick:new Set()};
  const kindOfP=p=>p.category==='zag_facility'?'fac':p.evidence_level==='documented'?'doc':'ref';

  function apply(zoom){
    ZA.onlyTypes=sel.types.size?new Set([...sel.types].flatMap(i=>CAP[i][0])):null;
    ZA.onlyKinds=sel.kinds.size?new Set(sel.kinds):null;
    ZA.onlyIds=sel.quick.size?new Set(ZA.features.map(f=>f.properties).filter(p=>[...sel.quick].every(q=>QUICK.find(x=>x[0]===q)[2](p))).map(p=>p.id)):null;
    refreshProjects(); paint();
    if(zoom&&typeof map!=='undefined'){ const vis=visibleFeatures(); if(vis.length){ const xs=vis.map(f=>f.geometry.coordinates[0]), ys=vis.map(f=>f.geometry.coordinates[1]);
      try{ if(vis.length===1) map.easeTo({center:[xs[0],ys[0]],zoom:Math.max(map.getZoom(),11),duration:700});
        else map.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:{top:120,bottom:120,left:260,right:120},maxZoom:11,duration:700}); }catch(_){} } } }
  /* filters set elsewhere: section, timeline, layers */
  const others=()=>{ const o=[]; if(ZA.nav&&ZA.nav!=='projects') o.push(({buildings:'Buildings',bridges:'Bridges',infrastructure:'Infrastructure'})[ZA.nav]||ZA.nav); if(ZA.upTo!=null) o.push('up to '+ZA.upTo); if(ZA.showProj===false) o.push('projects hidden'); if(ZA.showFac===false) o.push('ZAG sites hidden'); return o; };
  function clearAll(){ sel.types.clear(); sel.kinds.clear(); sel.quick.clear();
    if(ZA.nav&&ZA.nav!=='projects'){ ZA.nav='projects'; try{ syncNav(); closeList(); }catch(_){} }
    if(ZA.upTo!=null){ const a=document.getElementById('tlAll'); if(a) a.click(); }
    ['lyProj','lyFac'].forEach(id=>{ const c=document.getElementById(id); if(c&&!c.checked){ c.checked=true; c.dispatchEvent(new Event('change')); } });
    apply(true); }
  function paint(){
    const own=sel.types.size||sel.kinds.size||sel.quick.size, oth=others(), any=own||oth.length, n=visibleFeatures().length, all=ZA.features.length;
    box.classList.toggle('filtering',!!any);
    body.querySelectorAll('.lgr[data-g]').forEach(r=>{ const g=r.dataset.g, v=r.dataset.v, on=g==='t'?sel.types.has(+v):g==='k'?sel.kinds.has(v):sel.quick.has(v); r.classList.toggle('on',on); r.setAttribute('aria-pressed',String(on)); });
    const st=box.querySelector('.lgstat'); if(st) st.innerHTML=any?`<b>Showing ${n} of ${all}</b>${oth.length?`<span class="lgoth">Also filtered: ${oth.join(', ')}</span>`:''} <button type="button" class="lgall">Show all</button>`:'';
  }
  function toggle(group,key,add){
    const S=group==='t'?sel.types:group==='k'?sel.kinds:sel.quick, k=group==='t'?+key:key;
    if(add){ S.has(k)?S.delete(k):S.add(k); }
    else{ const only=S.size===1&&S.has(k); if(group!=='q'){ sel.types.clear(); sel.kinds.clear(); } S.clear(); if(!only) S.add(k); }
    apply(true);
  }
  function build(){
    const P=ZA.features.map(f=>f.properties), have=new Set(P.map(p=>p.object_type));
    const cnt=f=>P.filter(f).length;
    const rows=CAP.map((c,i)=>[c,i]).filter(([[ts]])=>ts.some(t=>have.has(t))).map(([[ts,cap],i])=>`<button type="button" class="lgr" data-g="t" data-v="${i}" aria-pressed="false">${img(ts.find(t=>have.has(t)),'doc')}<span>${cap}</span><em>${cnt(p=>ts.includes(p.object_type))}</em></button>`).join('');
    const kinds=KINDS.map(([k,col,cap])=>`<button type="button" class="lgr" data-g="k" data-v="${k}" aria-pressed="false"><i class="lgdot" style="background:${col}"></i><span>${cap}</span><em>${cnt(p=>kindOfP(p)===k)}</em></button>`).join('');
    const quick=QUICK.map(([k,cap,f])=>`<button type="button" class="lgr" data-g="q" data-v="${k}" aria-pressed="false"><i class="lgq lgq-${k}"></i><span>${cap}</span><em>${cnt(f)}</em></button>`).join('');
    body.innerHTML='<p class="lgstat" aria-live="polite"></p><h4>Symbols</h4>'+rows+'<h4>Colours</h4>'+kinds+'<h4>Quick filters</h4>'+quick+'<h4 class="lgpos">Position</h4><div class="lgr lgposr">'+(()=>{ try{ const d=markerImage('other','doc',true), c=document.createElement('canvas'); c.width=d.width; c.height=d.height; c.getContext('2d').putImageData(d,0,0); return '<img alt="" width="26" height="26" src="'+c.toDataURL()+'">'; }catch(_){ return ''; } })()+'<span>Lighter with a dashed ring: approximate position, the centre of an area and not the object</span></div><h4>Numbers</h4><div class="lgr lgnote"><i class="lgnum">5</i><span>Several records close together. Click to zoom in</span></div>';
    body.addEventListener('click',e=>{ if(e.target.closest('.lgall')){ clearAll(); return; }
      const r=e.target.closest('.lgr[data-g]'); if(r) toggle(r.dataset.g,r.dataset.v,e.ctrlKey||e.metaKey||e.shiftKey); });
    box.title='';
    vis(!pref()); paint();
  }
  hide.addEventListener('click',()=>set(false)); show.addEventListener('click',()=>set(true));
  /* the legend can be moved: drag it by its header; it keeps the place in this browser, a double click on the header puts it back */
  (function drag(){ const head=box.querySelector('header'); if(!head) return; const KEY='zag_lgd_pos';
    const clampTo=(x,y)=>{ const P=box.offsetParent||document.body, pr=P.getBoundingClientRect(), w=box.offsetWidth, h=box.offsetHeight; return [Math.max(4,Math.min(x,pr.width-w-4)),Math.max(4,Math.min(y,pr.height-h-4))]; };
    const place=(x,y)=>{ [x,y]=clampTo(x,y); box.style.left=x+'px'; box.style.top=y+'px'; box.style.bottom='auto'; box.style.setProperty('animation','none'); box.classList.add('moved'); };
    try{ const v=JSON.parse(localStorage.getItem(KEY)||'null'); if(v&&innerWidth>=700) requestAnimationFrame(()=>place(v.x,v.y)); }catch(_){}
    let st=null;
    head.style.cursor='grab'; head.style.touchAction='none';
    head.addEventListener('pointerdown',e=>{ if(e.button!==0||e.target.closest('button')||innerWidth<700) return; const r=box.getBoundingClientRect(), pr=(box.offsetParent||document.body).getBoundingClientRect(), z=parseFloat(getComputedStyle(box).zoom)||1;
      st={dx:e.clientX-r.left,dy:e.clientY-r.top,pl:pr.left,pt:pr.top,z,moved:false}; head.setPointerCapture(e.pointerId); head.style.cursor='grabbing'; });
    head.addEventListener('pointermove',e=>{ if(!st) return; st.moved=true; place((e.clientX-st.dx-st.pl)/st.z,(e.clientY-st.dy-st.pt)/st.z); });
    const end=e=>{ if(!st) return; head.style.cursor='grab'; try{ head.releasePointerCapture(e.pointerId); }catch(_){} if(st.moved) try{ localStorage.setItem(KEY,JSON.stringify({x:parseFloat(box.style.left),y:parseFloat(box.style.top)})); }catch(_){} st=null; };
    head.addEventListener('pointerup',end); head.addEventListener('pointercancel',end);
    head.addEventListener('dblclick',e=>{ if(e.target.closest('button')) return; box.style.left=box.style.top=box.style.bottom=''; box.style.removeProperty('animation'); box.classList.remove('moved'); try{ localStorage.removeItem(KEY); }catch(_){} });
    head.title=(window.LANG==='sl'?'Povlecite, da premaknete legendo. Dvojni klik jo vrne na mesto.':'Drag to move the legend. Double click puts it back.'); })();
  const wait=setInterval(()=>{ if(typeof ZA!=='undefined'&&ZA.features&&ZA.features.length&&typeof markerImage==='function'){ clearInterval(wait); build(); } },300);
  window.addEventListener('zag:news',()=>{ try{ paint(); }catch(_){} });
  /* repaint whenever any filter changes the map */
  document.addEventListener('atlas:filtered',()=>{ try{ if(body.querySelector('.lgstat')) paint(); }catch(_){} });
})();
