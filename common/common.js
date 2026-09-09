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

// 规则与通用弹窗
function handleModalRestart() {
  closeModal();
  if (typeof window.currentRestartFn === 'function') {
    window.currentRestartFn();
  } else if (typeof resetCurrentGame === 'function') {
    resetCurrentGame();
  } else {
    window.location.reload();
  }
}

function handleModalReturnLobby() {
  closeModal();
  window.location.href = '../index.html';
}

function showModal(title, bodyHtml, options = {}) {
  let modal = document.getElementById('rules-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rules-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
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
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;

  const isGameOver = options.isGameOver || ['获胜', '胜利', '胜出', '结束', '结算', '战报', '落幕', '终局', '终结', '冠军', '大捷', 'GAME OVER', '平局', '势均力敌', '阵亡'].some(k => (title || '').toUpperCase().includes(k.toUpperCase()));

  const footer = document.getElementById('modal-footer');
  if (footer) {
    if (isGameOver) {
      footer.innerHTML = `
        <button class="modal-btn-restart" onclick="handleModalRestart()">🔄 再来一局</button>
        <button class="modal-btn-confirm" onclick="handleModalReturnLobby()">🏠 确定 (返回大厅)</button>
      `;
    } else {
      footer.innerHTML = `
        <button class="modal-btn-confirm" onclick="closeModal()">我知道了</button>
      `;
    }
  }

  modal.classList.add('open');
}

function closeModal() {
  const modal = document.getElementById('rules-modal');
  if (modal) modal.classList.remove('open');
}

// 通用顶栏与按键初始化
function initCommonHeader(rulesTitle, rulesHtml, onRestart) {
  window.currentRestartFn = onRestart;
  // 音效按钮
  const soundBtn = document.getElementById('btn-sound-toggle');
  if (soundBtn) {
    const updateSoundIcon = () => {
      soundBtn.textContent = (window.AUDIO && window.AUDIO.enabled) ? '🔊' : '🔇';
    };
    updateSoundIcon();
    soundBtn.onclick = () => {
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
    rulesBtn.onclick = () => {
      if (window.AUDIO) window.AUDIO.play('click');
      showModal(rulesTitle, rulesHtml);
    };
  }

  // 重置按钮
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn && typeof onRestart === 'function') {
    restartBtn.onclick = () => {
      if (window.AUDIO) window.AUDIO.play('click');
      onRestart();
    };
  }
}

// 导出全局
window.showToast = showToast;
window.showModal = showModal;
window.closeModal = closeModal;
window.handleModalRestart = handleModalRestart;
window.handleModalReturnLobby = handleModalReturnLobby;
window.initCommonHeader = initCommonHeader;

// ==========================================================================
// 📱 PWA Service Worker 注册与安装引导 (PWA Integration)
// ==========================================================================
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    const swPath = window.location.pathname.includes('/games/') ? '../sw.js' : './sw.js';
    navigator.serviceWorker.register(swPath).then((reg) => {
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

