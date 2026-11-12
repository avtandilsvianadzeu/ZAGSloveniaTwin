#!/usr/bin/env node
/* Laser scanning import. Reads the file made in the browser from the GURS CLSS files NDMP_<E>_<N>.tif (see handover/HANDOVER.md, Laser scanning)
   and writes data/lidar/<id>.json (1 m height cells inside the building outlines) plus the statistics per building into data/gurs_buildings.json.
   Run:  node tools/import_lidar.js handover/research/recheck_2026_11/lidar_ndmp_2026_11_12.json */
const fs=require('fs'), path=require('path'), zlib=require('zlib'), ROOT=path.join(__dirname,'..');
const src=process.argv[2]; if(!src){ console.error('give the downloaded file'); process.exit(1); }
const d=JSON.parse(fs.readFileSync(src,'utf8')), gf=path.join(ROOT,'data/gurs_buildings.json'), G=JSON.parse(fs.readFileSync(gf,'utf8'));
const FILE='https://ipi.eprostor.gov.si/javne-datoteke/DALJINSKO_ZAZNAVANJE/CLSS/ndmp/NDMP_', day=d.read.slice(0,10);
fs.mkdirSync(path.join(ROOT,'data/lidar'),{recursive:true});
G.meta.laser_scan='Laser scanning of Slovenia by GURS (CLSS), file series NDMP, one file per square kilometre with 0.5 m pixels, read '+day+'. The values are read as height above the ground in metres. This reading rests on the agreement with the cadastre heights, since no official description of the series was found. For every building the pixels whose centre lies inside the outline were taken. The statistics give the number of pixels, the middle value, the levels that 90 % and 99 % of the pixels stay below, and the highest pixel. Data of Geodetska uprava Republike Slovenije, used under its general terms for geodetic data.';
const st=s=>({pixels:s.n,min_m:s.min,median_m:s.med,p90_m:s.p90,p99_m:s.p99,max_m:s.max,mean_m:s.mean});
for(const [id,v] of Object.entries(d.items)){ const b=G.buildings[id]; if(!b){ console.error('no record',id); continue; }
  const raw=zlib.inflateRawSync(Buffer.from(v.b64,'base64')); if(raw.length!==v.nx*v.ny*2) throw new Error('grid size '+id);
  fs.writeFileSync(path.join(ROOT,'data/lidar',id+'.json'),JSON.stringify({source:'GURS, laser scanning of Slovenia (CLSS), file series NDMP, 0.5 m pixels',files:v.sheets.map(k=>FILE+k+'.tif'),read:day,terms:'Geodetska uprava Republike Slovenije, general terms of use of geodetic data',
    method:'Each 1 m cell is the mean of the 0.5 m pixels whose centre lies inside a building outline of this record. Heights above the ground in decimetres, 65535 where no outline covers the cell. Rows run from south to north, cells from west to east.',
    grid:{nx:v.nx,ny:v.ny,cell_m:1,crs:'EPSG:3794',x0:v.x0,y0:v.y0,sw:v.sw,se:v.se,nw:v.nw},cells:v.cells,z:raw.toString('base64')}));
  b.scan={files:v.sheets.map(k=>'NDMP_'+k+'.tif'),read:day,grid:'data/lidar/'+id+'.json'};
  const named=v.stats.filter(s=>s.name!=='group outline');
  if(b.parts&&b.parts.length){ b.parts.forEach((q,i)=>{ const s=named[i]; if(!s||(q.kn!=null&&String(q.kn)!==s.name)) throw new Error('part order '+id+' '+i); q.scan=st(s); }); }
  else b.scan.stats=st(named[0]);
  const grp=v.stats.find(s=>s.name==='group outline'); if(grp) b.scan.group=st(grp);
  console.log(id,v.nx+'x'+v.ny,v.cells,'cells'); }
fs.writeFileSync(gf,JSON.stringify(G));
