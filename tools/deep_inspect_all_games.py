import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.abspath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

active_game_htmls = [
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
    'games/kaya.html'
]

print("=== DEEP DOM & RUNTIME INSPECTION FOR ALL 19 GAMES ===")

for h_rel in active_game_htmls:
    h_path = os.path.join(ROOT, h_rel)
    if not os.path.exists(h_path):
        print(f"[MISSING] {h_rel}")
        continue

    with open(h_path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()

    # Collect DOM IDs in HTML
    dom_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html))

    # Collect all scripts
    script_srcs = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html)
    scripts = []
    
    inline_scripts = re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>', html, re.DOTALL)
    for idx, s in enumerate(inline_scripts):
        scripts.append((f"inline#{idx}", s))

    base_dir = os.path.dirname(h_path)
    for src in script_srcs:
        if any(v in src for v in ['three', 'OrbitControls', 'mqtt', 'nostalgist', 'jsnes', 'gamecontroller', 'coi-serviceworker']):
            continue
        p = os.path.normpath(os.path.join(base_dir, src))
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8', errors='ignore') as jf:
                scripts.append((src, jf.read()))

    # Add dynamic IDs
    for _, code in scripts:
        dyn_ids = re.findall(r'\.id\s*=\s*[\'"`]([^\'"`]+)[\'"`]', code)
        dom_ids.update(dyn_ids)
        inner_ids = re.findall(r'id=[\'\\"]([a-zA-Z0-9_\-]+)[\'\\"]', code)
        dom_ids.update(inner_ids)

    # Check for direct chained dereferences on getElementById('...')
    for src_name, code in scripts:
        lines = code.splitlines()
        for lno, line in enumerate(lines, 1):
            matches = re.finditer(r"document\.getElementById\(\s*['\"]([^'\"]+)['\"]\s*\)\.([a-zA-Z0-9_$]+)", line)
            for m in matches:
                gid = m.group(1)
                prop = m.group(2)
                if gid in ('modal-title', 'modal-body', 'modal-footer', 'rules-modal', 'toast-msg'):
                    continue
                if gid not in dom_ids:
                    print(f"❌ [CRITICAL NULL DEREF] {h_rel} ({src_name}:{lno}): document.getElementById('{gid}').{prop} - ID not in DOM!")

print("=== CHECK COMPLETED ===")
