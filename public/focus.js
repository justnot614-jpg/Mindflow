class FocusGardenController {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.isActive = false;
    this.startTime = 0;
    this.elapsedTime = 0; // ms

    // Game stats
    this.calmScore = 50; // starting midway
    this.targetCalmScore = 50;
    this.peakCalmScore = 0;

    // Spirit Guide particle settings
    this.target = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      vx: 0,
      vy: 0,
      radius: 10,
      angle: Math.random() * Math.PI * 2,
      speed: 1.2
    };

    // Tracking trail
    this.trail = [];
    this.maxTrailLength = 25;

    // Secondary blooming particles
    this.flowerParticles = [];
    
    // User Cursor Tracking
    this.cursor = { x: 0, y: 0, lastX: 0, lastY: 0, speed: 0 };
    this.isNearTarget = false;
    this.nearRadius = 70; // zone of tracking

    // Speed penalty thresholds
    this.speedThreshold = 18; // px/frame limit
    this.penaltyActive = false;
    this.penaltyDuration = 0; // cooldown

    this.animationId = null;
    this.timerInterval = null;

    // Event hooks
    this.onCalmUpdate = null;
    this.onTimerUpdate = null;
    this.onComplete = null;

    // Event listeners bound for easy removal
    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleTouchMove = this.onTouchMove.bind(this);
    this.handleMouseDown = this.onMouseDown.bind(this);

    this.reducedMotion = false;
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.startTime = Date.now();
    this.elapsedTime = 0;
    this.calmScore = 50;
    this.targetCalmScore = 50;
    this.peakCalmScore = 50;
    this.flowerParticles = [];
    this.trail = [];

    // Spawn target randomly in center area
    this.target.x = this.canvas.width / 2;
    this.target.y = this.canvas.height / 2;
    this.target.vx = Math.cos(this.target.angle) * this.target.speed;
    this.target.vy = Math.sin(this.target.angle) * this.target.speed;

    // Attach inputs
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    this.canvas.addEventListener('mousedown', this.handleMouseDown);

    // Initialize cursor positions to avoid jump glitches
    this.cursor.x = this.canvas.width / 2;
    this.cursor.y = this.canvas.height / 2;
    this.cursor.lastX = this.cursor.x;
    this.cursor.lastY = this.cursor.y;

    // Start Loops
    this.tick();
    this.timerInterval = setInterval(() => {
      this.elapsedTime = Date.now() - this.startTime;
      if (this.onTimerUpdate) {
        this.onTimerUpdate(this.elapsedTime);
      }
    }, 1000);
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;

    // Remove inputs
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);

    clearInterval(this.timerInterval);
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.onComplete) {
      this.onComplete({
        duration: Math.round(this.elapsedTime / 1000),
        calmScore: Math.round(this.peakCalmScore)
      });
    }

    this.clearCanvas();
    this.drawStatic();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawStatic() {
    this.clearCanvas();
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = 'var(--text-muted)';
    this.ctx.font = '14px Outfit, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText("Press Start to begin tracking the spirit guide", cx, cy + 8);
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.cursor.x = e.clientX - rect.left;
    this.cursor.y = e.clientY - rect.top;
  }

  onTouchMove(e) {
    if (e.touches.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    this.cursor.x = e.touches[0].clientX - rect.left;
    this.cursor.y = e.touches[0].clientY - rect.top;
  }

  onMouseDown() {
    // Penalize rapid tapping (which breaks meditative focus)
    this.targetCalmScore = Math.max(0, this.targetCalmScore - 12);
    this.triggerFlowerBlooms(6, 'red'); // release warning red particles
    this.penaltyActive = true;
    this.penaltyDuration = 20; // frame penalty
  }

  tick() {
    if (!this.isActive) return;

    this.updateLogic();
    this.clearCanvas();
    this.drawScene();

    this.animationId = requestAnimationFrame(() => this.tick());
  }

  updateLogic() {
    // 1. Calculate cursor speed and verify movement smoothness
    const dx = this.cursor.x - this.cursor.lastX;
    const dy = this.cursor.y - this.cursor.lastY;
    this.cursor.speed = Math.sqrt(dx * dx + dy * dy);

    this.cursor.lastX = this.cursor.x;
    this.cursor.lastY = this.cursor.y;

    if (this.cursor.speed > this.speedThreshold) {
      this.targetCalmScore = Math.max(0, this.targetCalmScore - 1.5);
      this.penaltyActive = true;
      this.penaltyDuration = 15;
    }

    if (this.penaltyDuration > 0) {
      this.penaltyDuration--;
      if (this.penaltyDuration === 0) this.penaltyActive = false;
    }

    // 2. Guide Particle Drift (Smooth random walks)
    // Add tiny random velocity adjustments
    this.target.vx += (Math.random() - 0.5) * 0.25;
    this.target.vy += (Math.random() - 0.5) * 0.25;

    // Cap velocity
    const speed = Math.sqrt(this.target.vx * this.target.vx + this.target.vy * this.target.vy);
    if (speed > this.target.speed) {
      this.target.vx = (this.target.vx / speed) * this.target.speed;
      this.target.vy = (this.target.vy / speed) * this.target.speed;
    }

    this.target.x += this.target.vx;
    this.target.y += this.target.vy;

    // Edge bouncing
    const pad = 40;
    if (this.target.x < pad) { this.target.x = pad; this.target.vx *= -1; }
    if (this.target.x > this.canvas.width - pad) { this.target.x = this.canvas.width - pad; this.target.vx *= -1; }
    if (this.target.y < pad) { this.target.y = pad; this.target.vy *= -1; }
    if (this.target.y > this.canvas.height - pad) { this.target.y = this.canvas.height - pad; this.target.vy *= -1; }

    // Add to trail
    this.trail.push({ x: this.target.x, y: this.target.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }

    // 3. Distance calculation between cursor & target
    const distToTarget = Math.sqrt(
      (this.cursor.x - this.target.x) * (this.cursor.x - this.target.x) + 
      (this.cursor.y - this.target.y) * (this.cursor.y - this.target.y)
    );

    this.isNearTarget = distToTarget < this.nearRadius;

    // Adjust Calm target
    if (this.isNearTarget && !this.penaltyActive) {
      // smooth gains
      this.targetCalmScore = Math.min(100, this.targetCalmScore + 0.15);
      
      // Release beautiful glowing garden flower particles occasionally
      if (Math.random() > 0.88) {
        this.triggerFlowerBlooms(1);
      }
    } else {
      // decay calm score if they drift away
      this.targetCalmScore = Math.max(0, this.targetCalmScore - 0.08);
    }

    // Interpolate Calm Score smoothly
    this.calmScore += (this.targetCalmScore - this.calmScore) * 0.05;
    this.peakCalmScore = Math.max(this.peakCalmScore, this.calmScore);

    if (this.onCalmUpdate) {
      this.onCalmUpdate(this.calmScore);
    }

    // 4. Update secondary particles
    this.flowerParticles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0.01; // slight gravity drift
      p.alpha -= 0.008;
      
      if (p.alpha <= 0) {
        this.flowerParticles.splice(idx, 1);
      }
    });
  }

  triggerFlowerBlooms(count, type = 'zen') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.2;
      this.flowerParticles.push({
        x: this.target.x,
        y: this.target.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5, // float slightly upward
        size: 2 + Math.random() * 4,
        alpha: 1.0,
        color: type === 'red' ? '#f87171' : (Math.random() > 0.5 ? '#8cd6ff' : '#34d399')
      });
    }
  }

  drawScene() {
    // 1. Draw glowing ribbon trail of the guide
    if (this.trail.length > 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        this.ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      this.ctx.strokeStyle = this.penaltyActive ? 'rgba(248, 113, 113, 0.25)' : 'rgba(140, 214, 255, 0.25)';
      this.ctx.lineWidth = 4;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.stroke();
    }

    // 2. Draw blooming flower particles
    this.flowerParticles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      if (!this.reducedMotion) {
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = p.color;
      }
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 3. Draw Spirit Guide Target Particle
    this.ctx.save();
    const grad = this.ctx.createRadialGradient(
      this.target.x, this.target.y, 0,
      this.target.x, this.target.y, this.target.radius + 10
    );
    
    if (this.penaltyActive) {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, 'rgba(248, 113, 113, 0.6)');
      grad.addColorStop(1, 'rgba(248, 113, 113, 0)');
    } else if (this.isNearTarget) {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, 'rgba(52, 211, 153, 0.7)');
      grad.addColorStop(1, 'rgba(52, 211, 153, 0)');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, 'rgba(140, 214, 255, 0.6)');
      grad.addColorStop(1, 'rgba(140, 214, 255, 0)');
    }

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(this.target.x, this.target.y, this.target.radius + 10, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // 4. Draw User Tracking Zone Aura around cursor
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.cursor.x, this.cursor.y, this.nearRadius, 0, Math.PI * 2);
    if (this.penaltyActive) {
      this.ctx.strokeStyle = 'rgba(248, 113, 113, 0.3)';
      this.ctx.lineWidth = 2.5;
    } else if (this.isNearTarget) {
      this.ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
      this.ctx.lineWidth = 1.5;
    } else {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      this.ctx.lineWidth = 1;
    }
    this.ctx.stroke();
    this.ctx.restore();
  }
}
window.FocusGardenController = FocusGardenController;
