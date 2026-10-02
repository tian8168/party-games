import re

with open('games/contra.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update level length & boss pos in STATE
text = text.replace("levelWidth: 2200", "levelWidth: 6000")
text = text.replace("boss: { x: 1950,", "boss: { x: 5750,")

# 2. Rewrite buildContraLevel
new_build_level = '''
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
'''
text = re.sub(r'function buildContraLevel\(\) \{.*?\}\s*function resetContraPlayer\(\)', new_build_level + '\n    function resetContraPlayer()', text, flags=re.DOTALL)

# 3. Modify updateContraPhysics for spawning logic & bridge collapse
spawner_code = '''
      if (STATE.contra.cameraX > 0 && !STATE.contra.bossActive) {
        STATE.contra.nextRunnerSpawn--;
        if (STATE.contra.nextRunnerSpawn <= 0) {
          const spawnDir = Math.random() > 0.3 ? 1 : -1;
          const spawnX = spawnDir === 1 ? STATE.contra.cameraX + (c ? c.width + 40 : 500) : STATE.contra.cameraX - 40;
          STATE.contra.enemies.push({ type: 'runner', x: spawnX, y: 50, vx: -spawnDir * (1.2 + Math.random()), vy: 0, hp: 1 });
          STATE.contra.nextRunnerSpawn = 90 + Math.random() * 80;
        }
      }
      if (STATE.contra.spawners) {
        STATE.contra.spawners.forEach(sp => {
          if (!sp.triggered && sp.x < STATE.contra.cameraX + (c ? c.width + 100 : 600)) {
            sp.triggered = true;
            STATE.contra.enemies.push({ type: sp.type, x: sp.x, y: sp.y, angle: sp.angle, shootTimer: 30, hp: sp.hp, vy: 0 });
          }
        });
      }
      
      STATE.contra.platforms.forEach(plat => {
        if (plat.type === 'bridge' && plat.timer > 0) {
          plat.timer--;
          if (plat.timer === 0) {
            plat.active = false;
            for (let i = 0; i < 15; i++) {
              STATE.contra.particles.push({
                x: plat.x + Math.random() * plat.w,
                y: plat.y + Math.random() * plat.h,
                vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
                life: 1.0, color: '#94a3b8', size: 4
              });
            }
          }
        }
      });
      STATE.contra.platforms = STATE.contra.platforms.filter(p => p.active !== false);

      STATE.contra.enemies.forEach(en => {
        if (en.type === 'runner' || en.type === 'sniper') {
          en.vy = (en.vy || 0) + 0.44;
          let onG = false;
          STATE.contra.platforms.forEach(plat => {
            if (en.x > plat.x && en.x < plat.x + plat.w && en.y + 13 >= plat.y && en.y + 13 - en.vy <= plat.y + 16) {
              en.y = plat.y - 13;
              en.vy = 0;
              onG = true;
            }
          });
          if (!onG) en.y += en.vy;
          if (en.y > (c ? c.height + 100 : 400)) en.hp = 0;
        }
      });
'''
text = text.replace('      // ×¹¿ÓËÀÍö¼ì²â', spawner_code + '\n      // ×¹¿ÓËÀÍö¼ì²â')

# 4. Modify camera & boss thresholds
text = text.replace('cameraX < 1720', 'cameraX < 5520')
text = text.replace('cameraX >= 1700', 'cameraX >= 5500')

# 5. Bridge triggering
trigger_bridge_code = '''
          if (p.vy >= 0 && pFootY >= plat.y && (pFootY - p.vy <= plat.y + 16 || pFootY <= plat.y + 12)) {
            p.y = plat.y - 18;
            p.vy = 0;
            p.onGround = true;
            if (plat.type === 'bridge' && plat.timer === -1) {
              plat.timer = 60;
            }
          }
'''
text = re.sub(r'if \(p\.vy >= 0 && pFootY >= plat\.y.*?\n\s*p\.onGround = true;\n\s*\}', trigger_bridge_code.strip('\n'), text, flags=re.DOTALL)

with open('games/contra.html', 'w', encoding='utf-8') as f:
    f.write(text)
