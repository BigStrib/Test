const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score'), oppScoreEl = document.getElementById('opp-score-ui');
const timerEl = document.getElementById('timer'), startBtn = document.getElementById('trigger-start');

// Game State
let gameState = 'MENU', timeLeft = 60, score = 0, opponentScore = 0;
let preGameCount = 3; // The 3, 2, 1 countdown!
let isOffline = true, isHost = false, peer, conn, coins = [], obstacles = [];

// Player Objects
const p1 = { x: 100, y: 300, size: 30, color: '#3498db', speed: 5 };
const p2 = { x: 600, y: 300, size: 30, color: '#e67e22', speed: 4 };

// --- NETWORKING! ---
function initPeer(id, mode) {
    peer = new Peer('char-' + id);
    peer.on('open', () => {
        document.getElementById('setup-view').classList.add('hidden');
        document.getElementById('lobby-view').classList.remove('hidden');
        if (mode === 'join') {
            conn = peer.connect('char-' + id);
            setupConnection();
        } else {
            isHost = true;
            document.getElementById('lobby-status').innerText = "Room: " + id + " | Waiting for Guest...";
        }
    });
    peer.on('connection', (c) => { conn = c; setupConnection(); });
    peer.on('error', () => alert("ID Busy or Error."));
}

function setupConnection() {
    isOffline = false;
    conn.on('open', () => {
        document.getElementById('lobby-status').innerText = "Connected! Ready to start.";
        if (isHost) startBtn.classList.remove('hidden');
    });
    conn.on('data', data => {
        if (data.type === 'move') { p2.x = data.x; p2.y = data.y; }
        if (data.type === 'sync') { coins = data.coins; obstacles = data.obstacles; opponentScore = data.score; }
        if (data.type === 'start') startCountdown();
    });
}

// --- CONTROLS ---
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

const setupTouch = (id, key) => {
    const b = document.getElementById(id);
    b.ontouchstart = (e) => { e.preventDefault(); keys[key] = true; };
    b.ontouchend = (e) => { e.preventDefault(); keys[key] = false; };
};
['up','down','left','right'].forEach(dir => setupTouch('btn-'+dir, 'Arrow'+dir.charAt(0).toUpperCase()+dir.slice(1)));

// --- GAME FLOW ---
function spawnItems() {
    coins = Array.from({length: 8}, () => ({x: 50 + Math.random()*700, y: 50 + Math.random()*500}));
    obstacles = Array.from({length: 5}, () => ({x: 50 + Math.random()*700, y: 50 + Math.random()*500}));
}

function startCountdown() {
    document.getElementById('menu-overlay').classList.add('hidden');
    gameState = 'COUNTDOWN';
    preGameCount = 3;
    
    if (isHost || isOffline) spawnItems();
    if (isHost && conn) conn.send({type: 'start'});

    const timer = setInterval(() => {
        preGameCount--;
        if (preGameCount <= 0) {
            clearInterval(timer);
            runActualGame();
        }
    }, 1000);
    requestAnimationFrame(gameLoop);
}

function runActualGame() {
    gameState = 'PLAYING';
    const clock = setInterval(() => {
        timeLeft--;
        timerEl.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(clock);
            gameState = 'OVER';
            showEnd();
        }
    }, 1000);
}

function gameLoop() {
    if (gameState === 'MENU' || gameState === 'OVER') return;

    if (gameState === 'PLAYING') {
        // Local Player Movement
        if (keys['ArrowUp'] && p1.y > 0) p1.y -= p1.speed;
        if (keys['ArrowDown'] && p1.y < canvas.height - 30) p1.y += p1.speed;
        if (keys['ArrowLeft'] && p1.x > 0) p1.x -= p1.speed;
        if (keys['ArrowRight'] && p1.x < canvas.width - 30) p1.x += p1.speed;

        if (isOffline) { // Bot Logic
            let t = coins[0];
            if (t) {
                p2.x += p2.x < t.x ? 3 : -3;
                p2.y += p2.y < t.y ? 3 : -3;
            }
        }

        // Logic only run by Host or Offline to keep coins synced
        if (isHost || isOffline) {
            [p1, p2].forEach((p, idx) => {
                coins.forEach((c, i) => {
                    if (Math.hypot(p.x+15 - c.x, p.y+15 - c.y) < 25) {
                        coins[i] = {x: 50 + Math.random()*700, y: 50 + Math.random()*500};
                        idx === 0 ? score++ : opponentScore++;
                    }
                });
                obstacles.forEach((o, i) => {
                    if (Math.hypot(p.x+15 - (o.x+12), p.y+15 - (o.y+12)) < 25) {
                        obstacles[i] = {x: 50 + Math.random()*700, y: 50 + Math.random()*500};
                        idx === 0 ? score = Math.max(0, score-1) : opponentScore = Math.max(0, opponentScore-1);
                    }
                });
            });
            if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 30) {
                score = Math.max(0, score - 1); opponentScore = Math.max(0, opponentScore - 1);
                p1.x -= 50; p2.x += 50;
            }
        }

        if (conn && conn.open) {
            conn.send({type: 'move', x: p1.x, y: p1.y});
            if (isHost) conn.send({type: 'sync', coins, obstacles, score});
        }
    }

    render();
    requestAnimationFrame(gameLoop);
}

function render() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Items
    ctx.fillStyle = '#f1c40f';
    coins.forEach(c => { ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#e74c3c';
    obstacles.forEach(o => ctx.fillRect(o.x, o.y, 25, 25));

    // Players
    ctx.fillStyle = p1.color; ctx.fillRect(p1.x, p1.y, 30, 30);
    ctx.fillStyle = p2.color; ctx.fillRect(p2.x, p2.y, 30, 30);

    // Overlay Countdown
    if (gameState === 'COUNTDOWN') {
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0,0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "bold 120px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(preGameCount > 0 ? preGameCount : "GO!", canvas.width/2, canvas.height/2 + 40);
    }

    scoreEl.innerText = score;
    oppScoreEl.innerText = opponentScore;
}

function showEnd() {
    document.getElementById('game-over').classList.remove('hidden');
    let res = "Draw!";
    if (score > opponentScore) res = "Player 1 Wins!";
    else if (opponentScore > score) res = "Player 2 Wins!";
    document.getElementById('winner-text').innerText = res;
    document.getElementById('final-score-display').innerText = `Final: ${score} - ${opponentScore}`;
}

document.getElementById('host-btn').onclick = () => initPeer(document.getElementById('custom-id-input').value, 'host');
document.getElementById('join-btn').onclick = () => initPeer(document.getElementById('custom-id-input').value, 'join');
document.getElementById('start-bot').onclick = () => startCountdown();
startBtn.onclick = () => startCountdown();


window.onload = () => { canvas.width = 800; canvas.height = 600; };

