#!/usr/bin/env node
/* Static data API. Writes api/v1/ from the atlas data so other tools (QGIS, Python, Excel, a BIM viewer) can read it by URL.
   Run after build_geojson.js and merge_recon.js:  node tools/build_api.js */
const fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..'), OUT=path.join(ROOT,'api/v1');
const J=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const geo=J('data/zag_projects.geojson'), twins=J('data/twins.json').objects||{}, gurs=(J('data/gurs_buildings.json').buildings)||{}, rebuild=(J('data/rebuild_status.json').items)||{};
const own=(J('data/ownership.json').items)||{};
const off=(J('data/official_check.json').items)||{};
const clean=s=>typeof s==='string'?s.replace(/\s*—\s*/g,', ').replace(/(\d)\s*–\s*(\d)/g,'$1 to $2').replace(/–/g,'-').replace(/\s*;\s*/g,', ').replace(/\s+/g,' ').trim():s;
/* quotes are verbatim source text and stay as printed */
const deep=v=>Array.isArray(v)?v.map(deep):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='quote'?x:deep(x)])):clean(v);
const EXACT=new Set(['surveyed','address','matched']);
const {toD96}=require('../js/crs.js');
/* attribution the sources require; the compiled atlas content has no separate licence yet */
const ATTRIBUTION={openstreetmap:'Alignments and matched positions contain information from OpenStreetMap, made available under the Open Database License (ODbL) 1.0, https://www.openstreetmap.org/copyright',
  gurs:'Cadastre and laser scanning values: Geodetska uprava Republike Slovenije (GURS), CC BY 4.0',
  sources:'Every specification carries the link of the source it was read from. Each source keeps its own licence.'};
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(path.join(OUT,'objects'),{recursive:true});
const BASE='https://avtandilsvianadzeu.github.io/ZAGSloveniaTwin/';
const rows=geo.features.map(f=>{ const p=f.properties, t=twins[p.id]||{}, specs=(t.specs||[]);
  return {id:p.id,name:p.name_en||p.name,name_sl:p.name_sl||null,type:p.object_type||'other',category:p.category,place:p.locality||p.municipality||null,municipality:p.municipality||null,
    latitude:p.latitude,longitude:p.longitude,...(()=>{ const d=toD96([+p.longitude,+p.latitude]); return {e_d96tm:Math.round(d[0]*100)/100,n_d96tm:Math.round(d[1]*100)/100}; })(),position_basis:p.position_precision||null,position_exact:EXACT.has(p.position_precision),
    zag_work_from:p.year_start??null,zag_work_to:p.year_end??null,built:p.built??null,values:specs.length,values_with_source:specs.filter(s=>s.source).length,
    has_alignment:!!(p.lines||p.line),has_building_outline:!!gurs[p.id],model:t.model?'rebuilt from published dimensions':(p.lines||p.line||gurs[p.id])?'schematic':'none',
    url:BASE+'twin.html?id='+encodeURIComponent(p.id),detail:BASE+'api/v1/objects/'+p.id+'.json'}; });
const W=(f,o)=>fs.writeFileSync(path.join(OUT,f),JSON.stringify(o));
W('objects.json',{count:rows.length,objects:rows});
for(const f of geo.features){ const p=f.properties, t=twins[p.id]||{}, g=gurs[p.id]||null, row=rows.find(r=>r.id===p.id);
  W('objects/'+p.id+'.json',deep({...row,zag_role:p.zag_role||null,zag_involvement_types:p.zag_involvement_types||[],description:p.description||null,history:p.hist||null,facts:p.facts||[],people:p.people||[],partners:p.partners||[],
    position_sources:p.position_sources||[],record_sources:(p.sources||[]).map(s=>({title:s.title,url:s.url,type:s.type})),
    specifications:(t.specs||[]).map(s=>({label:s.label,value:s.value,unit:s.unit||'',source:s.source||null,quote:s.quote||null,quote_note:s.quote_note||null,quote_checked:s.quote_checked===true,quote_source:s.quote_source||null,basis:s.basis||null,check:s.check||null})),source_differences:t.differences||[],open_question:t.open||null,reference_points:t.anchors||[],model_basis:t.model||null,rebuild_status:rebuild[p.id]||null,cadastre_owner_and_manager:own[p.id]||null,
    geometry:{point:[p.longitude,p.latitude],alignment:p.lines||(p.line?[p.line]:null),alignment_labels:p.line_labels||null,building:g?{height_m:g.height_m??null,area_m2:g.area_m2??null,outline:g.geometry}:null},
    official_place_and_line_check:off[p.id]||null,
    laser_scan:g&&g.scan?{source:'GURS, laser scanning of Slovenia (CLSS), file series NDMP, 0.5 m pixels. The values are read as heights above the ground. This reading rests on the agreement with the cadastre heights, since no official description of the series was found',files:g.scan.files.map(x=>'https://ipi.eprostor.gov.si/javne-datoteke/DALJINSKO_ZAZNAVANJE/CLSS/ndmp/'+x),read:g.scan.read,height_cells:BASE+g.scan.grid,whole_outline:g.scan.stats||g.scan.group||null,buildings:(g.parts||[]).filter(q=>q.scan).map((q,i)=>({building:q.kn!=null?q.kn:'part '+(i+1),cadastre_highest_point_m:q.h??null,...q.scan}))}:null})); }
W('objects.geojson',{type:'FeatureCollection',attribution:ATTRIBUTION,features:geo.features.map(f=>{ const p=f.properties, r=rows.find(x=>x.id===p.id), ln=p.lines||(p.line?[p.line]:null);
  return {type:'Feature',id:p.id,geometry:ln?{type:'MultiLineString',coordinates:ln}:{type:'Point',coordinates:[p.longitude,p.latitude]},properties:r}; })});
const cols=Object.keys(rows[0]), cell=v=>v==null?'':/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v);
fs.writeFileSync(path.join(OUT,'objects.csv'),'﻿'+[cols.join(',')].concat(rows.map(r=>cols.map(c=>cell(r[c])).join(','))).join('\r\n'));
const byType={}; rows.forEach(r=>byType[r.type]=(byType[r.type]||0)+1);
/* one geometry type per layer, as GIS tools expect: every record as a point, and the drawn alignments as lines */
const bbox=(()=>{ let x0=180,y0=90,x1=-180,y1=-90; const add=c=>{ x0=Math.min(x0,c[0]); y0=Math.min(y0,c[1]); x1=Math.max(x1,c[0]); y1=Math.max(y1,c[1]); };
  for(const f of geo.features){ const p=f.properties; add([p.longitude,p.latitude]); (p.lines||(p.line?[p.line]:[])).forEach(l=>l.forEach(add)); } return [x0,y0,x1,y1].map(v=>Math.round(v*1e5)/1e5); })();
W('points.geojson',{type:'FeatureCollection',attribution:ATTRIBUTION,bbox,features:rows.map(r=>({type:'Feature',id:r.id,geometry:{type:'Point',coordinates:[r.longitude,r.latitude]},properties:r}))});
W('alignments.geojson',{type:'FeatureCollection',attribution:ATTRIBUTION,bbox,features:geo.features.filter(f=>f.properties.lines||f.properties.line).map(f=>{ const p=f.properties; return {type:'Feature',id:p.id,geometry:{type:'MultiLineString',coordinates:p.lines||[p.line]},properties:{id:p.id,name:p.name_en||p.name,type:p.object_type,geometry_source:'OpenStreetMap, matched to the record',url:BASE+'twin.html?id='+encodeURIComponent(p.id)}}; })});
/* dataset metadata in the spirit of ISO 19115: what it is, who to ask, where it comes from, its extent, reference system and accuracy */
W('metadata.json',{title:'ZAG Digital Atlas',abstract:'Structures and sites in Slovenia where the work of ZAG, the Slovenian National Building and Civil Engineering Institute, is documented in published sources. Each value carries the link of the source it was read from.',
  pointOfContact:{email:'avtandil.svianadze@zag.si'},dates:{revision:new Date().toISOString().slice(0,10)},
  lineage:['Records compiled from ZAG publications, reference lists and owner, operator and research sources, each linked per value.','Alignments and many positions matched to OpenStreetMap ways.','Building outlines and heights from the GURS real estate cadastre.','Roof surfaces from the GURS laser scanning.'],
  extent:{bbox,note:'The Karavanke tunnels run into Austria.'},referenceSystem:{geojson:'WGS 84 longitude and latitude, EPSG:4326 (RFC 7946)',national:'D96/TM, EPSG:3794, fields e_d96tm and n_d96tm in metres'},
  positionalAccuracy:{surveyed:'published coordinate of the object',address:'published address of the object',matched:'matched to the mapped structure in OpenStreetMap',site:'centre of the site, not the object',settlement:'centre of the settlement',locality:'centre of the locality',epicentre:'provisional epicentre published by ARSO'},
  attribution:ATTRIBUTION,maintenance:'Updated when sources change; news refreshed several times an hour.'});
W('index.json',{name:'ZAG Digital Atlas data API',version:'v1',generated:new Date().toISOString().slice(0,10),objects:rows.length,values:rows.reduce((a,r)=>a+r.values,0),values_with_source:rows.reduce((a,r)=>a+r.values_with_source,0),by_type:byType,
  endpoints:{points:BASE+'api/v1/points.geojson',alignments:BASE+'api/v1/alignments.geojson',metadata:BASE+'api/v1/metadata.json',list:BASE+'api/v1/objects.json',detail:BASE+'api/v1/objects/{id}.json',geojson:BASE+'api/v1/objects.geojson',csv:BASE+'api/v1/objects.csv',openapi:BASE+'api/v1/openapi.json'},
  attribution:ATTRIBUTION,coordinates:'WGS 84 longitude and latitude (EPSG:4326). e_d96tm and n_d96tm give the Slovenian national coordinates D96/TM (EPSG:3794) in metres.',
  note:'Read only. Specifications carry the link they were read from, and values_with_source counts them. Where sources differ, the values are listed under source_differences and none is chosen. Each source keeps its own licence.'});
const str={type:'string'}, num={type:'number'}, nstr={type:['string','null']};
W('openapi.json',{openapi:'3.1.0',info:{title:'ZAG Digital Atlas data API',version:'1.0.0',description:'Read only static API of structures and sites in Slovenia with documented ZAG involvement.'},servers:[{url:BASE+'api/v1'}],
  paths:{'/index.json':{get:{summary:'Service description and counts',responses:{200:{description:'OK'}}}},'/objects.json':{get:{summary:'All objects, one summary row each',responses:{200:{description:'OK',content:{'application/json':{schema:{type:'object',properties:{count:num,objects:{type:'array',items:{$ref:'#/components/schemas/Summary'}}}}}}}}}},
    '/objects/{id}.json':{get:{summary:'One object with specifications, sources and geometry',parameters:[{name:'id',in:'path',required:true,schema:str,example:'nm_brv'}],responses:{200:{description:'OK'},404:{description:'No object with this id'}}}},
    '/objects.geojson':{get:{summary:'All objects as GeoJSON, alignments as lines and the rest as points',responses:{200:{description:'OK'}}}},'/objects.csv':{get:{summary:'All objects as a CSV table',responses:{200:{description:'OK'}}}}},
  components:{schemas:{Summary:{type:'object',properties:{id:str,name:str,name_sl:nstr,type:str,category:str,place:nstr,municipality:nstr,latitude:num,longitude:num,e_d96tm:num,n_d96tm:num,position_basis:nstr,position_exact:{type:'boolean'},zag_work_from:{type:['integer','null']},zag_work_to:{type:['integer','null']},built:{type:['integer','string','null']},values:{type:'integer'},values_with_source:{type:'integer'},has_alignment:{type:'boolean'},has_building_outline:{type:'boolean'},model:str,url:str,detail:str}}}}});
console.log('api/v1 written:',rows.length,'objects');

/* sitemap for search engines: every page and every asset record */
{ const pages=['index.html','twin.html','dashboard.html','questions.html','api.html','add.html'].map(u=>BASE+u).concat(rows.map(r=>r.url));
  const day=new Date().toISOString().slice(0,10);
  fs.writeFileSync(path.join(ROOT,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.map(u=>'  <url><loc>'+u.replace(/&/g,'&amp;')+'</loc><lastmod>'+day+'</lastmod></url>').join('\n')+'\n</urlset>\n'); }
