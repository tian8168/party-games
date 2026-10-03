import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.abspath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    script_srcs = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html)
    all_code = html
    for s in script_srcs:
        p = os.path.normpath(os.path.join(os.path.dirname(h_path), s))
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8', errors='ignore') as jf:
                all_code += '\n' + jf.read()

    # Look for resetCurrentGame or reset function
    m = re.search(r'function\s+resetCurrentGame\s*\([^)]*\)\s*\{([^}]*)\}', all_code)
    if m:
        body = m.group(1).strip()
        print(f"[{h_rel}] resetCurrentGame: {body}")
    else:
        # Check if onRestart was defined differently
        m2 = re.search(r'initCommonHeader\s*\([^,]+,[^,]+,\s*([^)]+)\)', all_code)
        if m2:
            print(f"[{h_rel}] custom restart: {m2.group(1).strip()}")
        else:
            print(f"[{h_rel}] NO resetCurrentGame found")
