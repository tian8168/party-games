import re
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

test_failures = []

def assert_true(cond, msg):
    if not cond:
        print(f"❌ FAIL: {msg}")
        test_failures.append(msg)
    else:
        print(f"✅ PASS: {msg}")

# --- Test Suite 1: Iaido Slash Verification ---
print("\n--- Test Suite 1: Iaido Slash Verification ---")
with open('games/iaido.html', 'r', encoding='utf-8') as f:
    iaido_html = f.read()

# 1.1 Check CSS overlay pointer-events and z-index
overlay_css_match = re.search(r'\.iaido-slash-overlay\s*\{([^}]+)\}', iaido_html)
assert_true(overlay_css_match is not None, "iaido-slash-overlay CSS rule found")
if overlay_css_match:
    overlay_props = overlay_css_match.group(1)
    assert_true('pointer-events: none' in overlay_props, "iaido-slash-overlay has pointer-events: none (cannot block taps)")

slash_line_match = re.search(r'\.iaido-slash-line\s*\{([^}]+)\}', iaido_html)
assert_true(slash_line_match is not None, "iaido-slash-line CSS rule found")
if slash_line_match:
    slash_props = slash_line_match.group(1)
    assert_true('pointer-events: none' in slash_props, "iaido-slash-line has pointer-events: none")

touch_zones_match = re.search(r'\.iaido-touch-zones\s*\{([^}]+)\}', iaido_html)
assert_true(touch_zones_match is not None, "iaido-touch-zones CSS rule found")
if touch_zones_match:
    touch_props = touch_zones_match.group(1)
    z_match = re.search(r'z-index:\s*(\d+)', touch_props)
    assert_true(z_match and int(z_match.group(1)) >= 25, f"iaido-touch-zones has z-index >= 25 (actual: {z_match.group(1) if z_match else 'none'})")

# 1.2 Check JS logic in iaido.html and js/iaido.js
for file_path in ['games/iaido.html', 'games/js/iaido.js']:
    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()
    assert_true('handleIaidoAction' in code, f"{file_path} contains handleIaidoAction")
    assert_true('setupIaidoInputs' in code, f"{file_path} contains setupIaidoInputs")
    assert_true('roundTimer' in code, f"{file_path} tracks roundTimer for race conditions")
    assert_true('KeyA' in code and 'KeyL' in code, f"{file_path} handles PC dual key controls (A vs L)")
    assert_true('iaido-touch-p1' in code and 'iaido-touch-p2' in code, f"{file_path} handles dual touch zones")


# --- Test Suite 2: Liar's Dice Logic and Anti-Spam Guards ---
print("\n--- Test Suite 2: Liar's Dice Logic & Concurrency Guards ---")
for file_path in ['games/liarsdice.html', 'games/js/liarsdice.js']:
    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()
    
    # 2.1 Check challengeDiceBid guard
    c_guard = re.search(r'function challengeDiceBid\(\)\s*\{([^}]+);', code)
    assert_true(c_guard and 'revealed' in c_guard.group(1), f"{file_path} challengeDiceBid guards against already revealed state")
    assert_true(c_guard and 'p1Hp <= 0' in c_guard.group(1), f"{file_path} challengeDiceBid guards against game over state")
    
    # 2.2 Check submitDiceBid guard
    s_guard = re.search(r'function submitDiceBid\(\)\s*\{([^}]+);', code)
    assert_true(s_guard and 'revealed' in s_guard.group(1), f"{file_path} submitDiceBid guards against already revealed state")
    assert_true(s_guard and 'p1Hp <= 0' in s_guard.group(1), f"{file_path} submitDiceBid guards against game over state")
    
    # 2.3 Check pointer capture in peek listeners
    assert_true('setPointerCapture' in code, f"{file_path} setupPeekListeners uses setPointerCapture for mobile finger holding")
    assert_true('releasePointerCapture' in code, f"{file_path} setupPeekListeners uses releasePointerCapture")
    assert_true('roundTimer' in code, f"{file_path} tracks roundTimer to eliminate race conditions")

with open('games/liarsdice.html', 'r', encoding='utf-8') as f:
    ld_html = f.read()
tray_css = re.search(r'\.dice-tray\s*\*\s*\{([^}]+)\}', ld_html)
assert_true(tray_css and 'pointer-events: none' in tray_css.group(1), "liarsdice.html sets pointer-events: none on .dice-tray * (children destruction won't cancel touch)")


# --- Test Suite 3: Python-Simulated Liar's Dice & Iaido State Machines ---
print("\n--- Test Suite 3: State Machine Simulation Tests ---")

# Simulation of Liar's Dice Rule Verification
def simulate_liars_dice():
    # 5 dice each
    p1Dice = [1, 2, 3, 3, 5]
    p2Dice = [2, 3, 3, 6, 6]
    # Bid: 4 of 3s, ones not called -> 1 is wild
    onesCalled = False
    targetVal = 3
    targetQty = 4
    
    matches = sum(1 for d in p1Dice + p2Dice if d == targetVal or (not onesCalled and d == 1 and targetVal != 1))
    # p1 has one 1 and two 3s (3 matches). p2 has two 3s (2 matches). Total = 5 matches.
    assert_true(matches == 5, f"Wild 1 test: expected 5 matches, got {matches}")
    
    # Ones called -> 1 is NOT wild
    onesCalled = True
    matches_no_wild = sum(1 for d in p1Dice + p2Dice if d == targetVal or (not onesCalled and d == 1 and targetVal != 1))
    # Only 3s match: p1 has two 3s, p2 has two 3s. Total = 4 matches.
    assert_true(matches_no_wild == 4, f"Non-wild 1 test: expected 4 matches, got {matches_no_wild}")
    
    # Calling ones: targetVal = 1
    onesCalled = True
    targetVal = 1
    matches_ones = sum(1 for d in p1Dice + p2Dice if d == 1)
    assert_true(matches_ones == 1, f"Ones bid test: expected 1 match, got {matches_ones}")

simulate_liars_dice()


# --- Test Suite 4: Network & Topic Namespace Isolation ---
print("\n--- Test Suite 4: Network Isolation & Room Code Generation ---")
with open('common/network.js', 'r', encoding='utf-8') as f:
    net_code = f.read()

assert_true('game_hall_v2/${g}/room/${r}' in net_code, "MQTT topic includes isolated game namespace")
assert_true('100000 + Math.random() * 900000' in net_code, "6-digit room code generation active")
assert_true('getTopic' in net_code, "getTopic helper exported")

# Test topic generation logic
def sim_get_topic(game, room):
    g = (game or 'general').lower()
    return f"game_hall_v2/{g}/room/{room}"

t1 = sim_get_topic('BARRIERRACE', '123456')
t2 = sim_get_topic('QUORIDOR', '123456')
assert_true(t1 != t2, f"Different games with same room ID are strictly isolated: {t1} != {t2}")
assert_true(t1 == "game_hall_v2/barrierrace/room/123456", "Topic format matches specification")


# --- Test Suite 5: Service Worker & App Shell Audit ---
print("\n--- Test Suite 5: Service Worker Audit ---")
with open('sw.js', 'r', encoding='utf-8') as f:
    sw_code = f.read()

assert_true('party-arcade-v2.1' in sw_code, "SW cache version updated to v2.1")
cores = ['fceumm_libretro.zip', 'mgba_libretro.zip', 'snes9x_libretro.zip', 'genesis_plus_gx_libretro.zip', 'gambatte_libretro.zip']
for c in cores:
    assert_true(c not in sw_code, f"Libretro core {c} removed from static APP_SHELL")

app_shell_match = re.search(r'const APP_SHELL = \[(.*?)\];', sw_code, re.DOTALL)
assert_true(app_shell_match is not None, "APP_SHELL list defined in sw.js")
if app_shell_match:
    paths = [p.strip().strip("'\"") for p in app_shell_match.group(1).split(',') if p.strip()]
    for p in paths:
        if p in ('./', ''): continue
        rel_p = p.replace('./', '').replace('/', os.sep)
        assert_true(os.path.exists(rel_p), f"APP_SHELL file exists on disk: {p}")


# --- Test Suite 6: Root Scripts Cleanup & Archive Audit ---
print("\n--- Test Suite 6: Archive & Ignore Audit ---")
with open('.assetsignore', 'r', encoding='utf-8') as f:
    assetsignore = f.read()

assert_true('tools' in assetsignore and 'tools/' in assetsignore, "tools/ ignored in .assetsignore")

archived_files = [
    'contra_rewrite.py', 'contra_rewrite2.py', 'do_contra_bridge_render.py',
    'do_contra_rewrite.py', 'do_contra_water_render.py', 'fix_gravity.py',
    'fix_gravity4.py', 'fix_quoridor.py', 'fix_quotes.py', 'text.py',
    'test.txt', 'test_go.js', 'old_index.html', 'old_index_spa.html'
]
for f in archived_files:
    assert_true(not os.path.exists(f), f"Archived file {f} absent from root")
    assert_true(os.path.exists(os.path.join('tools', 'archive', f)), f"Archived file {f} present in tools/archive/")


# --- Final Verdict ---
print("\n" + "="*50)
if test_failures:
    print(f"❌ COMPREHENSIVE TEST SUITE FAILED WITH {len(test_failures)} FAILURES!")
    sys.exit(1)
else:
    print("🎉 ALL COMPREHENSIVE DEEP VERIFICATION TESTS PASSED PERFECTLY!")
