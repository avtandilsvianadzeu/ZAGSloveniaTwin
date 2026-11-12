'use strict';
/* Timeline: show the records whose ZAG work started in or before the chosen year.
   Records without a year in the sources stay visible at every position. */
(function(){
  const bar=document.getElementById('tl'); if(!bar) return;
  const range=bar.querySelector('input'), out=bar.querySelector('output'), play=document.getElementById('tlPlay'), all=document.getElementById('tlAll');
  let timer=null, lo=0, hi=0, undated=0;
  const paint=()=>{ const y=+range.value, on=ZA.upTo!=null; const n=ZA.features.filter(f=>{ const s=f.properties.year_start; return s!=null&&s<=y; }).length;
    out.innerHTML=on?`Work up to <b>${y}</b>, ${n} dated records`:`All years, ${lo} to ${hi}`; all.setAttribute('aria-pressed',on?'false':'true');
    bar.title=undated?`${undated} records have no year in the sources and are always shown`:''; };
  const set=y=>{ ZA.upTo=y; if(y!=null) range.value=y; refreshProjects(); paint(); };
  const stop=()=>{ if(timer){ clearInterval(timer); timer=null; } play.textContent='Play'; play.setAttribute('aria-pressed','false'); };
  function start(){ const ys=ZA.features.map(f=>f.properties.year_start).filter(v=>v!=null); if(!ys.length){ bar.hidden=true; return; }
    lo=Math.min(...ys); hi=Math.max(...ys); undated=ZA.features.length-ys.length; range.min=lo; range.max=hi; range.value=hi; bar.hidden=false; paint(); }
  range.addEventListener('input',()=>{ stop(); set(+range.value); });
  all.addEventListener('click',()=>{ stop(); range.value=hi; set(null); });
  play.addEventListener('click',()=>{ if(timer){ stop(); return; } if(+range.value>=hi) range.value=lo; set(+range.value); play.textContent='Pause'; play.setAttribute('aria-pressed','true');
    timer=setInterval(()=>{ const y=+range.value+1; if(y>hi){ stop(); return; } set(y); },450); });
  const wait=setInterval(()=>{ if(typeof ZA!=='undefined'&&ZA.features.length){ clearInterval(wait); start(); } },300);
})();
