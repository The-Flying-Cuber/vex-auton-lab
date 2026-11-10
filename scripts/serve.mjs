// Development preview only. The published app is a static GitHub Pages site.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.glb':'model/gltf-binary', '.gltf':'model/gltf+json', '.bin':'application/octet-stream', '.mp3':'audio/mpeg', '.svg':'image/svg+xml' };
const port = Number(process.env.PORT || 4173);
http.createServer(async (req, res) => {
  try {
    let requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Also exercise GitHub project-page URLs during preview.
    requestPath = requestPath.replace(/^\/vex-auton-lab(?=\/|$)/, '') || '/';
    let target = path.resolve(root, '.' + requestPath);
    if (target !== root.replace(/[\\/]$/, '') && !target.startsWith(root)) throw new Error('path');
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Auton Lab preview: http://127.0.0.1:${port}/vex-auton-lab/`));
