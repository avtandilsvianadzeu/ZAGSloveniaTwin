// find literal passages for quotes that are not word for word, and candidates for values without a quote
const fs=require('fs');const R=process.argv[2],S=process.argv[3];
const X=require(S+"/r/text.json");const miss=require(S+"/r/miss.json"),noq=require(S+"/r/noq.json");
const norm=s=>s.toLowerCase().normalize('NFKC').replace(/[­​]/g,'').replace(/[‘’`´]/g,"'").replace(/[“”„]/g,'"').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const units=t=>{const out=[];for(const line of t.split(/\n+/)){const l=line.replace(/\s+/g,' ').trim();if(!l)continue;if(l.length<260){out.push(l);continue;}
  const parts=l.split(/(?<=[.!?])\s+(?=[A-ZČŠŽ0-9"(])/);for(const p of parts)if(p.trim())out.push(p.trim());}return out;};
const U={};const getU=k=>U[k]||(U[k]=units(X[k].x));
const toks=s=>norm(s).split(/[^a-z0-9čšžćđäöüéèàáíóú]+/).filter(w=>w.length>1);
function numPats(value){const out=[];const m=String(value).match(/\d[\d.,  ]*\d|\d/g)||[];for(let n of m){n=n.replace(/[  ]/g,'');
  let intp=n,dec='';const mm=n.match(/^(.*)[.,](\d{1,2})$/);if(mm&&!/^\d{1,3}([.,]\d{3})+$/.test(n)){intp=mm[1];dec=mm[2];}
  intp=intp.replace(/[.,]/g,'');if(!intp)continue;
  let g=intp.length>3?intp.replace(/\B(?=(\d{3})+(?!\d))/g,'[.,\\u00a0 ]?'):intp;
  out.push(new RegExp('(?<![\\d])'+g+(dec?'[.,]'+dec.replace(/0+$/,'')+'0*':'(?:[.,]0+)?')+'(?![\\d])'));}return out;}
function best(k,qtok,pats,extraTok){const u=getU(k);let b=null;const qs=new Set(qtok);
  for(let i=0;i<u.length;i++){let w='';for(let j=i;j<Math.min(u.length,i+3);j++){w=w?w+' '+u[j]:u[j];if(w.length>520)break;
    const wt=toks(w);if(!wt.length)continue;const ws=new Set(wt);let hit=0;for(const t of qs)if(ws.has(t))hit++;
    const rec=qs.size?hit/qs.size:0,prec=hit/ws.size;const nums=pats.filter(p=>p.test(w)).length;
    let ex=0;for(const t of extraTok||[])if(ws.has(t))ex++;
    const score=rec*2+prec+nums*(pats.length?1.5/pats.length:0)+ex*0.3-w.length/3000;
    if(!b||score>b.score)b={score,rec,prec,nums,np:pats.length,w,i,j};}}
  return b;}
const fixed=[],review=[];
for(const m of miss){const pats=numPats(m.value);const b=best(m.src,toks(m.quote),pats,[]);
  if(b&&b.rec>=0.8&&b.nums===b.np&&b.w.length<=560)fixed.push({...m,newq:b.w,rec:+b.rec.toFixed(2)});else review.push({...m,cand:b&&b.w,rec:b&&+b.rec.toFixed(2),nums:b&&b.nums+'/'+b.np});}
const cand=[];
for(const m of noq){const pats=numPats(m.value);const lt=toks(m.label+' '+String(m.value).replace(/\d+/g,' '));const b=best(m.src,lt,pats,[]);
  cand.push({...m,cand:b&&b.w,nums:b&&b.nums+'/'+b.np,rec:b&&+b.rec.toFixed(2)});}
fs.writeFileSync(S+'/r/fixed.json',JSON.stringify(fixed,null,1));fs.writeFileSync(S+'/r/review.json',JSON.stringify(review,null,1));fs.writeFileSync(S+'/r/cand.json',JSON.stringify(cand,null,1));
console.log('fixed',fixed.length,'review',review.length,'cand',cand.length,'cand with all numbers',cand.filter(c=>c.nums&&c.nums.split('/')[0]===c.nums.split('/')[1]&&c.nums!=='0/0').length);
