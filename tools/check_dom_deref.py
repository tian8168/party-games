import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.abspath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Map of html files to the js files they include
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

fatal_bugs = []
warnings = []

for h_rel in html_files:
    h_path = os.path.join(ROOT, h_rel)
    if not os.path.exists(h_path):
        continue
    with open(h_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_code = f.read()

    # Find all IDs defined in HTML
    dom_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html_code))

    # Also find dynamically created elements in inline and loaded scripts
    # Scripts to inspect
    script_srcs = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html_code)
    scripts_to_check = []
    
    # Inline scripts
    inline_scripts = re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>', html_code, re.DOTALL)
    for idx, s in enumerate(inline_scripts):
        scripts_to_check.append((f"{h_rel}#inline{idx}", s))

    base_dir = os.path.dirname(h_path)
    for src in script_srcs:
        if src.startswith('http') or 'static' in src or 'vendor' in src or 'nostalgist' in src or 'jsnes' in src or 'three' in src or 'OrbitControls' in src:
            continue
        js_path = os.path.normpath(os.path.join(base_dir, src))
        if os.path.exists(js_path):
            with open(js_path, 'r', encoding='utf-8', errors='ignore') as f:
                scripts_to_check.append((src, f.read()))

    # Find dynamic IDs created in JS
    for _, code in scripts_to_check:
        dyn_ids = re.findall(r'\.id\s*=\s*[\'"`]([^\'"`]+)[\'"`]', code)
        dom_ids.update(dyn_ids)
        # also template literals like `id="${...}"` or id="..." inside innerHTML
        inner_ids = re.findall(r'id=[\'\\"]([a-zA-Z0-9_\-]+)[\'\\"]', code)
        dom_ids.update(inner_ids)

    # Now check for unsafe document.getElementById calls:
    # Pattern: document.getElementById('xxx').something
    for source_name, code in scripts_to_check:
        lines = code.split('\n')
        for lno, line in enumerate(lines, 1):
            matches = re.finditer(r"document\.getElementById\(\s*['\"]([^'\"]+)['\"]\s*\)\.([a-zA-Z0-9_$]+)", line)
            for m in matches:
                gid = m.group(1)
                prop = m.group(2)
                # Ignore common elements created dynamically by common.js like rules-modal, modal-title, etc.
                if gid in ('modal-title', 'modal-body', 'modal-footer', 'rules-modal', 'toast-msg'):
                    continue
                if gid not in dom_ids:
                    fatal_bugs.append({
                        'html': h_rel,
                        'source': source_name,
                        'line': lno,
                        'id': gid,
                        'prop': prop,
                        'code': line.strip()
                    })

print(f"FATAL POTENTIAL NULL DEREFERENCES: {len(fatal_bugs)}")
for b in fatal_bugs:
    print(f"  [CRITICAL] in {b['html']} (from {b['source']}:{b['line']}): ID '{b['id']}' not in DOM! Line: {b['code']}")
