
/* eclipsed. notification service worker — embedded in index.svg.
   The LAN server serves this exact block as the worker script when the SVG
   URL is fetched as a service worker, so worker and app always ship as one
   file. Evaluated inside the page it detects a window and does nothing. */
(function () {
  'use strict';
  if (typeof window !== 'undefined') return; /* running as the app, not a worker */
  var SW = self;
  SW.addEventListener('install', function (event) {
    event.waitUntil(SW.skipWaiting());
  });
  SW.addEventListener('activate', function (event) {
    event.waitUntil(SW.clients.claim());
  });
  SW.addEventListener('push', function (event) {
    var raw = event.data ? event.data.text() : '';
    var parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (error) { /* raw-text payloads */ }
    var data = parsed || {};
    var title = String(data.title || 'eclipsed.');
    var body = String(data.body || (parsed ? '' : raw) || 'A private message is waiting for you.');
    var tag = String(data.tag || 'eclipsed-push');
    var url = String(data.url || '/');
    var options = {
      body: body,
      tag: tag,
      renotify: true,
      data: { url: url },
      silent: !body
    };
    event.waitUntil(SW.registration.showNotification(title, options));
  });
  SW.addEventListener('notificationclick', function (event) {
    event.notification.close();
    var target = new URL(String((event.notification.data && event.notification.data.url) || '/'), SW.location.origin).href;
    event.waitUntil((async function () {
      var windows = await SW.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (var i = 0; i < windows.length; i += 1) {
        var client = windows[i];
        if (client.url.split('#')[0] === target.split('#')[0]) {
          await client.navigate(target);
          return client.focus();
        }
      }
      return SW.clients.openWindow(target);
    })());
  });
})();
