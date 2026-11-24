// Tiny static server for local checks. Usage: node scripts/serve.mjs <dir> <port>
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
const dir = resolve(process.argv[2] || 'dist'), port = Number(process.argv[3] || 4173);
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
createServer(async (q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = join(dir, p);
  if (!f.startsWith(dir)) { r.writeHead(403).end(); return; }
  try { const b = await readFile(f); r.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }).end(b); }
  catch { r.writeHead(404).end('not found'); }
}).listen(port, () => console.log('serving', dir, 'on', port));
