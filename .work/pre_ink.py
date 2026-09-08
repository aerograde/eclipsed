import sys

path = 'index.svg'
s = open(path, encoding='utf-8').read()

def rep(old, new, label=''):
    global s
    if old in s:
        s = s.replace(old, new)
    elif new in s:
        return  # already applied
    else:
        print('MISS (%s):' % (label or old[:70]))
        sys.exit(1)

# ---- preloader curtain -> ink shards on paper -------------------------------
rep('  background: var(--bg-deep);\n  will-change: transform;',
    '  background: #161819;\n  will-change: transform;', 'pre-shard bg')

rep('.pre-shard-top { top: 0; border-bottom: 1px solid var(--line); }',
    '.pre-shard-top { top: 0; border-bottom: 1px solid rgba(244, 244, 244, 0.16); }', 'pre top')
rep('.pre-shard-bot { bottom: 0; border-top: 1px solid var(--line); }',
    '.pre-shard-bot { bottom: 0; border-top: 1px solid rgba(244, 244, 244, 0.16); }', 'pre bot')

rep("""  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='84' height='84'><path d='M42 28v28M28 42h28' stroke='%23eceae2' stroke-opacity='0.05' stroke-width='1'/></svg>");
}""", """  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='84' height='84'><path d='M42 28v28M28 42h28' stroke='%23f4f4f4' stroke-opacity='0.1' stroke-width='1'/></svg>");
}""", 'pre grid')

rep('border: 1px solid var(--line-strong);\n}\n.pre-ring i {',
    'border: 1px solid rgba(244, 244, 244, 0.4);\n}\n.pre-ring i {', 'pre ring')
rep('background: var(--paper);\n  animation: eclipPulse 1.9s ease-in-out infinite;',
    'background: #f4f4f4;\n  animation: eclipPulse 1.9s ease-in-out infinite;', 'pre ring i')
rep('color: var(--ink);\n  font-variant-numeric: tabular-nums;',
    'color: #f4f4f4;\n  font-variant-numeric: tabular-nums;', 'pre count')
rep('background: var(--line-strong);\n  overflow: hidden;',
    'background: rgba(244, 244, 244, 0.22);\n  overflow: hidden;', 'pre track')
rep('background: var(--sun);\n  transform: scaleX(0);',
    'background: #f4f4f4;\n  transform: scaleX(0);', 'pre track i')
rep('color: var(--ink-4);\n  font-weight: 500;',
    'color: rgba(244, 244, 244, 0.6);\n  font-weight: 500;', 'pre tag')

open(path, 'w', encoding='utf-8').write(s)
print('preloader edits applied OK; new size', len(s))
