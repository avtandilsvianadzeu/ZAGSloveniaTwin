'use strict';
/* Display settings of the atlas, kept in this browser: text size, high contrast, reduced transparency, reduced motion,
   controls that stay visible. Loaded in the head of every page so the choice applies before the first paint.
   The panel itself is built by js/sitenav.js (the Aa button in the header). */
(function(){
  const KEY='zag_display', root=document.documentElement;
  const DEF={size:1,contrast:false,opaque:false,motion:false,keep:false};
  let S={...DEF}; try{ Object.assign(S,JSON.parse(localStorage.getItem(KEY)||'{}')); }catch(_){}
  function apply(){
    root.style.setProperty('--ui-scale',String(S.size||1));
    root.classList.toggle('a11y-hc',!!S.contrast); root.classList.toggle('a11y-rt',!!S.opaque); root.classList.toggle('a11y-rm',!!S.motion); root.classList.toggle('a11y-keep',!!S.keep);
    root.classList.toggle('a11y-big',(S.size||1)>1);
  }
  function set(k,v){ S[k]=v; try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(_){} apply(); document.dispatchEvent(new CustomEvent('zag:display',{detail:{...S}})); }
  function reset(){ S={...DEF}; try{ localStorage.removeItem(KEY); }catch(_){} apply(); document.dispatchEvent(new CustomEvent('zag:display',{detail:{...S}})); }
  apply();
  window.ZAGDisplay={get:()=>({...S}),set,reset,DEF};
})();
