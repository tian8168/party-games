// ==========================================================================
// 聚会游戏大厅 · 通用交互与弹窗辅助 (Shared Utilities)
// ==========================================================================

function showToast(text, duration = 3000) {
  const toast = document.getElementById('toast-msg');
  if (!toast) return;
  toast.innerHTML = text;
  toast.style.display = 'flex';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

function showModal(title, bodyHtml) {
  const t = document.getElementById('modal-title');
  const b = document.getElementById('modal-body');
  const m = document.getElementById('game-modal');
  if (t) t.textContent = title;
  if (b) b.innerHTML = bodyHtml;
  if (m) m.classList.add('show');
}

function hideModal() {
  const m = document.getElementById('game-modal');
  if (m) m.classList.remove('show');
}

function toggleSound() {
  if (typeof AUDIO !== 'undefined' && AUDIO.toggle) {
    const on = AUDIO.toggle();
    const btn = document.getElementById('btn-sound-toggle');
    if (btn) btn.textContent = on ? '🔊' : '🔇';
  }
}

function showCurrentRules() {
  if (typeof AUDIO !== 'undefined' && AUDIO.play) AUDIO.play('click');
  const cur = (window.STATE && window.STATE.currentGame) ? window.STATE.currentGame : window.GAME_KEY;
  const rules = window.GAME_RULES || {};
  const info = rules[cur] || rules['DEFAULT'] || { title: '游戏规则', body: '暂无详细说明' };
  showModal(info.title, info.body);
}

document.addEventListener('DOMContentLoaded', () => {
  const confirmBtn = document.getElementById('modal-confirm-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', hideModal);
  }
  const modal = document.getElementById('game-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });
  }
});

function recordRecentGame(gameKey) {
  try {
    let recents = JSON.parse(localStorage.getItem('arcade_recent_games') || '[]');
    recents = recents.filter(k => k !== gameKey);
    recents.unshift(gameKey);
    if (recents.length > 4) recents.length = 4;
    localStorage.setItem('arcade_recent_games', JSON.stringify(recents));
  } catch(e) {}
}
