'use strict';
/* Live camera on a record: a YouTube live stream (for example a phone streaming through Larix Broadcaster) played
   inside the record panel on the map and on the record page.
   Two ways to show one: listed in data/live.json for everyone, with a time after which it disappears on its own,
   or for a demonstration with ?live=<YouTube link> in the address of the map (the selected record) or of a record page.
   The video is served by YouTube (privacy-enhanced mode, no cookies until it plays); nothing passes through the atlas. */
(function(){
  if(window.top!==window.self) return;
  const sl=window.LANG==='sl', q=new URLSearchParams(location.search), file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  /* any YouTube link form, or a bare video id */
  const ytId=s=>{ s=String(s||'').trim(); if(/^[\w-]{11}$/.test(s)) return s; try{ const u=new URL(s); if(/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1,12);
    if(/youtube(-nocookie)?\.com$/.test(u.hostname.replace(/^www\.|^m\./,''))){ if(u.searchParams.get('v')) return u.searchParams.get('v'); const m=u.pathname.match(/\/(live|embed|shorts)\/([\w-]{11})/); if(m) return m[2]; } }catch(_){} return null; };
  let CFG={};
  const ready=fetch('data/live.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(j=>{ CFG=(j&&j.streams)||{}; }).catch(()=>{});
  const urlLive=ytId(q.get('live'));
  function streamFor(id){ if(!id) return null;
    if(urlLive&&(file==='twin.html'?q.get('id')===id:true)) return {id:urlLive,title:'',demo:true};
    const s=CFG[id]; if(!s) return null; const v=ytId(s.youtube); if(!v) return null; if(s.until&&Date.parse(s.until)<Date.now()) return null; return {id:v,title:s.title||''}; }
  function block(s){ const el=document.createElement('section'); el.className='live';
    el.innerHTML=`<header><span class="live-dot" aria-hidden="true"></span><b>${sl?'Kamera v živo':'Live camera'}</b>${s.title?`<small>${s.title.replace(/[<>&]/g,'')}</small>`:''}</header>
      <div class="live-v"><iframe src="https://www.youtube-nocookie.com/embed/${s.id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1" title="${sl?'Kamera v živo':'Live camera'}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
      <p class="live-n">${sl?'Prenos prek YouTuba, z zamikom nekaj sekund. Če prenos ne teče, predvajalnik to pove.':'Streamed through YouTube, a few seconds behind. If the stream is not running, the player says so.'}${s.demo?(sl?' Prikazano samo z naslovom te strani.':' Shown only through the address of this page.'):''}</p>`;
    return el; }
  /* on the map: under the button that opens the asset page, when a record is selected */
  document.addEventListener('atlas:selected',e=>{ const id=e.detail; ready.then(()=>{ const s=streamFor(id); if(!s) return;
    /* the panel is drawn just after the selection is announced, so wait for its button to the asset page */
    const put=()=>{ const a=document.querySelector(`#info a.twinlink[href$="${encodeURIComponent(id)}"], .info a.twinlink[href$="${encodeURIComponent(id)}"]`); if(!a) return false; const box=a.closest('.info,#info'); if(box.querySelector('.live')) return true; (a.closest('p')||a).after(block(s)); return true; };
    if(put()) return; const mo=new MutationObserver(()=>{ if(put()) mo.disconnect(); }); mo.observe(document.body,{childList:true,subtree:true}); setTimeout(()=>mo.disconnect(),8000); }); });
  /* on the record page: under the record's facts, once the page has drawn them */
  if(file==='twin.html'&&q.get('id')&&!/embed/.test(location.search)){ const id=q.get('id');
    ready.then(()=>{ const s=streamFor(id); if(!s) return; const place=()=>{ const m=document.querySelector('.asset .btnrow'); if(!m||document.querySelector('.live')) return !!m; m.after(block(s)); return true; };
      if(!place()){ const mo=new MutationObserver(()=>{ if(place()) mo.disconnect(); }); mo.observe(document.body,{childList:true,subtree:true}); } }); }
  window.ZAGLive={streamFor,ytId,ready};
})();
