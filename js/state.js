import { startFadeOutAnimation } from './renderer.js';

// 色相(Hue)ベースで滑らかに変化する16色のパレット
const TRACK_COLORS = [
    { fill: '#ff4d4d', border: '#cc0000' }, // 1: Red
    { fill: '#ff794d', border: '#cc3300' }, // 2: Red-Orange
    { fill: '#ffa64d', border: '#cc6600' }, // 3: Orange
    { fill: '#ffd24d', border: '#cc9900' }, // 4: Yellow-Orange
    { fill: '#ffff4d', border: '#cccc00' }, // 5: Yellow
    { fill: '#d2ff4d', border: '#99cc00' }, // 6: Yellow-Green
    { fill: '#a6ff4d', border: '#66cc00' }, // 7: Light Green
    { fill: '#4dff4d', border: '#00cc00' }, // 8: Green
    { fill: '#4dffb3', border: '#00cc66' }, // 9: Blue-Green
    { fill: '#4dffff', border: '#00cccc' }, // 10: Cyan
    { fill: '#4db3ff', border: '#0066cc' }, // 11: Light Blue
    { fill: '#4d4dff', border: '#0000cc' }, // 12: Blue
    { fill: '#a64dff', border: '#6600cc' }, // 13: Purple
    { fill: '#d24dff', border: '#9900cc' }, // 14: Magenta
    { fill: '#ff4dff', border: '#cc00cc' }, // 15: Pink
    { fill: '#ff4da6', border: '#cc0066' }  // 16: Rose
];

const initialTracks = [];
for (let i = 0; i < 16; i++) {
    initialTracks.push({
        id: i + 1,
        name: `Track ${i + 1}`,
        color: TRACK_COLORS[i].fill,
        borderColor: TRACK_COLORS[i].border,
        notes: [],
        
        // --- 指定されたデフォルト音色設定 ---
        waveform: 'sawtooth',
        // Audio API では秒単位のため、ms を 1000 で割って指定
        // ※ 0を指定するとクリックノイズが出るため極小値を指定
        attack: 0.0001, // 0.1ms
        decay: 0.1,     // 100ms
        sustain: 0.75,  // 75%
        release: 0.005  // 5ms
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