// src/main/util/http-callback.js
const http = require('http');

function startCallbackServer(expectedPath = '/callback', port = 43563) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith(expectedPath)) {
        const url = new URL(req.url, `http://localhost:${port}`);
        const params = Object.fromEntries(url.searchParams.entries());
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('<html><body><h2>Logged in. You can close this window.</h2></body></html>');
        server.close();
        resolve(params);
      } else {
        res.writeHead(404); res.end();
      }
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1');
  });
}

module.exports = { startCallbackServer };
