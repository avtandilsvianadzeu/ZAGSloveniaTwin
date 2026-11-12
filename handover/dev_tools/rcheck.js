const T=require(process.argv[2]+"/data/twins.json");const X=require(process.argv[3]+"/r/text.json");
const norm=s=>s.toLowerCase().normalize('NFKC').replace(/[­​]/g,'').replace(/[‘’`´]/g,"'").replace(/[“”„]/g,'"').replace(/[‐‑‒–—−]/g,'-').replace(/\s+/g,' ').trim();
const sq=s=>s.replace(/[\s\-|]+/g,'');const NX={},SX={};for(const [u,v] of Object.entries(X)){NX[u]=norm(v.x);SX[u]=sq(NX[u]);}
const key=u=>X[u]?u:(X[u.replace(/\/$/,'')]?u.replace(/\/$/,''):(X[u+'/']?u+'/':null));
let st={have:0,lit:0,miss:0,noq_have:0,noq_nohave:0,q_nohave:0};const miss=[],noq=[],nohost={},lit=[];
for(const [id,o] of Object.entries(T.objects))for(const [i,s] of (o.specs||[]).entries()){
  const k=s.source&&key(s.source);
  if(s.quote){ if(!k){st.q_nohave++;continue;} st.have++; const q=norm(s.quote).replace(/\s*\.\.\.\s*|\s*…\s*/g,'\u0001');
    const parts=q.split('\u0001').filter(p=>p.length>3); const ok=parts.length&&parts.every(p=>NX[k].includes(p));
    const ok2=!ok&&parts.length&&parts.every(p=>sq(p).length>5&&SX[k].includes(sq(p)));
    if(ok||ok2){st.lit++;if(ok2)st.sq=(st.sq||0)+1;lit.push({id,i,src:k,sq:!!ok2,kind:X[k].kind});} else {st.miss++;miss.push({id,i,label:s.label,value:s.value,unit:s.unit,quote:s.quote,note:s.quote_note,src:k});}}
  else if(!s.basis){ if(k){st.noq_have++;noq.push({id,i,label:s.label,value:s.value,unit:s.unit,src:k});} else {st.noq_nohave++; let h='none';try{h=new URL(s.source).host}catch(e){} nohost[h]=(nohost[h]||0)+1;}}
}
console.log(st);console.log(nohost);
require('fs').writeFileSync(process.argv[3]+'/r/lit.json',JSON.stringify(lit));require('fs').writeFileSync(process.argv[3]+'/r/miss.json',JSON.stringify(miss,null,1));require('fs').writeFileSync(process.argv[3]+'/r/noq.json',JSON.stringify(noq,null,1));
