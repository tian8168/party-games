import os
import re
import json

ROOT = os.path.abspath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

html_files = []
for dirpath, _, filenames in os.walk(ROOT):
    if 'tools' in dirpath or '.git' in dirpath or 'node_modules' in dirpath:
        continue
    for f in filenames:
        if f.endswith('.html'):
            html_files.append(os.path.join(dirpath, f))

print(f"Found {len(html_files)} HTML files:")
for f in html_files:
    print(" -", os.path.relpath(f, ROOT))
