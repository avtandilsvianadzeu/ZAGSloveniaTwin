/* ZAG Digital Atlas, desktop shell. Serves the bundled site from a local port (the pages read JSON and GeoJSON with fetch,
   which file:// does not allow) and opens it in one window. Outside links open in the system browser. */
const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.join(__dirname, 'site');
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', geojson: 'application/geo+json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', csv: 'text/csv', ico: 'image/x-icon', xml: 'application/xml', txt: 'text/plain', md: 'text/markdown', woff2: 'font/woff2' };
function serve() {
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      let u = decodeURIComponent(req.url.split('?')[0]).replace(/^\/ZAGSloveniaTwin(?=\/|$)/, '');
      let f = path.normalize(path.join(SITE, u === '/' ? 'index.html' : u));
      if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f).slice(1).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
      fs.createReadStream(f).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => resolve(s.address().port));
  });
}
async function start() {
  const port = await serve();
  const win = new BrowserWindow({ width: 1440, height: 900, minWidth: 900, minHeight: 600, title: 'ZAG Digital Atlas', backgroundColor: '#F3F5F9', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (!url.startsWith(`http://127.0.0.1:${port}`)) { shell.openExternal(url); return { action: 'deny' }; } return { action: 'allow' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(`http://127.0.0.1:${port}`)) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.session.setPermissionRequestHandler((wc, permission, cb) => cb(['media', 'audioCapture', 'speaker-selection'].includes(permission)));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Atlas', submenu: [{ label: 'Map', click: () => win.loadURL(`http://127.0.0.1:${port}/index.html`) }, { label: 'Assets', click: () => win.loadURL(`http://127.0.0.1:${port}/twin.html`) }, { label: 'Dashboard', click: () => win.loadURL(`http://127.0.0.1:${port}/dashboard.html`) }, { type: 'separator' }, { role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { type: 'separator' }, { role: 'toggleDevTools' }] },
    { label: 'Help', submenu: [{ label: 'Open the atlas website', click: () => shell.openExternal('https://avtandilsvianadzeu.github.io/ZAGSloveniaTwin/') }, { label: 'ZAG, zag.si', click: () => shell.openExternal('https://www.zag.si/') }] }
  ]));
  win.loadURL(`http://127.0.0.1:${port}/index.html`);
}
app.whenReady().then(start);
app.on('window-all-closed', () => app.quit());
