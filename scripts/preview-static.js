const { createReadStream } = require('node:fs');
const { stat } = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const root = path.join(__dirname, '..', 'dist');
const port = Number(process.env.PORT || 3000);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

async function send(response, requestPath) {
  const pathname = decodeURIComponent(new URL(requestPath, `http://localhost:${port}`).pathname);
  const normalized = path.normalize(pathname === '/' ? 'index.html' : pathname.slice(1));
  const filePath = path.join(root, normalized);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'content-type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

http.createServer((request, response) => {
  send(response, request.url);
}).listen(port, () => {
  console.log(`Preview: http://localhost:${port}`);
});
