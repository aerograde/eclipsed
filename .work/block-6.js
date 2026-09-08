
/* eclipsed. — home runtime: the dotted clock and the quiet ASCII space scene
 * (a star field, an eclipse as the main object, and one small shaded planet
 * behind it all). All optional — if any node is missing the rest works. */
(function () {
  'use strict';
  var byId = function (id) { return document.getElementById(id); };
  var reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /*  dotted numerals — live TIME / DATE in the hero meta strip         */
  /* ------------------------------------------------------------------ */
  var clockTime = byId('heroClockTime');
  var clockDate = byId('heroClockDate');
  if (clockTime || clockDate) {
    var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var tickClock = function () {
      var d = new Date();
      if (clockTime) clockTime.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
      if (clockDate) clockDate.textContent = pad2(d.getMonth() + 1) + '\u00b7' + pad2(d.getDate()) + '\u00b7' + d.getFullYear();
    };
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* ------------------------------------------------------------------ */
  /*  deep-space ASCII scene — stars and two shaded planets             */
  /* ------------------------------------------------------------------ */
  var canvas = byId('asciiCanvas');
  var homeView = byId('welcomeView');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var C = 0, R = 0, adv = 11, lh = 16, vw = 0, vh = 0, dpr = 1;
    var stars = [];
    var pendingMeasure = true;
    /* pointer parallax — normalised target and smoothed offsets, in px */
    var ptx = 0, pty = 0, ox = 0, oy = 0;
    var hasPointer = false;

    /* glyph weight stands in for tone: dense marks read as the lit side */
    var RAMP = ['.', ':', '-', '=', '+', '*', '#', '%'];
    var STARCH = ['.', '.', '·', ':', '*'];
    /* the eclipse is the centrepiece: the black moon of a total eclipse,
       ringed by a bright inner corona that flares out into faint streamers */
    var ECLIPSE = { x: 0.68, y: 0.5, r: 0.165, depth: 1 };
    /* one shaded planet stays far behind, dim and small in the distance */
    var PLANET = { x: 0.885, y: 0.145, r: 0.03, depth: 1.7 };
    var LIGHT = { x: -0.48, y: -0.62, z: 0.62 };
    var CORONA_REACH = 5.0;    /* corona radius past the limb, in cells */

    function seeded(seed) {
      var s = seed >>> 0;
      return function () {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    }

    function shadeChar(b) {
      if (b < 0.04) return ' ';
      if (b < 0.14) return '.';
      if (b < 0.27) return ':';   /* night side */
      if (b < 0.4) return '-';
      if (b < 0.52) return '=';
      if (b < 0.64) return '+';
      if (b < 0.76) return '*';
      if (b < 0.88) return '#';
      return '%';
    }

    function measure() {
      pendingMeasure = false;
      if (!canvas) return;
      var b = canvas.getBoundingClientRect();
      var nw = b.width, nh = b.height;
      if (nw < 60 || nh < 60) { C = 0; R = 0; return; }
      vw = nw; vh = nh;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textBaseline = 'top';
      var fs = Math.max(9, Math.round(vw / 60));
      ctx.font = '600 ' + fs + 'px "Space Mono", ui-monospace, Menlo, Consolas, monospace';
      adv = ctx.measureText('M').width || Math.round(fs * 0.6);
      lh = Math.round(fs * 1.05);
      C = Math.max(20, Math.floor(vw / adv));
      R = Math.max(10, Math.floor(vh / lh));

      /* keep the objects clean — no stars inside the eclipse corona or planet */
      var ex = [
        { cx: vw * ECLIPSE.x, cy: vh * ECLIPSE.y, r: Math.min(vw, vh) * ECLIPSE.r + adv * (CORONA_REACH + 1.6) },
        { cx: vw * PLANET.x, cy: vh * PLANET.y, r: Math.min(vw, vh) * PLANET.r + fs * 2 }
      ];
      var rnd = seeded(97);
      var count = Math.max(42, Math.min(160, Math.round((vw * vh) / 8200)));
      var placed = 0;
      var tries = 0;
      stars = [];
      while (placed < count && tries < count * 8) {
        tries++;
        var sx = rnd() * vw;
        var sy = rnd() * vh;
        var col = Math.floor(sx / adv);
        var row = Math.floor(sy / lh);
        if (col < 1 || col >= C - 1 || row < 1 || row >= R - 3) continue;
        var near = false;
        for (var e = 0; e < ex.length; e++) {
          var ddx = sx - ex[e].cx;
          var ddy = sy - ex[e].cy;
          if (ddx * ddx + ddy * ddy < ex[e].r * ex[e].r) { near = true; break; }
        }
        if (near) continue;
        var key = col + ':' + row;
        var dup = false;
        for (var s = 0; s < placed; s++) { if (stars[s].key === key) { dup = true; break; } }
        if (dup) continue;
        stars.push({
          key: key,
          x: col * adv,
          y: row * lh,
          ch: STARCH[Math.floor(rnd() * STARCH.length)],
          a: 0.12 + rnd() * 0.4,
          tw: 0.4 + rnd() * 1.3,
          ph: rnd() * 6.2832,
          depth: 0.3 + rnd() * 0.5
        });
        placed++;
      }
    }

    /* one shaded ASCII sphere — true circle mapped through the cell aspect */
    function asciiSphere(cx, cy, pr) {
      if (!C || !R || pr < adv * 0.8) return;
      var x0 = Math.max(0, Math.floor((cx - pr) / adv));
      var x1 = Math.min(C - 1, Math.ceil((cx + pr) / adv));
      var y0 = Math.max(0, Math.floor((cy - pr) / lh));
      var y1 = Math.min(R - 1, Math.ceil((cy + pr) / lh));
      for (var row = y0; row <= y1; row++) {
        var py = (row * lh + lh * 0.5) - cy;
        for (var col = x0; col <= x1; col++) {
          var pxx = (col * adv + adv * 0.5) - cx;
          var rr = pxx * pxx + py * py;
          if (rr > pr * pr) continue;
          var zz = Math.sqrt(Math.max(0, (pr * pr - rr) / (pr * pr)));
          var nx = (rr === 0) ? 0 : pxx / pr;
          var ny = (rr === 0) ? 0 : py / pr;
          var b = nx * LIGHT.x + ny * LIGHT.y + zz * LIGHT.z;
          if (b < 0) b = 0;
          var ch = shadeChar(b);
          if (ch !== ' ') ctx.fillText(ch, col * adv, row * lh);
        }
      }
    }

    /* an ASCII total eclipse — the moon is a clean dark disc and every glyph
       of light lives outside its limb: a bright inner ring hugging the edge,
       then a corona of faint marks that thins with distance and flares along
       two slow-turning streamers. Everything is time-driven, so the corona
       turns and breathes on its own; the pointer only nudges the whole field. */
    function asciiEclipse(cx, cy, pr, t) {
      if (!C || !R || pr < adv * 1.8) return;
      var reach = pr + adv * (CORONA_REACH + 1);
      var x0 = Math.max(0, Math.floor((cx - reach) / adv));
      var x1 = Math.min(C - 1, Math.ceil((cx + reach) / adv));
      var y0 = Math.max(0, Math.floor((cy - reach) / lh));
      var y1 = Math.min(R - 1, Math.ceil((cy + reach) / lh));
      /* A total eclipse drawn as light: every cell around the moon's limb is
         lit, brightest and heaviest exactly at the edge and falling smoothly
         to a thinning, fainter haze — so the dark disc is visibly blocking a
         bright corona rather than sitting inside a drawn circle. The corona's
         reach stretches along the horizontal (long equatorial streamers,
         tighter polar tufts), and it lives on its own: four broad rays wheel
         slowly around (~70s/turn) over a quiet double breathe, no pointer
         needed. */
      var rot = t * 0.09;
      var breathe = 1 + 0.07 * Math.sin(t * 0.5) + 0.05 * Math.sin(t * 1.7 + 1.2);
      for (var row = y0; row <= y1; row++) {
        var py = (row * lh + lh * 0.5) - cy;
        for (var col = x0; col <= x1; col++) {
          var px = (col * adv + adv * 0.5) - cx;
          var d = Math.sqrt(px * px + py * py);
          var u = (d - pr) / adv; /* cells past the limb (negative = inside) */
          if (u < -0.35 || u > CORONA_REACH) continue; /* the moon stays dark */
          var ang = Math.atan2(py, px);
          /* equatorial streamers stretch the corona, polar tufts hug it */
          var eff = CORONA_REACH * (0.74 + 0.5 * Math.pow(Math.cos(ang), 2));
          if (u > eff) continue;
          var q = 1 - u / eff; /* 1 at the limb, 0 at that ray's edge */
          var ray = 0.68 + 0.32 * Math.cos(4 * ang - rot);
          var lum = breathe * ray * q;
          var grain = ((col * 37 + row * 23) % 13) / 12; /* 0..1, fixed per cell */
          /* density thins toward the edge (a soft fade, not a hard band) */
          if (q * (0.68 + 0.32 * grain) < 0.15) continue;
          var v = lum * (0.6 + 0.4 * grain);
          var ch = v > 0.62 ? '%' : v > 0.48 ? '#' : v > 0.36 ? '*' : v > 0.25 ? '+' : v > 0.16 ? '=' : v > 0.1 ? '-' : ':';
          ctx.globalAlpha = Math.min(0.95, 0.05 + Math.pow(Math.max(0, lum), 1.05) * 0.82);
          ctx.fillText(ch, col * adv, row * lh);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* a rare faint shooting star — keeps the deep space quietly alive */
    var meteors = [];
    var nextMeteorAt = 5;
    function tryMeteor(t) {
      if (t < nextMeteorAt) return;
      nextMeteorAt = t + 8 + Math.random() * 12;
      var fromLeft = Math.random() < 0.5;
      meteors.push({
        t0: t,
        dur: 1.5 + Math.random() * 0.7,
        x: fromLeft ? -vw * 0.06 : vw * (0.95 + Math.random() * 0.1),
        y: vh * (0.06 + Math.random() * 0.34),
        vx: (fromLeft ? 1 : -1) * vw * (0.22 + Math.random() * 0.12),
        vy: vh * (0.07 + Math.random() * 0.05) * (fromLeft ? 1 : -1),
        a: 0.2 + Math.random() * 0.16
      });
    }

    function paint(t) {
      if (!C || !R) return;
      ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = 'rgba(238,238,236,1)';
      /* stars — far background, twinkling on their own clock */
      for (var s = 0; s < stars.length; s++) {
        var st = stars[s];
        var tw = 0.5 + 0.5 * Math.sin(t * st.tw + st.ph);
        ctx.globalAlpha = st.a * (0.4 + 0.6 * tw);
        ctx.fillText(st.ch, st.x + ox * st.depth * 0.55, st.y + oy * st.depth * 0.55);
      }
      /* an occasional faint shooting star streaks across the deep field */
      for (var m = 0; m < meteors.length; m++) {
        var mt = meteors[m];
        var age = (t - mt.t0) / mt.dur;
        if (age < 0 || age > 1) { meteors.splice(m, 1); m--; continue; }
        var ease = age * age;
        var mx = mt.x + mt.vx * ease;
        var my = mt.y + mt.vy * ease;
        var fade = Math.max(0, 1 - age);
        for (var b = 0; b < 5; b++) {
          ctx.globalAlpha = Math.max(0, mt.a * fade * (1 - b / 5.5));
          ctx.fillText(b === 0 ? '·' : ':', mx - mt.vx * b * 0.3, my - mt.vy * b * 0.3);
        }
      }
      /* the eclipse — dark moon and its radiant corona, the main object */
      asciiEclipse(vw * ECLIPSE.x + ox * ECLIPSE.depth, vh * ECLIPSE.y + oy * ECLIPSE.depth, Math.max(58, Math.min(178, Math.min(vw, vh) * ECLIPSE.r)), t);
      /* the small planet keeps the scene a place — dim, far behind */
      ctx.globalAlpha = 0.3;
      asciiSphere(vw * PLANET.x + ox * PLANET.depth, vh * PLANET.y + oy * PLANET.depth, Math.max(11, Math.min(30, Math.min(vw, vh) * PLANET.r)));
      ctx.globalAlpha = 1;
    }

    measure();
    if (reduced) { paint(2.4); return; }

    window.addEventListener('pointermove', function (event) {
      ptx = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      pty = (event.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      hasPointer = true;
    }, { passive: true });
    window.addEventListener('pointerleave', function () { hasPointer = false; });
    window.addEventListener('resize', function () { pendingMeasure = true; });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) pendingMeasure = true;
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { pendingMeasure = true; }).catch(function () { /* keep current metrics */ });
    }

    var t0 = null;
    var lastPaint = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      if (homeView && homeView.hidden) return; /* scene is only for the home stage */
      if (pendingMeasure) measure();
      if (!C || !R) return;
      if (t0 === null) t0 = now;
      var t = (now - t0) / 1000;
      /* the scene is alive on its own: when the pointer rests, the field
         drifts on a slow figure-eight instead of freezing; the pointer just
         leans that drift toward itself (still only a few px at most) */
      var wantX = hasPointer ? ptx * 14 : Math.sin(t * 0.1) * 3;
      var wantY = hasPointer ? pty * 10 : Math.cos(t * 0.075) * 2.4;
      ox += (wantX - ox) * 0.05;
      oy += (wantY - oy) * 0.05;
      if (now - lastPaint < 33) return; /* ~30 fps is plenty for ASCII */
      lastPaint = now;
      tryMeteor(t);
      paint(t);
    }
    requestAnimationFrame(frame);
  }
})();
