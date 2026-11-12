/* Map colours in the iOS manner, applied to the OpenFreeMap style after it loads: warm paper land, soft green parks, clear light blue water,
   white streets with a faint edge, pale yellow main roads, quiet grey labels. Only colours change. Geometry, labels and data stay as served. */
window.iosMap=function(map){
  const C={land:'#F7F5F0',resid:'#F3F0EA',park:'#D3EDC8',wood:'#C5E6BA',water:'#A6D4F7',waterLbl:'#3F8DCB',bld:'#E9E5DD',bldEdge:'#DBD6CC',bld3d:'#ECE9E2',
    road:'#FFFFFF',roadEdge:'#E4E0D7',main:'#FFEFB8',mainEdge:'#EDD292',mway:'#FFD978',mwayEdge:'#EDB85A',rail:'#C9C6BF',path:'#EAE6DE',border:'#B8B4C6',
    label:'#3A3A3C',label2:'#6E6E73',halo:'#FFFFFF'};
  const set=(id,k,v)=>{ try{ map.setPaintProperty(id,k,v); }catch(_){} };
  for(const l of (map.getStyle()||{}).layers||[]){ const id=l.id, t=l.type;
    if(l.source&&/^(bld|ctx|site|ln|an|unc|sat|shape|sel|hl|rec|proj|user)/.test(String(l.source))) continue;   /* the atlas's own layers keep their colours */
    if(t==='background'){ set(id,'background-color',C.land); continue; }
    if(t==='fill'){
      if(/water/.test(id)) set(id,'fill-color',C.water);
      else if(/wood|forest/.test(id)) set(id,'fill-color',C.wood);
      else if(/park|grass|landcover|green|pitch|cemetery/.test(id)) set(id,'fill-color',C.park);
      else if(/residential|landuse/.test(id)) set(id,'fill-color',C.resid);
      else if(/building/.test(id)){ set(id,'fill-color',C.bld); set(id,'fill-outline-color',C.bldEdge); }
      continue; }
    if(t==='fill-extrusion'){ if(/building/.test(id)) set(id,'fill-extrusion-color',C.bld3d); continue; }
    if(t==='line'){
      if(/water/.test(id)){ set(id,'line-color',C.water); continue; }
      if(/boundary|admin/.test(id)){ set(id,'line-color',C.border); continue; }
      if(/rail/.test(id)){ if(!/hatch|dash/.test(id)) set(id,'line-color',C.rail); continue; }
      if(/(road|bridge|tunnel|highway)/.test(id)){ const edge=/casing|outline/.test(id);
        if(/motorway/.test(id)) set(id,'line-color',edge?C.mwayEdge:C.mway);
        else if(/trunk|primary/.test(id)) set(id,'line-color',edge?C.mainEdge:C.main);
        else if(/path|pedestrian|track|steps/.test(id)) set(id,'line-color',edge?C.roadEdge:C.path);
        else set(id,'line-color',edge?C.roadEdge:C.road); }
      continue; }
    if(t==='symbol'){
      if(/water/.test(id)){ set(id,'text-color',C.waterLbl); set(id,'text-halo-color',C.halo); }
      else if(/place|city|town|village|country|state|capital/.test(id)){ set(id,'text-color',C.label); set(id,'text-halo-color',C.halo); set(id,'text-halo-width',1.4); }
      else if(/road|highway|street|poi|label/.test(id)&&!/shield/.test(id)){ set(id,'text-color',C.label2); set(id,'text-halo-color',C.halo); set(id,'text-halo-width',1.2); } }
  }
};
