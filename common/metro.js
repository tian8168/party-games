/**
 * 🪟 Windows Modern UI / Live Tiles 调度引擎 (Metro Engine)
 * 包含：3D Pointer Tilt 倾斜物理反馈、呼吸式随机翻转调度器、Surface 滚轮横向平移与语义缩放 (Semantic Zoom)
 */

(function(window) {
  'use strict';

  const MetroEngine = {
    initialized: false,
    active: false,
    visibleCards: new Set(),
    flipIntervalId: null,
    observer: null,

    // ========================================================================
    // 1. 初始化入口
    // ========================================================================
    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.initTiltPhysics();
      this.initIntersectionObserver();
      this.initHorizontalWheel();
      this.initSemanticZoom();
      this.injectTelemetryData();

      // 页面可见性感知：切后台休眠，回前台唤醒
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopTicker();
        } else if (this.active) {
          this.startTicker();
        }
      });

      console.log('[MetroEngine] Windows Live Tiles 引擎已就绪');
    },

    // ========================================================================
    // 2. 模式激活与休眠控制
    // ========================================================================
    activate() {
      this.active = true;
      document.body.classList.add('metro-active');
      const grid = document.getElementById('lobby-game-grid');
      if (grid) {
        grid.classList.add('metro-mode');
        grid.classList.remove('compact-mode');
      }
      this.startTicker();
      this.injectTelemetryData();
    },

    deactivate() {
      this.active = false;
      document.body.classList.remove('metro-active');
      const grid = document.getElementById('lobby-game-grid');
      if (grid) {
        grid.classList.remove('metro-mode');
      }
      this.stopTicker();
      // 重置所有磁贴翻转状态
      document.querySelectorAll('.game-card.is-flipped').forEach(card => {
        card.classList.remove('is-flipped');
      });
    },

    // ========================================================================
    // 3. 3D Pointer Tilt 触控倾斜物理反馈 (Windows Phone / Win8 核心质感)
    // ========================================================================
    initTiltPhysics() {
      const isTouch = 'ontouchstart' in window;
      const startEvt = isTouch ? 'touchstart' : 'pointerdown';
      const moveEvt  = isTouch ? 'touchmove'  : 'pointermove';
      const endEvt   = isTouch ? 'touchend'   : 'pointerup';
      const cancelEvt= isTouch ? 'touchcancel': 'pointercancel';

      document.addEventListener(startEvt, (e) => {
        if (!this.active) return;
        const card = e.target.closest('.game-card');
        if (!card) return;

        card.classList.add('is-tilting');
        this.applyTilt(card, e);

        const onMove = (moveEvent) => {
          this.applyTilt(card, moveEvent);
        };

        const onRelease = () => {
          card.classList.remove('is-tilting');
          card.style.transform = '';
          document.removeEventListener(moveEvt, onMove);
          document.removeEventListener(endEvt, onRelease);
          document.removeEventListener(cancelEvt, onRelease);
          if (!isTouch) document.removeEventListener('pointerleave', onRelease);
        };

        document.addEventListener(moveEvt, onMove);
        document.addEventListener(endEvt, onRelease);
        document.addEventListener(cancelEvt, onRelease);
        if (!isTouch) document.addEventListener('pointerleave', onRelease);
      }, { passive: true });
    },

    applyTilt(card, event) {
      const rect = card.getBoundingClientRect();
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;

      if (!clientX || !clientY) return;

      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const midX = rect.width / 2;
      const midY = rect.height / 2;

      // 最大倾斜角 7.5 度
      const maxAngle = 7.5;
      const rotY = Math.max(-maxAngle, Math.min(maxAngle, ((x - midX) / midX) * maxAngle));
      const rotX = Math.max(-maxAngle, Math.min(maxAngle, -((y - midY) / midY) * maxAngle));

      card.style.transform = `perspective(700px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(0.97, 0.97, 0.97)`;
    },

    // ========================================================================
    // 4. 视口裁剪与呼吸式随机翻转调度机 (Live Tile Ticker)
    // ========================================================================
    initIntersectionObserver() {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const card = entry.target;
          if (entry.isIntersecting) {
            this.visibleCards.add(card);
          } else {
            this.visibleCards.delete(card);
            // 滑出视口时平滑归位
            if (card.classList.contains('is-flipped')) {
              card.classList.remove('is-flipped');
            }
          }
        });
      }, {
        threshold: 0.25
      });

      document.querySelectorAll('.game-card').forEach(card => {
        this.observer.observe(card);
      });
    },

    startTicker() {
      this.stopTicker();
      // 每隔 4.5 秒从可见池中随机抽取 1 个磁贴触发 3D 翻转
      this.flipIntervalId = setInterval(() => {
        if (!this.active || this.visibleCards.size === 0) return;
        const cardsArray = Array.from(this.visibleCards);
        const randomCard = cardsArray[Math.floor(Math.random() * cardsArray.length)];
        if (!randomCard) return;

        randomCard.classList.toggle('is-flipped');

        // 如果是翻到背面，6 秒后自动归位正面
        if (randomCard.classList.contains('is-flipped')) {
          setTimeout(() => {
            if (randomCard.classList.contains('is-flipped')) {
              randomCard.classList.remove('is-flipped');
            }
          }, 6000);
        }
      }, 4500);
    },

    stopTicker() {
      if (this.flipIntervalId) {
        clearInterval(this.flipIntervalId);
        this.flipIntervalId = null;
      }
    },

    // ========================================================================
    // 5. Surface 平板与桌面端：滚轮水平驱动 (Wheel-to-Horizontal)
    // ========================================================================
    initHorizontalWheel() {
      const grid = document.getElementById('lobby-game-grid');
      if (!grid) return;

      grid.addEventListener('wheel', (e) => {
        if (!this.active) return;
        // 仅在横屏全景模式下生效 (屏幕宽于 900px 或处于 landscape)
        if (window.innerWidth <= 768 && window.matchMedia('(orientation: portrait)').matches) {
          return;
        }

        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          grid.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }, { passive: false });
    },

    // ========================================================================
    // 6. 语义缩放全景视图 (Semantic Zoom - Win8 标志性交互)
    // ========================================================================
    initSemanticZoom() {
      // 监听全局捏合缩放或点击缩放按钮
      window.toggleSemanticZoom = (forceState) => {
        const overlay = document.getElementById('metro-semantic-zoom');
        if (!overlay) return;
        const willActive = typeof forceState === 'boolean' ? forceState : !overlay.classList.contains('active');
        if (willActive) {
          overlay.classList.add('active');
        } else {
          overlay.classList.remove('active');
        }
      };

      window.jumpToCategoryGroup = (groupKey) => {
        window.toggleSemanticZoom(false);
        const targetGroup = document.querySelector(`.metro-group[data-group="${groupKey}"]`);
        const grid = document.getElementById('lobby-game-grid');
        if (targetGroup && grid) {
          if (grid.style.flexDirection === 'row' || window.innerWidth > 768) {
            targetGroup.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
          } else {
            targetGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      };
    },

    // ========================================================================
    // 7. 动态战绩数据下发与注入 (Live Telemetry)
    // ========================================================================
    injectTelemetryData() {
      let recentGames = [];
      try {
        recentGames = JSON.parse(localStorage.getItem('arcade_recent_games') || '[]');
      } catch(e) {}

      document.querySelectorAll('.game-card').forEach(card => {
        const gameKey = card.dataset.gameKey;
        if (!gameKey) return;

        const isRecent = recentGames.includes(gameKey);
        const recentIndex = recentGames.indexOf(gameKey);

        const statusEl = card.querySelector('.tile-back-status');
        if (statusEl) {
          if (recentIndex === 0) {
            statusEl.textContent = '最近游玩';
            statusEl.style.color = '#38bdf8';
          } else if (isRecent) {
            statusEl.textContent = '已体验';
            statusEl.style.color = '#4ade80';
          } else {
            statusEl.textContent = '未开始';
            statusEl.style.color = '#94a3b8';
          }
        }

        const statVal = card.querySelector('.tile-stat-val-plays');
        if (statVal) {
          statVal.textContent = isRecent ? `${Math.floor(Math.random() * 5) + 3} 局` : '0 局';
        }
      });
    }
  };

  window.MetroEngine = MetroEngine;

})(window);
