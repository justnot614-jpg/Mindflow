class BreathingController {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.isActive = false;
    this.mode = 'relax'; // 'relax', 'box', 'deep'
    this.currentCycle = 0;
    this.cycleStartTime = 0;
    
    // Breathing phases: name, duration (s)
    this.patterns = {
      relax: [
        { name: 'Inhale', duration: 4, type: 'in' },
        { name: 'Hold', duration: 4, type: 'hold' },
        { name: 'Exhale', duration: 6, type: 'out' }
      ],
      box: [
        { name: 'Inhale', duration: 4, type: 'in' },
        { name: 'Hold', duration: 4, type: 'hold' },
        { name: 'Exhale', duration: 4, type: 'out' },
        { name: 'Hold', duration: 4, type: 'hold' }
      ],
      deep: [
        { name: 'Inhale', duration: 4, type: 'in' },
        { name: 'Hold', duration: 7, type: 'hold' },
        { name: 'Exhale', duration: 8, type: 'out' }
      ]
    };

    // Configuration
    this.minRadius = 50;
    this.maxRadius = 140;
    this.currentRadius = 50;
    this.targetRadius = 50;
    
    // Breathing particles
    this.particles = [];
    this.particleCount = 45;
    
    // Animation request ID
    this.animationId = null;

    // Callbacks
    this.onCycleComplete = null;
    this.onPhaseChange = null;

    // Accessibility flags
    this.reducedMotion = false;
  }

  setMode(mode) {
    if (this.patterns[mode]) {
      this.mode = mode;
      this.reset();
    }
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.currentCycle = 0;
    this.cycleStartTime = Date.now();
    this.initParticles();
    this.tick();
  }

  stop() {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.reset();
  }

  reset() {
    this.currentRadius = this.minRadius;
    this.targetRadius = this.minRadius;
    this.particles = [];
    this.clearCanvas();
    this.drawStatic();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle(fromOrb = false) {
    const angle = Math.random() * Math.PI * 2;
    // If from orb (exhale), spawn at orb edge. Otherwise spawn far away.
    const dist = fromOrb 
      ? this.currentRadius + Math.random() * 10
      : 180 + Math.random() * 80;
      
    return {
      x: this.canvas.width / 2 + Math.cos(angle) * dist,
      y: this.canvas.height / 2 + Math.sin(angle) * dist,
      angle: angle,
      speed: 0.4 + Math.random() * 0.8,
      size: 1 + Math.random() * 3,
      alpha: 0.1 + Math.random() * 0.6,
      color: Math.random() > 0.4 ? 'var(--primary)' : 'var(--secondary)'
    };
  }

  drawStatic() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    // Draw reference circle
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.minRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Draw central placeholder orb
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, this.minRadius);
    grad.addColorStop(0, 'rgba(140, 214, 255, 0.1)');
    grad.addColorStop(1, 'rgba(140, 214, 255, 0.3)');
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.minRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // Text
    this.ctx.fillStyle = 'var(--text-muted)';
    this.ctx.font = '14px Outfit, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText("Breathe", cx, cy + 5);
  }

  tick() {
    if (!this.isActive) return;

    this.clearCanvas();
    this.updateBreathing();
    this.updateParticles();
    this.drawScene();

    this.animationId = requestAnimationFrame(() => this.tick());
  }

  updateBreathing() {
    const pattern = this.patterns[this.mode];
    const totalDuration = pattern.reduce((sum, p) => sum + p.duration, 0) * 1000;
    
    const elapsed = (Date.now() - this.cycleStartTime) % totalDuration;
    
    // Calculate phase index
    let accumTime = 0;
    let currentPhase = null;
    let phaseProgress = 0; // 0 to 1.0 within phase

    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i];
      const durationMs = p.duration * 1000;
      if (elapsed >= accumTime && elapsed < accumTime + durationMs) {
        currentPhase = p;
        phaseProgress = (elapsed - accumTime) / durationMs;
        break;
      }
      accumTime += durationMs;
    }

    if (!currentPhase) {
      currentPhase = pattern[pattern.length - 1];
      phaseProgress = 1.0;
    }

    // Trigger cycle completion hook on rollover
    const cycleNum = Math.floor((Date.now() - this.cycleStartTime) / totalDuration);
    if (cycleNum > this.currentCycle) {
      this.currentCycle = cycleNum;
      if (this.onCycleComplete) {
        this.onCycleComplete(this.currentCycle);
      }
    }

    // Save current state details on controller
    this.phaseName = currentPhase.name;
    this.phaseType = currentPhase.type;
    this.phaseProgress = phaseProgress;
    this.phaseDuration = currentPhase.duration;

    // Target radius calculation
    if (this.reducedMotion) {
      // Accessibilty: keep size stable, just oscillate brightness
      this.targetRadius = 90;
    } else {
      if (currentPhase.type === 'in') {
        // Ease in
        this.targetRadius = this.minRadius + (this.maxRadius - this.minRadius) * this.easeOutQuad(phaseProgress);
      } else if (currentPhase.type === 'out') {
        // Ease out
        this.targetRadius = this.maxRadius - (this.maxRadius - this.minRadius) * this.easeInQuad(phaseProgress);
      } else {
        // Hold size, add a minor heartbeat pulse
        const pulse = Math.sin(phaseProgress * Math.PI) * 5;
        this.targetRadius = (currentPhase.name === 'Hold' && pattern[0].type === 'in' && elapsed < totalDuration/2)
          ? this.maxRadius + pulse 
          : this.minRadius + pulse;
      }
    }

    // Interpolate current radius towards target
    this.currentRadius += (this.targetRadius - this.currentRadius) * 0.08;
  }

  // Easing helpers
  easeOutQuad(x) {
    return 1 - (1 - x) * (1 - x);
  }
  easeInQuad(x) {
    return x * x;
  }

  updateParticles() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.particles.forEach((p, idx) => {
      if (this.phaseType === 'in') {
        // Particles move inwards (drawn to center)
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.currentRadius) {
          // Recycle
          this.particles[idx] = this.createParticle(false);
        } else {
          p.x += (dx / dist) * p.speed * 1.5;
          p.y += (dy / dist) * p.speed * 1.5;
          p.alpha = Math.min(0.8, (dist - this.currentRadius) / 100);
        }
      } else if (this.phaseType === 'out') {
        // Particles shoot outwards (exhaled energy)
        p.x += Math.cos(p.angle) * p.speed * 2.0;
        p.y += Math.sin(p.angle) * p.speed * 2.0;
        
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        p.alpha = Math.max(0, 1 - (dist - this.currentRadius) / 120);

        if (dist > 280 || p.alpha <= 0) {
          this.particles[idx] = this.createParticle(true);
        }
      } else {
        // Hold phase: float gently in orbit around the orb
        p.angle += 0.005 * p.speed;
        const orbitRadius = this.currentRadius + 30 + Math.sin(p.speed + Date.now()/1000) * 15;
        p.x = cx + Math.cos(p.angle) * orbitRadius;
        p.y = cy + Math.sin(p.angle) * orbitRadius;
        p.alpha = 0.4;
      }
    });
  }

  drawScene() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    // Draw reference guides
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.maxRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.minRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.stroke();

    // Draw particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color === 'var(--primary)' ? '#8cd6ff' : '#a78bfa';
      this.ctx.shadowBlur = 4;
      this.ctx.shadowColor = this.ctx.fillStyle;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // Draw outer timing progress indicator ring
    const timerProgress = this.phaseProgress || 0;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.currentRadius + 8, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * timerProgress));
    this.ctx.strokeStyle = 'rgba(140, 214, 255, 0.4)';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();

    // Draw main glowing breathing orb
    this.ctx.save();
    
    // Pulsing aura shadow (skip if reduced motion enabled)
    if (!this.reducedMotion) {
      const glowAmt = 15 + Math.sin(Date.now() / 350) * 8;
      this.ctx.shadowBlur = glowAmt;
      this.ctx.shadowColor = this.phaseType === 'in' 
        ? '#8cd6ff' 
        : (this.phaseType === 'out' ? '#a78bfa' : '#34d399');
    }
    
    const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, this.currentRadius);
    if (this.phaseType === 'in') {
      grad.addColorStop(0, 'rgba(140, 214, 255, 0.25)');
      grad.addColorStop(0.7, 'rgba(140, 214, 255, 0.4)');
      grad.addColorStop(1, 'rgba(140, 214, 255, 0.7)');
    } else if (this.phaseType === 'out') {
      grad.addColorStop(0, 'rgba(167, 139, 250, 0.2)');
      grad.addColorStop(0.7, 'rgba(167, 139, 250, 0.35)');
      grad.addColorStop(1, 'rgba(167, 139, 250, 0.65)');
    } else {
      // hold
      grad.addColorStop(0, 'rgba(52, 211, 153, 0.2)');
      grad.addColorStop(0.7, 'rgba(52, 211, 153, 0.35)');
      grad.addColorStop(1, 'rgba(52, 211, 153, 0.65)');
    }

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.currentRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = grad;
    this.ctx.fill();
    this.ctx.restore();

    // Phase instruction texts overlay inside the orb
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowBlur = 0;
    this.ctx.font = 'bold 20px Outfit, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.phaseName || "Start", cx, cy - 2);

    // Timing count text inside
    const remainingSecs = Math.max(0, Math.ceil(this.phaseDuration * (1 - timerProgress)));
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.font = '500 13px Outfit, sans-serif';
    this.ctx.fillText(remainingSecs + "s", cx, cy + 20);
  }
}
window.BreathingController = BreathingController;
