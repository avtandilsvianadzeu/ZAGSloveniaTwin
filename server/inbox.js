/* DigitalZAG object inbox: a Cloudflare Worker (free plan).
   Colleagues send the objects they drew on the Add object page. Nothing is published until the owner approves it.

   Who can use it: the Worker sits behind Cloudflare Access. Access asks for an address ending in @zag.si and sends a one-time
   code to it; this Worker never sends email. Every request carries the signed Access token, which is checked here as well.
   Only OWNER_EMAIL may review.

   Pages and calls:
     GET  /submit        page that shows the object handed over from the Add object page and sends it
     POST /api/submit    keeps the object in a private queue (Workers KV), with the sender's address and the time
     GET  /review        owner only: the queue, with Approve and Reject
     POST /api/review    owner only: {key, action: "approve"|"reject"}. Approve writes the object to data/user_objects.json
                         in the public repository, marked as not verified, without the sender's address. Reject deletes it.

   Settings (wrangler.toml [vars]): ACCESS_TEAM (the team name in <team>.cloudflareaccess.com), ACCESS_AUD (the Application
   Audience tag of the Access application), OWNER_EMAIL, REPO (owner/name), SITE (address of the public site).
   Secret: GITHUB_TOKEN, a fine-grained token for that one repository with Contents read and write. Binding: QUEUE (Workers KV). */

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const html = (b, s = 200) => new Response(b, { status: s, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:" } });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));

/* ---------- the Cloudflare Access token: signature, audience, expiry, and an address at zag.si ---------- */
let CERTS = null, CERTS_AT = 0;
async function who(req, env) {
  const tok = req.headers.get('cf-access-jwt-assertion'); if (!tok) return null;
  const [h, p, s] = tok.split('.'); if (!h || !p || !s) return null;
  const head = JSON.parse(new TextDecoder().decode(b64u(h))), body = JSON.parse(new TextDecoder().decode(b64u(p)));
  if (Date.now() - CERTS_AT > 3600e3 || !CERTS) { const r = await fetch(`https://${env.ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`); CERTS = (await r.json()).keys || []; CERTS_AT = Date.now(); }
  const jwk = CERTS.find(k => k.kid === head.kid); if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(h + '.' + p)); if (!ok) return null;
  const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (!aud.includes(env.ACCESS_AUD) || !body.exp || body.exp * 1000 < Date.now()) return null;
  const email = String(body.email || '').toLowerCase();
  return /^[^@\s]+@zag\.si$/.test(email) ? email : null;
}

/* ---------- what an object may contain: the fields the Add object page writes, nothing else ---------- */
const TYPES = new Set(['bridge', 'footbridge', 'road structure', 'tunnel', 'dam / hydropower', 'cableway', 'tower / mast', 'building', 'landslide', 'geotechnical site', 'other']);
const txt = (v, n) => v == null ? null : String(v).replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n) || null;
const num = v => (v == null || v === '') ? null : (isFinite(+v) && +v >= 0 && +v < 1e5 ? Math.round(+v * 10) / 10 : null);
const inSI = c => Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1]) && c[0] > 13.2 && c[0] < 16.8 && c[1] > 45.3 && c[1] < 47;
function clean(f) {
  const p = f && f.properties; if (!p) throw new Error('No object was handed over.');
  const name = txt(p.name, 140); if (!name) throw new Error('The object has no name.');
  const lon = +p.longitude, lat = +p.latitude; if (!inSI([lon, lat])) throw new Error('The position is outside Slovenia.');
  const type = TYPES.has(p.object_type) ? p.object_type : 'other';
  const src = (p.sources || []).map(s => String(s && s.url || '')).find(u => /^https:\/\/[^\s"<>]{4,400}$/.test(u));
  const u = p.user || {}, line = Array.isArray(p.lines) && p.lines[0], poly = Array.isArray(u.polygon) && u.polygon;
  const pts = a => Array.isArray(a) && a.length <= 400 && a.every(inSI) ? a.map(c => [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6]) : null;
  const id = 'user_' + name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) + '_' + Date.now().toString(36);
  const out = { id, category: 'user_object', name, name_en: name, name_sl: null, object_type: type, description: txt(p.description, 1200), locality: '', municipality: '',
    latitude: Math.round(lat * 1e6) / 1e6, longitude: Math.round(lon * 1e6) / 1e6, year: null, zag_role: null, zag_involvement_types: [],
    sources: src ? [{ key: 'user', title: 'Source given by the colleague', url: src, type: 'web' }] : [], evidence_level: 'user', position_precision: 'user', structure: {},
    created: new Date().toISOString(), user: { length: num(u.length), width: num(u.width), height: num(u.height) } };
  const L = pts(line); if (L && L.length > 1) { out.lines = [L]; out.line_labels = [name]; }
  const P = pts(poly); if (P && P.length > 3) out.user.polygon = P;
  return { type: 'Feature', properties: out, geometry: { type: 'Point', coordinates: [out.longitude, out.latitude] } };
}

/* ---------- the public repository: data/user_objects.json, one commit per approved object ---------- */
async function publish(env, feature) {
  const api = `https://api.github.com/repos/${env.REPO}/contents/data/user_objects.json`;
  const H = { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'DigitalZAG inbox', 'x-github-api-version': '2022-11-28' };
  const cur = await fetch(api, { headers: H }); if (!cur.ok) throw new Error('The map file could not be read (' + cur.status + ').');
  const j = await cur.json(), fc = JSON.parse(new TextDecoder().decode(b64u(j.content.replace(/\n/g, ''))));
  fc.features = (fc.features || []).filter(x => x.properties.id !== feature.properties.id); fc.features.push(feature);
  const bytes = new TextEncoder().encode(JSON.stringify(fc, null, 1) + '\n'); let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  const put = await fetch(api, { method: 'PUT', headers: H, body: JSON.stringify({ message: `Add ${feature.properties.name}, sent by a ZAG colleague, not verified`, content: btoa(bin), sha: j.sha,
    committer: { name: 'avtandilsvianadzeu', email: env.OWNER_EMAIL } }) });
  if (!put.ok) throw new Error('The map file could not be saved (' + put.status + ').');
}

/* ---------- pages: plain, bright, in the colours of the atlas ---------- */
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}, DigitalZAG</title>
<style>:root{--fg:#1D1D1F;--mut:#5F5F64;--acc:#0A5BC4;--line:rgba(33,52,105,.14)}*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:var(--fg);background:linear-gradient(160deg,#EEF4FC,#E2ECF9);min-height:100vh;padding:32px 16px}
main{max-width:720px;margin:0 auto;background:rgba(255,255,255,.92);border-radius:20px;padding:24px;box-shadow:inset 1px 1px 0 #fff,0 0 0 .5px var(--line),0 10px 30px rgba(16,40,90,.1)}
h1{font-size:24px;margin:0 0 6px}p{margin:8px 0}.mut{color:var(--mut)}dl{display:grid;grid-template-columns:150px 1fr;gap:6px 12px;margin:16px 0}dt{color:var(--mut)}dd{margin:0;overflow-wrap:anywhere}
button{font:inherit;border:0;border-radius:999px;padding:9px 18px;background:var(--acc);color:#fff;cursor:pointer}button.alt{background:#fff;color:var(--fg);box-shadow:0 0 0 .5px var(--line)}button:disabled{opacity:.5}
.it{border-top:1px solid var(--line);padding:14px 0}.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.ok{color:#1A7F37}.bad{color:#B42318}a{color:var(--acc)}</style></head><body><main>${body}</main></body></html>`;

const SUBMIT = (email, site) => page('Send an object', `<h1>Send an object to the ZAG map</h1><p class="mut">Signed in as ${esc(email)}. The object is checked by the DigitalZAG team before it appears on the map, where it is marked as not verified until a source confirms it. Your address is not published.</p>
<div id="box"><p>Reading the object.</p></div><p id="msg" role="status"></p>
<script>
const box=document.getElementById('box'), msg=document.getElementById('msg'); let f=null;
try{ const s=location.hash.slice(1); f=JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))))); }catch(_){}
const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
if(!f||!f.properties){ box.innerHTML='<p class="bad">No object was handed over. Open the Add object page, save the object, then press Send to the ZAG map.</p><p><a href="${esc(site)}add.html">Open the Add object page</a></p>'; }
else{ const p=f.properties, u=p.user||{};
  box.innerHTML='<dl><dt>Name</dt><dd>'+e(p.name)+'</dd><dt>Type</dt><dd>'+e(p.object_type)+'</dd><dt>Position</dt><dd>'+(+p.latitude).toFixed(6)+', '+(+p.longitude).toFixed(6)+'</dd><dt>Description</dt><dd>'+e(p.description||'none')+'</dd><dt>Source</dt><dd>'+e(((p.sources||[])[0]||{}).url||'none')+'</dd><dt>Length, width, height</dt><dd>'+[u.length,u.width,u.height].map(x=>x==null?'not given':x+' m').join(', ')+'</dd></dl><div class="row"><button id="go">Send to the ZAG map</button></div>';
  document.getElementById('go').onclick=async ev=>{ ev.target.disabled=true; msg.textContent='Sending.';
    try{ const r=await fetch('/api/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f)}); const j=await r.json(); if(!r.ok) throw new Error(j.error||r.status);
      msg.className='ok'; msg.textContent='Sent. Thank you. The object appears on the map once the DigitalZAG team has checked it.'; history.replaceState(null,'',location.pathname); }
    catch(err){ ev.target.disabled=false; msg.className='bad'; msg.textContent='It could not be sent: '+err.message; } }; }
</script>`);

const REVIEW = list => page('Objects to review', `<h1>Objects to review</h1><p class="mut">${list.length ? list.length + ' waiting. Approve publishes the object on the public map as not verified, without the sender\'s address. Reject deletes it.' : 'Nothing is waiting.'}</p>
${list.map(x => { const p = x.f.properties, u = p.user || {}; return `<div class="it" data-k="${esc(x.key)}"><b>${esc(p.name)}</b> <span class="mut">${esc(p.object_type)}, sent by ${esc(x.email)} on ${esc(x.at.slice(0, 10))}</span>
<p>${esc(p.description || 'No description.')}</p><p class="mut">Position ${p.latitude}, ${p.longitude}. Source: ${p.sources[0] ? `<a href="${esc(p.sources[0].url)}" target="_blank" rel="noopener">${esc(p.sources[0].url)}</a>` : 'none'}. Length ${u.length ?? 'not given'}, width ${u.width ?? 'not given'}, height ${u.height ?? 'not given'}.</p>
<p class="mut"><a href="https://www.openstreetmap.org/?mlat=${p.latitude}&amp;mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}" target="_blank" rel="noopener">See the position on OpenStreetMap</a></p>
<div class="row"><button data-a="approve">Approve and publish</button><button class="alt" data-a="reject">Reject</button></div><p class="st" role="status"></p></div>`; }).join('')}
<script>document.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{ const it=b.closest('.it'), st=it.querySelector('.st'); it.querySelectorAll('button').forEach(x=>x.disabled=true); st.textContent='Working.';
  try{ const r=await fetch('/api/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:it.dataset.k,action:b.dataset.a})}); const j=await r.json(); if(!r.ok) throw new Error(j.error||r.status);
    st.className='st ok'; st.textContent=b.dataset.a==='approve'?'Published. The site shows it within a few minutes.':'Rejected and deleted.'; }
  catch(e){ st.className='st bad'; st.textContent='Not done: '+e.message; it.querySelectorAll('button').forEach(x=>x.disabled=false); } });</script>`);

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/';
    const email = await who(req, env).catch(() => null);
    if (!email) return html(page('Sign in', '<h1>Sign in with your ZAG address</h1><p>This page is only for ZAG colleagues. Open it again and sign in with your address ending in @zag.si.</p>'), 403);
    const owner = email === String(env.OWNER_EMAIL || '').toLowerCase();

    if (path === '/' || path === '/submit') return html(SUBMIT(email, env.SITE));

    if (path === '/api/submit' && req.method === 'POST') {
      const day = new Date().toISOString().slice(0, 10), cnt = `count:${email}:${day}`, n = +(await env.QUEUE.get(cnt) || 0);
      if (n >= 20) return json({ error: 'Twenty objects a day is the limit. Please send the rest tomorrow.' }, 429);
      let f; try { const raw = await req.text(); if (raw.length > 200e3) throw new Error('The object is too large.'); f = clean(JSON.parse(raw)); } catch (e) { return json({ error: e.message }, 400); }
      const key = `sub:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;
      await env.QUEUE.put(key, JSON.stringify({ f, email, at: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 90 });
      await env.QUEUE.put(cnt, String(n + 1), { expirationTtl: 60 * 60 * 26 });
      return json({ ok: true });
    }

    if (path === '/review' && owner) {
      const keys = (await env.QUEUE.list({ prefix: 'sub:' })).keys, list = [];
      for (const k of keys) { const v = await env.QUEUE.get(k.name); if (v) list.push({ key: k.name, ...JSON.parse(v) }); }
      return html(REVIEW(list));
    }

    if (path === '/api/review' && req.method === 'POST' && owner) {
      let b; try { b = await req.json(); } catch (_) { return json({ error: 'Bad request.' }, 400); }
      if (!/^sub:\d+:[0-9a-f]{8}$/.test(b.key || '')) return json({ error: 'Unknown object.' }, 400);
      const v = await env.QUEUE.get(b.key); if (!v) return json({ error: 'It is no longer in the queue.' }, 404);
      if (b.action === 'approve') { try { await publish(env, JSON.parse(v).f); } catch (e) { return json({ error: e.message }, 502); } }
      else if (b.action !== 'reject') return json({ error: 'Unknown action.' }, 400);
      await env.QUEUE.delete(b.key); return json({ ok: true });
    }

    if (path === '/review' || path === '/api/review') return html(page('Owner only', '<h1>Only the owner can review</h1><p>Thank you for helping. The DigitalZAG team reviews the objects that colleagues send.</p>'), 403);
    return json({ error: 'Not found.' }, 404);
  }
};
