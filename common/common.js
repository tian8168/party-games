/**
 * 🛠️ 聚会游戏大厅 · 公共工具脚本 (Common Utilities)
 * 包含 Canvas Polyfill、Toast 消息、规则模态框、通用顶栏初始化
 */

// Canvas roundRect 跨端安全兼容垫片
(function() {
  function polyfill(proto) {
    if (!proto || proto.roundRect) return;
    proto.roundRect = function(x, y, w, h, radii) {
      let r = Array.isArray(radii) ? radii[0] : (radii || 0);
      r = Math.min(r, w / 2, h / 2);
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }
  if (typeof CanvasRenderingContext2D !== 'undefined') polyfill(CanvasRenderingContext2D.prototype);
  if (typeof HTMLCanvasElement !== 'undefined') {
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const ctx = origGetContext.apply(this, [type, ...args]);
      if (ctx && !ctx.roundRect) polyfill(ctx);
      return ctx;
    };
  }
})();

// Toast 浮窗提示
let toastTimer = null;
function showToast(text, duration = 3000) {
  let toast = document.getElementById('toast-msg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-msg';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ==========================================================================
// 🎊 纯原生轻量 Canvas 彩带纸屑特效 (Native Lightweight Confetti)
// ==========================================================================
let confettiRafId = null;
let confettiCanvas = null;
let confettiCtx = null;
let confettiParticles = [];

const CONFETTI_COLORS = [
  '#f59e0b', '#ef4444', '#10b981', '#38bdf8', '#8b5cf6',
  '#ec4899', '#fbbf24', '#34d399', '#60a5fa', '#f43f5e'
];

function createConfettiParticle(width, height, isInitial = false) {
  const size = Math.random() * 8 + 6;
  return {
    x: Math.random() * width,
    y: isInitial ? (Math.random() * height * 0.7 - height * 0.2) : (-20 - Math.random() * 40),
    w: size,
    h: size * (Math.random() > 0.4 ? 1.4 : 0.8),
    vx: (Math.random() - 0.5) * 4.0,
    vy: Math.random() * 2.8 + 2.0,
    gravity: 0.08,
    drag: 0.99,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 5,
    flip: Math.random() * 360,
    flipSpeed: Math.random() * 0.08 + 0.04,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: Math.random() * 0.05 + 0.03,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    opacity: 1,
    fadeSpeed: Math.random() * 0.003 + 0.002,
    shape: Math.random() > 0.25 ? 'rect' : 'circle'
  };
}

function updateConfetti() {
  if (!confettiCanvas || !confettiCtx) return;
  const w = window.innerWidth;
  const h = window.innerHeight;

  confettiCtx.clearRect(0, 0, w, h);

  for (let i = 0; i < confettiParticles.length; i++) {
    const p = confettiParticles[i];

    p.x += p.vx + Math.sin(p.wobble) * 1.5;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= p.drag;
    p.rotation += p.rotationSpeed;
    p.flip += p.flipSpeed;
    p.wobble += p.wobbleSpeed;

    // 自适应重力飘落与自然渐隐 (随下落高度平滑淡化透明度)
    if (p.y > h * 0.6) {
      p.opacity -= (p.y - h * 0.6) / (h * 0.4) * 0.035;
    }
    p.opacity = Math.max(0, p.opacity - p.fadeSpeed);

    const flipScale = Math.cos(p.flip);

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotation * Math.PI) / 180);
    confettiCtx.scale(1, flipScale);
    confettiCtx.fillStyle = p.color;
    confettiCtx.globalAlpha = Math.max(0, Math.min(1, p.opacity));

    if (p.shape === 'circle') {
      confettiCtx.beginPath();
      confettiCtx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      confettiCtx.fill();
    } else {
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    confettiCtx.restore();

    // 粒子超出底部或完全淡化后重置回顶部，保持欢快优美的胜利礼花
    if (p.y > h + 30 || p.opacity <= 0.02) {
      confettiParticles[i] = createConfettiParticle(w, h, false);
    }
  }

  confettiRafId = requestAnimationFrame(updateConfetti);
}

function resizeConfettiCanvas() {
  if (!confettiCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  confettiCanvas.width = window.innerWidth * dpr;
  confettiCanvas.height = window.innerHeight * dpr;
  if (confettiCtx) confettiCtx.scale(dpr, dpr);
}

function startConfetti() {
  stopConfetti();

  confettiCanvas = document.getElementById('confetti-canvas');
  if (!confettiCanvas) {
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'confetti-canvas';
    confettiCanvas.style.position = 'fixed';
    confettiCanvas.style.inset = '0';
    confettiCanvas.style.width = '100vw';
    confettiCanvas.style.height = '100vh';
    confettiCanvas.style.pointerEvents = 'none';
    confettiCanvas.style.zIndex = '10001';
    document.body.appendChild(confettiCanvas);
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  confettiCanvas.width = window.innerWidth * dpr;
  confettiCanvas.height = window.innerHeight * dpr;
  confettiCanvas.style.display = 'block';

  confettiCtx = confettiCanvas.getContext('2d');
  if (confettiCtx) confettiCtx.scale(dpr, dpr);

  const particleCount = 85;
  confettiParticles = [];
  for (let i = 0; i < particleCount; i++) {
    confettiParticles.push(createConfettiParticle(window.innerWidth, window.innerHeight, true));
  }

  window.addEventListener('resize', resizeConfettiCanvas);
  confettiRafId = requestAnimationFrame(updateConfetti);
}

function stopConfetti() {
  if (confettiRafId) {
    cancelAnimationFrame(confettiRafId);
    confettiRafId = null;
  }
  window.removeEventListener('resize', resizeConfettiCanvas);
  if (confettiCanvas) {
    if (confettiCanvas.parentNode) {
      confettiCanvas.parentNode.removeChild(confettiCanvas);
    }
    confettiCanvas = null;
    confettiCtx = null;
  }
  confettiParticles = [];
}

// ==========================================================================
// 📳 移动端 Web 触觉反馈引擎 (Web Haptic Feedback Engine)
// ==========================================================================
const HAPTIC_PATTERNS = {
  light: 15,
  medium: 30,
  heavy: 70,
  success: [30, 40, 50],
  warning: [40, 40, 40]
};

const HAPTIC_PRIORITIES = {
  light: 1,
  medium: 2,
  warning: 3,
  heavy: 4,
  success: 5
};

let _lastHapticTime = 0;
let _lastHapticEndTime = 0;
let _lastHapticPriority = 0;

function triggerHaptic(type = 'light') {
  try {
    if (typeof navigator === 'undefined' || !navigator || typeof navigator.vibrate !== 'function') {
      return false;
    }
    let pattern;
    let priority = 1;
    let duration = 15;

    if (Array.isArray(type)) {
      pattern = type;
      duration = type.reduce((sum, v) => sum + (Number(v) || 0), 0);
      priority = duration >= 100 ? 4 : (duration >= 30 ? 2 : 1);
    } else if (typeof type === 'number') {
      pattern = type;
      duration = type;
      priority = duration >= 60 ? 4 : (duration >= 25 ? 2 : 1);
    } else if (typeof type === 'string' && HAPTIC_PATTERNS[type]) {
      pattern = HAPTIC_PATTERNS[type];
      priority = HAPTIC_PRIORITIES[type] || 1;
      duration = Array.isArray(pattern) ? pattern.reduce((s, v) => s + v, 0) : pattern;
    } else {
      pattern = HAPTIC_PATTERNS.light;
      priority = 1;
      duration = 15;
    }

    if (pattern === 0 || (Array.isArray(pattern) && pattern.length === 0)) {
      _lastHapticEndTime = 0;
      _lastHapticPriority = 0;
      return Boolean(navigator.vibrate(pattern));
    }

    const now = Date.now();
    // 保护正在执行的高优先级长震动（如 victory [30,40,50] 或 heavy 70ms），防止微秒级 light 点击误中断
    if (now < _lastHapticEndTime && priority < _lastHapticPriority) {
      return true;
    }

    // 抑制 25ms 内同级别极弱连击抖动
    if (priority === 1 && (now - _lastHapticTime < 25)) {
      return true;
    }

    _lastHapticTime = now;
    _lastHapticEndTime = now + duration;
    _lastHapticPriority = priority;

    return Boolean(navigator.vibrate(pattern));
  } catch (err) {
    return false;
  }
}

// ==========================================================================
// 规则与通用弹窗系统 (Universal Modal System)
// ==========================================================================
function handleModalRestart() {
  triggerHaptic('medium');
  closeModal(true);
  if (typeof window.currentRestartFn === 'function') {
    window.currentRestartFn();
  } else if (typeof window.resetCurrentGame === 'function') {
    window.resetCurrentGame();
  } else if (typeof resetCurrentGame === 'function') {
    resetCurrentGame();
  } else if (typeof window.restartCurrentRom === 'function') {
    window.restartCurrentRom();
  } else if (typeof restartCurrentRom === 'function') {
    restartCurrentRom();
  } else if (typeof window.resetGame === 'function') {
    window.resetGame();
  } else if (typeof resetGame === 'function') {
    resetGame();
  } else {
    window.location.reload();
  }
}

function handleModalReturnLobby() {
  triggerHaptic('light');
  closeModal(true);
  const path = window.location.pathname.split('\\').join('/');
  const gamesIdx = path.lastIndexOf('/games/');
  if (gamesIdx !== -1) {
    const sub = path.substring(gamesIdx + '/games/'.length);
    const depth = sub.split('/').length - 1;
    window.location.href = '../'.repeat(depth + 1) + 'index.html';
  } else {
    window.location.href = './index.html';
  }
}

function showModal(title, bodyHtml, options = {}) {
  let modal = document.getElementById('rules-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rules-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box" id="modal-box">
        <div class="modal-header">
          <span id="modal-title">游戏规则</span>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body" id="modal-body"></div>
        <div class="modal-footer" id="modal-footer"></div>
      </div>
    `;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.body.appendChild(modal);
  }

  const modalBox = document.getElementById('modal-box') || modal.querySelector('.modal-box');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');

  if (titleEl) titleEl.textContent = title || '';
  if (bodyEl) bodyEl.innerHTML = bodyHtml || '';

  const titleUpper = (title || '').toUpperCase();
  const bodyUpper = (typeof bodyHtml === 'string' ? bodyHtml : '').toUpperCase();
  const fullText = titleUpper + ' ' + bodyUpper;

  // 1. 判断是否为纯规则帮助或联机房间交互 (非终局结算)
  const isPureRuleHelp = ['规则', '指南', '说明', 'HELP', 'RULES', '玩法', '房间号', '加入房间', '创建房间', '就绪'].some(k => titleUpper.includes(k)) &&
                         !['获胜', '胜利', '胜出', '冠军', '大捷', '战报', '决胜', '结算'].some(k => titleUpper.includes(k));

  let isGameOver = false;
  if (typeof options.isGameOver === 'boolean') {
    isGameOver = options.isGameOver;
  } else if (!isPureRuleHelp) {
    const gameOverKeywords = [
      '获胜', '胜利', '胜出', '结束', '结算', '战报', '落幕', '终局', '终结',
      '冠军', '大捷', 'GAME OVER', '平局', '势均力敌', '阵亡', '绝杀', '胜负',
      '失败', '战败', '出局', '被击败', 'LOSE', 'YOU LOSE', '惜败',
      '对局结束', 'MATCH OVER', 'REPORT', 'DEFEAT', 'VICTORY', 'WINNER', '挑战结束'
    ];
    isGameOver = gameOverKeywords.some(k => titleUpper.includes(k)) ||
                 (titleUpper.includes('战') && fullText.includes('胜'));
  }

  // 2. 智能分类胜负视觉类型: 'victory', 'draw', 'defeat', 'info'
  let outcomeType = 'info';

  if (options.type) {
    outcomeType = options.type;
  } else if (isGameOver) {
    const drawKeywords = ['平局', '势均力敌', '握手言和', 'DRAW', 'TIE', '和棋', '和局'];
    const defeatKeywords = [
      '💀', '失败', '战败', '阵亡', '出局', '被击败', 'GAME OVER', 'DEFEAT', 'YOU LOSE',
      '惜败', '遗憾', '跌落深渊', '装甲破损', '生命值归零', '全军覆没', '对手获胜', '敌方获胜', '电脑获胜'
    ];
    const victoryKeywords = [
      '🏆', '👑', '🎉', '获胜', '胜利', '胜出', '冠军', '大捷', 'VICTORY', 'WINNER',
      '绝杀', '夺得', '问鼎', '斩获', '赢得', '凯旋'
    ];

    if (drawKeywords.some(k => fullText.includes(k))) {
      outcomeType = 'draw';
    } else if (defeatKeywords.some(k => fullText.includes(k)) &&
               !victoryKeywords.some(k => titleUpper.includes(k) && !titleUpper.includes('💀'))) {
      outcomeType = 'defeat';
    } else {
      outcomeType = 'victory';
    }
  }

  // 3. 应用弹窗主题微光样式 (智能识别胜负微光)
  if (modalBox) {
    modalBox.classList.remove('modal-type-victory', 'modal-type-draw', 'modal-type-defeat');
    if (outcomeType === 'victory') {
      modalBox.classList.add('modal-type-victory');
    } else if (outcomeType === 'draw') {
      modalBox.classList.add('modal-type-draw');
    } else if (outcomeType === 'defeat') {
      modalBox.classList.add('modal-type-defeat');
    }
  }

  // 4. 操作按钮规范化渲染
  if (footerEl) {
    if (isGameOver) {
      footerEl.innerHTML = `
        <button class="modal-btn-restart" onclick="handleModalRestart()">🔄 再来一局</button>
        <button class="modal-btn-confirm" onclick="handleModalReturnLobby()">🏠 确定 (返回大厅)</button>
      `;
    } else {
      footerEl.innerHTML = `
        <button class="modal-btn-confirm" onclick="closeModal()">我知道了</button>
      `;
    }
  }

  // 5. 胜利彩带特效启动 / 非胜利停止 与 触觉反馈联动
  if (outcomeType === 'victory') {
    startConfetti();
    triggerHaptic('success');
  } else if (outcomeType === 'defeat') {
    stopConfetti();
    triggerHaptic('warning');
  } else if (outcomeType === 'draw') {
    stopConfetti();
    triggerHaptic('medium');
  } else {
    stopConfetti();
    triggerHaptic('light');
  }

  modal.classList.add('open');
}

function closeModal(skipHaptic = false) {
  if (!skipHaptic) {
    triggerHaptic('light');
  }
  const modal = document.getElementById('rules-modal');
  if (modal) modal.classList.remove('open');
  stopConfetti();
}

// ESC 按键便捷关闭弹窗
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// 通用顶栏与按键初始化
function initCommonHeader(rulesTitle, rulesHtml, onRestart) {
  window.currentRestartFn = onRestart;
  // 音效按钮
  const soundBtn = document.getElementById('btn-sound-toggle');
  if (soundBtn) {
    soundBtn._commonBound = true;
    soundBtn.title = '切换音效开关';
    const updateSoundIcon = () => {
      soundBtn.textContent = (window.AUDIO && window.AUDIO.enabled) ? '🔊' : '🔇';
    };
    updateSoundIcon();
    soundBtn.onclick = () => {
      triggerHaptic('light');
      if (window.AUDIO) {
        window.AUDIO.toggle();
        updateSoundIcon();
        showToast(window.AUDIO.enabled ? '音效已开启' : '音效已静音');
      }
    };
  }

  // 规则按钮
  const rulesBtn = document.getElementById('btn-rules-header');
  if (rulesBtn) {
    rulesBtn._commonBound = true;
    rulesBtn.title = '查看游戏规则与按键说明';
    rulesBtn.onclick = () => {
      triggerHaptic('light');
      if (window.AUDIO) window.AUDIO.play('click');
      showModal(rulesTitle, rulesHtml);
    };
  }

  // 重置按钮
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) {
    restartBtn._commonBound = true;
    restartBtn.title = '重新开始游戏';
    if (typeof onRestart === 'function') {
      restartBtn.onclick = () => {
        triggerHaptic('medium');
        if (window.AUDIO) window.AUDIO.play('click');
        closeModal(true);
        onRestart();
      };
    }
  }
}

// 自动为尚未绑定的顶栏公共组件注入默认交互与无障碍提示
function autoBindCommonHeader() {
  const soundBtn = document.getElementById('btn-sound-toggle');
  if (soundBtn && !soundBtn._commonBound) {
    soundBtn.title = soundBtn.title || '切换音效开关';
    const updateIcon = () => {
      soundBtn.textContent = (window.AUDIO && window.AUDIO.enabled) ? '🔊' : '🔇';
    };
    updateIcon();
    if (!soundBtn.getAttribute('onclick')) {
      soundBtn.onclick = () => {
        triggerHaptic('light');
        if (window.AUDIO) {
          window.AUDIO.toggle();
          updateIcon();
          showToast(window.AUDIO.enabled ? '音效已开启' : '音效已静音');
        }
      };
    }
  }

  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn && !restartBtn._commonBound) {
    restartBtn.title = restartBtn.title || '重新开始游戏';
    if (!restartBtn.getAttribute('onclick')) {
      restartBtn.onclick = () => {
        triggerHaptic('medium');
        if (window.AUDIO) window.AUDIO.play('click');
        handleModalRestart();
      };
    }
  }

  const rulesBtn = document.getElementById('btn-rules-header');
  if (rulesBtn && !rulesBtn._commonBound) {
    rulesBtn.title = rulesBtn.title || '查看游戏规则与按键说明';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoBindCommonHeader);
} else {
  autoBindCommonHeader();
}

// 导出全局
window.showToast = showToast;
window.showModal = showModal;
window.closeModal = closeModal;
window.startConfetti = startConfetti;
window.stopConfetti = stopConfetti;
window.handleModalRestart = handleModalRestart;
window.handleModalReturnLobby = handleModalReturnLobby;
window.initCommonHeader = initCommonHeader;
window.triggerHaptic = triggerHaptic;

// ==========================================================================
// 📱 PWA Service Worker 注册与安装引导 (PWA Integration)
// ==========================================================================
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    const swPath = window.location.pathname.includes('/games/') ? '../sw.js' : './sw.js';
    navigator.serviceWorker.register(swPath, { scope: '/' }).then((reg) => {
      console.log('[PWA] Service Worker registered with scope:', reg.scope);
    }).catch((err) => {
      console.warn('[PWA] Service Worker registration failed:', err);
    });
  });
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (sessionStorage.getItem('pwa_banner_dismissed') === '1') return;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'flex';
});

function triggerPwaInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        showToast('🎉 感谢安装！已添加至桌面，可脱离浏览器全屏畅玩', 3000);
      }
      deferredInstallPrompt = null;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
    });
  } else {
    showToast('💡 可在手机浏览器菜单中点击【添加到主屏幕】直接安装', 3000);
  }
}

function dismissPwaBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'none';
  sessionStorage.setItem('pwa_banner_dismissed', '1');
}

window.triggerPwaInstall = triggerPwaInstall;
window.dismissPwaBanner = dismissPwaBanner;

