import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

// --- Constants ---
const GAME_DURATION = 60;

// --- Audio System (Retro 8-bit) ---
const NOTES = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
  SILENCE: 0
};

type Note = { freq: number, dur: number };

// Melodies for each level
const MELODIES: Record<number, Note[]> = {
  0: [ // Menu: Relaxed / Title Screen
    { freq: NOTES.E4, dur: 0.2 }, { freq: NOTES.B3, dur: 0.2 }, { freq: NOTES.C4, dur: 0.2 }, { freq: NOTES.D4, dur: 0.2 },
    { freq: NOTES.C4, dur: 0.2 }, { freq: NOTES.B3, dur: 0.2 }, { freq: NOTES.A3, dur: 0.4 }, 
    { freq: NOTES.A3, dur: 0.2 }, { freq: NOTES.C4, dur: 0.2 }, { freq: NOTES.E4, dur: 0.2 }, { freq: NOTES.D4, dur: 0.2 }, 
    { freq: NOTES.C4, dur: 0.2 }, { freq: NOTES.B3, dur: 0.4 }
  ],
  1: [], 
  2: [],
  3: []
};

class SoundManager {
  ctx: AudioContext | null = null;
  bgmOsc: OscillatorNode | null = null;
  bgmGain: GainNode | null = null;
  bgmTimeout: number | null = null;
  isPlaying: boolean = false;
  currentLevel: number = 0;
  noteIndex: number = 0;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playSFX(type: 'shoot' | 'hit' | 'timesup' | 'gameover') {
    this.init();
    if (type === 'shoot') {
      this.playTone(600, 'square', 0.1, 0.05);
      setTimeout(() => this.playTone(800, 'square', 0.1, 0.05), 50);
    } else if (type === 'hit') {
      this.playTone(150, 'sawtooth', 0.2, 0.1);
    } else if (type === 'timesup') {
      this.playTone(880, 'square', 0.5, 0.1);
      setTimeout(() => this.playTone(440, 'square', 0.5, 0.1), 300);
    } else if (type === 'gameover') {
      this.playTone(300, 'sawtooth', 0.3, 0.2);
      setTimeout(() => this.playTone(250, 'sawtooth', 0.3, 0.2), 300);
      setTimeout(() => this.playTone(200, 'sawtooth', 0.6, 0.2), 600);
    }
  }

  playBGM(level: number) {
    this.init();
    this.stopBGM();
    
    if (level !== 0) return;

    this.currentLevel = level;
    this.isPlaying = true;
    this.noteIndex = 0;
    this.playNextNote();
  }

  playNextNote() {
    if (!this.isPlaying || !this.ctx) return;
    
    const melody = MELODIES[this.currentLevel];
    if (!melody || melody.length === 0) return;

    const note = melody[this.noteIndex % melody.length];
    
    if (note.freq > 0) {
      this.bgmOsc = this.ctx.createOscillator();
      this.bgmGain = this.ctx.createGain();
      this.bgmOsc.type = 'square'; 
      this.bgmOsc.frequency.setValueAtTime(note.freq, this.ctx.currentTime);
      this.bgmOsc.connect(this.bgmGain);
      this.bgmGain.connect(this.ctx.destination);
      this.bgmGain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      this.bgmGain.gain.setValueAtTime(0.03, this.ctx.currentTime + note.dur - 0.05);
      this.bgmGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + note.dur);
      this.bgmOsc.start();
      this.bgmOsc.stop(this.ctx.currentTime + note.dur);
    }

    this.noteIndex++;
    this.bgmTimeout = window.setTimeout(() => this.playNextNote(), note.dur * 1000);
  }

  stopBGM() {
    this.isPlaying = false;
    if (this.bgmTimeout) clearTimeout(this.bgmTimeout);
    if (this.bgmOsc) {
      try { this.bgmOsc.stop(); } catch (e) {}
      this.bgmOsc = null;
    }
  }
}

const soundManager = new SoundManager();

// --- Background & Visuals ---
const LEVEL_IMAGES = {
  1: "https://lh3.googleusercontent.com/d/1JUcHxpLWZ9KXAsTxrG5l2XLO7J2dEHKQ?q=80&w=1000&auto=format&fit=crop", 
  2: "https://lh3.googleusercontent.com/d/1Y4sjh-PVZVMhqaaOvW063fU2X3h6HEC1?q=80&w=1000&auto=format&fit=crop", 
  3: "https://lh3.googleusercontent.com/d/1MQ4UL2Hi1ZBSSggzc_5rXvOgVfic9maf?q=80&w=1000&auto=format&fit=crop"  
};

const getLevelBackgroundHTML = (level: number) => {
  const bgUrl = LEVEL_IMAGES[level as keyof typeof LEVEL_IMAGES] || LEVEL_IMAGES[1];
  return `
    <img src="${bgUrl}" alt="Level Background" class="absolute inset-0 w-full h-full object-cover z-0 select-none pixelated" style="image-rendering: pixelated;" />
    <div class="absolute inset-0 bg-black/20 z-1" style="background-image: linear-gradient(transparent 50%, rgba(0,0,0,0.1) 50%); background-size: 100% 4px;"></div>
    
    <!-- Ground Base for Wizard -->
    <div class="absolute bottom-0 w-full h-16 bg-[#3a2c1e] border-t-4 border-black z-2"></div>

    <!-- Wizard: Explicit inline style for centering -->
    <div class="absolute bottom-[120px] left-1/2 -translate-x-1/2 w-24 h-24 text-7xl z-10 flex items-end justify-center filter drop-shadow-[4px_4px_0_rgba(0,0,0,1)]" 
         style="left: 50%; transform: translateX(-50%); bottom: 120px;"
         id="wizard-sprite">
      🧙‍♂️
    </div>
  `;
};

const getEnemyStyle = (level: number) => {
  switch(level) {
    case 1: return "bg-[#2c3e50] text-white border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]"; 
    case 2: return "bg-[#d35400] text-white border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]";
    case 3: return "bg-[#c0392b] text-white border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]";
    default: return "bg-black text-white";
  }
};

// --- Game Component ---
const MagicMathDefense = () => {
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const finalScoreRef = useRef<HTMLSpanElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const startScreenRef = useRef<HTMLDivElement>(null);
  const gameOverScreenRef = useRef<HTMLDivElement>(null);
  const gameOverTitleRef = useRef<HTMLHeadingElement>(null);
  const startHighScoreRef = useRef<HTMLSpanElement>(null);
  const gameOverHighScoreRef = useRef<HTMLSpanElement>(null);

  const [currentLevelUI, setCurrentLevelUI] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Game state
  const gameState = useRef({
    level: 1,
    score: 0,
    isPlaying: false,
    isPaused: false,
    isGameActive: false,
    elapsedTime: 0,
    spawnRate: 2000,
    enemySpeed: 1,
    lastSpawnTime: 0,
    enemies: [] as any[],
    animationFrameId: 0,
  });

  useEffect(() => {
    const savedHighScore = localStorage.getItem('magicMathHighScore') || '0';
    if (startHighScoreRef.current) startHighScoreRef.current.innerText = savedHighScore;
    if (gameOverHighScoreRef.current) gameOverHighScoreRef.current.innerText = savedHighScore;

    const handleInteraction = () => {
        soundManager.init();
        if (!gameState.current.isGameActive) {
            soundManager.playBGM(0);
        }
    };
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      cancelAnimationFrame(gameState.current.animationFrameId);
      soundManager.stopBGM();
    };
  }, []);

  const generateProblem = (level: number) => {
    let maxSum = 20;
    let minSum = 2;

    if (level === 2) {
        maxSum = 50;
        minSum = 10; 
    } else if (level === 3) {
        maxSum = 100;
        minSum = 20; 
    }

    const answer = Math.floor(Math.random() * (maxSum - minSum + 1)) + minSum;
    const num1 = Math.floor(Math.random() * (answer - 1)) + 1;
    const num2 = answer - num1;

    return {
      text: `${num1} + ${num2}`,
      answer: answer
    };
  };

  const createEnemy = () => {
    const state = gameState.current;
    if (!gameAreaRef.current) return;

    const problem = generateProblem(state.level); 
    const element = document.createElement('div');
    
    element.style.cssText = `
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 2;
      font-family: 'Press Start 2P', cursive;
    `;
    
    const monsters = ['👺', '👻', '👹', '🧟'];
    const goblinChar = monsters[Math.floor(Math.random() * monsters.length)];
    
    const color = state.level === 1 ? '#2ecc71' : state.level === 2 ? '#f39c12' : '#e74c3c';
    const enemyClass = getEnemyStyle(state.level);

    element.innerHTML = `
      <div class="${enemyClass}" style="
        padding: 4px 8px;
        font-size: 16px;
        margin-bottom: 5px;
      ">${problem.text}</div>
      <div style="
        font-size: 40px;
        color: ${color};
        filter: drop-shadow(4px 4px 0 #000);
        animation: float 2s ease-in-out infinite;
      ">${goblinChar}</div>
    `;

    const maxX = window.innerWidth - 120;
    const enemyWidth = 120;
    let x = 0;
    let safePosition = false;
    let attempts = 0;

    while (!safePosition && attempts < 10) {
        x = Math.random() * (maxX - 10) + 10;
        safePosition = true;
        for (const enemy of state.enemies) {
            if (enemy.y < 150) {
                if (Math.abs(enemy.x - x) < enemyWidth) {
                    safePosition = false;
                    break;
                }
            }
        }
        attempts++;
    }

    let y = -100;

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    
    gameAreaRef.current.appendChild(element);

    const enemyObj = {
      problem,
      element,
      x,
      y,
      move: () => {
        enemyObj.y += state.enemySpeed + (state.score / 5000); 
        element.style.top = `${enemyObj.y}px`;
        if (enemyObj.y > window.innerHeight - 150) { 
          endGame("DEFEATED");
        }
      },
      remove: () => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }
    };
    
    state.enemies.push(enemyObj);
  };

  const endGame = (message: string = "GAME OVER") => {
    const state = gameState.current;
    state.isPlaying = false;
    state.isGameActive = false;
    soundManager.stopBGM();
    soundManager.playSFX('gameover');

    const currentScore = state.score;
    const storedHighScore = parseInt(localStorage.getItem('magicMathHighScore') || '0', 10);
    let displayHighScore = storedHighScore;

    if (currentScore > storedHighScore) {
        localStorage.setItem('magicMathHighScore', currentScore.toString());
        displayHighScore = currentScore;
    }

    if (finalScoreRef.current) finalScoreRef.current.innerText = currentScore.toString();
    if (gameOverTitleRef.current) {
        gameOverTitleRef.current.innerText = message;
        gameOverTitleRef.current.style.color = '#e74c3c';
    }
    
    if (startHighScoreRef.current) startHighScoreRef.current.innerText = displayHighScore.toString();
    if (gameOverHighScoreRef.current) gameOverHighScoreRef.current.innerText = displayHighScore.toString();

    if (gameOverScreenRef.current) gameOverScreenRef.current.classList.remove('hidden');
  };

  const shootProjectile = (targetX: number, targetY: number) => {
    if (!gameAreaRef.current) return;
    soundManager.playSFX('shoot');

    const startX = window.innerWidth / 2;
    const startY = window.innerHeight - 150;

    const projectile = document.createElement('div');
    projectile.style.cssText = `
        position: absolute;
        width: 10px;
        height: 10px;
        background: #f1c40f;
        border: 2px solid #fff;
        box-shadow: 0 0 0 2px #000;
        z-index: 4;
        left: ${startX}px;
        top: ${startY}px;
    `;
    gameAreaRef.current.appendChild(projectile);

    const duration = 200;
    const startTime = performance.now();

    const animateProjectile = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const currentX = startX + (targetX - startX) * progress;
      const currentY = startY + (targetY - startY) * progress;

      projectile.style.left = `${currentX}px`;
      projectile.style.top = `${currentY}px`;

      if (progress < 1) {
        requestAnimationFrame(animateProjectile);
      } else {
        projectile.remove();
        createExplosion(targetX, targetY);
      }
    };
    requestAnimationFrame(animateProjectile);
  };

  const createExplosion = (x: number, y: number) => {
    if (!gameAreaRef.current) return;
    soundManager.playSFX('hit');

    const explosion = document.createElement('div');
    explosion.innerText = '💥';
    explosion.style.cssText = `
        position: absolute;
        font-size: 60px;
        left: ${x}px;
        top: ${y}px;
        transform: translate(-50%, -50%);
        z-index: 6;
        text-shadow: 4px 4px 0 #000;
    `;
    gameAreaRef.current.appendChild(explosion);
    setTimeout(() => explosion.remove(), 300);
  };

  const checkInput = () => {
    const state = gameState.current;
    if (!inputRef.current) return;
    const val = parseInt(inputRef.current.value);
    if (isNaN(val)) return;

    const matchIndex = state.enemies.findIndex(e => e.problem.answer === val);

    if (matchIndex !== -1) {
      const enemy = state.enemies[matchIndex];
      const rect = enemy.element.getBoundingClientRect();
      shootProjectile(rect.left + rect.width / 2, rect.top + rect.height / 2);
      
      state.enemies.splice(matchIndex, 1);
      enemy.remove();
      
      state.score += 10;
      
      if (scoreRef.current) scoreRef.current.innerText = state.score.toString();
      
      inputRef.current.value = '';
      state.lastSpawnTime = -10000; 

      const minSpawnRate = state.level === 3 ? 2000 : 1000;
      if (state.score % 50 === 0) {
        state.spawnRate = Math.max(minSpawnRate, state.spawnRate - 50);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleGameLoop = (timestamp: number) => {
    const state = gameState.current;
    if (!state.isPlaying || state.isPaused) {
      state.animationFrameId = requestAnimationFrame(handleGameLoop);
      return;
    }

    state.elapsedTime += 1/60;
    if (timeDisplayRef.current) {
        timeDisplayRef.current.innerText = Math.floor(state.elapsedTime).toString();
    }

    if (timestamp - state.lastSpawnTime > state.spawnRate) {
      createEnemy();
      state.lastSpawnTime = timestamp;
    }

    state.enemies.forEach(enemy => enemy.move());

    state.animationFrameId = requestAnimationFrame(handleGameLoop);
  };

  const startGame = (level: number) => {
    const state = gameState.current;
    state.isGameActive = true; 
    state.level = level; // Update REF directly for game loop
    setCurrentLevelUI(level); // Update UI state for background
    
    soundManager.stopBGM();

    if (startScreenRef.current) startScreenRef.current.classList.add('hidden');
    if (gameOverScreenRef.current) gameOverScreenRef.current.classList.add('hidden');

    state.score = 0;
    state.elapsedTime = 0;
    state.enemies.forEach(e => e.remove());
    state.enemies = [];
    
    if (scoreRef.current) scoreRef.current.innerText = '0';
    if (timeDisplayRef.current) timeDisplayRef.current.innerText = '0';

    if (level === 1) {
        state.enemySpeed = 1.2; 
        state.spawnRate = 2000; 
    } else if (level === 2) {
        state.enemySpeed = 0.8; 
        state.spawnRate = 3000; 
    } else {
        state.enemySpeed = 0.5; 
        state.spawnRate = 4000; 
    }

    let count = 3;
    setCountdown(3);
    
    const countInterval = setInterval(() => {
        count--;
        if (count > 0) {
            setCountdown(count);
        } else {
            clearInterval(countInterval);
            setCountdown(null);
            
            state.isPlaying = true;
            state.isPaused = false;
            
            if (inputRef.current) {
                inputRef.current.value = '';
                inputRef.current.focus();
            }
            state.lastSpawnTime = performance.now();
            cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = requestAnimationFrame(handleGameLoop);
        }
    }, 1000);
  };

  const resetToStart = () => {
    if (gameOverScreenRef.current) gameOverScreenRef.current.classList.add('hidden');
    if (startScreenRef.current) startScreenRef.current.classList.remove('hidden');
    gameState.current.isGameActive = false;
    soundManager.playBGM(0);
  };

  const togglePause = () => {
    const state = gameState.current;
    if (!state.isPlaying && !countdown) return;
    state.isPaused = !state.isPaused;
    if (!state.isPaused) {
        state.lastSpawnTime = performance.now();
        soundManager.init();
        if (inputRef.current) inputRef.current.focus();
    } else {
        soundManager.ctx?.suspend();
    }
  };

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100vh', 
      overflow: 'hidden',
      fontFamily: "'Press Start 2P', cursive",
      background: '#2c3e50',
      color: '#fff',
      userSelect: 'none'
    }}>
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

            .scanlines {
                position: fixed;
                left: 0; top: 0; width: 100%; height: 100%;
                background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2));
                background-size: 100% 4px;
                z-index: 50;
                pointer-events: none;
                opacity: 0.6;
            }

            .hud-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 4px solid #000;
                background: #34495e;
            }

            .retro-box {
                background: #000;
                border: 4px solid #fff;
                padding: 10px 20px;
                color: #2ecc71;
                font-size: 16px;
                box-shadow: 4px 4px 0 #000;
            }

            #input-container {
                position: absolute;
                bottom: 40px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 20;
                width: 320px;
            }

            #spell-input {
                width: 100%;
                padding: 15px;
                font-size: 20px;
                text-align: center;
                border: 4px solid #fff;
                outline: none;
                background: #000;
                color: #fff;
                font-family: 'Press Start 2P', cursive;
                box-shadow: 8px 8px 0 rgba(0,0,0,0.5);
            }

            .screen {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 100;
            }

            .hidden { display: none !important; }

            h1 {
                font-size: 32px;
                color: #f1c40f;
                text-shadow: 4px 4px 0 #c0392b;
                margin-bottom: 40px;
                text-align: center;
                line-height: 1.5;
            }

            .btn {
                background: #3498db;
                color: #fff;
                border: 4px solid #fff;
                padding: 20px;
                font-size: 14px;
                cursor: pointer;
                font-family: 'Press Start 2P', cursive;
                box-shadow: 6px 6px 0 #000;
                margin: 10px;
                text-transform: uppercase;
            }

            .btn:hover { background: #2980b9; transform: translate(-2px, -2px); box-shadow: 8px 8px 0 #000; }
            .btn:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 #000; }
            
            .level-btn-1 { background: #2ecc71; }
            .level-btn-2 { background: #e67e22; }
            .level-btn-3 { background: #e74c3c; }
            
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
                100% { transform: translateY(0px); }
            }
        `}</style>

        <div className="scanlines"></div>

        {/* Background */}
        <div 
            style={{position:'absolute', width:'100%', height:'100%', background: '#2c3e50'}}
            dangerouslySetInnerHTML={{ __html: getLevelBackgroundHTML(currentLevelUI) }}
        >
        </div>

        {/* Game UI */}
        <div style={{position:'absolute', width:'100%', zIndex:10}}>
            <div className="hud-bar">
                <div className="retro-box">SCORE: <span ref={scoreRef}>0</span></div>
                <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                    <div className="retro-box" style={{color:'#f1c40f'}}>TIME: <span ref={timeDisplayRef}>0</span></div>
                    <button className="btn" style={{padding:'10px 15px', fontSize:'12px', margin:0}} onClick={togglePause}>||</button>
                </div>
            </div>
        </div>

        {/* Countdown Overlay */}
        {countdown !== null && (
            <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '80px',
                color: '#f1c40f',
                textShadow: '6px 6px 0 #000',
                zIndex: 60,
                pointerEvents: 'none'
            }}>
                {countdown}
            </div>
        )}

        {/* Game World Layer for enemies/projectiles */}
        <div id="game-area" ref={gameAreaRef} style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', overflow:'hidden', zIndex: 5}}>
        </div>

        {/* Input */}
        <div id="input-container">
            <input 
                type="number" 
                id="spell-input" 
                placeholder="???" 
                autoFocus 
                autoComplete="off"
                ref={inputRef}
                onInput={checkInput}
                onKeyDown={handleKeyDown}
            />
        </div>

        {/* Start Screen */}
        <div id="start-screen" className="screen" ref={startScreenRef}>
            <h1 style={{padding:'0 20px'}}>MAGIC MATH<br/>DEFENDER</h1>
            <div style={{marginBottom:'30px', color:'#2ecc71'}}>BEST: <span ref={startHighScoreRef}>0</span></div>
            
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                <button className="btn level-btn-1" onClick={() => startGame(1)}>LVL 1 (SUM &lt; 20)</button>
                <button className="btn level-btn-2" onClick={() => startGame(2)}>LVL 2 (SUM &lt; 50)</button>
                <button className="btn level-btn-3" onClick={() => startGame(3)}>LVL 3 (SUM &lt; 100)</button>
            </div>
            <div style={{marginTop: '40px', fontSize: '10px', color: '#95a5a6', lineHeight: '1.8', textAlign: 'center'}}>
                <p style={{marginBottom:'10px'}}>PRESS CORRECT ANSWER TO SHOOT</p>
                <p>DON'T LET THEM REACH THE CASTLE!</p>
            </div>
        </div>

        {/* Game Over Screen */}
        <div id="game-over-screen" className="screen hidden" ref={gameOverScreenRef}>
            <h1 ref={gameOverTitleRef} style={{fontSize:'40px', color:'#e74c3c'}}>DEFEATED</h1>
            <div className="retro-box" style={{marginBottom:'20px'}}>SCORE: <span ref={finalScoreRef}>0</span></div>
            <div style={{marginBottom:'40px', color:'#f1c40f'}}>HIGH SCORE: <span ref={gameOverHighScoreRef}>0</span></div>
            <button className="btn" onClick={resetToStart}>TRY AGAIN</button>
        </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<MagicMathDefense />);
