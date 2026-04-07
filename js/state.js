import { startFadeOutAnimation } from './renderer.js';

export const STATE = {
    ppq: 96,
    zoomX: 0.5,
    zoomY: 20,
    scrollTick: 0,
    scrollPitch: 84,
    
    nextNoteId: 1,
    snap: 24,
    lastDuration: 24,
    currentTool: 'draw',
    
    // マルチトラックデータ構造
    tracks: [
        { id: 1, name: 'Track 1', color: '#ff6600', borderColor: '#cc5200', notes: [] }, // オレンジ
        { id: 2, name: 'Track 2', color: '#00cc66', borderColor: '#00994d', notes: [] }, // グリーン
        { id: 3, name: 'Track 3', color: '#3399ff', borderColor: '#2673cc', notes: [] }  // ブルー
    ],
    activeTrackId: 1,
    
    // フェードアウト・アニメーション待機中のノート配列
    dyingNotes: [],

    selectionBox: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    },

    // 既存のコードを壊さずにマルチトラック対応するための Getter / Setter
    get notes() {
        return this.tracks.find(t => t.id === this.activeTrackId).notes;
    },
    set notes(newNotes) {
        const track = this.tracks.find(t => t.id === this.activeTrackId);
        if (track) track.notes = newNotes;
    }
};

// --- 状態操作のヘルパー関数 ---

export function clearSelection() {
    STATE.notes.forEach(n => n.selected = false);
}

export function getSelectedNotes() {
    return STATE.notes.filter(n => n.selected);
}

// 削除処理をここに集約し、フェードアウトアニメーションのトリガーとする
export function deleteNote(note) {
    if (!note) return;
    
    // アニメーション用に複製し、初期透明度を設定してキューに追加
    const track = STATE.tracks.find(t => t.id === STATE.activeTrackId);
    STATE.dyingNotes.push({ 
        ...note, 
        opacity: 1.0, 
        color: track.color // 輪郭線の色として元のトラック色を保持
    });
    
    // 実際のデータ配列からは削除
    STATE.notes = STATE.notes.filter(n => n.id !== note.id);
    
    // アニメーションループを開始
    startFadeOutAnimation();
}

export function deleteSelectedNotes() {
    const selected = getSelectedNotes();
    if (selected.length === 0) return;
    
    selected.forEach(note => {
        const track = STATE.tracks.find(t => t.id === STATE.activeTrackId);
        STATE.dyingNotes.push({ ...note, opacity: 1.0, color: track.color });
    });
    
    STATE.notes = STATE.notes.filter(n => !n.selected);
    startFadeOutAnimation();
}