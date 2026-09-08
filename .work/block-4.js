
/* eclipsed. — canvas fit: match the SVG viewBox to the window so one CSS
 * pixel is one user unit and nothing is stretched (the design is authored
 * at 1440x900 — at exactly that size this is a no-op). */
(function () {
  'use strict';
  function fit() {
    var root = document.documentElement;
    if (!root || String(root.nodeName).toLowerCase() !== 'svg') return;
    var w = Math.max(320, Math.round(window.innerWidth || 0));
    var h = Math.max(240, Math.round(window.innerHeight || 0));
    var want = '0 0 ' + w + ' ' + h;
    if (root.getAttribute('viewBox') !== want) root.setAttribute('viewBox', want);
  }
  function start() {
    fit();
    var raf = null;
    window.addEventListener('resize', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; fit(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
