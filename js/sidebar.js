'use strict';
/* Sidebar in the manner of a macOS app (Music, Finder): a glass column on the left with icon rows grouped under small
   headings. Pages, the tools of the map, the record types, language and display. Opened with the button at the left of
   the header or with the [ key, closed with the same, Esc, or a click on the page. Its open state is kept per browser on
   wide screens; on phones it is a drawer. Everything it does calls the controls that already exist. */
(function(){
  if(/embed/.test(location.search)||window.top!==window.self) return;
  const sl=window.LANG==='sl', file=(location.pathname.split('/').pop()||'index.html').toLowerCase(), onMap=file==='index.html'||file==='';
  const t=(en,s)=>sl?s:en;
  const P={ map:'M2 3.5l4-1.5 4 1.5 4-1.5v10.5l-4 1.5-4-1.5-4 1.5zM6 2v10.5M10 3.5V14', list:'M2.5 4h11M2.5 8h11M2.5 12h7', dash:'M8 2a6 6 0 0 1 6 6H8zM7 3a6 6 0 1 0 6 6', check:'M2.5 8.5l3.5 3.5 7.5-8', code:'M5.5 4L1.5 8l4 4M10.5 4l4 4-4 4', plus:'M8 2.5v11M2.5 8h11',
    search:'M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM10.3 10.3L14 14', legend:'M3 4h2v2H3zM7 5h7M3 7h2v2H3zM7 8h7M3 10h2v2H3zM7 11h7', clock:'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 2.5V8l2.5 1.5', ruler:'M2 11l9-9 4 4-9 9zM5 8l1.5 1.5M7 6l1.5 1.5M9 4l1.5 1.5', cube:'M8 1.5l5.5 3v7l-5.5 3-5.5-3v-7zM8 7.5l5.5-3M8 7.5v7M8 7.5L2.5 4.5', sat:'M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11', layers:'M8 2.5l6 3.3-6 3.3-6-3.3zM2 9.5l6 3.3 6-3.3', tips:'M8 2a4 4 0 0 1 2.4 7.2c-.6.5-.9 1-.9 1.8H6.5c0-.8-.3-1.3-.9-1.8A4 4 0 0 1 8 2zM6.5 13h3',
    building:'M3 13.5V3.5l4-1.5v11.5M7 6.5l6 2v5M3 13.5h10M5 5.5h1M5 8h1M5 10.5h1M10 10h1', bridge:'M1.5 10h13M3 10V6M13 10V6M3 6q5-4 10 0M5.5 10V7.5M8 10V7M10.5 10V7.5', infra:'M2 13.5h12M4 13.5V6a4 4 0 0 1 8 0v7.5M6 13.5V10h4v3.5', all:'M2.5 3.5h4v4h-4zM9.5 3.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z',
    lang:'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zM2 8h12M8 2c2.5 2.5 2.5 9.5 0 12M8 2C5.5 4.5 5.5 11.5 8 14', aa:'M2 12.5L5.5 3.5 9 12.5M3.3 9.5h4.4M10 12.5V7a2 2 0 1 1 4 0v5.5M10 10h4', chat:'M2.5 3.5h11v7h-6l-3 2.5V10.5h-2z', side:'M2 3.5h12v9H2zM6 3.5v9' };
  const ic=k=>`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${P[k]}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  /* each row carries a small coloured tile, as in macOS System Settings: the colour groups what belongs together */
  const TILE={search:'#8E8E93',map:'#34C759',list:'#0A84FF',dash:'#5E5CE6',check:'#FF9F0A',code:'#636366',plus:'#30B0C7',legend:'#0A84FF',clock:'#FF9F0A',ruler:'#FF6482',cube:'#5E5CE6',sat:'#32ADE6',layers:'#0A84FF',tips:'#FFCC00',
    all:'#8E8E93',building:'#AF52DE',bridge:'#0A84FF',infra:'#A2845E',lang:'#34C759',aa:'#0A84FF',chat:'#5AC8FA',side:'#8E8E93'};
  const tile=k=>`<i class="sb-ic" style="--c:${TILE[k]||'#0A84FF'}">${ic(k)}</i>`;
  const row=(k,label,act,cls='')=>{ const link=/\.html/.test(act); return `<a class="sb-row ${cls}" href="${link?act:'#'}" data-act="${link?'':act}" ${link&&act===file?'aria-current="page"':''}>${tile(k)}<span>${label}</span></a>`; };
  const groups=[];
  groups.push({h:t('Atlas','Atlas'),rows:[row('search',t('Search','Iskanje'),'search'),row('map',t('Map','Zemljevid'),'index.html'),row('list',t('Assets','Objekti'),'twin.html'),row('dash',t('Dashboard','Pregled'),'dashboard.html'),row('check',t('Data quality','Kakovost podatkov'),'questions.html'),row('code',t('Data API','Podatkovni API'),'api.html'),row('plus',t('Add object','Dodaj objekt'),'add.html')]});
  if(onMap) groups.push({h:t('Map','Zemljevid'),rows:[row('legend',t('Legend','Legenda'),'legend'),row('clock',t('Timeline','Časovnica'),'timeline'),row('ruler',t('Measure','Merjenje'),'measure'),row('cube',t('3D view','3D pogled'),'3d'),row('sat',t('Satellite','Satelit'),'sat'),row('layers',t('Map options','Možnosti zemljevida'),'layers'),row('tips',t('Tips','Nasveti'),'tips')]});
  groups.push({h:t('Browse','Brskaj'),rows:onMap?[row('all',t('All records','Vsi zapisi'),'nav:projects'),row('building',t('Buildings','Stavbe'),'nav:buildings'),row('bridge',t('Bridges','Mostovi'),'nav:bridges'),row('infra',t('Infrastructure','Infrastruktura'),'nav:infrastructure')]:[row('all',t('All records','Vsi zapisi'),'twin.html'),row('building',t('Buildings','Stavbe'),'twin.html#buildings'),row('bridge',t('Bridges','Mostovi'),'twin.html#bridges'),row('infra',t('Infrastructure','Infrastruktura'),'twin.html#infrastructure')]});
  groups.push({h:t('Settings','Nastavitve'),rows:[row('lang',t('Slovenščina','English'),'lang'),row('aa',t('Display','Prikaz'),'display'),row('chat','ZAGBot','chat')]});
  const side=document.createElement('nav'); side.className='sidebar'; side.setAttribute('aria-label',t('Sidebar','Stranska vrstica')); side.hidden=true;
  side.innerHTML=`<div class="sb-top"><img src="img/logo.webp" alt="ZAG"><b>${t('Digital Atlas','Digitalni atlas')}</b><button type="button" class="sb-x" aria-label="${t('Close the sidebar','Zapri stransko vrstico')}">${ic('side')}</button></div><label class="sb-find">${ic('search')}<input type="search" placeholder="${t('Search the atlas','Iskanje po atlasu')}" aria-label="${t('Search the sidebar and the atlas','Iskanje v stranski vrstici in atlasu')}"></label>`+`<div class="sb-body">`+groups.map(g=>`<h6>${g.h}</h6><div class="sb-g">${g.rows.join('')}</div>`).join('')+`</div><div class="sb-foot"><span class="sb-live"><i></i>LIVE</span><span class="sb-clock"></span></div>`;
  document.body.appendChild(side);
  const scrim=document.createElement('div'); scrim.className='sb-scrim'; scrim.hidden=true; document.body.appendChild(scrim);
  const btn=document.createElement('button'); btn.type='button'; btn.className='sb-btn'; btn.setAttribute('aria-expanded','false'); btn.setAttribute('aria-controls','sidebar'); btn.title=t('Sidebar  [','Stranska vrstica  ['); btn.setAttribute('aria-label',t('Open the sidebar','Odpri stransko vrstico')); btn.innerHTML=ic('side');
  const head=document.querySelector('header.hdr,header.thdr'); if(head) head.insertBefore(btn,head.firstChild); side.id='sidebar';
  const KEY='zag_sidebar'; let open=false;
  function set(on){ open=on; side.hidden=!on; scrim.hidden=!on||innerWidth>1100; btn.setAttribute('aria-expanded',String(on)); document.body.classList.toggle('sb-open',on); if(innerWidth>1100) try{ localStorage.setItem(KEY,on?'1':'0'); }catch(_){} if(on){ requestAnimationFrame(()=>side.classList.add('in')); } else side.classList.remove('in'); }
  btn.onclick=()=>set(!open); addEventListener('resize',()=>{ scrim.hidden=!open||innerWidth>1100; }); side.querySelector('.sb-x').onclick=()=>set(false); scrim.onclick=()=>set(false);
  document.addEventListener('keydown',e=>{ if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if(e.key==='['){ e.preventDefault(); set(!open); } else if(e.key==='Escape'&&open&&innerWidth<=1100) set(false); });
  const click=id=>{ const el=document.getElementById(id); if(el) el.click(); };
  const acts={
    search:()=>{ const q=document.getElementById('q')||document.querySelector('.jump, .find, input[type=search]'); if(q){ q.focus(); q.select&&q.select(); } else location.href='index.html'; },
    legend:()=>{ const s=document.getElementById('lgdShow'), h=document.getElementById('lgdHide'); if(s&&!s.hidden) s.click(); else if(h) h.click(); },
    timeline:()=>{ const s=document.getElementById('tlShow'), h=document.getElementById('tlHide'); if(s&&!s.hidden) s.click(); else if(h) h.click(); },
    measure:()=>click('bMeasure'), '3d':()=>click('b3d'), sat:()=>click('bSat'), layers:()=>click('bLayers'),
    tips:()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'?'})),
    lang:()=>window.setLang&&window.setLang(sl?'en':'sl'), display:()=>{ const b=document.querySelector('.dspb'); if(b) b.click(); },
    chat:()=>{ if(window.ZAGBot) ZAGBot.open(); } };
  side.addEventListener('click',e=>{ const a=e.target.closest('.sb-row'); if(!a) return; const act=a.dataset.act; if(!act) return; e.preventDefault();
    if(act.startsWith('nav:')){ const b=document.querySelector(`#nav button[data-nav="${act.slice(4)}"]`); if(b) b.click(); side.querySelectorAll('.sb-row[data-act^="nav:"]').forEach(x=>x.classList.toggle('on',x===a)); }
    else if(acts[act]) acts[act]();
    if(innerWidth<=1100&&act!=='search') set(false); });
  /* the field at the top filters the rows; Enter opens the only row left, or searches the atlas for the words */
  const find=side.querySelector('.sb-find input');
  find.addEventListener('input',()=>{ const v=find.value.trim().toLowerCase(); side.querySelectorAll('.sb-g').forEach(g=>{ let any=false; g.querySelectorAll('.sb-row').forEach(r=>{ const on=!v||r.textContent.toLowerCase().includes(v); r.hidden=!on; any=any||on; }); g.hidden=!any; g.previousElementSibling.hidden=!any; }); });
  find.addEventListener('keydown',e=>{ if(e.key!=='Enter') return; e.preventDefault(); const vis=[...side.querySelectorAll('.sb-row:not([hidden])')]; const v=find.value.trim(); if(!v) return;
    if(vis.length===1){ vis[0].click(); return; } const q=document.getElementById('q'); if(q){ q.value=v; q.dispatchEvent(new Event('input',{bubbles:true})); q.focus(); if(innerWidth<=1100) set(false); } else location.href='index.html?q='+encodeURIComponent(v); });
  /* the live clock in the footer, Slovenian time, the Slovenian way */
  const clock=()=>{ const f=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Ljubljana',day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()), g=k=>(f.find(x=>x.type===k)||{}).value; side.querySelector('.sb-clock').textContent=`${+g('day')}. ${+g('month')}. ${g('year')}, ${g('hour')}.${g('minute')}`; };
  clock(); setInterval(clock,15000);
  /* the state of the map tools shows in the rows */
  const sync=()=>{ if(!onMap) return; const on=(act,v)=>{ const r=side.querySelector(`.sb-row[data-act="${act}"]`); if(r) r.classList.toggle('on',!!v); };
    on('3d',document.getElementById('b3d')&&document.getElementById('b3d').getAttribute('aria-pressed')==='true'); on('sat',document.getElementById('bSat')&&document.getElementById('bSat').getAttribute('aria-pressed')==='true');
    on('measure',document.getElementById('bMeasure')&&document.getElementById('bMeasure').getAttribute('aria-pressed')==='true'); const l=document.getElementById('lgd'); on('legend',l&&!l.hidden); const tl=document.getElementById('tl'); on('timeline',tl&&!tl.hidden); };
  new MutationObserver(sync).observe(document.body,{attributes:true,subtree:true,attributeFilter:['aria-pressed','hidden']}); sync();
  let saved=null; try{ saved=localStorage.getItem(KEY); }catch(_){}
  if(saved==='1'&&innerWidth>1100) set(true);
})();
