import { createServer } from 'node:http';
import { readFileSync, existsSync, createReadStream, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = import.meta.dirname ?? join(fileURLToPath(import.meta.url), '..');
const PORT = process.env.WEB_PORT || 3000;
const distPath = join(__dirname, 'dist');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

let indexHtml = readFileSync(join(distPath, 'index.html'), 'utf-8');

const runtimeConfig = JSON.stringify({
  API_URL: process.env.API_URL || 'http://localhost:3001',
  WS_URL: process.env.WS_URL || 'ws://localhost:3003',
  NOTIFIER_URL: process.env.NOTIFIER_URL || 'http://localhost:3003',
  SCRAPER_URL: process.env.SCRAPER_URL || 'http://localhost:3002',
  SCHEDULER_URL: process.env.SCHEDULER_URL || 'http://localhost:3004',
});

indexHtml = indexHtml.replace(
  '<!-- __RUNTIME_CONFIG__ -->',
  `<script>window.__RUNTIME_CONFIG__=${runtimeConfig}</script>`
);

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const filePath = join(distPath, url.pathname === '/' ? '' : url.pathname);

  if (url.pathname !== '/' && existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(indexHtml);
});

server.listen(PORT, () => {
  console.log(`Web frontend running on port ${PORT}`);
});
