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

  const THEMES = ['theme-teal', 'theme-indigo', 'theme-slate', 'theme-emerald', 'theme-crimson'];

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
    },

    cycleNextTheme() {
      this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
      const nextTheme = THEMES[this.currentThemeIndex];
      this.applyTheme(nextTheme);
      if (window.AUDIO) try { window.AUDIO.play('click'); } catch(e) {}
      if (typeof showToast === 'function') {
        const names = {
          'theme-teal': 'Win8 官方青绿壁纸',
          'theme-indigo': 'Win8.1 经典深紫壁纸',
          'theme-slate': 'Carbon 暗黑灰黑壁纸',
          'theme-emerald': 'Xbox 森林墨绿壁纸',
          'theme-crimson': 'Ruby 勃艮第绯红壁纸'
        };
        showToast(`已切换主题: ${names[nextTheme] || nextTheme}`);
      }
    },

    // ========================================================================
    // 3. 3D Perspective Tilt 触控/光标倾斜真实物理反馈 (Win8 / WP8 核心质感)
    // ========================================================================
    initTiltPhysics() {
      const isTouch = 'ontouchstart' in window;
      const startEvt = isTouch ? 'touchstart' : 'pointerdown';
      const moveEvt  = isTouch ? 'touchmove'  : 'pointermove';
      const endEvt   = isTouch ? 'touchend'   : 'pointerup';
      const cancelEvt= isTouch ? 'touchcancel': 'pointercancel';

      document.addEventListener(startEvt, (e) => {
        const card = e.target.closest('.game-card');
        if (!card) return;

        card.classList.add('tile-pressed');
        this.applyTilt(card, e);

        const onMove = (moveEvtObj) => {
          this.applyTilt(card, moveEvtObj);
        };

        const onRelease = () => {
          card.classList.remove('tile-pressed');
          card.style.transform = '';
          document.removeEventListener(moveEvt, onMove);
          document.removeEventListener(endEvt, onRelease);
          document.removeEventListener(cancelEvt, onRelease);
          if (!isTouch) document.removeEventListener('pointerleave', onRelease);
        };

        document.addEventListener(moveEvt, onMove, { passive: true });
        document.addEventListener(endEvt, onRelease, { once: true });
        document.addEventListener(cancelEvt, onRelease, { once: true });
        if (!isTouch) document.removeEventListener('pointerleave', onRelease);
      }, { passive: true });
    },

    applyTilt(card, e) {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      if (!clientX || !clientY) return;

      const x = clientX - rect.left;
      const y = clientY - rect.top;

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
    // 5. 动态磁贴 (Live Tiles) 周期性翻转调度系统
    // ========================================================================
    initIntersectionObserver() {
      if (!('IntersectionObserver' in window)) return;
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const card = entry.target;
          if (entry.isIntersecting) {
            this.visibleCards.add(card);
          } else {
            this.visibleCards.delete(card);
            card.classList.remove('is-flipped');
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

        // 随机挑选 1 款磁贴翻转展示资讯
        const pick = cardsArray[Math.floor(Math.random() * cardsArray.length)];
        pick.classList.add('is-flipped');

        setTimeout(() => {
          if (pick) pick.classList.remove('is-flipped');
        }, 4200);
      }, 7000);
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
