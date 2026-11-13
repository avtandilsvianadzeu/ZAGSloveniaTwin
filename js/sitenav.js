'use strict';
/* One navigation for the whole site, in a fixed logical order, the same on every page:
   Map, Assets, Dashboard, Open questions, Data API, Add object. The current page is marked.
   Page links that were repeated in each header are hidden here, so every page keeps only its own tools:
   the map keeps its search, background and layers, an asset page keeps Previous, Next and "Open on the map". */
(function(){
  const PAGES=[['index.html','Map','The map of all ZAG work'],['twin.html','Assets','All objects and their records'],['dashboard.html','Dashboard','What the atlas holds today'],
    ['questions.html','Open questions','What the sources do not settle yet'],['api.html','Data API','Read the data by address'],['add.html','Add object','Draw a new structure']];
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const head=document.querySelector('header.thdr,header.hdr'); if(!head) return;
  const nav=document.createElement('nav'); nav.className='sitenav'; nav.setAttribute('aria-label','Site');
  nav.innerHTML=PAGES.map(([h,t,tip])=>`<a href="${h}" title="${tip}"${h===file?' aria-current="page"':''}>${t}</a>`).join('');
  const brand=head.querySelector('.brand'); (brand?brand.nextSibling:head.firstChild)?head.insertBefore(nav,brand?brand.nextSibling:head.firstChild):head.appendChild(nav);
  if(brand&&brand.tagName==='A') brand.title='ZAG Digital Atlas, back to the map';
  /* hide header links that the site navigation now covers, keep page tools */
  const known=new Set(PAGES.map(p=>p[0]));
  head.querySelectorAll('.tnav a, .hright a.linkbtn').forEach(a=>{ const h=(a.getAttribute('href')||'').split('?')[0].split('#')[0].toLowerCase();
    if(a.id==='tomap'||a.id==='prev'||a.id==='next') return; if(known.has(h)) a.hidden=true; });
  /* asset page: Previous and Next as one joined pair next to the search, "Open on the map" stays as the default button */
  const prev=document.getElementById('prev'), next=document.getElementById('next');
  if(prev&&next){ prev.textContent='‹ Previous'; next.textContent='Next ›'; const pair=document.createElement('span'); pair.className='pager'; prev.parentNode.insertBefore(pair,prev); pair.appendChild(prev); pair.appendChild(next); }
  /* map page: the section filters move onto the map as one segmented control, like the view switch in Maps */
  const sec=document.getElementById('nav');
  if(sec&&head.classList.contains('hdr')){ const bar=document.createElement('div'); bar.className='mapfilter'; bar.setAttribute('role','group'); bar.setAttribute('aria-label','Show on the map');
    head.parentNode.insertBefore(bar,head.nextSibling); bar.appendChild(sec); document.body.classList.add('has-mapfilter'); }
  document.body.classList.add('sierra');

  /* live status: a green light, the time of the last news check, refreshed every minute */
  const live=document.createElement('span'); live.className='livebadge'; live.title='The atlas checks Slovenian news for every record several times an hour';
  live.innerHTML='<i></i><b>LIVE</b><span>connecting</span>'; const right=head.querySelector('.tnav,.hright'); right?head.insertBefore(live,right):head.appendChild(live);
  const ago=t=>{ const m=Math.max(0,Math.round((Date.now()-t)/60000)); return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' days ago'; };
  let last=0, upd=0;
  async function tick(){ try{ const r=await fetch('data/news.json?t='+Date.now(),{cache:'no-store'}); if(r.ok){ const j=await r.json(); const t=Date.parse(j.updated||''); if(t){ if(upd&&t>upd){ live.classList.remove('flash'); void live.offsetWidth; live.classList.add('flash'); } upd=t; } } }catch(_){}
    last=Date.now(); paint(); }
  function paint(){ live.querySelector('span').textContent=upd?'news updated '+ago(upd):'online'; }
  tick(); setInterval(tick,5*60000); setInterval(paint,30000);

  /* numbers count up when they appear, so totals feel live */
  const count=el=>{ if(el.dataset.counted) return; const txt=el.textContent.trim(); if(!/^\d[\d,]*$/.test(txt)) return; el.dataset.counted='1'; const end=+txt.replace(/,/g,''); if(end<2||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0=performance.now(), d=900, fmt=n=>txt.includes(',')?n.toLocaleString('en-GB'):String(n); const step=t=>{ const k=Math.min(1,(t-t0)/d), e=1-Math.pow(1-k,3); el.textContent=fmt(Math.round(end*e)); if(k<1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
  const scan=()=>document.querySelectorAll('.dim .v, .stats b, .kf .v').forEach(count);
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true}); scan();
})();
