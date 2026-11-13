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
  const css=document.createElement('link'); css.rel='stylesheet'; css.href='css/zagbot.css?v=5'; document.head.appendChild(css);

  /* ---------- the robot, in a Slovenian shirt: white, blue and red with three white peaks ---------- */
  const ROBOT=(size,wave)=>`<svg class="zb-robot" viewBox="0 0 120 132" width="${size}" height="${Math.round(size*1.1)}" aria-hidden="true">
    <line x1="60" y1="6" x2="60" y2="20" stroke="#203469" stroke-width="3" stroke-linecap="round"/><circle class="zb-ant" cx="60" cy="6" r="5" fill="#ED1C24"/>
    <rect x="22" y="18" width="76" height="54" rx="20" fill="#F4F6FA" stroke="#203469" stroke-width="3"/>
    <rect x="32" y="30" width="56" height="30" rx="13" fill="#203469"/>
    <g class="zb-pupils"><circle class="zb-eye" cx="48" cy="44" r="6" fill="#7FD4FF"/><circle class="zb-eye" cx="72" cy="44" r="6" fill="#7FD4FF"/></g>
    <path d="M51 53q9 6 18 0" fill="none" stroke="#7FD4FF" stroke-width="3" stroke-linecap="round"/>
    <rect x="14" y="36" width="8" height="18" rx="4" fill="#203469"/><rect x="98" y="36" width="8" height="18" rx="4" fill="#203469"/>
    <rect x="52" y="72" width="16" height="6" fill="#203469"/>
    <clipPath id="zbShirt"><path d="M30 78h60l20 14-9 15-11-6v29H30v-29l-11 6-9-15z"/></clipPath>
    <g clip-path="url(#zbShirt)"><rect x="0" y="76" width="120" height="20" fill="#FFFFFF"/><rect x="0" y="96" width="120" height="18" fill="#0057B8"/><rect x="0" y="114" width="120" height="20" fill="#ED1C24"/>
      <path d="M44 106l5-7 4 5 4-8 4 8 4-5 5 7" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linejoin="round"/></g>
    <path d="M30 78h60l20 14-9 15-11-6v29H30v-29l-11 6-9-15z" fill="none" stroke="#203469" stroke-width="3" stroke-linejoin="round"/>
    <text x="60" y="91" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="10" font-weight="800" fill="#203469">ZAG</text>
    ${wave?'<g class="zb-wave"><path d="M104 92l10-14" stroke="#203469" stroke-width="7" stroke-linecap="round"/><circle cx="115" cy="76" r="5" fill="#F4F6FA" stroke="#203469" stroke-width="2.5"/></g>':''}
  </svg>`;

  /* ---------- text helpers ---------- */
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim();
  const tidy=s=>String(s==null?'':s).replace(/\s*[—–]\s*/g,', ').replace(/\s*;\s*/g,', ').replace(/\s*·\s*/g,', ').replace(/\s+/g,' ').trim();
  const lev=(a,b)=>{ if(Math.abs(a.length-b.length)>2) return 9; const d=[...Array(b.length+1).keys()]; for(let i=1;i<=a.length;i++){ let p=d[0]; d[0]=i; for(let j=1;j<=b.length;j++){ const t=d[j]; d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1)); p=t; } } return d[b.length]; };
  const STOP=new Set('the a an of in on at to is are was were what how which who when where me show find tell about for and or with please can you i my do does did there this that it its kaj je so na v za in ali kje kdaj kako koliko mi pokazi prosim of'.split(' '));

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
      DB.recs=g.features.map(f=>{ const p=f.properties; const name=tidy(p.name_en||p.name||p.id);
        const words=new Set(norm([p.name_en,p.name,p.name_sl,p.id.replace(/_/g,' ')].join(' ')).split(' ').filter(w=>w.length>2&&!STOP.has(w)));
        const place=new Set(norm([p.locality,p.municipality].join(' ')).split(' ').filter(w=>w.length>2));
        return {id:p.id,name,type:p.object_type||'other',place:tidy(p.locality||p.municipality||''),role:tidy(p.zag_role||''),year:p.year||'',words,placeWords:place,p}; });
      DB.recs.forEach(r=>DB.byId[r.id]=r); });
    return DB.ready; }

  function wordHit(q,w){ if(q===w) return 3; if(q.length>=4&&(w.startsWith(q)||q.startsWith(w))&&Math.min(q.length,w.length)>=4) return 2; if(q.length>=5&&lev(q,w)<=1) return 1.5; if(q.length>=7&&lev(q,w)<=2) return 1; return 0; }
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
        ${ROBOT(34,true)}<div class="zb-title"><b>ZAGBot</b><span>Assistant of the ZAG Digital Atlas</span></div></header>
      <div class="zb-log" id="zbLog" aria-live="polite"></div>
      <div class="zb-chips" id="zbChips"></div>
      <form class="zb-in" autocomplete="off"><input id="zbText" maxlength="400" placeholder="Ask about a structure, or tell me what to change" aria-label="Message to ZAGBot"><button type="submit">Send</button></form>
      <p class="zb-foot">Answers come only from the atlas data, with the source. Changes go to the owner as a request on GitHub.</p>
    </section>`;
  document.body.appendChild(root);
  if(ON_MAP) document.body.classList.add('zb-onmap');
  const $=s=>root.querySelector(s), log=$('#zbLog'), chips=$('#zbChips'), input=$('#zbText'), panel=$('#zbPanel'), launch=$('.zb-launch');
  let ctx={rec:null,flow:null}, started=false;

  const scroll=()=>{ log.scrollTop=log.scrollHeight; };
  let typing=null;
  function say(html,who){ const d=document.createElement('div'); d.className='zb-msg '+(who||'bot'); d.innerHTML=html; if(typing){ typing.remove(); typing=null; } log.appendChild(d); scroll(); return d; }
  function think(){ if(typing) return; typing=document.createElement('div'); typing.className='zb-msg bot'; typing.innerHTML='<span class="zb-typing"><i></i><i></i><i></i></span>'; log.appendChild(typing); scroll(); }
  function user(t){ say(esc(t),'me'); }
  /* chips: [label, action] where action is a function or a string the user "types" */
  function offer(list){ chips.innerHTML=''; for(const c of list){ if(!c) continue; const [label,act,kind]=c;
      const el=kind==='link'?Object.assign(document.createElement('a'),{href:act,target:act.startsWith('http')?'_blank':'',rel:'noopener'}):document.createElement('button');
      if(kind!=='link') el.type='button'; el.className='zb-chip'+(kind==='primary'||kind==='link'?' solid':''); el.textContent=label;
      if(kind!=='link') el.onclick=()=>{ if(typeof act==='function'){ user(label); act(); } else handle(act,label); };
      chips.appendChild(el); } }
  const menu=()=>[['Find a structure',()=>{ say('Type its name or place, for example <i>Kastelec</i>, <i>Arto Blanca</i> or <i>bridges in Ljubljana</i>.'); offer(typeChips()); input.focus(); }],
    ['What can you do?','help'],['Report something wrong',()=>startUpdate(ctx.rec)],['Request a 3D model',()=>startModel(ctx.rec)],ON_MAP?['Show or hide the timeline','timeline']:['Open the map','index.html','link']];
  const typeChips=()=>TYPES.slice(0,6).map(t=>[t.name[0].toUpperCase()+t.name.slice(1),t.key]);
  const recUrl=r=>'twin.html?id='+encodeURIComponent(r.id);
  const recChips=r=>[['Open its page',recUrl(r),'link'],['Show on the map',()=>showOnMap(r)],['Key figures',()=>figures(r)],['What did ZAG do?',()=>role(r)],['Something is wrong',()=>startUpdate(r)]];
  function showOnMap(r){ if(ON_MAP&&typeof window.showInfo==='function'){ window.showInfo(r.id); say('Shown on the map: <b>'+esc(r.name)+'</b>.'); panelSmall(); } else location.href='index.html#'+encodeURIComponent(r.id); }
  function panelSmall(){ if(window.innerWidth<700) toggle(false); }

  /* ---------- answers ---------- */
  function card(r){ ctx.rec=r; const t=DB.twins[r.id]||{};
    say(`<div class="zb-card"><b>${esc(r.name)}</b><span>${esc(cap(r.type))}${r.place?', '+esc(r.place):''}${r.year?', ZAG work '+esc(String(r.year).replace(/-/g,' to ')):''}</span>${t.summary?`<p>${esc(tidy(t.summary)).slice(0,260)}</p>`:''}</div>`);
    offer(recChips(r)); }
  const cap=s=>String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1);
  function specLine(s){ const v=tidy(s.value)+(s.unit?' '+esc(s.unit):''); const host=s.source?(()=>{ try{ return new URL(s.source).hostname.replace(/^www\./,''); }catch(_){ return 'source'; } })():null;
    return `<li><span>${esc(tidy(s.label))}</span><b>${esc(v)}</b>${host?`<a href="${esc(s.source)}" target="_blank" rel="noopener">${esc(host)}</a>`:'<em>no source link</em>'}</li>`; }
  function figures(r){ ctx.rec=r; const sp=((DB.twins[r.id]||{}).specs||[]).filter(s=>!/mapped geometry/i.test(s.label));
    if(!sp.length){ say('No verified values are recorded for <b>'+esc(r.name)+'</b> yet.'); offer([['Report a missing value',()=>startUpdate(r,'value')],...recChips(r).slice(0,2)]); return; }
    say(`<b>${esc(r.name)}</b>, verified values:<ul class="zb-spec">${sp.slice(0,8).map(specLine).join('')}</ul>${sp.length>8?`<p class="zb-note">${sp.length-8} more on its page.</p>`:''}`);
    offer(recChips(r).filter(c=>c[0]!=='Key figures')); }
  function role(r){ ctx.rec=r; say(r.role?`<b>ZAG at ${esc(r.name)}</b><p>${esc(r.role)}</p>`:'The sources do not describe ZAG’s role at '+esc(r.name)+' in detail. Its page lists the sources.'.replace('’',"'")); offer(recChips(r).filter(c=>c[0]!=='What did ZAG do?')); }
  function attrAnswer(r,a){ ctx.rec=r; const sp=((DB.twins[r.id]||{}).specs||[]).filter(s=>a.label.test(s.label));
    if(!sp.length){ say(`No ${esc(a.name)} is published in the sources for <b>${esc(r.name)}</b>, so I will not guess one.`); offer([['Key figures',()=>figures(r)],['I have a source for it',()=>startUpdate(r,'value',a.name)],['Open its page',recUrl(r),'link']]); return; }
    say(`<b>${esc(r.name)}</b>, ${esc(a.name)}:<ul class="zb-spec">${sp.slice(0,4).map(specLine).join('')}</ul>`); offer(recChips(r)); }
  function listType(t,inPlace){ let rs=DB.recs.filter(r=>t.match(r.type)); if(inPlace) rs=rs.filter(r=>inPlace.includes(r));
    if(!rs.length){ say(`No ${esc(t.name)} are recorded${inPlace?' there':''}.`); offer(menu()); return; }
    say(rs.length===1?`One of the ${esc(t.name)} is recorded${inPlace?' there':''}:`:`${rs.length} ${esc(t.name)}${inPlace?' there':''} in the atlas. Choose one:`); offer(rs.slice(0,10).map(r=>[r.name,()=>card(r)]).concat(rs.length>10?[['Show more',()=>{ offer(rs.slice(10,24).map(r=>[r.name,()=>card(r)])); }]]:[])); }
  function help(){ say(`I can:<ul class="zb-list"><li>find a structure by name, type or place</li><li>answer a value such as height, length, year or power, always with its source</li><li>show it on the map or open its page</li><li>take a report when something is wrong and send it to the owner as an exact request</li><li>open the form for a new 3D model</li></ul>I understand English and Slovenian words, for example <i>predor</i>, <i>most</i>, <i>višina</i>.`); offer(menu()); }

  /* ---------- guided requests: every step is a click, so the request is exact ---------- */
  function pickRecord(then,why){ say((why||'Which structure is it?')+' Type a name or choose one.'); ctx.flow={pick:then};
    const near=ctx.rec?[[ctx.rec.name,()=>{ ctx.flow=null; then(ctx.rec); }]]:[]; offer(near.concat(typeChips().map(c=>[c[0],()=>listPick(c[1],then)])) ); input.focus(); }
  function listPick(key,then){ const t=TYPES.find(x=>x.key===key); const rs=DB.recs.filter(r=>t.match(r.type)); say('Choose one:'); offer(rs.slice(0,24).map(r=>[r.name,()=>{ ctx.flow=null; then(r); }])); }
  function startModel(r){ if(!r) return pickRecord(startModel,'Which structure needs a 3D model?'); ctx.rec=r;
    const has=!!((DB.twins[r.id]||{}).model); say(`${has?'Update':'Request'} the 3D model of <b>${esc(r.name)}</b>. The form asks for the height and its source link, the outline comes from OpenStreetMap. The model is built by itself in about two minutes.`);
    offer([[has?'Open the update form':'Open the request form',`${REPO}/issues/new?template=model_request.yml&title=${encodeURIComponent('Model: '+r.name+' ('+r.id+')')}`,'link'],['The model looks wrong',()=>startUpdate(r,'model')],['Back',()=>card(r)]]); }
  const WHAT=[['position','The position on the map'],['value','A value (height, length, year)'],['model','The 3D model'],['text','The description or ZAG role'],['source','A source or link'],['other','Something else']];
  function startUpdate(r,what,attr){ if(!r) return pickRecord(x=>startUpdate(x,what,attr),'Which structure is it about?'); ctx.rec=r; ctx.flow={kind:'update',r,what:null,label:attr||null,value:null,src:null};
    if(what) return chooseWhat(what); ctx.flow.step='what'; say(`What is wrong or missing at <b>${esc(r.name)}</b>? Choose below or describe it in your own words.`); offer(WHAT.map(([k,l])=>[l,()=>{ ctx.flow.step=null; chooseWhat(k); }])); }
  const whatOf=n=>/\b(position|where|location|place|coordinates?|lokacij\w*|polozaj\w*|pin)\b/.test(n)?'position':/\b(3d|model\w*|shape|oblik\w*)\b/.test(n)?'model':/\b(source|link|vir\w*)\b/.test(n)?'source':/\b(description|role|text|opis\w*|vloga)\b/.test(n)?'text':null;
  function chooseWhat(k){ const f=ctx.flow; f.what=k;
    if(k==='value'&&f.label&&!f.old){ const a=ATTRS.find(x=>x.name===f.label), sp=a&&((DB.twins[f.r.id]||{}).specs||[]).find(s=>a.label.test(s.label)); if(sp){ f.label=tidy(sp.label); f.old=tidy(sp.value)+(sp.unit?' '+sp.unit:''); } }
    if(k==='value'&&!f.label){ const sp=((DB.twins[f.r.id]||{}).specs||[]).filter(s=>!/mapped geometry/i.test(s.label)).slice(0,8);
      say('Which value?'); offer(sp.map(s=>[tidy(s.label)+': '+tidy(s.value)+(s.unit?' '+s.unit:''),()=>{ f.label=tidy(s.label); f.old=tidy(s.value)+(s.unit?' '+s.unit:''); askValue(); }]).concat([['A value that is missing',()=>{ say('Type the name of the value, for example <i>span</i>.'); f.step='label'; input.focus(); offer([['Cancel',cancel]]); }]])); return; }
    if(k==='model'){ say('What is wrong with the model? Type it in a few words, for example <i>gates are missing</i>. You can attach photos on GitHub in the next step.'); f.step='desc'; offer([['Shape is wrong',()=>{ f.desc='The shape does not match the real structure'; askSource(); }],['Height is wrong',()=>{ f.desc='The height is wrong'; askSource(); }],['Parts are missing',()=>{ f.desc='Parts of the structure are missing'; askSource(); }],['Cancel',cancel]]); input.focus(); return; }
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
    offer([['Send to ZAGBot on GitHub',`${REPO}/issues/new?title=${encodeURIComponent(title)}&labels=zagbot&body=${encodeURIComponent(body)}`,'link'],['Change something',()=>startUpdate(f.r)],['Cancel',cancel]]);
    say('<span class="zb-note">GitHub opens with the request filled in. Press <b>Create</b>. When the atlas owner sends it, ZAGBot on GitHub checks the source, makes the change and replies there.</span>'); }
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

  /* ---------- understanding typed text ---------- */
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
    if(/^(hi|hello|hey|zdravo|zivjo|dober dan|hej|pozdravljen\w*)\b/.test(n)&&tokens.length<=2){ say('Hello! What would you like to know?'); offer(menu()); return; }
    if(/\b(help|pomoc|what can you)\b/.test(n)){ help(); return; }
    if(/\btimeline|casovn\w*\b/.test(n)){ const b=document.getElementById('tlShow'); if(b){ b.click(); say('Done, the timeline is '+(document.getElementById('tl').hidden?'hidden':'shown')+'.'); } else say('The timeline is on the map page.'); offer(menu()); return; }
    if(/\b(add|new|dodaj)\b.*\b(object|structure|objekt)\b/.test(n)){ say('You can draw a new structure on the Add object page, or tell me what is missing and I write a request.'); offer([['Open Add object','add.html','link'],['Write a request',()=>startUpdate(null,'other')]]); return; }
    const wantFix=/\b(wrong|incorrect|error|mistake|fix|update|change|correct|napak\w*|narobe|popravi\w*|spremeni\w*|posodobi\w*|missing|manjka\w*)\b/.test(n);
    const wantModel=/\b(3d|model\w*)\b/.test(n);
    const attr=ATTRS.find(a=>tokens.some(w=>a.re.test(w)));
    const type=TYPES.find(t=>tokens.some(w=>t.re.test(w)));
    const free=tokens.filter(w=>!(attr&&attr.re.test(w))&&!(type&&type.re.test(w))&&!/^(wrong|incorrect|error|fix|update|change|model|3d|how|many|much|koliko|zag|role|vloga|news|novice|figures|values|podatki)$/.test(w));
    const hits=findRecords(free), strong=hits.filter(h=>h.s>=2), place=placeRecords(free);
    let r=strong.length&&(strong.length===1||strong[0].s>=strong[1].s*1.4)?strong[0].r:null;
    if(!r&&!type&&!free.length&&ctx.rec&&(attr||wantFix||wantModel||/\b(zag|role|news)\b/.test(n))) r=ctx.rec;
    if(!r&&!type&&!strong.length&&PAGE_ID&&DB.byId[PAGE_ID]&&(attr||wantFix||wantModel)) r=DB.byId[PAGE_ID];
    if(/\bhow many|koliko\b/.test(n)&&type&&!r){ const c=DB.recs.filter(x=>type.match(x.type)).length; say(`The atlas has <b>${c}</b> ${esc(type.name)}.`); offer([['List them',()=>listType(type)],...menu().slice(0,2)]); return; }
    if(wantFix&&!wantModel) return startUpdate(r,attr?'value':whatOf(n),attr?attr.name:null);
    if(wantModel) return wantFix?startUpdate(r,'model'):startModel(r);
    if(r&&attr) return attrAnswer(r,attr);
    if(r&&/\b(zag|role|vloga|did)\b/.test(n)) return role(r);
    if(r&&/\bnews|novice\b/.test(n)){ say('Recent news for <b>'+esc(r.name)+'</b> is on its page under Sources.'); offer([['Open its page',recUrl(r)+'#news','link'],...recChips(r).slice(1)]); return; }
    if(r) return card(r);
    if(type) return listType(type,place.length?place:null);
    if(place.length){ say(`Recorded in that place:`); offer(place.slice(0,12).map(x=>[x.name,()=>card(x)])); return; }
    if(strong.length||hits.length){ const h=(strong.length?strong:hits).slice(0,6); say('Did you mean one of these?'); offer(h.map(x=>[x.r.name,()=>card(x.r)]).concat([['None of them',()=>{ say('Try another word, or choose a type.'); offer(typeChips()); }]])); return; }
    if(attr&&!r){ say(`Which structure do you mean for the ${esc(attr.name)}?`); ctx.flow={pick:x=>attrAnswer(x,attr)}; offer(ctx.rec?[[ctx.rec.name,()=>{ ctx.flow=null; attrAnswer(ctx.rec,attr); }]]:typeChips().map(c=>[c[0],()=>listPick(c[1],x=>attrAnswer(x,attr))])); return; }
    say('I did not understand that. I answer only from the atlas data, so here is what I can do:'); offer(menu()); }

  /* ---------- open and close ---------- */
  async function toggle(open){ const on=open==null?panel.hidden:open; panel.hidden=!on; launch.setAttribute('aria-expanded',String(on)); root.classList.toggle('open',on);
    if(on&&!started){ started=true; say('Loading the atlas data...');
      try{ await load(); log.innerHTML=''; const here=PAGE_ID&&DB.byId[PAGE_ID]; if(here) ctx.rec=here;
        say(`Hello, I am <b>ZAGBot</b>. I know the ${DB.recs.length} structures in the atlas and their verified values.${here?` You are on <b>${esc(here.name)}</b>.`:''} What would you like?`);
        offer(here?[['Key figures',()=>figures(here)],['What did ZAG do?',()=>role(here)],['Something is wrong',()=>startUpdate(here)],['Update the 3D model',()=>startModel(here)],['Find another structure',()=>{ say('Type its name or place.'); offer(typeChips()); input.focus(); }]]:menu()); }
      catch(_){ log.innerHTML=''; say('The atlas data could not be loaded. Please reload the page.'); } }
    if(on) setTimeout(()=>input.focus(),50); }
  launch.onclick=()=>toggle(); $('.zb-x').onclick=()=>toggle(false); $('.zb-min').onclick=()=>toggle(false); $('.zb-big').onclick=()=>root.classList.toggle('big');
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!panel.hidden) toggle(false); });
  $('.zb-in').onsubmit=e=>{ e.preventDefault(); const t=input.value; input.value=''; if(!t.trim()) return; if(ctx.flow&&ctx.flow.kind==='code'){ handle(t); return; } user(t); think(); setTimeout(()=>{ (DB.recs.length?Promise.resolve():load()).then(()=>handle(t,null,true)); },450); };
  window.ZAGBot={open:()=>toggle(true),ask:t=>{ toggle(true).then(()=>handle(t)); }};
})();
