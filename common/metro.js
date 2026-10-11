/**
 * 🪟 Windows Modern UI / Live Tiles 核心交互与调度引擎 (Metro Engine 2.0)
 * 严格支持：
 * 1. 3D Perspective Tilt 触控/光标倾斜真实物理反馈 (Win8 / WP8 核心质感)
 * 2. Surface & PC 横向滚轮与触控滑动平滑转换 (DeltaY -> ScrollLeft)
 * 3. 动态磁贴 (Live Tiles) 周期性随机平滑翻转调度 (3D Flip Animation)
 * 4. Windows 8 经典 Charm Bar 侧滑搜索与实时即时过滤
 * 5. 5套官方壁纸主题秒级切换与持久化 (localStorage 记忆)
 * 6. 天命随机闪烁光圈巡检与直接开战 (Smooth Scroll Into View)
 * 7. 语义缩放 (Semantic Zoom) 全景分组导航
 */

(function(window) {
  'use strict';

  const THEMES = ['theme-slate', 'theme-teal', 'theme-indigo', 'theme-emerald', 'theme-gold', 'theme-crimson'];

  const MetroEngine = {
    initialized: false,
    active: true,
    visibleCards: new Set(),
    flipIntervalId: null,
    observer: null,
    currentThemeIndex: 0,
    isRandomPicking: false,
    activeQuery: '',
    activePlayerFilter: 'ALL',
    activeCatFilter: 'ALL',
    audioCtx: null,

    // ========================================================================
    // 1. 初始化入口
    // ========================================================================
    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.initTheme();
      this.initAdaptiveLayout();
      this.initTiltPhysics();
      this.initIntersectionObserver();
      this.initHorizontalWheel();
      this.initParallax();
      this.initSemanticZoom();
      this.initCharmDrawer();
      this.startTicker();

      // 页面可见性感知：切后台休眠省电，回前台唤醒
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopTicker();
        } else if (this.active) {
          this.startTicker();
        }
      });

      console.log('🪟 [MetroEngine] Windows Modern UI / Live Tiles 2.0 引擎已就绪');
    },

    // ========================================================================
    // 1b. 自适应视口与动态磁贴尺寸计算 (Adaptive Viewport & Full Fill Layout)
    // ========================================================================
    initAdaptiveLayout() {
      this.updateTileLayout();
      let resizeTimer = null;
      window.addEventListener('resize', () => {
        if (resizeTimer) cancelAnimationFrame(resizeTimer);
        resizeTimer = requestAnimationFrame(() => {
          this.updateTileLayout();
        });
      }, { passive: true });

      // 页面完全加载与 Web 字体渲染完毕后精确重新计算
      window.addEventListener('load', () => this.updateTileLayout(), { passive: true });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this.updateTileLayout());
      }

      if (window.screen && window.screen.orientation) {
        window.screen.orientation.addEventListener('change', () => {
          setTimeout(() => this.updateTileLayout(), 60);
        });
      }
    },

    updateTileLayout() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isPortrait = vw <= 900 && vh >= vw;

      if (isPortrait) {
        document.documentElement.style.removeProperty('--tile-unit');
        document.documentElement.style.removeProperty('--tile-gap');
        return;
      }

      const panorama = document.getElementById('metro-panorama');
      const header = document.getElementById('metro-header-banner');
      if (!panorama || !header) return;

      const isCompactLandscape = vw <= 900 && vw > vh;

      if (isCompactLandscape) {
        const headerHeight = header.offsetHeight || 44;
        const sampleGrp = document.querySelector('.metro-group-header');
        const grpHeight = sampleGrp ? sampleGrp.offsetHeight : 28;
        const grpMargin = sampleGrp ? (parseFloat(window.getComputedStyle(sampleGrp).marginBottom) || 6) : 6;
        const gap = 8;
        const targetBottom = 20;
        const targetTop = 4;
        const available = vh - headerHeight - targetTop - grpHeight - grpMargin - targetBottom;
        const unit = Math.max(75, Math.floor((available - gap) / 2));
        document.documentElement.style.setProperty('--tile-unit', `${unit}px`);
        document.documentElement.style.setProperty('--tile-gap', `${gap}px`);
      } else {
        const headerHeight = header.offsetHeight || 72;
        const sampleGrp = document.querySelector('.metro-group-header');
        const grpHeight = sampleGrp ? sampleGrp.offsetHeight : 38;
        const grpMargin = sampleGrp ? (parseFloat(window.getComputedStyle(sampleGrp).marginBottom) || 12) : 12;
        const gap = vh >= 1000 ? 12 : 10;
        // 磁贴距离屏幕底边约 50px~54px，纵向利用率饱满达 80%~85%
        const targetBottom = 52;
        const targetTop = 8;
        const available = vh - headerHeight - targetTop - grpHeight - grpMargin - targetBottom;
        // 3行磁贴有 2 个 gap: (available - 2 * gap) / 3
        const unit = Math.max(120, Math.floor((available - 2 * gap) / 3));
        document.documentElement.style.setProperty('--tile-unit', `${unit}px`);
        document.documentElement.style.setProperty('--tile-gap', `${gap}px`);
      }
    },

    // ========================================================================
    // 2. 主题壁纸切换系统
    // ========================================================================
    initTheme() {
      let saved = 'theme-teal';
      try {
        saved = localStorage.getItem('win8_metro_theme') || 'theme-teal';
      } catch(e) {}
      this.applyTheme(saved);
    },

    applyTheme(themeName) {
      THEMES.forEach(t => document.body.classList.remove(t));
      if (!THEMES.includes(themeName)) themeName = 'theme-teal';
      document.body.classList.add(themeName);
      this.currentThemeIndex = THEMES.indexOf(themeName);
      try {
        localStorage.setItem('win8_metro_theme', themeName);
      } catch(e) {}

      // 实时同步移动端 / 浏览器顶部状态栏与地址栏主题色
      const themeColors = {
        'theme-slate': '#11151c',
        'theme-teal': '#004652',
        'theme-indigo': '#29123f',
        'theme-emerald': '#0a3818',
        'theme-gold': '#382502',
        'theme-crimson': '#3e0c17'
      };
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && themeColors[themeName]) {
        meta.setAttribute('content', themeColors[themeName]);
      }
    },

    cycleNextTheme() {
      this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
      const nextTheme = THEMES[this.currentThemeIndex];
      this.applyTheme(nextTheme);
      this.playSonic('release');
      if (typeof showToast === 'function') {
        const names = {
          'theme-slate': '极夜黑 (Midnight Black)',
          'theme-teal': '诺基亚青 (Nokia Cyan)',
          'theme-indigo': '皇家紫 (Royal Purple)',
          'theme-emerald': '深翠绿 (Deep Emerald)',
          'theme-gold': '暗金 (Imperial Gold)',
          'theme-crimson': '勃艮第红 (Ruby Crimson)'
        };
        showToast(`已切换主题: ${names[nextTheme] || nextTheme}`);
      }
    },

    // ========================================================================
    // 2b. Web Audio 微秒级合成原生导航音效 (Sonic Feedback)
    // ========================================================================
    playSonic(type) {
      if (window.AUDIO && window.AUDIO.enabled === false) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!this.audioCtx && AudioCtx) {
          this.audioCtx = (window.AUDIO && window.AUDIO.ctx) ? window.AUDIO.ctx : new AudioCtx();
        }
        const ctx = this.audioCtx;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime;
        if (type === 'press') {
          // 微软经典轻质导航按压声 (Down)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(500, t);
          osc.frequency.exponentialRampToValueAtTime(170, t + 0.032);
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.linearRampToValueAtTime(0.001, t + 0.032);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.032);
        } else if (type === 'release') {
          // 微软经典轻质回弹声 (Up)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(280, t);
          osc.frequency.exponentialRampToValueAtTime(640, t + 0.024);
          gain.gain.setValueAtTime(0.05, t);
          gain.gain.linearRampToValueAtTime(0.001, t + 0.024);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.024);
        }
      } catch (e) {}
    },

    // ========================================================================
    // 3. 3D Perspective Tilt 触控/光标倾斜真实物理反馈与 Reveal Highlight 光圈
    // ========================================================================
    initTiltPhysics() {
      // Reveal Highlight: 鼠标/笔指针悬停移动时投射冷白高光位置
      document.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
          const card = e.target.closest('.game-card, .metro-tile');
          if (card) {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
          }
        }
      }, { passive: true });

      // 统一 Pointer Events 架构 (完美适配鼠标、触摸屏及 Surface 二合一设备)
      document.addEventListener('pointerdown', (e) => {
        const card = e.target.closest('.game-card, .metro-tile');
        if (!card) return;

        card.classList.add('tile-pressed');
        this.playSonic('press');
        this.applyTilt(card, e);

        const onMove = (moveEvt) => {
          this.applyTilt(card, moveEvt);
        };

        const onRelease = () => {
          card.classList.remove('tile-pressed');
          card.style.transform = '';
          this.playSonic('release');
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onRelease);
          document.removeEventListener('pointercancel', onRelease);
        };

        document.addEventListener('pointermove', onMove, { passive: true });
        document.addEventListener('pointerup', onRelease, { once: true });
        document.addEventListener('pointercancel', onRelease, { once: true });
      }, { passive: true });
    },

    applyTilt(card, e) {
      if (!card || e.clientX === undefined || e.clientY === undefined) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);

      const midX = rect.width / 2;
      const midY = rect.height / 2;

      // 归一化偏差 [-1, 1]
      const dx = Math.max(-1, Math.min(1, (x - midX) / midX));
      const dy = Math.max(-1, Math.min(1, (y - midY) / midY));

      const maxRotate = 7; // 最大倾斜角度 7 度
      const rotX = -dy * maxRotate;
      const rotY = dx * maxRotate;

      card.style.transform = `perspective(600px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(0.97)`;
    },


    // ========================================================================
    // 4. 横向滚轮与全景平滑平移 (Surface Pro & PC Mouse Wheel Horizontal Scroll)
    // ========================================================================
    initHorizontalWheel() {
      const panorama = document.getElementById('metro-panorama');
      if (!panorama) return;

      panorama.addEventListener('wheel', (e) => {
        // 当垂直滚动大于横向滚动且全景横向有溢出时，拦截并转为横向平移
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && panorama.scrollWidth > panorama.clientWidth) {
          e.preventDefault();
          panorama.scrollLeft += e.deltaY * 0.9;
        }
      }, { passive: false });
    },

    // ========================================================================
    // 4b. Windows 8 经典视差流动纹理平移引擎 (Parallax Panoramic Wallpaper)
    // ========================================================================
    initParallax() {
      const panorama = document.getElementById('metro-panorama');
      const bg = document.getElementById('win8-flourish-bg');
      if (!panorama || !bg) return;

      let ticking = false;
      const updateParallax = () => {
        const scrollLeft = panorama.scrollLeft;
        // 0.28x 视差速率缓缓平移，营造深邃立体纵深空间感
        bg.style.transform = `translate3d(${-scrollLeft * 0.28}px, 0, 0)`;
        ticking = false;
      };

      panorama.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(updateParallax);
          ticking = true;
        }
      }, { passive: true });

      updateParallax();
    },

    // ========================================================================
    // 5. 动态磁贴 (Live Tiles) 周期性翻转与 Push/Slide 推拉调度系统
    // ========================================================================
    initIntersectionObserver() {
      if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.game-card').forEach(c => this.visibleCards.add(c));
        return;
      }
      this.observer = new IntersectionObserver((entries) => {

        entries.forEach(entry => {
          const card = entry.target;
          if (entry.isIntersecting) {
            this.visibleCards.add(card);
          } else {
            this.visibleCards.delete(card);
            card.classList.remove('is-flipped');
            card.classList.remove('is-pushed');
          }
        });
      }, { threshold: 0.25 });

      document.querySelectorAll('.game-card').forEach(card => {
        this.observer.observe(card);
      });
    },

    startTicker() {
      if (this.flipIntervalId) return;
      this.flipIntervalId = setInterval(() => {
        if (!this.active || this.isRandomPicking || this.visibleCards.size === 0) return;

        const cardsArray = Array.from(this.visibleCards).filter(c => !c.classList.contains('tile-pressed') && !c.classList.contains('tile-dimmed'));
        if (cardsArray.length === 0) return;

        // 随机挑选 1 款磁贴展示资讯 (3D Flip 或 Slide/Push 推拉)
        const pick = cardsArray[Math.floor(Math.random() * cardsArray.length)];
        const isPush = pick.classList.contains('anim-push');

        if (isPush) {
          pick.classList.add('is-pushed');
          setTimeout(() => {
            if (pick) pick.classList.remove('is-pushed');
          }, 4200);
        } else {
          pick.classList.add('is-flipped');
          setTimeout(() => {
            if (pick) pick.classList.remove('is-flipped');
          }, 4200);
        }
      }, 6200);
    },

    stopTicker() {
      if (this.flipIntervalId) {
        clearInterval(this.flipIntervalId);
        this.flipIntervalId = null;
      }
    },

    // ========================================================================
    // 6. Windows 8 经典 Charm Bar 侧滑搜索与实时筛选
    // ========================================================================
    initCharmDrawer() {
      const input = document.getElementById('game-search-input');
      if (input) {
        input.addEventListener('input', (e) => {
          this.activeQuery = (e.target.value || '').trim();
          this.filterTiles(this.activeQuery, this.activePlayerFilter, this.activeCatFilter);
          const clearBtn = document.getElementById('search-clear-btn');
          if (clearBtn) clearBtn.style.display = this.activeQuery ? 'block' : 'none';
        });
      }
    },

    openCharm() {
      const drawer = document.getElementById('win8-charm-drawer');
      const backdrop = document.getElementById('charm-backdrop');
      if (drawer) drawer.classList.add('open');
      if (backdrop) backdrop.classList.add('open');

      const input = document.getElementById('game-search-input');
      if (input) {
        setTimeout(() => { try { input.focus(); input.select(); } catch(e) {} }, 100);
      }
      if (window.AUDIO) try { window.AUDIO.play('click'); } catch(e) {}
    },

    closeCharm() {
      const drawer = document.getElementById('win8-charm-drawer');
      const backdrop = document.getElementById('charm-backdrop');
      if (drawer) drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
    },

    toggleCharm() {
      const drawer = document.getElementById('win8-charm-drawer');
      if (drawer && drawer.classList.contains('open')) {
        this.closeCharm();
      } else {
        this.openCharm();
      }
    },

    filterTiles(query, playerFilter, catFilter) {
      if (query !== undefined) this.activeQuery = (query || '').toLowerCase().trim();
      if (playerFilter !== undefined) this.activePlayerFilter = playerFilter;
      if (catFilter !== undefined) this.activeCatFilter = catFilter;

      const q = this.activeQuery;
      const p = this.activePlayerFilter;
      const c = this.activeCatFilter;

      const cards = document.querySelectorAll('.game-card');
      let matchCount = 0;

      cards.forEach(card => {
        const pVal = card.dataset.players || '';
        const cVal = card.dataset.cat || '';
        const kw = ((card.dataset.keywords || '') + ' ' + card.textContent).toLowerCase();

        let pMatch = (p === 'ALL') || (p === 'ONLINE' ? card.dataset.online === 'true' : pVal === p);
        let cMatch = (c === 'ALL') || (cVal === c);
        let sMatch = !q || kw.includes(q);

        if (pMatch && cMatch && sMatch) {
          card.classList.remove('tile-dimmed');
          matchCount++;
        } else {
          card.classList.add('tile-dimmed');
        }
      });

      // 同步更新组的可见性 (如果某组磁贴全被 dimmed，则稍微淡化)
      document.querySelectorAll('.metro-group').forEach(grp => {
        const hasVisible = grp.querySelector('.game-card:not(.tile-dimmed)');
        grp.style.opacity = hasVisible ? '1' : '0.25';
      });

      const noResults = document.getElementById('no-results-state');
      if (noResults) {
        noResults.style.display = matchCount === 0 ? 'flex' : 'none';
      }

      return matchCount;
    },

    // ========================================================================
    // 7. 天命随机闪烁动画 (Random Game Shimmer Selector)
    // ========================================================================
    randomPickGame() {
      if (this.isRandomPicking) return;
      this.isRandomPicking = true;

      const cards = Array.from(document.querySelectorAll('.game-card:not(.tile-dimmed)'));
      if (cards.length === 0) {
        this.isRandomPicking = false;
        return;
      }

      if (window.AUDIO) try { window.AUDIO.play('card_draw'); } catch(e) {}

      let steps = 18;
      let delay = 45;
      let currentIndex = -1;

      const step = () => {
        if (currentIndex >= 0 && cards[currentIndex]) {
          cards[currentIndex].classList.remove('tile-shimmer-picked');
        }

        currentIndex = Math.floor(Math.random() * cards.length);
        const currentCard = cards[currentIndex];
        if (currentCard) {
          currentCard.classList.add('tile-shimmer-picked');
          try {
            currentCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' });
          } catch(e) {}
        }

        if (window.AUDIO) try { window.AUDIO.play('click'); } catch(e) {}

        steps--;
        if (steps > 0) {
          delay += 12;
          setTimeout(step, delay);
        } else {
          // 锁定目标
          this.isRandomPicking = false;
          if (currentCard) {
            const key = currentCard.dataset.gameKey;
            const title = currentCard.querySelector('.tile-title-text')?.textContent || key;
            if (typeof showToast === 'function') {
              showToast(`🎯 天命已定：${title}！点击直接开战`);
            }
            if (window.AUDIO) try { window.AUDIO.play('tron_boost'); } catch(e) {}
            setTimeout(() => {
              if (currentCard) currentCard.classList.remove('tile-shimmer-picked');
            }, 3000);
          }
        }
      };

      step();
    },

    // ========================================================================
    // 8. 语义缩放全景概览 (Semantic Zoom)
    // ========================================================================
    initSemanticZoom() {},

    toggleSemanticZoom(open) {
      const zoom = document.getElementById('metro-semantic-zoom');
      if (!zoom) return;
      const isOpen = (open === undefined) ? !zoom.classList.contains('open') : open;
      zoom.classList.toggle('open', isOpen);
      if (window.AUDIO) try { window.AUDIO.play('click'); } catch(e) {}
    },

    jumpToCategoryGroup(groupKey) {
      this.toggleSemanticZoom(false);
      const grp = document.querySelector(`.metro-group[data-group="${groupKey}"]`);
      if (grp) {
        grp.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'start' });
      }
    },

    // ========================================================================
    // 9. 状态机激活与休眠
    // ========================================================================
    activate() {
      this.active = true;
      document.body.classList.add('metro-active');
      this.startTicker();
    },

    deactivate() {
      this.active = false;
      document.body.classList.remove('metro-active');
      this.stopTicker();
    }
  };

  window.MetroEngine = MetroEngine;

  // 挂载顶层全局别名函数
  window.toggleSemanticZoom = (open) => MetroEngine.toggleSemanticZoom(open);
  window.jumpToCategoryGroup = (grp) => MetroEngine.jumpToCategoryGroup(grp);
  window.pickRandomGame = () => MetroEngine.randomPickGame();
  window.cycleWin8Theme = () => MetroEngine.cycleNextTheme();
  window.toggleCharmSearch = () => MetroEngine.toggleCharm();
  window.closeCharmSearch = () => MetroEngine.closeCharm();

})(window);
