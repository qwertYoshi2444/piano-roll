import { startFadeOutAnimation } from './renderer.js';

// FL StudioのMIDI Color Groupを意識した16色のパレット
const TRACK_COLORS = [
    { fill: '#66ff66', border: '#4dcc4d' }, // 1: 緑
    { fill: '#ff6666', border: '#cc4d4d' }, // 2: 赤
    { fill: '#6666ff', border: '#4d4dcc' }, // 3: 青
    { fill: '#ffcc00', border: '#cca300' }, // 4: 黄
    { fill: '#ff66ff', border: '#cc4dcc' }, // 5: マゼンタ
    { fill: '#66ffff', border: '#4dcccc' }, // 6: シアン
    { fill: '#ff9933', border: '#cc7a29' }, // 7: オレンジ
    { fill: '#9933ff', border: '#7a29cc' }, // 8: 紫
    { fill: '#a6a6a6', border: '#808080' }, // 9: ライトグレー
    { fill: '#ff9999', border: '#cc7a7a' }, // 10: ピンク
    { fill: '#99ff99', border: '#7acc7a' }, // 11: ライトグリーン
    { fill: '#9999ff', border: '#7a7acc' }, // 12: ライトブルー
    { fill: '#ffff99', border: '#cccc7a' }, // 13: ライトイエロー
    { fill: '#cc6699', border: '#a3527a' }, // 14: ローズ
    { fill: '#6699cc', border: '#527aa3' }, // 15: スチールブルー
    { fill: '#99cc66', border: '#7aa352' }  // 16: オリーブ
];

// 16トラックを動的に生成
const initialTracks = [];
for (let i = 0; i < 16; i++) {
    initialTracks.push({
        id: i + 1,
        name: `Track ${i + 1}`,
        color: TRACK_COLORS[i].fill,
        borderColor: TRACK_COLORS[i].border,
        notes: []
    });
}

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
    
    tracks: initialTracks,
    activeTrackId: 1,
    
    dyingNotes: [],

    selectionBox: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    },

    get notes() {
        return this.tracks.find(t => t.id === this.activeTrackId).notes;
    },
    set notes(newNotes) {
        const track = this.tracks.find(t => t.id === this.activeTrackId);
        if (track) track.notes = newNotes;
    }
};

export function clearSelection() {
    STATE.notes.forEach(n => n.selected = false);
}

export function getSelectedNotes() {
    return STATE.notes.filter(n => n.selected);
}

export function deleteNote(note) {
    if (!note) return;
    
    const track = STATE.tracks.find(t => t.id === STATE.activeTrackId);
    STATE.dyingNotes.push({ 
        ...note, 
        opacity: 1.0, 
        color: track.color
    });
    
    STATE.notes = STATE.notes.filter(n => n.id !== note.id);
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