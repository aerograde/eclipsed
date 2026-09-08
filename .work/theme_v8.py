import sys

path = 'index.svg'
s = open(path, encoding='utf-8').read()
errors = []

def rep(old, new, label=''):
    global s
    if old in s:
        s = s.replace(old, new)
    elif new in s:
        return  # already applied
    else:
        errors.append(label or old[:70])

# ---- 1. header comment + font import + :root tokens -------------------------
old_root = """/* ============================================================================
   eclipsed. — interface v7 · matte eclipse
   ----------------------------------------------------------------------------
   One quiet idea carried through every surface: warm paper ink resting on deep
   charcoal. No gradients, no glow, no glass. Structure comes from hairlines
   and generous space; the only color in the room is a person's hex — plus a
   single muted gold that marks "light" (presence, focus, action).

   Type: Space Grotesk (grotesk voice from the references), ui-monospace for
   the index/data labels. Corners are calm: sharp for chrome, softly rounded
   only where things float.
   ============================================================================ */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap');

:root {
  color-scheme: dark;

  /* canvas — matte charcoal, warm underneath */
  --bg: #101010;              /* stage */
  --bg-deep: #0b0b0b;         /* rail */
  --surface: rgba(244, 244, 244, 0.035);
  --surface-hi: rgba(244, 244, 244, 0.07);
  --well: #141414;            /* solid raised panel / float */

  /* hairlines & ink — warm paper at several volumes */
  --line: rgba(232, 232, 232, 0.1);
  --line-soft: rgba(232, 232, 232, 0.055);
  --line-strong: rgba(232, 232, 232, 0.22);
  --ink: #e9e9e9;             /* paper */
  --ink-2: rgba(232, 232, 232, 0.64);
  --ink-3: rgba(232, 232, 232, 0.4);
  --ink-4: rgba(232, 232, 232, 0.2);

  /* signal — a muted gold for "light": presence, focus, active */
  --sun: #cfcfcf;
  --sun-hi: #ececec;
  --on-sun: #171717;

  --danger: #e0a194;
  --danger-soft: rgba(205, 150, 150, 0.12);

  --paper: var(--ink);
  --on-paper: #101010;

  --font-sans: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;

  --r-lg: 16px;
  --r-md: 10px;
  --r-sm: 6px;

  --shadow-float: 0 24px 60px -18px rgba(0, 0, 0, 0.65);
  --ease: cubic-bezier(0.2, 0.6, 0.2, 1);
}"""

new_root = """/* ============================================================================
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
rep(old_root, new_root, 'root tokens')

# ---- 2. mechanical literals -> light-theme equivalents ----------------------
for old, new in [
    ('rgba(232, 232, 232, ', 'rgba(22, 24, 25, '),
    ('rgba(200, 200, 200, ', 'rgba(22, 24, 25, '),
    ('rgba(205, 150, 150, ', 'rgba(177, 75, 56, '),
    ('rgba(238, 176, 166, ', 'rgba(177, 75, 56, '),
    ('0 0 0 1000px #161616 inset', '0 0 0 1000px #f6f6f6 inset'),
    ('background-color: #1c1c1c;', 'background-color: #e3e3e3;'),
    ('background-color: #141414;', 'background-color: #ececec;'),
]:
    rep(old, new, 'mech ' + old)

rep('fill="#0e0e10"', 'fill="#f4f4f4"', 'svg rect')

open(path, 'w', encoding='utf-8').write(s)
if errors:
    print('WARN — unmatched:', errors)
    sys.exit(2)
print('theme_v8 applied OK; new size', len(s))
