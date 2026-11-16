'use strict';
/* Laser scan buildings on the main map. For the records that have a GURS laser scan (data/lidar), the buildings are drawn
   from data/lidar_massing.json: blocks that follow the measured roofs, instead of the generic OpenStreetMap blocks.
   The file loads only when the map is close enough to see a building (zoom 14), and only in 3D. The selected record's
   buildings turn blue, so the plain blue block of the outline is not needed for it. */
(function(){
  const URL_='data/lidar_massing.json', MINZ=14, ACC='#2F86F6';
  let state='idle', ids=new Set();
  const sel=()=>{ try{ return typeof curId!=='undefined'?curId:null; }catch(_){ return null; } };
  const has=id=>id&&ids.has(id);
  function colour(){ const s=sel(); return ['case',['==',['get','id'],s||'__none__'],ACC,['interpolate',['linear'],['get','h'],2,'#C7CDD6',10,'#DADFE6',25,'#ECEFF3']]; }
  function sync(){
    if(state!=='ready'||!map.getLayer('lidar-ext')) return;
    map.setLayoutProperty('lidar-ext','visibility',is3d?'visible':'none');
    map.setPaintProperty('lidar-ext','fill-extrusion-color',colour());
    /* the selected record has its own measured buildings: its flat blue outline block steps aside */
    const own=has(sel());
    for(const id of ['hl-ext','hl-tile']) try{ if(map.getLayer(id)) map.setLayoutProperty(id,'visibility',own?'none':'visible'); }catch(_){}
  }
  async function load(){
    if(state!=='idle'||!ready||map.getZoom()<MINZ-0.5) return; state='loading';
    try{
      const r=await fetch(URL_); if(!r.ok) throw new Error(r.status); const fc=await r.json(), B=fc.band_m||.5, feats=[];
      for(const S of fc.sites){ ids.add(S.id); const ll=(i,j)=>[S.sw[0]+(S.se[0]-S.sw[0])*i/S.nx+(S.nw[0]-S.sw[0])*j/S.ny,S.sw[1]+(S.se[1]-S.sw[1])*i/S.nx+(S.nw[1]-S.sw[1])*j/S.ny];
        for(let k=0;k<S.r.length;k+=5){ const i=S.r[k], j=S.r[k+1], w=S.r[k+2], h=S.r[k+3]; feats.push({type:'Feature',properties:{id:S.id,h:Math.round(S.r[k+4]*B*10)/10},geometry:{type:'Polygon',coordinates:[[ll(i,j),ll(i+w,j),ll(i+w,j+h),ll(i,j+h),ll(i,j)]]}}); } }
      map.addSource('lidar',{type:'geojson',data:{type:'FeatureCollection',features:feats}});
      const firstSym=(map.getStyle().layers.find(l=>l.type==='symbol')||{}).id;
      map.addLayer({id:'lidar-ext',type:'fill-extrusion',source:'lidar',minzoom:MINZ,paint:{'fill-extrusion-color':colour(),'fill-extrusion-height':['get','h'],'fill-extrusion-base':0,'fill-extrusion-opacity':.97,'fill-extrusion-vertical-gradient':true}},firstSym);
      /* the generic map blocks inside these sites give way to the measured ones */
      if(fc.hulls&&fc.hulls.length&&map.getLayer('building-3d')){
        const mp={type:'MultiPolygon',coordinates:fc.hulls.map(s=>s.geometry.coordinates)}, not=['!',['within',mp]];
        try{ const f0=(typeof BASEF!=='undefined'&&'building-3d' in BASEF)?BASEF['building-3d']:map.getFilter('building-3d'); const f=f0?['all',f0,not]:not; if(typeof BASEF!=='undefined') BASEF['building-3d']=f; map.setFilter('building-3d',f); }catch(_){}
      }
      state='ready'; sync();
    }catch(e){ state='idle'; try{ console.warn('laser scan buildings:',e&&e.message); }catch(_){} }
  }
  /* the record's own selection code runs first, then the measured buildings follow it */
  if(typeof showBuilding==='function'){ const orig=showBuilding; showBuilding=function(b){ orig(b); sync(); }; }
  const start=()=>{ map.on('moveend',load); map.on('zoomend',load); load(); };
  const wait=setInterval(()=>{ if(typeof map!=='undefined'&&map&&typeof ready!=='undefined'&&ready){ clearInterval(wait); start(); } },400);
  window.__lidar={get state(){ return state; },load,sync};
  document.addEventListener('atlas:view',sync);
  document.addEventListener('atlas:select',sync);
})();
