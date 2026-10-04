/**
 * 🎵 纯原生 Web Audio 合成音效引擎 (Zero-Dependency Web Audio Synthesis)
 * 支持全平台实时音频合成，包含落子、击发、撞击、跳跃、胜负音乐等，具备静音持久化记忆。
 */
    // ==========================================================================
    // 0. 原生 Web Audio 纯合成音效系统 (0 体积无外链依赖)
    // ==========================================================================
    const AUDIO = {
      ctx: null,
      enabled: true,
      init() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
      },
      toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
      },
      play(type) {
        try {
          const hFn = (typeof triggerHaptic === 'function') ? triggerHaptic : ((typeof window !== 'undefined' && typeof window.triggerHaptic === 'function') ? window.triggerHaptic : null);
          if (hFn) {
            if (type === 'win' || type === 'plane_win' || type === 'goal' || type === 'contra_30' || type === 'bm_win' || type === 'uno_win') {
              hFn('success');
            } else if (type === 'bomb_alarm' || type === 'turn_warning' || type === 'false_start' || type === 'bm_warning' || type === 'uno_call' || type === 'uno_wild') {
              hFn('warning');
            } else if (type === 'crash' || type === 'plane_crash' || type === 'tank_explosion' || type === 'tank_explode' || type === 'contra_explode' || type === 'fall' || type === 'bonk' || type === 'tron_missile_hit' || type === 'tron_emp' || type === 'bm_explode' || type === 'bm_death' || type === 'uno_strike' || type === 'uno_catch') {
              hFn('heavy');
            } else if (type === 'drop' || type === 'card_play' || type === 'dice_roll' || type === 'go_stone' || type === 'go_capture' || type === 'card_draw' || type === 'cup_slam' || type === 'slice' || type === 'tron_boost' || type === 'tank_fire' || type === 'tron_missile' || type === 'tron_super_boost' || type === 'tron_ghost' || type === 'bm_place' || type === 'uno_reverse' || type === 'uno_skip') {
              hFn('medium');
            } else if (type === 'tron_item_pickup' || type === 'bm_item' || type === 'uno_play' || type === 'uno_draw') {
              hFn('light');
            } else {
              hFn('light');
            }
          } else if (typeof navigator !== 'undefined' && navigator && typeof navigator.vibrate === 'function') {
            navigator.vibrate(15);
          }
        } catch (e) {}
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const t = this.ctx.currentTime;
        try {
          if (type === 'click') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.exponentialRampToValueAtTime(150, t + 0.05);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.05);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.05);
          } else if (type === 'drop' || type === 'go_stone') { // 围棋落子物理拟真声 (云子/玛瑙/木质棋盘敲击)
            const pitchVariation = (Math.random() - 0.5) * 35;
            // 1. 高频清脆敲击瞬态 (Transient Contact Click)
            const transientOsc = this.ctx.createOscillator();
            const transientGain = this.ctx.createGain();
            transientOsc.type = 'sine';
            transientOsc.frequency.setValueAtTime(3600 + pitchVariation, t);
            transientOsc.frequency.exponentialRampToValueAtTime(1400, t + 0.012);
            transientGain.gain.setValueAtTime(0.45, t);
            transientGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
            transientOsc.connect(transientGain);
            transientGain.connect(this.ctx.destination);
            transientOsc.start(t);
            transientOsc.stop(t + 0.015);

            // 1b. 高频微白噪打击爆破瞬态
            const noiseBufSize = Math.floor(this.ctx.sampleRate * 0.015);
            const noiseBuf = this.ctx.createBuffer(1, noiseBufSize, this.ctx.sampleRate);
            const noiseData = noiseBuf.getChannelData(0);
            for (let i = 0; i < noiseBufSize; i++) {
              noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseBufSize * 0.25));
            }
            const noiseSrc = this.ctx.createBufferSource();
            noiseSrc.buffer = noiseBuf;
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.setValueAtTime(2400, t);
            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.32, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
            noiseSrc.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);
            noiseSrc.start(t);

            // 2. 榧木盘腔紧凑低频共鸣 (Wood Cavity Resonance)
            const bodyOsc = this.ctx.createOscillator();
            const bodyGain = this.ctx.createGain();
            bodyOsc.type = 'triangle';
            bodyOsc.frequency.setValueAtTime(480 + pitchVariation * 0.5, t);
            bodyOsc.frequency.exponentialRampToValueAtTime(220, t + 0.07);
            bodyGain.gain.setValueAtTime(0.38, t);
            bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
            bodyOsc.connect(bodyGain);
            bodyGain.connect(this.ctx.destination);
            bodyOsc.start(t);
            bodyOsc.stop(t + 0.075);
          } else if (type === 'go_capture') { // 围棋提子吃子声 (多子碰撞与浑厚盘体吸震)
            // 提子第1声
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(2800, t);
            osc1.frequency.exponentialRampToValueAtTime(900, t + 0.02);
            gain1.gain.setValueAtTime(0.35, t);
            gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
            osc1.connect(gain1); gain1.connect(this.ctx.destination);
            osc1.start(t); osc1.stop(t + 0.02);

            // 提子第2声（错开 25ms 形成双子磕碰质感）
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(2100, t + 0.025);
            osc2.frequency.exponentialRampToValueAtTime(600, t + 0.055);
            gain2.gain.setValueAtTime(0.3, t + 0.025);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
            osc2.connect(gain2); gain2.connect(this.ctx.destination);
            osc2.start(t + 0.025); osc2.stop(t + 0.055);

            // 浑厚沉闷的低频盘体吸收声
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(180, t);
            subOsc.frequency.exponentialRampToValueAtTime(70, t + 0.12);
            subGain.gain.setValueAtTime(0.45, t);
            subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            subOsc.connect(subGain); subGain.connect(this.ctx.destination);
            subOsc.start(t); subOsc.stop(t + 0.12);
          } else if (type === 'go_pass') { // 停一手（棋子归盒入盅木质滑动声）
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, t);
            osc.frequency.exponentialRampToValueAtTime(180, t + 0.08);
            gain.gain.setValueAtTime(0.22, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.09);
          } else if (type === 'go_invalid') { // 禁着/非法落子（闷钝木质触阻反馈）
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(160, t);
            osc.frequency.exponentialRampToValueAtTime(75, t + 0.06);
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.065);
          } else if (type === 'shot') { // 霰弹枪炸鸣
            const bufferSize = this.ctx.sampleRate * 0.35;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, t);
            filter.frequency.linearRampToValueAtTime(150, t + 0.3);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.65, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
            noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'blank') { // 空枪撞针清脆咔哒
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1500, t);
            osc.frequency.exponentialRampToValueAtTime(600, t + 0.035);
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.035);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.035);
          } else if (type === 'rack') { // 机械上膛声
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.exponentialRampToValueAtTime(480, t + 0.08);
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.08);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.08);
          } else if (type === 'hit') { // 冰球撞击
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(700, t);
            osc.frequency.exponentialRampToValueAtTime(260, t + 0.06);
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.06);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.06);
          } else if (type === 'goal') { // 进球庆祝
            [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, t + i * 0.07);
              gain.gain.setValueAtTime(0.2, t + i * 0.07);
              gain.gain.linearRampToValueAtTime(0.01, t + i * 0.07 + 0.22);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.22);
            });
          
          
          } else if (type === 'contra_shoot') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(520, t);
            osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.06);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.06);
          } else if (type === 'contra_spread') {
            [480, 640, 780].forEach((f, idx) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'square';
              osc.frequency.setValueAtTime(f, t + idx * 0.01);
              osc.frequency.exponentialRampToValueAtTime(160, t + idx * 0.01 + 0.08);
              gain.gain.setValueAtTime(0.18, t + idx * 0.01);
              gain.gain.linearRampToValueAtTime(0.01, t + idx * 0.01 + 0.08);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + idx * 0.01); osc.stop(t + idx * 0.01 + 0.08);
            });
          } else if (type === 'contra_jump') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180, t);
            osc.frequency.linearRampToValueAtTime(460, t + 0.12);
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.12);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.12);
          } else if (type === 'contra_explode') {
            const bufferSize = this.ctx.sampleRate * 0.28;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.18));
            const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, t); filter.frequency.linearRampToValueAtTime(80, t + 0.28);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.65, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
            noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'contra_30') {
            // 经典 Konami 秘籍 1-UP 升调和弦
            [330, 392, 659, 523, 587, 784].forEach((f, i) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'square';
              osc.frequency.setValueAtTime(f, t + i * 0.07);
              gain.gain.setValueAtTime(0.25, t + i * 0.07);
              gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.18);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.18);
            });

          } else if (type === 'heartbeat') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(65, t);
            osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.12);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.12);
          } else if (type === 'draw_signal') {
            [880, 1760].forEach((freq) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, t);
              gain.gain.setValueAtTime(0.3, t);
              gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t); osc.stop(t + 0.25);
            });
          } else if (type === 'slash') {
            const bufferSize = this.ctx.sampleRate * 0.18;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
            const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2400, t);
            filter.frequency.exponentialRampToValueAtTime(300, t + 0.18);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.7, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.18);
            noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'false_start') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, t);
            osc.frequency.setValueAtTime(110, t + 0.1);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.25);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.25);
          } else if (type === 'dice_shake') {
            for (let i = 0; i < 4; i++) {
              const dt = t + i * 0.04;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(300 + Math.random() * 200, dt);
              gain.gain.setValueAtTime(0.18, dt);
              gain.gain.exponentialRampToValueAtTime(0.01, dt + 0.035);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(dt); osc.stop(dt + 0.035);
            }
          } else if (type === 'cup_slam') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(120, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
            gain.gain.setValueAtTime(0.4, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.1);
          } else if (type === 'bid') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, t);
            osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.08);
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.08);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.08);
          } else if (type === 'reveal') {
            [440, 659.25, 880, 1174.66].forEach((f, i) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(f, t + i * 0.06);
              gain.gain.setValueAtTime(0.2, t + i * 0.06);
              gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.06 + 0.25);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.25);
            });
          } else if (type === 'bonk') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(280, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.07);
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.07);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.07);
          } else if (type === 'fall') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(350, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.4);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.4);
          } else if (type === 'tank_fire') {
            const bufferSize = this.ctx.sampleRate * 0.2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
            const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, t); filter.frequency.linearRampToValueAtTime(100, t + 0.2);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.55, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'tank_explosion') {
            const bufferSize = this.ctx.sampleRate * 0.35;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
            const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass';
            filter.frequency.setValueAtTime(450, t); filter.frequency.linearRampToValueAtTime(60, t + 0.35);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.65, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
            noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'slice') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(900, t);
            osc.frequency.exponentialRampToValueAtTime(250, t + 0.04);
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.04);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.04);
          } else if (type === 'perfect') {
            const scaleNotes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
            const noteIdx = Math.min((arguments[1] || 0), scaleNotes.length - 1);
            const freq = scaleNotes[noteIdx];
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.45);

          } else if (type === 'win') {
            [440, 554.37, 659.25, 880].forEach((freq, i) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, t + i * 0.09);
              gain.gain.setValueAtTime(0.22, t + i * 0.09);
              gain.linearRampToValueAtTime(0.01, t + i * 0.09 + 0.3);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + i * 0.09); osc.stop(t + i * 0.09 + 0.3);
            });
          } else if (type === 'plane_hop') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, t);
            osc.frequency.exponentialRampToValueAtTime(880, t + 0.06);
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.06);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.06);
          } else if (type === 'plane_takeoff') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, t);
            osc.frequency.exponentialRampToValueAtTime(950, t + 0.28);
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.28);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.28);
          } else if (type === 'plane_fly') {
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(800, t);
            filter.frequency.exponentialRampToValueAtTime(2200, t + 0.15);
            filter.frequency.exponentialRampToValueAtTime(600, t + 0.3);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.3);
            noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'plane_crash') {
            const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, t);
            filter.frequency.linearRampToValueAtTime(80, t + 0.4);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.55, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'plane_win') {
            [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, t + i * 0.08);
              gain.gain.setValueAtTime(0.25, t + i * 0.08);
              gain.gain.linearRampToValueAtTime(0.01, t + i * 0.08 + 0.28);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.28);
            });
          } else if (type === 'tron_turn') { // 极光光轮激光急转弯扫频
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(350, t);
            osc.frequency.exponentialRampToValueAtTime(1200, t + 0.04);
            osc.frequency.exponentialRampToValueAtTime(650, t + 0.08);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(850, t);
            filter.Q.setValueAtTime(2.5, t);
            gain.gain.setValueAtTime(0.22, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.08);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.08);
          } else if (type === 'tron_boost') { // 极光光轮过载引擎喷射轰鸣
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, t);
            osc.frequency.exponentialRampToValueAtTime(360, t + 0.16);
            osc.frequency.linearRampToValueAtTime(180, t + 0.35);
            gain.gain.setValueAtTime(0.32, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.35);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.35);
            const bufSize = Math.floor(this.ctx.sampleRate * 0.28);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));
            const noise = this.ctx.createBufferSource();
            noise.buffer = buf;
            const f = this.ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.setValueAtTime(650, t);
            f.frequency.exponentialRampToValueAtTime(1900, t + 0.2);
            const ng = this.ctx.createGain();
            ng.gain.setValueAtTime(0.26, t);
            ng.gain.linearRampToValueAtTime(0.01, t + 0.28);
            noise.connect(f);
            f.connect(ng);
            ng.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'tron_item_pickup') { // 极光光轮道具箱拾取 (清脆双音和弦琶音)
            [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, t + i * 0.045);
              gain.gain.setValueAtTime(0.2, t + i * 0.045);
              gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.045 + 0.16);
              osc.connect(gain);
              gain.connect(this.ctx.destination);
              osc.start(t + i * 0.045);
              osc.stop(t + i * 0.045 + 0.16);
            });
          } else if (type === 'tron_missile') { // 破墙飞弹点火发射呼啸
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(260, t);
            osc.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
            osc.frequency.exponentialRampToValueAtTime(450, t + 0.28);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(900, t);
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.28);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.28);
          } else if (type === 'tron_missile_hit') { // 破墙飞弹炸裂光壁震撼爆炸
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(160, t);
            osc.frequency.exponentialRampToValueAtTime(35, t + 0.35);
            gain.gain.setValueAtTime(0.4, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.35);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.35);
            const bufSize = Math.floor(this.ctx.sampleRate * 0.3);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.28));
            const noise = this.ctx.createBufferSource();
            noise.buffer = buf;
            const f = this.ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.setValueAtTime(950, t);
            f.frequency.exponentialRampToValueAtTime(120, t + 0.3);
            const ng = this.ctx.createGain();
            ng.gain.setValueAtTime(0.35, t);
            ng.gain.linearRampToValueAtTime(0.01, t + 0.3);
            noise.connect(f);
            f.connect(ng);
            ng.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'tron_ghost') { // 幽灵穿墙虚化空灵相位扫频
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(420, t);
            osc1.frequency.exponentialRampToValueAtTime(840, t + 0.25);
            osc1.frequency.exponentialRampToValueAtTime(560, t + 0.45);
            osc2.frequency.setValueAtTime(426, t);
            osc2.frequency.exponentialRampToValueAtTime(852, t + 0.25);
            osc2.frequency.exponentialRampToValueAtTime(568, t + 0.45);
            gain.gain.setValueAtTime(0.01, t);
            gain.gain.linearRampToValueAtTime(0.25, t + 0.08);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.45);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.ctx.destination);
            osc1.start(t);
            osc2.start(t);
            osc1.stop(t + 0.45);
            osc2.stop(t + 0.45);
          } else if (type === 'tron_super_boost') { // 超频氮气 200% 暴走轰鸣
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, t);
            osc.frequency.exponentialRampToValueAtTime(620, t + 0.15);
            osc.frequency.exponentialRampToValueAtTime(320, t + 0.4);
            const f = this.ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.setValueAtTime(800, t);
            f.frequency.exponentialRampToValueAtTime(2200, t + 0.2);
            gain.gain.setValueAtTime(0.35, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.4);
            osc.connect(f);
            f.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
          } else if (type === 'tron_emp') { // EMP 全场震撼脉冲与电流瘫痪
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, t);
            osc.frequency.exponentialRampToValueAtTime(30, t + 0.45);
            gain.gain.setValueAtTime(0.45, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.45);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.45);
            const bufSize = Math.floor(this.ctx.sampleRate * 0.4);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
              data[i] = (Math.random() * 2 - 1) * (i % 60 < 30 ? 1 : -0.5) * Math.exp(-i / (bufSize * 0.4));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buf;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400, t);
            filter.Q.setValueAtTime(4.0, t);
            const ng = this.ctx.createGain();
            ng.gain.setValueAtTime(0.3, t);
            ng.gain.linearRampToValueAtTime(0.01, t + 0.4);
            noise.connect(filter);
            filter.connect(ng);
            ng.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'cat_meow') { // 疯狂拆弹猫 哀鸣猫叫
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(520, t);
            osc.frequency.exponentialRampToValueAtTime(940, t + 0.14);
            osc.frequency.exponentialRampToValueAtTime(420, t + 0.38);
            gain.gain.setValueAtTime(0.01, t);
            gain.gain.linearRampToValueAtTime(0.32, t + 0.08);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.38);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.38);
          } else if (type === 'card_draw') { // 摸牌/抽牌摩擦轻快声
            const bufSize = Math.floor(this.ctx.sampleRate * 0.09);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
            const noise = this.ctx.createBufferSource();
            noise.buffer = buf;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2200, t);
            filter.frequency.exponentialRampToValueAtTime(4600, t + 0.06);
            filter.Q.setValueAtTime(1.5, t);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.09);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'bomb_alarm') { // 炸弹猫引线拉响刺耳三连急促警报
            for (let i = 0; i < 3; i++) {
              const dt = t + i * 0.11;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'square';
              osc.frequency.setValueAtTime(1050, dt);
              osc.frequency.setValueAtTime(1450, dt + 0.04);
              gain.gain.setValueAtTime(0.24, dt);
              gain.gain.linearRampToValueAtTime(0.01, dt + 0.08);
              osc.connect(gain);
              gain.connect(this.ctx.destination);
              osc.start(dt);
              osc.stop(dt + 0.08);
            }
          } else if (type === 'bm_place') { // 炸弹放置 - 沉闷机械声
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
            gain.gain.setValueAtTime(0.38, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.18);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.2);
          } else if (type === 'bm_explode') { // 炸弹爆炸 - 低频巨响+白噪声
            // Low boom
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, t);
            osc.frequency.exponentialRampToValueAtTime(30, t + 0.35);
            gain.gain.setValueAtTime(0.6, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.5);
            // Noise burst
            const bufSize = Math.floor(this.ctx.sampleRate * 0.3);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5);
            const noise = this.ctx.createBufferSource();
            noise.buffer = buf;
            const nFilter = this.ctx.createBiquadFilter();
            nFilter.type = 'lowpass'; nFilter.frequency.setValueAtTime(1800, t);
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.45, t); nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'bm_item') { // 道具拾取 - 上扬音阶叮咚
            const freqs = [523.25, 659.25, 783.99, 1046.5];
            freqs.forEach((freq, i) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, t + i * 0.06);
              gain.gain.setValueAtTime(0.22, t + i * 0.06);
              gain.gain.linearRampToValueAtTime(0.001, t + i * 0.06 + 0.14);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.15);
            });
          } else if (type === 'bm_death') { // 玩家死亡 - 下沉滑落+破碎
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, t);
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.5);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.linearRampToValueAtTime(0.001, t + 0.55);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.6);
          } else if (type === 'bm_win') { // 回合胜利 - 欢快三连升调
            const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
            notes.forEach((freq, i) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = i < 3 ? 'square' : 'sine';
              osc.frequency.setValueAtTime(freq, t + i * 0.1);
              gain.gain.setValueAtTime(0.25, t + i * 0.1);
              gain.gain.linearRampToValueAtTime(0.001, t + i * 0.1 + (i === 4 ? 0.5 : 0.15));
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + (i === 4 ? 0.55 : 0.2));
            });
          } else if (type === 'bm_warning') { // 末日突袭警报 - 急促双音交替
            for (let i = 0; i < 4; i++) {
              const dt2 = t + i * 0.15;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'square';
              osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, dt2);
              gain.gain.setValueAtTime(0.28, dt2);
              gain.gain.linearRampToValueAtTime(0.001, dt2 + 0.1);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(dt2); osc.stop(dt2 + 0.12);
            }
          } else if (type === 'uno_play') { // 乌诺牌 - 快速脆爽切牌滑牌
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(480, t);
            osc.frequency.exponentialRampToValueAtTime(160, t + 0.08);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.09);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.1);
          } else if (type === 'uno_draw') { // 摸牌 - 纸质抽牌沙沙轻快声
            const bufSize = Math.floor(this.ctx.sampleRate * 0.08);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
            const noise = this.ctx.createBufferSource();
            noise.buffer = buf;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2800, t);
            filter.frequency.exponentialRampToValueAtTime(4200, t + 0.07);
            filter.Q.setValueAtTime(2.0, t);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.08);
            noise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
            noise.start(t);
          } else if (type === 'uno_skip') { // 🚫 跳过 - 空气破风嗖声
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(750, t);
            osc.frequency.exponentialRampToValueAtTime(220, t + 0.16);
            gain.gain.setValueAtTime(0.32, t);
            gain.gain.linearRampToValueAtTime(0.001, t + 0.18);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.2);
          } else if (type === 'uno_reverse') { // 🔄 逆转 - 双向升降时空折叠滑音
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(320, t);
            osc1.frequency.exponentialRampToValueAtTime(880, t + 0.14);
            gain1.gain.setValueAtTime(0.25, t);
            gain1.gain.linearRampToValueAtTime(0.01, t + 0.15);
            osc1.connect(gain1); gain1.connect(this.ctx.destination);
            osc1.start(t); osc1.stop(t + 0.16);

            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(880, t + 0.12);
            osc2.frequency.exponentialRampToValueAtTime(320, t + 0.26);
            gain2.gain.setValueAtTime(0.25, t + 0.12);
            gain2.gain.linearRampToValueAtTime(0.01, t + 0.28);
            osc2.connect(gain2); gain2.connect(this.ctx.destination);
            osc2.start(t + 0.12); osc2.stop(t + 0.29);
          } else if (type === 'uno_wild') { // 🌈 变色牌 - 四色彩虹梦幻琶音
            const freqs = [523.25, 659.25, 783.99, 1046.5]; // C E G C
            freqs.forEach((freq, idx) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, t + idx * 0.07);
              gain.gain.setValueAtTime(0.22, t + idx * 0.07);
              gain.gain.linearRampToValueAtTime(0.001, t + idx * 0.07 + 0.18);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + idx * 0.07); osc.stop(t + idx * 0.07 + 0.2);
            });
          } else if (type === 'uno_strike') { // ⚡ +2 / 💣 +4 惩罚重击
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, t);
            osc.frequency.exponentialRampToValueAtTime(45, t + 0.35);
            gain.gain.setValueAtTime(0.55, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.45);
          } else if (type === 'uno_call') { // 📣 喊 UNO! - 激昂号角三连升调
            const fanfare = [523.25, 659.25, 1046.5];
            fanfare.forEach((f, idx) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'square';
              osc.frequency.setValueAtTime(f, t + idx * 0.11);
              gain.gain.setValueAtTime(0.26, t + idx * 0.11);
              gain.gain.linearRampToValueAtTime(0.001, t + idx * 0.11 + 0.2);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + idx * 0.11); osc.stop(t + idx * 0.11 + 0.22);
            });
          } else if (type === 'uno_catch') { // 🚨 抓漏 CATCH! - 尖锐举报警报
            for (let i = 0; i < 3; i++) {
              const dt3 = t + i * 0.09;
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(1150, dt3);
              osc.frequency.setValueAtTime(800, dt3 + 0.04);
              gain.gain.setValueAtTime(0.32, dt3);
              gain.gain.linearRampToValueAtTime(0.001, dt3 + 0.08);
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(dt3); osc.stop(dt3 + 0.085);
            }
          } else if (type === 'uno_win') { // 🏆 胜利庆典大合唱
            const melody = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
            melody.forEach((f, idx) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = idx < 3 ? 'square' : 'sine';
              osc.frequency.setValueAtTime(f, t + idx * 0.09);
              gain.gain.setValueAtTime(0.24, t + idx * 0.09);
              gain.gain.linearRampToValueAtTime(0.001, t + idx * 0.09 + (idx === 5 ? 0.6 : 0.18));
              osc.connect(gain); gain.connect(this.ctx.destination);
              osc.start(t + idx * 0.09); osc.stop(t + idx * 0.09 + (idx === 5 ? 0.65 : 0.2));
            });
          }
        } catch(e) {}
      }
    };

    function toggleSound() {
      const on = AUDIO.toggle();
      const btn = document.getElementById('btn-sound-toggle');
      if (btn) btn.textContent = on ? '🔊' : '🔇';
      if (typeof showToast === 'function') {
        showToast(on ? '🔊 音效已开启' : '🔇 音效已静音');
      }
      return on;
    }


if (typeof window !== 'undefined') {
  window.AUDIO = AUDIO;
}
