// Sound effects
const eatSound = new Audio('eat.mp3');
const powerSound = new Audio('powerup.mp3');
const gameOverSound = new Audio('gameover.mp3');

// Add global volume control for game.js sounds
window.updateGameJsVolume = function(volume) {
  eatSound.volume = volume;
  powerSound.volume = volume;
  gameOverSound.volume = volume;
};
