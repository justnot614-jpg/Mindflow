// MindFlow Client Coordinator
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initial State Definition
  let state = {
    token: localStorage.getItem('mindflow_token') || null,
    user: null,
    activeProfileId: localStorage.getItem('mindflow_active_profile_id') || null,
    profiles: [],
    settings: [],
    progress: [],
    sessions: [],
    syncQueue: [],
    calmScore: 30, // active runtime calm score, shared between games and background world
    activeSession: null
  };

  try {
    const userStr = localStorage.getItem('mindflow_user');
    if (userStr) state.user = JSON.parse(userStr);
  } catch (e) {
    console.error("Error reading cached user", e);
  }

  // 2. DOM Elements Selection
  const elements = {
    worldCanvas: document.getElementById('world-canvas'),
    syncStatus: document.getElementById('sync-status'),
    authBtn: document.getElementById('auth-btn'),
    profileName: document.getElementById('profile-name'),
    profileStatus: document.getElementById('profile-status'),
    progressLevel: document.getElementById('progress-level'),
    xpLabel: document.getElementById('xp-label'),
    progressBarFill: document.getElementById('progress-bar-fill'),
    progressStreak: document.getElementById('progress-streak'),
    progressCalm: document.getElementById('progress-calm'),
    historyContainer: document.getElementById('history-container'),
    
    // Ambient Mixer controls
    masterMuteBtn: document.getElementById('master-mute-btn'),
    sliderRain: document.getElementById('slider-rain'),
    sliderOcean: document.getElementById('slider-ocean'),
    sliderForest: document.getElementById('slider-forest'),
    sliderChimes: document.getElementById('slider-chimes'),
    sliderPiano: document.getElementById('slider-piano'),
    volRainLbl: document.getElementById('vol-rain-lbl'),
    volOceanLbl: document.getElementById('vol-ocean-lbl'),
    volForestLbl: document.getElementById('vol-forest-lbl'),
    volChimesLbl: document.getElementById('vol-chimes-lbl'),
    volPianoLbl: document.getElementById('vol-piano-lbl'),

    // Themes & Accessibility controls
    themeDarkBtn: document.getElementById('theme-dark-btn'),
    themeLightBtn: document.getElementById('theme-light-btn'),
    prefMotion: document.getElementById('pref-motion'),
    prefContrast: document.getElementById('pref-contrast'),
    prefColorblind: document.getElementById('pref-colorblind'),

    // Views
    activitySelector: document.getElementById('activity-selector'),
    breathingPanel: document.getElementById('breathing-panel'),
    focusPanel: document.getElementById('focus-panel'),
    
    // View Select Buttons
    selectBreathingBtn: document.getElementById('select-breathing-btn'),
    selectFocusBtn: document.getElementById('select-focus-btn'),
    breathingBackBtn: document.getElementById('breathing-back-btn'),
    focusBackBtn: document.getElementById('focus-back-btn'),

    // Breathing actions
    breathingStartBtn: document.getElementById('breathing-start-btn'),
    breathingStopBtn: document.getElementById('breathing-stop-btn'),
    breathingCycleCount: document.getElementById('breathing-cycle-count'),

    // Focus actions
    focusStartBtn: document.getElementById('focus-start-btn'),
    focusStopBtn: document.getElementById('focus-stop-btn'),
    focusCalmFill: document.getElementById('focus-calm-fill'),
    focusCalmText: document.getElementById('focus-calm-text'),
    focusTimerLbl: document.getElementById('focus-timer-lbl'),

    // Modals
    authModal: document.getElementById('auth-modal'),
    authCloseBtn: document.getElementById('auth-close-btn'),
    tabLoginBtn: document.getElementById('tab-login-btn'),
    tabRegisterBtn: document.getElementById('tab-register-btn'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    loginError: document.getElementById('login-error'),
    regError: document.getElementById('reg-error'),
    guestLoginBtn: document.getElementById('guest-login-btn'),

    // Conflict Modal
    conflictModal: document.getElementById('conflict-modal'),
    conflictLocalLevel: document.getElementById('conflict-local-level'),
    conflictLocalStreak: document.getElementById('conflict-local-streak'),
    conflictLocalSessions: document.getElementById('conflict-local-sessions'),
    conflictCloudLevel: document.getElementById('conflict-cloud-level'),
    conflictCloudStreak: document.getElementById('conflict-cloud-streak'),
    conflictCloudSessions: document.getElementById('conflict-cloud-sessions'),
    resolveKeepLocalBtn: document.getElementById('resolve-keep-local-btn'),
    resolveKeepCloudBtn: document.getElementById('resolve-keep-cloud-btn'),

    // Audio context overlay
    audioOptinBanner: document.getElementById('audio-optin-banner'),
    enableAudioBtn: document.getElementById('enable-audio-btn'),

    // Env Unlock Chips
    envChips: document.querySelectorAll('.env-chip'),

    // Playroom Views
    playroomPanel: document.getElementById('playroom-panel'),
    bubblesPanel: document.getElementById('bubbles-panel'),
    mandalaPanel: document.getElementById('mandala-panel'),
    connectPanel: document.getElementById('connect-panel'),

    // Playroom Nav Buttons
    selectPlayroomBtn: document.getElementById('select-playroom-btn'),
    playroomBackBtn: document.getElementById('playroom-back-btn'),
    bubblesBackBtn: document.getElementById('bubbles-back-btn'),
    mandalaBackBtn: document.getElementById('mandala-back-btn'),
    connectBackBtn: document.getElementById('connect-back-btn'),

    // Playroom Trigger Buttons
    playBubblesBtn: document.getElementById('play-bubbles-btn'),
    playMandalaBtn: document.getElementById('play-mandala-btn'),
    playConnectBtn: document.getElementById('play-connect-btn'),

    // Canvas Playroom Control Buttons
    clearMandalaBtn: document.getElementById('clear-mandala-btn'),
    clearConnectBtn: document.getElementById('clear-connect-btn')
  };

  // 3. Instantiate Canvas Controllers
  const worldController = new FloatingWorldController('world-canvas');
  const breathingController = new BreathingController('breathing-canvas');
  const focusController = new FocusGardenController('focus-canvas');

  // Start background world rendering
  worldController.start();

  // Load and apply local configurations
  loadLocalStorageData();
  applyPreferences();
  updateUI();

  // 4. Input & Form Interactions

  // Audio opt-in trigger
  elements.enableAudioBtn.addEventListener('click', () => {
    window.audioEngine.init();
    window.audioEngine.resumeContext().then(() => {
      elements.audioOptinBanner.classList.add('hidden');
    });
  });

  // Master Mute
  elements.masterMuteBtn.addEventListener('click', () => {
    window.audioEngine.init();
    const isMuted = window.audioEngine.toggleMute();
    
    elements.masterMuteBtn.style.color = isMuted ? 'var(--danger)' : 'var(--text-main)';
    elements.masterMuteBtn.style.opacity = isMuted ? '1' : '0.7';
  });

  // Debounced Sync helper
  let syncTimeout = null;
  function enqueueSyncDebounced() {
    if (!state.token) return;
    if (syncTimeout) clearTimeout(syncTimeout);
    
    // Smooth saving status indication
    elements.syncStatus.className = 'sync-indicator offline';
    elements.syncStatus.querySelector('.status-text').textContent = 'Saving...';
    
    syncTimeout = setTimeout(() => {
      syncWithServer();
    }, 1500);
  }

  // Slider changes
  const handleVolumeChange = (slider, label, channel) => {
    slider.addEventListener('input', (e) => {
      window.audioEngine.init();
      const val = e.target.value;
      label.textContent = val + '%';
      window.audioEngine.setVolume(channel, val / 100);
      
      // Save settings changes locally
      const setting = state.settings.find(s => s.profile_id === state.activeProfileId);
      if (setting) {
        if (!setting.volumes) setting.volumes = { rain: 0, ocean: 30, forest: 0, chimes: 40, piano: 50 };
        setting.volumes[channel] = parseInt(val);
        setting.updated_at = new Date().toISOString();
        saveLocalStorageData();
        enqueueSyncDebounced(); // Use debounced sync to prevent slider race condition
      }
    });
  };

  handleVolumeChange(elements.sliderRain, elements.volRainLbl, 'rain');
  handleVolumeChange(elements.sliderOcean, elements.volOceanLbl, 'ocean');
  handleVolumeChange(elements.sliderForest, elements.volForestLbl, 'forest');
  handleVolumeChange(elements.sliderChimes, elements.volChimesLbl, 'chimes');
  handleVolumeChange(elements.sliderPiano, elements.volPianoLbl, 'piano');

  // Theme controls
  elements.themeDarkBtn.addEventListener('click', () => {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
    elements.themeDarkBtn.classList.add('active');
    elements.themeLightBtn.classList.remove('active');
    updateThemeSetting('dark');
  });

  elements.themeLightBtn.addEventListener('click', () => {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    elements.themeLightBtn.classList.add('active');
    elements.themeDarkBtn.classList.remove('active');
    updateThemeSetting('light');
  });

  function updateThemeSetting(theme) {
    const setting = state.settings.find(s => s.profile_id === state.activeProfileId);
    if (setting) {
      setting.theme = theme;
      setting.updated_at = new Date().toISOString();
      saveLocalStorageData();
      enqueueSync();
    }
  }

  // Accessibility flags
  elements.prefMotion.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    if (enabled) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
    
    worldController.setReducedMotion(enabled);
    breathingController.setReducedMotion(enabled);
    focusController.setReducedMotion(enabled);

    updateAccessibilitySetting('reducedMotion', enabled);
  });

  elements.prefContrast.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    if (enabled) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
    updateAccessibilitySetting('highContrast', enabled);
  });

  elements.prefColorblind.addEventListener('change', (e) => {
    const filter = e.target.value;
    let cssFilterValue = 'none';

    if (filter === 'protanopia') {
      cssFilterValue = 'saturate(140%) hue-rotate(-20deg)';
    } else if (filter === 'deuteranopia') {
      cssFilterValue = 'saturate(140%) hue-rotate(20deg)';
    } else if (filter === 'tritanopia') {
      cssFilterValue = 'saturate(120%) hue-rotate(180deg)';
    }

    document.documentElement.style.setProperty('--cb-filter', cssFilterValue);
    updateAccessibilitySetting('colorBlind', filter);
  });

  function updateAccessibilitySetting(key, val) {
    const setting = state.settings.find(s => s.profile_id === state.activeProfileId);
    if (setting) {
      if (!setting.accessibility) setting.accessibility = {};
      setting.accessibility[key] = val;
      setting.updated_at = new Date().toISOString();
      saveLocalStorageData();
      enqueueSync();
    }
  }

  // View Navigation
  elements.selectBreathingBtn.addEventListener('click', () => {
    elements.activitySelector.classList.add('hidden');
    elements.breathingPanel.classList.remove('hidden');
  });

  elements.selectFocusBtn.addEventListener('click', () => {
    elements.activitySelector.classList.add('hidden');
    elements.focusPanel.classList.remove('hidden');
  });

  elements.selectPlayroomBtn.addEventListener('click', () => {
    elements.activitySelector.classList.add('hidden');
    elements.playroomPanel.classList.remove('hidden');
  });

  elements.breathingBackBtn.addEventListener('click', () => {
    breathingController.stop();
    elements.breathingStopBtn.classList.add('hidden');
    elements.breathingStartBtn.classList.remove('hidden');
    elements.breathingPanel.classList.add('hidden');
    elements.activitySelector.classList.remove('hidden');
  });

  elements.focusBackBtn.addEventListener('click', () => {
    focusController.stop();
    elements.focusStopBtn.classList.add('hidden');
    elements.focusStartBtn.classList.remove('hidden');
    elements.focusPanel.classList.add('hidden');
    elements.activitySelector.classList.remove('hidden');
  });

  elements.playroomBackBtn.addEventListener('click', () => {
    elements.playroomPanel.classList.add('hidden');
    elements.activitySelector.classList.remove('hidden');
  });

  // Playroom Game Launcher Navigation
  elements.playBubblesBtn.addEventListener('click', () => {
    elements.playroomPanel.classList.add('hidden');
    elements.bubblesPanel.classList.remove('hidden');
    window.playroomManager.switchGame('bubbles');
  });

  elements.bubblesBackBtn.addEventListener('click', () => {
    window.playroomManager.stopAll();
    elements.bubblesPanel.classList.add('hidden');
    elements.playroomPanel.classList.remove('hidden');
  });

  elements.playMandalaBtn.addEventListener('click', () => {
    elements.playroomPanel.classList.add('hidden');
    elements.mandalaPanel.classList.remove('hidden');
    window.playroomManager.switchGame('mandala');
  });

  elements.mandalaBackBtn.addEventListener('click', () => {
    window.playroomManager.stopAll();
    elements.mandalaPanel.classList.add('hidden');
    elements.playroomPanel.classList.remove('hidden');
  });

  elements.playConnectBtn.addEventListener('click', () => {
    elements.playroomPanel.classList.add('hidden');
    elements.connectPanel.classList.remove('hidden');
    window.playroomManager.switchGame('connect');
  });

  elements.connectBackBtn.addEventListener('click', () => {
    window.playroomManager.stopAll();
    elements.connectPanel.classList.add('hidden');
    elements.playroomPanel.classList.remove('hidden');
  });

  elements.clearMandalaBtn.addEventListener('click', () => {
    window.playroomManager.clearMandalaCanvas();
    window.playroomManager.mandala.lines = [];
  });

  elements.clearConnectBtn.addEventListener('click', () => {
    window.playroomManager.clearConstellations();
  });

  // Mandala paint colors
  const colorDots = document.querySelectorAll('.color-dot');
  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      const color = dot.getAttribute('data-color');
      window.playroomManager.changeMandalaColor(color);
    });
  });

  // Environment Selector
  elements.envChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.classList.contains('locked')) return;
      
      elements.envChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const env = chip.getAttribute('data-env');
      
      state.calmScore = 30; // reset calm visual score on new environment
      worldController.setEnvironment(env);
      window.audioEngine.setCalmScore(30);

      // Save environment changes
      const profile = state.profiles.find(p => p.profile_id === state.activeProfileId);
      if (profile) {
        if (!profile.preferences) profile.preferences = {};
        profile.preferences.active_env = env;
        profile.updated_at = new Date().toISOString();
        saveLocalStorageData();
        enqueueSync();
      }
    });
  });

  // 5. Breathing Cycle Actions
  const patternButtons = document.querySelectorAll('.pattern-btn');
  patternButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      patternButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-pattern');
      breathingController.setMode(mode);
    });
  });

  elements.breathingStartBtn.addEventListener('click', () => {
    window.audioEngine.init();
    window.audioEngine.resumeContext();
    breathingController.start();
    
    elements.breathingStartBtn.classList.add('hidden');
    elements.breathingStopBtn.classList.remove('hidden');
    elements.breathingCycleCount.textContent = "Completed: 0 cycles";
  });

  elements.breathingStopBtn.addEventListener('click', () => {
    const completedCycles = breathingController.currentCycle;
    breathingController.stop();
    
    elements.breathingStopBtn.classList.add('hidden');
    elements.breathingStartBtn.classList.remove('hidden');

    if (completedCycles > 0) {
      // Award progress
      const duration = completedCycles * (breathingController.patterns[breathingController.mode].reduce((a, b) => a + b.duration, 0));
      saveCompletedSession({
        duration: duration,
        mode: `breathing:${breathingController.mode}`,
        calmScore: 85, // breathing grants high static calm
        xpGained: completedCycles * 15,
        notes: `Guided breathing session using ${breathingController.mode} pattern.`
      });
    }
  });

  // Wire up breathing completion hook to emit ambient bell sounds
  breathingController.onCycleComplete = (count) => {
    elements.breathingCycleCount.textContent = `Completed: ${count} cycles`;
    
    // Synthesize a calming bell ring on cycle completed
    if (window.audioEngine && window.audioEngine.ctx) {
      const ctx = window.audioEngine.ctx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = 523.25; // C5
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
      
      osc.connect(gain);
      gain.connect(window.audioEngine.gains.master);
      osc.start(now);
      osc.stop(now + 2.1);
    }
    
    // Reward small XP immediately during session!
    rewardXP(5);
  };

  // 6. Focus Garden Actions
  elements.focusStartBtn.addEventListener('click', () => {
    window.audioEngine.init();
    window.audioEngine.resumeContext();
    focusController.start();
    
    elements.focusStartBtn.classList.add('hidden');
    elements.focusStopBtn.classList.remove('hidden');
    elements.focusCalmFill.style.width = '50%';
    elements.focusCalmText.textContent = '50%';
  });

  elements.focusStopBtn.addEventListener('click', () => {
    focusController.stop();
    elements.focusStopBtn.classList.add('hidden');
    elements.focusStartBtn.classList.remove('hidden');
  });

  focusController.onCalmUpdate = (score) => {
    elements.focusCalmFill.style.width = Math.round(score) + '%';
    elements.focusCalmText.textContent = Math.round(score) + '%';
    
    // Update world backdrop elements dynamically
    state.calmScore = score;
    worldController.setCalmScore(score);
    window.audioEngine.setCalmScore(score);
  };

  focusController.onTimerUpdate = (elapsed) => {
    const secs = Math.floor(elapsed / 1000) % 60;
    const mins = Math.floor(elapsed / 60000);
    elements.focusTimerLbl.textContent = `Time: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    // Passively reward 1 XP every 5 seconds they stay above 60% calm
    if (focusController.calmScore > 60 && Math.floor(elapsed / 1000) % 5 === 0) {
      rewardXP(1);
    }
  };

  focusController.onComplete = (summary) => {
    if (summary.duration > 5) {
      saveCompletedSession({
        duration: summary.duration,
        mode: 'focus_garden',
        calmScore: summary.calmScore,
        xpGained: Math.round(summary.duration * 0.8 + (summary.calmScore / 10)),
        notes: `Focus tracking session with peak calm of ${summary.calmScore}%.`
      });
    }
  };

  // 7. Core progression state builders
  function rewardXP(amount) {
    const prog = state.progress.find(p => p.profile_id === state.activeProfileId);
    if (!prog) return;

    prog.experience += amount;
    prog.updated_at = new Date().toISOString();

    const targetXp = prog.level * 100;
    if (prog.experience >= targetXp) {
      prog.experience -= targetXp;
      prog.level += 1;
      
      // Level Up! Trigger unlockables checks
      triggerLevelUnlockables(prog);
      
      // Bell chime on level up
      if (window.audioEngine && window.audioEngine.ctx) {
        setTimeout(() => {
          triggerChimeChords();
        }, 300);
      }
    }

    saveLocalStorageData();
    updateUI();
  }

  function triggerChimeChords() {
    const ctx = window.audioEngine.ctx;
    const now = ctx.currentTime;
    // Ascending arpeggio
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.15 + 1.5);
      osc.connect(gain);
      gain.connect(window.audioEngine.gains.master);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 1.6);
    });
  }

  // Custom Toast System
  function showToast(title, body) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast glass';
    
    const h4 = document.createElement('h4');
    h4.textContent = title;
    const p = document.createElement('p');
    p.textContent = body;
    
    toast.appendChild(h4);
    toast.appendChild(p);
    container.appendChild(toast);
    
    // Auto-remove after animation finishes
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  function triggerLevelUnlockables(prog) {
    if (!prog.unlockables) prog.unlockables = ['environment:aurora'];

    let unlockedAnything = false;
    let unlockedEnvName = "";
    if (prog.level >= 2 && !prog.unlockables.includes('environment:forest')) {
      prog.unlockables.push('environment:forest');
      unlockedAnything = true;
      unlockedEnvName = "Forest Stream";
    }
    if (prog.level >= 3 && !prog.unlockables.includes('environment:ocean')) {
      prog.unlockables.push('environment:ocean');
      unlockedAnything = true;
      unlockedEnvName = "Ocean Sunset";
    }

    if (unlockedAnything) {
      showToast("🎉 Environment Unlocked!", `${unlockedEnvName} is now available in your Soundscape Mixer!`);
    } else {
      showToast("📈 Level Up!", `Congratulations! You reached Level ${prog.level}. Keep breathing!`);
    }
  }

  function saveCompletedSession(data) {
    // 1. Add session record
    const sessionId = 's_' + Math.random().toString(36).substr(2, 9);
    const newSession = {
      session_id: sessionId,
      profile_id: state.activeProfileId,
      date: new Date().toISOString(),
      duration: data.duration,
      breathing_mode: data.mode,
      focus_score: data.calmScore,
      notes: data.notes,
      updated_at: new Date().toISOString()
    };
    state.sessions.push(newSession);

    // 2. Add experience
    const prog = state.progress.find(p => p.profile_id === state.activeProfileId);
    if (prog) {
      // Update streak details
      const lastSession = state.sessions
        .filter(s => s.profile_id === state.activeProfileId && s.session_id !== sessionId)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      let streakIncremented = false;
      const todayStr = new Date().toISOString().split('T')[0];

      if (!lastSession) {
        prog.streak = 1;
        streakIncremented = true;
      } else {
        const lastDateStr = lastSession.date.split('T')[0];
        const dateDiff = (new Date(todayStr) - new Date(lastDateStr)) / (1000 * 60 * 60 * 24);
        
        if (dateDiff === 1) {
          prog.streak += 1;
          streakIncremented = true;
        } else if (dateDiff > 1) {
          prog.streak = 1; // reset streak
          streakIncremented = true;
        }
      }

      prog.experience += data.xpGained;
      prog.calm_score = Math.round(Math.max(prog.calm_score, data.calmScore));
      prog.updated_at = new Date().toISOString();

      const targetXp = prog.level * 100;
      if (prog.experience >= targetXp) {
        prog.experience -= targetXp;
        prog.level += 1;
        triggerLevelUnlockables(prog);
      }
    }

    saveLocalStorageData();
    updateUI();
    
    // Sync immediately
    enqueueSync();
  }

  // 8. Local Storage Operations
  function loadLocalStorageData() {
    // Read local cache
    const profiles = localStorage.getItem('mindflow_profiles');
    const progress = localStorage.getItem('mindflow_progress');
    const sessions = localStorage.getItem('mindflow_sessions');
    const settings = localStorage.getItem('mindflow_settings');
    const queue = localStorage.getItem('mindflow_sync_queue');

    if (profiles && progress && sessions && settings) {
      state.profiles = JSON.parse(profiles);
      state.progress = JSON.parse(progress);
      state.sessions = JSON.parse(sessions);
      state.settings = JSON.parse(settings);
    } else {
      // First-time guest initial defaults
      const pId = 'p_guest_' + Math.random().toString(36).substr(2, 9);
      state.activeProfileId = pId;
      localStorage.setItem('mindflow_active_profile_id', pId);

      state.profiles = [{
        profile_id: pId,
        user_id: 'guest',
        nickname: 'Guest Player',
        avatar: 'lotus',
        preferences: { active_env: 'aurora' },
        updated_at: new Date().toISOString()
      }];

      state.settings = [{
        profile_id: pId,
        theme: 'dark',
        volumes: { rain: 0, ocean: 30, forest: 0, chimes: 40, piano: 50 },
        difficulty: 'normal',
        accessibility: { reducedMotion: false, highContrast: false, colorBlind: 'none' },
        language: 'en',
        updated_at: new Date().toISOString()
      }];

      state.progress = [{
        progress_id: 'pr_guest',
        profile_id: pId,
        level: 1,
        experience: 0,
        streak: 0,
        unlockables: ['environment:aurora'],
        calm_score: 0,
        updated_at: new Date().toISOString()
      }];

      state.sessions = [];
      saveLocalStorageData();
    }

    if (queue) {
      state.syncQueue = JSON.parse(queue);
    }
  }

  function saveLocalStorageData() {
    localStorage.setItem('mindflow_profiles', JSON.stringify(state.profiles));
    localStorage.setItem('mindflow_progress', JSON.stringify(state.progress));
    localStorage.setItem('mindflow_sessions', JSON.stringify(state.sessions));
    localStorage.setItem('mindflow_settings', JSON.stringify(state.settings));
    localStorage.setItem('mindflow_sync_queue', JSON.stringify(state.syncQueue));
    if (state.activeProfileId) {
      localStorage.setItem('mindflow_active_profile_id', state.activeProfileId);
    }
  }

  function applyPreferences() {
    // Find settings of active profile
    const activeSetting = state.settings.find(s => s.profile_id === state.activeProfileId);
    if (!activeSetting) return;

    // Apply Theme
    if (activeSetting.theme === 'light') {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      elements.themeLightBtn.classList.add('active');
      elements.themeDarkBtn.classList.remove('active');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      elements.themeDarkBtn.classList.add('active');
      elements.themeLightBtn.classList.remove('active');
    }

    // Apply Sound sliders
    const vols = activeSetting.volumes || { rain: 0, ocean: 30, forest: 0, chimes: 40, piano: 50 };
    elements.sliderRain.value = vols.rain; elements.volRainLbl.textContent = vols.rain + '%';
    elements.sliderOcean.value = vols.ocean; elements.volOceanLbl.textContent = vols.ocean + '%';
    elements.sliderForest.value = vols.forest; elements.volForestLbl.textContent = vols.forest + '%';
    elements.sliderChimes.value = vols.chimes; elements.volChimesLbl.textContent = vols.chimes + '%';
    elements.sliderPiano.value = vols.piano; elements.volPianoLbl.textContent = vols.piano + '%';

    // Set sound engine volumes directly on startup
    window.audioEngine.setVolume('rain', vols.rain / 100);
    window.audioEngine.setVolume('ocean', vols.ocean / 100);
    window.audioEngine.setVolume('forest', vols.forest / 100);
    window.audioEngine.setVolume('chimes', vols.chimes / 100);
    window.audioEngine.setVolume('piano', vols.piano / 100);

    // Apply accessibility flags
    if (activeSetting.accessibility) {
      const acc = activeSetting.accessibility;
      
      elements.prefMotion.checked = !!acc.reducedMotion;
      if (acc.reducedMotion) document.body.classList.add('reduced-motion');
      worldController.setReducedMotion(!!acc.reducedMotion);
      breathingController.setReducedMotion(!!acc.reducedMotion);
      focusController.setReducedMotion(!!acc.reducedMotion);
      if (window.playroomManager) window.playroomManager.setReducedMotion(!!acc.reducedMotion);

      elements.prefContrast.checked = !!acc.highContrast;
      if (acc.highContrast) document.body.classList.add('high-contrast');

      if (acc.colorBlind) {
        elements.prefColorblind.value = acc.colorBlind;
        let cssFilterValue = 'none';
        if (acc.colorBlind === 'protanopia') cssFilterValue = 'saturate(140%) hue-rotate(-20deg)';
        if (acc.colorBlind === 'deuteranopia') cssFilterValue = 'saturate(140%) hue-rotate(20deg)';
        if (acc.colorBlind === 'tritanopia') cssFilterValue = 'saturate(120%) hue-rotate(180deg)';
        document.documentElement.style.setProperty('--cb-filter', cssFilterValue);
      }
    }

    // Active Environment Chip
    const activeProf = state.profiles.find(p => p.profile_id === state.activeProfileId);
    if (activeProf && activeProf.preferences && activeProf.preferences.active_env) {
      const activeEnv = activeProf.preferences.active_env;
      elements.envChips.forEach(chip => {
        if (chip.getAttribute('data-env') === activeEnv) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
      worldController.setEnvironment(activeEnv);
    }
  }

  function updateUI() {
    const activeProf = state.profiles.find(p => p.profile_id === state.activeProfileId);
    const activeProg = state.progress.find(pr => pr.profile_id === state.activeProfileId);

    if (state.user) {
      elements.authBtn.textContent = 'Sign Out';
      elements.profileName.textContent = state.user.display_name;
      elements.profileStatus.textContent = state.user.email ? 'Cloud Account' : 'Guest Account';
    } else {
      elements.authBtn.textContent = 'Sign In';
      elements.profileName.textContent = 'Guest User';
      elements.profileStatus.textContent = 'Local Browser Sync';
    }

    if (activeProg) {
      elements.progressLevel.textContent = activeProg.level;
      elements.progressStreak.textContent = activeProg.streak;
      elements.progressCalm.textContent = activeProg.calm_score + '%';

      const targetXp = activeProg.level * 100;
      elements.xpLabel.textContent = `${activeProg.experience} / ${targetXp} XP`;
      elements.progressBarFill.style.width = (activeProg.experience / targetXp * 100) + '%';

      // Unlock Environment chips according to current levels
      elements.envChips.forEach(chip => {
        const env = chip.getAttribute('data-env');
        if (env === 'forest') {
          if (activeProg.level >= 2) {
            chip.disabled = false;
            chip.classList.remove('locked');
            if (chip.querySelector('span')) chip.querySelector('span').remove();
          } else {
            chip.disabled = true;
            chip.classList.add('locked');
          }
        }
        if (env === 'ocean') {
          if (activeProg.level >= 3) {
            chip.disabled = false;
            chip.classList.remove('locked');
            if (chip.querySelector('span')) chip.querySelector('span').remove();
          } else {
            chip.disabled = true;
            chip.classList.add('locked');
          }
        }
      });
    }

    // Render session history logs
    const userSessions = state.sessions
      .filter(s => s.profile_id === state.activeProfileId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5); // display 5 recent sessions

    elements.historyContainer.innerHTML = '';
    if (userSessions.length === 0) {
      elements.historyContainer.innerHTML = '<div class="empty-history">No sessions completed today. Start a cycle below to restore the world!</div>';
    } else {
      userSessions.forEach(s => {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const left = document.createElement('div');
        left.className = 'history-item-left';
        
        const modeSpan = document.createElement('span');
        const formattedMode = s.breathing_mode.replace('breathing:', 'Breathing (').replace('_', ' ') + (s.breathing_mode.includes('breathing') ? ')' : '');
        modeSpan.textContent = formattedMode;
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'date';
        dateSpan.textContent = new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date(s.date).toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        left.appendChild(modeSpan);
        left.appendChild(dateSpan);
        
        const right = document.createElement('div');
        right.className = 'history-item-right';
        right.textContent = `+${Math.round(s.duration)}s`;
        
        item.appendChild(left);
        item.appendChild(right);
        
        elements.historyContainer.appendChild(item);
      });
    }
  }

  // 9. Online / Sync Engine

  // Background Sync Loop (runs every 30s)
  setInterval(() => {
    if (state.token) {
      syncWithServer();
    }
  }, 30000);

  // Monitor browser network states
  window.addEventListener('online', () => {
    elements.syncStatus.className = 'sync-indicator online';
    elements.syncStatus.querySelector('.status-text').textContent = state.token ? 'Synchronized' : 'Guest Local';
    if (state.token) syncWithServer();
  });

  window.addEventListener('offline', () => {
    elements.syncStatus.className = 'sync-indicator offline';
    elements.syncStatus.querySelector('.status-text').textContent = 'Offline Mode';
  });

  function enqueueSync() {
    if (!state.token) return;
    syncWithServer();
  }

  async function syncWithServer() {
    if (!navigator.onLine || !state.token) return;

    try {
      const payload = {
        profiles: state.profiles,
        settings: state.settings,
        progress: state.progress,
        sessions: state.sessions
      };

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401 || response.status === 403) {
        // Token expired, log user out
        logoutUser();
        return;
      }

      if (!response.ok) {
        throw new Error('Sync endpoint returned error');
      }

      const serverState = await response.json();
      reconcileServerState(serverState);
      
      elements.syncStatus.className = 'sync-indicator online';
      elements.syncStatus.querySelector('.status-text').textContent = 'Cloud Synced';
    } catch (err) {
      console.warn("Sync failed, queuing for retry:", err);
      elements.syncStatus.className = 'sync-indicator offline';
      elements.syncStatus.querySelector('.status-text').textContent = 'Sync Delayed';
    }
  }

  function reconcileServerState(serverState) {
    // Reconcile Settings (Take Server if newer, or overwrite)
    serverState.settings.forEach(serverSetting => {
      const localSettingIndex = state.settings.findIndex(s => s.profile_id === serverSetting.profile_id);
      if (localSettingIndex === -1) {
        state.settings.push(serverSetting);
      } else {
        const localTime = new Date(state.settings[localSettingIndex].updated_at || 0).getTime();
        const serverTime = new Date(serverSetting.updated_at || 0).getTime();
        if (serverTime > localTime) {
          state.settings[localSettingIndex] = serverSetting;
        }
      }
    });

    // Reconcile Profiles
    serverState.profiles.forEach(serverProfile => {
      const localProfileIndex = state.profiles.findIndex(p => p.profile_id === serverProfile.profile_id);
      if (localProfileIndex === -1) {
        state.profiles.push(serverProfile);
      } else {
        const localTime = new Date(state.profiles[localProfileIndex].updated_at || 0).getTime();
        const serverTime = new Date(serverProfile.updated_at || 0).getTime();
        if (serverTime > localTime) {
          state.profiles[localProfileIndex] = serverProfile;
        }
      }
    });

    // Reconcile Sessions (union check)
    serverState.sessions.forEach(serverSession => {
      const exists = state.sessions.some(s => s.session_id === serverSession.session_id);
      if (!exists) {
        state.sessions.push(serverSession);
      }
    });

    // Reconcile Progress (if server version differs, check if conflict comparison is needed)
    serverState.progress.forEach(serverProg => {
      const localProgIndex = state.progress.findIndex(p => p.profile_id === serverProg.profile_id);
      if (localProgIndex === -1) {
        state.progress.push(serverProg);
      } else {
        const localProg = state.progress[localProgIndex];
        // If levels or streaks are different, check dates
        if (localProg.level !== serverProg.level || localProg.streak !== serverProg.streak) {
          const localTime = new Date(localProg.updated_at || 0).getTime();
          const serverTime = new Date(serverProg.updated_at || 0).getTime();
          
          if (serverTime > localTime) {
            // Server is newer, overwrite silently
            state.progress[localProgIndex] = serverProg;
          } else if (localTime > serverTime) {
            // Local is newer, let local push next sync
          } else {
            // Exact tie but mismatch: prompt merging
            triggerConflictModal(localProg, serverProg);
          }
        }
      }
    });

    saveLocalStorageData();
    applyPreferences();
    updateUI();
  }

  function triggerConflictModal(local, cloud) {
    // Count sessions
    const localSessCount = state.sessions.filter(s => s.profile_id === local.profile_id).length;
    
    elements.conflictLocalLevel.textContent = `Level: ${local.level} (${local.experience} XP)`;
    elements.conflictLocalStreak.textContent = `Streak: ${local.streak} days`;
    elements.conflictLocalSessions.textContent = `Sessions: ${localSessCount}`;

    elements.conflictCloudLevel.textContent = `Level: ${cloud.level} (${cloud.experience} XP)`;
    elements.conflictCloudStreak.textContent = `Streak: ${cloud.streak} days`;
    elements.conflictCloudSessions.textContent = `Last sync state`;

    elements.conflictModal.classList.remove('hidden');

    elements.resolveKeepLocalBtn.onclick = () => {
      local.updated_at = new Date().toISOString(); // make local win
      saveLocalStorageData();
      elements.conflictModal.classList.add('hidden');
      enqueueSync();
    };

    elements.resolveKeepCloudBtn.onclick = () => {
      const idx = state.progress.findIndex(p => p.profile_id === local.profile_id);
      if (idx !== -1) {
        state.progress[idx] = cloud;
      }
      saveLocalStorageData();
      elements.conflictModal.classList.add('hidden');
      updateUI();
    };
  }

  // 10. Authentication Modals & Operations
  elements.authBtn.addEventListener('click', () => {
    if (state.token) {
      logoutUser();
    } else {
      showAuthModal();
    }
  });

  elements.authCloseBtn.addEventListener('click', hideAuthModal);
  
  elements.tabLoginBtn.addEventListener('click', () => {
    elements.tabLoginBtn.classList.add('active');
    elements.tabRegisterBtn.classList.remove('active');
    elements.loginForm.classList.remove('hidden');
    elements.registerForm.classList.add('hidden');
  });

  elements.tabRegisterBtn.addEventListener('click', () => {
    elements.tabRegisterBtn.classList.add('active');
    elements.tabLoginBtn.classList.remove('active');
    elements.registerForm.classList.remove('hidden');
    elements.loginForm.classList.add('hidden');
  });

  function showAuthModal() {
    elements.authModal.classList.remove('hidden');
    elements.loginError.classList.add('hidden');
    elements.regError.classList.add('hidden');
  }

  function hideAuthModal() {
    elements.authModal.classList.add('hidden');
  }

  // Submit Login
  elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elements.loginError.classList.add('hidden');
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      completeLogin(data);
    } catch (err) {
      elements.loginError.textContent = err.message;
      elements.loginError.classList.remove('hidden');
    }
  });

  // Submit Register
  elements.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    elements.regError.classList.add('hidden');

    const displayName = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName,
          deviceName: navigator.userAgent.split(' ')[0] || 'Browser',
          platform: 'Web'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      completeLogin(data);
    } catch (err) {
      elements.regError.textContent = err.message;
      elements.regError.classList.remove('hidden');
    }
  });

  // Anonymous guest registration
  elements.guestLoginBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: 'Guest Agent',
          platform: 'Web'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error('Guest login error');

      completeLogin(data);
    } catch (err) {
      alert("Failed to initialize guest profile online. Continuing in local-only mode.");
      hideAuthModal();
    }
  });

  function completeLogin(data) {
    state.token = data.token;
    state.user = data.user;
    state.activeProfileId = data.profile_id;

    localStorage.setItem('mindflow_token', data.token);
    localStorage.setItem('mindflow_user', JSON.stringify(data.user));
    localStorage.setItem('mindflow_active_profile_id', data.profile_id);

    hideAuthModal();
    
    // Clear out standard local items, sync will pull fresh database
    state.profiles = [];
    state.progress = [];
    state.sessions = [];
    state.settings = [];

    // Trigger initial pull
    syncWithServer().then(() => {
      location.reload(); // refresh page to bind new themes and levels correctly!
    });
  }

  function logoutUser() {
    const confirmOut = confirm("Are you sure you want to sign out?");
    if (!confirmOut) return;

    localStorage.removeItem('mindflow_token');
    localStorage.removeItem('mindflow_user');
    localStorage.removeItem('mindflow_active_profile_id');
    localStorage.removeItem('mindflow_profiles');
    localStorage.removeItem('mindflow_progress');
    localStorage.removeItem('mindflow_sessions');
    localStorage.removeItem('mindflow_settings');

    location.reload();
  }
});
