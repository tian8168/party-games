import os
import re
import math
from PIL import Image, ImageDraw, ImageFont

GAME_DIR = os.path.join(os.getcwd(), 'games', 'sanguosha')
CHAR_DIR = os.path.join(GAME_DIR, 'image', 'character')
CARD_DIR = os.path.join(GAME_DIR, 'image', 'card')
BG_DIR = os.path.join(GAME_DIR, 'image', 'background')

os.makedirs(CHAR_DIR, exist_ok=True)
os.makedirs(CARD_DIR, exist_ok=True)
os.makedirs(BG_DIR, exist_ok=True)

font_candidates = [
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simsun.ttc",
    "C:/Windows/Fonts/kaiti.ttf"
]
chosen_font_path = None
for f in font_candidates:
    if os.path.exists(f):
        chosen_font_path = f
        break

def get_font(size):
    if chosen_font_path:
        try:
            return ImageFont.truetype(chosen_font_path, size)
        except Exception:
            pass
    return ImageFont.load_default()

FACTION_COLORS = {
    'wei': {'primary': (28, 56, 120), 'accent': (56, 189, 248), 'title': '魏国名将 · 雄才霸略', 'hanzi': '魏'},
    'shu': {'primary': (140, 32, 28), 'accent': (248, 113, 113), 'title': '蜀汉英豪 · 仁义两全', 'hanzi': '蜀'},
    'wu':  {'primary': (24, 100, 75), 'accent': (52, 211, 153), 'title': '东吴豪杰 · 智略风流', 'hanzi': '吴'},
    'qun': {'primary': (110, 80, 36), 'accent': (251, 191, 36), 'title': '群雄名仕 · 逐鹿中原', 'hanzi': '群'},
    'jin': {'primary': (85, 35, 115), 'accent': (192, 132, 252), 'title': '西晋先锋 · 应天受命', 'hanzi': '晋'},
    'shen': {'primary': (120, 35, 140), 'accent': (244, 114, 182), 'title': '神武英灵 · 超凡入圣', 'hanzi': '神'},
    'male': {'primary': (30, 40, 55), 'accent': (148, 163, 184), 'title': '三国骁将 · 威震华夏', 'hanzi': '将'},
    'female': {'primary': (90, 35, 65), 'accent': (244, 114, 182), 'title': '绝代佳人 · 巾帼英华', 'hanzi': '帼'}
}

# 1. Generate Silhouettes
def generate_silhouettes():
    w, h = 260, 360
    for key, info in FACTION_COLORS.items():
        im = Image.new('RGB', (w, h), (16, 18, 22))
        draw = ImageDraw.Draw(im)
        p_col = info['primary']
        a_col = info['accent']

        for y in range(h):
            factor = y / h
            r = int(p_col[0] * (0.35 + 0.65 * (1 - factor)) + 12 * factor)
            g = int(p_col[1] * (0.35 + 0.65 * (1 - factor)) + 14 * factor)
            b = int(p_col[2] * (0.35 + 0.65 * (1 - factor)) + 18 * factor)
            draw.line([(0, y), (w, y)], fill=(r, g, b))

        gold = (212, 175, 55)
        gold_dim = (140, 110, 40)
        draw.rounded_rectangle([6, 6, w - 6, h - 6], radius=8, outline=gold, width=2)
        draw.rounded_rectangle([9, 9, w - 9, h - 9], radius=6, outline=gold_dim, width=1)

        cx, cy = w // 2, h // 2
        # Center medallion
        draw.ellipse([cx - 48, cy - 58, cx + 48, cy + 38], fill=(20, 22, 28, 220), outline=gold, width=2)
        h_font = get_font(42)
        tb_h = draw.textbbox((0, 0), info['hanzi'], font=h_font)
        hw, hh = tb_h[2] - tb_h[0], tb_h[3] - tb_h[1]
        draw.text((cx - hw // 2, cy - 10 - hh // 2), info['hanzi'], font=h_font, fill=a_col)

        # Bottom banner
        bot_y = h - 52
        draw.rectangle([14, bot_y, w - 14, bot_y + 36], fill=(14, 16, 20, 230), outline=gold_dim, width=1)
        t_font = get_font(14)
        title_str = info['title']
        tb_t = draw.textbbox((0, 0), title_str, font=t_font)
        tw_t = tb_t[2] - tb_t[0]
        draw.text((cx - tw_t // 2, bot_y + 8), title_str, font=t_font, fill=gold)

        out_path = os.path.join(CHAR_DIR, f"default_silhouette_{key}.jpg")
        im.save(out_path, 'JPEG', quality=78, optimize=True)

# 2. Extract all base characters across core packs
def get_all_core_characters():
    char_base_dict = {}
    char_dir = os.path.join(os.getcwd(), 'games', 'sanguosha', 'character')
    for p in ['standard', 'refresh', 'shenhua', 'yijiang', 'sp', 'extra']:
        p_file = os.path.join(char_dir, p, 'character.js')
        t_file = os.path.join(char_dir, p, 'translate.js')
        if not os.path.exists(p_file):
            continue
        content = open(p_file, 'r', encoding='utf-8').read()
        t_content = open(t_file, 'r', encoding='utf-8').read() if os.path.exists(t_file) else ''
        trans = dict(re.findall(r'(\b\w+)\s*:\s*[\'"]([^\'"]+)[\'"]', t_content))
        
        matches = re.finditer(r'(\b\w+)\s*:\s*\{\s*(?:/\*.*?\*/\s*)?sex\s*:\s*[\'"](\w+)[\'"].*?group\s*:\s*[\'"](\w+)[\'"]', content, re.DOTALL)
        for m in matches:
            cid, sex, group = m.group(1), m.group(2), m.group(3)
            base = re.sub(r'^(?:[a-z0-9]+_)+', '', cid)
            name = trans.get(cid, trans.get(base, base))
            # Clean up name if it contains html or prefixes
            name = re.sub(r'<[^>]+>', '', name).replace('界', '').replace('☆', '').replace('★', '').strip()
            if not name:
                name = base
            if base not in char_base_dict:
                char_base_dict[base] = {'name': name, 'sex': sex, 'group': group}
    return char_base_dict

def generate_portrait(base_id, name, group, sex):
    w, h = 260, 360
    im = Image.new('RGB', (w, h), (16, 18, 22))
    draw = ImageDraw.Draw(im)

    f_info = FACTION_COLORS.get(group, FACTION_COLORS.get('wei'))
    r_c, g_c, b_c = f_info['primary']

    for y in range(h):
        factor = y / h
        r = int(r_c * (0.35 + 0.65 * (1 - factor)) + 12 * factor)
        g = int(g_c * (0.35 + 0.65 * (1 - factor)) + 14 * factor)
        b = int(b_c * (0.35 + 0.65 * (1 - factor)) + 18 * factor)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    gold = (212, 175, 55)
    gold_dim = (145, 115, 45)
    draw.rounded_rectangle([6, 6, w - 6, h - 6], radius=8, outline=gold, width=2)
    draw.rounded_rectangle([9, 9, w - 9, h - 9], radius=6, outline=gold_dim, width=1)

    cx, cy = w // 2, h // 2 - 20
    # Soft radiant aura in upper middle
    aura = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    adraw = ImageDraw.Draw(aura)
    for r in range(80, 0, -5):
        alpha = int(35 * (1 - r / 80))
        adraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(r_c + 40, g_c + 40, b_c + 40, alpha))
    im.paste(aura, (0, 0), aura)

    # Stylized silhouette
    if sex == 'female':
        draw.ellipse([cx - 16, cy - 60, cx + 16, cy - 25], fill=(24, 24, 28))
        draw.polygon([(cx - 6, cy - 45), (cx + 6, cy - 45), (cx + 24, cy + 20), (cx - 24, cy + 20)], fill=(24, 24, 28))
        draw.polygon([(cx - 22, cy + 15), (cx + 22, cy + 15), (cx + 55, cy + 105), (cx - 55, cy + 105)], fill=(20, 20, 24))
        draw.line([(cx + 8, cy - 50), (cx + 30, cy - 20)], fill=f_info['accent'], width=2)
    else:
        draw.ellipse([cx - 18, cy - 65, cx + 18, cy - 28], fill=(22, 22, 26))
        draw.polygon([(cx - 5, cy - 62), (cx + 5, cy - 62), (cx, cy - 88)], fill=f_info['accent'])
        draw.polygon([(cx - 9, cy - 30), (cx + 9, cy - 30), (cx + 44, cy + 15), (cx - 44, cy + 15)], fill=(24, 26, 30))
        draw.polygon([(cx - 40, cy + 6), (cx + 40, cy + 6), (cx + 68, cy + 115), (cx - 68, cy + 115)], fill=(20, 20, 24))
        draw.line([(cx - 50, cy + 100), (cx + 42, cy - 75)], fill=(80, 85, 95), width=2)

    # Hero Name Plaque
    plaque_w, plaque_h = 140, 48
    px, py = cx - plaque_w // 2, cy - 18
    draw.rounded_rectangle([px, py, px + plaque_w, py + plaque_h], radius=6, fill=(18, 20, 26, 220), outline=gold, width=2)
    n_font = get_font(26)
    tb = draw.textbbox((0, 0), name, font=n_font)
    nw, nh = tb[2] - tb[0], tb[3] - tb[1]
    draw.text((cx - nw // 2, py + (plaque_h - nh) // 2 - 2), name, font=n_font, fill=(255, 248, 230))

    # Bottom Faction & Title Bar
    bot_y = h - 54
    draw.rectangle([14, bot_y, w - 14, bot_y + 40], fill=(14, 16, 20, 230), outline=gold_dim, width=1)
    t_font = get_font(13)
    title_str = f"【{f_info['hanzi']}】· {f_info['title'].split('·')[0].strip()}"
    tb_t = draw.textbbox((0, 0), title_str, font=t_font)
    tw = tb_t[2] - tb_t[0]
    draw.text((cx - tw // 2, bot_y + 12), title_str, font=t_font, fill=gold)

    out_path = os.path.join(CHAR_DIR, f"{base_id}.jpg")
    im.save(out_path, 'JPEG', quality=78, optimize=True)

def main():
    print("=== Building Lean, High-Performance Sanguosha Assets ===")
    
    # 1. Generate silhouettes
    generate_silhouettes()
    print("[OK] Faction and gender silhouettes built.")

    # 2. Get all core base characters
    core_chars = get_all_core_characters()
    print(f"[INFO] Found {len(core_chars)} unique base characters across core packs.")

    # 3. Clean untracked redundant files from CHAR_DIR
    current_files = os.listdir(CHAR_DIR)
    # Tracked files to preserve unconditionally
    preserved = {
        'dc_wuzhi.jpg', 'dc_xiahouhui.jpg', 'dc_zhongyu.jpg', 'dc_zhushuo.jpg',
        'dm_diaochan.jpg', 'dm_lvbu.jpg', 'eu_kaisa.jpg', 'mark_shen_machao.jpg',
        'mb_caohong.jpg', 'mb_huangzu.jpg', 'mb_luyusheng.jpg', 'nezha.jpg',
        'ol_wangyi.jpg', 'pe_xiahouxuan.jpg', 'renwan.jpg', 'shen_zhonghui.jpg',
        'sxrm_jianggan.jpg', 'sxrm_lvboshe.jpg', 'sxrm_wanghou.jpg', 'sxrm_xunyu.jpg',
        'v_caopi.jpg', 'wild_liru.jpg', 'wn_jiaxu.jpg', 'wn_xuhuang.jpg',
        'wn_zhanghe.jpg', 'wuke.jpg', 'zhanghua.jpg'
    }
    
    # Add silhouettes to preserved
    for k in FACTION_COLORS.keys():
        preserved.add(f"default_silhouette_{k}.jpg")
    
    # Add all core base characters to preserved
    for b in core_chars.keys():
        preserved.add(f"{b}.jpg")
        
    removed_count = 0
    for f in current_files:
        if f not in preserved:
            try:
                os.remove(os.path.join(CHAR_DIR, f))
                removed_count += 1
            except Exception:
                pass
    print(f"[OK] Cleaned {removed_count} redundant prefixed duplicate image files.")

    # 4. Generate all core character portraits
    generated_count = 0
    for b, info in core_chars.items():
        generate_portrait(b, info['name'], info['group'], info['sex'])
        generated_count += 1
    print(f"[OK] Generated {generated_count} optimized base character portraits.")

    # Measure total size
    total_size = sum(os.path.getsize(os.path.join(CHAR_DIR, f)) for f in os.listdir(CHAR_DIR))
    print(f"\n[SUCCESS] Final character directory size: {len(os.listdir(CHAR_DIR))} files, {total_size / (1024*1024):.2f} MB!")

if __name__ == '__main__':
    main()
