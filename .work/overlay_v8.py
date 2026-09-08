import sys

path = 'index.svg'
s = open(path, encoding='utf-8').read()

CSS = """/* ============================================================================
   eclipsed v8 · paper ledger — layout & index refinements (final layer)
   ----------------------------------------------------------------------------
   A magazine spread: the conversation is the page; the rooms live in a slim
   right-hand index column like a table of contents. No wells, no boxes — the
   index is open paper ruled with hairlines, Global reads as the featured
   entry, and chrome stays ink-on-paper.
   ============================================================================ */

/* ---------- composition: content page left, index right ---------- */
@media (min-width: 1300px) {
  .app-shell { grid-template-columns: minmax(0, 1fr) 292px; }
  .app-shell > .side { grid-column: 2; grid-row: 1; border-right: 0; border-left: 1px solid var(--line); }
  .app-shell > .main { grid-column: 1; grid-row: 1; }
}

/* ---------- index column: open paper, hairline rules ---------- */
.side { background: var(--bg); }
.side-user {
  padding: 16px 24px 17px;
  border-bottom: 1px solid var(--line);
}
.side-user-meta { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }
.side-name { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.side-edit-btn svg { width: 13px; height: 13px; }

/* Global — the featured row */
.global-row {
  position: relative;
  align-items: flex-start;
  gap: 13px;
  padding: 22px 24px 20px;
  border-bottom: 1px solid var(--line);
  background: none;
}
.global-row::after {
  content: '';
  position: absolute;
  right: 24px;
  top: 50%;
  width: 14px;
  height: 14px;
  border-right: 1px solid var(--ink-3);
  border-bottom: 1px solid var(--ink-3);
  transform: translateY(-50%) rotate(-45deg);
  opacity: 0;
  transition: opacity 0.2s var(--ease), transform 0.2s var(--ease);
}
.global-row:hover::after { opacity: 1; }
.global-glyph {
  width: 34px;
  height: 34px;
  margin-top: 1px;
  border-color: var(--ink-3);
  background: none;
}
.global-glyph::after { width: 8px; height: 8px; background: var(--ink-3); opacity: 1; }
.global-copy { gap: 0; }
.global-name {
  font-size: 27px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.02;
}
.global-sub {
  margin-top: 9px;
  font-size: 11px;
  letter-spacing: 0.01em;
  line-height: 1.5;
}
.global-row.active { background: var(--surface); }
.global-row.active .global-glyph { border-color: var(--ink); background: var(--ink); }
.global-row.active .global-glyph::after { background: var(--bg); }
.global-row.active .global-sub { color: var(--ink-3); }

/* sections: flush mono heads, ruled lists */
.side-scroll { padding: 4px 0 12px; gap: 30px; }
.side-sec-head { padding: 0 24px 8px; }
.side-sec-title { color: var(--ink-4); letter-spacing: 0.28em; font-size: 9.5px; }
.side-sec-title::after { content: ''; }
.side-count { color: var(--ink-4); letter-spacing: 0.04em; }
.clist { gap: 0; }
.room-sec { margin-top: auto; padding-top: 18px; }

.room-row, .person-row, .directory-row {
  border-radius: 0;
  padding: 9px 24px;
  border-top: 1px solid var(--line-soft);
  transition: background 0.13s ease;
}
.person-row { cursor: pointer; }
.room-row:hover, .person-row:hover, .directory-row:hover { background: var(--surface-hi); }
.room-row:active { background: var(--surface); }
.room-glyph {
  width: 26px;
  height: 26px;
  font-size: 8.5px;
  border-color: var(--line-strong);
  background: none;
  border-radius: 2px;
}
.room-code { font-size: 14px; font-weight: 600; letter-spacing: -0.008em; }
.room-meta { font-size: 10px; letter-spacing: 0.02em; color: var(--ink-4); }
.person-name > span:first-child { font-size: 14px; font-weight: 600; }
.person-meta { font-size: 9.5px; color: var(--ink-4); }
.presence-dot { width: 5px; height: 5px; }

.side-foot { background: var(--bg); padding: 14px 24px 16px; }
.foot-row { padding: 7px 8px; border-radius: 3px; }
.foot-title { font-size: 12px; font-weight: 600; letter-spacing: 0.01em; }
.foot-detail { font-size: 10px; color: var(--ink-4); letter-spacing: 0.04em; }

/* ---------- chrome: ink actions, hairline frames ---------- */
.btn { border-radius: 2px; }
.btn.primary { background: var(--ink); border-color: var(--ink); color: var(--bg); }
.btn.primary:hover { background: var(--sun-hi); border-color: var(--sun-hi); color: #fff; }
.btn.small { border-radius: 999px; }
.room-action-btn.primary-row:hover { color: var(--on-sun); background: var(--ink); }

/* ---------- page type ---------- */
.eyebrow { color: var(--ink-4); letter-spacing: 0.32em; }
.eyebrow::before { background: var(--ink-3); }
.home-lead { font-size: clamp(14px, 1.2vw, 16.5px); color: var(--ink-2); }
.land-h2 { letter-spacing: -0.02em; }
.land-sub { color: var(--ink-3); }
.seg-btn.active::after { height: 1px; background: var(--ink); }
.field-label { color: var(--ink-4); letter-spacing: 0.24em; }
.code-input-wrap .hash { color: var(--ink-3); }
.room-input, .text-input, .gov-input { caret-color: var(--ink); }
.flow-title { letter-spacing: -0.02em; }

/* ---------- chat page: reading column ---------- */
.peer-copy h2 { font-size: 19px; letter-spacing: -0.015em; }
#messageList { padding-top: 34px; }
.message-row .avatar { box-shadow: 0 0 0 1px var(--line-strong); }
.message-time { letter-spacing: 0.04em; }
.mention-option-name { color: var(--ink); }

/* tint defaults — the only colour in the room stays the people's */
.chat { --tint: #c9c9c9; --tint-soft: #8a8a8a; }
"""

old_end = s.rfind('</style>')
if old_end == -1:
    print('no </style>'); sys.exit(1)
s = s[:old_end] + CSS + '\n' + s[old_end:]

MOTION = """
  <script type="application/ecmascript"><![CDATA[
/* eclipsed. — paper page-switch: fade the view that just opened (quiet, once).
 * The engine flips [hidden] on #welcomeView / #chatView; this observer answers
 * that with a single low fade+rise so switching rooms never feels abrupt. */
(function () {
  'use strict';
  var gsap = (typeof window !== 'undefined') && window.__gsap;
  var reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!gsap || reduced) return;
  var views = ['welcomeView', 'chatView'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if (!views.length || typeof MutationObserver !== 'function') return;
  var animating = false;
  var pending = null;
  var play = function () {
    animating = false;
    var el = pending; pending = null;
    if (!el) return;
    gsap.from(el, { autoAlpha: 0.001, y: 9, duration: 0.34, ease: 'power2.out', clearProps: 'opacity,visibility,transform', overwrite: 'auto' });
  };
  var onFlip = function () {
    var visible = views.filter(function (v) { return !v.hidden; });
    var show = visible.length === 1 ? visible[0] : null;
    if (!show) return;
    if (animating) { pending = show; return; }
    animating = true;
    pending = show;
    requestAnimationFrame(function () { requestAnimationFrame(play); });
  };
  var obs = new MutationObserver(onFlip);
  views.forEach(function (v) { obs.observe(v, { attributes: true, attributeFilter: ['hidden'] }); });
})();
]]></script>
"""
marker = '</svg>'
if marker not in s:
    print('no </svg>'); sys.exit(1)
s = s.replace(marker, MOTION + '\n' + marker, 1)

open(path, 'w', encoding='utf-8').write(s)
print('overlay_v8 applied OK; new size', len(s))
