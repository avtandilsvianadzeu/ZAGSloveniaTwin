'use strict';
/* Tips to get started on the map page. Shown on the first visit, then on demand with the "?" key or from the Map menu.
   Every tip does what it says when clicked. Keys: "/" puts the cursor in the search, "?" opens the tips, Esc closes them. */
(function(){
  if(!document.getElementById('map')) return;
  const KEY='zag_tips_seen';
  const box=document.createElement('section'); box.className='tips'; box.setAttribute('aria-label','Tips to get started'); box.hidden=true;
  const TIPS=[
    ['marker','Open a record','Click any marker. Its record opens on the left with the 3D model.',()=>{ close(); toast&&toast('Click any marker on the map'); }],
    ['legend','Filter with the legend','Click a type in the legend to show only those, for example tunnels.',()=>{ close(); const l=document.getElementById('lgd'), s=document.getElementById('lgdShow'); if(l&&l.hidden&&s) s.click(); if(l){ l.classList.add('nudge'); setTimeout(()=>l.classList.remove('nudge'),1600); } }],
    ['time','Play the timeline','See ZAG work appear year by year since 1952.',()=>{ close(); const t=document.getElementById('tl'); if(t&&t.hidden){ const s=document.getElementById('tlShow'); if(s) s.click(); } const p=document.getElementById('tlPlay'); if(p&&p.getAttribute('aria-pressed')!=='true') p.click(); }],
    ['search','Search','Type a structure, a place or an address. Press / at any time.',()=>{ close(); const q=document.getElementById('q'); if(q) q.focus(); }],
    ['bot','Ask ZAGBot','Questions and corrections in plain words, with sources.',()=>{ close(); if(window.ZAGBOT) window.ZAGBOT.open(); }]];
  const ICON={marker:'M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.4 4.5 8.5 4.5 8.5s4.5-5.1 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z',legend:'M2 3h12l-4.6 5.4V13l-2.8 1.3V8.4z',
    time:'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm.7 6.3 2.6 1.6-.7 1.1-3.3-2V4h1.4z',search:'M7 2a5 5 0 1 0 3.1 8.9l3.5 3.5 1-1-3.5-3.5A5 5 0 0 0 7 2zm0 1.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z',
    bot:'M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H7l-3.5 3v-3A1.5 1.5 0 0 1 2 9.5z'};
  box.innerHTML=`<header><b>Tips to get started</b><button type="button" class="tx" aria-label="Close the tips">×</button></header>`+
    TIPS.map(([k,t,d],i)=>`<button type="button" class="tip" data-i="${i}"><i class="ti-${k}"><svg viewBox="0 0 16 16"><path d="${ICON[k]}" fill="currentColor"/></svg></i><span><b>${t}</b><span>${d}</span></span><em>›</em></button>`).join('')+
    `<p class="tkeys">${window.LANG==='sl'?'Tipke: <kbd>/</kbd> iskanje, <kbd>?</kbd> nasveti, <kbd>Esc</kbd> zapri':'Keys: <kbd>/</kbd> search, <kbd>?</kbd> tips, <kbd>Esc</kbd> close'}</p>`;
  document.body.appendChild(box);
  function open(){ box.hidden=false; requestAnimationFrame(()=>box.classList.add('in')); }
  function close(){ box.classList.remove('in'); setTimeout(()=>{ box.hidden=true; },180); try{ localStorage.setItem(KEY,'1'); }catch(_){} }
  box.addEventListener('click',e=>{ if(e.target.closest('.tx')) return close(); const b=e.target.closest('.tip'); if(b) TIPS[+b.dataset.i][3](); });
  document.addEventListener('keydown',e=>{ const t=e.target, typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable); if(typing) return;
    if(e.key==='/'){ const q=document.getElementById('q'); if(q){ e.preventDefault(); q.focus(); } }
    else if(e.key==='?'){ e.preventDefault(); box.hidden?open():close(); }
    else if(e.key==='Escape'&&!box.hidden) close(); });
  window.ZAGTIPS={open,close};
  let seen=false; try{ seen=localStorage.getItem(KEY)==='1'; }catch(_){}
  if(/[?&]tips=1/.test(location.search)) setTimeout(open,600); else if(!seen&&!location.hash) setTimeout(open,1400);
})();
