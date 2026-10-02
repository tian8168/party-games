import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.abspath(r'c:\Users\admin\Desktop\partygame')

html_files = [
    'index.html',
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
    'games/contra_canvas.html',
    'games/nes.html',
    'games/go.html',
    'games/gravity.html',
    'games/gravity4.html',
    'games/gravity3d.html',
    'games/gravity3d4.html',
    'games/kaya.html',
    'games/kaya/index.html'
]

missing_ids = []

for h_rel in html_files:
    h_path = os.path.join(ROOT, h_rel)
    if not os.path.exists(h_path):
        continue
    with open(h_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_code = f.read()

    dom_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html_code))

    script_srcs = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html_code)
    scripts_to_check = []
    
    inline_scripts = re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>', html_code, re.DOTALL)
    for idx, s in enumerate(inline_scripts):
        scripts_to_check.append((f"{h_rel}#inline{idx}", s))

    base_dir = os.path.dirname(h_path)
    for src in script_srcs:
        if src.startswith('http') or 'static' in src or 'vendor' in src or 'nostalgist' in src or 'jsnes' in src or 'three' in src or 'OrbitControls' in src or 'common' in src:
            continue
        js_path = os.path.normpath(os.path.join(base_dir, src))
        if os.path.exists(js_path):
            with open(js_path, 'r', encoding='utf-8', errors='ignore') as f:
                scripts_to_check.append((src, f.read()))

    for _, code in scripts_to_check:
        dyn_ids = re.findall(r'\.id\s*=\s*[\'"`]([^\'"`]+)[\'"`]', code)
        dom_ids.update(dyn_ids)
        inner_ids = re.findall(r'id=[\'\\"]([a-zA-Z0-9_\-]+)[\'\\"]', code)
        dom_ids.update(inner_ids)

    for source_name, code in scripts_to_check:
        lines = code.split('\n')
        for lno, line in enumerate(lines, 1):
            matches = re.finditer(r"document\.getElementById\(\s*['\"]([^'\"]+)['\"]\s*\)", line)
            for m in matches:
                gid = m.group(1)
                if gid in ('modal-title', 'modal-body', 'modal-footer', 'rules-modal', 'toast-msg'):
                    continue
                if gid not in dom_ids:
                    # check if line has null check
                    missing_ids.append((h_rel, source_name, lno, gid, line.strip()))

print(f"Total getElementById with ID not in HTML/Dynamic: {len(missing_ids)}")
for h_rel, src, lno, gid, line in missing_ids:
    print(f" - [{h_rel}] in {src}:{lno} -> id: '{gid}'\n     line: {line}")
