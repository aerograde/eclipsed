
/* eclipsed. — page switching is instant. The split-curtain language belongs
 * to the one-time boot reveal only; switching between Home and rooms (or
 * room to room) is a plain, immediate view flip. The old route-observing
 * wipe script was removed because it could flash a horizontal seam and, on a
 * slow network join, made opening #global look like a bounce back Home. */
(function () {
  'use strict';
  /* keep a harmless handle in case any flow still probes for it */
  window.__pageCurtain = { cover: function () {}, open: function () {} };
})();
