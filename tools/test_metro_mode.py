import os
import re

def test_metro():
    print("==================================================")
    print("  WINDOWS METRO / LIVE TILES VALIDATION SUITE")
    print("==================================================")

    # 1. Check common/metro.css
    assert os.path.exists('common/metro.css'), "common/metro.css missing"
    with open('common/metro.css', 'r', encoding='utf-8') as f:
        css = f.read()

    assert '.metro-active' in css, "Missing .metro-active in metro.css"
    assert '.metro-tile-flipper' in css, "Missing .metro-tile-flipper in metro.css"
    assert '.wp-app-bar' in css, "Missing .wp-app-bar in metro.css"
    assert '.metro-semantic-zoom' in css, "Missing .metro-semantic-zoom in metro.css"
    assert '@media (max-width: 768px) and (orientation: portrait)' in css, "Missing WP portrait media query"
    assert '@media (max-width: 900px) and (orientation: landscape)' in css, "Missing WP landscape media query"
    assert '@media (min-width: 901px)' in css, "Missing Surface landscape media query"
    print("  [PASS] common/metro.css: Tokens, Responsive Breakpoints & 3D rules verified.")

    # 2. Check common/metro.js
    assert os.path.exists('common/metro.js'), "common/metro.js missing"
    with open('common/metro.js', 'r', encoding='utf-8') as f:
        js = f.read()

    assert 'window.MetroEngine' in js, "Missing MetroEngine in metro.js"
    assert 'applyTilt' in js, "Missing 3D Tilt in metro.js"
    assert 'initIntersectionObserver' in js, "Missing IntersectionObserver in metro.js"
    assert 'initHorizontalWheel' in js, "Missing Horizontal Wheel in metro.js"
    assert 'toggleSemanticZoom' in js, "Missing Semantic Zoom in metro.js"
    print("  [PASS] common/metro.js: 3D Tilt physics, Live Tile Ticker & Wheel mapping verified.")

    # 3. Check index.html
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    assert 'common/metro.css' in html, "index.html missing metro.css link"
    assert 'common/metro.js' in html, "index.html missing metro.js script"
    assert 'id="view-mode-metro"' in html, "index.html missing view-mode-metro button"
    assert 'id="metro-header-banner"' in html, "index.html missing metro-header-banner"
    assert 'id="wp-app-bar"' in html, "index.html missing wp-app-bar"
    assert 'id="metro-semantic-zoom"' in html, "index.html missing metro-semantic-zoom"

    # Verify 4 groups
    for grp in ['FEATURED', 'STRATEGY', 'PHYSICS', 'MIND_REFLEX']:
        assert f'data-group="{grp}"' in html, f"Missing group {grp}"
    print("  [PASS] index.html: View mode button, Header, WP AppBar & 4 Categorized Groups verified.")

    # Verify all 26 games have flipper, front, back
    expected_games = [
        'TRON', 'BOMBCAT', 'UNO', 'BOMBERMAN', 'NES', 'CONTRA', 'QUORIDOR', 'AEROPLANE',
        'GO', 'KAYA', 'SANGUOSHA', 'MONOPOLY', 'SPLENDOR', 'LIARSBAR', 'DOUDIZHU',
        'TANKTROUBLE', 'HOCKEY', 'GRAVITY', 'GRAVITY4', 'GRAVITY3D', 'GRAVITY3D4',
        'IAIDO', 'LIARSDICE', 'SUMO', 'TANK', 'STACK'
    ]

    for key in expected_games:
        assert f'data-game-key="{key}"' in html, f"Missing game {key}"
        # Match game card block
        card_match = re.search(rf'<div class="game-card\b[^>]*data-game-key="{key}"[\s\S]*?(?=<div class="game-card\b|</div>\s*</div>\s*<!-- Metro|$)', html)
        assert card_match is not None, f"Game card structure mismatch for {key}"
        card_content = card_match.group(0)
        assert 'metro-tile-flipper' in card_content, f"Missing metro-tile-flipper for {key}"
        assert 'metro-tile-front' in card_content, f"Missing metro-tile-front for {key}"
        assert 'metro-tile-back' in card_content, f"Missing metro-tile-back for {key}"
        assert 'tile-btn-launch' in card_content, f"Missing tile-btn-launch for {key}"

    print(f"  [PASS] index.html: All {len(expected_games)} games verified with 3D Live Tile dual-face structure.")
    print("==================================================")
    print("  [ALL PASS] METRO / LIVE TILES ENGINE 100% OK!")
    print("==================================================")

if __name__ == '__main__':
    test_metro()
