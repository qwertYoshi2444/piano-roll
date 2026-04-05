// アプリケーション全体で共有される状態
export const STATE = {
    ppq: 96,
    zoomX: 0.5,
    zoomY: 20,
    scrollTick: 0,
    scrollPitch: 84, // C5=60, C7=84
    
    notes:[],       // ノート配列 { id, pitch, tick, duration, selected, muted }
    nextNoteId: 1,
    
    snap: 24,        // デフォルト: Step
    lastDuration: 24,
    
    currentTool: 'draw', // 'draw', 'select', 'mute', 'delete'
    
    // 矩形選択用の状態
    selectionBox: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    }
};

// 状態操作のヘルパー関数
export function clearSelection() {
    STATE.notes.forEach(n => n.selected = false);
}

export function getSelectedNotes() {
    return STATE.notes.filter(n => n.selected);
}

export function deleteSelectedNotes() {
    STATE.notes = STATE.notes.filter(n => !n.selected);
}