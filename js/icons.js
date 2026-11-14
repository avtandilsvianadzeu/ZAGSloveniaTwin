'use strict';
/* Icons: SF-Symbols-style line glyphs (24-unit grid) used in the header, the controls and the map markers. */
const SVG=(d,extra)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}${extra||''}</svg>`;
const ICON={
  projects:SVG('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  buildings:SVG('<path d="M4 20V5l6-2v17M10 9l10 3v8M4 20h16M7 8h1M7 12h1M7 16h1M14 14h1M17 15h1"/>'),
  bridges:SVG('<path d="M2 15h20M4 15V9M20 15V9M4 9q8-6 16 0M8 15v-4M12 15v-5M16 15v-4"/>'),
  infrastructure:SVG('<path d="M3 20h18M6 20V9a6 6 0 0 1 12 0v11M9 20v-5h6v5"/>'),
  about:SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  layers:SVG('<path d="M12 4l9 5-9 5-9-5zM3 14l9 5 9-5"/>'),
  map:SVG('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>'),
  satellite:SVG('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>'),
  cube:SVG('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  plus:SVG('<path d="M12 5v14M5 12h14"/>'), minus:SVG('<path d="M5 12h14"/>'),
  rotl:SVG('<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4.5h4.5"/>'), rotr:SVG('<path d="M20 12a8 8 0 1 1-3-6.2M20 4v4.5h-4.5"/>'),
  up:SVG('<path d="M5 15l7-7 7 7"/>'), down:SVG('<path d="M5 9l7 7 7-7"/>'),
  home:SVG('<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"/>'), search:SVG('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  close:SVG('<path d="M6 6l12 12M18 6L6 18"/>'), back:SVG('<path d="M15 5l-7 7 7 7"/>'), ext:SVG('<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>'),
  ruler:SVG('<path d="M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>'),
  pin:SVG('<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>')
};
/* marker glyphs by object type, drawn in a 24-unit box */
const MARK={
  bridge:'M3 15h18M5 15V10M19 15V10M5 10q7-6 14 0M9 15v-3M15 15v-3', footbridge:'M3 15h18M5 15V10M19 15V10M5 10q7-6 14 0M9 15v-3M15 15v-3','road structure':'M3 15h18M5 15V10M19 15V10M5 10q7-6 14 0',
  tunnel:'M4 19V11a8 8 0 0 1 16 0v8M9 19v-5h6v5', 'dam / hydropower':'M3 8q3-3 6 0t6 0 6 0M3 14q3-3 6 0t6 0 6 0M4 19h16', cableway:'M3 6h18M12 6v4M8 10h8v6H8z',
  'tower / mast':'M12 3v18M7 21l5-18 5 18M9 14h6', building:'M5 20V9l7-5 7 5v11M10 20v-6h4v6M5 20h14', company:'M5 20V9l7-5 7 5v11M10 20v-6h4v6M5 20h14', institution:'M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M4 20h16M4 10l8-5 8 5',
  'study area (earthquake)':'M3 12h4l2-5 3 10 3-8 2 3h4', 'geotechnical site':'M3 18l6-10 4 6 3-3 5 7z', landslide:'M4 6l8 8-4 6M12 14l8 4', other:'M12 4v16M4 12h16'};
/* approx: the point is an area centre (settlement, site, epicentre), drawn lighter with a dashed ring so it does not read as the object itself */
function markerImage(type,kind,approx){
  const S=96,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
  const col=kind==='fac'?'#5856D6':kind==='ref'?'#8E8E93':'#007AFF';
  g.save(); g.shadowColor='rgba(0,0,0,.30)'; g.shadowBlur=9; g.shadowOffsetY=3; g.beginPath(); g.arc(S/2,S/2-2,33,0,Math.PI*2); g.fillStyle='#fff'; g.fill(); g.restore();
  g.beginPath(); g.arc(S/2,S/2-2,28.5,0,Math.PI*2); g.fillStyle=col; g.globalAlpha=approx?.5:1; g.fill(); g.globalAlpha=1;
  if(approx){ g.save(); g.setLineDash([7,5]); g.lineWidth=4; g.strokeStyle=col; g.beginPath(); g.arc(S/2,S/2-2,31,0,Math.PI*2); g.stroke(); g.restore(); }
  g.save(); g.translate(S/2-27,S/2-29); g.scale(2.25,2.25); g.strokeStyle='#fff'; g.lineWidth=1.8; g.lineCap='round'; g.lineJoin='round';
  g.stroke(new Path2D(MARK[type]||MARK.other)); g.restore();
  return g.getImageData(0,0,S,S);
}
