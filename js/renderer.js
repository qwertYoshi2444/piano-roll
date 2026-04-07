import { STATE } from './state.js';
import { tickToX, xToTick, pitchToY, isBlackKey, getNoteName } from './utils.js';

let ctxGrid, ctxKeyboard, ctxTimeline;
let canvasGrid, canvasKeyboard, canvasTimeline;
let animationFrameId = null;

export function initRenderer(gridCvs, keyCvs, timeCvs) {
    canvasGrid = gridCvs;
    canvasKeyboard = keyCvs;
    canvasTimeline = timeCvs;
    ctxGrid = canvasGrid.getContext('2d');
    ctxKeyboard = canvasKeyboard.getContext('2d');
    ctxTimeline = canvasTimeline.getContext('2d');
}

export function renderAll() {
    renderGrid();
    renderSelectionRect();
    renderGhostNotes(); // 非アクティブなトラックのノートを描画
    renderNotes();      // アクティブなトラックのノートを描画
    renderDyingNotes(); // 削除されてフェードアウト中のノートを描画
    if (STATE.selectionBox.active) renderSelectionRect();
    renderKeyboard();
    renderTimeline();
}

// --- アニメーション・ループ管理 ---
export function startFadeOutAnimation() {
    if (!animationFrameId) {
        animateFadeOut();
    }
}

function animateFadeOut() {
    let stillAnimating = false;
    
    // 透明度を減算
    STATE.dyingNotes.forEach(note => {
        note.opacity -= 0.05; // 減衰速度 (0.05 = 約20フレームで消滅)
        if (note.opacity > 0) stillAnimating = true;
    });

    // 完全に透明になったものを配列から除去
    STATE.dyingNotes = STATE.dyingNotes.filter(note => note.opacity > 0);

    renderAll(); // 再描画

    if (stillAnimating) {
        animationFrameId = requestAnimationFrame(animateFadeOut);
    } else {
        animationFrameId = null; // アニメーション終了
    }
}

// --- 個別の描画関数 ---

function renderGrid() {
    const w = canvasGrid.width, h = canvasGrid.height;
    ctxGrid.clearRect(0, 0, w, h);

    const topPitch = STATE.scrollPitch + 1;
    const bottomPitch = STATE.scrollPitch - (h / STATE.zoomY) - 1;

    for (let pitch = Math.floor(topPitch); pitch >= Math.floor(bottomPitch); pitch--) {
        if (pitch < 0 || pitch > 127) continue;
        const y = pitchToY(pitch);
        ctxGrid.fillStyle = isBlackKey(pitch) ? '#1a1c1d' : '#222527';
        ctxGrid.fillRect(0, y, w, STATE.zoomY);
        
        ctxGrid.strokeStyle = '#111'; 
        ctxGrid.lineWidth = 1;
        ctxGrid.beginPath(); 
        ctxGrid.moveTo(0, y + STATE.zoomY); 
        ctxGrid.lineTo(w, y + STATE.zoomY); 
        ctxGrid.stroke();
    }

    const snapTickVal = STATE.ppq / 4; 
    let currentTick = Math.floor(STATE.scrollTick / snapTickVal) * snapTickVal;
    
    ctxGrid.beginPath();
    while (currentTick <= xToTick(w)) {
        const x = tickToX(currentTick);
        if (currentTick % (STATE.ppq * 4) === 0) ctxGrid.strokeStyle = '#555';
        else if (currentTick % STATE.ppq === 0) ctxGrid.strokeStyle = '#3a3a3a';
        else ctxGrid.strokeStyle = '#2a2a2a';
        
        if (x >= 0) { 
            ctxGrid.moveTo(x, 0); 
            ctxGrid.lineTo(x, h); 
        }
        currentTick += snapTickVal;
    }
    ctxGrid.stroke();
}

function renderGhostNotes() {
    const heightPadding = 2;
    // アクティブではない全てのトラックを描画
    STATE.tracks.filter(t => t.id !== STATE.activeTrackId).forEach(track => {
        track.notes.forEach(note => {
            const x = tickToX(note.tick);
            const y = pitchToY(note.pitch);
            const w = note.duration * STATE.zoomX;
            const h = STATE.zoomY;
            
            if (x + w < 0 || x > canvasGrid.width || y + h < 0 || y > canvasGrid.height) return;

            // ゴーストノートは半透明で描画（ミュート状態も反映）
            ctxGrid.fillStyle = note.muted ? 'rgba(85, 85, 85, 0.3)' : 'rgba(150, 150, 150, 0.4)';
            ctxGrid.strokeStyle = 'rgba(50, 50, 50, 0.5)';
            ctxGrid.lineWidth = 1;
            
            ctxGrid.beginPath();
            if (ctxGrid.roundRect) ctxGrid.roundRect(x, y + heightPadding, w, h - heightPadding * 2, 2);
            else ctxGrid.rect(x, y + heightPadding, w, h - heightPadding * 2);
            ctxGrid.fill(); 
            ctxGrid.stroke();
        });
    });
}

function renderNotes() {
    const heightPadding = 2;
    const activeTrack = STATE.tracks.find(t => t.id === STATE.activeTrackId);
    
    STATE.notes.forEach(note => {
        const x = tickToX(note.tick);
        const y = pitchToY(note.pitch);
        const w = note.duration * STATE.zoomX;
        const h = STATE.zoomY;
        
        if (x + w < 0 || x > canvasGrid.width || y + h < 0 || y > canvasGrid.height) return;

        let fillColor = activeTrack.color;
        let strokeColor = activeTrack.borderColor;
        
        if (note.muted) {
            fillColor = '#555555';
            strokeColor = '#333333';
        } else if (note.selected) {
            fillColor = '#ff3333'; 
            strokeColor = '#cc0000';
        }

        ctxGrid.fillStyle = fillColor; 
        ctxGrid.strokeStyle = strokeColor; 
        ctxGrid.lineWidth = 1;
        
        ctxGrid.beginPath();
        if (ctxGrid.roundRect) ctxGrid.roundRect(x, y + heightPadding, w, h - heightPadding * 2, 3);
        else ctxGrid.rect(x, y + heightPadding, w, h - heightPadding * 2);
        ctxGrid.fill(); 
        ctxGrid.stroke();
        
        ctxGrid.fillStyle = note.muted ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)'; 
        ctxGrid.fillRect(x + 2, y + heightPadding + 1, w - 4, 2);
        ctxGrid.fillStyle = note.muted ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)'; 
        ctxGrid.fillRect(x + 2, y + heightPadding + (h/2) - 1, w - 4, 2);
    });
}

function renderDyingNotes() {
    const heightPadding = 2;
    STATE.dyingNotes.forEach(note => {
        const x = tickToX(note.tick);
        const y = pitchToY(note.pitch);
        const w = note.duration * STATE.zoomX;
        const h = STATE.zoomY;
        
        if (x + w < 0 || x > canvasGrid.width || y + h < 0 || y > canvasGrid.height) return;

        // 塗りつぶしはせず（輪郭線のみ）、透明度を適用
        ctxGrid.globalAlpha = note.opacity;
        ctxGrid.strokeStyle = note.color; // 元のトラック色
        ctxGrid.lineWidth = 2; // 少し太めにして視認性を上げる
        
        ctxGrid.beginPath();
        if (ctxGrid.roundRect) ctxGrid.roundRect(x, y + heightPadding, w, h - heightPadding * 2, 3);
        else ctxGrid.rect(x, y + heightPadding, w, h - heightPadding * 2);
        ctxGrid.stroke();
        
        // 描画後は globalAlpha を必ず戻す
        ctxGrid.globalAlpha = 1.0;
    });
}

function renderSelectionRect() {
    if (!STATE.selectionBox.active) return;
    
    const box = STATE.selectionBox;
    const minX = Math.min(box.startX, box.currentX);
    const minY = Math.min(box.startY, box.currentY);
    const w = Math.abs(box.currentX - box.startX);
    const h = Math.abs(box.currentY - box.startY);

    ctxGrid.fillStyle = 'rgba(255, 255, 255, 0.1)'; 
    ctxGrid.fillRect(minX, minY, w, h);
    
    ctxGrid.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctxGrid.lineWidth = 1;
    ctxGrid.strokeRect(minX, minY, w, h);
}

function renderKeyboard() {
    const w = canvasKeyboard.width, h = canvasKeyboard.height;
    ctxKeyboard.clearRect(0, 0, w, h);
    const topPitch = STATE.scrollPitch + 1;
    const bottomPitch = STATE.scrollPitch - (h / STATE.zoomY) - 1;

    for (let pitch = Math.floor(topPitch); pitch >= Math.floor(bottomPitch); pitch--) {
        if (pitch < 0 || pitch > 127) continue;
        const y = pitchToY(pitch);
        ctxKeyboard.fillStyle = isBlackKey(pitch) ? '#1e1e1e' : '#e0e0e0';
        ctxKeyboard.fillRect(0, y, w, STATE.zoomY);
        
        ctxKeyboard.strokeStyle = '#000'; 
        ctxKeyboard.strokeRect(0, y, w, STATE.zoomY);
        
        if (pitch % 12 === 0) {
            ctxKeyboard.fillStyle = '#333'; 
            ctxKeyboard.font = '10px sans-serif';
            ctxKeyboard.fillText(getNoteName(pitch), w - 25, y + STATE.zoomY - 5);
        }
    }
}

function renderTimeline() {
    const w = canvasTimeline.width, h = canvasTimeline.height;
    ctxTimeline.clearRect(0, 0, w, h);
    let currentTick = Math.floor(STATE.scrollTick / (STATE.ppq * 4)) * (STATE.ppq * 4);
    ctxTimeline.fillStyle = '#d0d0d0'; 
    ctxTimeline.font = '11px sans-serif';
    
    while (currentTick <= xToTick(w)) {
        const x = tickToX(currentTick);
        if (x >= 0) {
            ctxTimeline.fillText((currentTick / (STATE.ppq * 4)) + 1, x + 5, 20);
            ctxTimeline.beginPath(); 
            ctxTimeline.strokeStyle = '#666'; 
            ctxTimeline.moveTo(x, h - 5); 
            ctxTimeline.lineTo(x, h); 
            ctxTimeline.stroke();
        }
        currentTick += (STATE.ppq * 4);
    }
}