import { startFadeOutAnimation } from './renderer.js';

// 改良された16色のカラーパレット（ダークテーマで視認性の高い色）
const TRACK_COLORS = [
    { fill: '#55c555', border: '#339933' }, // 1: 緑
    { fill: '#f75b5b', border: '#cc3333' }, // 2: 赤
    { fill: '#5b85f7', border: '#3355cc' }, // 3: 青
    { fill: '#e69900', border: '#b37700' }, // 4: オレンジ系イエロー（視認性向上）
    { fill: '#d953d9', border: '#a626a6' }, // 5: マゼンタ
    { fill: '#33cccc', border: '#1a9999' }, // 6: シアン
    { fill: '#f28c28', border: '#bf600b' }, // 7: オレンジ
    { fill: '#9955ff', border: '#6622cc' }, // 8: 紫
    { fill: '#80b3ff', border: '#4d88ff' }, // 9: ライトブルー
    { fill: '#ff80bf', border: '#cc4d88' }, // 10: ピンク
    { fill: '#80ff80', border: '#4dcc4d' }, // 11: ライトグリーン
    { fill: '#b380ff', border: '#884dff' }, // 12: ライトパープル
    { fill: '#ffbf80', border: '#cc884d' }, // 13: ピーチ
    { fill: '#cc527a', border: '#99264d' }, // 14: ローズ
    { fill: '#52a3cc', border: '#267399' }, // 15: スチールブルー
    { fill: '#a3cc52', border: '#739926' }  // 16: オリーブグリーン
];

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
    bpm: 120, // 追加: BPM
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
    STATE.dyingNotes.push({ ...note, opacity: 1.0, color: track.color });
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