const express = require('express');
const sqlite = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const path = require('path');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'pythonix_secret_key_change_in_production';
const SALT_ROUNDS = 10;

// Parse JSON bodies
app.use(express.json());
app.use(cors()); // allow frontend calls
// Serve static files (index.html, assets)
app.use(express.static(path.join(__dirname)));

// Initialize SQLite database (pythonix.db)
const db = new sqlite.Database('pythonix.db', err => {
  if (err) throw err;
  
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_login INTEGER,
      total_games INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      achievements TEXT DEFAULT '{}',
      settings TEXT DEFAULT '{}',
      is_guest BOOLEAN DEFAULT 0
    )
  `);
  
  // Enhanced scores table with user reference
  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      score INTEGER,
      game_mode TEXT DEFAULT 'classic',
      snake_skin TEXT DEFAULT 'classic',
      theme TEXT DEFAULT 'auto',
      game_duration INTEGER,
      foods_eaten INTEGER,
      timestamp INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
  
  // Game sessions for detailed analytics
  db.run(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      start_time INTEGER,
      end_time INTEGER,
      final_score INTEGER,
      game_mode TEXT,
      achievements_earned TEXT DEFAULT '[]',
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  });
};

// Optional auth middleware (allows both authenticated and guest users)
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.userId = decoded.userId;
        req.username = decoded.username;
      }
    });
  }
  next();
};

// USER AUTHENTICATION ROUTES

// Register new user
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    db.run(
      `INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      [username.toLowerCase(), email, hashedPassword, displayName || username],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Failed to create user' });
        }
        
        const token = jwt.sign({ userId: this.lastID, username: username.toLowerCase() }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ 
          token, 
          user: { 
            id: this.lastID, 
            username: username.toLowerCase(), 
            displayName: displayName || username,
            email: email
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username.toLowerCase()],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      // Update last login
      db.run('UPDATE users SET last_login = ? WHERE id = ?', [Date.now(), user.id]);
      
      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          displayName: user.display_name,
          email: user.email,
          totalGames: user.total_games,
          totalScore: user.total_score
        }
      });
    }
  );
});

// Create guest account
app.post('/auth/guest', (req, res) => {
  const guestName = `Guest_${Date.now().toString().slice(-6)}`;
  
  db.run(
    `INSERT INTO users (username, display_name, password_hash, is_guest) VALUES (?, ?, '', 1)`,
    [guestName.toLowerCase(), guestName],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create guest account' });
      }
      
      const token = jwt.sign({ userId: this.lastID, username: guestName.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ 
        token, 
        user: { 
          id: this.lastID, 
          username: guestName.toLowerCase(), 
          displayName: guestName,
          isGuest: true
        }
      });
    }
  );
});

// Get user profile
app.get('/auth/profile', verifyToken, (req, res) => {
  db.get(
    'SELECT id, username, display_name, email, total_games, total_score, achievements, settings, created_at, is_guest FROM users WHERE id = ?',
    [req.userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        totalGames: user.total_games,
        totalScore: user.total_score,
        achievements: JSON.parse(user.achievements || '{}'),
        settings: JSON.parse(user.settings || '{}'),
        createdAt: user.created_at,
        isGuest: user.is_guest
      });
    }
  );
});

// LEADERBOARD ROUTES

// Get global leaderboard
app.get('/leaderboard/global', optionalAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const gameMode = req.query.mode || 'classic';
  
  const query = `
    SELECT 
      u.display_name as displayName,
      u.username,
      MAX(s.score) as highScore,
      COUNT(s.id) as gamesPlayed,
      SUM(s.foods_eaten) as totalFoodsEaten,
      u.is_guest as isGuest,
      ROW_NUMBER() OVER (ORDER BY MAX(s.score) DESC) as rank
    FROM users u
    LEFT JOIN scores s ON u.id = s.user_id AND s.game_mode = ?
    WHERE s.score IS NOT NULL
    GROUP BY u.id
    ORDER BY highScore DESC
    LIMIT ?
  `;
  
  db.all(query, [gameMode, limit], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Add current user's rank if authenticated
    if (req.userId) {
      const userRankQuery = `
        SELECT COUNT(*) + 1 as userRank
        FROM (
          SELECT MAX(s.score) as maxScore
          FROM users u
          LEFT JOIN scores s ON u.id = s.user_id AND s.game_mode = ?
          WHERE s.score IS NOT NULL
          GROUP BY u.id
          HAVING maxScore > (
            SELECT MAX(score) FROM scores WHERE user_id = ? AND game_mode = ?
          )
        )
      `;
      
      db.get(userRankQuery, [gameMode, req.userId, gameMode], (err, rankResult) => {
        if (!err && rankResult) {
          res.json({ leaderboard: rows, userRank: rankResult.userRank });
        } else {
          res.json({ leaderboard: rows });
        }
      });
    } else {
      res.json({ leaderboard: rows });
    }
  });
});

// Get user's personal best scores
app.get('/leaderboard/personal', verifyToken, (req, res) => {
  const query = `
    SELECT 
      score,
      game_mode as gameMode,
      snake_skin as snakeSkin,
      theme,
      foods_eaten as foodsEaten,
      game_duration as gameDuration,
      timestamp
    FROM scores 
    WHERE user_id = ?
    ORDER BY score DESC
    LIMIT 10
  `;
  
  db.all(query, [req.userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// SCORE SUBMISSION

// POST a new score (enhanced)
app.post('/scores', optionalAuth, (req, res) => {
  const { score, gameMode, snakeSkin, theme, gameDuration, foodsEaten } = req.body;
  const userId = req.userId || null;
  const username = req.username || 'Anonymous';
  
  if (!score || score < 0) {
    return res.status(400).json({ error: 'Valid score is required' });
  }
  
  db.run(
    `INSERT INTO scores (user_id, username, score, game_mode, snake_skin, theme, game_duration, foods_eaten) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, username, score, gameMode || 'classic', snakeSkin || 'classic', theme || 'auto', gameDuration || 0, foodsEaten || 0],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Update user stats if authenticated
      if (userId) {
        db.run(
          'UPDATE users SET total_games = total_games + 1, total_score = total_score + ? WHERE id = ?',
          [score, userId]
        );
      }
      
      res.json({ id: this.lastID, message: 'Score saved successfully' });
    }
  );
});

// PROGRESS PERSISTENCE

// Save user settings
app.post('/user/settings', verifyToken, (req, res) => {
  const settings = JSON.stringify(req.body);
  
  db.run(
    'UPDATE users SET settings = ? WHERE id = ?',
    [settings, req.userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to save settings' });
      }
      res.json({ message: 'Settings saved successfully' });
    }
  );
});

// Save user achievements
app.post('/user/achievements', verifyToken, (req, res) => {
  const achievements = JSON.stringify(req.body);
  
  db.run(
    'UPDATE users SET achievements = ? WHERE id = ?',
    [achievements, req.userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to save achievements' });
      }
      res.json({ message: 'Achievements saved successfully' });
    }
  );
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pythonix API listening on port ${PORT}`));
