import os
import re

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
        print(f"{h_rel}: NOT FOUND")
        continue
    with open(h_path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    srcs = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html)
    inline = re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>', html, re.DOTALL)
    inline_len = sum(len(s.strip().splitlines()) for s in inline if s.strip())
    print(f"{h_rel}:")
    print(f"  srcs: {srcs}")
    print(f"  inline scripts: {len(inline)}, total lines: {inline_len}")
