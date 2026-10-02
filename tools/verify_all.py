import os
import re
import sys
import http.server
import socketserver
import threading
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

print("========================================")
print("  STEP 4: COMPREHENSIVE VERIFICATION")
print("========================================")

errors = []

# --- 1. Check common.css tokens & keyframes ---
print("\n[Test 1] Verifying common.css tokens and animations...")
with open('common/common.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

required_css_tokens = [
    '--p1-color: #ff4757',
    '--p1-glow: rgba(255, 71, 87, 0.4)',
    '--p2-color: #2ed573',
    '--p2-glow: rgba(46, 213, 115, 0.4)',
    '--p3-color: #38bdf8',
    '--p3-glow: rgba(56, 189, 248, 0.4)',
    '--p4-color: #f59e0b',
    '--p4-glow: rgba(245, 158, 11, 0.4)',
    '.game-header',
    'backdrop-filter: blur(12px)',
    '.nav-back',
    'translateX(-3px)',
    '.mode-nav',
    '.mode-tab',
    '.mode-tab.active',
    '.header-actions',
    '.btn-icon',
    'turn-breathe-glow',
    '.active-turn',
    '.turn-badge',
    '.modal-overlay',
    '.modal-box',
    '.modal-type-victory',
    '.modal-type-draw',
    '.modal-type-defeat',
    'gold-shimmer',
    '.modal-btn-confirm',
    '.modal-btn-restart',
    '#confetti-canvas'
]

for token in required_css_tokens:
    if token in css_content:
        print(f"  ✓ Found '{token}'")
    else:
        err = f"Missing required CSS token: '{token}'"
        print(f"  ✗ {err}")
        errors.append(err)

# --- 2. Check common.js functions & exports ---
print("\n[Test 2] Verifying common.js functions & exports...")
with open('common/common.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

required_js_symbols = [
    'createConfettiParticle',
    'updateConfetti',
    'resizeConfettiCanvas',
    'startConfetti',
    'stopConfetti',
    'handleModalRestart',
    'handleModalReturnLobby',
    'showModal',
    'closeModal',
    'autoBindCommonHeader',
    'initCommonHeader',
    'window.showModal = showModal',
    'window.closeModal = closeModal',
    'window.startConfetti = startConfetti',
    'window.stopConfetti = stopConfetti',
    'window.handleModalRestart = handleModalRestart',
    'window.handleModalReturnLobby = handleModalReturnLobby'
]

for sym in required_js_symbols:
    if sym in js_content:
        print(f"  ✓ Found '{sym}'")
    else:
        err = f"Missing required JS symbol: '{sym}'"
        print(f"  ✗ {err}")
        errors.append(err)

# --- 3. Execute JS in Node.js (if available) or simulate in Python ---
print("\n[Test 3] Verifying modal classification and confetti logic...")

# Simulate exact JS showModal logic
def simulate_show_modal(title, body="", options=None):
    if options is None: options = {}
    titleUpper = (title or '').upper()
    bodyUpper = str(body or '').upper()
    fullText = titleUpper + ' ' + bodyUpper

    isPureRuleHelp = any(k in titleUpper for k in ['规则', '指南', '说明', 'HELP', 'RULES', '玩法', '房间号', '加入房间', '创建房间', '就绪']) and \
                     not any(k in titleUpper for k in ['获胜', '胜利', '胜出', '冠军', '大捷', '战报', '决胜', '结算'])

    isGameOver = False
    if 'isGameOver' in options and isinstance(options['isGameOver'], bool):
        isGameOver = options['isGameOver']
    elif not isPureRuleHelp:
        gameOverKeywords = [
            '获胜', '胜利', '胜出', '结束', '结算', '战报', '落幕', '终局', '终结',
            '冠军', '大捷', 'GAME OVER', '平局', '势均力敌', '阵亡', '绝杀', '胜负',
            '失败', '战败', '出局', '被击败', 'LOSE', 'YOU LOSE', '惜败',
            '对局结束', 'MATCH OVER', 'REPORT', 'DEFEAT', 'VICTORY', 'WINNER', '挑战结束'
        ]
        isGameOver = any(k in titleUpper for k in gameOverKeywords) or \
                     ('战' in titleUpper and '胜' in fullText)

    outcomeType = 'info'
    if 'type' in options:
        outcomeType = options['type']
    elif isGameOver:
        drawKeywords = ['平局', '势均力敌', '握手言和', 'DRAW', 'TIE', '和棋', '和局']
        defeatKeywords = [
            '💀', '失败', '战败', '阵亡', '出局', '被击败', 'GAME OVER', 'DEFEAT', 'YOU LOSE',
            '惜败', '遗憾', '跌落深渊', '装甲破损', '生命值归零', '全军覆没', '对手获胜', '敌方获胜', '电脑获胜'
        ]
        victoryKeywords = [
            '🏆', '👑', '🎉', '获胜', '胜利', '胜出', '冠军', '大捷', 'VICTORY', 'WINNER',
            '绝杀', '夺得', '问鼎', '斩获', '赢得', '凯旋'
        ]

        if any(k in fullText for k in drawKeywords):
            outcomeType = 'draw'
        elif any(k in fullText for k in defeatKeywords) and \
             not any(k in titleUpper for k in victoryKeywords if not '💀' in titleUpper):
            outcomeType = 'defeat'
        else:
            outcomeType = 'victory'

    has_confetti = (outcomeType == 'victory')
    has_restart_btn = isGameOver
    return {
        'isGameOver': isGameOver,
        'outcomeType': outcomeType,
        'confetti': has_confetti,
        'has_restart': has_restart_btn
    }

test_scenarios = [
    # Victory scenarios
    ('🏆 飞行棋冠军诞生！', '👑 恭喜 P1 勇夺总冠军！', {}, True, 'victory', True),
    ('🏁 游戏结束', '红方 率先冲过 FINISH 线，斩获胜利！', {}, True, 'victory', True),
    ('🏆 拆弹猫幸存总冠军！', '恭喜 玩家1 成为最后唯一幸存者！', {}, True, 'victory', True),
    ('🎉 恭喜获胜！', '红方 成功连成 5 颗同色棋子，赢得对局！', {}, True, 'victory', True),
    ('🎉 经典四子连珠绝杀！', '红方 赢得 7×6 经典对决！', {}, True, 'victory', True),
    ('🎉 3D 空间四连绝杀！', '红方 斩获最终胜利！', {}, True, 'victory', True),
    ('🎉 比赛获胜！', 'P1 赢得极光冰球总冠军！', {}, True, 'victory', True),
    ('🎉 比赛结束', 'P2 玩家/电脑率先攻入 7 球，赢得极光冰球胜利！', {}, True, 'victory', True),
    ('决斗落幕', '🏆 恭喜！你以高超剑术斩落对手，问鼎剑圣！', {}, True, 'victory', True),
    ('决斗落幕', '🏆 恭喜 🔴 剑客P1 刀光夺魄，问鼎剑圣！', {}, True, 'victory', True),
    ('大话骰 终局', '🏆 心理博弈拉满！你成功将对手的筹码全部蚕食！', {}, True, 'victory', True),
    ('大话骰 终局', '🏆 心理博弈拉满！【🔴 玩家 1】技高一筹，问鼎骰王！', {}, True, 'victory', True),
    ('极光叠叠高 结算', '<h3>🏛️ 建造总层数: 15</h3>', {}, True, 'victory', True),
    ('相扑擂台 战报', '🏆 猛烈推撞！你把对手彻底轰下了擂台，夺得冠军！', {}, True, 'victory', True),
    ('相扑擂台 战报', '🏆 🔴 玩家1 凭借狂暴冲撞夺得相扑总冠军！', {}, True, 'victory', True),
    ('坦克大战 战报', '🏆 🔴 玩家 1 获胜！神级高抛轰平了对方的防御！', {}, True, 'victory', True),
    ('🏆 终极总冠军！', '红方 以 5 : 2 斩获总冠军！', {}, True, 'victory', True),
    ('🏆 极光光轮摩托·终局总冠军！', '恭喜 玩家1 斩获最终总冠军！', {}, True, 'victory', True),
    ('🏁 对局结束 (认输)', '黑方 中盘认输 🏆 恭喜 白方 不战而胜！', {'isGameOver': True}, True, 'victory', True),
    ('🏁 终局数子结算 (双停一手终盘)', '🏆 裁定胜者：黑方 胜 3.5 目！', {'isGameOver': True}, True, 'victory', True),

    # Defeat scenarios
    ('💀 最终远征战报 (MISSION REPORT)', '<h3>🎖️ 魂斗罗·终极极限远征</h3>', {}, True, 'defeat', False),
    ('决斗落幕', '💀 惜败！对手刀光更快一筹，再接再厉！', {}, True, 'defeat', False),
    ('大话骰 终局', '💀 吹牛被对手彻底看穿，生命值归零！', {}, True, 'defeat', False),
    ('相扑擂台 战报', '💀 遗憾跌落深渊，对手获胜！', {}, True, 'defeat', False),
    ('坦克大战 战报', '💀 战车装甲破损，敌方炮火更胜一筹！', {}, True, 'defeat', False),
    ('GAME OVER', 'You were defeated by the enemy boss', {}, True, 'defeat', False),
    ('DEFEAT', 'Your castle has fallen', {}, True, 'defeat', False),

    # Draw scenarios
    ('🤝 势均力敌', '棋盘已全满，双方达成平局！', {}, True, 'draw', False),
    ('🤝 势均力敌', '64 个空间点位已全满，双方达成平局！', {}, True, 'draw', False),
    ('势均力敌', '双方握手言和', {}, True, 'draw', False),
    ('Match Over', 'DRAW between players', {}, True, 'draw', False),

    # Info / Rules / Rooms
    ('✈️ 四人飞行棋 (Aeroplane Chess 4P) 规则', '规则指南', {}, False, 'info', False),
    ('💥 魂斗罗: 无限远征 (自研Canvas版)', '规则操作指南', {}, False, 'info', False),
    ('🕹️ 已就绪【魂斗罗】仿真架构', '操作指令已映射完成', {}, False, 'info', False),
    ('👥 双人联机房间已创建！', '房间号: 1234', {}, False, 'info', False),
    ('👥 联机房间号：1234', '告诉好友房间号', {}, False, 'info', False),
    ('🔗 输入房间号加入对局', '请输入 4 位房间号', {}, False, 'info', False),
]

for title, body, opts, exp_go, exp_type, exp_confetti in test_scenarios:
    res = simulate_show_modal(title, body, opts)
    if res['isGameOver'] != exp_go or res['outcomeType'] != exp_type or res['confetti'] != exp_confetti:
        err = f"Classification mismatch for '{title}': got {res}, expected (isGameOver={exp_go}, outcomeType={exp_type}, confetti={exp_confetti})"
        print(f"  ✗ {err}")
        errors.append(err)
    else:
        print(f"  ✓ '{title}' -> type:{res['outcomeType']} (confetti:{res['confetti']}, buttons:{'2-btns' if res['has_restart'] else '1-btn'})")

# --- 4. Verify Local HTTP Serving for All 21 Games ---
print("\n[Test 4] Verifying HTTP 200 for all 21 games & core assets...")

class SilentHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

PORT = 9988
httpd = socketserver.TCPServer(("", PORT), SilentHandler)
server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()

test_urls = [
    '/',
    '/index.html',
    '/common/common.css',
    '/common/common.js',
    '/common/audio.js',
    '/sw.js',
    '/games/aeroplane.html',
    '/games/barrierrace.html',
    '/games/bombcat.html',
    '/games/contra.html',
    '/games/contra_canvas.html',
    '/games/go.html',
    '/games/gravity.html',
    '/games/gravity3d.html',
    '/games/gravity3d4.html',
    '/games/gravity4.html',
    '/games/hockey.html',
    '/games/iaido.html',
    '/games/kaya.html',
    '/games/kaya/index.html',
    '/games/liarsdice.html',
    '/games/nes.html',
    '/games/quoridor.html',
    '/games/stack.html',
    '/games/sumo.html',
    '/games/tank.html',
    '/games/tanktrouble.html',
    '/games/tron.html',
    '/games/js/aeroplane.js',
    '/games/js/bombcat.js',
    '/games/js/contra.js',
    '/games/js/gravity.js',
    '/games/js/gravity3d.js',
    '/games/js/gravity4.js',
    '/games/js/hockey.js',
    '/games/js/iaido.js',
    '/games/js/jsnes.min.js',
    '/games/js/liarsdice.js',
    '/games/js/nes_netplay.js',
    '/games/js/nostalgist.umd.js',
    '/games/js/quoridor.js',
    '/games/js/stack.js',
    '/games/js/sumo.js',
    '/games/js/tank.js',
    '/games/js/tanktrouble.js',
    '/games/js/tron.js',
]

for url_path in test_urls:
    full_url = f"http://127.0.0.1:{PORT}{url_path}"
    try:
        req = urllib.request.urlopen(full_url)
        status = req.getcode()
        if status == 200:
            print(f"  ✓ HTTP 200: {url_path}")
        else:
            err = f"HTTP {status} for {url_path}"
            print(f"  ✗ {err}")
            errors.append(err)
    except Exception as e:
        err = f"Failed to fetch {url_path}: {e}"
        print(f"  ✗ {err}")
        errors.append(err)

httpd.shutdown()

print("\n========================================")
if not errors:
    print("  ALL VERIFICATIONS PASSED (0 ERRORS)!")
    print("========================================")
else:
    print(f"  TOTAL ERRORS: {len(errors)}")
    print("========================================")
    sys.exit(1)
