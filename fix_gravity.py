import re
with open('games/gravity.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix UI bug: <div class='gravity-col-btn'> to <button class='btn-drop-col'>
text = re.sub(r'<div class=\"gravity-col-btn\" onclick=\"([^\"]+)\">([^<]+)</div>', r'<button class=\"btn-drop-col\" onclick=\"\1\">\2</button>', text)

# Add event listeners for canvas clicking
pointer_code = '''
    if (canvas2D) {
      canvas2D.addEventListener('pointermove', (e) => {
        if (STATE.currentGame !== 'GRAVITY' || STATE.animating || STATE.winner) return;
        if (!checkIsMyTurn()) return;
        const rect = canvas2D.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * dpr;
        const sz = canvas2D.width;
        const cols = 9;
        const grooveSize = sz / (cols * 4.5 + (cols - 1));
        const cellSize = grooveSize * 4.5;
        const offset = grooveSize / 2;
        let col = Math.floor((x - offset) / (cellSize + grooveSize));
        if (col < 0) col = 0;
        if (col >= 9) col = 8;
        if (STATE.gravity.hoverCol !== col) {
          STATE.gravity.hoverCol = col;
          render2D();
        }
      });
      canvas2D.addEventListener('pointerleave', () => {
        if (STATE.gravity.hoverCol !== null) {
          STATE.gravity.hoverCol = null;
          render2D();
        }
      });
      canvas2D.addEventListener('pointerdown', (e) => {
        if (STATE.currentGame !== 'GRAVITY' || STATE.animating || STATE.winner) return;
        if (!checkIsMyTurn()) return;
        const rect = canvas2D.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * dpr;
        const sz = canvas2D.width;
        const cols = 9;
        const grooveSize = sz / (cols * 4.5 + (cols - 1));
        const cellSize = grooveSize * 4.5;
        const offset = grooveSize / 2;
        let col = Math.floor((x - offset) / (cellSize + grooveSize));
        if (col < 0) col = 0;
        if (col >= 9) col = 8;
        dropGravityCol(col);
      });
    }
'''

text = text.replace('function render2D() {', pointer_code + '\n    function render2D() {')

with open('games/gravity.html', 'w', encoding='utf-8') as f:
    f.write(text)
