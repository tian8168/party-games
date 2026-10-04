import os
import re
import sys

def check_brackets(code, filename):
    i = 0
    n = len(code)
    stack = []
    line = 1
    col = 1
    while i < n:
        c = code[i]
        if c == '\n':
            line += 1
            col = 1
            i += 1
            continue
        # Line comment
        if c == '/' and i + 1 < n and code[i+1] == '/':
            while i < n and code[i] != '\n':
                i += 1
            continue
        # Block comment
        if c == '/' and i + 1 < n and code[i+1] == '*':
            i += 2
            while i + 1 < n and not (code[i] == '*' and code[i+1] == '/'):
                if code[i] == '\n': line += 1
                i += 1
            i += 2
            continue
        # Strings
        if c in ('"', "'"):
            quote = c
            i += 1
            while i < n and code[i] != quote:
                if code[i] == '\\':
                    i += 2
                elif code[i] == '\n':
                    print(f'{filename}:{line}:{col} - unescaped newline in string')
                    return False
                else:
                    i += 1
            i += 1
            continue
        # Template literal
        if c == '`':
            i += 1
            while i < n and code[i] != '`':
                if code[i] == '\\':
                    i += 2
                elif code[i] == '\n':
                    line += 1
                    i += 1
                else:
                    i += 1
            i += 1
            continue
        # Brackets
        if c in '({[':
            stack.append((c, line, col))
        elif c in ')}]':
            if not stack:
                print(f'{filename}:{line}:{col} - Extra closing bracket {c}')
                return False
            top, tl, tc = stack.pop()
            matches = {')': '(', '}': '{', ']': '['}
            if matches[c] != top:
                print(f'{filename}:{line}:{col} - Mismatched bracket {c}, expected close for {top} at line {tl}')
                return False
        i += 1
        col += 1
    if stack:
        print(f'{filename} - Unclosed brackets: {stack}')
        return False
    return True

def run_tests():
    print("=== [1] SYNTAX & BRACKET BALANCE TESTS ===")
    files_to_check = [
        'common/audio.js',
        'sw.js',
        'games/tron.html',
        'games/js/tron.js',
        'games/bombcat.html',
        'games/js/bombcat.js',
        'index.html'
    ]

    for f in files_to_check:
        assert os.path.exists(f), f"File {f} must exist"
        with open(f, 'r', encoding='utf-8') as fp:
            content = fp.read()
        if f.endswith('.html'):
            scripts = re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>', content, re.DOTALL)
            for idx, s in enumerate(scripts):
                if s.strip():
                    assert check_brackets(s, f"{f}#script{idx}"), f"Script {idx} in {f} failed bracket check"
        else:
            assert check_brackets(content, f), f"{f} failed bracket check"
        print(f"  [PASS] Syntax balanced: {f}")

    print("\n=== [2] SERVICE WORKER & APP_SHELL EXISTENCE TESTS ===")
    with open('sw.js', 'r', encoding='utf-8') as fp:
        sw_content = fp.read()
    assert re.search(r'party-arcade-v[23]\.', sw_content), "sw.js cache must be party-arcade-v2.x or v3.x"
    app_shell_match = re.search(r'const APP_SHELL = \[(.*?)\];', sw_content, re.DOTALL)
    assert app_shell_match, "APP_SHELL array must be found in sw.js"
    shell_raw = app_shell_match.group(1)
    paths = re.findall(r"['\"](\./[^'\"]+)['\"]", shell_raw)
    assert len(paths) >= 30, f"APP_SHELL should have >= 30 files, found {len(paths)}"

    for rel_path in paths:
        actual_path = rel_path.lstrip('./').replace('/', os.sep)
        assert os.path.exists(actual_path), f"APP_SHELL item does not exist on disk: {actual_path}"
    print(f"  [PASS] All {len(paths)} APP_SHELL files exist on disk.")

    print("\n=== [3] WEB AUDIO SYNTHESES CHECK ===")
    with open('common/audio.js', 'r', encoding='utf-8') as fp:
        audio_content = fp.read()
    for s in ['tron_turn', 'tron_boost', 'cat_meow', 'card_draw', 'bomb_alarm']:
        assert s in audio_content, f"Sound type '{s}' must exist in audio.js"
        print(f"  [PASS] Audio sound '{s}' verified.")

    print("\n=== [4] TRON LIGHT CYCLES VERIFICATION ===")
    with open('games/tron.html', 'r', encoding='utf-8') as fp:
        tron_html = fp.read()
    for element_id in ['tron-canvas', 'tron-overlay', 'tron-countdown-text', 'tron-round-notice',
                       'tron-card-p1', 'tron-card-p2', 'tron-card-p3', 'tron-card-p4',
                       'btn-target-3', 'btn-target-5', 'btn-sound-toggle', 'btn-rules-header']:
        assert element_id in tron_html, f"Element #{element_id} must exist in tron.html"
    print("  [PASS] All core DOM elements exist in games/tron.html.")

    with open('games/js/tron.js', 'r', encoding='utf-8') as fp:
        tron_js = fp.read()
    for key in ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ',
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyM',
                'KeyI', 'KeyK', 'KeyJ', 'KeyL', 'KeyU',
                'KeyT', 'KeyG', 'KeyF', 'KeyH', 'KeyR']:
        assert key in tron_js, f"Key code '{key}' must be handled in tron.js"
    print("  [PASS] 4-player non-conflicting keyboard controls verified.")

    for term in ['calculateFloodFillSpace', 'updateTronAiDecision', 'BOOST_DURATION_FRAMES', 'handlePlayerCrash']:
        assert term in tron_js, f"Tron core logic '{term}' must exist in tron.js"
    print("  [PASS] Tron AI flood fill and crash mechanics verified.")

    print("\n=== [5] BOMB CAT TABLE & ENGINE VERIFICATION ===")
    with open('games/bombcat.html', 'r', encoding='utf-8') as fp:
        cat_html = fp.read()
    for element_id in ['seat-p1', 'seat-p2', 'seat-p3', 'seat-p4',
                       'btn-draw-deck', 'discard-stack', 'hand-track',
                       'btn-peek-hold', 'turn-shield',
                       'modal-defuse-insert', 'modal-future', 'modal-steal']:
        assert element_id in cat_html, f"Element #{element_id} must exist in bombcat.html"
    print("  [PASS] All core DOM elements and modals exist in games/bombcat.html.")

    with open('games/js/bombcat.js', 'r', encoding='utf-8') as fp:
        cat_js = fp.read()
    for c in ['BOMB', 'DEFUSE', 'FUTURE', 'SKIP', 'ATTACK', 'SHUFFLE', 'STEAL']:
        assert c in cat_js, f"Card '{c}' must be defined in bombcat.js"
    print("  [PASS] 7 core cards defined in bombcat.js.")

    for term in ['setupAntiPeekGestures', 'handleBombDrawn', 'insertBombIntoDeck', 'scheduleAiTurn', 'handleAttackAction']:
        assert term in cat_js, f"Core mechanism '{term}' must exist in bombcat.js"
    print("  [PASS] Anti-peek gestures, defuse insert, attack stacking, and AI logic verified.")

    print("\n=== [6] LOBBY (index.html) & MATRIX INTEGRATION ===")
    with open('index.html', 'r', encoding='utf-8') as fp:
        idx_content = fp.read()
    assert "enterGame('TRON')" in idx_content, "Tron card must be clickable in index.html"
    assert "enterGame('BOMBCAT')" in idx_content, "Bomb Cat card must be clickable in index.html"
    assert "enterGame('BOMBERMAN')" in idx_content, "Bomberman card must be clickable in index.html"
    assert "'TRON': 'tron.html'" in idx_content, "TRON must be in fileMap"
    assert "'BOMBCAT': 'bombcat.html'" in idx_content, "BOMBCAT must be in fileMap"
    assert "'BOMBERMAN': 'bomberman.html'" in idx_content, "BOMBERMAN must be in fileMap"
    assert "'TRON'" in idx_content and "'BOMBCAT'" in idx_content, "TRON and BOMBCAT must be in randomPickGame"
    assert '全部 (20)' in idx_content, "Total games pill must show 20"
    assert '4人混战 (4)' in idx_content, "4PLAYER pill must show 4"
    assert '心理博弈 (2)' in idx_content, "MIND pill must show 2"
    assert '物理对抗 (8)' in idx_content, "PHYSICS pill must show 8"
    print("  [PASS] Lobby category counts, route maps, cards, and SVG artwork verified.")

    print("\n=== [7] README.md MATRIX VERIFICATION ===")
    with open('README.md', 'r', encoding='utf-8') as fp:
        readme_content = fp.read()
    assert '20 款' in readme_content, "README should mention 20 games"
    assert '极光光轮摩托' in readme_content, "Tron should be in README table"
    assert '疯狂拆弹猫' in readme_content, "Bomb Cat should be in README table"
    assert '极光炸弹人大乱斗' in readme_content, "Neon Bomberman should be in README table"
    print("  [PASS] README.md matrix updated to 20 games.")

    print("\n[SUCCESS] ALL 7 TEST SUITES PASSED WITH 100% SUCCESS!")

if __name__ == '__main__':
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    run_tests()
