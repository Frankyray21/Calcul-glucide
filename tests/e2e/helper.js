/* Outillage commun des tests bout-en-bout.
   - serve() : petit serveur statique sur la racine du dépôt (port libre),
     aucune dépendance à Python ni à un port fixe.
   - launch() : Chromium de Playwright; CHROMIUM_PATH le remplace au besoin
     (utile hors CI, quand les navigateurs Playwright vivent ailleurs).
   - check() : une vérification nommée; le moindre échec fait échouer le
     processus — c'est ce que la CI regarde. */
'use strict';

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm'
};

function serve() {
  return new Promise(function (resolve) {
    const srv = http.createServer(function (req, res) {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.normalize(path.join(ROOT, p));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', function () {
      resolve({ srv: srv, base: 'http://127.0.0.1:' + srv.address().port });
    });
  });
}

function launch() {
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}

const failures = [];
function check(name, cond, extra) {
  const ok = !!cond;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra !== undefined ? ' — ' + extra : ''));
  if (!ok) failures.push(name);
}

async function finish(browser, srv) {
  await browser.close();
  srv.close();
  if (failures.length) {
    console.error('\nÉCHECS (' + failures.length + ') : ' + failures.join(' | '));
    process.exit(1);
  }
  console.log('\nTous les contrôles passent.');
}

// Un vrai JPEG 1×1, pour jouer la photo d'un repas
const JPEG_1PX = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

module.exports = { serve, launch, check, finish, JPEG_1PX };
