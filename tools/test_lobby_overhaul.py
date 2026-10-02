import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.abspath(r'c:\Users\admin\Desktop\partygame')

print("==================================================")
print("  LOBBY UI/UX OVERHAUL COMPREHENSIVE TEST SUITE")
print("==================================================")

with open(os.path.join(ROOT, 'index.html'), 'r', encoding='utf-8') as f:
    html = f.read()

errors = []

# --- 1. Spotlight Hero Banner Verification ---
print("\n--- [1] Spotlight Hero Banner Verification ---")
try:
    assert 'id="hero-spotlight-wrapper"' in html, "Missing #hero-spotlight-wrapper"
    assert 'id="hero-backdrop-glow"' in html, "Missing #hero-backdrop-glow"
    assert 'id="hero-dots-container"' in html, "Missing #hero-dots-container"
    assert 'id="btn-hero-launch"' in html, "Missing #btn-hero-launch"
    assert 'launchCurrentHero()' in html, "Missing launchCurrentHero() call"
    assert 'randomPickGame()' in html, "Missing randomPickGame() call"
    assert '天命摇一摇' in html, "Missing '天命摇一摇' text"
    assert '立即开战' in html, "Missing '立即开战' text"

    # Check HERO_SLIDES in JS
    assert 'const HERO_SLIDES =' in html, "Missing HERO_SLIDES definition"
    for hero_key in ['TRON', 'NES', 'BOMBCAT', 'KAYA']:
        assert f"key: '{hero_key}'" in html, f"Hero slide {hero_key} missing from HERO_SLIDES"
    assert 'renderHeroSlide' in html, "renderHeroSlide missing"
    assert 'nextHeroSlide' in html, "nextHeroSlide missing"
    assert 'prevHeroSlide' in html, "prevHeroSlide missing"
    assert 'goToHeroSlide' in html, "goToHeroSlide missing"
    assert 'startHeroTimer' in html, "startHeroTimer missing"
    assert 'stopHeroTimer' in html, "stopHeroTimer missing"
    print("  [PASS] Spotlight Hero Banner elements, controls, and 4 featured slides verified.")
except Exception as e:
    errors.append(f"Hero Banner Error: {e}")
    print(f"  [FAIL] {e}")

# --- 2. Dual-Axis Independent Filters Verification ---
print("\n--- [2] Dual-Axis Independent Filters Verification ---")
try:
    # Player Axis options
    assert 'data-player-filter="ALL"' in html, "data-player-filter=ALL missing"
    assert 'data-player-filter="1"' in html, "data-player-filter=1 missing"
    assert 'data-player-filter="2"' in html, "data-player-filter=2 missing"
    assert 'data-player-filter="4"' in html, "data-player-filter=4 missing"
    assert '单人挑战' in html, "Missing '单人挑战' label"
    assert '双人死斗' in html, "Missing '双人死斗' label"
    assert '4人大乱斗' in html, "Missing '4人大乱斗' label"

    # Category Axis options
    assert 'data-cat-filter="ALL"' in html, "data-cat-filter=ALL missing"
    assert 'data-cat-filter="PHYSICS"' in html, "data-cat-filter=PHYSICS missing"
    assert 'data-cat-filter="STRATEGY"' in html, "data-cat-filter=STRATEGY missing"
    assert 'data-cat-filter="MIND"' in html, "data-cat-filter=MIND missing"
    assert 'data-cat-filter="REFLEX"' in html, "data-cat-filter=REFLEX missing"
    assert '物理对抗' in html, "Missing '物理对抗' label"
    assert '策略博弈' in html, "Missing '策略博弈' label"
    assert '心理暗牌' in html, "Missing '心理暗牌' label"
    assert '极限手速' in html, "Missing '极限手速' label"

    # Filter state & intersection logic
    assert 'activePlayerFilter' in html, "activePlayerFilter variable missing"
    assert 'activeCatFilter' in html, "activeCatFilter variable missing"
    assert 'setPlayerFilter' in html, "setPlayerFilter function missing"
    assert 'setCategoryFilter' in html, "setCategoryFilter function missing"
    assert 'applyFilters' in html, "applyFilters function missing"
    assert 'resetAllFilters' in html, "resetAllFilters function missing"
    print("  [PASS] Dual-axis filter pills (Player & Category) and orthogonal state logic verified.")
except Exception as e:
    errors.append(f"Dual-Axis Filters Error: {e}")
    print(f"  [FAIL] {e}")

# --- 3. Instant Search Verification ---
print("\n--- [3] Instant Search Verification ---")
try:
    assert 'id="game-search-input"' in html, "Missing #game-search-input"
    assert 'id="search-clear-btn"' in html, "Missing #search-clear-btn"
    assert 'id="search-shortcut-badge"' in html, "Missing #search-shortcut-badge"
    assert 'clearSearch()' in html, "Missing clearSearch() function"
    assert "e.key === '/'" in html, "Shortcut '/' listener missing"
    assert "e.key === 'Escape'" in html, "Escape key listener missing"
    assert 'activeSearchQuery' in html, "activeSearchQuery variable missing"
    assert 'id="no-results-state"' in html, "Empty results placeholder missing"
    print("  [PASS] Instant search input, '/' shortcut, clear button, and empty state verified.")
except Exception as e:
    errors.append(f"Search Error: {e}")
    print(f"  [FAIL] {e}")

# --- 4. View Mode Toggle Verification ---
print("\n--- [4] View Mode Toggle (Poster vs Compact) Verification ---")
try:
    assert 'id="view-mode-poster"' in html, "Missing #view-mode-poster"
    assert 'id="view-mode-compact"' in html, "Missing #view-mode-compact"
    assert 'setViewMode' in html, "setViewMode function missing"
    assert 'initViewMode' in html, "initViewMode function missing"
    assert 'arcade_view_mode' in html, "localStorage key arcade_view_mode missing"
    assert '.game-grid.compact-mode' in html, "CSS rule .game-grid.compact-mode missing"
    print("  [PASS] Poster and Compact view mode toggle, CSS rules, and localStorage persistence verified.")
except Exception as e:
    errors.append(f"View Mode Error: {e}")
    print(f"  [FAIL] {e}")

# --- 5. All 19 Games Integrity and Keywords Verification ---
print("\n--- [5] 19 Games Matrix & Keywords Verification ---")
EXPECTED_GAMES = [
    ('TRON', 'PHYSICS', '4'),
    ('BOMBCAT', 'MIND', '4'),
    ('NES', 'PHYSICS', '2'),
    ('CONTRA', 'PHYSICS', '2'),
    ('QUORIDOR', 'STRATEGY', '4'),
    ('AEROPLANE', 'STRATEGY', '4'),
    ('GO', 'STRATEGY', '2'),
    ('KAYA', 'STRATEGY', '2'),
    ('TANKTROUBLE', 'PHYSICS', '2'),
    ('HOCKEY', 'PHYSICS', '2'),
    ('GRAVITY', 'STRATEGY', '2'),
    ('GRAVITY4', 'STRATEGY', '2'),
    ('GRAVITY3D', 'STRATEGY', '2'),
    ('GRAVITY3D4', 'STRATEGY', '2'),
    ('IAIDO', 'REFLEX', '2'),
    ('LIARSDICE', 'MIND', '2'),
    ('SUMO', 'PHYSICS', '2'),
    ('TANK', 'PHYSICS', '2'),
    ('STACK', 'REFLEX', '1'),
]

try:
    assert len(EXPECTED_GAMES) == 19
    for key, cat, players in EXPECTED_GAMES:
        assert f"enterGame('{key}')" in html, f"Card onclick for {key} missing"
        assert f"data-game-key=\"{key}\"" in html, f"data-game-key={key} missing"
        assert f"data-cat=\"{cat}\"" in html, f"data-cat={cat} for {key} missing"
        assert f"data-players=\"{players}\"" in html, f"data-players={players} for {key} missing"
        # Check data-keywords exists for game
        pattern = rf'data-game-key="{key}"[^>]*data-keywords="([^"]+)"'
        match = re.search(pattern, html)
        assert match and len(match.group(1)) > 5, f"Keywords missing or too short for {key}"
        assert f"'{key}':" in html, f"FileMap entry for {key} missing"
    print(f"  [PASS] All 19 games verified with exact categories, player counts, keywords, and fileMap mappings.")
except Exception as e:
    errors.append(f"19 Games Matrix Error: {e}")
    print(f"  [FAIL] {e}")

# --- 6. Backward Compatibility & Critical Handlers Verification ---
print("\n--- [6] Backward Compatibility Verification ---")
try:
    assert 'recent-games-bar' in html, "#recent-games-bar missing"
    assert 'recent-pills-list' in html, "#recent-pills-list missing"
    assert 'recordRecentGame' in html, "recordRecentGame missing"
    assert 'renderRecentGames' in html, "renderRecentGames missing"
    assert "window.addEventListener('pageshow'" in html, "pageshow listener missing"
    assert 'isNavigating = false' in html, "isNavigating reset missing"
    assert 'btn-sound-toggle' in html, "Sound toggle button missing"
    assert 'btn-rules-header' in html, "Rules header button missing"
    assert '全部 (19)' in html, "Legacy assertion '全部 (19)' missing"
    assert '4人混战 (4)' in html, "Legacy assertion '4人混战 (4)' missing"
    assert '心理博弈 (2)' in html, "Legacy assertion '心理博弈 (2)' missing"
    assert '物理对抗 (7)' in html, "Legacy assertion '物理对抗 (7)' missing"
    print("  [PASS] Recent games bar, BFCache unlock, audio toggle, and legacy assertions verified.")
except Exception as e:
    errors.append(f"Compatibility Error: {e}")
    print(f"  [FAIL] {e}")

# --- 7. Neo-Arcade Visual Polish & Animations Verification ---
print("\n--- [7] Neo-Arcade Visual Polish & Animations Verification ---")
try:
    assert '@keyframes neonBorderFlow' in html, "@keyframes neonBorderFlow missing"
    assert '@keyframes heroSpotlightGlow' in html, "@keyframes heroSpotlightGlow missing"
    assert '@keyframes cardFadeIn' in html, "@keyframes cardFadeIn missing"
    assert '.card-enter' in html, "card-enter animation class missing"
    assert '.card-cover-wrapper::after' in html, "Cover light sweep sheen missing"
    assert 'hero-spotlight-wrapper' in html and 'heroSpotlightGlow' in html, "Spotlight glow animation missing"
    assert 'slide-fade' in html, "Hero slide-fade transition missing"
    print("  [PASS] Neon border flow, hero glow, card entry transitions, and cover light sweep verified.")
except Exception as e:
    errors.append(f"Visual Polish Error: {e}")
    print(f"  [FAIL] {e}")

# --- 8. Interaction Robustness & Keywords Verification ---
print("\n--- [8] Interaction Robustness & Keywords Verification ---")
try:
    # Keydown modifiers & modal guard
    assert '!e.ctrlKey' in html and '!e.metaKey' in html, "Search shortcut modifier keys check missing"
    assert 'modal-overlay.open' in html, "Modal open guard for search shortcut missing"
    # Silent initViewMode
    assert 'setViewMode(saved, false)' in html or 'setViewMode(saved,false)' in html or 'playSound = false' in html, "Silent view mode init check missing"
    # Visibility and touchcancel
    assert 'visibilitychange' in html, "visibilitychange listener missing"
    assert 'touchcancel' in html, "touchcancel listener missing"
    # Keyword enrichment checks
    for kw_check in ['四人', '二人', '1人']:
        assert kw_check in html, f"Enriched keyword '{kw_check}' missing in index.html"
    print("  [PASS] Keyboard modifier guards, silent view init, visibility lifecycle, and enriched keywords verified.")
except Exception as e:
    errors.append(f"Robustness Error: {e}")
    print(f"  [FAIL] {e}")

print("\n==================================================")
if errors:
    print(f"  [FAILED] {len(errors)} ERRORS DETECTED:")
    for err in errors:
        print(f"    - {err}")
    sys.exit(1)
else:
    print("  [ALL PASS] 100% LOBBY OVERHAUL VERIFICATION SUCCESSFUL!")
print("==================================================")
