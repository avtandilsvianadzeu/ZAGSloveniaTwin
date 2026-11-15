#!/usr/bin/env node
/* Partner radar: reads the public website of each ZAG project partner once a day and records what points to a
   possible new collaboration, above all in artificial intelligence. Writes data/partners.json.
   What is read: the home page and up to two linked pages about research, AI or innovation, at most 1.5 MB each.
   What is stored: page title, description, the AI and infrastructure topics found with the page they were found on,
   the contact page link and only generic institutional addresses (info@, office@, contact@ and similar).
   Personal names and personal e-mail addresses are never stored. A site whose robots.txt disallows everything is skipped.
   Run: node tools/fetch_partners.mjs   (Node 18 or newer, no packages) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/partners_base.json'), 'utf8')).items;
const OUT = path.join(ROOT, 'data/partners.json');
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { items: [] };
const prevBy = Object.fromEntries((prev.items || []).map(i => [i.key, i]));
const UA = 'Mozilla/5.0 (compatible; DigitalZAG partner radar; +https://avtandilsvianadzeu.github.io/ZAGSloveniaTwin/value.html)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AI = [
  ['artificial intelligence', /artificial intelligence/i],
  ['AI', /\bAI\b(?=[ -](and|for|in|research|lab|methods|models|tools|solutions|systems|technologies|applications|based|driven|powered))/],
  ['machine learning', /machine learning|maschinelles lernen|apprendimento automatico|aprendizaje autom[aá]tico|apprentissage automatique|strojn\w* u[cč]enj/i],
  ['deep learning', /deep learning|neural network|neuronsk\w* mre[zž]/i],
  ['computer vision', /computer vision|image recognition|ra[cč]unalni[sš]k\w* vid/i],
  ['digital twin', /digital twins?|digitaln\w* dvoj[cč]k|digitaler zwilling|gemello digitale|gemelo digital|jumeau num[eé]rique/i],
  ['data science', /data science|big data|data analytics|podatkovn\w* znanost/i],
  ['AI (local language)', /umetn\w* inteligenc|k[uü]nstliche intelligenz|intelligenza artificiale|inteligencia artificial|intelligence artificielle|sztuczn\w* inteligencj|umělá inteligence|mesterséges intelligencia/i],
  ['language models', /large language model|\bLLMs?\b|generative AI|generativn\w* umetn/i]];
const INFRA = [
  ['structural health monitoring', /structural health monitoring|\bSHM\b|monitoring of (bridges|structures)/i],
  ['bridges', /\bbridges?\b|\bmostov\w*|br[uü]cken|\bponti\b|\bpuentes?\b|\bponts?\b/i],
  ['weigh-in-motion', /weigh[- ]in[- ]motion|\bB?-?WIM\b/],
  ['BIM', /\bBIM\b|building information model/],
  ['construction materials', /construction materials|gradbeni\w* materiali|baustoffe|concrete|beton\b/i],
  ['earthquake engineering', /earthquake|seismic|potres|erdbeben|sism/i],
  ['railways', /railway|[zž]elezni[sš]k|eisenbahn|ferrovi/i]];
const GENERIC = /^(info|office|contact|kontakt|contacto|contatti|press|media|pr|tajnistvo|secretariat|sekretariat|research|innovation|reception|mail|general|communication|communications|hello|enquiries|inquiries|post|admin|office\.\w+|info\.\w+)$/i;
const LINKS = /(research|artificial|\bai\b|digital|innovation|projects?|raziskav|forschung|ricerca|investigaci|recherche|innovazion)/i;
const CONTACT = /(contact|kontakt|contatti|contacto|impressum)/i;

async function get(url, max = 1.5e6) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
  try { const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en,sl;q=0.8' }, redirect: 'follow', signal: ac.signal });
    if (!r.ok || !/html|xml|text/.test(r.headers.get('content-type') || '')) return null;
    const b = await r.arrayBuffer(); return { url: r.url, html: Buffer.from(b.slice(0, max)).toString('utf8') }; }
  catch (_) { return null; } finally { clearTimeout(t); } }
const text = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const meta = (h, n) => ((h.match(new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]*content=["']([^"']*)`, 'i')) || [])[1] || '').trim();
const title = h => ((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
const links = (h, base) => [...h.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => { try { return { href: new URL(m[1], base).href, label: text(m[2]).trim().slice(0, 80) }; } catch (_) { return null; } }).filter(Boolean);
async function robotsOk(site) { const r = await get(new URL('/robots.txt', site).href, 2e5); if (!r) return true;
  const lines = r.html.split(/\r?\n/).map(l => l.trim()); let star = false;
  for (const l of lines) { if (/^user-agent:\s*\*/i.test(l)) star = true; else if (/^user-agent:/i.test(l)) star = false; else if (star && /^disallow:\s*\/\s*$/i.test(l)) return false; }
  return true; }

const items = [];
for (const b of BASE) {
  const base = { key: b.key, name: b.name, country: b.country, city: b.city, website: b.website, lat: b.lat, lon: b.lon, projects: b.projects, last: b.last };
  if (!b.website) { items.push({ ...base, status: 'no website listed' }); continue; }
  try {
    if (!(await robotsOk(b.website))) { items.push({ ...base, status: 'site asks robots not to read it' }); continue; }
    const home = await get(b.website);
    if (!home) { const p = prevBy[b.key]; items.push(p && p.checked ? { ...p, ...base, status: 'not reachable today, last good reading kept' } : { ...base, status: 'not reachable' }); await sleep(800); continue; }
    const host = new URL(home.url).host.replace(/^www\./, '');
    const L = links(home.html, home.url).filter(l => new URL(l.href).host.replace(/^www\./, '') === host);
    const extra = [...new Map(L.filter(l => LINKS.test(l.href + ' ' + l.label)).map(l => [l.href, l])).values()].slice(0, 2);
    const pages = [{ url: home.url, html: home.html }];
    for (const l of extra) { await sleep(600); const p = await get(l.href); if (p) pages.push(p); }
    const found = (rules) => { const out = []; for (const [k, re] of rules) { const pg = pages.find(p => re.test(text(p.html))); if (pg) out.push({ topic: k, page: pg.url }); } return out; };
    const contact = (L.find(l => CONTACT.test(l.href + ' ' + l.label)) || {}).href || null;
    const emails = [...new Set(pages.flatMap(p => [...p.html.matchAll(/(?:mailto:)?([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[a-z]{2,})/g)].map(m => [m[1], m[2].toLowerCase()])).filter(([u, d]) => GENERIC.test(u) && d.endsWith(host.split('.').slice(-2).join('.'))).map(([u, d]) => (u + '@' + d).toLowerCase()))].slice(0, 3);
    const ai = found(AI), infra = found(INFRA);
    items.push({ ...base, status: 'read', checked: new Date().toISOString(), title: title(home.html).slice(0, 140), description: (meta(home.html, 'description') || meta(home.html, 'og:description')).slice(0, 240), ai, infra, contact, emails, pages: pages.map(p => p.url) });
  } catch (e) { items.push({ ...base, status: 'error: ' + e.message.slice(0, 60) }); }
  await sleep(800);
}
/* collaboration signal: an existing relationship, how recent it is, and what the partner works on now */
const now = new Date().getFullYear();
for (const i of items) { const n = (i.projects || []).length, recent = i.last && i.last >= now - 4, aiN = (i.ai || []).length, infN = (i.infra || []).length;
  i.score = Math.min(n, 5) * 2 + (recent ? 3 : 0) + Math.min(aiN, 4) * 2 + Math.min(infN, 3);
  i.reasons = [n ? `${n} shared project${n > 1 ? 's' : ''} with ZAG` : null, recent ? `Latest shared project runs to ${i.last}` : null, aiN ? `AI topics on its website: ${i.ai.map(a => a.topic).join(', ')}` : null, infN ? `Works on ${i.infra.map(a => a.topic).join(', ')}` : null].filter(Boolean); }
items.sort((a, b) => b.score - a.score);
const read = items.filter(i => i.status === 'read' || /kept/.test(i.status)).length, ai = items.filter(i => (i.ai || []).length).length;
fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), about: 'Public websites of ZAG project partners, read once a day. Topics found, contact page and generic institutional addresses only.', counts: { partners: items.length, read, ai }, items }, null, 1) + '\n');
console.log(`partners: ${items.length}, read: ${read}, with AI topics: ${ai}`);
