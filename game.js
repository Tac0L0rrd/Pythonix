// Consolidated game logic with power-ups & hazards
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let boxSize = 40, boardWidth, boardHeight;
let snake, direction, pendingDirection, food;
let score, highScore = +localStorage.getItem('pythonixHighScore') || 0;
let foodsEaten = 0, multiplierActive = false;
let speed = 150, baseSpeed, gameInterval;

// Make variables globally accessible for keyboard handler
window.pendingDirection = null;
window.direction = 'RIGHT';

// Define gradients (reuse existing ones or redefine here)
const gradients = [];
function createGradient(colors) {
  const g = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));
  return g;
}
grads = [['#55AA55','#88CC88'],['#3366FF','#66AAFF'],['#DD3333','#FF6666'],['#FF0000','#FFBB00','#00FF00','#00BBFF','#FF00FF'],['#AA55AA','#DD88DD']];
grads.forEach(c=>gradients.push(createGradient(c)));

const eatSound = new Audio('eat.mp3');
eatSound.volume=0.5;
const powerSound = new Audio('powerup.mp3');
powerSound.volume=0.5;
const gameOverSound = new Audio('gameover.mp3');
gameOverSound.volume=0.5;

// Add global volume control for game.js sounds
window.updateGameJsVolume = function(volume) {
  eatSound.volume = volume;
  powerSound.volume = volume;
  gameOverSound.volume = volume;
};

function resizeCanvas(){
  canvas.width = Math.floor(window.innerWidth/boxSize)*boxSize;
  canvas.height= Math.floor(window.innerHeight/boxSize)*boxSize;
  boardWidth = canvas.width/boxSize;
  boardHeight= canvas.height/boxSize;
}

function startGame(){
  document.getElementById('introScreen').style.display='none';
  resizeCanvas();
  snake = [{x:Math.floor(boardWidth/2),y:Math.floor(boardHeight/2)}];
  direction='RIGHT';
  pendingDirection=null;
  
  // Sync with window variables for keyboard handler
  window.direction = direction;
  window.pendingDirection = pendingDirection;
  
  score=0;foodsEaten=0;baseSpeed=speed;
  food=randomFood();
  clearInterval(gameInterval);
  gameInterval=setInterval(gameLoop,speed);
  drawBoard();
}

function randomFood(){
  const types=['normal','power','slow','hazard'];
  const w=[0.7,0.1,0.1,0.1];
  let s=w.reduce((a,b)=>a+b,0),r=Math.random()*s, t;
  for(let i=0;i<types.length;i++){
    if(r<w[i]){t=types[i];break;}r-=w[i];
  }
  let pos;
  do{pos={x:Math.floor(Math.random()*boardWidth),y:Math.floor(Math.random()*boardHeight)}}
  while(snake.some(s=>s.x===pos.x&&s.y===pos.y));
  return{...pos,type:t};
}

function drawBoard(){
  ctx.fillStyle='#f7fffe';ctx.fillRect(0,0,canvas.width,canvas.height);
  // grid
  for(let y=0;y<boardHeight;y++)for(let x=0;x<boardWidth;x++){
    ctx.fillStyle=((x+y)%2? '#8CCF7E':'#A8DBA8');
    ctx.fillRect(x*boxSize,y*boxSize,boxSize,boxSize);
    ctx.strokeStyle='#6c7a89';ctx.lineWidth=1;
    ctx.strokeRect(x*boxSize,y*boxSize,boxSize,boxSize);
  }
  // food
  let fx=(food.x+0.5)*boxSize,fy=(food.y+0.5)*boxSize;
  if(food.type==='power'){
    ctx.fillStyle='#FFD700';ctx.beginPath();
    for(let i=0;i<5;i++){let a=i*2*Math.PI/5-Math.PI/2;
      ctx.lineTo(fx+Math.cos(a)*boxSize*0.4,fy+Math.sin(a)*boxSize*0.4);
      a+=Math.PI/5;ctx.lineTo(fx+Math.cos(a)*boxSize*0.2,fy+Math.sin(a)*boxSize*0.2);
    }
    ctx.closePath();ctx.fill();
  }else if(food.type==='slow'){
    ctx.font=`${boxSize*0.8}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#666';ctx.fillText('🐌',fx,fy);
  }else if(food.type==='hazard'){
    ctx.font=`${boxSize*0.8}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#000';ctx.fillText('💀',fx,fy);
  }else{
    ctx.fillStyle='#E32727';ctx.beginPath();ctx.arc(fx,fy,boxSize*0.4,0,2*Math.PI);ctx.fill();
  }
  // snake
  snake.forEach(s=>{let cx=(s.x+0.5)*boxSize,cy=(s.y+0.5)*boxSize;
    ctx.fillStyle=gradients[0];ctx.beginPath();ctx.arc(cx,cy,boxSize*0.45,0,2*Math.PI);ctx.fill();
  });
}

function gameLoop(){
  // Sync pendingDirection from window
  if(window.pendingDirection) {
    pendingDirection = window.pendingDirection;
    window.pendingDirection = null;
  }
  
  if(pendingDirection)direction=pendingDirection;
  pendingDirection=null;
  
  // Sync direction to window
  window.direction = direction;
  
  let head={...snake[snake.length-1]};
  if(direction==='LEFT')head.x--;if(direction==='RIGHT')head.x++;
  if(direction==='UP')head.y--;if(direction==='DOWN')head.y++;
  
  // Handle wall wrapping
  if(head.x<0)head.x=boardWidth-1;
  if(head.x>=boardWidth)head.x=0;
  if(head.y<0)head.y=boardHeight-1;
  if(head.y>=boardHeight)head.y=0;
  
  if(snake.some(s=>s.x===head.x&&s.y===head.y)){
    clearInterval(gameInterval);gameOverSound.play();return;
  }
  snake.push(head);
  if(head.x===food.x&&head.y===food.y){
    if(food.type==='hazard'){clearInterval(gameInterval);gameOverSound.play();return;}
    if(food.type==='slow'){speed=baseSpeed*2;clearInterval(gameInterval);gameInterval=setInterval(gameLoop,speed);}    
    if(food.type==='power'){multiplierActive=true;setTimeout(()=>multiplierActive=false,10000);powerSound.play();}    
    eatSound.play();score++;food=randomFood();
  }else snake.shift();
  drawBoard();
}

document.getElementById('startBtn').onclick=startGame;
// Keyboard handling is done by the capture-phase handler in HTML
