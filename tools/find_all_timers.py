import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.abspath(r'c:\Users\admin\Desktop\partygame')

html_files = [
    'games/tron.html',
    'games/bombcat.html',
    'games/iaido.html',
    'games/liarsdice.html',
    'games/quoridor.html',
    'games/aeroplane.html',
    'games/hockey.html',
    'games/sumo.html',
    'games/tanktrouble.html',
    'games/tank.html',
    'games/stack.html',
    'games/contra.html',
    'games/nes.html',
    'games/go.html',
    'games/gravity.html',
    'games/gravity4.html',
    'games/gravity3d.html',
    'games/gravity3d4.html'
]

for h_rel in html_files:
    h_path = os.path.join(ROOT, h_rel)
    with open(h_path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()

    # Collect inline and loaded js
    script_srcs = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html)
    sources = [(h_rel, html)]
    for s in script_srcs:
        if any(v in s for v in ['mqtt', 'three', 'OrbitControls', 'nostalgist', 'jsnes', 'common']):
            continue
        p = os.path.normpath(os.path.join(os.path.dirname(h_path), s))
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8', errors='ignore') as jf:
                sources.append((s, jf.read()))

    for src_name, code in sources:
        lines = code.splitlines()
        for idx, line in enumerate(lines, 1):
            if 'setTimeout' in line or 'setInterval' in line:
                # check if assigned to a variable or tracked
                has_assign = bool(re.search(r'=\s*set(?:Timeout|Interval)', line))
                print(f"[{h_rel}] {src_name}:{idx} (assigned={has_assign}) -> {line.strip()[:80]}")
