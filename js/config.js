'use strict';
/* Config: shared helpers, endpoints, palette and state */
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CHEV='<svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1l5 5.5-5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BACK='<svg viewBox="0 0 12 20"><path d="M10 1L2 10l8 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const XI='<svg viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function toast(m,ms){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),ms||2200);}
const phone=()=>innerWidth<=760;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

const Z=window.ZAG; if(!Z){document.body.textContent='data.js did not load.';throw new Error('data.js missing');}
const S=Z.stories, E=Z.entries, P=Z.projects, SRC=Z.src, DOMS=Z.domains;
const EBY=Object.fromEntries(E.map(e=>[e.id,e]));

/* ---------- endpoints (all keyless) ---------- */
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';
const DEM_URL='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const SAT_URL='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
// GURS DOF025 orthophoto (25 cm) published as TMS by Level2.si under CC BY; availability from this origin must be checked, the app falls back to Esri
const DOF_URL='https://gis.level2.si/geoserver/gwc/service/tms/1.0.0/level2%3ADOF025_latest@EPSG%3A3857@jpeg/{z}/{x}/{y}.jpeg';
const PHOTON='https://photon.komoot.io';
const SI_BOUNDS=[[13.375,45.421],[16.610,46.876]];

/* ---------- palette ---------- */
const DCOL={bridge:'#0A84FF',ai:'#7D5BE6',build:'#D98A13',mat:'#22A55C',fire:'#F0483B',geo:'#A0703C',energy:'#13A4BA',herit:'#D63F9B',inst:'#6E7687',tunnel:'#5E5CE6',cable:'#14A3A3',quake:'#C9602F'};
const DOMC=k=>`var(--d-${k||'inst'})`;
const PAL={
 light:{land:'#F6F4EF',park:'#CDE6BD',wood:'rgba(165,208,146,.30)',grass:'rgba(190,220,165,.26)',ice:'#F2F7FA',sand:'#F3EAC8',resid:'rgba(233,228,219,.75)',misc:'#E3ECD3',
  water:'#A5D0F3',aero:'#E6E3DD',runway:'#D3D0CA',
  mw:'#FFDD85',mwC:'#EFC56C',tr:'#FFF0BF',trC:'#E8D29A',sec:'#FFFFFF',secC:'#D5CEC1',min:'#FFFFFF',minC:'#DDD8CF',path:'#FFFFFF',rail:'#B5B0A9',
  bld:'#E4DFD7',bldE:'#D5CFC5',bld3:'#EAE6DF',border:'#9C8FB8',border2:'#C3BCCB',
  txt:'#3A3A3C',place:'#1C1C1E',halo:'rgba(255,255,255,.92)',wtxt:'#3D78B5',rtxt:'#6E6A64',
  hsS:'rgba(95,80,60,.20)',hsH:'rgba(255,255,255,.30)',hsA:'rgba(120,100,80,.10)',
  sky:'#A9CBF2',hor:'#E9EFF5',fog:'#F6F4EF'},
 dark:{land:'#1A2233',park:'#1B3A33',wood:'rgba(34,92,74,.42)',grass:'rgba(40,96,80,.30)',ice:'#26324A',sand:'#2B3245',resid:'rgba(34,44,66,.75)',misc:'#1E2E38',
  water:'#0B1D3A',aero:'#222C42',runway:'#34405C',
  mw:'#5C6CFF',mwC:'#2E3A99',tr:'#6E7DF0',trC:'#2C3780',sec:'#3F4DA0',secC:'#222C5E',min:'#2E3870',minC:'#1D2445',path:'#2B3461',rail:'#5A6690',
  bld:'#26304A',bldE:'#33405F',bld3:'#2E3956',border:'#8C7BFF',border2:'#4B4580',
  txt:'#C9D3EA',place:'#FFFFFF',halo:'rgba(10,16,32,.9)',wtxt:'#7FA8FF',rtxt:'#AAB4D6',
  hsS:'rgba(0,0,20,.55)',hsH:'rgba(120,150,255,.06)',hsA:'rgba(0,0,30,.3)',
  sky:'#0A1430',hor:'#1B2547',fog:'#1A2233'}
};
const SATSKY={sky:'#8FB6E3',hor:'#D9E4EE',fog:'#B9C3C9'};

/* ---------- state ---------- */
let theme=(()=>{const a=document.documentElement.getAttribute('data-theme');return a||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');})();
const emit=(n,d)=>document.dispatchEvent(new CustomEvent('atlas:'+n,{detail:d}));
let base='map', is3d=true, selId=null, bldPref=null;
let map=null, ready=false, ORIG={}, TOUCHED={}, selMarker=null, hlToken=0, orbitOn=false, userMoved=false;
/* credits required by the providers (Esri World Imagery item credits; Mapzen terrain attribution list) */
const TERRAIN_CREDIT='<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Terrain: Mapzen, AWS Terrain Tiles (EU-DEM produced using Copernicus data, DGM Österreich, USGS)</a>';
const IMAGERY_CREDIT='Imagery: <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener">Esri, Vantor, Earthstar Geographics, and the GIS User Community</a>';
