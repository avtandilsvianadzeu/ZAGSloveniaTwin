const fs=require('fs');const R=process.argv[2],S=process.argv[3],WRITE=process.argv[4]==='write';
const T=JSON.parse(fs.readFileSync(R+'/data/twins.json','utf8'));const X=require(S+'/r/text.json');
const dec=require(S+'/scripts/rdec.js');
const key=u=>X[u]?u:(X[u.replace(/\/$/,'')]?u.replace(/\/$/,''):(X[u+'/']?u+'/':null));
const C={};const col=k=>C[k]||(C[k]=X[k].x.replace(/\s+/g,' '));
const N={
 page:'Copied from the text of the page itself, read in the browser on 12 November 2026.',
 pdf:'Copied from the text of the file itself, read on 12 November 2026.',
 wiki:'Copied from the text of the Wikipedia page, read on 12 November 2026.',
 vpage:'Checked word for word against the text of the page itself, read in the browser on 12 November 2026.',
 vpdf:'Checked word for word against the text of the file itself, read on 12 November 2026.',
 vwiki:'Checked word for word against the text of the Wikipedia page, read on 12 November 2026.',
 sq:' Only line breaks and spacing differ.',
 tpage:'Compared with the text of the page itself, read in the browser on 12 November 2026. All words and numbers of the quote are there. The page prints them as a table or a list, so the wording is joined from the cells.',
 tpdf:'Compared with the text of the file itself, read on 12 November 2026. All words and numbers of the quote are there. The file prints them as a table or across columns, so the wording is joined from the cells.',
 acc:'Compared with the text of the page itself, read in the browser on 12 November 2026. Accented letters could not be compared, all other characters match.'};
const kindOf=k=>/wikipedia\.org/.test(k)?'wiki':X[k].kind;
let n={newq:0,fail:0,ver:0,tab:0,man:0};const log=[];
for(const [id,i,res] of dec){const s=T.objects[id]&&T.objects[id].specs[i];if(!s){console.log('NO SPEC',id,i);n.fail++;continue;}
  const k=key(s.source);if(!k){console.log('NO TEXT',id,i,s.source);n.fail++;continue;}
  if(s.quote){console.log('HAS QUOTE',id,i);continue;}
  const parts=[];let ok=true;for(const re of res){const m=col(k).match(re);if(!m){console.log('NO MATCH',id,i,String(re).slice(0,70));ok=false;break;}parts.push(m[0].trim());}
  if(!ok){n.fail++;continue;}
  const q=parts.join(' … ');if(q.length>700){console.log('LONG',id,i,q.length);}
  s.quote=q;s.quote_note=N[kindOf(k)];n.newq++;log.push('['+id+'#'+i+'] '+s.label+' = '+s.value+' '+(s.unit||'')+'\n   '+q);}
// verified quotes
for(const l of require(S+'/r/lit.json')){const s=T.objects[l.id].specs[l.i];const kd=kindOf(l.src);s.quote_note=N['v'+kd]+(l.sq?N.sq:'');n.ver++;}
const tab=require(S+'/r/tab.json');
const repl={ 'verd#8':/Nekako smo zagrabili za to obljubo, ki se je potem precej razvlekla, saj se je sanacija viadukta začela šele leta 2006/,
 'che_avce#30':/The efficiency of the process is 77%, which means it is profitable to operate when the electricity generated costs 30% more\./,
 'ss_kocevje#5':/Uničenih je bilo 13 učilnic in ostrešje, zaradi vročine in gašenja pa so bile poškodovane tudi učilnice in prostori vrtca v pritličju\./,
 'vransko#15':/The first natural frequency of the bridge simulated here was 4\.33 Hz/,
 'nm_brv#21':/Montažni betonski elementi so izdelani iz betona kvalitete C45\/55, monolitni del prekladne plošče pa iz betona C50\/60\./,
 'nm_brv#24':/i Identificirane fi \[Hz\] Izračunane fi \[Hz\] Odstopanje \[%\] 1 0,659 0,658 0,2 2 0,977.*?18 7,837 7,654 2,3 Preglednica 2\. Primerjava lastnih frekvenc izdelanega računskega modela in izmerjenih lastnih frekvenc na izvedeni konstrukciji/,
 'he_solkan#9':[/Gradbena dela za HE Solkan so se pričela leta 1978, v pogonu pa je od 15\. novembra 1984\./,/rekonstrukcija je predvidena po letu 2025\./]};
const done=new Set();
for(const [kk,re] of Object.entries(repl)){const [id,i]=kk.split('#');const s=T.objects[id].specs[+i];const k=key(s.source);const res=Array.isArray(re)?re:[re];const parts=[];for(const r of res){const m=col(k).match(r);if(!m){console.log('REPL NO MATCH',kk);parts.length=0;break;}parts.push(m[0].trim());}
  if(parts.length){log.push('REPL ['+kk+'] '+s.label+' = '+s.value+'\n   OLD '+s.quote+'\n   NEW '+parts.join(' … '));s.quote=parts.join(' … ');s.quote_note=N[kindOf(k)];n.man++;done.add(kk);}}
for(const t of tab.tab){const kk=t.id+'#'+t.i;if(done.has(kk))continue;const s=T.objects[t.id].specs[t.i];s.quote_note=N['t'+(t.kind==='pdf'?'pdf':'page')];n.tab++;}
for(const t of tab.rest){const kk=t.id+'#'+t.i;if(done.has(kk))continue;const s=T.objects[t.id].specs[t.i];
  if(/remontees-mecaniques/.test(t.src)){s.quote_note=N.acc;n.tab++;}
  else if(t.id==='lescevje'){s.quote_note=N.tpage;n.tab++;}
  else if(kk==='slano_blato#11'){s.quote_note=N.vpdf+N.sq;n.ver++;}
  else console.log('LEFT',kk);}
console.log(n);fs.writeFileSync(S+'/r/applied.txt',log.join('\n'));
if(WRITE){fs.writeFileSync(R+'/data/twins.json',JSON.stringify(T));console.log('written');}
