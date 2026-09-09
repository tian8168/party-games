import re
with open('games/quoridor.html', 'r', encoding='utf-8') as f:
    text = f.read()

css_to_insert = '''
    .toolbar-quoridor {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin-top: 10px;
    }
    .tool-btn {
      background: #1e293b;
      border: 1px solid #3b4c68;
      color: var(--text-main, #e2e8f0);
      padding: 7px 6px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tool-btn.active {
      background: #334155;
      border-color: #60a5fa;
      color: #93c5fd;
      box-shadow: 0 0 10px rgba(96, 165, 250, 0.4);
    }
'''

text = text.replace('<style>', '<style>\n' + css_to_insert)

with open('games/quoridor.html', 'w', encoding='utf-8') as f:
    f.write(text)
