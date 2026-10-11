import os
import re

GAME_METADATA = {
    'TRON': {
        'title': '极光光轮摩托',
        'badge': '👥 4P',
        'size': 'tile-wide',
        'accent': 'tile-accent-tron',
        'mode_text': '1-4人同屏 / AI',
        'feat_text': '60FPS 连通域AI'
    },
    'BOMBCAT': {
        'title': '疯狂拆弹猫',
        'badge': '👥 4P',
        'size': 'tile-medium',
        'accent': 'tile-accent-bombcat',
        'mode_text': '2-4人暗牌 / AI',
        'feat_text': '心理博弈/自救'
    },
    'NES': {
        'title': 'FC 怀旧红白机厅',
        'badge': '🕹️ 800+',
        'size': 'tile-large',
        'accent': 'tile-accent-nes',
        'mode_text': '双人同屏 / 单人',
        'feat_text': '870+原版ROM'
    },
    'CONTRA': {
        'title': '魂斗罗',
        'badge': '💥 经典',
        'size': 'tile-wide',
        'accent': 'tile-accent-contra',
        'mode_text': '双人同屏 / 30命',
        'feat_text': '8向弹道/S散弹'
    },
    'UNO': {
        'title': '彩虹乌诺牌',
        'badge': '🌈 4P',
        'size': 'tile-wide',
        'accent': 'tile-accent-uno',
        'mode_text': '1-4人 / 智能AI',
        'feat_text': '四色转盘/连环+4'
    },
    'BOMBERMAN': {
        'title': '极光炸弹人大乱斗',
        'badge': '💣 4P',
        'size': 'tile-wide',
        'accent': 'tile-accent-bomberman',
        'mode_text': '1-4人同屏 / AI',
        'feat_text': '6大道具体系/螺旋毒圈'
    },
    'MONOPOLY': {
        'title': '经典大富翁',
        'badge': '🎩 8P',
        'size': 'tile-large',
        'accent': 'tile-accent-monopoly',
        'mode_text': '2-8人 / 联机 / AI',
        'feat_text': '40格强手棋/买地盖房'
    },
    'SANGUOSHA': {
        'title': '三国杀',
        'badge': '🗡️ 8P',
        'size': 'tile-wide',
        'accent': 'tile-accent-sanguosha',
        'mode_text': '身份局 / 国战 / AI',
        'feat_text': '全套武将/军争篇'
    },
    'SPLENDOR': {
        'title': '璀璨宝石',
        'badge': '💎 4P',
        'size': 'tile-medium',
        'accent': 'tile-accent-splendor',
        'mode_text': '2-4人 / 筹码交易',
        'feat_text': '宝石引擎/贵族赞助'
    },
    'LIARSBAR': {
        'title': '骗子酒馆',
        'badge': '🍺 4P',
        'size': 'tile-wide',
        'accent': 'tile-accent-liarsbar',
        'mode_text': '2-4人 / 联机 / AI',
        'feat_text': '叫牌抓谎/左轮手枪'
    },
    'DOUDIZHU': {
        'title': '经典斗地主',
        'badge': '👑 3P',
        'size': 'tile-wide',
        'accent': 'tile-accent-doudizhu',
        'mode_text': '3人 / 联机 / AI',
        'feat_text': '叫抢地主/飞机炸弹'
    },
    'AEROPLANE': {
        'title': '四人飞行棋',
        'badge': '✈️ 4P',
        'size': 'tile-wide',
        'accent': 'tile-accent-aeroplane',
        'mode_text': '1-4人同屏 / AI',
        'feat_text': '掷六起飞/跳跃'
    },
    'QUORIDOR': {
        'title': '步步为营',
        'badge': '🧱 门萨',
        'size': 'tile-medium',
        'accent': 'tile-accent-quoridor',
        'mode_text': '2-4人 / BFS AI',
        'feat_text': '筑墙截杀突围'
    },
    'GO': {
        'title': '玄素围棋',
        'badge': '⚪⚫ 围棋',
        'size': 'tile-medium',
        'accent': 'tile-accent-go',
        'mode_text': '9/13/19路 / AI',
        'feat_text': 'MCTS 启发式 AI'
    },
    'KAYA': {
        'title': 'Kaya 现代围棋',
        'badge': '🌲 KataGo',
        'size': 'tile-medium',
        'accent': 'tile-accent-kaya',
        'mode_text': '神经网络 AI',
        'feat_text': '实时胜率/SGF'
    },
    'GRAVITY': {
        'title': '重力五子棋',
        'badge': '⬇️ 连珠',
        'size': 'tile-medium',
        'accent': 'tile-accent-gravity',
        'mode_text': '1-2人 / AI',
        'feat_text': '纵向滑落堆叠'
    },
    'GRAVITY4': {
        'title': '重力四子棋',
        'badge': '🟡 经典',
        'size': 'tile-medium',
        'accent': 'tile-accent-gravity4',
        'mode_text': '1-2人 / AI',
        'feat_text': '黄金中路评估'
    },
    'GRAVITY3D': {
        'title': '3D 立体五子棋',
        'badge': '🧊 空间',
        'size': 'tile-medium',
        'accent': 'tile-accent-gravity3d',
        'mode_text': '5×5×5 立体空间',
        'feat_text': '13维空间胜线'
    },
    'GRAVITY3D4': {
        'title': '3D 立体四子棋',
        'badge': '💜 魔方',
        'size': 'tile-medium',
        'accent': 'tile-accent-gravity3d4',
        'mode_text': '4×4×4 空间魔方',
        'feat_text': '76条空间胜线'
    },
    'TANKTROUBLE': {
        'title': '坦克动荡',
        'badge': '🛡️ 弹道',
        'size': 'tile-wide',
        'accent': 'tile-accent-tanktrouble',
        'mode_text': '双人对轰 / AI',
        'feat_text': '迷宫穿墙反弹'
    },
    'HOCKEY': {
        'title': '极光桌上冰球',
        'badge': '🏒 极光',
        'size': 'tile-medium',
        'accent': 'tile-accent-hockey',
        'mode_text': '双人同屏 / AI',
        'feat_text': '刚体弹性碰撞'
    },
    'SUMO': {
        'title': '物理飞车相扑',
        'badge': '🚗 擂台',
        'size': 'tile-medium',
        'accent': 'tile-accent-sumo',
        'mode_text': '旋转加速冲撞',
        'feat_text': '边缘坠落检测'
    },
    'TANK': {
        'title': '极限抛物线',
        'badge': '🎯 炮击',
        'size': 'tile-medium',
        'accent': 'tile-accent-tank',
        'mode_text': '双人坦克对战',
        'feat_text': '风力扰动与弹坑'
    },
    'LIARSDICE': {
        'title': '皇家大话骰',
        'badge': '🎲 吹牛',
        'size': 'tile-wide',
        'accent': 'tile-accent-liarsdice',
        'mode_text': '双人同屏 / AI',
        'feat_text': '斋飞转换与博弈'
    },
    'IAIDO': {
        'title': '拔刀居合斩',
        'badge': '⚡ 毫秒',
        'size': 'tile-medium',
        'accent': 'tile-accent-iaido',
        'mode_text': '双人极限对决',
        'feat_text': '抢跑失误判负'
    },
    'STACK': {
        'title': '极光叠叠高',
        'badge': '🥞 节奏',
        'size': 'tile-medium',
        'accent': 'tile-accent-stack',
        'mode_text': '单人解压挑战',
        'feat_text': '八度天籁音阶'
    }
}

GROUPS = [
    {
        'key': 'FEATURED',
        'title': '🌟 精选对决 · FEATURED',
        'games': ['TRON', 'BOMBERMAN', 'BOMBCAT', 'NES', 'CONTRA', 'MONOPOLY']
    },
    {
        'key': 'STRATEGY',
        'title': '🧠 策略博弈 · STRATEGY',
        'games': ['SANGUOSHA', 'SPLENDOR', 'AEROPLANE', 'QUORIDOR', 'GO', 'KAYA', 'GRAVITY', 'GRAVITY4', 'GRAVITY3D', 'GRAVITY3D4']
    },
    {
        'key': 'PHYSICS',
        'title': '⚔️ 物理对抗 · PHYSICS',
        'games': ['TANKTROUBLE', 'HOCKEY', 'SUMO', 'TANK']
    },
    {
        'key': 'MIND_REFLEX',
        'title': '⚡ 心理与手速 · MIND & REFLEX',
        'games': ['LIARSBAR', 'DOUDIZHU', 'UNO', 'LIARSDICE', 'IAIDO', 'STACK']
    }
]

def upgrade():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Add metro.css to head
    if 'common/metro.css' not in html:
        html = html.replace(
            '<link rel="stylesheet" href="common/common.css">',
            '<link rel="stylesheet" href="common/common.css">\n  <link rel="stylesheet" href="common/metro.css">'
        )

    # 2. Add Metro button to view-mode-toggle
    if 'id="view-mode-metro"' not in html:
        html = re.sub(
            r'(<div class="view-mode-toggle" id="view-mode-toggle">\s*)',
            r'''\1<button class="btn-view-mode active" id="view-mode-metro" onclick="setViewMode('metro', true)" title="Windows Metro 动态磁贴模式">
              <span>🪟</span>
              <span>Metro</span>
            </button>\n            ''',
            html
        )
        # remove active from other buttons if present
        html = html.replace('id="view-mode-poster" class="btn-view-mode active"', 'id="view-mode-poster" class="btn-view-mode"')
        html = html.replace('class="btn-view-mode active" id="view-mode-poster"', 'class="btn-view-mode" id="view-mode-poster"')

    # 3. Add Metro header banner before lobby-game-grid
    if 'id="metro-header-banner"' not in html:
        metro_header = '''      <!-- Windows Metro 专属大字标题与快捷操作栏 -->
      <div class="metro-header-banner" id="metro-header-banner">
        <div class="metro-title-large">
          <span>games</span>
          <span class="metro-title-sub">Arcade Hub</span>
        </div>
        <div class="metro-actions-bar">
          <button class="metro-btn-circle" onclick="toggleSemanticZoom()" title="分类概览 (Semantic Zoom)" aria-label="分类概览">
            <span>🔍</span>
          </button>
          <button class="metro-btn-circle" onclick="pickRandomGame()" title="天命随机" aria-label="天命随机">
            <span>🎲</span>
          </button>
        </div>
      </div>\n\n'''
        html = re.sub(
            r'(<div class="game-grid" id="lobby-game-grid">)',
            metro_header + r'\1',
            html
        )

    # 4. Extract all game cards
    card_pattern = re.compile(r'(<div class="game-card\b[\s\S]*?)(?=(?:<div class="game-card\b|<div class="no-results-state"|</main>|<!-- 搜索))')
    cards = card_pattern.findall(html)
    print(f"Found {len(cards)} game cards in main index.html.")

    card_dict = {}
    for c in cards:
        m = re.search(r'data-game-key="([^"]+)"', c)
        if m:
            key = m.group(1).upper()
            card_dict[key] = c.strip()

    print(f"Parsed keys ({len(card_dict)}): {list(card_dict.keys())}")

    # Transform each card
    transformed_cards = {}
    for key, c_html in card_dict.items():
        meta = GAME_METADATA.get(key, {
            'title': key,
            'badge': '🎮 游戏',
            'size': 'tile-medium',
            'accent': 'tile-accent-tron',
            'mode_text': '支持对战',
            'feat_text': '经典玩法'
        })

        # Add classes to outer card tag
        def add_classes(match):
            cls = match.group(1)
            new_cls = cls
            if meta['size'] not in new_cls:
                new_cls += f" {meta['size']}"
            if meta['accent'] not in new_cls:
                new_cls += f" {meta['accent']}"
            return f'class="{new_cls}"'

        c_html = re.sub(r'class="([^"]+)"', add_classes, c_html, count=1)

        open_match = re.match(r'(<div class="game-card\b[^>]*>)', c_html)
        if not open_match:
            transformed_cards[key] = c_html
            continue

        open_tag = open_match.group(1)
        inner = c_html[len(open_tag):-6].strip()

        cover_start = inner.find('<div class="card-cover-wrapper">')
        body_start = inner.find('<div class="card-body">')
        if body_start == -1:
            body_start = inner.find('<div class="card-content">')
        if body_start == -1:
            body_start = inner.find('<div class="card-info">')

        if cover_start != -1 and body_start != -1:
            cover_content = inner[cover_start:body_start].strip()
            body_content = inner[body_start:].strip()

            new_inner = f'''
        <div class="metro-tile-flipper">
          <div class="metro-tile-front">
            {cover_content}
            <div class="tile-info-overlay">
              <span class="tile-title-text">{meta['title']}</span>
              <span class="tile-badge-num">{meta['badge']}</span>
            </div>
          </div>
          <div class="metro-tile-back">
            <div class="tile-back-header">
              <span class="tile-back-title">{meta['title']}</span>
              <span class="tile-back-status">未开始</span>
            </div>
            <div class="tile-back-body">
              <div class="tile-stat-row"><span>支持模式:</span> <span class="tile-stat-val">{meta['mode_text']}</span></div>
              <div class="tile-stat-row"><span>历史战局:</span> <span class="tile-stat-val tile-stat-val-plays">0 局</span></div>
              <div class="tile-stat-row"><span>特色机制:</span> <span class="tile-stat-val">{meta['feat_text']}</span></div>
            </div>
            <div class="tile-back-footer">
              <button class="tile-btn-launch" onclick="event.stopPropagation(); enterGame('{key}')">开战 ▶</button>
            </div>
          </div>
          {body_content}
        </div>'''
            transformed_cards[key] = f"{open_tag}\n{new_inner}\n      </div>"
        else:
            transformed_cards[key] = c_html

    # Assemble groups
    groups_html = []
    for g in GROUPS:
        g_key = g['key']
        g_title = g['title']
        g_cards_html = []
        for g_name in g['games']:
            if g_name in transformed_cards:
                g_cards_html.append(transformed_cards[g_name])

        group_str = f'''
      <!-- Metro 分组: {g_key} -->
      <div class="metro-group" data-group="{g_key}">
        <div class="metro-group-header" onclick="jumpToCategoryGroup('{g_key}')">
          <span>{g_title}</span>
        </div>
        <div class="metro-group-body">
          {"\n\n          ".join(g_cards_html)}
        </div>
      </div>'''
        groups_html.append(group_str)

    all_groups_combined = "\n".join(groups_html)

    first_card_pos = html.find('<div class="game-card')
    no_results_pos = html.find('<div class="no-results-state"')

    html = html[:first_card_pos] + all_groups_combined + "\n\n      " + html[no_results_pos:]

    # 5. Add Semantic Zoom Overlay & Windows Phone App Bar before </body>
    if 'id="wp-app-bar"' not in html:
        zoom_and_app_bar = '''  <!-- ====================================================================
       Windows Phone 经典 Application Bar
       ==================================================================== -->
  <nav class="wp-app-bar" id="wp-app-bar" aria-label="Windows Phone 操作栏">
    <button class="wp-app-bar-btn" onclick="dockScrollToTop()" title="回顶部">
      <div class="wp-app-bar-circle">🏠</div>
      <div class="wp-app-bar-text">start</div>
    </button>
    <button class="wp-app-bar-btn" onclick="toggleSemanticZoom()" title="分类缩放">
      <div class="wp-app-bar-circle">🔍</div>
      <div class="wp-app-bar-text">zoom</div>
    </button>
    <button class="wp-app-bar-btn" onclick="pickRandomGame()" title="天命随机">
      <div class="wp-app-bar-circle">🎲</div>
      <div class="wp-app-bar-text">random</div>
    </button>
    <button class="wp-app-bar-btn" onclick="toggleSound()" title="音效开关">
      <div class="wp-app-bar-circle" id="wp-sound-icon">🔊</div>
      <div class="wp-app-bar-text">sound</div>
    </button>
  </nav>

  <!-- ====================================================================
       Windows 8 语义缩放全景覆盖层 (Semantic Zoom Overlay)
       ==================================================================== -->
  <div class="metro-semantic-zoom" id="metro-semantic-zoom">
    <div class="semantic-zoom-header">分类概览 · Semantic Zoom</div>
    <div class="semantic-zoom-grid">
      <div class="semantic-zoom-card tile-accent-tron" onclick="jumpToCategoryGroup('FEATURED')">
        <div class="cat-name">🌟 精选对决</div>
        <div class="cat-count">6 款核心高频游戏</div>
      </div>
      <div class="semantic-zoom-card tile-accent-quoridor" onclick="jumpToCategoryGroup('STRATEGY')">
        <div class="cat-name">🧠 策略博弈</div>
        <div class="cat-count">10 款经典棋类与策略桌游</div>
      </div>
      <div class="semantic-zoom-card tile-accent-tanktrouble" onclick="jumpToCategoryGroup('PHYSICS')">
        <div class="cat-name">⚔️ 物理对抗</div>
        <div class="cat-count">4 款弹道射击与物理碰撞</div>
      </div>
      <div class="semantic-zoom-card tile-accent-bombcat" onclick="jumpToCategoryGroup('MIND_REFLEX')">
        <div class="cat-name">⚡ 心理与手速</div>
        <div class="cat-count">6 款心理暗牌与极限反应</div>
      </div>
    </div>
    <button class="btn-reset-filters" onclick="toggleSemanticZoom(false)" style="margin-top: 24px; padding: 8px 24px; background: rgba(255,255,255,0.2); border: 1px solid #fff; color: #fff; border-radius: 2px; cursor: pointer;">返回大厅 ✕</button>
  </div>

  <script src="common/metro.js"></script>
'''
        html = html.replace('</body>', zoom_and_app_bar + '</body>')

    # 6. Update setViewMode and initViewMode in script
    old_view_mode_code = '''    function setViewMode(mode, playSound = false) {
      if (playSound && typeof triggerHaptic === 'function') triggerHaptic('light');
      if (playSound && window.AUDIO) try { window.AUDIO.play('click'); } catch(e) {}
      const targetMode = mode === 'compact' ? 'compact' : 'poster';
      try {
        localStorage.setItem('arcade_view_mode', targetMode);
      } catch(e) {}

      const grid = document.getElementById('lobby-game-grid');
      const btnPoster = document.getElementById('view-mode-poster');
      const btnCompact = document.getElementById('view-mode-compact');

      if (grid) {
        if (targetMode === 'compact') {
          grid.classList.add('compact-mode');
        } else {
          grid.classList.remove('compact-mode');
        }
      }

      if (btnPoster && btnCompact) {
        btnPoster.classList.toggle('active', targetMode === 'poster');
        btnCompact.classList.toggle('active', targetMode === 'compact');
      }
    }

    function initViewMode() {
      let saved = 'poster';
      try {
        saved = localStorage.getItem('arcade_view_mode') || 'poster';
      } catch(e) {}
      setViewMode(saved, false);
    }'''

    new_view_mode_code = '''    function setViewMode(mode, playSound = false) {
      if (playSound && typeof triggerHaptic === 'function') triggerHaptic('light');
      if (playSound && window.AUDIO) try { window.AUDIO.play('click'); } catch(e) {}
      const targetMode = (mode === 'compact' || mode === 'poster' || mode === 'metro') ? mode : 'metro';
      try {
        localStorage.setItem('arcade_view_mode', targetMode);
      } catch(e) {}

      const grid = document.getElementById('lobby-game-grid');
      const btnPoster = document.getElementById('view-mode-poster');
      const btnCompact = document.getElementById('view-mode-compact');
      const btnMetro = document.getElementById('view-mode-metro');

      if (grid) {
        if (targetMode === 'metro') {
          grid.classList.remove('compact-mode');
          if (window.MetroEngine) window.MetroEngine.activate();
        } else if (targetMode === 'compact') {
          if (window.MetroEngine) window.MetroEngine.deactivate();
          grid.classList.add('compact-mode');
        } else {
          if (window.MetroEngine) window.MetroEngine.deactivate();
          grid.classList.remove('compact-mode');
        }
      }

      if (btnPoster && btnCompact) {
        btnPoster.classList.toggle('active', targetMode === 'poster');
        btnCompact.classList.toggle('active', targetMode === 'compact');
        if (btnMetro) btnMetro.classList.toggle('active', targetMode === 'metro');
      }
    }

    function initViewMode() {
      let saved = 'metro';
      try {
        saved = localStorage.getItem('arcade_view_mode') || 'metro';
      } catch(e) {}
      setViewMode(saved, false);
      if (window.MetroEngine) window.MetroEngine.init();
    }'''

    html = html.replace(old_view_mode_code, new_view_mode_code)

    # 7. Update applyFilters to update metro-group visibility
    old_apply_filters = '''      const noResults = document.getElementById('no-results-state');
      if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'flex' : 'none';
      }'''

    new_apply_filters = '''      // Metro 模式下联动更新组可见性
      document.querySelectorAll('.metro-group').forEach(grp => {
        const visibleChild = grp.querySelector('.game-card:not([style*="display: none"])');
        grp.style.display = visibleChild ? '' : 'none';
      });

      const noResults = document.getElementById('no-results-state');
      if (noResults) {
        noResults.style.display = visibleCount === 0 ? 'flex' : 'none';
      }'''

    html = html.replace(old_apply_filters, new_apply_filters)

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("All 26 games in index.html upgraded to Metro Live Tiles successfully!")

if __name__ == '__main__':
    upgrade()
