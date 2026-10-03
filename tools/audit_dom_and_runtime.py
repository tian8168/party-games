import os
import re

ROOT = os.path.abspath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 1. Parse sound types in common/audio.js
audio_path = os.path.join(ROOT, 'common', 'audio.js')
with open(audio_path, 'r', encoding='utf-8') as f:
    audio_code = f.read()

sound_types = set(re.findall(r"(?:type === ['\"]([^'\"]+)['\"]|case ['\"]([^'\"]+)['\"])", audio_code))
sound_types = {s[0] or s[1] for s in sound_types}
print(f"Registered audio sounds ({len(sound_types)}): {sorted(sound_types)}")

# 2. Check all AUDIO.play calls in codebase
print("\n--- Checking AUDIO.play calls ---")
audio_play_pattern = re.compile(r"(?:AUDIO|window\.AUDIO)\.play\(\s*['\"]([^'\"]+)['\"]")
for dirpath, _, filenames in os.walk(ROOT):
    if 'tools' in dirpath or '.git' in dirpath or 'node_modules' in dirpath:
        continue
    for fname in filenames:
        if fname.endswith(('.html', '.js')):
            fpath = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(fpath, ROOT)
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            matches = audio_play_pattern.findall(content)
            for m in matches:
                if m not in sound_types:
                    print(f"WARNING: Unknown audio sound '{m}' played in {rel_path}")

# 3. DOM ID verification for all games
print("\n--- Checking getElementById in games ---")
game_htmls = [
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
    'games/nes.html',
    'games/go.html',
    'games/gravity.html',
    'games/gravity4.html',
    'games/gravity3d.html',
    'games/gravity3d4.html',
]

for g_rel in game_htmls:
    g_path = os.path.join(ROOT, g_rel)
    if not os.path.exists(g_path):
        print(f"ERROR: {g_rel} does not exist!")
        continue
    with open(g_path, 'r', encoding='utf-8', errors='ignore') as f:
        html_content = f.read()

    # Find all IDs defined in HTML
    dom_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html_content))

    # Find all scripts linked or inline
    script_srcs = re.findall(r'<script\s+[^>]*src=["\']([^"\']+)["\']', html_content)
    inline_scripts = re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>', html_content, re.DOTALL)

    all_js_code = []
    for s in inline_scripts:
        all_js_code.append(('inline', s))

    base_dir = os.path.dirname(g_path)
    for src in script_srcs:
        # Ignore external or vendor/cdn
        if src.startswith('http') or 'nostalgist' in src or 'jsnes' in src or 'three' in src or 'OrbitControls' in src:
            continue
        js_path = os.path.normpath(os.path.join(base_dir, src))
        if os.path.exists(js_path):
            with open(js_path, 'r', encoding='utf-8', errors='ignore') as f:
                all_js_code.append((src, f.read()))

    # Find getElementById calls
    for source_name, code in all_js_code:
        get_id_calls = re.findall(r"document\.getElementById\(\s*['\"]([^'\"]+)['\"]\s*\)", code)
        query_sel_id_calls = re.findall(r"document\.querySelector\(\s*['\"]#([^'\"]+)['\"]\s*\)", code)
        all_queried = set(get_id_calls + query_sel_id_calls)
        for q_id in all_queried:
            # Check if this ID is in dom_ids, or if it might be dynamically created in code
            if q_id not in dom_ids:
                # Check if dynamically created in the JS code (e.g. .id = 'q_id' or innerHTML with id="q_id")
                dyn_pattern = rf'(?:\.id\s*=\s*[\'"`]{re.escape(q_id)}[\'"`]|id=[\'\\"]{re.escape(q_id)}[\'\\"])'
                is_dynamic = False
                for _, s_code in all_js_code:
                    if re.search(dyn_pattern, s_code):
                        is_dynamic = True
                        break
                if not is_dynamic:
                    print(f"POTENTIAL BUG in {g_rel} (from {source_name}): getElementById('{q_id}') not found in HTML or JS dynamic IDs!")
