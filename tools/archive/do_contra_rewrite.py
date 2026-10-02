import re

with open('games/contra.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update Boss X and camera limits
text = text.replace("levelWidth: 2200", "levelWidth: 6000")
text = text.replace("boss: { x: 1950,", "boss: { x: 5750,")

new_func = """
    function buildContraLevel() {
      const H = window.innerWidth <= 480 ? 240 : 310;
      STATE.contra.platforms = [
        { x: -100, y: H - 40, w: 800, h: 40, ground: true },
        { x: 300, y: H - 110, w: 150, h: 14, ground: false },
        { x: 500, y: H - 170, w: 150, h: 14, ground: false },
        { x: 700, y: H - 80, w: 90, h: 14, ground: false, type: 'bridge', timer: -1 },
        { x: 790, y: H - 80, w: 90, h: 14, ground: false, type: 'bridge', timer: -1 },
        { x: 880, y: H - 80, w: 90, h: 14, ground: false, type: 'bridge', timer: -1 },
        { x: 970, y: H - 40, w: 1230, h: 40, ground: true },
        { x: 1100, y: H - 110, w: 200, h: 14, ground: false },
        { x: 1350, y: H - 180, w: 150, h: 14, ground: false },
        { x: 1550, y: H - 100, w: 200, h: 14, ground: false },
        { x: 1800, y: H - 170, w: 150, h: 14, ground: false },
        { x: 2300, y: H - 80, w: 80, h: 14, ground: false },
        { x: 2450, y: H - 120, w: 80, h: 14, ground: false },
        { x: 2600, y: H - 160, w: 80, h: 14, ground: false },
        { x: 2750, y: H - 40, w: 850, h: 40, ground: true },
        { x: 2900, y: H - 120, w: 150, h: 14, ground: false },
        { x: 3100, y: H - 180, w: 150, h: 14, ground: false },
        { x: 3300, y: H - 240, w: 150, h: 14, ground: false },
        { x: 3700, y: H - 100, w: 150, h: 14, ground: false },
        { x: 3950, y: H - 40, w: 950, h: 40, ground: true },
        { x: 4050, y: H - 120, w: 150, h: 14, ground: false },
        { x: 4250, y: H - 180, w: 150, h: 14, ground: false },
        { x: 4450, y: H - 120, w: 150, h: 14, ground: false },
        { x: 4900, y: H - 40, w: 1100, h: 40, ground: true },
        { x: 5050, y: H - 120, w: 150, h: 14, ground: false },
        { x: 5250, y: H - 190, w: 150, h: 14, ground: false },
        { x: 5450, y: H - 120, w: 150, h: 14, ground: false },
        { x: 5550, y: H - 210, w: 150, h: 14, ground: false }
      ];

      STATE.contra.waters = [
        { x: 700, y: H - 10, w: 270, h: 30 },
        { x: 2200, y: H - 10, w: 550, h: 30 },
        { x: 3600, y: H - 10, w: 350, h: 30 }
      ];

      STATE.contra.spawners = [
        { x: 500, type: 'turret', y: H - 40, angle: Math.PI, hp: 4, triggered: false },
        { x: 1200, type: 'sniper', y: H - 180, hp: 2, triggered: false },
        { x: 1600, type: 'turret', y: H - 100, angle: Math.PI, hp: 4, triggered: false },
        { x: 2000, type: 'sniper', y: H - 170, hp: 2, triggered: false },
        { x: 2950, type: 'turret', y: H - 120, angle: Math.PI, hp: 4, triggered: false },
        { x: 3350, type: 'sniper', y: H - 240, hp: 2, triggered: false },
        { x: 4100, type: 'turret', y: H - 40, angle: Math.PI, hp: 4, triggered: false },
        { x: 4300, type: 'sniper', y: H - 180, hp: 2, triggered: false },
        { x: 5100, type: 'turret', y: H - 120, angle: Math.PI, hp: 4, triggered: false },
        { x: 5300, type: 'sniper', y: H - 190, hp: 2, triggered: false }
      ];
      STATE.contra.enemies = [];
      STATE.contra.nextRunnerSpawn = 100;

      STATE.contra.capsules = [
        { x: 400, y: 75, vx: 1.8, t: 0, type: 'S', alive: true },
        { x: 1400, y: 65, vx: 1.8, t: 0, type: 'M', alive: true },
        { x: 3200, y: 70, vx: 1.8, t: 0, type: 'L', alive: true },
        { x: 4200, y: 60, vx: 1.8, t: 0, type: 'S', alive: true }
      ];

      STATE.contra.pickups = [];
      STATE.contra.bullets = [];
      STATE.contra.enemyBullets = [];
      STATE.contra.particles = [];

      STATE.contra.boss = {
        x: 5780, y: H - 200, w: 120, h: 160,
        coreHp: 65, maxCoreHp: 65,
        leftTurretHp: 20, rightTurretHp: 20,
        sniperHp: 15,
        shootTimer: 0,
        active: false, defeated: false
      };
    }
"""

text = re.sub(r'function buildContraLevel\(\) \{.*?\}\s*function resetContraPlayer', new_func.strip() + r'\n\n    function resetContraPlayer', text, flags=re.DOTALL)

with open('games/contra.html', 'w', encoding='utf-8') as f:
    f.write(text)
