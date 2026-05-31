// A tiny zero-dependency static file server with live reload (Node built-ins only).
// Run: node scripts/serve.mjs   (npm run serve)   ·   PORT=3000 to change the port.
// Live reload: the server watches src/site/examples/docs and tells the browser (via SSE)
// to reload on any change. Disable with LIVERELOAD=0.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT) || 8000;
const liveReload = process.env.LIVERELOAD !== '0';

// Correct MIME types matter: .js must be text/javascript or the browser refuses `import`.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Injected into every HTML response in dev: reconnect-capable reload via SSE.
const LR_SNIPPET =
  '\n<script>(()=>{try{const s=new EventSource("/__livereload");' +
  's.onmessage=()=>location.reload();}catch(e){}})()</script>\n';

/** Open SSE connections waiting for reload pings. @type {Set<import('node:http').ServerResponse>} */
const clients = new Set();

const server = createServer(async (req, res) => {
  // Live-reload event stream: held open, pinged on file changes.
  if (liveReload && req.url === '/__livereload') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = normalize(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden'); // path-traversal guard
      return;
    }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 Not Found');
      return;
    }
    const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
    if (liveReload && type.startsWith('text/html')) {
      let html = await readFile(file, 'utf8');
      html = html.includes('</body>') ? html.replace('</body>', LR_SNIPPET + '</body>') : html + LR_SNIPPET;
      res.writeHead(200, { 'content-type': type });
      res.end(html);
    } else {
      res.writeHead(200, { 'content-type': type });
      res.end(await readFile(file));
    }
  } catch {
    res.writeHead(500).end('Server error');
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${port} is in use — try: PORT=8001 npm run serve`);
  else console.error(e.message);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`Lumen · serving ${root}${liveReload ? ' (live reload on)' : ''}`);
  console.log(`  examples → http://localhost:${port}/examples/`);
  console.log(`  docs site → http://localhost:${port}/site/`);
});

// Watch the browser-relevant folders; debounce, then tell every open client to reload.
if (liveReload) {
  let timer;
  const ping = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const c of clients) c.write('data: reload\n\n');
    }, 80);
  };
  for (const dir of ['src', 'site', 'examples', 'docs']) {
    try {
      watch(join(root, dir), { recursive: true }, ping);
    } catch {
      /* folder may not exist; ignore */
    }
  }
}
