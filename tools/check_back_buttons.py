import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

games_dir = os.path.join(ROOT, 'games')
for f in sorted(os.listdir(games_dir)):
    if f.endswith('.html'):
        p = os.path.join(games_dir, f)
        with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
            c = fp.read()
        links = re.findall(r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>.*?返回.*?</a>', c, re.DOTALL)
        buttons = re.findall(r'<(?:button|div)\s+[^>]*onclick=["\']([^"\']+)["\'][^>]*>.*?返回.*?</(?:button|div)>', c, re.DOTALL)
        print(f"{f}: links={links}, buttons={buttons}")
