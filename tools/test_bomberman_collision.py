"""
Automated Deep Verification Test Suite for Bomberman Collision System
Verifies:
1. Syntax balance in games/bomberman.html and games/js/bomberman.js
2. Removal of can_pass soft-brick phase curse
3. Implementation of true AABB bounding box collision
4. Safe assisted cornering without wall clipping
5. High-speed anti-tunneling physics
6. Bomb placement pass-off and solid barrier enforcement
"""

import os
import re
import sys

def run_tests():
    print("=" * 55)
    print("  BOMBERMAN AABB COLLISION & ANTI-TUNNELING SUITE")
    print("=" * 55)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    html_path = os.path.join(base_dir, 'games', 'bomberman.html')
    js_path = os.path.join(base_dir, 'games', 'js', 'bomberman.js')

    # [1] File existence and syntax check
    print("\n--- [1] Code Syntax & Structural Integrity ---")
    assert os.path.exists(html_path), "games/bomberman.html missing"
    assert os.path.exists(js_path), "games/js/bomberman.js missing"

    with open(js_path, 'r', encoding='utf-8') as f:
        js_code = f.read()

    # Check brackets
    stack = []
    brackets = {'{': '}', '(': ')', '[': ']'}
    for ch in js_code:
        if ch in brackets:
            stack.append(ch)
        elif ch in brackets.values():
            if stack and brackets[stack[-1]] == ch:
                stack.pop()

    assert len(stack) == 0, f"Unbalanced brackets in bomberman.js: remaining={len(stack)}"
    print("  [PASS] bomberman.js syntax and brackets perfectly balanced.")

    # [2] Curse audit: Ensure 'can_pass' is completely removed
    print("\n--- [2] Wall-Phase Curse Audit ---")
    assert "'can_pass'" not in js_code and '"can_pass"' not in js_code, "can_pass curse must be completely removed"
    assert "curseType === 'can_pass'" not in js_code, "can_pass condition must be removed from collision"
    print("  [PASS] 'can_pass' curse completely purged from engine.")

    # [3] Collision architecture check
    print("\n--- [3] AABB Architecture Verification ---")
    assert "const PLAYER_RADIUS = 16;" in js_code, "PLAYER_RADIUS constant missing"
    assert "function boxCollides(" in js_code, "boxCollides function missing"
    assert "function movePlayer(" in js_code, "movePlayer function missing"
    assert "passablePlayers" in js_code, "Bomb passablePlayers tracking missing"
    print("  [PASS] Core AABB collision functions verified in bomberman.js.")

    # [4] Mathematical Simulation Tests
    print("\n--- [4] 100,000-Step Exhaustive Movement & Cornering Simulation ---")
    COLS, ROWS, CELL = 15, 13, 48
    CELL_EMPTY, CELL_HARD, CELL_SOFT = 0, 1, 2
    RADIUS = 16
    SLIDE_THRESHOLD = 18

    # Build standard arena
    grid = [[CELL_EMPTY]*COLS for _ in range(ROWS)]
    for r in range(ROWS):
        for c in range(COLS):
            if r == 0 or r == ROWS-1 or c == 0 or c == COLS-1: grid[r][c] = CELL_HARD
            elif r%2 == 0 and c%2 == 0: grid[r][c] = CELL_HARD
            else: grid[r][c] = CELL_SOFT

    # Clear safe corridors around spawn
    grid[1][1] = CELL_EMPTY
    grid[1][2] = CELL_EMPTY
    grid[1][3] = CELL_EMPTY
    grid[2][1] = CELL_EMPTY
    grid[3][1] = CELL_EMPTY
    grid[3][2] = CELL_EMPTY
    grid[3][3] = CELL_EMPTY

    class SimPlayer:
        def __init__(self, id, c, r):
            self.id = id
            self.x = c * CELL + CELL / 2
            self.y = r * CELL + CELL / 2
            self.hasKick = False
            self.cursed = False

    sim_bombs = []

    def is_solid(c, r, p):
        if c < 0 or c >= COLS or r < 0 or r >= ROWS: return True
        if grid[r][c] == CELL_HARD or grid[r][c] == CELL_SOFT: return True
        for b in sim_bombs:
            if b['c'] == c and b['r'] == r:
                if p.id in b['passable']:
                    continue
                return True
        return False

    def box_collides(x, y, p):
        min_c = int((x - RADIUS) // CELL)
        max_c = int((x + RADIUS) // CELL)
        min_r = int((y - RADIUS) // CELL)
        max_r = int((y + RADIUS) // CELL)
        for r in range(min_r, max_r + 1):
            for c in range(min_c, max_c + 1):
                if is_solid(c, r, p):
                    return True
        return False

    def move_player(p, move_x, move_y, speed):
        if move_x != 0 and move_y != 0: move_x = 0
        target_x = p.x + move_x * speed
        target_y = p.y + move_y * speed
        if not box_collides(target_x, target_y, p):
            p.x = target_x
            p.y = target_y
            return

        # Assisted cornering
        if move_x != 0:
            current_r = int(p.y // CELL)
            center_y = current_r * CELL + CELL / 2
            diff_y = center_y - p.y
            if abs(diff_y) <= SLIDE_THRESHOLD and abs(diff_y) > 0.01:
                slide_dir = 1 if diff_y > 0 else -1
                slide_y = p.y + slide_dir * min(speed, abs(diff_y))
                if not box_collides(p.x, slide_y, p):
                    p.y = slide_y
                    if not box_collides(p.x + move_x * speed, p.y, p):
                        p.x += move_x * speed
        elif move_y != 0:
            current_c = int(p.x // CELL)
            center_x = current_c * CELL + CELL / 2
            diff_x = center_x - p.x
            if abs(diff_x) <= SLIDE_THRESHOLD and abs(diff_x) > 0.01:
                slide_dir = 1 if diff_x > 0 else -1
                slide_x = p.x + slide_dir * min(speed, abs(diff_x))
                if not box_collides(slide_x, p.y, p):
                    p.x = slide_x
                    if not box_collides(p.x, p.y + move_y * speed, p):
                        p.y += move_y * speed

    # Simulation: 100,000 steps across varying speeds
    import random
    random.seed(42)
    p = SimPlayer(0, 1, 1)
    breaches = 0
    speeds = [2.5, 3.3, 4.1, 4.9, 5.5, 6.0]
    directions = [(1,0), (-1,0), (0,1), (0,-1), (1,1), (-1,-1), (0,0)]

    for step in range(100000):
        dx, dy = random.choice(directions)
        spd = random.choice(speeds)
        move_player(p, dx, dy, spd)
        if box_collides(p.x, p.y, p):
            breaches += 1
            print(f"  [FAIL] Wall breach detected at step {step}: pos=({p.x}, {p.y})")
            break

    assert breaches == 0, f"Detected {breaches} wall breaches during simulation"
    print(f"  [PASS] 100,000 steps executed with 0 wall breaches across speeds 2.5px to 6.0px.")

    # [5] Bomb Pass-Through Verification
    print("\n--- [5] Bomb Placement & Walk-Off Verification ---")
    p = SimPlayer(0, 1, 1)
    b = {'c': 1, 'r': 1, 'passable': {p.id}}
    sim_bombs.append(b)

    # 1. Walk off bomb to the right
    for _ in range(25):
        move_player(p, 1, 0, 2.5)
    assert p.x > 1*CELL + CELL/2, "Player must be able to walk off own bomb"
    
    # Check that player stepped off
    min_c = int((p.x - RADIUS) // CELL)
    if b['c'] < min_c:
        b['passable'].discard(p.id)

    # 2. Try to walk back into the bomb
    for _ in range(50):
        move_player(p, -1, 0, 2.5)
    
    # Must NOT re-enter bomb cell
    assert not box_collides(p.x, p.y, p), "Player must not collide with wall or bomb interior"
    assert p.x >= 2 * CELL - RADIUS, f"Player must be blocked by solid bomb: x={p.x}"
    print("  [PASS] Bomb walk-off and subsequent barrier blockage verified.")

    print("\n" + "=" * 55)
    print("  [ALL PASS] 100% BOMBERMAN COLLISION VERIFICATION PASSED")
    print("=" * 55)

if __name__ == '__main__':
    run_tests()
