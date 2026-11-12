'use strict';
/* Legend of the main map: every marker symbol with its caption, the three marker colours and the numbered circle. It can be hidden and shown again. */
(function(){
  const box=document.getElementById('lgd'), body=document.getElementById('lgdBody'), show=document.getElementById('lgdShow'), hide=document.getElementById('lgdHide'); if(!box||!body) return;
  const CAP=[[['bridge','footbridge','road structure'],'Bridge, viaduct, footbridge or road structure'],[['tunnel'],'Tunnel'],[['dam / hydropower'],'Dam or hydropower plant'],[['cableway'],'Cableway'],[['tower / mast'],'Tower or mast'],
    [['building','company'],'Building or company'],[['institution'],'Institution'],[['landslide'],'Landslide'],[['geotechnical site'],'Geotechnical site'],[['study area (earthquake)'],'Earthquake study area'],[['other'],'Other site']];
  const img=(t,k)=>{ try{ const d=markerImage(t,k), c=document.createElement('canvas'); c.width=d.width; c.height=d.height; c.getContext('2d').putImageData(d,0,0); return '<img alt="" width="26" height="26" src="'+c.toDataURL()+'">'; }catch(_){ return ''; } };
  const pref=()=>{ try{ return localStorage.getItem('zag_lgd_hidden')==='1'; }catch(_){ return false; } };
  const set=on=>{ box.hidden=!on; show.hidden=on; try{ localStorage.setItem('zag_lgd_hidden',on?'0':'1'); }catch(_){} };
  function build(){ const have=new Set(ZA.features.map(f=>f.properties.object_type));
    const rows=CAP.filter(([ts])=>ts.some(t=>have.has(t))).map(([ts,cap])=>'<div class="lgr">'+img(ts.find(t=>have.has(t)),'doc')+'<span>'+cap+'</span></div>').join('');
    body.innerHTML='<h4>Symbols</h4>'+rows+'<h4>Colours</h4><div class="lgr"><i class="lgdot" style="background:#007AFF"></i><span>Blue - project with ZAG work</span></div><div class="lgr"><i class="lgdot" style="background:#5856D6"></i><span>Violet - ZAG\'s own site</span></div><div class="lgr"><i class="lgdot" style="background:#8E8E93"></i><span>Grey - partner, named in the sources</span></div><h4>Numbers</h4><div class="lgr"><i class="lgnum">5</i><span>Several records close together. Click to zoom in</span></div>';
    set(!pref()); }
  hide.addEventListener('click',()=>set(false)); show.addEventListener('click',()=>set(true));
  const wait=setInterval(()=>{ if(typeof ZA!=='undefined'&&ZA.features&&ZA.features.length&&typeof markerImage==='function'){ clearInterval(wait); build(); } },300);
})();
