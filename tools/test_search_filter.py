import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Parse cards
cards = []
card_matches = re.finditer(r'<div class="game-card[^"]*"([^>]*)>(.*?)(?=<div class="game-card|</div>\s*</div>\s*<!-- =|\Z)', html, re.DOTALL)
for m in card_matches:
    header = m.group(1)
    body = m.group(2)
    key_match = re.search(r'data-game-key="([^"]+)"', header)
    if not key_match:
        continue
    key = key_match.group(1)
    cat = re.search(r'data-cat="([^"]+)"', header).group(1)
    players = re.search(r'data-players="([^"]+)"', header).group(1)
    kw_m = re.search(r'data-keywords="([^"]+)"', header)
    kw = kw_m.group(1) if kw_m else ''
    
    # Text content of card
    text_content = re.sub(r'<[^>]+>', ' ', body)
    full_text = (kw + ' ' + text_content).lower()
    cards.append({'key': key, 'cat': cat, 'players': players, 'full_text': full_text})

test_queries = [
    '摩托', '猫', '围棋', '坦克', 'FC', 'nes', 'tron', 'contra',
    '4人', '双人', '单人', '四人', '2人', '1人', '二人', '街机', '红白机',
    '飞行棋', '五子棋', '相扑', '拔刀', '骰子', '叠高', '射击', '迷宫', '桌游', 'AI'
]
for q in test_queries:
    matches = [c['key'] for c in cards if q.lower() in c['full_text']]
    print(f'Query "{q}": {len(matches)} matches -> {matches}')
