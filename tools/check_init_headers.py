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
    'games/gravity3d4.html',
    'games/kaya.html',
    'games/kaya/index.html'
]

for h_rel in html_files:
    h_path = os.path.join(ROOT, h_rel)
    if not os.path.exists(h_path):
        continue
    with open(h_path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()

    # Look for scripts in this html or included
    script_srcs = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html)
    all_code = html
    for s in script_srcs:
        p = os.path.normpath(os.path.join(os.path.dirname(h_path), s))
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8', errors='ignore') as jf:
                all_code += '\n' + jf.read()

    has_init_header = 'initCommonHeader' in all_code
    init_call = re.findall(r'initCommonHeader\s*\((.*?)\)', all_code, re.DOTALL)
    restart_fn_match = re.search(r'function\s+(resetCurrentGame|init\w+Game|restart\w+)\s*\(', all_code)

    print(f"{h_rel}:")
    print(f"  has initCommonHeader: {has_init_header}")
    if init_call:
        first_call = init_call[0].strip()
        first_call_last_arg = first_call.split(',')[-1].strip() if ',' in first_call else ''
        print(f"  initCommonHeader args: ... {first_call_last_arg}")
    else:
        print(f"  initCommonHeader NOT called!")
    print(f"  restart fn found: {restart_fn_match.group(1) if restart_fn_match else 'NONE'}")
