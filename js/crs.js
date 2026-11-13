'use strict';
/* Slovenian national coordinates D96/TM (EPSG:3794): Transverse Mercator on GRS80, central meridian 15° E, scale 0.9999,
   false easting 500 000 m, false northing -5 000 000 m. Krüger series to the 6th order (Karney 2011), accurate to well under a millimetre in Slovenia.
   toD96([lon,lat]) gives [e,n] in metres, fromD96([e,n]) gives [lon,lat]. Axes are named e (easting) and n (northing). */
(function(root){
  const a=6378137, f=1/298.257222101, n=f/(2-f), k0=0.9999, lon0=15*Math.PI/180, FE=500000, FN=-5000000;
  const n2=n*n, n3=n2*n, n4=n3*n, n5=n4*n, n6=n5*n;
  const A=a/(1+n)*(1+n2/4+n4/64+n6/256);
  const al=[0,n/2-2*n2/3+5*n3/16+41*n4/180-127*n5/288+7891*n6/37800, 13*n2/48-3*n3/5+557*n4/1440+281*n5/630-1983433*n6/1935360,
    61*n3/240-103*n4/140+15061*n5/26880+167603*n6/181440, 49561*n4/161280-179*n5/168+6601661*n6/7257600, 34729*n5/80640-3418889*n6/1995840, 212378941*n6/319334400];
  const be=[0,n/2-2*n2/3+37*n3/96-n4/360-81*n5/512+96199*n6/604800, n2/48+n3/15-437*n4/1440+46*n5/105-1118711*n6/3870720,
    17*n3/480-37*n4/840-209*n5/4480+5569*n6/90720, 4397*n4/161280-11*n5/504-830251*n6/7257600, 4583*n5/161280-108847*n6/3991680, 20648693*n6/638668800];
  const e=Math.sqrt(f*(2-f));
  function toD96(ll){ const lon=ll[0]*Math.PI/180-lon0, lat=ll[1]*Math.PI/180;
    const t=Math.sinh(Math.atanh(Math.sin(lat))-e*Math.atanh(e*Math.sin(lat)));
    const xi=Math.atan2(t,Math.cos(lon)), eta=Math.atanh(Math.sin(lon)/Math.sqrt(1+t*t));
    let x=xi, y=eta; for(let j=1;j<=6;j++){ x+=al[j]*Math.sin(2*j*xi)*Math.cosh(2*j*eta); y+=al[j]*Math.cos(2*j*xi)*Math.sinh(2*j*eta); }
    return [FE+k0*A*y, FN+k0*A*x]; }
  function fromD96(en){ const xi=(en[1]-FN)/(k0*A), eta=(en[0]-FE)/(k0*A);
    let x=xi, y=eta; for(let j=1;j<=6;j++){ x-=be[j]*Math.sin(2*j*xi)*Math.cosh(2*j*eta); y-=be[j]*Math.cos(2*j*xi)*Math.sinh(2*j*eta); }
    const chi=Math.asin(Math.sin(x)/Math.cosh(y)); let lat=chi;
    for(let i=0;i<8;i++){ const s=Math.sin(lat); lat=2*Math.atan(Math.tan(Math.PI/4+chi/2)*Math.pow((1+e*s)/(1-e*s),e/2))-Math.PI/2; }
    const lon=lon0+Math.atan2(Math.sinh(y),Math.cos(x));
    return [lon*180/Math.PI, lat*180/Math.PI]; }
  const fmtD96=ll=>{ const p=toD96(ll), g=v=>Math.round(v).toLocaleString('en-GB').replace(/,/g,' '); return `e ${g(p[0])} m, n ${g(p[1])} m`; };
  /* inside the D96/TM range used for Slovenia */
  const isD96=(e,n)=>e>=350000&&e<=650000&&n>=0&&n<=220000;
  root.toD96=toD96; root.fromD96=fromD96; root.fmtD96=fmtD96; root.isD96=isD96;
  if(typeof module!=='undefined') module.exports={toD96,fromD96,fmtD96,isD96};
})(typeof window!=='undefined'?window:globalThis);

/* ZAG areas of expertise as named on zag.si, used to link each record to the matching ZAG page */
(function(root){
  const U='https://www.zag.si/en/areas-of-expertise/';
  const AREA={bridges:['Bridges','bridges/'],tunnels:['Tunnels and underground structures','tunnels-and-underground-structures/'],dams:['Dams','dams/'],
    cableways:['Cableway installations','cableway-installations/'],towers:['Transmission and other towers','transmission-and-other-towers/'],buildings:['Buildings','buildings/'],
    railways:['Railways','railways/'],roads:['Roads','roads/'],hazards:['Natural disasters and other kinds of emergencies','natural-disasters-and-other-kinds-of-emergencies/']};
  const BY_TYPE={bridge:'bridges',footbridge:'bridges','road structure':'roads',tunnel:'tunnels','dam / hydropower':'dams',cableway:'cableways','tower / mast':'towers',
    building:'buildings',institution:'buildings',company:'buildings',landslide:'hazards','study area (earthquake)':'hazards'};
  const BY_ID={sz_masts:'railways',strunjan:'hazards'};
  root.zagArea=p=>{ const k=BY_ID[p.id]||BY_TYPE[p.object_type]; if(!k) return null; const a=AREA[k]; return {name:a[0],url:U+a[1]}; };
  root.zagAreaHTML=p=>{ const a=root.zagArea(p); return a?`<p class="zag-area">ZAG area of expertise: <a href="${a.url}" target="_blank" rel="noopener">${a.name}</a></p>`:''; };
})(typeof window!=='undefined'?window:globalThis);
