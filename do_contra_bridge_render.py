import re

with open('games/contra.html', 'r', encoding='utf-8') as f:
    text = f.read()

bridge_render = """
          if (plat.type === 'bridge' && plat.timer > 0) {
            ctx.fillStyle = (Math.floor(Date.now() / 100) % 2 === 0) ? '#ef4444' : '#ffffff';
          } else {
            ctx.fillStyle = '#ef4444';
          }
"""

text = text.replace("ctx.fillStyle = '#ef4444';\\n          ctx.fillRect(plat.x, plat.y, plat.w, 3);", bridge_render.strip() + "\\n          ctx.fillRect(plat.x, plat.y, plat.w, 3);")

with open('games/contra.html', 'w', encoding='utf-8') as f:
    f.write(text)
