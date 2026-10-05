import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("==================================================")
print("  OPTION A: APPLE ARCADE / SWITCH OVERHAUL TESTS")
print("==================================================")

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

errors = []

# 1. Background Obsidian Style & Header Capsule
print("\n--- [1] Minimalist Luxe Palette & Obsidian Theme ---")
try:
    assert '#090d16' in html, "Obsidian background color #090d16 missing"
    assert '.app-header' in html and 'border-radius: 9999px' in html, "App header capsule border radius missing"
    assert '.lobby-controls-panel' in html and 'position: sticky' in html, "Sticky controls panel missing"
    print("  [PASS] Obsidian background, capsule header, and sticky controls verified.")
except Exception as e:
    errors.append(f"Visual Theme Error: {e}")
    print(f"  [FAIL] {e}")

# 2. Four Scenario-Based Genre Tabs Verification
print("\n--- [2] Four Scenario-Based Genre Tabs Verification ---")
try:
    assert '.genre-tabs-row' in html, ".genre-tabs-row container missing"
    assert 'data-genre="ALL"' in html, "Genre ALL tab missing"
    assert 'data-genre="BOARD"' in html, "Genre BOARD tab missing"
    assert 'data-genre="CHESS"' in html, "Genre CHESS tab missing"
    assert 'data-genre="ARCADE"' in html, "Genre ARCADE tab missing"
    assert 'data-genre="PARTY"' in html, "Genre PARTY tab missing"
    assert '国民桌游 & 纸牌' in html, "国民桌游 label missing"
    assert '传统棋弈 & 智谋' in html, "传统棋弈 label missing"
    assert '怀旧街机 & 动作' in html, "怀旧街机 label missing"
    assert '酒局破冰 & 反应' in html, "酒局破冰 label missing"
    print("  [PASS] 4 intuitive scenario genres and ALL tab verified.")
except Exception as e:
    errors.append(f"Genre Tabs Error: {e}")
    print(f"  [FAIL] {e}")

# 3. 26 Cards Genre Mapping & Integrity
print("\n--- [3] 26 Cards Genre & Online Attribute Matrix ---")
try:
    card_pattern = r'<div class="game-card[^"]*"([^>]*)>'
    cards = []
    for m in re.finditer(card_pattern, html):
        attrs = m.group(1)
        k = re.search(r'data-game-key="([^"]+)"', attrs)
        g = re.search(r'data-genre="([^"]+)"', attrs)
        o = re.search(r'data-online="([^"]+)"', attrs)
        if k and g:
            cards.append({
                'key': k.group(1),
                'genre': g.group(1),
                'online': o.group(1) if o else 'false'
            })
    
    assert len(cards) == 26, f"Expected 26 cards, got {len(cards)}"
    
    genre_counts = {}
    for c in cards:
        genre_counts[c['genre']] = genre_counts.get(c['genre'], 0) + 1
    
    print(f"  Genre counts: {genre_counts}")
    assert genre_counts.get('BOARD') == 7, f"Expected 7 BOARD games, got {genre_counts.get('BOARD')}"
    assert genre_counts.get('CHESS') == 8, f"Expected 8 CHESS games, got {genre_counts.get('CHESS')}"
    assert genre_counts.get('ARCADE') == 8, f"Expected 8 ARCADE games, got {genre_counts.get('ARCADE')}"
    assert genre_counts.get('PARTY') == 3, f"Expected 3 PARTY games, got {genre_counts.get('PARTY')}"
    
    online_count = sum(1 for c in cards if c['online'] == 'true')
    print(f"  Online games count: {online_count}")
    assert online_count >= 18, f"Expected at least 18 online games, got {online_count}"
    print("  [PASS] Exactly 26 cards verified across 4 genres with online tags.")
except Exception as e:
    errors.append(f"Card Matrix Error: {e}")
    print(f"  [FAIL] {e}")

# 4. Decluttered Cards (Meta-chips hidden)
print("\n--- [4] Decluttered Aesthetic Verification ---")
try:
    assert '.card-meta-chips' in html and 'display: none !important' in html, "Meta chips not hidden in CSS"
    assert '.btn-play-action' in html and 'border-radius: 9999px' in html, "Apple capsule play button missing"
    print("  [PASS] Dense chip text soup hidden, Apple Arcade capsule button verified.")
except Exception as e:
    errors.append(f"Declutter Error: {e}")
    print(f"  [FAIL] {e}")

# 5. JS Filtering Functions
print("\n--- [5] JS Filtering Functions Verification ---")
try:
    assert 'setGenreFilter' in html, "setGenreFilter function missing"
    assert 'setPlayerFilter' in html, "setPlayerFilter function missing"
    assert 'applyFilters' in html, "applyFilters function missing"
    assert 'resetAllFilters' in html, "resetAllFilters function missing"
    assert 'filterLobby' in html, "filterLobby bridge missing"
    print("  [PASS] All filtering functions and legacy bridge verified.")
except Exception as e:
    errors.append(f"JS Filter Error: {e}")
    print(f"  [FAIL] {e}")

print("\n==================================================")
if errors:
    print(f"  [FAILED] {len(errors)} ERRORS DETECTED:")
    for err in errors:
        print(f"    - {err}")
    sys.exit(1)
else:
    print("  [ALL PASS] OPTION A OVERHAUL VERIFICATION SUCCESSFUL!")
print("==================================================")
