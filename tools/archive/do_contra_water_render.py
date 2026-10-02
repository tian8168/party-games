import re

with open('games/contra.html', 'r', encoding='utf-8') as f:
    text = f.read()

water_render = """
      // Draw Water
      if (STATE.contra.waters) {
        STATE.contra.waters.forEach(w => {
          if (w.x + w.w > camX && w.x < camX + c.width) {
            ctx.fillStyle = 'rgba(14, 165, 233, 0.4)';
            ctx.fillRect(w.x - camX, w.y, w.w, w.h);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
            ctx.fillRect(w.x - camX, w.y, w.w, 4);
          }
        });
      }
"""

text = text.replace('ctx.fillRect(0, 0, c.width, c.height);', 'ctx.fillRect(0, 0, c.width, c.height);\n' + water_render)

with open('games/contra.html', 'w', encoding='utf-8') as f:
    f.write(text)
