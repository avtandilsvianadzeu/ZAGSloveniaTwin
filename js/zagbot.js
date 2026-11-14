'use strict';
/* ZAGBot: the chat assistant of the ZAG Digital Atlas.
   Runs fully in the browser. It reads the published data (records and verified values), understands short questions in English
   or Slovenian, answers only from that data with the source link, and offers clickable replies so the input is always exact.
   Changes to the site are never made here: ZAGBot writes a precise request and opens it on GitHub, where the ZAGBot workflow
   (.github/workflows/zagbot.yml) carries it out after the owner submits it. */
(function(){
  if(window.__zagbot||window.top!==window.self||/embed/.test(location.search)) return; window.__zagbot=true;
  const REPO='https://github.com/avtandilsvianadzeu/ZAGSloveniaTwin';
  const ON_MAP=!!document.getElementById('tl')||/index\.html$|\/$/.test(location.pathname)&&!!document.getElementById('map');
  const PAGE_ID=new URLSearchParams(location.search).get('id')||null;
  const css=document.createElement('link'); css.rel='stylesheet'; css.href='css/zagbot.css?v=13'; document.head.appendChild(css);

  /* ---------- the robot, in a Slovenian shirt: white, blue and red with three white peaks ---------- */
  const ROBOT=(size,wave)=>`<svg class="zb-robot" viewBox="0 0 120 132" width="${size}" height="${Math.round(size*1.1)}" aria-hidden="true">
    <line x1="60" y1="6" x2="60" y2="20" stroke="#213469" stroke-width="3" stroke-linecap="round"/><circle class="zb-ant" cx="60" cy="6" r="5" fill="#ED1C24"/>
    <rect x="22" y="18" width="76" height="54" rx="20" fill="#F4F6FA" stroke="#213469" stroke-width="3"/>
    <rect x="32" y="30" width="56" height="30" rx="13" fill="#213469"/>
    <g class="zb-pupils"><circle class="zb-eye" cx="48" cy="44" r="6" fill="#7FD4FF"/><circle class="zb-eye" cx="72" cy="44" r="6" fill="#7FD4FF"/></g>
    <path d="M51 53q9 6 18 0" fill="none" stroke="#7FD4FF" stroke-width="3" stroke-linecap="round"/>
    <rect x="14" y="36" width="8" height="18" rx="4" fill="#213469"/><rect x="98" y="36" width="8" height="18" rx="4" fill="#213469"/>
    <rect x="52" y="72" width="16" height="6" fill="#213469"/>
    <clipPath id="zbShirt"><path d="M30 78h60l20 14-9 15-11-6v29H30v-29l-11 6-9-15z"/></clipPath>
    <g clip-path="url(#zbShirt)"><rect x="0" y="76" width="120" height="20" fill="#FFFFFF"/><rect x="0" y="96" width="120" height="18" fill="#0057B8"/><rect x="0" y="114" width="120" height="20" fill="#ED1C24"/>
      <path d="M44 106l5-7 4 5 4-8 4 8 4-5 5 7" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linejoin="round"/></g>
    <path d="M30 78h60l20 14-9 15-11-6v29H30v-29l-11 6-9-15z" fill="none" stroke="#213469" stroke-width="3" stroke-linejoin="round"/>
    <text x="60" y="91" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="800" fill="#213469">ZAG</text>
    ${wave?'<g class="zb-wave"><path d="M104 92l10-14" stroke="#213469" stroke-width="7" stroke-linecap="round"/><circle cx="115" cy="76" r="5" fill="#F4F6FA" stroke="#213469" stroke-width="2.5"/></g>':''}
  </svg>`;

  /* ---------- text helpers ---------- */
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim();
  const tidy=s=>String(s==null?'':s).replace(/\s*[—–]\s*/g,', ').replace(/\s*;\s*/g,', ').replace(/\s*·\s*/g,', ').replace(/\s+/g,' ').trim();
  /* edit distance with swapped letters counted once, so "wrnog" is one step from "wrong" */
  const lev=(a,b)=>{ if(Math.abs(a.length-b.length)>3) return 9; const m=a.length,n=b.length,d=[]; for(let i=0;i<=m;i++){ d[i]=[i]; } for(let j=1;j<=n;j++) d[0][j]=j;
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++){ const c=a[i-1]===b[j-1]?0:1; d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c); if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1); } return d[m][n]; };
  const STOP=new Set('the a an of in on at to is are was were what how which who when where me show find tell about for and or with please can you i my do does did there this that it its kaj je so na v za in ali kje kdaj kako koliko mi pokazi prosim of pri pod nad ob se smo ste sem ki ta to tam tu naredil naredila naredili delal delala delali bil bila bilo'.split(' '));

  /* ---------- vocabulary ---------- */
  const TYPES=[
    {key:'bridge',name:'bridges',re:/^(bridges?|most\w*|viaducts?|viadukt\w*|footbridges?|brv\w*|overpass\w*)$/,match:t=>/bridge|footbridge|road structure/.test(t)},
    {key:'tunnel',name:'tunnels',re:/^(tunnels?|predor\w*|tube)$/,match:t=>t==='tunnel'},
    {key:'dam',name:'dams and hydropower plants',re:/^(dams?|jez\w*|hydro\w*|he|che|hidroelektrarn\w*|elektrarn\w*|weirs?)$/,match:t=>/dam/.test(t)},
    {key:'cableway',name:'cableways',re:/^(cableways?|lifts?|gondolas?|chairlifts?|zicnic\w*|sedeznic\w*|nihalk\w*|funicular|vzpenjac\w*|ropeways?)$/,match:t=>t==='cableway'},
    {key:'building',name:'buildings',re:/^(buildings?|stavb\w*|laborator\w*|schools?|sol\w*|library|knjiznic\w*|houses?)$/,match:t=>/building|institution|company/.test(t)},
    {key:'tower',name:'towers and masts',re:/^(towers?|masts?|stolp\w*|drog\w*)$/,match:t=>/tower/.test(t)},
    {key:'landslide',name:'landslides and geotechnical sites',re:/^(landslides?|plaz\w*|slides?|geotechnic\w*|cliffs?|klif\w*|mines?|rudnik\w*)$/,match:t=>/landslide|geotechnical/.test(t)},
    {key:'quake',name:'earthquake study areas',re:/^(earthquakes?|potres\w*|seismic\w*|quakes?)$/,match:t=>/earthquake/.test(t)}];
  const ATTRS=[
    {key:'height',name:'height',re:/^(height|high|tall|visin\w*|visok\w*|clearance)$/,label:/^height|clear height|highest point|height above/i},
    {key:'length',name:'length',re:/^(length|long|dolzin\w*|dolg\w*)$/,label:/^length|slope length/i},
    {key:'year',name:'year',re:/^(year|when|built|opened|completed|zgrajen\w*|odprt\w*|leto|kdaj|age|old)$/,label:/opened|year built|year completed|built/i},
    {key:'power',name:'installed power',re:/^(power|mw|moc|output|generation)$/,label:/installed power|annual generation/i},
    {key:'capacity',name:'capacity',re:/^(capacity|zmogljivost\w*|persons|passengers)$/,label:/capacity/i},
    {key:'owner',name:'owner and operator',re:/^(owner|operator|upravljav\w*|lastnik\w*|manager)$/,label:/owner|operator/i},
    {key:'span',name:'span',re:/^(span|spans|razpon\w*)$/,label:/span/i},
    {key:'lanes',name:'lanes',re:/^(lanes?|pas\w*)$/,label:/lanes/i},
    {key:'cost',name:'cost',re:/^(cost|price|cena|eur|euro)$/,label:/cost/i},
    {key:'geology',name:'geology',re:/^(geology|rock|geologij\w*)$/,label:/geology/i},
    {key:'width',name:'width',re:/^(width|wide|sirin\w*)$/,label:/width/i},
    {key:'speed',name:'speed',re:/^(speed|hitrost\w*|fast)$/,label:/speed/i},
    {key:'volume',name:'reservoir volume',re:/^(volume|reservoir|prostornin\w*)$/,label:/reservoir volume/i}];

  /* ---------- data ---------- */
  const DB={ready:null,recs:[],byId:{},twins:{}};
  function load(){ if(DB.ready) return DB.ready;
    DB.ready=Promise.all([fetch('data/zag_projects.geojson').then(r=>r.json()),fetch('data/twins.json').then(r=>r.json()).catch(()=>({objects:{}}))]).then(([g,t])=>{
      DB.twins=t.objects||{};
      DB.recs=g.features.map(f=>{ const p=f.properties; const name=tidy(typeof dispName==='function'?dispName(p):(p.name_en||p.name||p.id));
        const words=new Set(norm([p.name_en,p.name,p.name_sl,p.id.replace(/_/g,' ')].join(' ')).split(' ').filter(w=>w.length>2&&!STOP.has(w)));
        const place=new Set(norm([p.locality,p.municipality].join(' ')).split(' ').filter(w=>w.length>2));
        return {id:p.id,name,type:p.object_type||'other',place:tidy(p.locality||p.municipality||''),role:tidy(p.zag_role||''),year:p.year||'',words,placeWords:place,p}; });
      DB.recs.forEach(r=>DB.byId[r.id]=r);
      /* words that many records share (zag, bridge, laboratory) do not identify one record */
      const df={}; DB.recs.forEach(r=>r.words.forEach(w=>{ df[w]=(df[w]||0)+1; })); DB.common=new Set(Object.keys(df).filter(w=>df[w]>3)); });
    /* extra knowledge, loaded in the background: ZAG projects and sources (data.js), news and inspections */
    DB.more=Promise.all([
      (window.ZAG&&window.ZAG.projects?Promise.resolve(window.ZAG):fetch('data.js').then(r=>r.text()).then(t=>JSON.parse(t.slice(t.indexOf('{')).trim().replace(/;\s*$/,'')))).catch(()=>null),
      fetch('data/news.json').then(r=>r.json()).catch(()=>null),
      fetch('data/inspections.json').then(r=>r.json()).catch(()=>null)]).then(([z,n,i])=>{
        DB.projects={}; DB.projAll=(z&&z.projects)||[]; DB.src=(z&&z.src)||{}; ((z&&z.projects)||[]).forEach(pr=>(pr.sites||[]).forEach(id=>{ if(id!=='zag') (DB.projects[id]=DB.projects[id]||[]).push(pr); }));
        DB.news=(n&&n.items)||{}; DB.insp=(i&&i.items)||{}; });
    return DB.ready; }

  function wordHit(q,w){ if(q===w) return 3; if(q.length>=4&&(w.startsWith(q)||q.startsWith(w))&&Math.min(q.length,w.length)>=4) return 2; if(q.length>=4&&lev(q,w)<=1) return 1.5; if(q.length>=6&&lev(q,w)<=2) return 1; if(q.length>=9&&lev(q,w)<=3) return 1; if(q.length>=5&&q[0]===w[0]){ const k=x=>x.replace(/[aeiou]/g,''); const a=k(q), b=k(w); if(a.length>=4&&b.startsWith(a)&&Math.abs(q.length-w.length)<=3) return 1.5; } return 0; }
  function findRecords(tokens){ const out=[];
    for(const r of DB.recs){ let s=0, hits=0; for(const q of tokens){ let best=0; for(const w of r.words) best=Math.max(best,wordHit(q,w)); if(best){ s+=best; hits++; } }
      if(hits){ s+=hits/Math.max(2,r.words.size); out.push({r,s}); } }
    return out.sort((a,b)=>b.s-a.s); }
  function placeRecords(tokens){ const m=[]; for(const r of DB.recs) for(const q of tokens) for(const w of r.placeWords) if(wordHit(q,w)>=2){ m.push(r); break; } return [...new Set(m)]; }

  /* ---------- UI ---------- */
  const root=document.createElement('div'); root.className='zb'; root.innerHTML=`
    <button class="zb-launch" type="button" aria-expanded="false" aria-controls="zbPanel" title="Ask ZAGBot">${ROBOT(44,true)}<span class="zb-lbl"><b>ZAGBot</b><i>Ask me</i></span></button>
    <section class="zb-panel" id="zbPanel" role="dialog" aria-label="ZAGBot chat" hidden>
      <header class="zb-head"><div class="zb-lights"><button class="zb-x zb-red" type="button" aria-label="Close the chat" title="Close"></button><button class="zb-min zb-yel" type="button" aria-label="Minimise the chat" title="Minimise"></button><button class="zb-big zb-grn" type="button" aria-label="Larger chat window" title="Larger window"></button></div>
        ${ROBOT(34,true)}<div class="zb-title"><b>ZAGBot</b><span>Online, 73 records</span></div><div class="zb-flags" role="group" aria-label="Language"><button type="button" class="zb-flag" data-l="en" aria-pressed="false" title="English" aria-label="English"><svg viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#012169"/><path d="M0 0l24 16M24 0L0 16" stroke="#fff" stroke-width="3.2"/><path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" stroke-width="1.2"/><path d="M12 0v16M0 8h24" stroke="#fff" stroke-width="5"/><path d="M12 0v16M0 8h24" stroke="#C8102E" stroke-width="3"/></svg></button><button type="button" class="zb-flag" data-l="sl" aria-pressed="false" title="Slovenščina" aria-label="Slovenščina"><svg viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#fff"/><rect y="5.33" width="24" height="5.34" fill="#0057B8"/><rect y="10.67" width="24" height="5.33" fill="#ED1C24"/><path d="M5 3.2h4.2v3.1c0 1.6-1 2.6-2.1 3.1C6 8.9 5 7.9 5 6.3z" fill="#0057B8" stroke="#ED1C24" stroke-width=".5"/><path d="M5.6 7.3l1.5-2 1.5 2z" fill="#fff"/></svg></button></div><button class="zb-new" type="button" title="New conversation" aria-label="New conversation"><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><button class="zb-spk" type="button" aria-pressed="false" title="Read answers aloud" aria-label="Read answers aloud"><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></header>
      <div class="zb-log" id="zbLog" aria-live="polite"></div>
      <div class="zb-chips" id="zbChips"></div>
      <form class="zb-in" autocomplete="off"><input id="zbText" maxlength="400" placeholder="Ask about a structure, or tell me what to change" aria-label="Message to ZAGBot"><canvas class="zb-wave-c" width="720" height="88" aria-hidden="true" hidden></canvas><button type="button" class="zb-mic" aria-pressed="false" title="Speak your question (Slovenian or English)" aria-label="Speak your question" hidden><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8" rx="2.5" fill="currentColor"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5M5.5 14.5h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button><button type="submit" aria-label="Send" title="Send"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 13V3.5M3.8 7.6 8 3.4l4.2 4.2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>
      <p class="zb-foot">Answers come from the atlas data, with sources. Corrections are reviewed by the ZAG atlas team.</p>
    </section>`;
  document.body.appendChild(root);
  if(ON_MAP) document.body.classList.add('zb-onmap');
  const $=s=>root.querySelector(s), log=$('#zbLog'), chips=$('#zbChips'), input=$('#zbText'), panel=$('#zbPanel'), launch=$('.zb-launch');
  let ctx={rec:null,flow:null}, started=false;

  /* the conversation is kept in this browser (last 80 messages), so a page change or a new visit continues where it stopped */
  const HKEY='zb_hist', OKEY='zb_open'; let hist=[]; try{ hist=JSON.parse(localStorage.getItem(HKEY)||'[]'); if(!Array.isArray(hist)) hist=[]; }catch(_){ hist=[]; }
  const keep=(html,who)=>{ hist.push({w:who||'bot',h:html,t:Date.now()}); if(hist.length>80) hist=hist.slice(-80); try{ localStorage.setItem(HKEY,JSON.stringify(hist)); }catch(_){} };
  const forget=()=>{ hist=[]; try{ localStorage.removeItem(HKEY); }catch(_){} };
  const scroll=()=>{ log.scrollTop=log.scrollHeight; };
  let typing=null;
  function say(html,who,silent){ const d=document.createElement('div'); d.className='zb-msg '+(who||'bot'); d.innerHTML=html; if(typing){ typing.remove(); typing=null; } log.appendChild(d); if(!silent&&!/zb-ana|zb-typing/.test(html)) keep(html,who); if(!silent&&who!=='me') speak(d);
    /* a long answer is shown from its start, a short one keeps the chat at the bottom */
    if(who==='me') scroll(); else { const q=[...log.querySelectorAll('.zb-msg.me')].pop(); if(q&&log.scrollHeight-q.offsetTop>log.clientHeight) log.scrollTop=Math.max(0,q.offsetTop-8); else scroll(); } return d; }
  function think(){ if(typing) return; typing=document.createElement('div'); typing.className='zb-msg bot'; typing.innerHTML='<span class="zb-typing"><i></i><i></i><i></i></span>'; log.appendChild(typing); scroll(); }
  function user(t){ say(esc(t),'me'); }
  /* chips: [label, action] where action is a function or a string the user "types" */
  const QI={find:'M7 2a5 5 0 1 0 3.1 8.9l3.5 3.5 1-1-3.5-3.5A5 5 0 0 0 7 2zm0 1.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z',help:'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm-.7 9.7h1.4v1.4H7.3zM8 4a2.4 2.4 0 0 1 1.2 4.5c-.5.3-.5.6-.5 1.2H7.3c0-1 .2-1.6 1.1-2.2A1 1 0 1 0 6.9 6.4H5.6A2.4 2.4 0 0 1 8 4z',fix:'M11.5 1.8 14.2 4.5 6 12.7l-3.4.7.7-3.4zM3 14h10v1.2H3z',cube:'M8 1 2 4.2v7.6L8 15l6-3.2V4.2zm0 1.6 4.3 2.3L8 7.2 3.7 4.9zM3.2 6l4.2 2.3v4.9L3.2 11zm5.4 7.2V8.3L12.8 6v5z',time:'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm.7 6.3 2.6 1.6-.7 1.1-3.3-2V4h1.4z',map:'M1.5 3.5 5.5 2l5 1.6 4-1.5v10.4l-4 1.5-5-1.6-4 1.5zm4.6.1v8.7l3.8 1.2V4.8z'};
  function offer(list,cards){ chips.innerHTML=''; chips.classList.toggle('cards',!!cards); for(const c of list){ if(!c) continue; const [label,act,kind,sub,icon]=c;
      const el=kind==='link'?Object.assign(document.createElement('a'),{href:act,target:act.startsWith('http')?'_blank':'',rel:'noopener'}):document.createElement('button');
      if(kind!=='link') el.type='button'; el.className='zb-chip'+(kind==='primary'||kind==='link'?' solid':''); if(cards&&sub){ el.className='zb-card2'; el.innerHTML=`<i class="q-${icon}"><svg viewBox="0 0 16 16"><path d="${QI[icon]||QI.help}" fill="currentColor"/></svg></i><b>${esc(label)}</b><span>${esc(sub)}</span>`; } else el.textContent=label;
      if(kind!=='link') el.onclick=()=>{ if(typeof act==='function'){ user(label); act(); } else handle(act,label); };
      chips.appendChild(el); } }
  const menu=()=>[['Find a structure',()=>{ say('Type its name or place, for example <i>Kastelec</i>, <i>Arto Blanca</i> or <i>bridges in Ljubljana</i>.'); offer(typeChips()); input.focus(); },null,'Name, place or type','find'],
    ['Report a correction',()=>startUpdate(ctx.rec),null,'A value, position or model','fix'],['Improve a 3D model',()=>startModel(ctx.rec),null,'Suggest what should change','cube'],
    ON_MAP?['Timeline','timeline',null,'Show or hide ZAG work by year','time']:['What can you do?','help',null,'Everything ZAGBot knows','help']];
  const home=()=>offer(menu(),true);
  const typeChips=()=>TYPES.slice(0,6).map(t=>[t.name[0].toUpperCase()+t.name.slice(1),t.key]);
  const recUrl=r=>'twin.html?id='+encodeURIComponent(r.id);
  const recChips=r=>[['Open its page',recUrl(r),'link'],['Show on the map',()=>showOnMap(r)],['Key figures',()=>figures(r)],['What did ZAG do?',()=>role(r)],['Something is wrong',()=>startUpdate(r)]];
  /* "where is X": the place, the coordinates and the map */
  function whereIs(r){ ctx.rec=r; const p=r.p, d=(typeof fmtD96==='function')?fmtD96([+p.longitude,+p.latitude]):'';
    say(`<div class="zb-card"><b>${esc(r.name)}</b><span>${esc(r.place||'')}${p.municipality&&p.municipality!==r.place?', '+esc(p.municipality):''}</span><p>WGS 84 ${(+p.latitude).toFixed(5)}, ${(+p.longitude).toFixed(5)}${d?'<br>'+esc(d):''}</p>${p.position_precision&&!/^(surveyed|address|matched)$/.test(p.position_precision)?'<p class="zb-note">Approximate position: the centre of the area, not the object itself.</p>':''}</div>`);
    if(ON_MAP&&typeof window.showInfo==='function'){ window.showInfo(r.id); panelSmall(); offer(recChips(r).filter(c=>c[0]!=='Show on the map')); }
    else { say(window.LANG==='sl'?'Odpiram zemljevid...':'Opening the map...'); setTimeout(()=>{ location.href='index.html#'+encodeURIComponent(r.id); },700); } }
  function showOnMap(r){ if(ON_MAP&&typeof window.showInfo==='function'){ window.showInfo(r.id); say('Shown on the map: <b>'+esc(r.name)+'</b>.'); panelSmall(); } else location.href='index.html#'+encodeURIComponent(r.id); }
  function panelSmall(){ if(window.innerWidth<700) toggle(false); }

  /* ---------- answers ---------- */
  function card(r){ ctx.rec=r; const t=DB.twins[r.id]||{};
    say(`<div class="zb-card"><b>${esc(r.name)}</b><span>${esc(typeof typeLabel==='function'?typeLabel(r.type):cap(r.type))}${r.place?', '+esc(r.place):''}${r.year?', ZAG work '+esc(String(r.year).replace(/-/g,' to ')):''}</span>${t.summary?`<p>${esc(tidy(t.summary)).slice(0,260)}</p>`:''}</div>`);
    offer(recChips(r)); }
  const cap=s=>String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1);
  function specLine(s){ const v=tidy(s.value)+(s.unit?' '+esc(s.unit):''); const host=s.source?(()=>{ try{ return new URL(s.source).hostname.replace(/^www\./,''); }catch(_){ return 'source'; } })():null;
    return `<li><span>${esc(tidy(s.label))}</span><b>${esc(v)}</b>${host?`<a href="${esc(s.source)}" target="_blank" rel="noopener">${esc(host)}</a>`:'<em>no source link</em>'}</li>`; }
  function figures(r){ ctx.rec=r; const sp=((DB.twins[r.id]||{}).specs||[]).filter(s=>!/mapped geometry/i.test(s.label));
    if(!sp.length){ say('No verified values are recorded for <b>'+esc(r.name)+'</b> yet.'); offer([['Report a missing value',()=>startUpdate(r,'value')],...recChips(r).slice(0,2)]); return; }
    say(`<b>${esc(r.name)}</b>, verified values:<ul class="zb-spec">${sp.slice(0,8).map(specLine).join('')}</ul>${sp.length>8?`<p class="zb-note">${sp.length-8} more on its page.</p>`:''}`);
    offer(recChips(r).filter(c=>c[0]!=='Key figures')); }
  /* ---------- reasoning over the record: everything said here is read from the atlas data and its sources ---------- */
  const arr=v=>Array.isArray(v)?v:[];
  const yrs=y=>String(y||'').replace(/-$/,' onwards').replace(/-/g,' to ');
  const ownName=r=>/^zag\b/i.test(r.name);
  const headOf=r=>ownName(r)?esc(r.name):(window.LANG==='sl'?'ZAG pri objektu ':'ZAG at ')+esc(r.name);
  const projOf=r=>(DB.projects&&DB.projects[r.id])||[];
  const srcList=(r,n)=>{ const S=arr(r.p.sources).filter(x=>x&&x.url); if(!S.length) return ''; return `<p class="zb-src">Sources: ${S.slice(0,n||4).map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(tidy(x.title||x.key||'source'))}</a>`).join(', ')}${S.length>(n||4)?`, and ${S.length-(n||4)} more on its page`:''}</p>`; };
  const projLines=(r,n)=>{ const P=projOf(r); if(!P.length) return ''; return `<p><b>Projects linked to it</b></p><ul class="zb-list">${P.slice(0,n||4).map(x=>`<li>${x.ru?`<a href="${esc(x.ru)}" target="_blank" rel="noopener">${esc(tidy(x.ac||x.t))}</a>`:esc(tidy(x.ac||x.t))}${x.y?', '+esc(yrs(x.y)):''}${x.role&&!/not stated/i.test(x.role)?', ZAG as '+esc(x.role.toLowerCase()):''}</li>`).join('')}</ul>`; };
  /* a short pause with what is being read, so an answer is visibly worked out and not guessed */
  function analyse(steps,fn){ chips.innerHTML=''; const d=say('<span class="zb-ana"><i class="zb-spin"></i><span></span></span>'); const t=d.querySelector('.zb-ana span'); let i=0; t.textContent=steps[0];
    const iv=setInterval(()=>{ i++; if(i<steps.length) t.textContent=steps[i]; },420); setTimeout(()=>{ clearInterval(iv); d.remove(); fn(); },Math.min(1900,450+steps.length*420)); }
  const readSteps=rs=>{ const S=rs.reduce((a,r)=>a+arr(r.p.sources).length+((DB.twins[r.id]||{}).specs||[]).length,0), P=rs.reduce((a,r)=>a+projOf(r).length,0);
    return [`Reading ${rs.length>1?rs.length+' records':'the record of '+rs[0].name}`,`Checking ${S} sourced entries${P?' and '+P+' ZAG projects':''}`,'Writing the answer from what the sources say']; };
  function role(r,quiet){ ctx.rec=r; const p=r.p, P=projOf(r);
    const body=[p.zag_role?`<p>${esc(tidy(p.zag_role).replace(/\.$/,''))}.</p>`:'',p.description&&tidy(p.description).replace(/\.$/,'')!==tidy(p.zag_role).replace(/\.$/,'')?`<p>${esc(tidy(p.description))}</p>`:'',
      r.year?`<p><b>Years of ZAG work:</b> ${esc(yrs(r.year))}</p>`:'',arr(p.people).length?`<p><b>Named in the sources:</b> ${esc(arr(p.people).join(', '))}</p>`:'',arr(p.partners).length?`<p><b>Partners:</b> ${esc(arr(p.partners).join(', '))}</p>`:'',projLines(r,3)].join('');
    say(`<div class="zb-card"><b>${headOf(r)}</b>${body||'<p>The sources do not describe the work here in more detail.</p>'}${srcList(r,3)}</div>`);
    if(!quiet) offer([['The full story',()=>story(r)],['Key figures',()=>figures(r)],P.length>3?['All linked projects',()=>projects(r)]:null,['Open its page',recUrl(r),'link'],['Something is wrong',()=>startUpdate(r)]]); }
  function story(r){ ctx.rec=r; const p=r.p, t=DB.twins[r.id]||{}, F=arr(p.facts).filter(f=>Array.isArray(f)&&f[1]).slice(0,5), n=arr(DB.news&&DB.news[r.id]);
    say(`<div class="zb-card"><b>${esc(r.name)}</b><span>${esc(typeof typeLabel==='function'?typeLabel(r.type):cap(r.type))}${r.place?', '+esc(r.place):''}</span>
      ${p.hist?`<p>${esc(tidy(p.hist))}</p>`:t.summary?`<p>${esc(tidy(t.summary))}</p>`:''}
      ${p.zag_role?`<p><b>${ownName(r)?'What it does':'What ZAG did'}:</b> ${esc(tidy(p.zag_role))}${r.year?' ('+esc(yrs(r.year))+')':''}.</p>`:''}
      ${F.length?`<ul class="zb-spec">${F.map(f=>`<li><span>${esc(tidy(f[0]))}</span><b>${esc(tidy(f[1]))}</b></li>`).join('')}</ul>`:''}
      ${projLines(r,3)}
      ${n.length?`<p><b>In the news:</b> ${esc(tidy(n[0].title))} (${esc(n[0].source||'')}, ${esc(String(n[0].date||'').slice(0,10))})${n.length>1?`, and ${n.length-1} more on its page`:''}.</p>`:''}
      ${srcList(r,4)}</div>`);
    offer([['Key figures',()=>figures(r)],['Show on the map',()=>showOnMap(r)],['Open its page',recUrl(r),'link'],['Something is wrong',()=>startUpdate(r)]]); }
  function projects(r){ ctx.rec=r; const P=projOf(r); if(!P.length){ say(`No ZAG research project in the atlas is linked to <b>${esc(r.name)}</b>. The work recorded there is: ${esc(tidy(r.p.zag_role||'not described'))}.`); offer(recChips(r)); return; }
    say(`<b>${esc(r.name)}</b>, ${P.length} linked ZAG project${P.length>1?'s':''}:${projLines(r,12)}`); offer(recChips(r)); }
  function inspections(r){ ctx.rec=r; const I=arr(DB.insp&&DB.insp[r.id]);
    if(I.length){ say(`<b>${esc(r.name)}</b>, published inspections:<ul class="zb-spec">${I.slice(-6).reverse().map(x=>`<li><span>${esc(x.date||'')}</span><b>${esc(tidy(x.kind||'inspection'))}${x.condition&&x.condition!=='none'?', '+esc(x.condition):''}</b>${x.report?`<a href="${esc(x.report)}" target="_blank" rel="noopener">report</a>`:''}</li>`).join('')}</ul>`); offer(recChips(r)); return; }
    const kw=/inspect|pregled|monitor|test|control|kontrol/i.test(r.p.zag_role||'');
    say(`<div class="zb-card"><b>${esc(r.name)}</b><p>No dated inspection report is published for it, so I cannot give an inspection date.</p>${r.p.zag_role?`<p>What the sources do record${kw?' about ZAG\'s checks':''}: ${esc(tidy(r.p.zag_role))}${r.year?', '+esc(yrs(r.year)):''}.</p>`:''}${srcList(r,3)}</div>`);
    offer([['What did ZAG do?',()=>role(r)],['The full story',()=>story(r)],['I have an inspection report',()=>startUpdate(r,'source')]]); }
  function people(r){ ctx.rec=r; const ppl=arr(r.p.people), P=projOf(r).filter(x=>x.lead&&!/not stated/i.test(x.lead));
    if(!ppl.length&&!P.length){ say(`The sources for <b>${esc(r.name)}</b> name no people. I only give names that the sources publish.`); offer(recChips(r)); return; }
    say(`<b>${esc(r.name)}</b>, people named in the published sources:<ul class="zb-list">${ppl.map(x=>`<li>${esc(x)}</li>`).join('')}${P.slice(0,5).map(x=>`<li>${esc(tidy(x.lead))}, ${esc(tidy(x.ac||x.t))}</li>`).join('')}</ul>`); offer(recChips(r)); }
  function sources(r){ ctx.rec=r; const S=arr(r.p.sources).filter(x=>x&&x.url); say(S.length?`<b>${esc(r.name)}</b>, ${S.length} sources:<ul class="zb-list">${S.slice(0,10).map(x=>`<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(tidy(x.title||x.key))}</a></li>`).join('')}</ul>`:'No source links are stored for this record.'); offer(recChips(r)); }
  function compare(rs,a){ const rows=rs.map(r=>{ const sp=((DB.twins[r.id]||{}).specs||[]).find(s=>a.label.test(s.label)); return [r,sp]; });
    say(`<b>${esc(cap(a.name))}</b> compared:<ul class="zb-spec">${rows.map(([r,sp])=>sp?specLine(Object.assign({},sp,{label:r.name})):`<li><span>${esc(r.name)}</span><b>not published</b><em>no value in the sources</em></li>`).join('')}</ul>`);
    offer(rs.map(r=>['Open '+r.name,recUrl(r),'link'])); }
  function projectOf(free){ if(!DB.projAll) return null; const acr=x=>String(x.ac||'').split(/[\s,]+/).filter(w=>w.length>=4&&/[A-Z].*[A-Z0-9]|\d/.test(w)).map(norm);
    for(const q of free){ if(q.length<4) continue; const hit=DB.projAll.find(x=>acr(x).some(w=>w===q||(q.length>=6&&lev(q,w)<=1))); if(hit) return hit; } return null; }
  function projectCard(x){ const S=(x.sites||[]).filter(id=>id!=='zag'&&DB.byId[id]).map(id=>DB.byId[id]);
    say(`<div class="zb-card"><b>${esc(tidy(x.ac||x.t))}</b><span>ZAG project${x.y?', '+esc(yrs(x.y)):''}</span>${x.t&&x.t!==x.ac?`<p>${esc(tidy(x.t))}</p>`:''}${x.d?`<p>${esc(tidy(x.d))}</p>`:''}<ul class="zb-spec">${[['ZAG role',x.role],['Led by',x.lead],['Funding',x.fund]].filter(([,v])=>v&&!/not stated/i.test(v)).map(([k,v])=>`<li><span>${k}</span><b>${esc(tidy(v))}</b></li>`).join('')}</ul>${x.ru?`<p class="zb-src">Source: <a href="${esc(x.ru)}" target="_blank" rel="noopener">ZAG project page</a></p>`:''}</div>`);
    offer(S.slice(0,4).map(r=>[r.name,()=>story(r)]).concat([['Find a structure',()=>{ say('Type its name or place.'); offer(typeChips()); }]])); }
  /* which records does the text name? one record per distinct word, ignoring words many records share */
  function mentioned(free){ const out=[]; for(const q of free){ if(q.length<4||(DB.common&&DB.common.has(q))||placeRecords([q]).length>=3) continue; let best=[],bs=0;
      for(const r of DB.recs){ let sc=0; for(const w of r.words){ if(DB.common&&DB.common.has(w)) continue; sc=Math.max(sc,wordHit(q,w)); } if(sc>bs){ bs=sc; best=[r]; } else if(sc&&sc===bs) best.push(r); }
      if(bs>=1.5&&best.length<=2) best.forEach(r=>{ if(!out.includes(r)) out.push(r); }); }
    return out; }
  function attrAnswer(r,a){ ctx.rec=r; const sp=((DB.twins[r.id]||{}).specs||[]).filter(s=>a.label.test(s.label));
    if(!sp.length){ say(`No ${esc(a.name)} is published in the sources for <b>${esc(r.name)}</b>, so I will not guess one.`); offer([['Key figures',()=>figures(r)],['I have a source for it',()=>startUpdate(r,'value',a.name)],['Open its page',recUrl(r),'link']]); return; }
    say(`<b>${esc(r.name)}</b>, ${esc(a.name)}:<ul class="zb-spec">${sp.slice(0,4).map(specLine).join('')}</ul>`); offer(recChips(r)); }
  function listType(t,inPlace){ let rs=DB.recs.filter(r=>t.match(r.type)); if(inPlace) rs=rs.filter(r=>inPlace.includes(r));
    if(!rs.length){ say(`No ${esc(t.name)} are recorded${inPlace?' there':''}.`); offer(menu()); return; }
    say(rs.length===1?`One of the ${esc(t.name)} is recorded${inPlace?' there':''}:`:`${rs.length} ${esc(t.name)}${inPlace?' there':''} in the atlas. Choose one:`); offer(rs.slice(0,10).map(r=>[r.name,()=>card(r)]).concat(rs.length>10?[['Show more',()=>{ offer(rs.slice(10,24).map(r=>[r.name,()=>card(r)])); }]]:[])); }
  function help(){ say(`I can:<ul class="zb-list"><li>find a structure by name, type or place</li><li>answer a value such as height, length, year or power, always with its source</li><li>show it on the map or open its page</li><li>take a report when something is wrong and send it to the atlas team as an exact request</li><li>open the form for a new 3D model</li></ul>I understand English and Slovenian words, for example <i>predor</i>, <i>most</i>, <i>višina</i>.`); offer(menu()); }

  /* ---------- guided requests: every step is a click, so the request is exact ---------- */
  function pickRecord(then,why){ say((why||'Which structure is it?')+' Type a name or choose one.'); ctx.flow={pick:then};
    const near=ctx.rec?[[ctx.rec.name,()=>{ ctx.flow=null; then(ctx.rec); }]]:[]; offer(near.concat(typeChips().map(c=>[c[0],()=>listPick(c[1],then)])) ); input.focus(); }
  function listPick(key,then){ const t=TYPES.find(x=>x.key===key); const rs=DB.recs.filter(r=>t.match(r.type)); say('Choose one:'); offer(rs.slice(0,24).map(r=>[r.name,()=>{ ctx.flow=null; then(r); }])); }
  function startModel(r){ if(!r) return pickRecord(startModel,'Which structure is it about?'); ctx.rec=r;
    const has=!!((DB.twins[r.id]||{}).model||r.p.lines||r.p.line); say(`${has?'Suggest an improvement to the 3D model of':'Suggest a 3D model for'} <b>${esc(r.name)}</b>. Tell me what should change and where it is published. The atlas team builds the model from the mapped outline and the published dimensions.`);
    offer([['Describe the change',()=>startUpdate(r,'model'),'primary'],isOwner()?['Open the model form',`${REPO}/issues/new?template=model_request.yml&title=${encodeURIComponent('Model: '+r.name+' ('+r.id+')')}`,'link']:null,['Back',()=>card(r)]]); }
  const WHAT=[['position','The position on the map'],['value','A value (height, length, year)'],['model','The 3D model'],['text','The description or ZAG role'],['source','A source or link'],['other','Something else']];
  function startUpdate(r,what,attr){ if(!r) return pickRecord(x=>startUpdate(x,what,attr),'Which structure is it about?'); ctx.rec=r; ctx.flow={kind:'update',r,what:null,label:attr||null,value:null,src:null};
    if(what) return chooseWhat(what); ctx.flow.step='what'; say(`What is wrong or missing at <b>${esc(r.name)}</b>? Choose below or describe it in your own words.`); offer(WHAT.map(([k,l])=>[l,()=>{ ctx.flow.step=null; chooseWhat(k); }])); }
  const whatOf=n=>/\b(position|where|location|place|coordinates?|lokacij\w*|polozaj\w*|pin)\b/.test(n)?'position':/\b(3d|model\w*|shape|oblik\w*)\b/.test(n)?'model':/\b(source|link|vir\w*)\b/.test(n)?'source':/\b(description|role|text|opis\w*|vloga)\b/.test(n)?'text':null;
  function chooseWhat(k){ const f=ctx.flow; f.what=k;
    if(k==='value'&&f.label&&!f.old){ const a=ATTRS.find(x=>x.name===f.label), sp=a&&((DB.twins[f.r.id]||{}).specs||[]).find(s=>a.label.test(s.label)); if(sp){ f.label=tidy(sp.label); f.old=tidy(sp.value)+(sp.unit?' '+sp.unit:''); } }
    if(k==='value'&&!f.label){ const sp=((DB.twins[f.r.id]||{}).specs||[]).filter(s=>!/mapped geometry/i.test(s.label)).slice(0,8);
      say('Which value?'); offer(sp.map(s=>[tidy(s.label)+': '+tidy(s.value)+(s.unit?' '+s.unit:''),()=>{ f.label=tidy(s.label); f.old=tidy(s.value)+(s.unit?' '+s.unit:''); askValue(); }]).concat([['A value that is missing',()=>{ say('Type the name of the value, for example <i>span</i>.'); f.step='label'; input.focus(); offer([['Cancel',cancel]]); }]])); return; }
    if(k==='model'){ say('What is wrong with the model? Type it in a few words, for example <i>gates are missing</i>.'); f.step='desc'; offer([['Shape is wrong',()=>{ f.desc='The shape does not match the real structure'; askSource(); }],['Height is wrong',()=>{ f.desc='The height is wrong'; askSource(); }],['Parts are missing',()=>{ f.desc='Parts of the structure are missing'; askSource(); }],['Cancel',cancel]]); input.focus(); return; }
    if(k==='position'){ say('Where should it be? Paste coordinates (latitude, longitude), a Google Maps link, or describe the place.'); f.step='desc'; offer([['Cancel',cancel]]); input.focus(); return; }
    if(k==='value') return askValue();
    say(k==='source'?'Paste the link of the source.':'Describe the change in one or two sentences.'); f.step=k==='source'?'src':'desc'; offer([['Cancel',cancel]]); input.focus(); }
  function askValue(){ const f=ctx.flow; say(`New value for <b>${esc(f.label)}</b>${f.old?` (now ${esc(f.old)})`:''}? Type it with its unit, for example <i>31.35 m</i>.`); f.step='value'; offer([['I do not know the value',()=>{ f.value='not known, please find the published value'; askSource(); }],['Cancel',cancel]]); input.focus(); }
  function askSource(){ const f=ctx.flow; say('Where is it published? Paste the source link. Every value in the atlas needs one.'); f.step='src';
    offer([['I have no link yet',()=>{ f.src=null; summary(); }],['Cancel',cancel]]); input.focus(); }
  function summary(){ const f=ctx.flow; f.step=null; const W=Object.fromEntries(WHAT);
    const lines=[['Record',`${f.r.name} (${f.r.id})`],['What',W[f.what]],f.label?['Value',f.label]:null,f.old?['Now shown',f.old]:null,f.value?['Should be',f.value]:null,f.desc?['Details',f.desc]:null,['Source',f.src||'none given, please find and check one']].filter(Boolean);
    say(`Here is the request:<ul class="zb-spec">${lines.map(([a,b])=>`<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join('')}</ul>${f.src?'':'<p class="zb-note">Without a source the change is only made if a published source confirms it.</p>'}`);
    const title=`ZAGBot: ${f.r.name}, ${f.label||{position:'position',model:'3D model',text:'description',source:'sources',other:'request',value:'value'}[f.what]}`;
    const body=['Request written with ZAGBot on the atlas.','',...lines.map(([a,b])=>`### ${a}\n\n${b}\n`),'### Page',`\nhttps://avtandilsvianadzeu.github.io/ZAGSloveniaTwin/twin.html?id=${f.r.id}\n`,'Photos can be dragged in here before submitting.'].join('\n');
    const runUrl=`${REPO}/issues/new?title=${encodeURIComponent(title)}&labels=zagbot&body=${encodeURIComponent(body)}`;
    if(!INBOX.url&&MAIL.to){ offer([['Send the request',()=>sendMail(title.replace(/^ZAGBot: /,''),lines,runUrl),'primary'],['Change something',()=>startUpdate(f.r)],['Cancel',cancel]]);
      say('<span class="zb-note">No account needed. It goes by email to the atlas team, who check it and let ZAGBot make the change.</span>'); return; }
    if(INBOX.url){ offer([['Send the request',()=>sendInbox(title.replace(/^ZAGBot: /,''),body.replace('Photos can be dragged in here before submitting.','')),'primary'],['Change something',()=>startUpdate(f.r)],['Cancel',cancel]]);
      say('<span class="zb-note">'+(isOwner()?'You are signed in as the atlas owner, so ZAGBot starts on it at once.':'No account needed. The atlas team checks it, then ZAGBot makes the change.')+'</span>'); return; }
    offer([['Send the request',`${REPO}/issues/new?title=${encodeURIComponent(title)}&labels=zagbot&body=${encodeURIComponent(body)}`,'link'],['Change something',()=>startUpdate(f.r)],['Cancel',cancel]]);
    say('<span class="zb-note">The request is reviewed by the ZAG atlas team.</span>'); }
  /* ---------- requests by email: formsubmit.co delivers the message to the atlas owner, the visitor needs no account ---------- */
  const MAIL={to:''}; fetch('data/contacts.json').then(r=>r.ok?r.json():{}).then(j=>{ const m=(j&&(j.zagbot||j.default))||''; if(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(m)) MAIL.to=m; }).catch(()=>{});
  async function sendMail(subject,lines,runUrl){ const wait=say('Sending...'); const page=location.href.split('#')[0];
    const data={_subject:'ZAGBot request: '+subject,_template:'table',_captcha:'false',Request:subject};
    lines.forEach(([a,b])=>{ data[a]=b; }); data['Sent from']=page; data['Run it with ZAGBot (opens GitHub, signed in as owner)']=runUrl;
    try{ const r=await fetch('https://formsubmit.co/ajax/'+encodeURIComponent(MAIL.to),{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(data)});
      const j=await r.json().catch(()=>({})); if(!r.ok||String(j.success)==='false') throw new Error(j.message||('error '+r.status));
      wait.remove(); ctx.flow=null; say('Thank you, your request is sent to the atlas team. They check the source, then ZAGBot makes the change.'); offer([['Something else',()=>{ say('What else?'); offer(menu()); }]]); }
    catch(e){ wait.remove(); say('It could not be sent: '+esc(e.message)); offer([['Try again',()=>sendMail(subject,lines,runUrl)],['Send with my own email','mailto:'+MAIL.to+'?subject='+encodeURIComponent('ZAGBot request: '+subject)+'&body='+encodeURIComponent(lines.map(([a,b])=>a+': '+b).join('\n')+'\n\n'+location.href),'link'],['Cancel',cancel]]); } }
  /* ---------- request inbox: no GitHub account needed (server/inbox.js) ---------- */
  const INBOX={url:''}; fetch('data/inbox.json').then(r=>r.ok?r.json():{}).then(j=>{ if(j&&/^https:\/\//.test(j.url||'')) INBOX.url=j.url.replace(/\/+$/,''); }).catch(()=>{});
  const code=()=>{ try{ return localStorage.getItem('zag_owner_code')||''; }catch(_){ return ''; } };
  const isOwner=()=>!!code();
  async function call(path,method,body){ const r=await fetch(INBOX.url+path,{method:method||'GET',headers:Object.assign({'content-type':'application/json'},code()?{'x-owner-code':code()}:{}),body:body?JSON.stringify(body):undefined}); let j={}; try{ j=await r.json(); }catch(_){} if(!r.ok) throw new Error(j.error||('error '+r.status)); return j; }
  async function sendInbox(subject,body){ const wait=say('Sending...');
    try{ const j=await call('/request','POST',{subject,body,website:''}); wait.remove(); ctx.flow=null;
      say(j.runs?`Sent as request <b>#${j.number}</b>. ZAGBot is starting on it now and will answer there in a few minutes.`:`Thank you, your request is in as <b>#${j.number}</b>. The atlas team checks it, then ZAGBot makes the change.`);
      offer([['Follow it (no sign in needed)',j.url,'link'],['Something else',()=>{ say('What else?'); offer(menu()); }]]); }
    catch(e){ wait.remove(); say('It could not be sent: '+esc(e.message)); offer([['Try again',()=>sendInbox(subject,body)],['Cancel',cancel]]); } }
  function ownerLogin(){ if(!INBOX.url){ say('The request inbox is not switched on yet, so there is nothing to sign in to.'); offer(menu()); return; }
    say('Type the owner code. It stays in this browser only.'); ctx.flow={kind:'code'}; input.type='password'; input.focus(); offer([['Cancel',()=>{ input.type='text'; cancel(); }]]); }
  async function ownerCheck(c){ input.type='text'; ctx.flow=null; try{ localStorage.setItem('zag_owner_code',c); }catch(_){}
    try{ await call('/owner','POST',{}); say('Signed in as the atlas owner. Your requests now run at once.'); ownerMenu(); }
    catch(_){ try{ localStorage.removeItem('zag_owner_code'); }catch(e){} say('That code is not correct.'); offer([['Try again',ownerLogin],['Cancel',cancel]]); } }
  function ownerMenu(){ offer([['Requests waiting',pending],['Write a request',()=>startUpdate(ctx.rec)],['Sign out',()=>{ try{ localStorage.removeItem('zag_owner_code'); }catch(_){} say('Signed out.'); offer(menu()); }]]); }
  async function pending(){ try{ const j=await call('/pending'); if(!j.items.length){ say('No requests are waiting.'); ownerMenu(); return; }
      say(`${j.items.length} waiting. Choose one to run or decline:`); offer(j.items.slice(0,10).map(i=>['#'+i.number+' '+i.title,()=>decide(i)]).concat([['Back',ownerMenu]])); }
    catch(e){ say('The list could not be read: '+esc(e.message)); ownerMenu(); } }
  function decide(i){ say(`<b>#${i.number}</b> ${esc(i.title)}`); offer([['Run it',async()=>{ try{ await call('/approve','POST',{number:i.number,action:'run'}); say('Started. ZAGBot answers on the request in a few minutes.'); }catch(e){ say('Failed: '+esc(e.message)); } ownerMenu(); },'primary'],['Read it',i.url,'link'],['Decline',async()=>{ try{ await call('/approve','POST',{number:i.number,action:'reject'}); say('Declined and closed.'); }catch(e){ say('Failed: '+esc(e.message)); } ownerMenu(); }],['Back',pending]]); }
  function cancel(){ ctx.flow=null; say('Cancelled. Anything else?'); offer(menu()); }

  /* ---------- understanding typed text, with tolerance for typos ---------- */
  /* a token counts as a word of the list when it is the word, starts it, or is one or two letters away from it */
  /* everyday words that sit one letter from a keyword (there and where, then and when) count only when typed exactly */
  const PLAIN=new Set(['there','here','these','those','then','than','their','they','them','this','that','what','with','will','were','have','from','into','over','more','most','also','some','come','same','make','take','like','time','year','one','two','our','out','now','how','who','whom','whose','for','are','and','the','was','his','her','she','has','had','not','but','can','all','any','its','tam','tukaj','kje','kdaj','kako','kdo','kaj','ali','sta','so','je','in','na','za','od','do','pri','po','se','ne','da']);
  const near=(tok,list)=>list.some(w=>tok===w||(!PLAIN.has(tok)&&((tok.length>=4&&w.startsWith(tok))||(tok.length>=3&&w.length>=4&&lev(tok,w)<=1)||(tok.length>=6&&lev(tok,w)<=2))));
  const anyNear=(toks,list)=>toks.some(t=>near(t,list));
  const FUZ={where:['where','location','located','kje','kam','lokacija'],show:['show','see','display','pokazi','prikazi','poglej'],map:['map','zemljevid','zemljevidu','karta'],open:['open','odpri'],page:['page','record','sheet','stran','zapis'],
    figs:['figures','values','specs','specifications','numbers','dimensions','podatki','vrednosti','mere','kljucni'],story:['story','history','about','background','happened','explain','describe','tell','zgodba','zgodovina','opisi','povej'],
    inspect:['inspection','inspections','inspected','inspect','pregled','pregledi','pregledan','monitored','checked'],who:['who','people','team','researchers','led','author','authors','kdo','avtor','avtorji'],src:['sources','source','references','viri','vir','evidence','proof','dokaz'],
    proj:['projects','project','projekt','projekti'],fix:['wrong','incorrect','error','mistake','fix','update','change','correct','napaka','narobe','popravi','spremeni','posodobi','missing','manjka'],help:['help','pomoc','commands'],hello:['hi','hello','hey','zdravo','zivjo','pozdravljeni','hej'],
    tall:['tall','high','height','visina','visok','visoka'],long:['long','length','dolzina','dolg','dolga'],when:['when','built','opened','year','kdaj','zgrajen','leto'],how:['how','kako']};
  function handle(raw,shown,said){ if(ctx.flow&&ctx.flow.kind==='code'){ user('******'); return ownerCheck(String(raw||'').trim()); } if(!said) user(shown||raw); const text=String(raw||'').trim(); if(!text) return;
    if(/^\/?(owner|admin|lastnik)$/i.test(text)){ if(isOwner()){ say('You are signed in as the atlas owner.'); ownerMenu(); } else ownerLogin(); return; }
    const f=ctx.flow;
    if(f&&f.kind==='update'&&f.step){ const st=f.step;
      if(st==='what'){ f.step=null; const w=whatOf(norm(text)); if(w&&text.split(/\s+/).length<=3) return chooseWhat(w); f.what=w||'other'; f.desc=tidy(text); return askSource(); }
      if(st==='label'){ f.label=tidy(text); return askValue(); }
      if(st==='value'){ if(/^(none|not known|unknown|don.?t know|ne vem|\?)$/i.test(text.trim())){ f.value='not known, please find the published value'; return askSource(); } if(!/\d/.test(text)&&!/^(yes|no)$/i.test(text)){ say('A value usually has a number. Type it again, for example <i>126 m</i>.'); return; } f.value=tidy(text); return askSource(); }
      if(st==='desc'){ f.desc=tidy(text); return askSource(); }
      if(st==='src'){ const u=(text.match(/https?:\/\/\S+/)||[])[0]; if(!u){ say('That is not a link. It should start with <i>https://</i>.'); offer([['I have no link yet',()=>{ f.src=null; summary(); }],['Cancel',cancel]]); return; } f.src=u; return summary(); } }
    if(ctx.flow&&ctx.flow.pick){ const hits=findRecords(norm(text).split(' ').filter(w=>w.length>1&&!STOP.has(w))); const then=ctx.flow.pick;
      if(hits.length){ ctx.flow=null; if(hits.length===1||hits[0].s>=hits[1].s*1.6) return then(hits[0].r); say('Which one?'); offer(hits.slice(0,8).map(h=>[h.r.name,()=>then(h.r)])); ctx.flow=null; return; }
      say('I found no structure with that name. Try another word or choose a type.'); return; }
    try{ if(ON_MAP&&typeof curId!=='undefined'&&curId&&DB.byId[curId]) ctx.rec=DB.byId[curId]; }catch(_){}
    const n=norm(text), tokens=n.split(' ').filter(w=>w&&!STOP.has(w));
    if((/^(hi|hello|hey|zdravo|zivjo|dober dan|hej|pozdravljen\w*)\b/.test(n)||(tokens.length<=2&&anyNear(n.split(' '),FUZ.hello)))&&tokens.length<=2){ say(L()==='sl'?'Pozdravljeni! Kaj vas zanima?':'Hello! What would you like to know?'); home(); return; }
    if(/\b(help|pomoc|what can you)\b/.test(n)){ help(); return; }
    if(/\btimeline|casovn\w*\b/.test(n)){ const b=document.getElementById('tlShow'); if(b){ b.click(); say('Done, the timeline is '+(document.getElementById('tl').hidden?'hidden':'shown')+'.'); } else say('The timeline is on the map page.'); offer(menu()); return; }
    if(/\b(add|new|dodaj)\b.*\b(object|structure|objekt)\b/.test(n)){ say('You can draw a new structure on the Add object page, or tell me what is missing and I write a request.'); offer([['Open Add object','add.html','link'],['Write a request',()=>startUpdate(null,'other')]]); return; }
    const wantFix=/\b(wrong|incorrect|error|mistake|fix|update|change|correct|napak\w*|narobe|popravi\w*|spremeni\w*|posodobi\w*|missing|manjka\w*)\b/.test(n)||anyNear(tokens,FUZ.fix);
    const wantModel=/\b(3d|model\w*)\b/.test(n);
    const attr=ATTRS.find(a=>tokens.some(w=>a.re.test(w)))||(anyNear(tokens,FUZ.tall)?ATTRS.find(a=>a.key==='height'):anyNear(tokens,FUZ.long)?ATTRS.find(a=>a.key==='length'):anyNear(tokens,FUZ.when)?ATTRS.find(a=>a.key==='year'):null);
    const type=TYPES.find(t=>tokens.some(w=>t.re.test(w)));
    const free=tokens.filter(w=>!(attr&&attr.re.test(w))&&!(type&&type.re.test(w))&&!/^(wrong|incorrect|error|fix|update|change|model|3d|how|many|much|koliko|zag|role|vloga|news|novice|figures|values|podatki|inspect\w*|pregled\w*|story|history|tell|we|our|us|did|done|doing|work\w*|who|people|team|sources?|references?|projects?|compare|versus|vs|give|know|explain|describe|background|happened|was|been|also|both|all|any|some|more|info\w*|details?|ever|last|recent\w*|kaj|smo|naredili|delali)$/.test(w));
    const hits=findRecords(free), strong=hits.filter(h=>h.s>=1.5), place=placeRecords(free);
    const I={inspect:/\b(inspect\w*|pregled\w*|monitored|checked)\b/.test(n)||anyNear(tokens,FUZ.inspect),story:/\b(story|history|histor\w*|tell me|about|background|happened|happen|zgodilo|zgodb\w*|zgodovin\w*|explain|describe|opisi)\b/.test(n),
      role:/\b(we|our|zag)\b.*\b(did|do|does|done|work\w*|role)\b|\b(what did|role|vloga|involv\w*|contribut\w*|naredil\w*|delal\w*)\b/.test(n),
      who:/\b(who|kdo|people|team|researchers?|led|lead)\b/.test(n)||anyNear(tokens,FUZ.who),src:/\b(sources?|references?|viri|evidence|proof)\b/.test(n)||anyNear(tokens,FUZ.src),proj:/\b(projects?|projekt\w*)\b/.test(n)||anyNear(tokens,FUZ.proj),cmp:/\b(compare|vs|versus|longer|taller|higher|bigger|primerjaj)\b/.test(n)};
    let r=strong.length&&(strong.length===1||strong[0].s>=strong[1].s*1.4)?strong[0].r:null;
    /* follow-ups about the record we are already talking about */
    const toks=n.split(' ').filter(Boolean);
    const F={where:anyNear(toks,FUZ.where)&&!anyNear(toks,FUZ.fix),map:(anyNear(toks,FUZ.show)&&anyNear(toks,FUZ.map))||/\bon the map\b|\bna zemljevid\w*\b/.test(n),page:anyNear(toks,FUZ.open)&&anyNear(toks,FUZ.page)||/\bits page\b/.test(n),figs:anyNear(toks,FUZ.figs)&&!attr};
    F.map=F.map||F.where;
    if(!r&&ctx.rec&&!strong.length&&!type&&(F.map||F.page||F.figs)){ r=ctx.rec; }
    const countQ=/\b(how many|how much|is there (one|a|any|still)|are there|one or two|two or (one|more)|number of|currently|still|koliko|ali (je|sta|so|imamo|obstaja\w*|še)|trenutno|še vedno)\b/.test(n);
    if(countQ&&strong.length>=2&&!type&&!wantFix&&!wantModel&&!attr){ const rs=strong.filter(h=>h.s>=strong[0].s*0.7).map(h=>h.r).slice(0,5);
      if(rs.length>=2) return analyse(readSteps(rs),()=>{ const sl=window.LANG==='sl';
        say(sl?`Atlas vsebuje <b>${rs.length}</b> ustrezna zapisa:`:`The atlas holds <b>${rs.length}</b> matching records:`);
        say(`<ul class="zb-list">${rs.map(x=>{ const p=x.p, f=arr(p.facts).filter(q=>Array.isArray(q)&&q[1]), line=p.opened||(f[0]?f[0][0]+': '+f[0][1]:'')||(x.year?'ZAG work '+x.year:''); return `<li><b>${esc(x.name)}</b>${x.place?', '+esc(x.place):''}${line?'<br><span>'+esc(tidy(line))+'</span>':''}</li>`; }).join('')}</ul>`);
        const succ=rs.find(x=>arr(x.p.facts).some(q=>Array.isArray(q)&&/succeeded by|replaced by|until \d{4}/i.test(q[0]+' '+q[1])));
        if(succ) say(sl?`Po podatkih atlasa je zapis <b>${esc(succ.name)}</b> zgodovinski, nasledil ga je novejši.`:`By the atlas data, <b>${esc(succ.name)}</b> is the earlier one and has been succeeded by the newer.`);
        offer(rs.map(x=>[(sl?'Več o ':'More on ')+x.name,()=>story(x)])); }); }
    if(!r&&F.where&&hits.length&&hits[0].s>=1.4) r=hits[0].r;
    if(r&&!wantFix&&!wantModel&&!attr){ if(F.map) return whereIs(r); if(F.page){ location.href=recUrl(r); return; } if(F.figs) return figures(r); }
    const prj=strong.length?null:projectOf(free); if(prj&&!wantFix&&!wantModel) return analyse(['Looking up '+tidy(prj.ac||prj.t),'Reading the ZAG project page entry','Writing the answer'],()=>projectCard(prj));
    const many=mentioned(free);
    if(many.length>=2&&!type&&!wantFix&&!wantModel){ const rs=many.slice(0,4);
      if(attr) return analyse(readSteps(rs),()=>compare(rs,attr));
      return analyse(readSteps(rs),()=>{ say(`You asked about <b>${rs.length}</b> records, so here is each one in turn.`); if(I.inspect&&I.role&&!rs.some(x=>arr(DB.insp&&DB.insp[x.id]).length)) say('No dated inspection reports are published for these, so I cannot give inspection dates. Here is the work the sources record.'); rs.forEach(x=>I.inspect&&!I.role?inspections(x):I.story?story(x):role(x,true));
        offer(rs.map(x=>['More on '+x.name,()=>story(x)]).concat([['Key figures of each',()=>rs.forEach(figures)]])); }); }
    const answer=(x,f)=>analyse(readSteps([x]),f);
    if(!r&&!type&&!free.length&&ctx.rec&&(attr||wantFix||wantModel||/\b(zag|role|news)\b/.test(n))) r=ctx.rec;
    if(!r&&!type&&!strong.length&&PAGE_ID&&DB.byId[PAGE_ID]&&(attr||wantFix||wantModel)) r=DB.byId[PAGE_ID];
    if(/\bhow many|koliko\b/.test(n)&&type&&!r){ const c=DB.recs.filter(x=>type.match(x.type)).length; say(`The atlas has <b>${c}</b> ${esc(type.name)}.`); offer([['List them',()=>listType(type)],...menu().slice(0,2)]); return; }
    if(wantFix&&!wantModel) return startUpdate(r,attr?'value':whatOf(n),attr?attr.name:null);
    if(wantModel) return wantFix?startUpdate(r,'model'):startModel(r);
    if(!r&&many.length===1&&(I.inspect||I.story||I.role||I.who||I.src||I.proj||attr)) r=many[0];
    if(!r&&ctx.rec&&!type&&!free.length&&(I.inspect||I.story||I.role||I.who||I.src||I.proj)) r=ctx.rec;
    if(r&&I.inspect) return answer(r,()=>{ inspections(r); if(I.role) role(r); });
    if(r&&attr) return attrAnswer(r,attr);
    if(r&&I.who) return answer(r,()=>people(r));
    if(r&&I.src) return answer(r,()=>sources(r));
    if(r&&I.proj) return answer(r,()=>projects(r));
    if(r&&I.story) return answer(r,()=>story(r));
    if(r&&(I.role||/\b(zag|role|vloga|did)\b/.test(n))) return answer(r,()=>role(r));
    if(r&&/\bnews|novice\b/.test(n)){ say('Recent news for <b>'+esc(r.name)+'</b> is on its page under Sources.'); offer([['Open its page',recUrl(r)+'#news','link'],...recChips(r).slice(1)]); return; }
    if(r) return card(r);
    if(type) return listType(type,place.length?place:null);
    if(place.length){ say(`Recorded in that place:`); offer(place.slice(0,12).map(x=>[x.name,()=>card(x)])); return; }
    if(strong.length||hits.length){ const h=(strong.length?strong:hits).slice(0,6); say('Did you mean one of these?'); offer(h.map(x=>[x.r.name,()=>card(x.r)]).concat([['None of them',()=>{ say('Try another word, or choose a type.'); offer(typeChips()); }]])); return; }
    if(attr&&!r){ say(`Which structure do you mean for the ${esc(attr.name)}?`); ctx.flow={pick:x=>attrAnswer(x,attr)}; offer(ctx.rec?[[ctx.rec.name,()=>{ ctx.flow=null; attrAnswer(ctx.rec,attr); }]]:typeChips().map(c=>[c[0],()=>listPick(c[1],x=>attrAnswer(x,attr))])); return; }
    if(I.inspect||I.story||I.role||I.who||I.proj){ const what=I.inspect?'inspections':I.story?'the story':I.who?'the people':I.proj?'the projects':'ZAG\'s work';
      say(`Which structure do you mean for ${what}? Type its name, or choose a type.`); const go=x=>I.inspect?inspections(x):I.story?story(x):I.who?people(x):I.proj?projects(x):role(x);
      ctx.flow={pick:go}; offer((ctx.rec?[[ctx.rec.name,()=>{ ctx.flow=null; go(ctx.rec); }]]:[]).concat(typeChips().map(c=>[c[0],()=>listPick(c[1],go)]))); return; }
    if(/\b(weather|vreme|joke|politic\w*|bitcoin|stock|recipe|football)\b/.test(n)){ say('I only answer about ZAG and the structures in this atlas, from published sources. For that, please use another service.'); home(); return; }
    say('I did not understand that. I answer only from the atlas data, so here is what I can do:'); home(); }

  /* ---------- open and close ---------- */
  async function toggle(open){ const on=open==null?panel.hidden:open; panel.hidden=!on; launch.setAttribute('aria-expanded',String(on)); root.classList.toggle('open',on);
    try{ sessionStorage.setItem(OKEY,on?'1':'0'); }catch(_){}
    if(on&&!started){ started=true; say('Loading the atlas data...',null,true);
      try{ await load(); log.innerHTML=''; const here=PAGE_ID&&DB.byId[PAGE_ID]; if(here) ctx.rec=here;
        if(hist.length){ const old=hist.slice(); hist=[]; old.forEach(m=>say(m.h,m.w,true)); hist=old; const d=document.createElement('div'); d.className='zb-day'; d.textContent=window.LANG==='sl'?'Nadaljujemo, kjer smo končali':'Continuing where we left off'; log.appendChild(d); scroll();
          offer(here?[['Key figures',()=>figures(here),null,'Verified values with sources','find'],['What did ZAG do?',()=>role(here),null,'Role and years of work','help'],['Report a correction',()=>startUpdate(here),null,'A value, position or model','fix'],['3D model',()=>startModel(here),null,'Update or request it','cube']]:menu(),true); if(on) setTimeout(()=>input.focus(),50); return; }
        say(window.LANG==='sl'?`Pozdravljeni, sem <b>ZAGBot</b>. Poznam ${DB.recs.length} struktur v atlasu in njihove preverjene vrednosti.${here?` Ste na strani <b>${esc(here.name)}</b>.`:''} Vprašajte me v slovenščini ali angleščini, odgovarjam iz podatkov atlasa. Kaj želite?`:`Hello, I am <b>ZAGBot</b>. I know the ${DB.recs.length} structures in the atlas and their verified values.${here?` You are on <b>${esc(here.name)}</b>.`:''} What would you like?`);
        offer(here?[['Key figures',()=>figures(here),null,'Verified values with sources','find'],['What did ZAG do?',()=>role(here),null,'Role and years of work','help'],['Report a correction',()=>startUpdate(here),null,'A value, position or model','fix'],['3D model',()=>startModel(here),null,'Update or request it','cube']]:menu(),true); }
      catch(_){ log.innerHTML=''; say('The atlas data could not be loaded. Please reload the page.'); } }
    if(on) setTimeout(()=>input.focus(),50); }
  /* greeting next to the launcher: rises like the face of a cube, stays 10 seconds, can be closed */
  (function teaser(){ let off=false; try{ off=sessionStorage.getItem('zb_teaser_off')==='1'; if(!off) sessionStorage.setItem('zb_teaser_off','1'); }catch(_){} if(off) return;
    const T=window.LANG==='sl'?['Dober dan, sem ZAGBot.','Vprašajte me, kaj je ZAG naredil pri kateri koli od 73 struktur, o njeni zgodbi, ključnih podatkih z viri ali projektih za njo.','Sprejmem tudi popravek za ekipo atlasa.']:['Dober dan, I am ZAGBot.','Ask me what ZAG did at any of the 73 structures, its story, key figures with sources, or the projects behind it.','I can also take a correction to the atlas team.'];
    const el=document.createElement('div'); el.className='zb-tease'; el.setAttribute('role','status');
    el.innerHTML='<button type="button" class="zb-tx" aria-label="Close the greeting">×</button><p class="zb-tt"><b>'+esc(T[0])+'</b> <span>'+esc(T[1])+'</span> <span>'+esc(T[2])+'</span></p><span class="zb-tbar"><i></i></span>'; root.appendChild(el);
    let timer=null, done=false;
    const bye=()=>{ if(done) return; done=true; clearTimeout(timer); el.classList.remove('in'); el.classList.add('out'); setTimeout(()=>el.remove(),500); };
    el.querySelector('.zb-tx').onclick=e=>{ e.stopPropagation(); try{ sessionStorage.setItem('zb_teaser_off','1'); }catch(_){} bye(); };
    el.onclick=()=>{ bye(); toggle(true); };
    setTimeout(()=>{ if(!panel.hidden||done) return; el.classList.add('in'); timer=setTimeout(bye,10000); },1600);
    launch.addEventListener('click',bye); })();
  try{ if(sessionStorage.getItem(OKEY)==='1') setTimeout(()=>toggle(true),400); }catch(_){}
  $('.zb-new').onclick=()=>{ forget(); log.innerHTML=''; ctx={rec:PAGE_ID&&DB.byId?DB.byId[PAGE_ID]||null:null,flow:null}; say(window.LANG==='sl'?'Nov pogovor. Kaj želite?':'New conversation. What would you like?'); offer(menu(),true); };
  launch.onclick=()=>toggle(); $('.zb-x').onclick=()=>toggle(false); $('.zb-min').onclick=()=>toggle(false); $('.zb-big').onclick=()=>root.classList.toggle('big');
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!panel.hidden) toggle(false); });
  $('.zb-in').onsubmit=e=>{ e.preventDefault(); const t=input.value; input.value=''; if(!t.trim()) return; if(ctx.flow&&ctx.flow.kind==='code'){ handle(t); return; } user(t); think(); setTimeout(()=>{ load().then(()=>DB.more).then(()=>handle(t,null,true)).catch(()=>handle(t,null,true)); },350); };
  /* ---------- voice: a question spoken in Slovenian or English, answers read aloud on request ---------- */
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition, mic=$('.zb-mic'), spk=$('.zb-spk'), waveC=$('.zb-wave-c'); let rec=null, listening=false, voiceOn=false;
  try{ voiceOn=localStorage.getItem('zb_voice')==='1'; }catch(_){} spk.setAttribute('aria-pressed',String(voiceOn));
  /* the chat speaks the language of the site; the flags switch the whole site, as ENG / SLO in the header does */
  const chatLang=window.LANG==='sl'?'sl':'en';
  const L=()=>chatLang, lang=()=>chatLang==='sl'?'sl-SI':'en-GB';
  root.querySelectorAll('.zb-flag').forEach(f=>{ f.setAttribute('aria-pressed',String(f.dataset.l===chatLang)); f.onclick=()=>{ if(f.dataset.l===chatLang) return; try{ sessionStorage.setItem(OKEY,'1'); }catch(_){} if(window.setLang) window.setLang(f.dataset.l); }; });
  /* the voice: a warm, natural one where the browser has it (the online natural voices of Edge, the Google voices of Chrome,
     Samantha and Tina on Apple devices), slightly brighter in pitch, the way an assistant speaks */
  const PREF={en:[/Aria.*Natural/i,/Jenny.*Natural/i,/Libby.*Natural/i,/Sonia.*Natural/i,/Google UK English Female/i,/Google US English/i,/Samantha/i,/Karen/i,/Moira/i,/Serena/i,/Zira/i,/Hazel/i,/en-GB/i,/en-US/i],
    sl:[/Petra.*Natural/i,/Rok.*Natural/i,/Petra/i,/Tina/i,/Lado/i,/Google.*slov/i,/^sl/i]};
  function pickVoice(){ const vs=speechSynthesis.getVoices(); const two=lang().slice(0,2); for(const re of PREF[L()]){ const v=vs.find(x=>re.test(x.name)&&x.lang.toLowerCase().startsWith(two))||(re.source.startsWith('^')||/en-|sl/.test(re.source)?vs.find(x=>re.test(x.lang)):null); if(v) return v; } return vs.find(x=>x.lang.toLowerCase().startsWith(two))||null; }
  function speak(el){ if(!voiceOn||!('speechSynthesis' in window)) return; const t=(el.innerText||'').replace(/\s+/g,' ').replace(/https?:\/\/\S+/g,'').trim().slice(0,600); if(!t) return;
    const u=new SpeechSynthesisUtterance(t); u.lang=lang(); const v=pickVoice(); if(v) u.voice=v; u.rate=1.04; u.pitch=1.12; u.volume=1; speechSynthesis.cancel(); speechSynthesis.speak(u); }
  if('speechSynthesis' in window) speechSynthesis.onvoiceschanged=()=>{};
  spk.onclick=()=>{ voiceOn=!voiceOn; spk.setAttribute('aria-pressed',String(voiceOn)); try{ localStorage.setItem('zb_voice',voiceOn?'1':'0'); }catch(_){} if(!voiceOn&&'speechSynthesis' in window) speechSynthesis.cancel();
    const d=say(voiceOn?(L()==='sl'?'Z veseljem. Odgovore bom brala naglas.':'Gladly. I will read my answers aloud.'):(L()==='sl'?'Branje naglas je izklopljeno.':'Reading aloud is off.'),null,true); if(voiceOn) speak(d); };
  /* the wave while listening: the live spectrum of the microphone, drawn as soft blurred bands of colour */
  let audio=null, analyser=null, waveRaf=0, synth=0;
  async function waveStart(){ waveC.hidden=false; const g=waveC.getContext('2d'); let data=null;
    try{ const st=await navigator.mediaDevices.getUserMedia({audio:true}); audio=new (window.AudioContext||window.webkitAudioContext)(); analyser=audio.createAnalyser(); analyser.fftSize=256; analyser.smoothingTimeConstant=.82; audio.createMediaStreamSource(st).connect(analyser); data=new Uint8Array(analyser.frequencyBinCount); waveC._stream=st; }catch(_){ analyser=null; }
    const W=waveC.width, H=waveC.height, cols=[['#0A84FF','#34C759'],['#213469','#0A84FF'],['#65BC7B','#32ADE6']]; let t=0;
    const draw=()=>{ t+=0.045; let level=0.18; if(analyser){ analyser.getByteFrequencyData(data); let s=0; for(let i=2;i<40;i++) s+=data[i]; level=Math.min(1,s/38/140); } else { synth=synth*0.9+Math.random()*0.1; level=0.15+synth*0.5; }
      g.clearRect(0,0,W,H); g.globalCompositeOperation='source-over'; g.filter='blur(7px)';
      cols.forEach((c,k)=>{ const grad=g.createLinearGradient(0,0,W,0); grad.addColorStop(0,c[0]); grad.addColorStop(0.5,c[1]); grad.addColorStop(1,c[0]); g.fillStyle=grad; g.globalAlpha=0.5;
        g.beginPath(); g.moveTo(0,H); for(let x=0;x<=W;x+=6){ const n=x/W; const env=Math.sin(Math.PI*n); const y=H/2-(Math.sin(n*9+t*(1.3+k*.35)+k)*0.5+Math.sin(n*17-t*(1.9+k*.2))*0.3)*env*H*0.42*(0.25+level*1.1); g.lineTo(x,y); } for(let x=W;x>=0;x-=6){ const n=x/W; const env=Math.sin(Math.PI*n); const y=H/2+(Math.sin(n*9+t*(1.3+k*.35)+k+1)*0.5+Math.sin(n*17-t*(1.9+k*.2))*0.3)*env*H*0.42*(0.25+level*1.1); g.lineTo(x,y); } g.closePath(); g.fill(); });
      g.filter='none'; g.globalCompositeOperation='source-over'; g.globalAlpha=1; waveRaf=requestAnimationFrame(draw); };
    draw(); }
  function waveStop(){ cancelAnimationFrame(waveRaf); waveC.hidden=true; try{ waveC._stream&&waveC._stream.getTracks().forEach(x=>x.stop()); }catch(_){} try{ audio&&audio.close(); }catch(_){} audio=null; analyser=null; }
  if(SR&&(location.protocol==='https:'||location.hostname==='localhost')){ mic.hidden=false;
    const stop=()=>{ listening=false; mic.setAttribute('aria-pressed','false'); root.classList.remove('listening'); waveStop(); input.placeholder=L()==='sl'?'Vprašajte o objektu ali povejte, kaj naj spremenim':'Ask about a structure, or tell me what to change'; };
    mic.onclick=()=>{ if(listening){ try{ rec.stop(); }catch(_){} stop(); return; }
      rec=new SR(); rec.lang=lang(); rec.interimResults=true; rec.continuous=false; rec.maxAlternatives=1; let finalText='';
      rec.onresult=e=>{ let interim=''; for(let i=e.resultIndex;i<e.results.length;i++){ const t=e.results[i][0].transcript; if(e.results[i].isFinal) finalText+=t; else interim+=t; } input.value=(finalText+interim).trim(); synth=Math.min(1,synth+0.4); };
      rec.onerror=e=>{ stop(); if(e.error==='not-allowed') say(L()==='sl'?'Mikrofon ni dovoljen. Dovolite ga v nastavitvah strani v brskalniku.':'The microphone is not allowed. Allow it for this site in the browser.',null,true); else if(e.error!=='aborted'&&e.error!=='no-speech') say((L()==='sl'?'Prepoznava govora ni uspela: ':'Speech recognition failed: ')+esc(e.error),null,true); };
      rec.onend=()=>{ stop(); const t=input.value.trim(); if(t){ input.value=''; user(t); think(); setTimeout(()=>{ load().then(()=>DB.more).then(()=>handle(t,null,true)).catch(()=>handle(t,null,true)); },300); } };
      try{ rec.start(); listening=true; mic.setAttribute('aria-pressed','true'); root.classList.add('listening'); input.value=''; input.placeholder=L()==='sl'?'Poslušam':'Listening'; waveStart(); }catch(_){ stop(); } }; }
  window.ZAGBot=window.ZAGBOT={open:()=>toggle(true),ask:t=>{ toggle(true).then(()=>handle(t)); }};
})();
