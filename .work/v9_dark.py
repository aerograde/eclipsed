import sys

path = 'index.svg'
s = open(path, encoding='utf-8').read()
errors = []

def rep(old, new, label=''):
    global s
    if old in s:
        s = s.replace(old, new)
    elif new in s:
        return
    else:
        errors.append(label or old[:70])

# ---- 1. header comment + import + :root -> v9 dark studio -------------------
old_root = """/* ============================================================================
   eclipsed. — interface v8 · paper ledger
   ----------------------------------------------------------------------------
   Modeled on a paper print ledger: everything sits on the quiet ground
   (#f4f4f4) with near-black ink (#161819) and hairline rules for structure —
   no cards, no glow, no glass. Type is Space Grotesk with Space Mono holding
   the index, codes and timestamps. The only colour in the room is a person's
   hex, drawn from a fixed ladder of muted inks; chrome stays monochrome.
   ============================================================================ */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

:root {
  color-scheme: light;

  /* canvas — paper */
  --bg: #f4f4f4;              /* stage */
  --bg-deep: #ededed;         /* inset panels */
  --surface: rgba(22, 24, 25, 0.03);
  --surface-hi: rgba(22, 24, 25, 0.06);
  --well: #fbfbfb;            /* solid raised float on paper */

  /* hairlines & ink — near-black at several volumes */
  --line: rgba(22, 24, 25, 0.12);
  --line-soft: rgba(22, 24, 25, 0.07);
  --line-strong: rgba(22, 24, 25, 0.24);
  --ink: #161819;
  --ink-2: rgba(22, 24, 25, 0.66);
  --ink-3: rgba(22, 24, 25, 0.44);
  --ink-4: rgba(22, 24, 25, 0.26);

  /* signal — ink actions with paper labels (monochrome chrome) */
  --sun: #161819;
  --sun-hi: #000;
  --on-sun: #f7f7f7;

  --danger: #b14b38;
  --danger-soft: rgba(177, 75, 56, 0.1);

  --paper: #ffffff;
  --on-paper: #161819;

  --font-sans: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-mono: 'Space Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;

  --r-lg: 10px;
  --r-md: 6px;
  --r-sm: 3px;

  --shadow-float: 0 1px 2px rgba(22, 24, 25, 0.05), 0 26px 50px -30px rgba(22, 24, 25, 0.25);
  --ease: cubic-bezier(0.2, 0.6, 0.2, 1);
}"""

new_root = """/* ============================================================================
   eclipsed. — interface v9 · dark studio
   ----------------------------------------------------------------------------
   The dark-room version of the reference (gustaffurusten.se): a charcoal
   canvas with a faint film-grain and technical grid, near-white ink, and
   everything else monochrome — hairlines, mono metadata, frosted islands.
   Two typographic voices carry it: Space Grotesk for reading, Space Mono for
   the index, and Doto Rounded for the segmented display numerals and room
   mastheads. People are the only colour — each hex lands on a fixed ladder of
   muted inks tuned for the dark canvas.
   ============================================================================ */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Doto:wght@400..900&display=swap');

:root {
  color-scheme: dark;

  /* canvas — charcoal studio */
  --bg: #0e0e10;              /* stage */
  --bg-deep: #101013;         /* inner panels / curtain */
  --surface: rgba(244, 244, 244, 0.04);
  --surface-hi: rgba(244, 244, 244, 0.08);
  --well: #16161a;            /* solid raised float */

  /* hairlines & ink — near-white at several volumes */
  --line: rgba(244, 244, 244, 0.1);
  --line-soft: rgba(244, 244, 244, 0.055);
  --line-strong: rgba(244, 244, 244, 0.22);
  --ink: #f2f2f0;
  --ink-2: rgba(244, 244, 242, 0.72);
  --ink-3: rgba(244, 244, 242, 0.5);
  --ink-4: rgba(244, 244, 242, 0.3);

  /* signal — near-white actions, ink labels */
  --sun: #f5f5f3;
  --sun-hi: #ffffff;
  --on-sun: #141416;

  --danger: #e0716a;
  --danger-soft: rgba(224, 113, 106, 0.12);

  --paper: #f5f5f3;
  --on-paper: #141416;

  --font-sans: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-mono: 'Space Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  --font-doto: 'Doto', 'Space Mono', var(--font-mono);

  --r-lg: 12px;
  --r-md: 8px;
  --r-sm: 4px;

  --shadow-float: 0 30px 70px -24px rgba(0, 0, 0, 0.75);
  --ease: cubic-bezier(0.2, 0.6, 0.2, 1);
}"""
rep(old_root, new_root, 'root tokens')

# ---- 2. mechanical re-darken (undo the light pass literals) -----------------
for old, new in [
    ('rgba(22, 24, 25, ', 'rgba(244, 244, 244, '),
    ('rgba(177, 75, 56, ', 'rgba(224, 113, 106, '),
    ('0 0 0 1000px #f6f6f6 inset', '0 0 0 1000px #1c1c20 inset'),
    ('background-color: #e3e3e3;', 'background-color: #232328;'),
    ('background-color: #ececec;', 'background-color: #17171a;'),
]:
    rep(old, new, 'mech ' + old)

rep('fill="#f4f4f4"', 'fill="#0e0e10"', 'svg rect')

# ---- 3. restore the token-driven dark preloader -----------------------------
rep('  background: #161819;\n  will-change: transform;',
    '  background: var(--bg-deep);\n  will-change: transform;', 'pre shard')
rep('.pre-shard-top { top: 0; border-bottom: 1px solid rgba(244, 244, 244, 0.16); }',
    '.pre-shard-top { top: 0; border-bottom: 1px solid var(--line); }', 'pre top')
rep('.pre-shard-bot { bottom: 0; border-top: 1px solid rgba(244, 244, 244, 0.16); }',
    '.pre-shard-bot { bottom: 0; border-top: 1px solid var(--line); }', 'pre bot')
rep("stroke='%23f4f4f4' stroke-opacity='0.1'", "stroke='%23ecece6' stroke-opacity='0.06'", 'pre grid')
rep('border: 1px solid rgba(244, 244, 244, 0.4);\n}\n.pre-ring i {',
    'border: 1px solid var(--line-strong);\n}\n.pre-ring i {', 'pre ring')
rep('background: #f4f4f4;\n  animation: eclipPulse 1.9s ease-in-out infinite;',
    'background: var(--paper);\n  animation: eclipPulse 1.9s ease-in-out infinite;', 'pre ring i')
rep('color: #f4f4f4;\n  font-variant-numeric: tabular-nums;',
    'color: var(--ink);\n  font-variant-numeric: tabular-nums;', 'pre count')
rep('background: rgba(244, 244, 244, 0.22);\n  overflow: hidden;',
    'background: var(--line-strong);\n  overflow: hidden;', 'pre track')
rep('background: #f4f4f4;\n  transform: scaleX(0);',
    'background: var(--sun);\n  transform: scaleX(0);', 'pre track i')
rep('color: rgba(244, 244, 244, 0.6);\n  font-weight: 500;',
    'color: var(--ink-4);\n  font-weight: 500;', 'pre tag')

# ---- 4. v9 signature override layer ----------------------------------------
CSS = """/* ============================================================================
   eclipsed v9 · dark studio — signature layer (final)
   ----------------------------------------------------------------------------
   The three loves from the reference: the segmented Doto type for mastheads
   and dotted numerals, frosted-glass islands for the bars, and the dark
   charcoal + grain + technical-grid canvas. Identity hexes stay coloured.
   ============================================================================ */

/* ---------- canvas texture: faint technical grid + film grain ---------- */
.side, .main {
  background-image: repeating-linear-gradient(to bottom, transparent 0px, transparent 71px, rgba(244, 244, 244, 0.03) 71px, rgba(244, 244, 244, 0.03) 72px);
}
.app-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  opacity: 0.5;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/></filter><rect width='240' height='240' filter='url(%23n)' opacity='0.05'/></svg>");
}

/* ---------- frosted islands (top bar + chat head + banner + composer) ---------- */
.topbar {
  background: rgba(244, 244, 244, 0.045);
  -webkit-backdrop-filter: blur(22px) saturate(1.3);
  backdrop-filter: blur(22px) saturate(1.3);
  border-bottom: 1px solid rgba(244, 244, 244, 0.1);
}
.chat-head {
  background: rgba(244, 244, 244, 0.045);
  -webkit-backdrop-filter: blur(22px) saturate(1.3);
  backdrop-filter: blur(22px) saturate(1.3);
  border-bottom: 1px solid rgba(244, 244, 244, 0.12);
}
.chat-banners .banner { background: rgba(244, 244, 244, 0.028); }
.chat-banners { position: relative; z-index: 1; }
.composer {
  position: relative;
  z-index: 1;
  background: linear-gradient(to top, var(--bg) 62%, rgba(14, 14, 16, 0));
}

/* ---------- segmented display type (Doto) ---------- */
.global-name {
  font-family: var(--font-doto);
  font-weight: 800;
  font-size: 30px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1;
}
.global-sub { color: var(--ink-3); }
.peer-copy h2 {
  font-family: var(--font-doto);
  font-weight: 800;
  font-size: 19px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.room-glyph {
  font-family: var(--font-doto);
  font-weight: 800;
  font-size: 10.5px;
  letter-spacing: 0.06em;
}
.side-count, .room-count-dot { font-family: var(--font-doto); font-weight: 700; font-size: 10px; }
.profile-hex, .hex-static { font-family: var(--font-doto); font-weight: 700; letter-spacing: 0.08em; }

/* ---------- chrome touches for the dark canvas ---------- */
.chat { --tint: #cfcfcf; --tint-soft: #6f6f6f; }
.person-tag { border-color: rgba(244, 244, 244, 0.38); color: var(--ink-2); }
.message-row:hover { background: rgba(244, 244, 244, 0.03); }
.gif-cell { background-color: #17171a; }
.avatar.has-pic { background-color: #232328; }
.person-row .avatar, .directory-row .avatar { mix-blend-mode: normal; }
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--ink);
  -webkit-box-shadow: 0 0 0 1000px #1c1c20 inset;
  caret-color: var(--sun);
}
::-webkit-scrollbar-thumb { background-color: rgba(244, 244, 244, 0.18); }
::-webkit-scrollbar-thumb:hover { background-color: rgba(244, 244, 244, 0.3); }
:focus-visible { outline: 1px solid rgba(244, 244, 244, 0.55); }
::selection { background: var(--paper); color: var(--on-paper); }
.room-input.invalid, .field-note.error { color: var(--danger); }
"""

idx = s.rfind('</style>')
if idx == -1:
    print('no </style>'); sys.exit(1)
s = s[:idx] + CSS + '\n' + s[idx:]

open(path, 'w', encoding='utf-8').write(s)
if errors:
    print('WARN unmatched:', errors)
    sys.exit(2)
print('v9_dark applied OK; new size', len(s))
