/* ============================================================================
   eclipsed. — motion layer · GSAP choreography in the sstr.tech language
   Boot preloader (percent fill → READY → two-half curtain rise) with the hero
   content revealing underneath, then smooth interaction helpers. Everything
   needed is loaded before the curtain lifts (icons + fonts fetched up front),
   so the app is instant afterwards.
   ============================================================================ */
(function () {
  'use strict';
  var gsap = (typeof window !== 'undefined') && window.gsap;
  var reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var byId = function (id) { return document.getElementById(id); };

  var pre = byId('preloader');
  var heroScene = null;
  var fail = function () {
    if (pre) pre.classList.add('removed');
    if (heroScene) heroScene.style.opacity = '';
  };

  /* The reveal is a one-time introduction: after the first load on this
     device it never plays again, so spamming reload stays instant. Stick a
     ?reveal on the URL to watch it again. */
  var INTRO_KEY = 'eclipsed-intro-seen-v1';
  var introSeen = false;
  try { introSeen = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) { /* storage optional */ }
  var forceIntro = typeof location !== 'undefined' && /[?&]reveal(?:[=&]|$)/.test(String(location.search || ''));

  if (!pre) return;
  if (!gsap || reduced || (introSeen && !forceIntro)) { fail(); return; }

  /* ---------- prepare hero for its reveal (before first paint) ---------- */
  var title = byId('heroTitle');
  var titleInner = null;
  var fxEls = [];
  try {
    if (title) {
      title.classList.add('is-mask');
      titleInner = document.createElement('span');
      titleInner.className = 'land-title-inner';
      while (title.firstChild) titleInner.appendChild(title.firstChild);
      title.appendChild(titleInner);
    }
  } catch (e) { /* keep hero untouched */ }

  var heroEye = byId('heroEyebrow');
  var heroTicker = byId('heroTicker');
  var heroCta = byId('heroCta');
  var heroMeta = byId('heroMeta');
  try { heroScene = document.querySelector('.hero-scene'); } catch (e) { /* optional */ }
  gsap.registerPlugin(window.CustomEase ? window.CustomEase : null);
  var cctpOut = window.CustomEase
    ? window.CustomEase.create('cctpOut', 'M0,0 C0.19,0.02 0.2,1 1,1')
    : 'expo.out';

  /* hide hero pieces up front so the reveal reads as one moment */
  var heroBits = [heroEye, heroTicker, heroCta, heroMeta].filter(Boolean);
  if (titleInner) gsap.set(titleInner, { yPercent: 112 });
  gsap.set(heroBits, { autoAlpha: 0, y: 16 });
  /* the stage lights up behind the parting curtain, not before */
  if (heroScene) gsap.set(heroScene, { autoAlpha: 0.001 });

  /* full, idempotent end-state — the one true way out of the boot. Called by
     the natural end of the timeline, by the watchdog below if the curtain
     ever stalls mid-rise, and by the hard failsafe. Clears every inline
     state this script set so no piece can be left invisible behind it. */
  var finished = false;
  var finishNow = function () {
    if (finished) return;
    finished = true;
    if (pre) {
      pre.classList.add('done');
      pre.classList.add('removed');
      pre.setAttribute('aria-hidden', 'true');
    }
    if (heroScene) heroScene.style.opacity = '';
    var bits = heroBits.slice();
    if (titleInner) bits.push(titleInner);
    for (var i = 0; i < bits.length; i++) {
      if (!bits[i]) continue;
      bits[i].style.opacity = '';
      bits[i].style.visibility = '';
      bits[i].style.transform = '';
    }
  };

  /* ---------- percent counter ---------- */
  var numEl = byId('preNum');
  var fillEl = byId('preFill');
  var tagEl = byId('preTag');
  var counter = { v: 0 };
  var pad = function (n) {
    var s = String(Math.round(n));
    while (s.length < 3) s = '0' + s;
    return s;
  };
  var onCount = function () {
    if (numEl) numEl.textContent = pad(counter.v);
    if (fillEl) fillEl.style.transform = 'scaleX(' + (counter.v / 100) + ')';
  };

  var tl = gsap.timeline({ defaults: { ease: cctpOut }, paused: true });

  /* phase 1 — percent fills to 100 */
  tl.to(counter, { v: 100, duration: 2.0, ease: 'power1.inOut', onUpdate: onCount }, 0);
  /* phase 2 — at 100 the counter swaps to READY, short beat */
  tl.add(function () {
    if (numEl) numEl.textContent = 'READY';
    if (tagEl) tagEl.textContent = 'ready';
  }, 2.04);
  tl.to({}, { duration: 0.4 }, 2.04);

  /* phase 3 — curtain rise + hero reveal underneath */
  tl.addLabel('rise', 2.5);
  var topS = pre.querySelector('.pre-shard-top');
  var botS = pre.querySelector('.pre-shard-bot');
  var core = pre.querySelector('.pre-core');
  var grid = pre.querySelector('.pre-grid');
  /* the dial blooms outward as the curtain parts on a long, calm ease */
  tl.add(function () { pre.classList.add('rising'); }, 'rise+=0.0');
  tl.to(grid, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, 'rise+=0.02');
  tl.to(core, { scale: 1.6, autoAlpha: 0, duration: 0.62, ease: 'power2.in', transformOrigin: '50% 50%' }, 'rise+=0.02');
  tl.to(topS, { yPercent: -101.5, duration: 1.3, ease: cctpOut }, 'rise+=0.04');
  tl.to(botS, { yPercent: 101.5, duration: 1.3, ease: cctpOut }, 'rise+=0.09');
  /* every piece settles BEFORE the curtain clears, so the moment it lifts
     the page is already its final self — nothing pops in late */
  if (heroScene) tl.to(heroScene, { autoAlpha: 1, duration: 0.95, ease: 'power1.out' }, 'rise+=0.3');
  tl.add(function () { pre.classList.add('done'); }, 'rise+=0.34');

  /* hero content rises with the curtain (like the site's HERO_LEAD) */
  if (titleInner) tl.to(titleInner, { yPercent: 0, duration: 1.0, ease: cctpOut }, 'rise+=0.12');
  if (heroEye) tl.fromTo(heroEye, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 'rise+=0.3');
  if (heroCta) tl.fromTo(heroCta, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.55 }, 'rise+=0.5');
  if (heroTicker) tl.fromTo(heroTicker, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.55 }, 'rise+=0.6');
  if (heroMeta) tl.fromTo(heroMeta, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.55 }, 'rise+=0.68');
  tl.add(finishNow, 'rise+=1.5');

  /* run once fonts are ready (they arrive during the fill phase) */
  var minElapsed = 1400;
  var t0 = Date.now();
  /* kick every type family up front so no text swaps or pops in after the
     curtain lifts — the page is fully composed underneath before the rise */
  if (document.fonts && document.fonts.load) {
    try {
      document.fonts.load('900 1em "Doto"');
      document.fonts.load('1em "Space Mono"');
      document.fonts.load('700 1em "Space Mono"');
      document.fonts.load('1em "Space Grotesk"');
      document.fonts.load('500 1em "Space Grotesk"');
      document.fonts.load('600 1em "Space Grotesk"');
    } catch (e) { /* older engines ignore */ }
  }
  var startWhenReady = function () {
    var wait = Math.max(0, minElapsed - (Date.now() - t0));
    setTimeout(function () {
      /* two settled frames so layout + the index scene are fully painted
         under the dial before the curtain begins to rise */
      var frames = 2;
      var settle = function () {
        if (--frames > 0) { requestAnimationFrame(settle); return; }
        /* mark it seen the instant the reveal is committed to play, so a
           reload mid-intro skips the repeat */
        try { if (!forceIntro) localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* storage optional */ }
        tl.play();
      };
      requestAnimationFrame(settle);
    }, wait);
  };
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 3500); })])
      .then(startWhenReady)
      .catch(startWhenReady);
  } else {
    startWhenReady();
  }

  /* hard failsafe so the app can never stay covered */
  setTimeout(function () {
    if (tl.progress() < 1) {
      try { tl.progress(1); } catch (e) { /* fall through */ }
    }
    finishNow();
  }, 9000);

  /* watchdog — if the curtain stalls mid-rise (throttled rAF, tab switch,
     power saving), advance to the final frame so the app can never sit
     half-covered. Engages only once the rise has begun; before that the
     countdown phase is allowed to wait on fonts (up to the failsafe). */
  var lastWatch = -1;
  var stalls = 0;
  var wd = setInterval(function () {
    if (finished || !pre) { clearInterval(wd); return; }
    if (!pre.classList.contains('rising')) { lastWatch = -1; stalls = 0; return; }
    var t = tl.time();
    if (t === lastWatch) {
      if (++stalls >= 3) { /* ~750 ms without a frame of progress */
        clearInterval(wd);
        try { tl.progress(1); } catch (e) { /* fall through */ }
        finishNow();
      }
    } else {
      lastWatch = t;
      stalls = 0;
    }
  }, 250);

  /* ---------- hero CTAs drive the module ---------- */
  function heroGo(mode) {
    var want = mode === 'join' ? 'join' : 'offer';
    var modeBtn = byId(want === 'join' ? 'joinMode' : 'offerMode');
    if (modeBtn) {
      try { modeBtn.click(); } catch (e) {}
    }
    var scroller = document.querySelector('.welcome');
    var start = byId('landStart') || byId('connectCard');
    // mode switch reflows the module, so scroll after it settles
    setTimeout(function () {
      try {
        if (scroller && start) {
          var target = start.offsetTop - 24;
          scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
        } else if (start && start.scrollIntoView) {
          start.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (e) {}
    }, 140);
    setTimeout(function () {
      var f = want === 'join' ? byId('joinOfferInput') : byId('roomInput');
      if (f && f.focus) { try { f.focus({ preventScroll: true }); } catch (e) {} }
    }, 760);
  }
  var ctaCreate = byId('landCreateCta');
  var ctaJoin = byId('landJoinCta');
  if (ctaCreate) ctaCreate.addEventListener('click', function () { heroGo('offer'); });
  if (ctaJoin) ctaJoin.addEventListener('click', function () { heroGo('join'); });

  /* gentle per-row motion for freshly appended chat messages */
  var lastRowCount = 0;
  var watchRows = setInterval(function () {
    var list = byId('messageList');
    if (!list) return;
    var rows = list.querySelectorAll('.message-row');
    if (rows.length > lastRowCount && lastRowCount > 0) {
      var fresh = Array.prototype.slice.call(rows, lastRowCount);
      gsap.from(fresh, { autoAlpha: 0, y: 8, duration: 0.32, ease: 'power2.out', stagger: 0.04, overwrite: true });
    }
    lastRowCount = rows.length;
    if (rows.length === 0) lastRowCount = 0;
  }, 450);
  window.addEventListener('beforeunload', function () { clearInterval(watchRows); });
})();
