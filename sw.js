/* Service worker — Glucides Nets
   Stratégie : réseau d'abord pour la page (pour recevoir les mises à jour),
   cache d'abord pour les icônes/manifest, jamais de cache pour l'API
   Open Food Facts (données nutritionnelles toujours fraîches). */
'use strict';

/* Version de l'app : garder ce nom de cache synchronisé avec le numéro
   affiché dans le pied de page d'index.html (#app-version). L'incrémenter
   à CHAQUE mise à jour publiée, sinon les utilisateurs installés gardent
   l'ancienne version en cache. */
var CACHE = 'glucides-nets-v2.20.0';
var ASSETS = [
  '.',
  'index.html',
  'foods.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Mise en cache une ressource à la fois, avec un message de
      // progression vers les pages ouvertes — alimente la barre
      // déterminée de l'écran de préparation de l'onboarding.
      var done = 0;
      function notify() {
        self.clients.matchAll({ includeUncontrolled: true }).then(function (clients) {
          clients.forEach(function (c) {
            c.postMessage({ type: 'precache', done: done, total: ASSETS.length });
          });
        });
      }
      return Promise.all(ASSETS.map(function (asset) {
        return cache.add(asset).then(function () {
          done++;
          notify();
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // APIs externes (Open Food Facts, Anthropic) : réseau seulement —
  // jamais de mise en cache de données nutritionnelles ni d'analyses
  if (url.hostname.indexOf('openfoodfacts.org') !== -1 ||
      url.hostname.indexOf('anthropic.com') !== -1) return;

  if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    // Page : réseau d'abord, cache en secours (fonctionne hors ligne)
    event.respondWith(
      fetch(event.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        return resp;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match('index.html');
        });
      })
    );
    return;
  }

  if (url.origin === location.origin) {
    // Ressources locales : cache d'abord
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        return cached || fetch(event.request).then(function (resp) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
          return resp;
        });
      })
    );
  }
});
