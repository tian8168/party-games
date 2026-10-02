import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Parse cards
cards = []
card_matches = re.finditer(r'<div class="game-card[^"]*"([^>]*)>(.*?)(?=<div class="game-card|</div>\s*</div>\s*<!-- =|\Z)', html, re.DOTALL)
for m in card_matches:
    header = m.group(1)
    key_match = re.search(r'data-game-key="([^"]+)"', header)
    if not key_match:
        continue
    key = key_match.group(1)
    cat = re.search(r'data-cat="([^"]+)"', header).group(1)
    players = re.search(r'data-players="([^"]+)"', header).group(1)
    cards.append({'key': key, 'cat': cat, 'players': players})

players_list = ['ALL', '1', '2', '4']
cats_list = ['ALL', 'PHYSICS', 'STRATEGY', 'MIND', 'REFLEX']

print(f"{'PLAYER':<8} | {'CATEGORY':<10} | {'COUNT':<5} | {'GAMES'}")
print("-" * 60)
for p in players_list:
    for c in cats_list:
        matched = [
            card['key'] for card in cards
            if (p == 'ALL' or card['players'] == p) and (c == 'ALL' or card['cat'] == c)
        ]
        print(f"{p:<8} | {c:<10} | {len(matched):<5} | {', '.join(matched)}")
