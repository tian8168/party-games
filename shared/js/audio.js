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
          } else if (type === 'drop') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, t);
            osc.frequency.exponentialRampToValueAtTime(110, t + 0.09);
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.09);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(t); osc.stop(t + 0.09);
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
          }
        } catch(e) {}
      }
    };

    function toggleSound() {
      const on = AUDIO.toggle();
      document.getElementById('btn-sound-toggle').textContent = on ? '🔊' : '🔇';
      showToast(on ? '🔊 音效已开启' : '🔇 音效已静音');
    }

    