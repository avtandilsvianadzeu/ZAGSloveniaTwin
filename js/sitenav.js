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
  /* what each page offers, shown when the pointer rests on its name */
  const I={pin:'M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.4 4.5 8.5 4.5 8.5s4.5-5.1 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z',
    filter:'M2 3h12l-4.6 5.4V13l-2.8 1.3V8.4z',clock:'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm.7 6.3 2.6 1.6-.7 1.1-3.3-2V4h1.4z',layers:'M8 1.5 1.5 5 8 8.5 14.5 5zM2.8 7.7 1.5 8.4 8 12l6.5-3.6-1.3-.7L8 10.5zm0 3.4-1.3.7L8 15.3l6.5-3.5-1.3-.7L8 13.9z',
    cube:'M8 1 2 4.2v7.6L8 15l6-3.2V4.2zm0 1.6 4.3 2.3L8 7.2 3.7 4.9zM3.2 6l4.2 2.3v4.9L3.2 11zm5.4 7.2V8.3L12.8 6v5z',list:'M2 3h2v2H2zm4 .3h8v1.4H6zM2 7h2v2H2zm4 .3h8v1.4H6zM2 11h2v2H2zm4 .3h8v1.4H6z',
    doc:'M3 1.5h6.5L13 5v9.5H3zm6 1v3h3M5 8h6v1H5zm0 2.5h6v1H5z',chart:'M2 13.5h12V15H2zM3 8h2.4v5H3zm3.8-4h2.4v9H6.8zm3.8 2.5H13V13h-2.4z',alert:'M8 1.5 15 14H1zm-.7 4.5v4h1.4V6zm0 5.2v1.5h1.4v-1.5z',
    code:'M5.6 4 1.5 8l4.1 4 1-1L3.5 8l3.1-3zm4.8 0-1 1 3.1 3-3.1 3 1 1 4.1-4z',plus:'M7.3 2h1.4v5.3H14v1.4H8.7V14H7.3V8.7H2V7.3h5.3z',chat:'M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H7l-3.5 3v-3A1.5 1.5 0 0 1 2 9.5z'};
  const ic=k=>`<i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${I[k]}" fill="currentColor"/></svg></i>`;
  const FEAT={'index.html':[['pin','Search','Find a structure, a place or an address','index.html'],['filter','Filter by type','Projects, buildings, bridges or infrastructure','index.html'],['clock','Timeline','ZAG work year by year since 1952','index.html'],['layers','Backgrounds','Map, satellite or the GURS 25 cm orthophoto','index.html'],['cube','3D view','Terrain relief and buildings in 3D','index.html'],['chat','Tips to get started','Five things to try first. Press ? on the map','index.html?tips=1']],
    'twin.html':[['list','All objects','The 73 records, filtered by type','twin.html'],['doc','Asset record','Every value with its source and evidence','twin.html?id=tomacevo'],['cube','3D model','Rebuilt from mapped outlines and published dimensions','twin.html?id=he_arto'],['chart','Report and data file','Print a record or download it as data','twin.html?id=karavanke_c']],
    'dashboard.html':[['chart','Totals','What the atlas holds today','dashboard.html'],['alert','Condition','From inspection records, where entered','dashboard.html'],['list','Data to complete','Records with the fewest values','dashboard.html']],
    'questions.html':[['alert','Where sources differ','Values that two sources give differently','questions.html'],['doc','Not yet verified','What the sources do not settle yet','questions.html']],
    'api.html':[['code','JSON per object','Every record by its own address','api.html'],['layers','GeoJSON for GIS','Open the atlas in QGIS','api.html'],['list','CSV for Excel','All records as one table','api.html']],
    'add.html':[['plus','Draw a structure','Click its points on the map, the model appears at once','add.html'],['cube','Suggest a 3D model','Tell the atlas team what to model','#zagbot'],['chat','Ask ZAGBot','Questions and corrections in plain words','#zagbot']]};
  nav.innerHTML=PAGES.map(([h,t,tip])=>`<span class="item"><a href="${h}"${h===file?' aria-current="page"':''}>${t}</a><div class="fmenu" role="menu"><h6>${tip}</h6>${(FEAT[h]||[]).map(([k,b,d,u])=>`<a class="f" role="menuitem" href="${u}"${/^https/.test(u)?' target="_blank" rel="noopener"':''}>${ic(k)}<span><b>${b}</b><span>${d}</span></span></a>`).join('')}</div></span>`).join('');
  nav.addEventListener('click',e=>{ const a=e.target.closest('a[href="#zagbot"]'); if(a){ e.preventDefault(); if(window.ZAGBOT) window.ZAGBOT.open(); return; } const t=e.target.closest('a[href="index.html?tips=1"]'); if(t&&window.ZAGTIPS){ e.preventDefault(); window.ZAGTIPS.open(); } });
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
