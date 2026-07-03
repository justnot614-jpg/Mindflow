// MindFlow Playroom Games Controller
class PlayroomManager {
  constructor() {
    this.activeGame = null;
    this.reducedMotion = false;

    // Game 1: Zen Bubbles
    this.bubbles = {
      canvas: document.getElementById('bubbles-canvas'),
      ctx: null,
      list: [],
      particles: [],
      maxBubbles: 12,
      isActive: false,
      animId: null
    };

    // Game 2: Kinetic Mandala
    this.mandala = {
      canvas: document.getElementById('mandala-canvas'),
      ctx: null,
      lines: [],
      currentColor: '#8cd6ff',
      isDrawing: false,
      lastX: 0,
      lastY: 0,
      isActive: false,
      animId: null
    };

    // Game 3: Cosmic Connect
    this.connect = {
      canvas: document.getElementById('connect-canvas'),
      ctx: null,
      stars: [],
      lines: [],
      selectedStar: null,
      mousePos: { x: 0, y: 0 },
      isActive: false,
      animId: null
    };

    // Pentatonic scale frequencies for audio responses
    this.pentatonicNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

    this.init();
  }

  init() {
    if (this.bubbles.canvas) this.bubbles.ctx = this.bubbles.canvas.getContext('2d');
    if (this.mandala.canvas) this.mandala.ctx = this.mandala.canvas.getContext('2d');
    if (this.connect.canvas) this.connect.ctx = this.connect.canvas.getContext('2d');

    // Attach Mandala listeners
    if (this.mandala.canvas) {
      this.mandala.canvas.addEventListener('mousedown', this.startMandalaDraw.bind(this));
      this.mandala.canvas.addEventListener('mousemove', this.drawMandala.bind(this));
      this.mandala.canvas.addEventListener('mouseup', this.stopMandalaDraw.bind(this));
      this.mandala.canvas.addEventListener('mouseleave', this.stopMandalaDraw.bind(this));
      
      // Touch support
      this.mandala.canvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const rect = this.mandala.canvas.getBoundingClientRect();
        this.startMandalaDraw({
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      }, { passive: true });

      this.mandala.canvas.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        this.drawMandala({
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      }, { passive: true });

      this.mandala.canvas.addEventListener('touchend', this.stopMandalaDraw.bind(this));
    }

    // Attach Connect listeners
    if (this.connect.canvas) {
      this.connect.canvas.addEventListener('mousedown', this.onConnectMouseDown.bind(this));
      this.connect.canvas.addEventListener('mousemove', this.onConnectMouseMove.bind(this));
      
      this.connect.canvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const rect = this.connect.canvas.getBoundingClientRect();
        this.onConnectMouseDown({
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      }, { passive: true });

      this.connect.canvas.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        this.onConnectMouseMove({
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      }, { passive: true });
    }

    // Attach Bubble hover/tap listeners
    if (this.bubbles.canvas) {
      this.bubbles.canvas.addEventListener('mousemove', this.checkBubblePop.bind(this));
      this.bubbles.canvas.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const rect = this.bubbles.canvas.getBoundingClientRect();
        this.checkBubblePop({
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      }, { passive: true });
    }
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
  }

  // Play chimes in pentatonic scale
  playChimeTone(noteIdx) {
    if (!window.audioEngine || !window.audioEngine.ctx || window.audioEngine.isMuted) return;

    const ctx = window.audioEngine.ctx;
    const now = ctx.currentTime;
    
    const freq = this.pentatonicNotes[noteIdx % this.pentatonicNotes.length];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Warm decay envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(window.audioEngine.gains.master);

    osc.start(now);
    osc.stop(now + 1.3);
  }

  // Switch between games
  switchGame(gameName) {
    // Stop any active games
    this.stopAll();

    this.activeGame = gameName;
    
    if (gameName === 'bubbles') {
      this.startBubbles();
    } else if (gameName === 'mandala') {
      this.startMandala();
    } else if (gameName === 'connect') {
      this.startConnect();
    }
  }

  stopAll() {
    this.bubbles.isActive = false;
    if (this.bubbles.animId) cancelAnimationFrame(this.bubbles.animId);
    
    this.mandala.isActive = false;
    if (this.mandala.animId) cancelAnimationFrame(this.mandala.animId);
    
    this.connect.isActive = false;
    if (this.connect.animId) cancelAnimationFrame(this.connect.animId);

    this.activeGame = null;
  }

  // ==========================================
  // GAME 1: ZEN BUBBLES
  // ==========================================
  startBubbles() {
    this.bubbles.isActive = true;
    this.bubbles.list = [];
    this.bubbles.particles = [];
    
    // Seed initial bubbles
    for (let i = 0; i < this.bubbles.maxBubbles; i++) {
      this.bubbles.list.push(this.createBubble(true));
    }
    
    this.tickBubbles();
  }

  createBubble(randomY = false) {
    return {
      x: Math.random() * this.bubbles.canvas.width,
      y: randomY ? Math.random() * this.bubbles.canvas.height : this.bubbles.canvas.height + 30,
      vy: 0.3 + Math.random() * 0.6,
      radius: 15 + Math.random() * 20,
      color: Math.random() > 0.5 ? 'rgba(140, 214, 255, 0.4)' : 'rgba(167, 139, 250, 0.4)',
      note: Math.floor(Math.random() * this.pentatonicNotes.length),
      wobbleSpeed: 0.01 + Math.random() * 0.02,
      wobbleVal: Math.random() * Math.PI,
      pulse: 0
    };
  }

  checkBubblePop(e) {
    if (!this.bubbles.isActive) return;
    const rect = this.bubbles.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    this.bubbles.list.forEach((b, idx) => {
      const dx = mx - b.x;
      const dy = my - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < b.radius) {
        // Pop bubble!
        this.triggerBubblePopEffect(b);
        this.playChimeTone(b.note);
        this.bubbles.list[idx] = this.createBubble(false); // replace at bottom
      }
    });
  }

  triggerBubblePopEffect(b) {
    // spawn burst particles
    const count = 10 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.0;
      this.bubbles.particles.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        alpha: 1.0,
        color: b.color
      });
    }
  }

  tickBubbles() {
    if (!this.bubbles.isActive) return;

    this.updateBubbles();
    this.drawBubbles();
    
    this.bubbles.animId = requestAnimationFrame(() => this.tickBubbles());
  }

  updateBubbles() {
    // Move bubbles up
    this.bubbles.list.forEach(b => {
      b.y -= b.vy;
      b.wobbleVal += b.wobbleSpeed;
      // Side wobble
      b.x += Math.sin(b.wobbleVal) * 0.25;

      // Wrap top
      if (b.y < -40) {
        b.y = this.bubbles.canvas.height + 40;
        b.x = Math.random() * this.bubbles.canvas.width;
      }
    });

    // Move burst particles
    this.bubbles.particles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.02;

      if (p.alpha <= 0) {
        this.bubbles.particles.splice(idx, 1);
      }
    });
  }

  drawBubbles() {
    const ctx = this.bubbles.ctx;
    ctx.clearRect(0, 0, this.bubbles.canvas.width, this.bubbles.canvas.height);

    // Draw active bubbles
    this.bubbles.list.forEach(b => {
      ctx.save();
      ctx.globalAlpha = 0.8;
      
      // Outer rim
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Highlight reflection shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // Draw burst particles
    this.bubbles.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ==========================================
  // GAME 2: KINETIC MANDALA
  // ==========================================
  startMandala() {
    this.mandala.isActive = true;
    this.mandala.lines = [];
    this.clearMandalaCanvas();
    this.tickMandala();
  }

  clearMandalaCanvas() {
    const ctx = this.mandala.ctx;
    ctx.clearRect(0, 0, this.mandala.canvas.width, this.mandala.canvas.height);
  }

  startMandalaDraw(e) {
    this.mandala.isDrawing = true;
    const rect = this.mandala.canvas.getBoundingClientRect();
    this.mandala.lastX = e.clientX - rect.left;
    this.mandala.lastY = e.clientY - rect.top;
    
    // Play a starter note
    this.playChimeTone(Math.floor(Math.random() * this.pentatonicNotes.length));
  }

  drawMandala(e) {
    if (!this.mandala.isDrawing) return;
    const rect = this.mandala.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const cx = this.mandala.canvas.width / 2;
    const cy = this.mandala.canvas.height / 2;

    // Convert last and current mouse coordinates relative to center
    const x1 = this.mandala.lastX - cx;
    const y1 = this.mandala.lastY - cy;
    const x2 = mx - cx;
    const y2 = my - cy;

    // We store the line segments with full color, timestamp, and brush thickness
    this.mandala.lines.push({
      x1, y1, x2, y2,
      color: this.mandala.currentColor,
      alpha: 1.0,
      width: 2.5
    });

    this.mandala.lastX = mx;
    this.mandala.lastY = my;
  }

  stopMandalaDraw() {
    this.mandala.isDrawing = false;
  }

  changeMandalaColor(color) {
    this.mandala.currentColor = color;
  }

  tickMandala() {
    if (!this.mandala.isActive) return;

    this.updateMandala();
    this.drawMandalaScene();
    
    this.mandala.animId = requestAnimationFrame(() => this.tickMandala());
  }

  updateMandala() {
    // Fade out lines over time (digital kinetic sand)
    this.mandala.lines.forEach((line, idx) => {
      line.alpha -= 0.0035; // disappear after ~5 seconds
      if (line.alpha <= 0) {
        this.mandala.lines.splice(idx, 1);
      }
    });
  }

  drawMandalaScene() {
    const ctx = this.mandala.ctx;
    const cx = this.mandala.canvas.width / 2;
    const cy = this.mandala.canvas.height / 2;

    ctx.clearRect(0, 0, this.mandala.canvas.width, this.mandala.canvas.height);

    // Draw center indicator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();

    // 8-fold radial symmetry mirror
    const symmetry = 8;

    this.mandala.lines.forEach(line => {
      ctx.save();
      ctx.lineWidth = line.width;
      ctx.lineCap = 'round';
      ctx.strokeStyle = line.color;
      ctx.globalAlpha = line.alpha;
      
      if (!this.reducedMotion) {
        ctx.shadowBlur = 4;
        ctx.shadowColor = line.color;
      }

      for (let i = 0; i < symmetry; i++) {
        ctx.beginPath();
        
        // Rotate angle
        const angle = (i * 2 * Math.PI) / symmetry;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // First point rotated
        const rx1 = line.x1 * cosA - line.y1 * sinA;
        const ry1 = line.x1 * sinA + line.y1 * cosA;

        // Second point rotated
        const rx2 = line.x2 * cosA - line.y2 * sinA;
        const ry2 = line.x2 * sinA + line.y2 * cosA;

        ctx.moveTo(cx + rx1, cy + ry1);
        ctx.lineTo(cx + rx2, cy + ry2);
        ctx.stroke();

        // Mirrored reflect segment
        ctx.beginPath();
        const mrx1 = line.x1 * cosA - (-line.y1) * sinA;
        const mry1 = line.x1 * sinA + (-line.y1) * cosA;
        const mrx2 = line.x2 * cosA - (-line.y2) * sinA;
        const mry2 = line.x2 * sinA + (-line.y2) * cosA;

        ctx.moveTo(cx + mrx1, cy + mry1);
        ctx.lineTo(cx + mrx2, cy + mry2);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  // ==========================================
  // GAME 3: COSMIC CONNECT
  // ==========================================
  startConnect() {
    this.connect.isActive = true;
    this.connect.lines = [];
    this.connect.selectedStar = null;
    
    // Spawn static stars
    this.connect.stars = [];
    const starCount = 35;
    for (let i = 0; i < starCount; i++) {
      this.connect.stars.push({
        id: i,
        x: 40 + Math.random() * (this.connect.canvas.width - 80),
        y: 40 + Math.random() * (this.connect.canvas.height - 80),
        radius: 3 + Math.random() * 3.5,
        pulseVal: Math.random() * Math.PI,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        note: Math.floor(Math.random() * this.pentatonicNotes.length)
      });
    }

    this.tickConnect();
  }

  onConnectMouseDown(e) {
    if (!this.connect.isActive) return;
    const rect = this.connect.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check if clicked near a star
    let clickedStar = null;
    this.connect.stars.forEach(s => {
      const dx = mx - s.x;
      const dy = my - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 20) { // proximity click
        clickedStar = s;
      }
    });

    if (clickedStar) {
      if (this.connect.selectedStar === null) {
        this.connect.selectedStar = clickedStar;
        this.playChimeTone(clickedStar.note);
      } else {
        // Connect them if they are not already connected
        if (this.connect.selectedStar.id !== clickedStar.id) {
          const lineExists = this.connect.lines.some(l => 
            (l.s1.id === this.connect.selectedStar.id && l.s2.id === clickedStar.id) ||
            (l.s1.id === clickedStar.id && l.s2.id === this.connect.selectedStar.id)
          );

          if (!lineExists) {
            this.connect.lines.push({
              s1: this.connect.selectedStar,
              s2: clickedStar,
              alpha: 0
            });
            this.playChimeTone(clickedStar.note);
          }
        }
        this.connect.selectedStar = null; // reset
      }
    } else {
      this.connect.selectedStar = null; // reset if clicked empty space
    }
  }

  onConnectMouseMove(e) {
    if (!this.connect.isActive) return;
    const rect = this.connect.canvas.getBoundingClientRect();
    this.connect.mousePos.x = e.clientX - rect.left;
    this.connect.mousePos.y = e.clientY - rect.top;
  }

  clearConstellations() {
    this.connect.lines = [];
  }

  tickConnect() {
    if (!this.connect.isActive) return;

    this.updateConnect();
    this.drawConnectScene();

    this.connect.animId = requestAnimationFrame(() => this.tickConnect());
  }

  updateConnect() {
    // pulse stars
    this.connect.stars.forEach(s => {
      s.pulseVal += s.pulseSpeed;
    });

    // Fade in lines
    this.connect.lines.forEach(l => {
      if (l.alpha < 0.8) l.alpha += 0.05;
    });
  }

  drawConnectScene() {
    const ctx = this.connect.ctx;
    ctx.clearRect(0, 0, this.connect.canvas.width, this.connect.canvas.height);

    // Draw connected lines
    this.connect.lines.forEach(l => {
      ctx.save();
      ctx.strokeStyle = 'rgba(133, 215, 255, 0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#85d7ff';
      ctx.globalAlpha = l.alpha;
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      ctx.moveTo(l.s1.x, l.s1.y);
      ctx.lineTo(l.s2.x, l.s2.y);
      ctx.stroke();
      ctx.restore();
    });

    // Draw active drawing line
    if (this.connect.selectedStar) {
      ctx.save();
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.connect.selectedStar.x, this.connect.selectedStar.y);
      ctx.lineTo(this.connect.mousePos.x, this.connect.mousePos.y);
      ctx.stroke();
      ctx.restore();
    }

    // Draw stars
    this.connect.stars.forEach(s => {
      ctx.save();
      const alpha = 0.3 + Math.abs(Math.sin(s.pulseVal)) * 0.7;
      ctx.globalAlpha = alpha;
      
      const isSelected = this.connect.selectedStar && this.connect.selectedStar.id === s.id;
      ctx.fillStyle = isSelected ? '#a78bfa' : '#ffffff';
      
      if (!this.reducedMotion) {
        ctx.shadowBlur = isSelected ? 12 : 6;
        ctx.shadowColor = isSelected ? '#a78bfa' : '#ffffff';
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + (isSelected ? 2 : 0), 0, Math.PI * 2);
      ctx.fill();

      // Draw subtle label ring if selected
      if (isSelected) {
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });
  }
}

// Instantiate globally
window.playroomManager = new PlayroomManager();
