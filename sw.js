// Beryl website helper (browsers and "Add to Home Screen" only; the Android app doesn't use it).
// Beryl itself: the newest copy from the internet first, the saved copy when there's no internet.
// Nothing from the Google Sheet (grades, messages, photos) is ever saved here.
var CACHE = 'beryl-web-2';
var PAGE = './';
var FILES = [PAGE, 'icons/icon-192.png', 'icons/apple-touch-icon.png', 'manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function withTimeout(p, ms) {
  return new Promise(function (ok, no) {
    var t = setTimeout(function () { no(new Error('slow')); }, ms);
    p.then(function (r) { clearTimeout(t); ok(r); }, function (x) { clearTimeout(t); no(x); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // Google Sheet, fonts: straight to the internet
  if (/\/(version|app)\.json$|\.apk$|\/sw\.js$/.test(url.pathname)) return; // update checks: always fresh
  var scope = new URL(self.registration.scope).pathname; // /beryl-directory/
  var isPage = url.pathname === scope || url.pathname === scope + 'index.html';
  if (req.mode === 'navigate' && !isPage) return;                    // a wrong address: GitHub shows the "Page not found" page
  if (isPage) {
    e.respondWith(
      withTimeout(fetch(url.href, { cache: 'no-store', credentials: 'same-origin' }), 8000).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(PAGE, copy); }); return res; }
        return caches.match(PAGE).then(function (r) { return r || res; }); // GitHub hiccup: use the saved copy
      }).catch(function () {
        return caches.match(PAGE).then(function (r) { return r || fetch(req); });
      })
    );
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) { return r || fetch(req); }));
});
