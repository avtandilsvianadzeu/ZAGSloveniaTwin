'use strict';
/* Measure: distances along a line clicked on the map, computed on the GRS80 ellipsoid (Vincenty inverse formula),
   with the running total at every point. Esc, a double click or Done ends the line; Clear removes it. */
(function(){
  const btn=document.getElementById('bMeasure'); if(!btn) return;
  const A=6378137, F=1/298.257222101, B=A*(1-F), RAD=Math.PI/180;
  /* geodesic distance in metres between two WGS 84 / ETRS89 positions, on the GRS80 ellipsoid */
  function geodesic(p,q){
    const L=(q[0]-p[0])*RAD, U1=Math.atan((1-F)*Math.tan(p[1]*RAD)), U2=Math.atan((1-F)*Math.tan(q[1]*RAD));
    const sU1=Math.sin(U1), cU1=Math.cos(U1), sU2=Math.sin(U2), cU2=Math.cos(U2);
    let lam=L, it=0, sinS, cosS, sig, sinA, cos2A, cos2SM;
    do{ const sl=Math.sin(lam), cl=Math.cos(lam);
      sinS=Math.hypot(cU2*sl,cU1*sU2-sU1*cU2*cl); if(!sinS) return 0;
      cosS=sU1*sU2+cU1*cU2*cl; sig=Math.atan2(sinS,cosS); sinA=cU1*cU2*sl/sinS; cos2A=1-sinA*sinA;
      cos2SM=cos2A?cosS-2*sU1*sU2/cos2A:0; const C=F/16*cos2A*(4+F*(4-3*cos2A)), prev=lam;
      lam=L+(1-C)*F*sinA*(sig+C*sinS*(cos2SM+C*cosS*(-1+2*cos2SM*cos2SM)));
      if(Math.abs(lam-prev)<1e-12) break; }while(++it<200);
    if(it>=200){ const R=6371008.8, d=Math.acos(Math.min(1,Math.sin(p[1]*RAD)*Math.sin(q[1]*RAD)+Math.cos(p[1]*RAD)*Math.cos(q[1]*RAD)*Math.cos(L))); return R*d; }
    const u2=cos2A*(A*A-B*B)/(B*B), k1=(Math.sqrt(1+u2)-1)/(Math.sqrt(1+u2)+1), Ac=(1+k1*k1/4)/(1-k1), Bc=k1*(1-3*k1*k1/8);
    const dS=Bc*sinS*(cos2SM+Bc/4*(cosS*(-1+2*cos2SM*cos2SM)-Bc/6*cos2SM*(-3+4*sinS*sinS)*(-3+4*cos2SM*cos2SM)));
    return B*Ac*(sig-dS);
  }
  const sl=()=>window.LANG==='sl';
  const fmt=m=>m>=1000?(m/1000).toLocaleString(sl()?'sl-SI':'en-GB',{maximumFractionDigits:m>=10000?2:3})+' km':Math.round(m*10)/10+' m';
  let on=false, pts=[], ready=false;
  const read=document.createElement('div'); read.className='mread'; read.hidden=true; read.setAttribute('role','status');
  document.getElementById('map').parentNode.appendChild(read);
  const SRC='measure';
  function ensure(){ if(ready||!window.zagMap||!zagMap.getStyle()) return; ready=true;
    zagMap.addSource(SRC,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    zagMap.addLayer({id:'measure-l',type:'line',source:SRC,filter:['==','$type','LineString'],paint:{'line-color':'#D9480F','line-width':2.5,'line-dasharray':[2,1.5]}});
    zagMap.addLayer({id:'measure-p',type:'circle',source:SRC,filter:['==','$type','Point'],paint:{'circle-radius':5,'circle-color':'#fff','circle-stroke-color':'#D9480F','circle-stroke-width':2}});
    zagMap.addLayer({id:'measure-t',type:'symbol',source:SRC,filter:['==','$type','Point'],layout:{'text-field':['get','label'],'text-size':11.5,'text-offset':[0,-1.3],'text-anchor':'bottom','text-font':['Noto Sans Bold']},paint:{'text-color':'#D9480F','text-halo-color':'rgba(255,255,255,.95)','text-halo-width':1.6}}); }
  const total=()=>{ let s=0; for(let i=1;i<pts.length;i++) s+=geodesic(pts[i-1],pts[i]); return s; };
  function draw(){ ensure(); if(!ready) return; let s=0; const f=pts.map((p,i)=>{ if(i) s+=geodesic(pts[i-1],p); return {type:'Feature',geometry:{type:'Point',coordinates:p},properties:{label:i?fmt(s):''}}; });
    if(pts.length>1) f.push({type:'Feature',geometry:{type:'LineString',coordinates:pts},properties:{}});
    zagMap.getSource(SRC).setData({type:'FeatureCollection',features:f}); paint(); }
  function paint(){ if(!on){ read.hidden=true; return; } read.hidden=false; const n=pts.length, t=total(), last=n>1?geodesic(pts[n-2],pts[n-1]):0;
    const hint=n===0?(sl()?'Kliknite na zemljevid za prvo točko.':'Click the map for the first point.'):n===1?(sl()?'Kliknite naslednjo točko.':'Click the next point.'):(sl()?'Dvoklik ali Esc konča črto.':'Double click or Esc ends the line.');
    read.innerHTML=`<b>${sl()?'Merjenje':'Measure'}</b>${n>1?`<span class="mt">${fmt(t)}</span><span class="ms">${sl()?'zadnji odsek':'last segment'} ${fmt(last)}, ${n} ${sl()?'točk':'points'}</span>`:''}<span class="mh">${hint}</span><span class="mb"><button type="button" data-a="undo" ${n?'':'disabled'}>${sl()?'Razveljavi':'Undo'}</button><button type="button" data-a="clear" ${n?'':'disabled'}>${sl()?'Počisti':'Clear'}</button><button type="button" data-a="done" class="pri">${sl()?'Končaj':'Done'}</button></span><i class="mn">${sl()?'Geodetska razdalja na elipsoidu GRS80':'Geodesic distance on the GRS80 ellipsoid'}</i>`; }
  read.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const a=b.dataset.a; if(a==='undo') pts.pop(); else if(a==='clear') pts=[]; else if(a==='done'){ set(false); return; } draw(); });
  const cont=document.getElementById('map');
  const click=e=>{ if(!on) return; if(e.target.closest('.mread,.vctl,.maplibregl-ctrl')) return; e.stopPropagation(); e.preventDefault(); if(e.detail>1) return;
    const r=zagMap.getCanvas().getBoundingClientRect(), ll=zagMap.unproject([e.clientX-r.left,e.clientY-r.top]); pts.push([ll.lng,ll.lat]); draw(); };
  const dbl=e=>{ if(!on) return; e.stopPropagation(); e.preventDefault(); set(false); };
  function set(v){ on=v; btn.setAttribute('aria-pressed',on); btn.title=on?(sl()?'Merjenje je vklopljeno. Kliknite za konec':'Measuring. Click to finish'):(sl()?'Izmerite razdaljo na zemljevidu':'Measure a distance on the map');
    cont.classList.toggle('measuring',on); try{ on?zagMap.doubleClickZoom.disable():zagMap.doubleClickZoom.enable(); }catch(_){}
    if(on){ draw(); } else { paint(); } }
  cont.addEventListener('click',click,true); cont.addEventListener('dblclick',dbl,true);
  btn.onclick=()=>{ if(on){ set(false); } else { pts=[]; set(true); } };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&on) set(false); });
  /* the measured line stays on the map after Done so it can be read; the next measurement starts fresh */
  window.MEASURE={isOn:()=>on,clear:()=>{ pts=[]; draw(); }};
})();
