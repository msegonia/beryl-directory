// Beryl website helper (browsers and "Add to Home Screen" only; the Android app doesn't use it).
// Beryl itself: the newest copy from the internet first, the saved copy when there's no internet.
// Nothing from the Google Sheet (grades, messages, photos) is ever saved here.
// Update 30: shows Beryl's notifications on iPhones (Home Screen app, iOS 16.4+). The signal never holds message text.
var CACHE = 'beryl-web-3';
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

// ---- Notifications (iPhone Home Screen app) ----
// The same words as the Android app. An iPhone must show a notification for every signal, so there is always one.
function noteFor(d) {
  var teacher = d.r === 't';
  if (d.type === 'msg') {
    if (teacher) return { title: 'New message from a student', body: 'Open Beryl to read it.', tag: 'beryl-msg' };
    if (d.ann === '1') return { title: 'You got an announcement from your class adviser.', body: 'Open Beryl to read it.', tag: 'beryl-msg' };
    return { title: 'You got a message from your class adviser.', body: 'Open Beryl to read it.', tag: 'beryl-msg' };
  }
  if (d.type === 'grades') {
    var t = d.what === 'g' ? 'Your grades are updated.' : d.what === 'a' ? 'Your attendance is updated.'
      : d.what === 'ga' ? 'Your grades and attendance are updated.' : 'Your grades or attendance were updated.';
    return { title: t, body: 'Open Beryl to see them.', tag: 'beryl-grades' };
  }
  if (d.type === 'checkin') return { title: "Check in for today's class.", body: 'Open Beryl and tap Check in.', tag: 'beryl-checkin' };
  if (d.type === 'attday') return d.st === 'in'
    ? { title: "Today's attendance is in.", body: "The class secretary sent today's attendance.", tag: 'beryl-att' }
    : { title: 'No attendance from the class secretary yet.', body: "Open Beryl to check today's attendance.", tag: 'beryl-att' };
  if (d.type === 'test') return { title: 'Beryl notifications are working \u2713', body: teacher ? 'This came instantly, through Firebase.' : '', tag: 'beryl-test' };
  return { title: 'Beryl', body: 'Open Beryl to see what\u2019s new.', tag: 'beryl' };
}

self.addEventListener('push', function (e) {
  var p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = {}; }
  var d = (p && p.data) || p || {};
  var n = noteFor(d);
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      list.forEach(function (c) { try { c.postMessage({ beryl: 'push', type: d.type || '' }); } catch (x) {} }); // Beryl is open: check now
    }).catch(function () {}).then(function () {
      return self.registration.showNotification(n.title, { body: n.body, tag: n.tag, icon: 'icons/icon-192.png', data: { type: d.type || '' } });
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var type = (e.notification.data && e.notification.data.type) || '';
  var scope = self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) { try { list[i].postMessage({ beryl: 'open', type: type }); } catch (x) {} return list[i].focus(); }
      }
      return self.clients.openWindow(scope + (type === 'msg' ? '?open=msg' : ''));
    })
  );
});
