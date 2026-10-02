    // 8. 皇家大话骰核心逻辑 (LIARSDICE)
    // ==========================================================================
    function initLiarsDiceGame() {
      if (STATE.liarsdice.modalTimer) clearTimeout(STATE.liarsdice.modalTimer);
      if (STATE.liarsdice.roundTimer) clearTimeout(STATE.liarsdice.roundTimer);
      if (STATE.liarsdice.aiTimer) clearTimeout(STATE.liarsdice.aiTimer);
      if (STATE.liarsdice.shakeTimer) clearTimeout(STATE.liarsdice.shakeTimer);
      STATE.liarsdice.p1Hp = 3;
      STATE.liarsdice.p2Hp = 3;
      resetLiarsDiceRound();
    }

    function resetLiarsDiceRound() {
      if (STATE.liarsdice.modalTimer) clearTimeout(STATE.liarsdice.modalTimer);
      if (STATE.liarsdice.roundTimer) clearTimeout(STATE.liarsdice.roundTimer);
      if (STATE.liarsdice.aiTimer) clearTimeout(STATE.liarsdice.aiTimer);
      if (STATE.liarsdice.shakeTimer) clearTimeout(STATE.liarsdice.shakeTimer);
      STATE.liarsdice.p1Dice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
      STATE.liarsdice.p2Dice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
      STATE.liarsdice.currentBid = null;
      STATE.liarsdice.selectedQty = 3;
      STATE.liarsdice.selectedVal = 3;
      STATE.liarsdice.onesCalled = false;
      STATE.liarsdice.revealed = false;
      STATE.liarsdice.p1Peeking = false;
      STATE.liarsdice.p2Peeking = false;
      STATE.turn = 1;

      AUDIO.play('dice_shake');
      STATE.liarsdice.shakeTimer = setTimeout(() => { AUDIO.play('cup_slam'); }, 300);

      updateLiarsDiceUI();
      renderLiarsDiceTrays();
    }

    function renderLiarsDiceTrays() {
      const diceIcons = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      const p1Tray = document.getElementById('liars-p1-tray');
      const p2Tray = document.getElementById('liars-p2-tray');
      if (!p1Tray || !p2Tray) return;

      const isTarget = (d) => {
        if (!STATE.liarsdice.currentBid) return false;
        const b = STATE.liarsdice.currentBid;
        return d === b.val || (!STATE.liarsdice.onesCalled && d === 1 && b.val !== 1);
      };

      // P1 骰盅渲染
      if (STATE.gameMode === 'LOCAL') {
        if (STATE.liarsdice.revealed) {
          p1Tray.innerHTML = STATE.liarsdice.p1Dice.map(d =>
            `<div class="die-face ${isTarget(d) ? 'die-highlight' : ''}">${diceIcons[d]}</div>`
          ).join('');
        } else if (STATE.liarsdice.p1Peeking) {
          p1Tray.innerHTML = STATE.liarsdice.p1Dice.map(d =>
            `<div class="die-face">${diceIcons[d]}</div>`
          ).join('');
        } else {
          p1Tray.innerHTML = STATE.liarsdice.p1Dice.map(() =>
            `<div class="die-face die-hidden" title="按住上方按钮或此处偷看">🎲</div>`
          ).join('');
        }
      } else {
        // AI 模式：P1 己方常驻明牌
        p1Tray.innerHTML = STATE.liarsdice.p1Dice.map(d =>
          `<div class="die-face ${STATE.liarsdice.revealed && isTarget(d) ? 'die-highlight' : ''}">${diceIcons[d]}</div>`
        ).join('');
      }

      // P2 骰盅渲染
      if (STATE.liarsdice.revealed) {
        p2Tray.innerHTML = STATE.liarsdice.p2Dice.map(d =>
          `<div class="die-face ${isTarget(d) ? 'die-highlight' : ''}">${diceIcons[d]}</div>`
        ).join('');
      } else if (STATE.gameMode === 'LOCAL' && STATE.liarsdice.p2Peeking) {
        p2Tray.innerHTML = STATE.liarsdice.p2Dice.map(d =>
          `<div class="die-face">${diceIcons[d]}</div>`
        ).join('');
      } else {
        p2Tray.innerHTML = STATE.liarsdice.p2Dice.map(() =>
          `<div class="die-face die-hidden" title="按住上方按钮或此处偷看">🎲</div>`
        ).join('');
      }
    }

    function updateLiarsDiceUI() {
      const diceIcons = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      document.getElementById('liars-p1-hp').textContent = '❤️'.repeat(STATE.liarsdice.p1Hp) + '🖤'.repeat(Math.max(0, 3 - STATE.liarsdice.p1Hp));
      document.getElementById('liars-p2-hp').textContent = '❤️'.repeat(STATE.liarsdice.p2Hp) + '🖤'.repeat(Math.max(0, 3 - STATE.liarsdice.p2Hp));

      // 玩家名称与偷看按钮控制
      const p1NameElem = document.getElementById('liars-p1-name');
      const p2NameElem = document.getElementById('liars-p2-name');
      const peekP1Btn = document.getElementById('btn-peek-p1');
      const peekP2Btn = document.getElementById('btn-peek-p2');

      if (STATE.gameMode === 'LOCAL') {
        if (p1NameElem) p1NameElem.innerHTML = '🔴 玩家 1' + (STATE.turn === 1 ? ' <small style="color:#facc15">(思考中)</small>' : '');
        if (p2NameElem) p2NameElem.innerHTML = '🟢 玩家 2' + (STATE.turn === 2 ? ' <small style="color:#facc15">(思考中)</small>' : '');
        if (peekP1Btn) peekP1Btn.style.display = 'inline-flex';
        if (peekP2Btn) peekP2Btn.style.display = 'inline-flex';
      } else {
        if (p1NameElem) p1NameElem.innerHTML = '🔴 玩家 (己方)';
        if (p2NameElem) p2NameElem.innerHTML = '🔵 对手 (恶魔AI)';
        if (peekP1Btn) peekP1Btn.style.display = 'none';
        if (peekP2Btn) peekP2Btn.style.display = 'none';
      }

      document.getElementById('dice-qty-val').textContent = STATE.liarsdice.selectedQty;

      const choices = document.querySelectorAll('.btn-val-choice');
      choices.forEach(c => {
        c.classList.toggle('active', parseInt(c.dataset.val) === STATE.liarsdice.selectedVal);
      });

      const bidText = document.getElementById('liars-curr-bid-text');
      const turnTip = document.getElementById('liars-turn-tip');
      const challengeBtn = document.getElementById('btn-dice-challenge');

      if (STATE.liarsdice.currentBid) {
        const b = STATE.liarsdice.currentBid;
        const callerLabel = b.by === 1 ? '🔴 玩家 1' : (STATE.gameMode === 'AI' ? '🔵 恶魔AI' : '🟢 玩家 2');
        bidText.innerHTML = `🗣️ 【${callerLabel}】 叫出: <span style="color:#fbbf24; font-size:1.2rem;">${b.qty} 个 ${diceIcons[b.val]} (${b.val}点)</span>`;
        challengeBtn.style.display = 'block';
      } else {
        bidText.textContent = '当前无人叫牌 (起步首叫)';
        challengeBtn.style.display = 'none';
      }

      const bidBtn = document.getElementById('btn-dice-bid');
      if (STATE.liarsdice.revealed || STATE.liarsdice.p1Hp <= 0 || STATE.liarsdice.p2Hp <= 0) {
        if (bidBtn) {
          bidBtn.style.opacity = '0.4';
          bidBtn.style.pointerEvents = 'none';
        }
        if (challengeBtn) {
          challengeBtn.style.opacity = '0.4';
          challengeBtn.style.pointerEvents = 'none';
        }
      } else {
        if (bidBtn) {
          bidBtn.style.opacity = '1';
          bidBtn.style.pointerEvents = 'auto';
        }
        if (challengeBtn) {
          challengeBtn.style.opacity = '1';
          challengeBtn.style.pointerEvents = 'auto';
        }
      }

      if (STATE.gameMode === 'AI') {
        turnTip.textContent = STATE.turn === 1 ? '👉 轮到你行动：选择更高叫牌或直接开！' : '🤖 对手思考叫牌中...';
      } else {
        turnTip.textContent = STATE.turn === 1 ? '👉 轮到 【🔴 玩家 1】 行动：选择更高叫牌或直接开！' : '👉 轮到 【🟢 玩家 2】 行动：选择更高叫牌或直接开！';
      }
    }

    function stepDiceQty(delta) {
      AUDIO.play('click');
      const minQty = STATE.liarsdice.currentBid ? STATE.liarsdice.currentBid.qty : 2;
      STATE.liarsdice.selectedQty = Math.max(minQty, Math.min(10, STATE.liarsdice.selectedQty + delta));
      document.getElementById('dice-qty-val').textContent = STATE.liarsdice.selectedQty;
    }

    function selectDiceVal(val) {
      AUDIO.play('click');
      STATE.liarsdice.selectedVal = val;
      updateLiarsDiceUI();
    }

    function submitDiceBid() {
      if (STATE.liarsdice.revealed || STATE.liarsdice.p1Hp <= 0 || STATE.liarsdice.p2Hp <= 0) return;
      if (STATE.turn !== 1 && STATE.gameMode === 'AI') return;
      const qty = STATE.liarsdice.selectedQty;
      const val = STATE.liarsdice.selectedVal;

      if (STATE.liarsdice.currentBid) {
        const cur = STATE.liarsdice.currentBid;
        if (qty < cur.qty || (qty === cur.qty && val <= cur.val)) {
          showToast('⚠️ 叫牌必须比当前更大（数量更多，或数量相同点数更大）！');
          return;
        }
      }

      if (val === 1) STATE.liarsdice.onesCalled = true;
      STATE.liarsdice.currentBid = { qty, val, by: STATE.turn };
      AUDIO.play('bid');

      STATE.turn = STATE.turn === 1 ? 2 : 1;

      // 智能递增下一位玩家的默认选择器
      if (val === 6) {
        STATE.liarsdice.selectedQty = Math.min(10, qty + 1);
        STATE.liarsdice.selectedVal = 2;
      } else {
        STATE.liarsdice.selectedQty = qty;
        STATE.liarsdice.selectedVal = val + 1;
      }

      updateLiarsDiceUI();
      renderLiarsDiceTrays();

      if (STATE.gameMode === 'AI' && STATE.turn === 2) {
        if (STATE.liarsdice.aiTimer) clearTimeout(STATE.liarsdice.aiTimer);
        STATE.liarsdice.aiTimer = setTimeout(runLiarsDiceAI, 1200);
      }
    }

    function challengeDiceBid() {
      if (!STATE.liarsdice.currentBid || STATE.liarsdice.revealed || STATE.liarsdice.p1Hp <= 0 || STATE.liarsdice.p2Hp <= 0) return;
      STATE.liarsdice.revealed = true;
      if (STATE.liarsdice.aiTimer) clearTimeout(STATE.liarsdice.aiTimer);
      AUDIO.play('reveal');
      renderLiarsDiceTrays();

      const targetVal = STATE.liarsdice.currentBid.val;
      const targetQty = STATE.liarsdice.currentBid.qty;
      const caller = STATE.liarsdice.currentBid.by;
      const challenger = caller === 1 ? 2 : 1;

      let totalMatches = 0;
      [...STATE.liarsdice.p1Dice, ...STATE.liarsdice.p2Dice].forEach(d => {
        if (d === targetVal || (!STATE.liarsdice.onesCalled && d === 1 && targetVal !== 1)) {
          totalMatches++;
        }
      });

      const diceIcons = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      const pass = totalMatches >= targetQty;

      const callerLabel = caller === 1 ? '🔴 玩家 1' : (STATE.gameMode === 'AI' ? '🔵 恶魔AI' : '🟢 玩家 2');
      const challengerLabel = challenger === 1 ? '🔴 玩家 1' : (STATE.gameMode === 'AI' ? '🔵 恶魔AI' : '🟢 玩家 2');

      let loser = null;
      if (pass) {
        loser = challenger;
        showToast(`🚨 开牌验骰！场上一共有 <b>${totalMatches}</b> 个 ${diceIcons[targetVal]}！【${callerLabel}】叫牌成立！【${challengerLabel}】质疑失败扣血！`, 3500);
      } else {
        loser = caller;
        showToast(`🚨 开牌验骰！场上只有 <b>${totalMatches}</b> 个 ${diceIcons[targetVal]}！【${callerLabel}】吹牛被抓扣血！`, 3500);
      }

      if (loser === 1) STATE.liarsdice.p1Hp--;
      else STATE.liarsdice.p2Hp--;

      updateLiarsDiceUI();

      if (STATE.liarsdice.p1Hp <= 0 || STATE.liarsdice.p2Hp <= 0) {
        if (STATE.liarsdice.modalTimer) clearTimeout(STATE.liarsdice.modalTimer);
        STATE.liarsdice.modalTimer = setTimeout(() => {
          let winMsg = '';
          if (STATE.gameMode === 'AI') {
            winMsg = STATE.liarsdice.p1Hp > 0 ? '🏆 心理博弈拉满！你成功将对手的筹码全部蚕食！' : '💀 吹牛被对手彻底看穿，生命值归零！';
          } else {
            winMsg = STATE.liarsdice.p1Hp > 0 ? '🏆 心理博弈拉满！【🔴 玩家 1】技高一筹，问鼎骰王！' : '🏆 心理博弈拉满！【🟢 玩家 2】技高一筹，问鼎骰王！';
          }
          showModal('大话骰 终局', winMsg);
        }, 1500);
      } else {
        if (STATE.liarsdice.roundTimer) clearTimeout(STATE.liarsdice.roundTimer);
        STATE.liarsdice.roundTimer = setTimeout(resetLiarsDiceRound, 3600);
      }
    }

    function runLiarsDiceAI() {
      if (STATE.turn !== 2 || !STATE.liarsdice.currentBid || STATE.liarsdice.revealed || STATE.liarsdice.p1Hp <= 0 || STATE.liarsdice.p2Hp <= 0) return;
      const cur = STATE.liarsdice.currentBid;

      let myMatches = 0;
      STATE.liarsdice.p2Dice.forEach(d => {
        if (d === cur.val || (!STATE.liarsdice.onesCalled && d === 1 && cur.val !== 1)) myMatches++;
      });

      const pMatch = (!STATE.liarsdice.onesCalled && cur.val !== 1) ? 0.333 : 0.166;
      const expectedTotal = myMatches + 5 * pMatch;

      if (cur.qty >= expectedTotal + 1.6 || cur.qty >= 7) {
        document.getElementById('liars-turn-tip').textContent = '🚨 对手高喊「开！」当场验骰！';
        STATE.liarsdice.aiTimer = setTimeout(challengeDiceBid, 600);
      } else {
        let nextQty = cur.qty;
        let nextVal = cur.val;
        if (nextVal < 6) {
          nextVal += 1;
        } else {
          nextQty += 1;
          nextVal = Math.floor(Math.random() * 4) + 2;
        }
        if (nextVal === 1) STATE.liarsdice.onesCalled = true;
        STATE.liarsdice.currentBid = { qty: nextQty, val: nextVal, by: 2 };
        AUDIO.play('bid');
        STATE.turn = 1;
        updateLiarsDiceUI();
      }
    }

    function resetLiarsDiceMatch() {
      initLiarsDiceGame();
    }

    function setupPeekListeners() {
      function bindPeek(elem, player) {
        if (!elem) return;
        const startPeek = (e) => {
          if (STATE.gameMode !== 'LOCAL') return;
          if (e) {
            e.preventDefault();
            if (elem.setPointerCapture && e.pointerId !== undefined) {
              try { elem.setPointerCapture(e.pointerId); } catch(err) {}
            }
          }
          if (player === 1) STATE.liarsdice.p1Peeking = true;
          else STATE.liarsdice.p2Peeking = true;
          renderLiarsDiceTrays();
          const btn = document.getElementById('btn-peek-p' + player);
          if (btn) btn.classList.add('peeking');
        };
        const endPeek = (e) => {
          if (STATE.gameMode !== 'LOCAL') return;
          if (e && elem.releasePointerCapture && e.pointerId !== undefined) {
            try { elem.releasePointerCapture(e.pointerId); } catch(err) {}
          }
          if (player === 1) STATE.liarsdice.p1Peeking = false;
          else STATE.liarsdice.p2Peeking = false;
          renderLiarsDiceTrays();
          const btn = document.getElementById('btn-peek-p' + player);
          if (btn) btn.classList.remove('peeking');
        };

        elem.addEventListener('pointerdown', startPeek);
        elem.addEventListener('pointerup', endPeek);
        elem.addEventListener('pointercancel', endPeek);
        elem.addEventListener('pointerleave', endPeek);
        elem.addEventListener('contextmenu', (e) => e.preventDefault());
      }

      bindPeek(document.getElementById('btn-peek-p1'), 1);
      bindPeek(document.getElementById('liars-p1-tray'), 1);
      bindPeek(document.getElementById('btn-peek-p2'), 2);
      bindPeek(document.getElementById('liars-p2-tray'), 2);

      // 视口外兜底释放，防止多指或滑出窗口导致持续偷看
      window.addEventListener('pointerup', () => {
        if (STATE.gameMode !== 'LOCAL') return;
        if (STATE.liarsdice.p1Peeking || STATE.liarsdice.p2Peeking) {
          STATE.liarsdice.p1Peeking = false;
          STATE.liarsdice.p2Peeking = false;
          renderLiarsDiceTrays();
          const b1 = document.getElementById('btn-peek-p1');
          const b2 = document.getElementById('btn-peek-p2');
          if (b1) b1.classList.remove('peeking');
          if (b2) b2.classList.remove('peeking');
        }
      });
      window.addEventListener('blur', () => {
        if (STATE.gameMode !== 'LOCAL') return;
        if (STATE.liarsdice.p1Peeking || STATE.liarsdice.p2Peeking) {
          STATE.liarsdice.p1Peeking = false;
          STATE.liarsdice.p2Peeking = false;
          renderLiarsDiceTrays();
          const b1 = document.getElementById('btn-peek-p1');
          const b2 = document.getElementById('btn-peek-p2');
          if (b1) b1.classList.remove('peeking');
          if (b2) b2.classList.remove('peeking');
        }
      });
    }

    // ==========================================================================
