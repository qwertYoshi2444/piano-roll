import { STATE } from './state.js';
import { renderAll } from './renderer.js';
// 追加: playReferenceAudio, stopReferenceAudio
import { initAudio, startScheduler, stopAllSounds, scheduleNotes, playReferenceAudio, stopReferenceAudio } from './audio-engine.js';

let lastTime = 0;
let animationId = null;

const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_STOP = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`;

export function togglePlayback() {
    STATE.isPlaying = !STATE.isPlaying;
    
    const btnPlay = document.getElementById('btn-play');
    
    if (STATE.isPlaying) {
        initAudio();
        
        btnPlay.classList.add('playing');
        btnPlay.innerHTML = `${ICON_STOP} <span id="label-play">Stop</span>`;
        
        startScheduler(); 
        
        // 追加: リファレンス音声の再生開始
        playReferenceAudio(STATE.playheadTick);
        
        lastTime = performance.now();
        animationId = requestAnimationFrame(playbackLoop);
        
    } else {
        btnPlay.classList.remove('playing');
        btnPlay.innerHTML = `${ICON_PLAY} <span id="label-play">Play</span>`;
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        stopAllSounds(); 
        // 追加: リファレンス音声の強制停止
        stopReferenceAudio();
    }
    
    const canvasGrid = document.getElementById('grid-canvas');
    if (canvasGrid) canvasGrid.focus();
}

function playbackLoop(currentTime) {
    if (!STATE.isPlaying) return;

    let deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    if (deltaTime > 0.1) {
        deltaTime = 0.1;
    }

    const ticksPerSecond = (STATE.bpm * STATE.ppq) / 60;
    const secondsPerTick = 60 / (STATE.bpm * STATE.ppq);
    
    STATE.playheadTick += ticksPerSecond * deltaTime;

    const lookaheadTime = 0.1; 
    scheduleNotes(STATE.playheadTick, lookaheadTime, secondsPerTick);

    const canvasGrid = document.getElementById('grid-canvas');
    if (canvasGrid) {
        const visibleTicks = canvasGrid.width / STATE.zoomX;
        const scrollThresholdOffset = visibleTicks * 0.8; 
        const scrollThresholdTick = STATE.scrollTick + scrollThresholdOffset;

        if (STATE.playheadTick > scrollThresholdTick) {
            STATE.scrollTick = STATE.playheadTick - scrollThresholdOffset;
        }
        
        if (STATE.playheadTick < STATE.scrollTick) {
            STATE.scrollTick = STATE.playheadTick;
        }
    }

    renderAll();
    animationId = requestAnimationFrame(playbackLoop);
}

export function stopPlayback() {
    if (STATE.isPlaying) {
        togglePlayback();
    }
}