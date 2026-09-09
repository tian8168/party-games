import re
for f in ['games/gravity.html', 'games/gravity4.html']:
    with open(f, 'r', encoding='utf-8') as file:
        text = file.read()
    text = text.replace(r'\"', '"')
    with open(f, 'w', encoding='utf-8') as file:
        file.write(text)
