import { STATE } from './state.js';
import { renderAll } from './renderer.js';
import { initAudio } from './audio-engine.js';

let lastTime = 0;
let animationId = null;

// SVGアイコン定義
const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_STOP = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`;

export function togglePlayback() {
    STATE.isPlaying = !STATE.isPlaying;
    
    const btnPlay = document.getElementById('btn-play');
    const iconSpan = document.getElementById('icon-play');
    const labelSpan = document.getElementById('label-play');
    
    if (STATE.isPlaying) {
        // 再生開始時
        initAudio(); // ブラウザのAudioContext制限を解除
        btnPlay.classList.add('playing');
        btnPlay.innerHTML = `${ICON_STOP} <span id="label-play">Stop</span>`;
        
        lastTime = performance.now();
        animationId = requestAnimationFrame(playbackLoop);
        
        // 次回のスケジューリング準備（第2回で実装します）
        // startScheduler();
    } else {
        // 停止時
        btnPlay.classList.remove('playing');
        btnPlay.innerHTML = `${ICON_PLAY} <span id="label-play">Play</span>`;
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // 鳴っている音をすべて止める（第2回で実装します）
        // stopAllSounds();
    }
    
    // 再生ボタンを押した際にフォーカスがボタンに移るため、キャンバスにフォーカスを戻す（キーボード操作維持のため）
    const canvasGrid = document.getElementById('grid-canvas');
    if (canvasGrid) canvasGrid.focus();
}

function playbackLoop(currentTime) {
    if (!STATE.isPlaying) return;

    // 前回のフレームからの経過時間（秒）
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // 1秒あたりのTick進行量 = (BPM * PPQ) / 60
    const ticksPerSecond = (STATE.bpm * STATE.ppq) / 60;
    
    // プレイヘッドを進める
    STATE.playheadTick += ticksPerSecond * deltaTime;

    // --- 自動スクロール処理 ---
    const canvasGrid = document.getElementById('grid-canvas');
    if (canvasGrid) {
        // 画面の幅をTick単位で計算
        const visibleTicks = canvasGrid.width / STATE.zoomX;
        
        // 画面の右端から 20% の位置をスクロールの境界線（閾値）とする
        const scrollThresholdOffset = visibleTicks * 0.8; 
        const scrollThresholdTick = STATE.scrollTick + scrollThresholdOffset;

        // プレイヘッドが境界線を越えたら、画面を右へスクロールさせる
        if (STATE.playheadTick > scrollThresholdTick) {
            STATE.scrollTick = STATE.playheadTick - scrollThresholdOffset;
        }
        
        // （手動でタイムラインをクリックした時など）プレイヘッドが画面の左外に出てしまった場合の自動補正
        if (STATE.playheadTick < STATE.scrollTick) {
            STATE.scrollTick = STATE.playheadTick;
        }
    }

    renderAll();
    
    // 次のフレームを要求
    animationId = requestAnimationFrame(playbackLoop);
}

// 停止のみを外部から呼び出す関数（キーボード操作等で安全に止めるため）
export function stopPlayback() {
    if (STATE.isPlaying) {
        togglePlayback();
    }
}