const fs=require('fs');const S=process.argv[2];const X=require(S+"/r/text.json");const miss=require(S+"/r/miss.json");
const fold=s=>s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^\x20-\x7e\n]/g,' ');
const tk=s=>fold(s).split(/[^a-z0-9,.]+/).map(w=>w.replace(/^[.,]+|[.,]+$/g,'')).filter(w=>w.length>1||/\d/.test(w));
const FX={};const out={tab:[],rest:[]};
for(const m of miss){const t=FX[m.src]||(FX[m.src]=fold(X[m.src].x).replace(/\s+/g,' '));
  const q=[...new Set(tk(m.quote.replace(/\|/g,' ')))].filter(w=>!/^(slo)$/.test(w));
  // positions of each token
  const pos=q.map(w=>{const a=[];let i=-1;const re=new RegExp('(?<![a-z0-9])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![a-z0-9])','g');let mm;while((mm=re.exec(t))&&a.length<400)a.push(mm.index);return a;});
  let ok=false,span=null;
  if(pos.every(a=>a.length)){ // smallest window: iterate over rarest token positions
    const r=pos.map((a,i)=>[a.length,i]).sort((x,y)=>x[0]-y[0])[0][1];
    for(const p of pos[r]){let lo=p,hi=p,good=true;for(const a of pos){let bestd=1e9,bp=null;for(const x of a){const d=Math.abs(x-p);if(d<bestd){bestd=d;bp=x;}}if(bestd>450){good=false;break;}lo=Math.min(lo,bp);hi=Math.max(hi,bp);}
      if(good&&(!span||hi-lo<span[1]-span[0])){span=[lo,hi];ok=true;}}}
  const missing=q.filter((w,i)=>!pos[i].length);
  (ok?out.tab:out.rest).push({id:m.id,i:m.i,kind:X[m.src].kind,span:span&&span[1]-span[0],missing,label:m.label,value:m.value,quote:m.quote,src:m.src});}
fs.writeFileSync(S+'/r/tab.json',JSON.stringify(out,null,1));console.log('tab',out.tab.length,'rest',out.rest.length);
for(const x of out.rest)console.log('['+x.id+'#'+x.i+'] '+x.label+' | missing: '+x.missing.join(' ')+' | '+x.quote.slice(0,120));
