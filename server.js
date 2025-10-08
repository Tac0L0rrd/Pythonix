const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files (index.html, assets)
app.use(express.static(path.join(__dirname)));

// Basic route to serve the game
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Pythonix game server listening on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to play!`);
});
