/* Minimal static file server for the exported Expo web build.
   Serves index.html for unknown paths so client-side routing works. */
const http = require('http');
const fs = require('fs');
const path = require('path');

// `expo export --output-dir` writes index.html at the root of the target.
const ROOT = path.join(__dirname, '.expo-verify-web');
const PORT = 8099;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const indexCandidate = path.join(filePath, 'index.html');
    filePath = fs.existsSync(indexCandidate) ? indexCandidate : path.join(ROOT, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404).end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`serving ${ROOT} at http://localhost:${PORT}`);
});