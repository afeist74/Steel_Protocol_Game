/**
 * CYBER-STRIKE: CORE ENGINE
 * Integrated: Entity Collision, Audio Controls, and Victory/Loss SFX
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ASSETS ---
const assets = {
    hero: new Image(),
    enemy: new Image(),
    boss: new Image(),
    bg: new Image()
};
assets.hero.src = 'https://i.postimg.cc/KvtzHkS9/Gemini-Generated-Image-p36auqp36auqp36a-removebg-preview.png'; 
assets.enemy.src = 'https://i.postimg.cc/1zBVYg65/Gemini-Generated-Image-eofx5meofx5meofx-1-removebg-preview.png';
assets.boss.src = 'https://i.postimg.cc/YS2CjMn5/Gemini-Generated-Image-n6d750n6d750n6d7.png'; 
assets.bg.src = 'https://i.postimg.cc/q7FjgMBQ/Gemini-Generated-Image-l7z8dal7z8dal7z8.png'; 

// --- AUDIO ASSETS ---
const sfxSwing = new Audio('https://tory-lime-lgsreuafsc.edgeone.app/freesound_community-swing3-94210.mp3');
const musicLevel1 = new Audio('https://linear-lime-pds9dwrgvd.edgeone.app/Chrome%20Alley%20Run.mp3');
const musicBoss = new Audio('https://lesser-olive-2bsmoxwhln.edgeone.app/Bossfight%20Foundry.mp3');
const sfxVictory = new Audio('https://independent-rose-chqto9lzev.edgeone.app/eaglaxle-gaming-victory-464016.mp3');
const sfxLoss = new Audio('https://wily-aquamarine-wrmz7ordox.edgeone.app/soundreality-tv-shut-down-185446.mp3');

// Audio Configuration
musicLevel1.loop = true;
musicBoss.loop = true;
musicLevel1.volume = 0.4; 
musicBoss.volume = 0.5;
sfxVictory.volume = 0.6;
sfxLoss.volume = 0.6;

// Plays background tracks handling browser interaction limits
async function playTrack(track) {
    try {
        await track.play();
    } catch (err) {
        console.warn("Audio blocked. Waiting for user interaction...");
        const unlock = () => {
            track.play();
            document.removeEventListener('click', unlock);
            document.removeEventListener('keydown', unlock);
        };
        document.addEventListener('click', unlock);
        document.addEventListener('keydown', unlock);
    }
}

// FIXED: Only stops background music so it doesn't cancel SFX playing on the same frame
function stopBGM() {
    [musicLevel1, musicBoss].forEach(track => {
        track.pause();
        try { track.currentTime = 0; } catch (e) {} // catch uninitialized media errors
    });
}

// Halts all audio for complete resets (like rebooting the game)
function stopAllAudio() {
    [musicLevel1, musicBoss, sfxVictory, sfxLoss].forEach(track => {
        track.pause();
        try { track.currentTime = 0; } catch (e) {}
    });
}

// --- PHYSICS & STATE ---
const GRAVITY = 0.6;
const FRICTION = 0.8;
let gameActive = false;
let gameState = "playing"; 
let currentLevel = 1;
const keys = {};

const player = {
    x: 100, y: 0, w: 40, h: 60,
    vx: 0, vy: 0, speed: 5, jumpPower: -17,
    grounded: false, hp: 100, facingLeft: false,
    isAttacking: false, attackTimer: 0
};

let platforms = [];
let enemies = [];
let boss = null;

// --- INITIALIZATION ---
window.startGame = function(mode) {
    document.getElementById('menu').classList.add('hidden');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    stopAllAudio();
    playTrack(musicLevel1); 
    
    initLevel1(mode);
    gameActive = true;
    gameState = "playing";
    requestAnimationFrame(update);
};

window.rebootGame = function() {
    document.getElementById('overlay').classList.add('hidden');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    stopAllAudio();
    playTrack(musicLevel1);
    
    initLevel1('normal');
    gameActive = true;
    gameState = "playing";
    requestAnimationFrame(update);
};

function initLevel1(mode) {
    currentLevel = 1; player.hp = 100;
    player.x = 100; player.y = 0;
    player.vx = 0; player.vy = 0;
    boss = null;
    platforms = [
        { x: -1000, y: 600, w: 5000, h: 200 },
        { x: 300, y: 450, w: 200, h: 20 },
        { x: 600, y: 350, w: 200, h: 20 },
        { x: 100, y: 250, w: 150, h: 20 }
    ];
    const count = mode === 'hard' ? 6 : 3;
    enemies = [];
    for(let i=0; i<count; i++) {
        enemies.push({ x: 400 + (i*400), y: 0, w: 40, h: 40, hp: 30, vx: 2, vy: 0 });
    }
}

function nextLevel() {
    currentLevel = 2; enemies = [];
    player.x = 50; player.y = 0;
    stopAllAudio();
    playTrack(musicBoss);
    platforms = [
        { x: -1000, y: canvas.height - 100, w: 5000, h: 100 },
        { x: 200, y: canvas.height - 300, w: 300, h: 20 },
        { x: canvas.width - 500, y: canvas.height - 300, w: 300, h: 20 }
    ];
    boss = { x: canvas.width - 300, y: 0, w: 120, h: 150, hp: 200, maxHp: 200, vx: -3, vy: 0 };
}

// --- COLLISION ---
function handleSolidCollision(entity, plat) {
    if (entity.x + entity.w > plat.x && entity.x < plat.x + plat.w) {
        if (entity.y + entity.h > plat.y && entity.y < plat.y + plat.h) {
            if (entity.vy > 0 && entity.y + entity.h - entity.vy <= plat.y) {
                entity.y = plat.y - entity.h; entity.vy = 0; entity.grounded = true;
            }
        }
    }
}

function resolveEntityCollision(p, e) {
    if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
        let overlapX = (p.x + p.w / 2 < e.x + e.w / 2) ? (p.x + p.w) - e.x : p.x - (e.x + e.w);
        let overlapY = (p.y + p.h / 2 < e.y + e.h / 2) ? (p.y + p.h) - e.y : p.y - (e.h + e.y);
        if (Math.abs(overlapX) < Math.abs(overlapY)) { p.x -= overlapX; p.vx = 0; }
        else if (Math.abs(overlapY) < 15) { p.y -= overlapY; p.vy = 0; }
    }
}

// --- INPUTS ---
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyX' && gameActive && player.attackTimer === 0) { 
        player.isAttacking = true; player.attackTimer = 15; 
        sfxSwing.currentTime = 0; 
        sfxSwing.play().catch(() => {});
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

// --- UPDATE LOOP ---
function update() {
    if (!gameActive || gameState !== "playing") return;
    if (currentLevel === 1 && enemies.length === 0) nextLevel();

    if (keys['KeyA'] || keys['ArrowLeft']) { player.vx = -player.speed; player.facingLeft = true; }
    else if (keys['KeyD'] || keys['ArrowRight']) { player.vx = player.speed; player.facingLeft = false; }
    else { player.vx *= FRICTION; }

    player.vy += GRAVITY; player.x += player.vx; player.y += player.vy; player.grounded = false;
    enemies.forEach(en => { en.vy += GRAVITY; en.y += en.vy; en.x += en.vx; });
    if (boss) { boss.vy += GRAVITY; boss.y += boss.vy; boss.x += boss.vx; }

    platforms.forEach(plat => {
        handleSolidCollision(player, plat);
        enemies.forEach(en => handleSolidCollision(en, plat));
        if (boss) handleSolidCollision(boss, plat);
    });

    enemies.forEach(en => resolveEntityCollision(player, en));
    if (boss) resolveEntityCollision(player, boss);
    enemies.forEach(en => { if (en.x <= 0 || en.x + en.w >= canvas.width) en.vx *= -1; });
    if (boss && (boss.x <= 0 || boss.x + boss.w >= canvas.width)) boss.vx *= -1;

    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && player.grounded) {
        player.vy = player.jumpPower; player.grounded = false;
    }

    // Combat Loop
    if (player.attackTimer > 0) {
        player.attackTimer--;
        const atkRange = player.facingLeft ? player.x - 60 : player.x + player.w;
        enemies.forEach((en, i) => {
            if (Math.abs(atkRange - en.x) < 50 && Math.abs(player.y - en.y) < 50) {
                en.hp -= 2; if (en.hp <= 0) enemies.splice(i, 1);
            }
        });
        if (boss && Math.abs(atkRange - boss.x) < 100 && Math.abs(player.y - boss.y) < 100) {
            boss.hp -= 1; 
            if (boss.hp <= 0) { 
                gameState = "victory"; gameActive = false; 
                stopBGM(); // Only stop the BGM, not the SFX
                
                try { sfxVictory.currentTime = 0; } catch (e) {}
                sfxVictory.play().catch(e => console.warn("Victory Audio Error:", e));
                
                showEndScreen("VICTORY: BOSS DEFEATED", "#00f3ff"); 
                return; // FIXED: Added return to prevent double triggers
            }
        }
    } else { player.isAttacking = false; }

    enemies.forEach(en => { if (Math.abs(player.x - en.x) < 30 && Math.abs(player.y - en.y) < 30) player.hp -= 0.3; });
    if (boss && Math.abs(player.x - boss.x) < 70 && Math.abs(player.y - boss.y) < 80) player.hp -= 0.5;

    if (player.hp <= 0) { 
        player.hp = 0; gameState = "defeated"; gameActive = false; 
        stopBGM(); // Only stop the BGM, not the SFX
        
        try { sfxLoss.currentTime = 0; } catch (e) {}
        sfxLoss.play().catch(e => console.warn("Loss Audio Error:", e)); 
        
        showEndScreen("SYSTEM FAILURE", "#ff003c"); 
        return; // FIXED: Added return to prevent overlapping logic errors
    }

    draw();
    requestAnimationFrame(update);
}

function showEndScreen(text, color) {
    const overlay = document.getElementById('overlay');
    const status = document.getElementById('status-text');
    overlay.classList.remove('hidden');
    status.innerText = text; status.style.color = color;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (assets.bg.complete) ctx.drawImage(assets.bg, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white"; ctx.font = "bold 16px Courier New";
    ctx.fillText(`LEVEL: ${currentLevel}`, 20, 30);
    ctx.fillStyle = "#111"; ctx.fillRect(20, 40, 200, 15);
    ctx.fillStyle = player.hp > 30 ? "#00f3ff" : "#ff003c";
    ctx.fillRect(20, 40, (player.hp / 100) * 200, 15);

    if (boss) {
        const barWidth = canvas.width * 0.6;
        const barX = (canvas.width - barWidth) / 2;
        ctx.fillStyle = "#111"; ctx.fillRect(barX, 20, barWidth, 20);
        ctx.fillStyle = "#8800ff"; ctx.fillRect(barX, 20, (boss.hp / boss.maxHp) * barWidth, 20);
    }

    ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
    platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));

    ctx.save();
    if (player.facingLeft) { ctx.scale(-1, 1); ctx.drawImage(assets.hero, -player.x - player.w, player.y, player.w, player.h); }
    else { ctx.drawImage(assets.hero, player.x, player.y, player.w, player.h); }
    ctx.restore();

    if (player.isAttacking) {
        ctx.fillStyle = 'rgba(0, 243, 255, 0.5)';
        const atkX = player.facingLeft ? player.x - 40 : player.x + player.w;
        ctx.fillRect(atkX, player.y, 40, player.h);
    }

    enemies.forEach(en => ctx.drawImage(assets.enemy, en.x, en.y, en.w, en.h));
    if (boss) ctx.drawImage(assets.boss, boss.x, boss.y, boss.w, boss.h);
}
