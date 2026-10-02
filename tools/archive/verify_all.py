import os
import sys
import re

errors = []
warnings = []

# 1. Check tools/archive/
archived_files = [
    'contra_rewrite.py', 'contra_rewrite2.py', 'do_contra_bridge_render.py',
    'do_contra_rewrite.py', 'do_contra_water_render.py', 'fix_gravity.py',
    'fix_gravity4.py', 'fix_quoridor.py', 'fix_quotes.py', 'text.py',
    'test.txt', 'test_go.js', 'old_index.html', 'old_index_spa.html'
]
for f in archived_files:
    if os.path.exists(f):
        errors.append(f'File {f} still exists in root directory!')
    if not os.path.exists(os.path.join('tools', 'archive', f)):
        errors.append(f'File {f} missing from tools/archive/!')

# Check .assetsignore
with open('.assetsignore', 'r', encoding='utf-8') as f:
    assetsignore_content = f.read()
if 'tools' not in assetsignore_content:
    errors.append('tools not found in .assetsignore')

# 2. Check index.html
with open('index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

# Check category pills
for cat, count in [('ALL', 19), ('4PLAYER', 4), ('STRATEGY', 8), ('MIND', 2), ('PHYSICS', 7), ('REFLEX', 2)]:
    pattern = rf"filterLobby\('{cat}'\)[^>]*>[^<]*\({count}\)"
    if not re.search(pattern, index_html):
        errors.append(f'Category {cat} with count {count} not found in index.html pills')

# Check game cards in index.html
cards = re.findall(r'<div class="game-card[^"]*"[^>]*data-cat="([^"]+)"[^>]*data-players="([^"]+)"[^>]*onclick="enterGame\(\'([^\']+)\'\)"', index_html)
print(f'Total cards found in index.html: {len(cards)}')
if len(cards) != 19:
    errors.append(f'Expected 19 cards, got {len(cards)}')

four_player_cards = [c[2] for c in cards if c[1] in ('4', '3-4')]
print(f'4-player cards: {four_player_cards}')
if set(four_player_cards) != {'QUORIDOR', 'AEROPLANE', 'TRON', 'BOMBCAT'}:
    errors.append(f'Unexpected 4-player cards: {four_player_cards}')

card_dict = {c[2]: c[1] for c in cards}
if card_dict.get('TANKTROUBLE') != '2': errors.append(f'TANKTROUBLE players is {card_dict.get("TANKTROUBLE")}')
if card_dict.get('SUMO') != '2': errors.append(f'SUMO players is {card_dict.get("SUMO")}')
if card_dict.get('IAIDO') != '2': errors.append(f'IAIDO players is {card_dict.get("IAIDO")}')
if card_dict.get('LIARSDICE') != '2': errors.append(f'LIARSDICE players is {card_dict.get("LIARSDICE")}')
if card_dict.get('STACK') != '1': errors.append(f'STACK players is {card_dict.get("STACK")}')

# 3. Check README.md
with open('README.md', 'r', encoding='utf-8') as f:
    readme = f.read()
if '15 款' in readme:
    errors.append('README.md still contains "15 款"')
if '恶魔轮盘赌' in readme:
    errors.append('README.md still contains "恶魔轮盘赌"')
for req in ['FC 怀旧红白机厅', '玄素围棋', 'Kaya 现代围棋', '极光光轮摩托', '疯狂拆弹猫']:
    if req not in readme:
        errors.append(f'README.md missing {req}')

# Check table rows in README.md
readme_rows = [line for line in readme.splitlines() if line.strip().startswith('| **')]
print(f'README.md game table rows count: {len(readme_rows)}')
if len(readme_rows) != 19:
    errors.append(f'Expected 19 rows in README table, got {len(readme_rows)}')

# 4. Check sw.js
with open('sw.js', 'r', encoding='utf-8') as f:
    sw_code = f.read()
if 'party-arcade-v2.0' in sw_code:
    errors.append('sw.js still has party-arcade-v2.0')
if 'party-arcade-v2.2' not in sw_code:
    errors.append('sw.js missing party-arcade-v2.2')
for zip_core in ['fceumm_libretro.zip', 'mgba_libretro.zip', 'snes9x_libretro.zip', 'genesis_plus_gx_libretro.zip', 'gambatte_libretro.zip']:
    if zip_core in sw_code:
        errors.append(f'sw.js still has {zip_core} in APP_SHELL!')

# Check that APP_SHELL files all exist on disk
app_shell_match = re.search(r'const APP_SHELL = \[(.*?)\];', sw_code, re.DOTALL)
if app_shell_match:
    paths = [p.strip().strip("'\"") for p in app_shell_match.group(1).split(',') if p.strip()]
    for p in paths:
        if p in ('./', ''): continue
        rel_p = p.replace('./', '').replace('/', os.sep)
        if not os.path.exists(rel_p):
            errors.append(f'APP_SHELL path does not exist on disk: {p}')

# 5. Check common/network.js
with open('common/network.js', 'r', encoding='utf-8') as f:
    net_code = f.read()
if 'game_hall_v2/${g}/room/' not in net_code:
    errors.append('network.js does not use game namespace in topic')
if '100000 + Math.random() * 900000' not in net_code:
    errors.append('network.js does not use 6-digit room code')

# 6. Check games/iaido.html
with open('games/iaido.html', 'r', encoding='utf-8') as f:
    iaido_html = f.read()
if 'walls-wrapper' in iaido_html:
    errors.append('iaido.html still has walls-wrapper!')
if 'iaido-touch-p1' not in iaido_html or 'iaido-touch-p2' not in iaido_html:
    errors.append('iaido.html missing dual touch zones!')
if 'KeyA' not in iaido_html or 'KeyL' not in iaido_html:
    errors.append('iaido.html missing dual keyboard handling!')
if 'handleIaidoAction' not in iaido_html:
    errors.append('iaido.html missing handleIaidoAction!')

# 7. Check games/liarsdice.html
with open('games/liarsdice.html', 'r', encoding='utf-8') as f:
    liars_html = f.read()
if 'btn-peek-p1' not in liars_html or 'btn-peek-p2' not in liars_html:
    errors.append('liarsdice.html missing peek buttons!')
if 'p1Peeking' not in liars_html or 'p2Peeking' not in liars_html:
    errors.append('liarsdice.html missing peeking state!')
if 'by: STATE.turn' not in liars_html:
    errors.append('liarsdice.html does not assign by to STATE.turn!')

print('Errors:', errors)
print('Warnings:', warnings)
if errors:
    print('VERIFICATION FAILED WITH ERRORS!')
    sys.exit(1)
else:
    print('ALL AUTOMATED CHECKS PASSED PERFECTLY!')
