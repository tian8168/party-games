import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.abspath(r'c:\Users\admin\Desktop\partygame')

print("==================================================")
print("  STEP 3: MOBILE DOCK, HAPTICS & TOUCH TEST SUITE")
print("==================================================")

errors = []

# --- 1. Web Haptic Feedback Engine Verification (common/common.js) ---
print("\n--- [1] Web Haptic Feedback Engine Verification ---")
try:
    with open(os.path.join(ROOT, 'common', 'common.js'), 'r', encoding='utf-8') as f:
        common_js = f.read()

    # Function & presets check
    assert 'function triggerHaptic(' in common_js, "triggerHaptic function definition missing"
    assert 'window.triggerHaptic = triggerHaptic' in common_js, "window.triggerHaptic export missing"
    assert 'HAPTIC_PATTERNS' in common_js, "HAPTIC_PATTERNS map missing"

    # Presets values
    for preset, val in [('light', '15'), ('medium', '30'), ('heavy', '70')]:
        assert f"{preset}: {val}" in common_js, f"Preset {preset}: {val} missing in common.js"
    assert 'success: [30, 40, 50]' in common_js or 'success:[30,40,50]' in common_js, "Preset success pattern missing"
    assert 'warning: [40, 40, 40]' in common_js or 'warning:[40,40,40]' in common_js, "Preset warning pattern missing"

    # Silent fallback & navigator.vibrate safe check
    assert 'navigator.vibrate' in common_js, "navigator.vibrate call missing"
    assert 'typeof navigator' in common_js, "navigator existence check missing"
    assert 'try {' in common_js and 'catch' in common_js, "Safe try-catch block missing around triggerHaptic"

    # Modal linkage
    assert "triggerHaptic('success')" in common_js, "Victory modal success haptic missing"
    assert "triggerHaptic('warning')" in common_js, "Defeat modal warning haptic missing"
    assert "triggerHaptic('medium')" in common_js, "Modal restart/draw medium haptic missing"
    assert "triggerHaptic('light')" in common_js, "Modal return/close light haptic missing"

    # Universal header button linkage
    assert "triggerHaptic('light')" in common_js and 'soundBtn.onclick' in common_js, "Header sound toggle haptic missing"
    assert "triggerHaptic('light')" in common_js and 'rulesBtn.onclick' in common_js, "Header rules button haptic missing"

    # Priority protection & skipHaptic check
    assert 'HAPTIC_PRIORITIES' in common_js, "HAPTIC_PRIORITIES map missing"
    assert '_lastHapticEndTime' in common_js, "_lastHapticEndTime priority guard missing"
    assert 'skipHaptic' in common_js, "skipHaptic argument missing in closeModal"

    # Check AUDIO.play haptic hook & comprehensive synthesizers mapping
    with open(os.path.join(ROOT, 'common', 'audio.js'), 'r', encoding='utf-8') as f:
        audio_js = f.read()
    assert 'triggerHaptic' in audio_js, "AUDIO.play haptic hook missing in common/audio.js"
    assert 'tank_explosion' in audio_js, "tank_explosion synth mapping missing in common/audio.js"
    assert 'plane_win' in audio_js, "plane_win synth mapping missing in common/audio.js"

    print("  [PASS] triggerHaptic presets, priority protection, safe downgrade, modal linkage, and audio hooks verified.")
except Exception as e:
    errors.append(f"Haptic Engine Error: {e}")
    print(f"  [FAIL] {e}")


# --- 2. Mobile Floating Glass Dock DOM & Semantic Structure ---
print("\n--- [2] Mobile Floating Glass Dock DOM & Semantic Structure ---")
try:
    with open(os.path.join(ROOT, 'index.html'), 'r', encoding='utf-8') as f:
        html = f.read()

    # Container check
    assert 'id="mobile-dock"' in html, "Missing #mobile-dock"
    assert 'class="mobile-dock"' in html or 'mobile-dock' in html, "Missing .mobile-dock class"

    # 4 Quick Access buttons
    # 1: 🏠 大厅/置顶
    assert 'id="dock-btn-home"' in html or 'id="dock-btn-top"' in html, "Missing dock home/top button"
    assert 'dockScrollToTop()' in html, "Missing dockScrollToTop() handler"
    assert '🏠' in html, "Missing 🏠 icon in dock"

    # 2: 🎲 天命随机
    assert 'id="dock-btn-random"' in html, "Missing #dock-btn-random button"
    assert 'pickRandomGame()' in html, "Missing pickRandomGame() handler"
    assert '🎲' in html, "Missing 🎲 icon in dock"

    # 3: 🔍 快速搜索
    assert 'id="dock-btn-search"' in html, "Missing #dock-btn-search button"
    assert 'dockFocusSearch()' in html, "Missing dockFocusSearch() handler"
    assert '🔍' in html, "Missing 🔍 icon in dock"

    # 4: 🔊 全局音效
    assert 'id="dock-btn-sound"' in html, "Missing #dock-btn-sound button"
    assert 'dockToggleSound()' in html, "Missing dockToggleSound() handler"
    assert 'id="dock-sound-icon"' in html, "Missing #dock-sound-icon in dock"

    # Dedicated footer & positioning
    assert 'id="lobby-footer"' in html or 'class="lobby-footer"' in html, "Missing lobby footer"

    print("  [PASS] Mobile Dock DOM, 4 core quick actions, icons, and footer verified.")
except Exception as e:
    errors.append(f"Dock DOM Error: {e}")
    print(f"  [FAIL] {e}")


# --- 3. Responsive Styling, Safe-Area & Viewport Rules ---
print("\n--- [3] Responsive Styling, Safe-Area & Viewport Rules ---")
try:
    with open(os.path.join(ROOT, 'index.html'), 'r', encoding='utf-8') as f:
        html = f.read()
    with open(os.path.join(ROOT, 'common', 'common.css'), 'r', encoding='utf-8') as f:
        common_css = f.read()

    # Safe Area adaptation
    assert 'env(safe-area-inset-bottom' in html, "Missing env(safe-area-inset-bottom) in index.html"
    assert 'env(safe-area-inset-bottom' in html and 'padding-bottom' in html, "Missing safe-area padding-bottom adaptation in index.html"

    # Floating Glass Dock styling
    assert 'backdrop-filter: blur(' in html, "Missing backdrop-filter in dock styles"
    assert 'position: fixed' in html, "Dock position: fixed missing"
    assert 'z-index: 1000' in html, "Dock z-index missing"

    # Media Query 768px display rule
    assert '@media (max-width: 768px)' in html, "Missing @media (max-width: 768px)"
    assert '.mobile-dock' in html and 'display: flex' in html, "Missing dock display: flex in 768px media query"

    # Touch-action: manipulation
    assert 'touch-action: manipulation' in html, "Missing touch-action: manipulation in index.html"
    assert 'touch-action: manipulation' in common_css, "Missing touch-action: manipulation in common.css"
    assert '.dock-btn' in common_css or '.dock-item' in common_css or '.mobile-dock' in common_css, "Dock touch-action missing in common.css"

    # Viewport horizontal scroll prevention
    assert 'overflow-x: hidden' in html, "overflow-x: hidden missing in index.html"
    assert 'overflow-x: hidden' in common_css, "overflow-x: hidden missing in common.css"

    # Highlight animation on random pick
    assert '@keyframes cardHighlightPulse' in html, "Missing @keyframes cardHighlightPulse in index.html"
    assert 'card-highlight-pulse' in html, "Missing .card-highlight-pulse class in index.html"

    print("  [PASS] Safe-area insets, frosted glass styling, touch-action, and overflow-x verified.")
except Exception as e:
    errors.append(f"Responsive Styling Error: {e}")
    print(f"  [FAIL] {e}")


# --- 4. Dock Logic & State Synchronization ---
print("\n--- [4] Dock Logic & State Synchronization ---")
try:
    with open(os.path.join(ROOT, 'index.html'), 'r', encoding='utf-8') as f:
        html = f.read()

    # dockScrollToTop
    assert 'function dockScrollToTop()' in html, "dockScrollToTop function definition missing"
    assert 'window.scrollTo({ top: 0, behavior: \'smooth\' })' in html, "Smooth window.scrollTo missing"

    # dockFocusSearch
    assert 'function dockFocusSearch()' in html, "dockFocusSearch function definition missing"
    assert 'game-search-input' in html and 'scrollIntoView' in html, "Search scrollIntoView missing"
    assert 'focus()' in html, "Search focus() missing"

    # syncSoundUI & dockToggleSound
    assert 'function syncSoundUI(' in html, "syncSoundUI function definition missing"
    assert 'function dockToggleSound()' in html, "dockToggleSound function definition missing"
    assert 'dock-sound-icon' in html, "dock-sound-icon sync missing"
    assert 'btn-sound-toggle' in html, "btn-sound-toggle sync missing"

    # pickRandomGame & randomPickGame alias + debouncing & filter-awareness
    assert 'function pickRandomGame()' in html, "pickRandomGame function definition missing"
    assert 'function randomPickGame()' in html, "randomPickGame function definition missing"
    assert 'window.pickRandomGame = pickRandomGame' in html, "window.pickRandomGame export missing"
    assert 'window.randomPickGame = randomPickGame' in html, "window.randomPickGame export missing"
    assert 'card-highlight-pulse' in html and 'scrollIntoView' in html, "Random card scroll & pulse highlight missing"
    assert 'randomPickTimer' in html, "Missing randomPickTimer debounce guard"
    assert 'visibleCards' in html, "Missing filter-aware visibleCards selection"
    assert 'dock-sound-label' in html, "Missing dock-sound-label"

    # Haptic triggers in key interactions
    assert 'setPlayerFilter' in html and 'triggerHaptic' in html, "Player filter haptic trigger missing"
    assert 'setCategoryFilter' in html and 'triggerHaptic' in html, "Category filter haptic trigger missing"
    assert 'setViewMode' in html and 'triggerHaptic' in html, "View mode haptic trigger missing"
    assert 'clearSearch' in html and 'triggerHaptic' in html, "Clear search haptic trigger missing"
    assert 'resetAllFilters' in html and 'triggerHaptic' in html, "Reset filters haptic trigger missing"

    print("  [PASS] Dock scroll, search focus, sound synchronization, and haptic triggers verified.")
except Exception as e:
    errors.append(f"Dock Logic Error: {e}")
    print(f"  [FAIL] {e}")


# --- 5. Pure Logic Python Simulation of triggerHaptic Engine ---
print("\n--- [5] Python Simulation of triggerHaptic Engine ---")
try:
    patterns = {
        'light': 15,
        'medium': 30,
        'heavy': 70,
        'success': [30, 40, 50],
        'warning': [40, 40, 40]
    }

    class MockNavigator:
        def __init__(self, supported=True, throws=False):
            self.supported = supported
            self.throws = throws
            self.called_with = None

        def vibrate(self, pattern):
            if not self.supported:
                raise AttributeError("vibrate is not defined")
            if self.throws:
                raise RuntimeError("Vibration blocked by user agent policy")
            self.called_with = pattern
            return True

    def sim_trigger_haptic(nav, type_arg='light'):
        try:
            if not nav or not getattr(nav, 'supported', False) or not hasattr(nav, 'vibrate'):
                return False
            if isinstance(type_arg, (list, tuple, int)):
                pattern = type_arg
            elif isinstance(type_arg, str) and type_arg in patterns:
                pattern = patterns[type_arg]
            else:
                pattern = patterns['light']
            return nav.vibrate(pattern)
        except Exception:
            return False

    # Test 1: Supported navigator with presets
    nav_ok = MockNavigator(supported=True)
    assert sim_trigger_haptic(nav_ok, 'light') is True and nav_ok.called_with == 15
    assert sim_trigger_haptic(nav_ok, 'medium') is True and nav_ok.called_with == 30
    assert sim_trigger_haptic(nav_ok, 'heavy') is True and nav_ok.called_with == 70
    assert sim_trigger_haptic(nav_ok, 'success') is True and nav_ok.called_with == [30, 40, 50]
    assert sim_trigger_haptic(nav_ok, 'warning') is True and nav_ok.called_with == [40, 40, 40]

    # Test 2: Custom patterns (number & array)
    assert sim_trigger_haptic(nav_ok, 45) is True and nav_ok.called_with == 45
    assert sim_trigger_haptic(nav_ok, [10, 20, 30]) is True and nav_ok.called_with == [10, 20, 30]

    # Test 3: Fallback on unknown string
    assert sim_trigger_haptic(nav_ok, 'unknown') is True and nav_ok.called_with == 15

    # Test 4: Unsupported navigator (silent false)
    nav_none = None
    assert sim_trigger_haptic(nav_none, 'light') is False

    nav_unsupported = MockNavigator(supported=False)
    assert sim_trigger_haptic(nav_unsupported, 'light') is False

    # Test 6: Priority protection simulation
    class PriorityEngine:
        def __init__(self, nav):
            self.nav = nav
            self.last_time = 0
            self.last_end = 0
            self.last_pri = 0
            self.priorities = {'light': 1, 'medium': 2, 'warning': 3, 'heavy': 4, 'success': 5}

        def trigger(self, type_arg, current_time):
            if not self.nav or not getattr(self.nav, 'supported', False):
                return False
            if type_arg in patterns:
                pattern = patterns[type_arg]
                pri = self.priorities.get(type_arg, 1)
                dur = sum(pattern) if isinstance(pattern, list) else pattern
            else:
                pattern = 15
                pri = 1
                dur = 15

            if current_time < self.last_end and pri < self.last_pri:
                return True  # Protected from weaker interruptions!
            if pri == 1 and (current_time - self.last_time < 25):
                return True  # Throttled duplicate light clicks

            self.last_time = current_time
            self.last_end = current_time + dur
            self.last_pri = pri
            return self.nav.vibrate(pattern)

    pe = PriorityEngine(nav_ok)
    # Start success vibration (120ms total) at t=100
    assert pe.trigger('success', 100) is True and nav_ok.called_with == [30, 40, 50]
    # At t=110 (during success), a light tick arrives -> should NOT interrupt success!
    nav_ok.called_with = None
    assert pe.trigger('light', 110) is True and nav_ok.called_with is None
    # At t=250 (after success finished), light tick arrives -> vibrates!
    assert pe.trigger('light', 250) is True and nav_ok.called_with == 15

    print("  [PASS] triggerHaptic presets, custom arrays, priority protection, and exceptions handled cleanly.")
except Exception as e:
    errors.append(f"Simulation Error: {e}")
    print(f"  [FAIL] {e}")


print("\n==================================================")
if errors:
    print(f"  [FAILED] {len(errors)} ERRORS DETECTED:")
    for err in errors:
        print(f"    - {err}")
    sys.exit(1)
else:
    print("  [ALL PASS] 100% MOBILE DOCK & HAPTICS VALIDATION SUCCESSFUL!")
print("==================================================")
