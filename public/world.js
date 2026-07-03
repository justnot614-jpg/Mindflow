class FloatingWorldController {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.calmScore = 30; // 0 to 100, determines growth
    this.environment = 'aurora'; // 'aurora', 'forest', 'ocean'
    
    // Aurora parameters
    this.auroraWave = 0;
    
    // Background clouds
    this.clouds = [
      { x: 100, y: 150, size: 60, speed: 0.15 },
      { x: 400, y: 120, size: 80, speed: 0.1 },
      { x: 800, y: 180, size: 50, speed: 0.2 }
    ];

    // Fireflies / Light motes (restoration life)
    this.fireflies = [];
    this.maxFireflies = 30;

    // Waterfall scroll offset
    this.waterOffset = 0;

    this.animationId = null;
    this.reducedMotion = false;
    
    // Resize handler
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Initialize fireflies
    this.initFireflies();
  }

  setCalmScore(score) {
    this.calmScore = Math.max(0, Math.min(100, score));
  }

  setEnvironment(env) {
    this.environment = env;
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.initFireflies();
  }

  initFireflies() {
    this.fireflies = [];
    const count = Math.min(this.maxFireflies, Math.floor(this.calmScore / 3));
    for (let i = 0; i < count; i++) {
      this.fireflies.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulseVal: Math.random() * Math.PI,
        color: this.environment === 'forest' ? '#6beb8c' : '#85d7ff'
      });
    }
  }

  start() {
    this.tick();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  tick() {
    this.updateLogic();
    this.drawScene();
    this.animationId = requestAnimationFrame(() => this.tick());
  }

  updateLogic() {
    // 1. Scrolling elements
    if (!this.reducedMotion) {
      this.auroraWave += 0.002;
      this.waterOffset += 1.8;
      
      // Update clouds
      this.clouds.forEach(c => {
        c.x += c.speed;
        if (c.x > this.canvas.width + 120) {
          c.x = -120;
          c.y = 80 + Math.random() * 120;
        }
      });
    }

    // Adjust fireflies dynamically based on calm score
    const targetCount = Math.floor(this.calmScore / 3);
    if (this.fireflies.length < targetCount) {
      // Spawn new one near the island center
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      this.fireflies.push({
        x: cx + (Math.random() - 0.5) * 200,
        y: cy + (Math.random() - 0.5) * 150,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 2.5,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulseVal: Math.random() * Math.PI,
        color: this.environment === 'forest' ? '#a7f3d0' : '#c084fc'
      });
    } else if (this.fireflies.length > targetCount) {
      this.fireflies.pop();
    }

    // Move fireflies
    this.fireflies.forEach(f => {
      f.x += f.vx;
      f.y += f.vy;
      f.pulseVal += f.pulseSpeed;

      // Wrap boundaries
      if (f.x < 0) f.x = this.canvas.width;
      if (f.x > this.canvas.width) f.x = 0;
      if (f.y < 0) f.y = this.canvas.height;
      if (f.y > this.canvas.height) f.y = 0;
    });
  }

  drawScene() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Draw Sky Gradients based on environment
    this.drawSkyBackground();

    // 2. Draw Aurora Waves
    this.drawAuroraWaves();

    // 3. Draw Background Clouds
    this.drawClouds();

    // 4. Draw Floating Island base rock
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2 + 60; // island anchor point
    this.drawIslandBase(cx, cy);

    // 5. Draw Waterfall flowing down
    this.drawWaterfall(cx, cy);

    // 6. Draw Trees & Plants growth
    this.drawPlants(cx, cy);

    // 7. Draw Fireflies
    this.drawFireflies();
  }

  drawSkyBackground() {
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    if (this.environment === 'ocean') {
      // Ocean Sunset
      grad.addColorStop(0, '#100d23');
      grad.addColorStop(0.5, '#2e1c3b');
      grad.addColorStop(1, '#6b2d5c');
    } else if (this.environment === 'forest') {
      // Forest deep twilight
      grad.addColorStop(0, '#040d12');
      grad.addColorStop(0.6, '#092635');
      grad.addColorStop(1, '#1b4242');
    } else {
      // Cosmic Aurora
      grad.addColorStop(0, '#060814');
      grad.addColorStop(0.5, '#0c1126');
      grad.addColorStop(1, '#1b1429');
    }
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawAuroraWaves() {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    
    // Choose colors based on active environment
    let color1, color2;
    if (this.environment === 'ocean') {
      color1 = 'rgba(251, 146, 60, 0.08)'; // orange
      color2 = 'rgba(167, 139, 250, 0.06)'; // purple
    } else if (this.environment === 'forest') {
      color1 = 'rgba(52, 211, 153, 0.08)'; // green
      color2 = 'rgba(250, 204, 21, 0.05)'; // yellow
    } else {
      color1 = 'rgba(140, 214, 255, 0.12)'; // neon cyan
      color2 = 'rgba(167, 139, 250, 0.08)'; // purple
    }

    for (let wave = 0; wave < 2; wave++) {
      const offset = wave * 250;
      this.ctx.beginPath();
      
      const waveHeight = 90;
      const startY = 80 + wave * 50;

      this.ctx.moveTo(0, startY);
      
      const segments = 10;
      for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * this.canvas.width;
        // Compute wave offset with sine curves
        const waveAngle = this.auroraWave + (i * 0.4) + wave * 1.5;
        const y = startY + Math.sin(waveAngle) * waveHeight;
        this.ctx.lineTo(x, y);
      }

      this.ctx.lineTo(this.canvas.width, this.canvas.height);
      this.ctx.lineTo(0, this.canvas.height);
      this.ctx.closePath();

      const auroraGrad = this.ctx.createLinearGradient(0, startY - 100, 0, this.canvas.height);
      auroraGrad.addColorStop(0, 'transparent');
      auroraGrad.addColorStop(0.3, wave === 0 ? color1 : color2);
      auroraGrad.addColorStop(0.7, 'transparent');
      
      this.ctx.fillStyle = auroraGrad;
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawClouds() {
    this.ctx.fillStyle = this.environment === 'ocean' 
      ? 'rgba(107, 45, 92, 0.2)' 
      : 'rgba(255, 255, 255, 0.03)';
      
    this.clouds.forEach(c => {
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
      this.ctx.arc(c.x - c.size * 0.6, c.y + c.size * 0.2, c.size * 0.7, 0, Math.PI * 2);
      this.ctx.arc(c.x + c.size * 0.6, c.y + c.size * 0.2, c.size * 0.7, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawIslandBase(cx, cy) {
    this.ctx.save();
    
    // Main floating rock shape (geometric stylized polygon)
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 160, cy);
    this.ctx.lineTo(cx - 100, cy + 90);
    this.ctx.lineTo(cx, cy + 140); // rock spike
    this.ctx.lineTo(cx + 90, cy + 80);
    this.ctx.lineTo(cx + 150, cy);
    this.ctx.closePath();

    // Dark slate gray rock gradient
    const rockGrad = this.ctx.createLinearGradient(cx, cy, cx, cy + 140);
    rockGrad.addColorStop(0, '#1f2937');
    rockGrad.addColorStop(0.5, '#111827');
    rockGrad.addColorStop(1, '#030712');
    this.ctx.fillStyle = rockGrad;
    this.ctx.fill();
    
    // Draw rock crack details
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 40, cy + 40);
    this.ctx.lineTo(cx, cy + 90);
    this.ctx.lineTo(cx + 20, cy + 120);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw Grass Cap (Upper layer of the island)
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, 160, 45, 0, 0, Math.PI * 2);
    
    // Grass color adjusts from brown/dead to glowing green as calm score increases
    const grassR = Math.floor(15 - (this.calmScore * 0.15));
    const grassG = Math.floor(25 + (this.calmScore * 1.5));
    const grassB = Math.floor(35 + (this.calmScore * 0.5));
    
    const capGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, 160);
    capGrad.addColorStop(0, `rgb(${grassR + 40}, ${grassG + 40}, ${grassB + 40})`);
    capGrad.addColorStop(1, `rgb(${grassR}, ${grassG}, ${grassB})`);
    
    this.ctx.fillStyle = capGrad;
    this.ctx.fill();

    // Glow border around the grass edge
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, 160, 45, 0, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(140, 214, 255, ${this.calmScore / 250})`;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawWaterfall(cx, cy) {
    // Waterfall grows stronger with higher Calm Score
    if (this.calmScore < 20) return; // Dry rock below 20% Calm

    const flowStrength = (this.calmScore - 20) / 80; // 0.0 to 1.0

    this.ctx.save();
    
    // Set viewport clip to mask waterfall starting point
    this.ctx.beginPath();
    // Start falling from center-left of island
    const fallX = cx - 20;
    const fallY = cy + 10;
    const fallWidth = 18 * flowStrength;
    const fallHeight = 160;

    // Drawing waterfall gradient
    const waterGrad = this.ctx.createLinearGradient(fallX, fallY, fallX, fallY + fallHeight);
    waterGrad.addColorStop(0, 'rgba(133, 215, 255, 0.85)');
    waterGrad.addColorStop(0.5, 'rgba(167, 139, 250, 0.6)');
    waterGrad.addColorStop(1, 'rgba(255, 255, 255, 0)'); // fades into space clouds

    this.ctx.fillStyle = waterGrad;

    // Draw base water flow rect
    this.ctx.beginPath();
    this.ctx.rect(fallX, fallY, fallWidth, fallHeight);
    this.ctx.fill();

    // Draw scrolling foam lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([10, 15]);
    this.ctx.lineDashOffset = -this.waterOffset;
    
    this.ctx.beginPath();
    this.ctx.moveTo(fallX + 3, fallY);
    this.ctx.lineTo(fallX + 3, fallY + fallHeight);
    this.ctx.moveTo(fallX + fallWidth - 3, fallY);
    this.ctx.lineTo(fallX + fallWidth - 3, fallY + fallHeight);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // Recursive Branch Tree system which grows tall based on calm level
  drawPlants(cx, cy) {
    const growth = this.calmScore / 100;
    if (growth <= 0.05) return;

    this.ctx.save();
    
    // Draw main tree on center right of the island
    const treeX = cx + 55;
    const treeY = cy - 20;
    
    const maxStages = 5;
    const initialLen = 42 * growth;
    
    this.ctx.strokeStyle = '#271b12'; // dark wood
    this.ctx.lineWidth = 6 * growth;
    this.ctx.lineCap = 'round';
    
    this.drawBranch(treeX, treeY, initialLen, -Math.PI / 2, maxStages, growth);

    this.ctx.restore();
  }

  drawBranch(x, y, len, angle, stage, growth) {
    if (stage === 0) return;

    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    const nextLen = len * 0.76;
    const nextStage = stage - 1;

    // If leaf stage (end of branches), draw beautiful glowing leaves
    if (nextStage === 0 || (nextStage === 1 && Math.random() > 0.8)) {
      this.ctx.save();
      // Leaves and flowers grow in radius
      const leafRadius = 7 * growth;
      this.ctx.beginPath();
      this.ctx.arc(x2, y2, leafRadius, 0, Math.PI * 2);
      
      let leafColor;
      if (this.environment === 'ocean') {
        leafColor = 'rgba(236, 72, 153, 0.7)'; // glowing hot pink
      } else if (this.environment === 'forest') {
        leafColor = 'rgba(52, 211, 153, 0.7)'; // emerald green
      } else {
        leafColor = 'rgba(167, 139, 250, 0.75)'; // aurora purple
      }

      this.ctx.fillStyle = leafColor;
      if (!this.reducedMotion) {
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = leafColor;
      }
      this.ctx.fill();

      // Flower blossoms at peak calm score (100% calm)
      if (this.calmScore >= 80) {
        this.ctx.beginPath();
        this.ctx.arc(x2, y2 - 2, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fill();
      }

      this.ctx.restore();
    } else {
      // branch splits
      const splitAngle = 0.45 - (growth * 0.1); // branch spacing changes with calm
      
      this.drawBranch(x2, y2, nextLen, angle - splitAngle, nextStage, growth);
      this.drawBranch(x2, y2, nextLen, angle + splitAngle, nextStage, growth);
    }
  }

  drawFireflies() {
    this.fireflies.forEach(f => {
      this.ctx.save();
      const alpha = 0.1 + Math.abs(Math.sin(f.pulseVal)) * 0.75;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = f.color;
      if (!this.reducedMotion) {
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = f.color;
      }
      this.ctx.beginPath();
      this.ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }
}
window.FloatingWorldController = FloatingWorldController;
