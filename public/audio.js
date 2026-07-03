class MindFlowAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
    this.calmScore = 50; // 0 - 100

    // Gain nodes for each channel
    this.gains = {
      master: null,
      rain: null,
      ocean: null,
      forest: null,
      chimes: null,
      piano: null
    };

    // Current volume settings (0 to 1.0)
    this.volumes = {
      rain: 0.0,
      ocean: 0.3,
      forest: 0.0,
      chimes: 0.4,
      piano: 0.5
    };

    // Active sound nodes for clean release
    this.nodes = {
      rainNoise: null,
      oceanNoise: null,
      oceanLFO: null,
      forestNoise: null,
      pianoOscs: []
    };
    
    // Interval IDs for random events
    this.intervals = {
      birds: null,
      chimes: null,
      piano: null
    };
  }

  // Initialize Audio Context on user gesture
  init() {
    if (this.initialized) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("Web Audio API is not supported in this browser.");
      return;
    }
    
    this.ctx = new AudioContextClass();
    this.initialized = true;

    // Master Gain
    this.gains.master = this.ctx.createGain();
    this.gains.master.gain.value = this.isMuted ? 0 : 0.8;
    this.gains.master.connect(this.ctx.destination);

    // Initialize Channels
    Object.keys(this.volumes).forEach(key => {
      this.gains[key] = this.ctx.createGain();
      this.gains[key].gain.value = this.volumes[key];
      this.gains[key].connect(this.gains.master);
    });

    // Start synthesizers
    this.startRainSynth();
    this.startOceanSynth();
    this.startForestSynth();
    this.startChimeLoop();
    this.startPianoLoop();
  }

  setCalmScore(score) {
    this.calmScore = score;
    // Dynamic adjustments
    if (this.ctx && this.ctx.state === 'running') {
      // High calm score enhances the piano pad volume slightly and adds brighter harmonics
      const pianoTarget = this.volumes.piano * (0.6 + (score / 250)); // scaled target
      this.gains.piano.gain.setTargetAtTime(pianoTarget, this.ctx.currentTime, 1.5);
    }
  }

  // Mute / Unmute
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.gains.master && this.ctx) {
      const target = this.isMuted ? 0 : 0.8;
      this.gains.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
    return this.isMuted;
  }

  // Set individual volumes
  setVolume(channel, value) {
    this.volumes[channel] = parseFloat(value);
    if (this.gains[channel] && this.ctx) {
      this.gains[channel].gain.setTargetAtTime(this.volumes[channel], this.ctx.currentTime, 0.1);
    }
  }

  // Create White Noise Buffer for Rain and Ocean
  createNoiseBuffer() {
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  // 1. Rain Synthesizer (Filtered White Noise + Bandpass Sweep)
  startRainSynth() {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    // Filter rain frequencies
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650; // soft rain

    noise.connect(filter);
    filter.connect(this.gains.rain);
    noise.start(0);

    this.nodes.rainNoise = noise;
  }

  // 2. Ocean Waves (Bandpass Filtered White Noise Modulated by an LFO)
  startOceanSynth() {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.value = 400;

    // LFO to sweep filter cutoff (representing waves cresting/troughs)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08; // slow cycles: ~12s waves
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 250; // sweep frequency range +/- 250Hz

    // LFO to modulate volume of the wave
    const waveGain = this.ctx.createGain();
    waveGain.gain.value = 0.5;

    const volumeLfo = this.ctx.createOscillator();
    volumeLfo.frequency.value = 0.08;
    const volumeLfoGain = this.ctx.createGain();
    volumeLfoGain.gain.value = 0.45; // modulate volume between 0.05 and 0.95

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    
    volumeLfo.connect(volumeLfoGain);
    volumeLfoGain.connect(waveGain.gain);

    noise.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(this.gains.ocean);

    lfo.start(0);
    volumeLfo.start(0);
    noise.start(0);

    this.nodes.oceanNoise = noise;
    this.nodes.oceanLFO = lfo;
  }

  // 3. Forest Wind (Pink/Brown noise sweep) & Birds
  startForestSynth() {
    // Generate pinkish noise (wind)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 350;

    // Random slow filter modulator (wind gusts)
    const windLFO = this.ctx.createOscillator();
    windLFO.frequency.value = 0.05; // 20-second gusts
    const windLFOGain = this.ctx.createGain();
    windLFOGain.gain.value = 150;

    windLFO.connect(windLFOGain);
    windLFOGain.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(this.gains.forest);

    windLFO.start(0);
    noise.start(0);

    this.nodes.forestNoise = noise;

    // Start bird chirps loop
    this.intervals.birds = setInterval(() => {
      if (this.volumes.forest > 0.05 && Math.random() > 0.4) {
        this.triggerBirdChirp();
      }
    }, 4500);
  }

  triggerBirdChirp() {
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    // Chirp sweep: starts high, slides down, then sweeps back up rapidly
    osc.frequency.setValueAtTime(1500 + Math.random() * 800, now);
    osc.frequency.exponentialRampToValueAtTime(2800 + Math.random() * 500, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.3);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    filter.type = 'bandpass';
    filter.frequency.value = 2400;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.gains.forest);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // 4. Wind Chimes (High-pitched resonant impulses)
  startChimeLoop() {
    this.intervals.chimes = setInterval(() => {
      if (this.volumes.chimes > 0.05 && Math.random() > 0.4) {
        this.triggerWindChime();
      }
    }, 6000);
  }

  triggerWindChime() {
    if (!this.ctx || this.isMuted) return;

    // A single gust triggers 3-5 chimes in rapid succession
    const count = 3 + Math.floor(Math.random() * 3);
    const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; // Pentatonic C Major scale chimes

    for (let i = 0; i < count; i++) {
      const delay = i * (0.15 + Math.random() * 0.3);
      const noteFreq = scale[Math.floor(Math.random() * scale.length)] * (1 + (Math.random() > 0.7 ? 1 : 0)); // occasionally drop up an octave
      
      const now = this.ctx.currentTime + delay;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = noteFreq;

      // Add a tiny frequency vibrato for realistic chime resonances
      const vibrato = this.ctx.createOscillator();
      vibrato.frequency.value = 4 + Math.random() * 4;
      const vibratoGain = this.ctx.createGain();
      vibratoGain.gain.value = 2 + Math.random() * 3;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8 + Math.random() * 1.5); // long chime rings

      filter.type = 'highpass';
      filter.frequency.value = 300;

      vibrato.start(now);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.gains.chimes);

      osc.start(now);
      vibrato.stop(now + 3.5);
      osc.stop(now + 3.5);
    }
  }

  // 5. Generative Piano Pad (Slow chord changes using smooth triangle wave pads)
  startPianoLoop() {
    // Chords definition in pentatonic (C Major 9, Amin7/9, F Maj9, G add9)
    const progressions = {
      calm: [
        [130.81, 261.63, 329.63, 392.00, 493.88, 587.33], // C Maj 9 (C3, C4, E4, G4, B4, D5)
        [110.00, 220.00, 261.63, 329.63, 392.00, 440.00], // A min 7/9 (A2, A3, C4, E4, G4, A4)
        [174.61, 349.23, 440.00, 523.25, 587.33, 659.25], // F Maj 9 (F3, F4, A4, C5, D5, E5)
        [196.00, 392.00, 440.00, 493.88, 587.33, 783.99]  // G add 9 (G3, G4, A4, B4, D5, G5)
      ],
      busy: [
        [130.81, 261.63, 329.63, 392.00], // C Maj (C3, C4, E4, G4)
        [110.00, 220.00, 261.63, 329.63], // A min (A2, A3, C4, E4)
        [146.83, 293.66, 349.23, 440.00], // D min (D3, D4, F4, A4)
        [196.00, 392.00, 493.88, 587.33]  // G Maj (G3, G4, B4, D5)
      ]
    };

    let chordIndex = 0;

    const playNextChord = () => {
      if (!this.ctx || this.isMuted || this.volumes.piano < 0.05) {
        // schedule check next cycle
        this.intervals.piano = setTimeout(playNextChord, 7000);
        return;
      }

      // Choose progression based on calm score
      const activeProg = this.calmScore >= 50 ? progressions.calm : progressions.busy;
      const notes = activeProg[chordIndex];
      chordIndex = (chordIndex + 1) % activeProg.length;

      const now = this.ctx.currentTime;
      const duration = 6.8; // Chord length

      // Create oscillators for chord
      notes.forEach((freq, idx) => {
        // slightly staggered attack for a natural piano roll effect
        const noteDelay = idx * 0.08;
        const noteStart = now + noteDelay;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Use soft triangle waves for ambient warm pad sound
        osc.type = 'triangle';
        osc.frequency.value = freq;

        // Soften higher frequencies to make it pad-like
        filter.type = 'lowpass';
        filter.frequency.value = 900 - (idx * 60); // progressively warmer filters on top notes

        // Envelope: 2s fade in, 3.5s hold, 1.5s release
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.035, noteStart + 1.8);
        gain.gain.setValueAtTime(0.035, noteStart + 3.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.gains.piano);

        osc.start(noteStart);
        osc.stop(noteStart + duration);

        this.nodes.pianoOscs.push(osc);
      });

      // Clear dead references in array periodically
      setTimeout(() => {
        this.nodes.pianoOscs = this.nodes.pianoOscs.filter(o => {
          try {
            return o.context.currentTime < o.stopTime;
          } catch(e) {
            return false;
          }
        });
      }, duration * 1000);

      this.intervals.piano = setTimeout(playNextChord, 6500);
    };

    // Begin looping
    playNextChord();
  }

  // Resume or start context (browsers restrict autoplay)
  resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  // Stop everything (for clean shutdowns)
  shutdown() {
    clearInterval(this.intervals.birds);
    clearInterval(this.intervals.chimes);
    clearTimeout(this.intervals.piano);

    if (this.nodes.rainNoise) { try { this.nodes.rainNoise.stop(); } catch(e) {} }
    if (this.nodes.oceanNoise) { try { this.nodes.oceanNoise.stop(); } catch(e) {} }
    if (this.nodes.oceanLFO) { try { this.nodes.oceanLFO.stop(); } catch(e) {} }
    if (this.nodes.forestNoise) { try { this.nodes.forestNoise.stop(); } catch(e) {} }
    
    this.nodes.pianoOscs.forEach(osc => {
      try { osc.stop(); } catch(e) {}
    });
    
    if (this.ctx) {
      this.ctx.close();
    }
    
    this.initialized = false;
  }
}

// Instantiate globally
window.audioEngine = new MindFlowAudioEngine();
