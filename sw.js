/* DigitalZAG offline layer.
   After one visit with a connection, every page, the atlas data, ZAGBot and the 3D models open without internet.
   Pages and data: the newest copy from the network when there is one, the saved copy when there is none.
   Scripts, styles, images and libraries: saved once per version (their address carries ?v=), then read from the device.
   Map tiles: the areas already looked at are kept, up to a limit, so the map still draws where you have been.
   Nothing is sent anywhere by this file. Sending a request from ZAGBot still needs a connection. */
const VERSION = 'dz-2026-11-21a';
const CORE = `${VERSION}-core`, DATA = `${VERSION}-data`, TILES = 'dz-tiles', LIBS = 'dz-libs';
const PAGES = ['index.html', 'twin.html', 'dashboard.html', 'questions.html', 'api.html', 'add.html', 'international.html', 'latest.html', 'value.html', '404.html'];
const DATA_FILES = ['data.js', 'data/zag_projects.geojson', 'data/twins.json', 'data/international.json', 'data/zag_news.json', 'data/news.json', 'data/news_status.json',
  'data/inspections.json', 'data/images.json', 'data/gurs_buildings.json', 'data/ownership.json', 'data/official_check.json', 'data/contacts.json', 'data/world.geojson', 'data/fehrl.json', 'data/fehrl_members.json',
  'api/v1/objects.json', 'api/v1/metadata.json', 'manifest.webmanifest'];
const TILE_HOSTS = /(^|\.)(tiles\.openfreemap\.org|server\.arcgisonline\.com|s3\.amazonaws\.com|ipi\.eprostor\.gov\.si|gis\.level2\.si)$/;
const LIB_HOSTS = /(^|\.)(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)$/;
const TILE_LIMIT = 2500;

/* install: the pages, then every script and style each page names, then the data */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const core = await caches.open(CORE), data = await caches.open(DATA);
    const assets = new Set();
    for (const p of PAGES) {
      try {
        const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) continue;
        const html = await r.clone().text(); await core.put(p, r);
        for (const m of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|webp|png|svg|jpg)(?:\?[^"]*)?)"/g)) if (!/^(https?:)?\/\//.test(m[1])) assets.add(m[1].replace(/^\/ZAGSloveniaTwin\//, ''));
      } catch (_) {}
    }
    await Promise.all([...assets].map(a => core.add(a).catch(() => {})));
    await Promise.all(DATA_FILES.map(f => data.add(f).catch(() => {})));
    self.skipWaiting();
  })());
});

/* activate: older versions of the saved site are removed; map tiles and libraries are kept */
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('dz-') && ![CORE, DATA, TILES, LIBS].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const trim = async (name, max) => { const c = await caches.open(name), keys = await c.keys(); for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]); };
const networkFirst = async (req, cacheName, key, wait = 4000) => {
  const c = await caches.open(cacheName);
  try {
    const r = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('slow')), wait))]);
    if (r && r.ok) c.put(key || req, r.clone());
    return r;
  } catch (_) {
    const hit = await c.match(key || req, { ignoreSearch: true }) || await caches.match(key || req, { ignoreSearch: true });
    if (hit) return hit;
    throw _;
  }
};
const cacheFirst = async (req, cacheName) => {
  const hit = await caches.match(req); if (hit) return hit;
  const r = await fetch(req);
  if (r && (r.ok || r.type === 'opaque')) (await caches.open(cacheName)).put(req, r.clone());
  return r;
};

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    const path = u.pathname.replace(/^.*?\/ZAGSloveniaTwin\//, '').replace(/^\//, '');
    if (req.mode === 'navigate') {
      e.respondWith(networkFirst(req, CORE, (path || 'index.html').split('?')[0]).catch(async () => (await caches.match('index.html')) || Response.error()));
      return;
    }
    if (/\.(json|geojson|csv)$/.test(u.pathname) || /data\.js$/.test(u.pathname)) { e.respondWith(networkFirst(req, DATA, u.pathname.replace(/^.*?\/ZAGSloveniaTwin\//, '') + (/news|status/.test(u.pathname) ? '' : u.search))); return; }
    e.respondWith(cacheFirst(req, CORE).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || Response.error())));
    return;
  }
  if (TILE_HOSTS.test(u.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(TILES), hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { c.put(req, r.clone()); trim(TILES, TILE_LIMIT); } return r; });
      return hit || net;
    })().catch(() => Response.error()));
    return;
  }
  if (LIB_HOSTS.test(u.hostname)) { e.respondWith(cacheFirst(req, LIBS).catch(() => Response.error())); return; }
});
