    // 8. 皇家大话骰核心逻辑 (LIARSDICE)
    // ==========================================================================
    function initLiarsDiceGame() {
      STATE.liarsdice.p1Hp = 3;
      STATE.liarsdice.p2Hp = 3;
      resetLiarsDiceRound();
    }

    function resetLiarsDiceRound() {
      STATE.liarsdice.p1Dice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
      STATE.liarsdice.p2Dice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
      STATE.liarsdice.currentBid = null;
      STATE.liarsdice.selectedQty = 3;
      STATE.liarsdice.selectedVal = 3;
      STATE.liarsdice.onesCalled = false;
      STATE.liarsdice.revealed = false;
      STATE.turn = 1;

      AUDIO.play('dice_shake');
      setTimeout(() => { AUDIO.play('cup_slam'); }, 300);

      updateLiarsDiceUI();
      renderLiarsDiceTrays();
    }

    function renderLiarsDiceTrays() {
      const diceIcons = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      const p1Tray = document.getElementById('liars-p1-tray');
      const p2Tray = document.getElementById('liars-p2-tray');

      p1Tray.innerHTML = STATE.liarsdice.p1Dice.map(d => `<div class="die-face">${diceIcons[d]}</div>`).join('');

      if (STATE.liarsdice.revealed) {
        p2Tray.innerHTML = STATE.liarsdice.p2Dice.map(d => {
          const isTarget = d === STATE.liarsdice.currentBid?.val || (!STATE.liarsdice.onesCalled && d === 1 && STATE.liarsdice.currentBid?.val !== 1);
          return `<div class="die-face ${isTarget ? 'die-highlight' : ''}">${diceIcons[d]}</div>`;
        }).join('');
      } else {
        p2Tray.innerHTML = STATE.liarsdice.p2Dice.map(() => `<div class="die-face die-hidden">🎲</div>`).join('');
      }
    }

    function updateLiarsDiceUI() {
      const diceIcons = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      document.getElementById('liars-p1-hp').textContent = '❤️'.repeat(STATE.liarsdice.p1Hp) + '🖤'.repeat(Math.max(0, 3 - STATE.liarsdice.p1Hp));
      document.getElementById('liars-p2-hp').textContent = '❤️'.repeat(STATE.liarsdice.p2Hp) + '🖤'.repeat(Math.max(0, 3 - STATE.liarsdice.p2Hp));

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
        bidText.innerHTML = `🗣️ 【${b.by === 1 ? '🔴 玩家' : '🔵 对手'}】 叫出: <span style="color:#fbbf24; font-size:1.2rem;">${b.qty} 个 ${diceIcons[b.val]} (${b.val}点)</span>`;
        challengeBtn.style.display = 'block';
      } else {
        bidText.textContent = '当前无人叫牌 (起步首叫)';
        challengeBtn.style.display = 'none';
      }

      turnTip.textContent = STATE.turn === 1 ? '👉 轮到你行动：选择更高叫牌或直接开！' : '🤖 对手思考叫牌中...';
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
      STATE.liarsdice.currentBid = { qty, val, by: 1 };
      AUDIO.play('bid');

      STATE.turn = 2;
      updateLiarsDiceUI();

      if (STATE.gameMode === 'AI') {
        setTimeout(runLiarsDiceAI, 1200);
      }
    }

    function challengeDiceBid() {
      if (!STATE.liarsdice.currentBid) return;
      STATE.liarsdice.revealed = true;
      AUDIO.play('reveal');
      renderLiarsDiceTrays();

      const targetVal = STATE.liarsdice.currentBid.val;
      const targetQty = STATE.liarsdice.currentBid.qty;
      const caller = STATE.liarsdice.currentBid.by;

      let totalMatches = 0;
      [...STATE.liarsdice.p1Dice, ...STATE.liarsdice.p2Dice].forEach(d => {
        if (d === targetVal || (!STATE.liarsdice.onesCalled && d === 1 && targetVal !== 1)) {
          totalMatches++;
        }
      });

      const diceIcons = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      const pass = totalMatches >= targetQty;

      let loser = null;
      if (pass) {
        loser = caller === 1 ? 2 : 1;
        showToast(`🚨 开牌验骰！场上一共有 <b>${totalMatches}</b> 个 ${diceIcons[targetVal]}！叫牌成立！质疑者扣血！`, 3500);
      } else {
        loser = caller;
        showToast(`🚨 开牌验骰！场上只有 <b>${totalMatches}</b> 个 ${diceIcons[targetVal]}！吹牛被抓！叫牌者扣血！`, 3500);
      }

      if (loser === 1) STATE.liarsdice.p1Hp--;
      else STATE.liarsdice.p2Hp--;

      updateLiarsDiceUI();

      if (STATE.liarsdice.p1Hp <= 0 || STATE.liarsdice.p2Hp <= 0) {
        setTimeout(() => {
          showModal('大话骰 终局', STATE.liarsdice.p1Hp > 0 ? '🏆 心理博弈拉满！你成功将对手的筹码全部蚕食！' : '💀 吹牛被对手彻底看穿，生命值归零！');
        }, 1500);
      } else {
        setTimeout(resetLiarsDiceRound, 3600);
      }
    }

    function runLiarsDiceAI() {
      if (STATE.turn !== 2 || !STATE.liarsdice.currentBid) return;
      const cur = STATE.liarsdice.currentBid;

      let myMatches = 0;
      STATE.liarsdice.p2Dice.forEach(d => {
        if (d === cur.val || (!STATE.liarsdice.onesCalled && d === 1 && cur.val !== 1)) myMatches++;
      });

      const pMatch = (!STATE.liarsdice.onesCalled && cur.val !== 1) ? 0.333 : 0.166;
      const expectedTotal = myMatches + 5 * pMatch;

      if (cur.qty >= expectedTotal + 1.6 || cur.qty >= 7) {
        document.getElementById('liars-turn-tip').textContent = '🚨 对手高喊「开！」当场验骰！';
        setTimeout(challengeDiceBid, 600);
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

    // ==========================================================================
