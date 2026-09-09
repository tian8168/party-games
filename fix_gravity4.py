import re
with open('games/gravity4.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix UI bug: <div class='gravity-col-btn'> to <button class='btn-drop-col'>
text = re.sub(r'<div class=\"gravity-col-btn\" onclick=\"([^\"]+)\">([^<]+)</div>', r'<button class=\"btn-drop-col\" onclick=\"\1\">\2</button>', text)

pointer_code = '''
    if (canvas2D) {
      canvas2D.addEventListener('pointermove', (e) => {
        if (STATE.currentGame !== 'GRAVITY4' || STATE.animating || STATE.winner) return;
        if (!checkIsMyTurn()) return;
        const rect = canvas2D.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * dpr;
        const sz = canvas2D.width;
        const cols = 7;
        const grooveSize = sz / (cols * 4.5 + (cols - 1));
        const cellSize = grooveSize * 4.5;
        const offset = grooveSize / 2;
        let col = Math.floor((x - offset) / (cellSize + grooveSize));
        if (col < 0) col = 0;
        if (col >= 7) col = 6;
        if (STATE.gravity4.hoverCol !== col) {
          STATE.gravity4.hoverCol = col;
          render2D();
        }
      });
      canvas2D.addEventListener('pointerleave', () => {
        if (STATE.gravity4.hoverCol !== null) {
          STATE.gravity4.hoverCol = null;
          render2D();
        }
      });
      canvas2D.addEventListener('pointerdown', (e) => {
        if (STATE.currentGame !== 'GRAVITY4' || STATE.animating || STATE.winner) return;
        if (!checkIsMyTurn()) return;
        const rect = canvas2D.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * dpr;
        const sz = canvas2D.width;
        const cols = 7;
        const grooveSize = sz / (cols * 4.5 + (cols - 1));
        const cellSize = grooveSize * 4.5;
        const offset = grooveSize / 2;
        let col = Math.floor((x - offset) / (cellSize + grooveSize));
        if (col < 0) col = 0;
        if (col >= 7) col = 6;
        dropGravity4Col(col);
      });
    }
'''

text = text.replace('function render2D() {', pointer_code + '\n    function render2D() {')

with open('games/gravity4.html', 'w', encoding='utf-8') as f:
    f.write(text)
