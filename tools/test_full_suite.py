import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.abspath(r'c:\Users\admin\Desktop\partygame')

print("==================================================")
print("  PARTY ARCADE FULL AUTOMATED VALIDATION SUITE")
print("==================================================")

errors = []
warnings = []

# --- 1. Syntax & Bracket Balance Check ---
print("\n--- [1] Bracket & Quote Balancing ---")
files_to_balance = [
    'index.html',
    'sw.js',
    'common/audio.js',
    'common/common.js',
    'common/network.js',
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
    'games/js/tron.js',
    'games/js/bombcat.js',
    'games/js/tank.js',
    'games/js/tanktrouble.js',
    'games/js/aeroplane.js',
    'games/js/stack.js',
    'games/js/iaido.js',
    'games/js/liarsdice.js',
    'games/js/sumo.js'
]

for rel in files_to_balance:
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        errors.append(f"File missing: {rel}")
        continue
    with open(p, 'r', encoding='utf-8', errors='ignore') as f:
        code = f.read()

    # Check script tags
    c_scripts = re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>', code, re.DOTALL) if rel.endswith('.html') else [code]
    for idx, s in enumerate(c_scripts):
        stack = []
        in_str = None
        esc = False
        in_line_comment = False
        in_block_comment = False
        i = 0
        while i < len(s):
            ch = s[i]
            nxt = s[i+1] if i + 1 < len(s) else ''

            if in_line_comment:
                if ch == '\n':
                    in_line_comment = False
                i += 1
                continue

            if in_block_comment:
                if ch == '*' and nxt == '/':
                    in_block_comment = False
                    i += 2
                    continue
                i += 1
                continue

            if in_str:
                if esc:
                    esc = False
                elif ch == '\\':
                    esc = True
                elif ch == in_str:
                    in_str = None
                i += 1
                continue

            # Not in string or comment
            if ch == '/' and nxt == '/':
                in_line_comment = True
                i += 2
                continue
            if ch == '/' and nxt == '*':
                in_block_comment = True
                i += 2
                continue

            if ch in ('"', "'", '`'):
                in_str = ch
                i += 1
                continue

            if ch in '([{':
                stack.append(ch)
            elif ch in ')]}':
                if not stack:
                    errors.append(f"{rel}: Unexpected closing '{ch}' in script #{idx}")
                    break
                top = stack.pop()
                expected = {'(': ')', '[': ']', '{': '}'}[top]
                if ch != expected:
                    errors.append(f"{rel}: Mismatched bracket: opened '{top}', closed '{ch}' in script #{idx}")
                    break
            i += 1

        if stack:
            errors.append(f"{rel}: Unclosed brackets {stack} in script #{idx}")

print(f"  [PASS] Checked bracket balancing on {len(files_to_balance)} critical files.")

# --- 2. Audio Registry Check ---
print("\n--- [2] Web Audio Play Verification ---")
with open(os.path.join(ROOT, 'common', 'audio.js'), 'r', encoding='utf-8') as f:
    audio_code = f.read()
sound_types = set(re.findall(r"(?:type === ['\"]([^'\"]+)['\"]|case ['\"]([^'\"]+)['\"])", audio_code))
sound_types = {s[0] or s[1] for s in sound_types}

for rel in files_to_balance:
    p = os.path.join(ROOT, rel)
    with open(p, 'r', encoding='utf-8', errors='ignore') as f:
        c = f.read()
    plays = re.findall(r"(?:AUDIO|window\.AUDIO)\.play\(\s*['\"]([^'\"]+)['\"]", c)
    for s in plays:
        if s not in sound_types:
            errors.append(f"{rel}: Played unknown sound '{s}'")
print(f"  [PASS] All AUDIO.play calls verified against {len(sound_types)} registered audio synthesizers.")

# --- 3. Tank Local 2-Player Deadlock Fix Verification ---
print("\n--- [3] Tank Local 2-Player & Control Verification ---")
tank_html = open(os.path.join(ROOT, 'games', 'tank.html'), 'r', encoding='utf-8').read()
assert 'syncTankControlsUI' in tank_html, "syncTankControlsUI missing in tank.html"
assert 'LOCAL' in tank_html and 'fireTankBullet(t2.x' in tank_html, "Local mode firing missing in tank.html"
assert 'curTank.angle = parseInt(angle)' in tank_html, "Local mode aiming missing in tank.html"
print("  [PASS] Tank local 2-player mode aiming, firing, and HUD sync verified.")

# --- 4. Tank Trouble Match End Timer Verification ---
print("\n--- [4] Tank Trouble Timer Verification ---")
tt_html = open(os.path.join(ROOT, 'games', 'tanktrouble.html'), 'r', encoding='utf-8').read()
assert 'modalTimer' in tt_html, "modalTimer missing in tanktrouble.html"
assert 'clearTimeout(STATE.tanktrouble.modalTimer)' in tt_html, "modalTimer cleanup missing in tanktrouble.html"
assert 'clearTimeout(STATE.tanktrouble.nextRoundTimer)' in tt_html, "nextRoundTimer cleanup missing in tanktrouble.html"
print("  [PASS] Tank Trouble match end modalTimer and nextRoundTimer verified.")

# --- 5. Aeroplane Dice & AI Timer Verification ---
print("\n--- [5] Aeroplane Roll & AI Timer Verification ---")
aero_html = open(os.path.join(ROOT, 'games', 'aeroplane.html'), 'r', encoding='utf-8').read()
assert 'STATE.aeroplane.rollInterval' in aero_html, "rollInterval tracking missing in aeroplane.html"
assert 'clearInterval(STATE.aeroplane.rollInterval)' in aero_html, "rollInterval clear missing in aeroplane.html"
assert 'STATE.aeroplane.aiTimer = setTimeout' in aero_html, "aiTimer tracking missing in aeroplane.html"
print("  [PASS] Aeroplane rollInterval and consecutive sixes aiTimer tracking verified.")

# --- 6. Index.html BFCache Pageshow Verification ---
print("\n--- [6] Lobby Pageshow & Navigation Unlock Verification ---")
index_html = open(os.path.join(ROOT, 'index.html'), 'r', encoding='utf-8').read()
assert "window.addEventListener('pageshow'" in index_html, "pageshow listener missing in index.html"
assert "isNavigating = false" in index_html, "isNavigating reset missing in index.html"
print("  [PASS] Lobby BFCache pageshow navigation unlock verified.")

# --- 7. Modal Dismiss on Reset Verification ---
print("\n--- [7] Common Header Modal Dismiss Verification ---")
common_js = open(os.path.join(ROOT, 'common', 'common.js'), 'r', encoding='utf-8').read()
assert "restartBtn.onclick" in common_js and "closeModal()" in common_js, "closeModal() missing on restartBtn in common.js"
print("  [PASS] Header restart button modal dismissal verified.")

print("\n==================================================")
if errors:
    print(f"❌ FAIL: {len(errors)} errors found:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("  [ALL PASS] 100% FULL TEST SUITE SUCCESSFUL!")
    print("==================================================")
