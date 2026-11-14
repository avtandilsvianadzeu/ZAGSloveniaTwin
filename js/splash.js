'use strict';
/* Opening of the atlas: the ZAG mark is built the way a structure is. Formwork is drawn first, the letters are poured
   from the bottom with a liquid surface, the formwork is struck, the name appears, and the finished mark glides into the
   header. The artwork is the original logo file, untouched; only its appearance is staged. Once per visit, skipped by a
   click or a key, a plain fade when the system asks for reduced motion, and it never outlasts the map by more than a moment. */
(function(){
  let seen=false; try{ seen=sessionStorage.getItem('zag_splash')==='1'; }catch(_){}
  if(seen||/embed/.test(location.search)) return;
  try{ sessionStorage.setItem('zag_splash','1'); }catch(_){}
  const reduced=matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sl=window.LANG==='sl';
  const root=document.createElement('div'); root.className='splash'; root.setAttribute('role','status'); root.setAttribute('aria-label',sl?'Nalaganje atlasa':'Loading the atlas');
  root.innerHTML=`<div class="sp-card"><div class="sp-logo"><img class="sp-orig" src="img/logo.webp" alt="${sl?'Zavod za gradbeništvo Slovenije':'Slovenian National Building and Civil Engineering Institute'}"><div class="sp-mark"><img class="sp-form" src="img/logo_formwork.png" alt=""><img class="sp-fill" src="img/logo_mark.png" alt="ZAG"></div></div><div class="sp-bar"><i></i></div><p class="sp-txt">${sl?'Opaž, beton, konstrukcija':'Formwork, concrete, structure'}</p></div>`;
  document.body.appendChild(root); document.body.classList.add('splashing');
  const card=root.querySelector('.sp-card'), form=root.querySelector('.sp-form'), fill=root.querySelector('.sp-fill'), name=root.querySelector('.sp-orig'), bar=root.querySelector('.sp-bar i'), txt=root.querySelector('.sp-txt');
  const WAVE="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300' preserveAspectRatio='none'%3E%3Cpath d='M0 40 Q 25 28 50 40 T 100 40 T 150 40 T 200 40 V300 H0z' fill='%23000'/%3E%3C/svg%3E\")";
  fill.style.webkitMaskImage=WAVE; fill.style.maskImage=WAVE; fill.style.webkitMaskSize='200% 300%'; fill.style.maskSize='200% 300%'; fill.style.webkitMaskRepeat='no-repeat'; fill.style.maskRepeat='no-repeat';
  const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2, clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  let done=false, mapReady=false, t0=null;
  document.addEventListener('atlas:ready',()=>{ mapReady=true; },{once:true});
  const finish=()=>{ if(done) return; done=true;
    /* the finished mark glides to the logo in the header */
    const brand=document.querySelector('.hdr .brand img, .hdr .brand, .brand img'), r=brand&&brand.getBoundingClientRect(), c=root.querySelector('.sp-logo').getBoundingClientRect();
    if(r&&c.width){ const s=Math.max(.08,r.height/c.height); card.style.transition='transform .7s cubic-bezier(.3,.8,.3,1),opacity .55s ease .2s'; card.style.transformOrigin='0 0'; card.style.transform=`translate(${r.left-c.left}px,${r.top-c.top}px) scale(${s})`; card.style.opacity='0'; }
    root.style.transition='opacity .6s ease .25s'; root.style.opacity='0';
    setTimeout(()=>{ root.remove(); document.body.classList.remove('splashing'); },900); };
  if(reduced){ fill.style.webkitMaskImage='none'; fill.style.maskImage='none'; form.style.opacity='0'; name.style.opacity='1'; name.style.transform='none'; bar.style.width='100%'; setTimeout(finish,900); return; }
  const skip=()=>{ if(!done) finish(); }; root.addEventListener('click',skip); document.addEventListener('keydown',skip,{once:true});
  function step(ts){ if(done) return; if(t0===null) t0=ts; const t=(ts-t0)/1000;
    card.style.opacity=String(clamp(t/.35)); const sc=.82+ease(clamp(t/.7))*.18; card.style.transform=`scale(${sc})`;
    /* 1. formwork drawn from left to right */
    const f=ease(clamp((t-.15)/.6)); form.style.clipPath=`inset(0 ${100-f*100}% 0 0)`; form.style.opacity=String(1-clamp((t-2.05)/.4));
    /* 2. the pour: the mask rises through the letters with a liquid surface that drifts sideways */
    const p=ease(clamp((t-.75)/1.25)); const y=-50+p*75; const x=50+Math.sin(t*2.6)*50; fill.style.webkitMaskPosition=`${x}% ${y}%`; fill.style.maskPosition=`${x}% ${y}%`;
    /* 3. the name block arrives, the level gauge fills with the pour */
    const n=ease(clamp((t-2.0)/.6)); name.style.opacity=String(n); name.style.transform='none';
    bar.style.width=(clamp((t-.15)/.6)*.2+p*.65+n*.15)*100+'%';
    txt.textContent=t<.75?(sl?'Opaž':'Formwork'):t<1.9?(sl?'Beton':'Concrete'):(sl?'Konstrukcija':'Structure');
    if(t>=2.75&&(mapReady||t>=4.5)) finish(); else requestAnimationFrame(step); }
  requestAnimationFrame(step);
})();
