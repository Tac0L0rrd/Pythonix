const express = require('express');
const sqlite = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const path = require('path');
// Parse JSON bodies
app.use(express.json());
app.use(cors()); // allow frontend calls
// Serve static files (index.html, assets)
app.use(express.static(path.join(__dirname)));

// Initialize SQLite database (pythonix.db)
const db = new sqlite.Database('pythonix.db', err => {
  if (err) throw err;
  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      score INTEGER,
      ts INTEGER
    )
  `);
});

// GET top 10 scores
app.get('/scores', (req, res) => {
  db.all(
  'SELECT name, score FROM scores ORDER BY score DESC LIMIT 5',
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST a new score
app.post('/scores', (req, res) => {
  const { name, score } = req.body;
  const ts = Date.now();
  db.run(
    'INSERT INTO scores(name, score, ts) VALUES (?, ?, ?)',
    [name, score, ts],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pythonix API listening on port ${PORT}`));
