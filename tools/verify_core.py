import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.abspath(r'c:\Users\admin\Desktop\partygame')

errors = []
warnings = []

# --- 1. Audio types check ---
print("\n[Check 1] Audio sound registration & usage")
with open(os.path.join(ROOT, 'common', 'audio.js'), 'r', encoding='utf-8') as f:
    audio_code = f.read()

registered_sounds = set(re.findall(r"(?:type === ['\"]([^'\"]+)['\"]|case ['\"]([^'\"]+)['\"])", audio_code))
registered_sounds = {s[0] or s[1] for s in registered_sounds}
print(f"Registered sounds count: {len(registered_sounds)}")

# Check AUDIO.play in all games
for dirpath, _, fnames in os.walk(ROOT):
    if any(p in dirpath for p in ['tools', '.git', 'node_modules', 'vendor', 'wasm']):
        continue
    for fn in fnames:
        if fn.endswith(('.html', '.js')):
            fp = os.path.join(dirpath, fn)
            with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                c = f.read()
            plays = re.findall(r"(?:AUDIO|window\.AUDIO)\.play\(\s*['\"]([^'\"]+)['\"]", c)
            for p in plays:
                if p not in registered_sounds:
                    errors.append(f"Unregistered sound '{p}' in {os.path.relpath(fp, ROOT)}")

# --- 2. Check index.html lobby matrix and routing ---
print("\n[Check 2] Lobby matrix & routing in index.html")
with open(os.path.join(ROOT, 'index.html'), 'r', encoding='utf-8') as f:
    index_html = f.read()

# 2.1 Game cards count
cards = re.findall(r'<div class="game-card[^"]*"[^>]*data-cat="([^"]+)"[^>]*data-players="([^"]+)"[^>]*onclick="enterGame\(\'([^\']+)\'\)"', index_html)
print(f"Game cards in lobby: {len(cards)}")
if len(cards) != 19:
    errors.append(f"Expected 19 game cards in index.html, found {len(cards)}")

card_keys = [c[2] for c in cards]
print(f"Game keys: {card_keys}")

# 2.2 fileMap in index.html
file_map_match = re.search(r'const fileMap = \{([^}]+)\};', index_html)
if not file_map_match:
    errors.append("fileMap not found in index.html")
else:
    file_map_content = file_map_match.group(1)
    file_map = dict(re.findall(r"['\"]([^'\"]+)['\"]\s*:\s*['\"]([^'\"]+)['\"]", file_map_content))
    print(f"fileMap entries count: {len(file_map)}")
    for k in card_keys:
        if k not in file_map:
            errors.append(f"Game key '{k}' in game cards missing from fileMap!")
        else:
            target_file = os.path.join(ROOT, 'games', file_map[k])
            if not os.path.exists(target_file):
                errors.append(f"Target file for game '{k}' ({file_map[k]}) does not exist at {target_file}")

# 2.3 randomPickGame keys
random_keys_match = re.search(r'const gameKeys = \[([^\]]+)\];', index_html)
if random_keys_match:
    random_keys = [k.strip().strip("'\"") for k in random_keys_match.group(1).split(',')]
    print(f"randomPickGame keys count: {len(random_keys)}")
    diff = set(card_keys) - set(random_keys)
    if diff:
        errors.append(f"randomPickGame missing keys: {diff}")
else:
    errors.append("randomPickGame keys array not found!")

# 2.4 Category count badges in pills
category_counts = {
    'ALL': len(cards),
    '4PLAYER': len([c for c in cards if c[1] in ('4', '3-4')]),
    'STRATEGY': len([c for c in cards if c[0] == 'STRATEGY']),
    'MIND': len([c for c in cards if c[0] == 'MIND']),
    'PHYSICS': len([c for c in cards if c[0] == 'PHYSICS']),
    'REFLEX': len([c for c in cards if c[0] == 'REFLEX'])
}
print(f"Calculated category counts: {category_counts}")

for cat, count in category_counts.items():
    pill_match = re.search(rf"filterLobby\('{cat}'\)[^>]*>[^<]*\((\d+)\)", index_html)
    if not pill_match:
        errors.append(f"Category pill for {cat} not found!")
    else:
        pill_count = int(pill_match.group(1))
        if pill_count != count:
            errors.append(f"Category pill {cat} says {pill_count}, but actual card count is {count}!")

# --- 3. Check Service Worker ---
print("\n[Check 3] Service Worker (sw.js)")
with open(os.path.join(ROOT, 'sw.js'), 'r', encoding='utf-8') as f:
    sw_code = f.read()

app_shell_match = re.search(r'const APP_SHELL = \[(.*?)\];', sw_code, re.DOTALL)
if not app_shell_match:
    errors.append("APP_SHELL not found in sw.js")
else:
    paths = [p.strip().strip("'\"") for p in app_shell_match.group(1).split(',') if p.strip()]
    for p in paths:
        if p in ('./', ''): continue
        rel_p = p.replace('./', '').replace('/', os.sep)
        disk_path = os.path.join(ROOT, rel_p)
        if not os.path.exists(disk_path):
            errors.append(f"File in APP_SHELL does not exist: {p} ({disk_path})")

print(f"\nErrors: {len(errors)}")
print(f"Warnings: {len(warnings)}")
for e in errors:
    print(f"  [ERROR] {e}")
for w in warnings:
    print(f"  [WARN] {w}")
