'use strict';
/* Dashboard: what the atlas knows, counted from its own files. Condition comes only from inspection records that a person entered. */
(async()=>{
  try{ await load(); }catch(e){ $('main').innerHTML=`<p class="loading">${esc(e.message)}</p>`; return; }
  const F=D.features.map(f=>f.properties), zag=F.filter(p=>p.category!=='user_object'), user=F.filter(p=>p.category==='user_object');
  const hasGeo=p=>!!(p.lines||p.line||D.gurs[p.id]), tw=p=>D.twins[p.id]||{}, nSpec=p=>(tw(p).specs||[]).length;
  const last=p=>inspFor(p.id)[0]||null, rated=zag.map(p=>({p,e:last(p)})), withInsp=rated.filter(x=>x.e);
  const cnt={good:0,fair:0,poor:0,critical:0,none:0}; withInsp.forEach(x=>cnt[COND[x.e.condition]?x.e.condition:'none']++);
  const col={good:'#34C759',fair:'#FF9500',poor:'#FF3B30',critical:'#A1140C',none:'#8E8E93'}, noRec=zag.length-withInsp.length;
  const exact=zag.filter(p=>EXACT(p.position_precision)).length, openQ=zag.filter(p=>tw(p).open), diff=zag.reduce((a,p)=>a+((tw(p).differences||[]).length),0);
  const news=Object.entries(D.news).flatMap(([id,l])=>(l||[]).map(n=>Object.assign({id},n))).filter(n=>D.byId[n.id]).sort((a,b)=>a.date<b.date?1:-1).slice(0,8);
  const thin=zag.slice().sort((a,b)=>nSpec(a)-nSpec(b)).slice(0,10), a=p=>`<a href="twin.html?id=${encodeURIComponent(p.id)}">${T(p.name_en||p.name)}</a>`;
  const byType={}; zag.forEach(p=>{ const k=GROUP_NAME[p.object_type]||cap(p.object_type); (byType[k]=byType[k]||[]).push(p); });
  $('main').innerHTML=`<div class="wrap home"><h1>Dashboard</h1><p class="lead">What the atlas holds today, counted from its own data. Condition appears only where an inspection record has been entered.</p>
    <section class="dims" aria-label="Totals"><div class="dim"><div class="v">${zag.length}</div><div class="k">ZAG objects</div></div><div class="dim"><div class="v">${zag.filter(hasGeo).length}</div><div class="k">with a model</div></div>
      <div class="dim"><div class="v">${exact}</div><div class="k">placed exactly</div></div><div class="dim"><div class="v">${withInsp.length}</div><div class="k">with an inspection record</div></div>
      <div class="dim"><div class="v">${openQ.length}</div><div class="k">with an open question</div></div><div class="dim"><div class="v">${user.length}</div><div class="k">added by users</div></div></section>
    <div class="dash">
      <section class="panel wide"><h2>Condition from inspection records</h2>
        <div class="bar" role="img" aria-label="Share of objects by recorded condition">${['good','fair','poor','critical','none'].map(k=>cnt[k]?`<i style="width:${cnt[k]/zag.length*100}%;background:${col[k]}"></i>`:'').join('')}</div>
        <div class="legend">${['good','fair','poor','critical','none'].map(k=>`<span><i style="background:${col[k]}"></i>${COND[k][0]} ${cnt[k]}</span>`).join('')}<span><i style="background:rgba(118,118,128,.25)"></i>No record ${noRec}</span></div>
        ${withInsp.length?`<div class="tscroll" style="margin-top:12px"><table><thead><tr><th>Object</th><th>Last inspection</th><th>Kind</th><th>Condition</th><th>Kept</th></tr></thead><tbody>${withInsp.sort((x,y)=>x.e.date<y.e.date?1:-1).map(x=>`<tr><td class="v">${a(x.p)}</td><td class="n">${esc(x.e.date)}</td><td>${T(x.e.kind||'')}</td><td><span class="tag ${(COND[x.e.condition]||COND.none)[1]}">${esc((COND[x.e.condition]||COND.none)[0])}</span></td><td class="muted">${esc(x.e.origin)}</td></tr>`).join('')}</tbody></table></div>`
          :'<p class="note" style="margin-top:12px">No inspection record has been entered yet. Open an object and use "Add inspection record".</p>'}
        <div class="btnrow"><button class="tbtn" type="button" id="dlInsp">Download inspection records</button></div></section>
      <section class="panel"><h2>Objects by type</h2><div class="tscroll"><table><thead><tr><th>Type</th><th>Objects</th><th>With a model</th><th>Inspected</th></tr></thead><tbody>${Object.entries(byType).sort((x,y)=>y[1].length-x[1].length).map(([k,l])=>`<tr><td class="v">${esc(k)}</td><td class="n">${l.length}</td><td class="n">${l.filter(hasGeo).length}</td><td class="n">${l.filter(p=>last(p)).length}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel"><h2>Data to complete</h2><p class="note">${num(zag.reduce((s,p)=>s+nSpec(p),0))} facts and figures with a source in total, and ${diff} points where sources disagree. These objects have the fewest specifications.</p>
        <div class="tscroll"><table><thead><tr><th>Object</th><th>Specifications</th><th>Position</th></tr></thead><tbody>${thin.map(p=>`<tr><td class="v">${a(p)}</td><td class="n">${nSpec(p)}</td><td><span class="tag ${EXACT(p.position_precision)?'ok':'warn'}">${EXACT(p.position_precision)?'exact':'approximate'}</span></td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel"><h2>Open questions</h2>${openQ.length?`<div class="tscroll"><table><tbody>${openQ.slice(0,12).map(p=>`<tr><td class="v" style="width:34%">${a(p)}</td><td>${T(cap(tw(p).open))}</td></tr>`).join('')}</tbody></table></div>${openQ.length>12?`<p class="note" style="margin-top:8px">${openQ.length-12} more on the object pages.</p>`:''}`:'<p class="note">None.</p>'}</section>
      <section class="panel"><h2>Recent news</h2>${news.length?news.map(n=>`<div class="nitem" style="padding-left:0;padding-right:0"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a><div class="note">${a(D.byId[n.id].properties)}, ${esc(n.source)}, ${fmtDate(n.date)}</div></div>`).join(''):'<p class="note">No news in the file.</p>'}</section>
    </div></div>`;
  $('dlInsp').onclick=()=>{ const items={}; for(const p of F){ const l=inspFor(p.id).map(e=>{ const o=Object.assign({},e); delete o.origin; return o; }); if(l.length) items[p.id]=l; }
    const blob=new Blob([JSON.stringify({note:'Inspection records from the ZAG Digital Atlas. Upload as data/inspections.json to publish.',items},null,1)],{type:'application/json'}), x=document.createElement('a'); x.href=URL.createObjectURL(blob); x.download='inspections.json'; document.body.appendChild(x); x.click(); x.remove(); };
})();
