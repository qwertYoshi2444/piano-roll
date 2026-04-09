import { startFadeOutAnimation } from './renderer.js';

const TRACK_COLORS = [
    { fill: '#55c555', border: '#339933' },
    { fill: '#f75b5b', border: '#cc3333' },
    { fill: '#5b85f7', border: '#3355cc' },
    { fill: '#e69900', border: '#b37700' },
    { fill: '#d953d9', border: '#a626a6' },
    { fill: '#33cccc', border: '#1a9999' },
    { fill: '#f28c28', border: '#bf600b' },
    { fill: '#9955ff', border: '#6622cc' },
    { fill: '#80b3ff', border: '#4d88ff' },
    { fill: '#ff80bf', border: '#cc4d88' },
    { fill: '#80ff80', border: '#4dcc4d' },
    { fill: '#b380ff', border: '#884dff' },
    { fill: '#ffbf80', border: '#cc884d' },
    { fill: '#cc527a', border: '#99264d' },
    { fill: '#52a3cc', border: '#267399' },
    { fill: '#a3cc52', border: '#739926' } 
];

const initialTracks = [];
for (let i = 0; i < 16; i++) {
    const waveTypes = ['sawtooth', 'square', 'triangle', 'sine'];
    const defaultWave = waveTypes[i % 4];

    initialTracks.push({
        id: i + 1,
        name: `Track ${i + 1}`,
        color: TRACK_COLORS[i].fill,
        borderColor: TRACK_COLORS[i].border,
        notes: [],
        waveform: defaultWave,
        attack: 0.02,
        decay: 0.3,
        sustain: 0.4,
        release: 0.3
    });
}

export const STATE = {
    bpm: 120,
    ppq: 96,
    zoomX: 0.5,
    zoomY: 20,
    scrollTick: 0,
    scrollPitch: 84,
    
    // --- 追加: プレイヘッドと再生状態 ---
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