import { startFadeOutAnimation } from './renderer.js';

// --- 拡張: 視認性の高い32色のカラーパレット (彩度・明度を調整) ---
export const TRACK_COLORS = [
    { fill: '#ff4d4d', border: '#cc0000' }, // 1: Red
    { fill: '#ff794d', border: '#cc3300' }, // 2: Red-Orange
    { fill: '#ffa64d', border: '#cc6600' }, // 3: Orange
    { fill: '#ffd24d', border: '#cc9900' }, // 4: Yellow-Orange
    { fill: '#e6e633', border: '#b3b300' }, // 5: Yellow (彩度を少し落とす)
    { fill: '#cce633', border: '#99b300' }, // 6: Lime
    { fill: '#99e633', border: '#66b300' }, // 7: Yellow-Green
    { fill: '#4dff4d', border: '#00cc00' }, // 8: Green
    { fill: '#33e680', border: '#00b34d' }, // 9: Emerald
    { fill: '#33e6b3', border: '#00b380' }, // 10: Teal
    { fill: '#33e6e6', border: '#00b3b3' }, // 11: Cyan
    { fill: '#33b3e6', border: '#0080b3' }, // 12: Sky Blue
    { fill: '#4db3ff', border: '#0066cc' }, // 13: Light Blue
    { fill: '#4d79ff', border: '#0033cc' }, // 14: Blue
    { fill: '#664dff', border: '#3300cc' }, // 15: Indigo
    { fill: '#994dff', border: '#6600cc' }, // 16: Purple
    { fill: '#cc4dff', border: '#9900cc' }, // 17: Violet
    { fill: '#ff4dff', border: '#cc00cc' }, // 18: Magenta
    { fill: '#ff4dcc', border: '#cc0099' }, // 19: Pink
    { fill: '#ff4d99', border: '#cc0066' }, // 20: Rose
    // --- 明度を落としたダーク系バリエーション (21-32) ---
    { fill: '#cc3333', border: '#990000' }, // 21: Dark Red
    { fill: '#cc6633', border: '#993300' }, // 22: Dark Orange
    { fill: '#b3b326', border: '#808000' }, // 23: Dark Yellow
    { fill: '#33cc33', border: '#009900' }, // 24: Dark Green
    { fill: '#26b38c', border: '#008055' }, // 25: Dark Teal
    { fill: '#26b3b3', border: '#008080' }, // 26: Dark Cyan
    { fill: '#3380cc', border: '#004d99' }, // 27: Dark Sky Blue
    { fill: '#3333cc', border: '#000099' }, // 28: Dark Blue
    { fill: '#6633cc', border: '#330099' }, // 29: Dark Indigo
    { fill: '#9933cc', border: '#660099' }, // 30: Dark Purple
    { fill: '#cc33cc', border: '#990099' }, // 31: Dark Magenta
    { fill: '#cc3366', border: '#990033' }  // 32: Dark Rose
];

// 初期トラック数は8
const initialTracks = [];
for (let i = 0; i < 8; i++) {
    const waveTypes = ['sawtooth', 'square', 'triangle', 'sine'];
    const defaultWave = waveTypes[i % 4];

    initialTracks.push({
        id: i + 1,
        name: `Track ${i + 1}`,
        colorIndex: i, // パレットのインデックスを保持
        color: TRACK_COLORS[i].fill,
        borderColor: TRACK_COLORS[i].border,
        notes: [],
        waveform: defaultWave,
        attack: 0.0001,
        decay: 0.1,
        sustain: 0.75,
        release: 0.005
    });
}

export const STATE = {
    bpm: 120,
    ppq: 96,
    zoomX: 0.5,
    zoomY: 20,
    scrollTick: 0,
    scrollPitch: 84,
    
    playheadTick: 0,
    isPlaying: false,
    
    nextNoteId: 1,
    nextTrackId: 9, // 次に追加されるトラックのID
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
        const track = this.tracks.find(t => t.id === this.activeTrackId);
        return track ? track.notes : [];
    },
    set notes(newNotes) {
        const track = this.tracks.find(t => t.id === this.activeTrackId);
        if (track) track.notes = newNotes;
    }
};

// --- トラック管理関数 ---

export function addTrack() {
    const newId = STATE.nextTrackId++;
    
    // 使われていない色（インデックス）を探す、なければ順番にループ
    const usedColorIndices = STATE.tracks.map(t => t.colorIndex);
    let newColorIndex = 0;
    for (let i = 0; i < TRACK_COLORS.length; i++) {
        if (!usedColorIndices.includes(i)) {
            newColorIndex = i;
            break;
        }
    }
    // 32色すべて使われている場合は順番
    if (usedColorIndices.includes(newColorIndex)) {
        newColorIndex = STATE.tracks.length % TRACK_COLORS.length;
    }

    const newTrack = {
        id: newId,
        name: `Track ${newId}`,
        colorIndex: newColorIndex,
        color: TRACK_COLORS[newColorIndex].fill,
        borderColor: TRACK_COLORS[newColorIndex].border,
        notes: [],
        waveform: 'sawtooth',
        attack: 0.0001,
        decay: 0.1,
        sustain: 0.75,
        release: 0.005
    };
    
    STATE.tracks.push(newTrack);
    STATE.activeTrackId = newId; // 追加したトラックをアクティブにする
    return newTrack;
}

export function changeTrackColor(trackId, colorIndex) {
    const track = STATE.tracks.find(t => t.id === trackId);
    if (track && colorIndex >= 0 && colorIndex < TRACK_COLORS.length) {
        track.colorIndex = colorIndex;
        track.color = TRACK_COLORS[colorIndex].fill;
        track.borderColor = TRACK_COLORS[colorIndex].border;
    }
}

// --- 既存のヘルパー関数 ---

export function clearSelection() {
    STATE.notes.forEach(n => n.selected = false);
}

export function getSelectedNotes() {
    return STATE.notes.filter(n => n.selected);
}

export function deleteNote(note) {
    if (!note) return;
    const track = STATE.tracks.find(t => t.id === STATE.activeTrackId);
    if (track) {
        STATE.dyingNotes.push({ ...note, opacity: 1.0, color: track.color });
    }
    STATE.notes = STATE.notes.filter(n => n.id !== note.id);
    startFadeOutAnimation();
}

export function deleteSelectedNotes() {
    const selected = getSelectedNotes();
    if (selected.length === 0) return;
    const track = STATE.tracks.find(t => t.id === STATE.activeTrackId);
    selected.forEach(note => {
        if (track) STATE.dyingNotes.push({ ...note, opacity: 1.0, color: track.color });
    });
    STATE.notes = STATE.notes.filter(n => !n.selected);
    startFadeOutAnimation();
}