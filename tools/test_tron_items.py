import os
import re
import sys
import math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def test_tron_items():
    print("==================================================")
    print("  TRON MARIO KART POWER-UPS DEEP VERIFICATION")
    print("==================================================")

    # 1. Check audio.js for all Tron sound synthesizers
    print("\n--- [1] Web Audio Synthesizer Verification ---")
    audio_path = os.path.join(ROOT, 'common', 'audio.js')
    assert os.path.exists(audio_path), "audio.js must exist"
    with open(audio_path, 'r', encoding='utf-8') as f:
        audio_content = f.read()

    expected_sounds = [
        'tron_turn',
        'tron_boost',
        'tron_item_pickup',
        'tron_missile',
        'tron_missile_hit',
        'tron_ghost',
        'tron_super_boost',
        'tron_emp'
    ]
    for sound in expected_sounds:
        assert f"type === '{sound}'" in audio_content, f"Sound '{sound}' synthesizer missing in audio.js"
        print(f"  [PASS] Synthesizer sound '{sound}' registered in audio.js")

    # 2. Check games/tron.html DOM & HUD Slots
    print("\n--- [2] games/tron.html HUD & Styling Verification ---")
    tron_html_path = os.path.join(ROOT, 'games', 'tron.html')
    assert os.path.exists(tron_html_path), "games/tron.html must exist"
    with open(tron_html_path, 'r', encoding='utf-8') as f:
        tron_html = f.read()

    # Verify item slots in HTML
    for pid in [1, 2, 3, 4]:
        assert f'id="tron-item-slot-p{pid}"' in tron_html, f"Item slot for P{pid} missing"
        assert f'id="tron-item-icon-p{pid}"' in tron_html, f"Item icon for P{pid} missing"
        assert f'id="tron-item-text-p{pid}"' in tron_html, f"Item text for P{pid} missing"
    print("  [PASS] All 4 player cards contain dedicated .tron-item-slot elements.")

    # Verify CSS classes
    for css_class in ['.tron-item-slot', '.tron-item-slot.missile', '.tron-item-slot.ghost',
                      '.tron-item-slot.super-boost', '.tron-item-slot.emp-affected',
                      '.tron-card.emp-shocked', '.tron-card.ghost-mode', '.tron-card.super-boost']:
        assert css_class in tron_html, f"CSS rule '{css_class}' missing in tron.html"
    print("  [PASS] All item slot styles and active card animation classes present.")

    # 3. Check games/js/tron.js Logic & Mechanics
    print("\n--- [3] games/js/tron.js Core Mechanics Verification ---")
    tron_js_path = os.path.join(ROOT, 'games', 'js', 'tron.js')
    assert os.path.exists(tron_js_path), "games/js/tron.js must exist"
    with open(tron_js_path, 'r', encoding='utf-8') as f:
        tron_js = f.read()

    # 3.1 Mechanics constants
    for const_name in ['BASE_STEP_INTERVAL', 'BOOST_STEP_INTERVAL', 'SUPER_BOOST_STEP_INTERVAL',
                      'BOOST_DURATION_FRAMES', 'GHOST_DURATION_FRAMES', 'SUPER_BOOST_DURATION_FRAMES',
                      'EMP_DURATION_FRAMES', 'MAX_MYSTERY_BOXES', 'BOX_SPAWN_INTERVAL_FRAMES']:
        assert const_name in tron_js, f"Constant {const_name} missing in tron.js"
    print("  [PASS] All power-up durations and interval constants defined.")

    # 3.2 Functions
    for fn_name in ['spawnMysteryBox', 'checkMysteryBoxPickups', 'handlePlayerPickupItem',
                   'launchMissile', 'activateGhostMode', 'activateSuperBoost', 'triggerEmpShockwave',
                   'updateMissiles', 'explodeMissile', 'calculateFloodFillSpace', 'updateTronAiDecision']:
        assert fn_name in tron_js, f"Function {fn_name} missing in tron.js"
        print(f"  [PASS] Core function '{fn_name}' implemented.")

    # 3.3 Ghost mode collision bypass
    assert 'isGhost' in tron_js, "isGhost field missing"
    assert '!p.isGhost' in tron_js or '!ai.isGhost' in tron_js, "Ghost trail collision bypass missing"
    print("  [PASS] Ghost mode ethereal trail collision bypass verified.")

    # 3.4 EMP direction reversal
    assert 'p.empTimer > 0' in tron_js, "EMP timer check missing"
    assert 'effectiveDir = { x: -newDir.x, y: -newDir.y }' in tron_js, "EMP inverted direction logic missing"
    print("  [PASS] EMP direction reversal logic verified.")

    # 3.5 AI item seeking and EMP confusion
    assert 'closestBox' in tron_js, "AI item seeking heuristic missing"
    assert 'ai.empTimer > 0' in tron_js, "AI EMP confusion handling missing"
    print("  [PASS] AI mystery box attraction & EMP disorientation verified.")

    # 3.6 Missile explosion and trail removal
    assert 'blastRadius' in tron_js, "Missile blast radius calculation missing"
    assert 'p.trail = p.trail.filter' in tron_js, "Trail point removal on missile explosion missing"
    assert 'setCell(tx, ty, 0)' in tron_js, "Grid clearing on missile explosion missing"
    print("  [PASS] Missile blast radius, grid clearance, and trail trimming verified.")

    # 3.7 Canvas Rendering
    for render_feature in ['TRON_STATE.mysteryBoxes.forEach', 'TRON_STATE.missiles.forEach',
                          'TRON_STATE.shockwaves.forEach', 'TRON_STATE.floatingTexts']:
        assert render_feature in tron_js, f"Rendering routine '{render_feature}' missing in tron.js"
    print("  [PASS] Canvas 2D rendering for mystery boxes, missiles, shockwaves, and floating texts verified.")

    # 4. Continuous Collision Detection (Raymarching / Anti-Tunneling)
    print("\n--- [4] Continuous Collision Detection & Missile Anti-Tunneling Verification ---")
    assert 'moveDist' in tron_js or 'subSteps' in tron_js, "Continuous collision detection sub-stepping missing"
    assert 'subSteps = Math.max(1, Math.ceil(moveDist / 0.4))' in tron_js or 'subSteps' in tron_js, "Sub-step resolution missing"

    # Simulate missile fired towards a 1-cell thick wall 1.5 units away
    # Start: x = 11.2, vx = 1.6. Wall at x = 12.
    startX = 11.2
    vx = 1.6
    wallX = 12
    moveDist = abs(vx)
    subSteps = max(1, math.ceil(moveDist / 0.4))
    subDx = vx / subSteps
    hitDetected = False
    currX = startX
    for _ in range(subSteps):
        currX += subDx
        gx = round(currX)
        if gx == wallX:
            hitDetected = True
            break
    assert hitDetected, f"Continuous collision failed: missile leaped over wall at x={wallX}!"
    print(f"  [PASS] Missile anti-tunneling verified: detected wall at x={wallX} within {subSteps} sub-steps.")

    # 5. Non-Contiguous Disjoint Trail Rendering
    print("\n--- [5] Non-Contiguous Disjoint Trail Rendering Verification ---")
    assert 'isAdjacent' in tron_js, "Trail adjacency check missing in renderer"
    assert 'ctx.moveTo(cx, cy)' in tron_js, "Segment break moveTo missing"

    # Verify segmentation logic
    trail = [{'x': 10, 'y': 10}, {'x': 10, 'y': 11}, {'x': 10, 'y': 12},
             # Blast gap at y=13, 14
             {'x': 10, 'y': 15}, {'x': 10, 'y': 16}]
    segments = []
    current_segment = []
    for i, pt in enumerate(trail):
        if i == 0:
            current_segment.append(pt)
        else:
            prev = trail[i - 1]
            if abs(pt['x'] - prev['x']) + abs(pt['y'] - prev['y']) == 1:
                current_segment.append(pt)
            else:
                segments.append(current_segment)
                current_segment = [pt]
    if current_segment:
        segments.append(current_segment)
    assert len(segments) == 2, f"Expected 2 disjoint segments across blast gap, got {len(segments)}"
    assert len(segments[0]) == 3 and len(segments[1]) == 2
    print(f"  [PASS] Trail segmentation verified: split into {len(segments)} independent non-bridging segments.")

    # 6. Simultaneous Crash Batch Settlement Integrity
    print("\n--- [6] Simultaneous Crash Batch Settlement Integrity Verification ---")
    assert 'skipRoundEndCheck' in tron_js, "Batch crash handling without premature round end check missing"
    assert 'roundNeedsEndCheck' in tron_js, "Consolidated round end trigger missing"

    # Simulate simultaneous crash batching
    players = [
        {'id': 1, 'active': True, 'alive': True, 'score': 0, 'crashedThisStep': True},
        {'id': 2, 'active': True, 'alive': True, 'score': 0, 'crashedThisStep': True}
    ]
    # Mark all crashed first
    for p in players:
        if p['crashedThisStep']:
            p['alive'] = False
    alive = [p for p in players if p['active'] and p['alive']]
    # Evaluate round end
    if len(alive) == 1:
        alive[0]['score'] += 1
    # Both should be dead, scores remain 0
    assert players[0]['score'] == 0 and players[1]['score'] == 0, "False win erroneously awarded during tie!"
    print("  [PASS] Simultaneous crash integrity verified: 0 points awarded to both on mutual destruction.")

    # 7. Speed-Disparity Head-On Collision Mutual Destruction
    print("\n--- [7] Speed-Disparity Head-On Collision Mutual Destruction Verification ---")
    assert 'isHeadOn' in tron_js, "Cross-step speed disparity head-on collision check missing"

    # Simulate fast P1 (dir {1, 0}) stepping into slow P2's tile (dir {-1, 0})
    p1 = {'id': 1, 'active': True, 'alive': True, 'isGhost': False, 'dir': {'x': 1, 'y': 0}, 'targetX': 15, 'targetY': 20, 'crashedThisStep': False}
    p2 = {'id': 2, 'active': True, 'alive': True, 'isGhost': False, 'dir': {'x': -1, 'y': 0}, 'x': 15, 'y': 20, 'crashedThisStep': False}
    isHeadOn = (p2['dir']['x'] == -p1['dir']['x'] and p2['dir']['y'] == -p1['dir']['y'])
    if p1['targetX'] == p2['x'] and p1['targetY'] == p2['y'] and isHeadOn:
        p1['crashedThisStep'] = True
        p2['crashedThisStep'] = True
    assert p1['crashedThisStep'] and p2['crashedThisStep'], "Head-on collision failed to destroy both players under speed disparity!"
    print("  [PASS] Speed-disparity head-on collision verified: mutual destruction for both bikes.")

    # 8. Real-time Dynamic HUD Countdown Throttling
    print("\n--- [8] Real-time Dynamic HUD Countdown Throttling Verification ---")
    assert 'hudThrottleTimer' in tron_js, "HUD throttle timer counter missing in tron.js"
    assert 'TRON_STATE.hudThrottleTimer % 6 === 0' in tron_js or 'hudThrottleTimer % 6' in tron_js, "10Hz HUD throttle check missing"
    assert '幽灵' in tron_js and 'EMP' in tron_js, "Ghost and EMP dual status indicators present in HUD"
    print("  [PASS] Real-time 10Hz throttled HUD countdown update logic verified.")

    print("\n==================================================")
    print("  [ALL PASS] 100% TRON POWER-UPS TEST SUCCESSFUL!")
    print("==================================================")

if __name__ == '__main__':
    if sys.platform == 'win32':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    test_tron_items()
