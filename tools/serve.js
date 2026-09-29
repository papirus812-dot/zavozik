/*
 * Локальный сервер для разработки без зависимостей: node tools/serve.js [порт]
 * Открывает сайт на http://localhost:5173 (заставка — /, главная — /home.html).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.join(ROOT, pathname);
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Не найдено');
        return;
      }
      const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      // Запросы по частям (Range): без них браузеры не перематывают видео, а Safari его не играет
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && (m[1] !== '' || m[2] !== '')) {
        let start, end;
        if (m[1] === '') {
          start = Math.max(0, stat.size - Number(m[2]));
          end = stat.size - 1;
        } else {
          start = Number(m[1]);
          end = m[2] === '' ? stat.size - 1 : Math.min(Number(m[2]), stat.size - 1);
        }
        if (start >= stat.size || end < start) {
          res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
          return;
        }
        res.writeHead(206, {
          'Content-Type': type,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        });
        if (req.method === 'HEAD') res.end();
        else fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(file).pipe(res);
    });
  })
  .listen(PORT, () => {
    console.log(`Завозик: http://localhost:${PORT}/  (главная: http://localhost:${PORT}/home.html)`);
  });
