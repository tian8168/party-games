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
    script_srcs = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html)
    all_code = html
    for s in script_srcs:
        p = os.path.normpath(os.path.join(os.path.dirname(h_path), s))
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8', errors='ignore') as jf:
                all_code += '\n' + jf.read()

    # Find initCommonHeader invocation
    m = re.search(r'initCommonHeader\s*\((.*?)\);', all_code, re.DOTALL)
    if m:
        call_text = m.group(0)
        # find the arguments
        print(f"=== {h_rel} ===")
        # print the last 150 chars of the call
        print(call_text[-120:].replace('\n', ' '))
    else:
        print(f"=== {h_rel} === NOT FOUND")
