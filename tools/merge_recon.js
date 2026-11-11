#!/usr/bin/env node
/* Merges the reconstruction research (handover/research/reconstruction_2026_11/*.json) into data/twins.json.
   A value is added only when it has a source link and the twin sheet has no value under that label.
   When the sheet already has that label with a different value, nothing is overwritten: the pair is listed under "Where the sources differ".
   Run: node tools/merge_recon.js   (safe to run again, it adds nothing twice) */
const fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..'), DIR=path.join(ROOT,'handover/research/reconstruction_2026_11');
const TP=path.join(ROOT,'data/twins.json'), TW=JSON.parse(fs.readFileSync(TP,'utf8')), T=TW.objects;
const G=JSON.parse(fs.readFileSync(path.join(ROOT,'data/zag_projects.geojson'),'utf8')), IDS=new Set(G.features.map(f=>f.properties.id));
const clean=s=>String(s==null?'':s).replace(/[–—]/g,'-').replace(/\s*;\s*/g,', ').replace(/\s+/g,' ').trim();
const host=u=>{ try{ return new URL(u).hostname.replace(/^www\./,''); }catch(_){ return null; } }, key=s=>clean(s).toLowerCase();
let add=0, diff=0, skip=0, recs=0; const status={};
for(const f of fs.readdirSync(DIR).filter(f=>f.endsWith('.json'))) for(const r of JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'))){
  if(!r||!IDS.has(r.id)) continue; recs++; status[r.id]={rebuildable:clean(r.rebuildable||''),missing:(r.missing||[]).map(clean).slice(0,8)};
  const t=T[r.id]=T[r.id]||{summary:null,specs:[],anchors:[],differences:[],open:null,kind:'Site'}; t.specs=t.specs||[]; t.differences=t.differences||[];
  for(const s of r.specs||[]){ const label=clean(s.label), value=clean(s.value), unit=clean(s.unit||''); if(!label||!value||!host(s.source)||value.length>160){ skip++; continue; }
    const have=t.specs.filter(x=>key(x.label)===key(label));
    if(!have.length){ t.specs.push({label,value,unit,source:s.source}); add++; }
    else if(!have.some(x=>key(x.value)===key(value))){ const line=`${label}: ${have[0].value}${have[0].unit?' '+have[0].unit:''} (${host(have[0].source)||'record'}) against ${value}${unit?' '+unit:''} (${host(s.source)})`; if(!t.differences.includes(line)){ t.differences.push(line); diff++; } }
    else skip++; } }
TW.meta.reconstruction='November 2026: dimensions collected by three research passes, each with a source link. Values were read through a page reader, so check a value against its source before relying on it.';
fs.writeFileSync(TP,JSON.stringify(TW)); fs.writeFileSync(path.join(ROOT,'data/rebuild_status.json'),JSON.stringify({note:'Per asset: can it be rebuilt as a true model from published data, and what is still missing. From the research passes of November 2026.',items:status}));
console.log('records',recs,'values added',add,'differences added',diff,'skipped',skip);
