// server.js — Hoki Cards Local Server
// Jalankan: node server.js
// Semua HP harus konek ke WiFi/Hotspot yang sama

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;

// Dapatkan IP lokal
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'www',
    req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.js': 'application/javascript',
    '.css': 'text/css', '.json': 'application/json' };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

const ip = getLocalIP();
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n================================');
  console.log('  🃏 HOKI CARDS SERVER AKTIF!');
  console.log('================================');
  console.log(`\n  Buka di HP ini:\n  http://localhost:${PORT}`);
  console.log(`\n  Buka di HP teman (harus 1 WiFi):\n  http://${ip}:${PORT}`);
  console.log('\n  Bagikan alamat di atas ke teman!');
  console.log('================================\n');
});
