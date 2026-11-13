/* ZAG Digital Atlas, request inbox. A small Cloudflare Worker (free plan is enough) that lets visitors send a ZAGBOT request
   without a GitHub account. It turns each request into a GitHub issue, using a token that only the Worker knows.

   Settings (Cloudflare dashboard, Worker, Settings, Variables and Secrets):
     GH_TOKEN        secret    fine grained GitHub token, only this repository, permission "Issues: Read and write"
     OWNER_CODE      secret    a passphrase you choose. Typed once in ZAGBOT, it marks your own requests and lets you approve others
     ALLOWED_ORIGIN  variable  https://avtandilsvianadzeu.github.io
     REPO            variable  optional, default avtandilsvianadzeu/ZAGSloveniaTwin
     DAILY_LIMIT     variable  optional, requests per day from visitors, default 40

   Visitor requests become issues titled "Request: ..." and wait. Requests sent with the owner code are titled "ZAGBOT: ..."
   and run at once. The owner approves a waiting request from the chat, which comments /zagbot on it and starts the run.
   Nothing else is stored. */

const API = 'https://api.github.com';
const json = (o, s, h) => new Response(JSON.stringify(o), { status: s || 200, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, h || {}) });
function cors(req, env) {
  const origin = req.headers.get('origin') || '', ok = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).includes(origin);
  return { ok, h: ok ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type, x-owner-code', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400', vary: 'origin' } : {} };
}
function same(a, b) { a = String(a || ''); b = String(b || ''); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0 && a.length > 0; }
/* best effort limits, kept in the memory of one Worker instance */
const hits = new Map(); let day = '', count = 0;
function limited(ip, env) {
  const now = Date.now(), d = new Date(now).toISOString().slice(0, 10);
  if (d !== day) { day = d; count = 0; hits.clear(); }
  if (count >= (parseInt(env.DAILY_LIMIT, 10) || 40)) return 'Many requests arrived today. Please try again tomorrow.';
  const l = (hits.get(ip) || []).filter(t => now - t < 600000);
  if (l.length >= 3) return 'You sent several requests just now. Please wait a few minutes.';
  l.push(now); hits.set(ip, l); count++; return null;
}
const clean = (s, max) => String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').replace(/@(?=\w)/g, '@​').slice(0, max).trim();
async function gh(env, path, method, body) {
  const r = await fetch(API + path, { method: method || 'GET', headers: { authorization: 'Bearer ' + env.GH_TOKEN, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'zag-atlas-inbox', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) {}
  return { ok: r.ok, status: r.status, j };
}

export default {
  async fetch(req, env) {
    const c = cors(req, env), url = new URL(req.url), repo = env.REPO || 'avtandilsvianadzeu/ZAGSloveniaTwin';
    if (req.method === 'OPTIONS') return new Response(null, { status: c.ok ? 204 : 403, headers: c.h });
    if (url.pathname === '/' && req.method === 'GET') return json({ service: 'ZAG Digital Atlas request inbox', ready: !!(env.GH_TOKEN && env.OWNER_CODE && env.ALLOWED_ORIGIN) });
    if (!c.ok) return json({ error: 'This site may not use the inbox.' }, 403);
    if (!env.GH_TOKEN) return json({ error: 'The inbox is not set up yet.' }, 503, c.h);
    const owner = same(req.headers.get('x-owner-code'), env.OWNER_CODE);

    if (url.pathname === '/owner' && req.method === 'POST') return json({ owner }, owner ? 200 : 401, c.h);

    if (url.pathname === '/request' && req.method === 'POST') {
      let b; try { b = await req.json(); } catch (_) { return json({ error: 'The request could not be read.' }, 400, c.h); }
      if (b.website) return json({ ok: true }, 200, c.h);                       // hidden field filled in: a robot, ignore quietly
      if (!owner) { const lim = limited(req.headers.get('cf-connecting-ip') || 'x', env); if (lim) return json({ error: lim }, 429, c.h); }
      const subject = clean(b.subject, 120), body = clean(b.body, 6000);
      if (subject.length < 3 || body.length < 10) return json({ error: 'The request is empty.' }, 400, c.h);
      const r = await gh(env, `/repos/${repo}/issues`, 'POST', { title: (owner ? 'ZAGBOT: ' : 'Request: ') + subject, body: body + '\n\n' + (owner ? 'Sent by the atlas owner from the site.' : 'Sent by a visitor from the site. It runs after the owner approves it.'), labels: ['from-site'] });
      if (!r.ok) return json({ error: 'GitHub did not accept the request (' + r.status + ').' }, 502, c.h);
      return json({ ok: true, number: r.j.number, url: r.j.html_url, runs: owner }, 200, c.h);
    }

    if (url.pathname === '/pending' && req.method === 'GET') {
      if (!owner) return json({ error: 'Only the owner can see this.' }, 401, c.h);
      const r = await gh(env, `/repos/${repo}/issues?state=open&labels=from-site&per_page=30`);
      if (!r.ok) return json({ error: 'GitHub could not be read (' + r.status + ').' }, 502, c.h);
      return json({ items: (r.j || []).filter(i => /^Request: /.test(i.title)).map(i => ({ number: i.number, title: i.title.replace(/^Request: /, ''), url: i.html_url, created: i.created_at })) }, 200, c.h);
    }

    if (url.pathname === '/approve' && req.method === 'POST') {
      if (!owner) return json({ error: 'Only the owner can approve.' }, 401, c.h);
      let b; try { b = await req.json(); } catch (_) { b = {}; }
      const n = parseInt(b.number, 10); if (!n) return json({ error: 'No request number.' }, 400, c.h);
      const act = b.action === 'reject' ? 'reject' : 'run';
      if (act === 'run') { const r = await gh(env, `/repos/${repo}/issues/${n}/comments`, 'POST', { body: '/zagbot' }); if (!r.ok) return json({ error: 'GitHub did not accept it (' + r.status + ').' }, 502, c.h); }
      else { await gh(env, `/repos/${repo}/issues/${n}/comments`, 'POST', { body: 'Not taken up.' }); await gh(env, `/repos/${repo}/issues/${n}`, 'PATCH', { state: 'closed', state_reason: 'not_planned' }); }
      return json({ ok: true }, 200, c.h);
    }
    return json({ error: 'Not found.' }, 404, c.h);
  }
};
