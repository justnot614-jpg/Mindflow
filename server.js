require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mindflow_default_secret_key';
const DB_PATH = process.env.DB_PATH || 'database.json';

// Basic security middleware: custom rate limiting to prevent brute-force attacks on auth
const rateLimitCache = new Map();
const authRateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const limitWindow = 60 * 1000; // 1 minute
  const maxAttempts = 15; // Max 15 auth attempts per minute

  if (!rateLimitCache.has(ip)) {
    rateLimitCache.set(ip, []);
  }

  const timestamps = rateLimitCache.get(ip).filter(t => now - t < limitWindow);
  timestamps.push(now);
  rateLimitCache.set(ip, timestamps);

  if (timestamps.length > maxAttempts) {
    return res.status(429).json({ error: 'Too many authentication attempts. Please try again in a minute.' });
  }

  next();
};

app.use(cors());
app.use(express.json());
// Serve static client assets from the local public folder
app.use(express.static(path.join(__dirname, 'public')));

// Async Database Helpers (handles JSONBin.io cloud DB online, falls back to local file)
async function readDb() {
  // If JSONBin variables are injected in environment (e.g. on Vercel)
  if (process.env.JSONBIN_BIN_ID && process.env.JSONBIN_API_KEY) {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}/latest`, {
        headers: {
          'X-Master-Key': process.env.JSONBIN_API_KEY,
          'X-Bin-Meta': 'false'
        }
      });
      if (response.ok) {
        return await response.json();
      } else {
        console.error("JSONBin read error status:", response.status);
      }
    } catch (err) {
      console.error("JSONBin read error, falling back to local file:", err);
    }
  }

  // Local filesystem fallback
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      users: [],
      devices: [],
      profiles: [],
      progress: [],
      sessions: [],
      settings: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Database reading error, resolving to blank data:", err);
    return { users: [], devices: [], profiles: [], progress: [], sessions: [], settings: [] };
  }
}

async function writeDb(data) {
  // If JSONBin variables are injected in environment (e.g. on Vercel)
  if (process.env.JSONBIN_BIN_ID && process.env.JSONBIN_API_KEY) {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': process.env.JSONBIN_API_KEY
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        console.error("JSONBin write error status:", response.status);
      }
      return;
    } catch (err) {
      console.error("JSONBin write error, falling back to local file:", err);
    }
  }

  // Local filesystem fallback
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Database writing error:", err);
  }
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Access token expired or invalid' });
    req.user = user;
    next();
  });
};

// API Endpoints

// 1. User Registration
app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  const { email, password, displayName, deviceName, platform } = req.body;

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Email, password, and display name are required' });
  }

  try {
    const db = await readDb();
    const existingUser = db.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'u_' + Math.random().toString(36).substr(2, 9);
    const user = {
      user_id: userId,
      email: email.toLowerCase(),
      passwordHash,
      display_name: displayName,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    };

    db.users.push(user);

    // Auto-create default device and profile for the registered user
    const deviceId = 'd_' + Math.random().toString(36).substr(2, 9);
    const profileId = 'p_' + Math.random().toString(36).substr(2, 9);

    db.devices.push({
      device_id: deviceId,
      user_id: userId,
      device_name: deviceName || 'Web Browser',
      platform: platform || 'Web',
      last_sync: new Date().toISOString(),
      local_profile_id: profileId
    });

    db.profiles.push({
      profile_id: profileId,
      user_id: userId,
      nickname: displayName,
      avatar: 'lotus',
      preferences: {},
      updated_at: new Date().toISOString()
    });

    db.settings.push({
      profile_id: profileId,
      theme: 'dark',
      volumes: { rain: 0, ocean: 30, forest: 0, chimes: 40, piano: 50 },
      difficulty: 'normal',
      accessibility: { reducedMotion: false, highContrast: false, colorBlind: 'none' },
      language: 'en',
      updated_at: new Date().toISOString()
    });

    db.progress.push({
      progress_id: 'pr_' + Math.random().toString(36).substr(2, 9),
      profile_id: profileId,
      level: 1,
      experience: 0,
      streak: 0,
      unlockables: ['environment:aurora'],
      calm_score: 0,
      updated_at: new Date().toISOString()
    });

    await writeDb(db);

    const accessToken = jwt.sign({ user_id: userId, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      token: accessToken,
      user: { user_id: userId, email: user.email, display_name: displayName },
      profile_id: profileId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error during registration' });
  }
});

// 2. User Login
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const db = await readDb();
    const user = db.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    user.last_login = new Date().toISOString();
    await writeDb(db);

    // Retrieve the active profile associated with the user
    const profile = db.profiles.find(p => p.user_id === user.user_id) || null;
    const profileId = profile ? profile.profile_id : null;

    const accessToken = jwt.sign({ user_id: user.user_id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token: accessToken,
      user: { user_id: user.user_id, email: user.email, display_name: user.display_name },
      profile_id: profileId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error logging in' });
  }
});

// 3. Anonymous Guest Registration
app.post('/api/auth/anonymous', authRateLimiter, async (req, res) => {
  const { deviceName, platform } = req.body;

  try {
    const db = await readDb();

    const userId = 'g_' + Math.random().toString(36).substr(2, 9);
    const deviceId = 'd_' + Math.random().toString(36).substr(2, 9);
    const profileId = 'p_' + Math.random().toString(36).substr(2, 9);

    const guestUser = {
      user_id: userId,
      email: null,
      passwordHash: null,
      display_name: 'Guest Player',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    };

    db.users.push(guestUser);

    db.devices.push({
      device_id: deviceId,
      user_id: userId,
      device_name: deviceName || 'Web Browser',
      platform: platform || 'Web',
      last_sync: new Date().toISOString(),
      local_profile_id: profileId
    });

    db.profiles.push({
      profile_id: profileId,
      user_id: userId,
      nickname: 'Guest',
      avatar: 'lotus',
      preferences: {},
      updated_at: new Date().toISOString()
    });

    db.settings.push({
      profile_id: profileId,
      theme: 'dark',
      volumes: { rain: 0, ocean: 30, forest: 0, chimes: 40, piano: 50 },
      difficulty: 'normal',
      accessibility: { reducedMotion: false, highContrast: false, colorBlind: 'none' },
      language: 'en',
      updated_at: new Date().toISOString()
    });

    db.progress.push({
      progress_id: 'pr_' + Math.random().toString(36).substr(2, 9),
      profile_id: profileId,
      level: 1,
      experience: 0,
      streak: 0,
      unlockables: ['environment:aurora'],
      calm_score: 0,
      updated_at: new Date().toISOString()
    });

    await writeDb(db);

    const accessToken = jwt.sign({ user_id: userId, email: null }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token: accessToken,
      user: { user_id: userId, email: null, display_name: 'Guest Player' },
      profile_id: profileId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating guest profile' });
  }
});

// 4. Synchronization (Local-first reconciliation endpoint)
app.post('/api/sync', authenticateToken, async (req, res) => {
  const userId = req.user.user_id;
  const { profiles, progress, sessions, settings } = req.body;
  
  if (!profiles || !progress || !sessions || !settings) {
    return res.status(400).json({ error: 'Invalid sync payload' });
  }

  try {
    const db = await readDb();

    // Helper to filter/find user profiles on the server
    const userProfiles = db.profiles.filter(p => p.user_id === userId);
    const userProfileIds = userProfiles.map(p => p.profile_id);

    // Sync Profiles
    profiles.forEach(clientProfile => {
      let serverProfile = db.profiles.find(p => p.profile_id === clientProfile.profile_id);
      if (!serverProfile) {
        clientProfile.user_id = userId; // bind to this user
        db.profiles.push(clientProfile);
        userProfileIds.push(clientProfile.profile_id);
      } else if (serverProfile.user_id === userId) {
        const serverTime = new Date(serverProfile.updated_at || 0).getTime();
        const clientTime = new Date(clientProfile.updated_at || 0).getTime();
        if (clientTime > serverTime) {
          Object.assign(serverProfile, clientProfile);
        }
      }
    });

    // Sync Settings
    settings.forEach(clientSetting => {
      if (userProfileIds.includes(clientSetting.profile_id)) {
        let serverSetting = db.settings.find(s => s.profile_id === clientSetting.profile_id);
        if (!serverSetting) {
          db.settings.push(clientSetting);
        } else {
          const serverTime = new Date(serverSetting.updated_at || 0).getTime();
          const clientTime = new Date(clientSetting.updated_at || 0).getTime();
          if (clientTime > serverTime) {
            Object.assign(serverSetting, clientSetting);
          }
        }
      }
    });

    // Sync Progress
    progress.forEach(clientProgress => {
      if (userProfileIds.includes(clientProgress.profile_id)) {
        let serverProgress = db.progress.find(p => p.profile_id === clientProgress.profile_id);
        if (!serverProgress) {
          db.progress.push(clientProgress);
        } else {
          const serverTime = new Date(serverProgress.updated_at || 0).getTime();
          const clientTime = new Date(clientProgress.updated_at || 0).getTime();
          if (clientTime > serverTime) {
            serverProgress.level = Math.max(serverProgress.level, clientProgress.level);
            serverProgress.experience = Math.max(serverProgress.experience, clientProgress.experience);
            serverProgress.streak = Math.max(serverProgress.streak, clientProgress.streak);
            
            const mergedUnlockables = Array.from(new Set([...(serverProgress.unlockables || []), ...(clientProgress.unlockables || [])]));
            serverProgress.unlockables = mergedUnlockables;
            serverProgress.calm_score = Math.max(serverProgress.calm_score, clientProgress.calm_score);
            serverProgress.updated_at = clientProgress.updated_at;
          }
        }
      }
    });

    // Sync Sessions (append only, matches on session_id to avoid duplicates)
    sessions.forEach(clientSession => {
      if (userProfileIds.includes(clientSession.profile_id)) {
        let serverSession = db.sessions.find(s => s.session_id === clientSession.session_id);
        if (!serverSession) {
          db.sessions.push(clientSession);
        } else {
          const serverTime = new Date(serverSession.updated_at || 0).getTime();
          const clientTime = new Date(clientSession.updated_at || 0).getTime();
          if (clientTime > serverTime) {
            Object.assign(serverSession, clientSession);
          }
        }
      }
    });

    // Save changes
    await writeDb(db);

    // Return server state back to client
    const updatedDb = await readDb();
    res.json({
      profiles: updatedDb.profiles.filter(p => p.user_id === userId),
      settings: updatedDb.settings.filter(s => userProfileIds.includes(s.profile_id)),
      progress: updatedDb.progress.filter(pr => userProfileIds.includes(pr.profile_id)),
      sessions: updatedDb.sessions.filter(se => userProfileIds.includes(se.profile_id))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Sync failed on server' });
  }
});

// 5. User Account & Data Purge (Erase user from database completely)
app.delete('/api/user/purge', authenticateToken, async (req, res) => {
  const userId = req.user.user_id;

  try {
    const db = await readDb();

    // Find user details and profiles
    const profilesToPurge = db.profiles.filter(p => p.user_id === userId);
    const profileIdsToPurge = profilesToPurge.map(p => p.profile_id);

    // Filter out all elements belonging to this user or their profiles
    db.users = db.users.filter(u => u.user_id !== userId);
    db.devices = db.devices.filter(d => d.user_id !== userId);
    db.profiles = db.profiles.filter(p => p.user_id !== userId);
    db.settings = db.settings.filter(s => !profileIdsToPurge.includes(s.profile_id));
    db.progress = db.progress.filter(pr => !profileIdsToPurge.includes(pr.profile_id));
    db.sessions = db.sessions.filter(se => !profileIdsToPurge.includes(se.profile_id));

    await writeDb(db);

    res.json({ success: true, message: 'All personal data and progress permanently purged from cloud server.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Purge failed on server' });
  }
});

// Fallback to client layout (points to local public/index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export Express app for Vercel Serverless environment
module.exports = app;

// Start listening locally if not imported as serverless helper
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  MindFlow Backend Server running on port ${PORT}`);
    console.log(`  Local Address: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}
