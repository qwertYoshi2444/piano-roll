import { startFadeOutAnimation } from './renderer.js';

// HSLからHEXへの変換（目に優しいパレットの動的生成用）
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// 彩度を落とし、明度差を利用した32色のパレット
export const TRACK_COLORS_PALETTE =[];
for (let i = 0; i < 32; i++) {
    const h = Math.floor((i * (360 / 32)) % 360);
    // インデックスごとに彩度と明度を交互に変えてコントラストを確保
    const s = i % 2 === 0 ? 60 : 45;
    const l = i % 2 === 0 ? 55 : 45;
    TRACK_COLORS_PALETTE.push({
        fill: hslToHex(h, s, l),
        border: hslToHex(h, s, Math.max(0, l - 15))
    });
}

// 初期トラックは8つに変更
const initialTracks =[];
for (let i = 0; i < 8; i++) {
    initialTracks.push({
        id: i + 1,
        name: `Track ${i + 1}`,
        color: TRACK_COLORS_PALETTE[i].fill,
        borderColor: TRACK_COLORS_PALETTE[i].border,
        notes:[],
        volume: 1.0, // 新規: 音量設定
        waveform: 'sawtooth',
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
    snap: 24,
    lastDuration: 24,
    currentTool: 'draw',
    
    tracks: initialTracks,
    activeTrackId: 1,
    dyingNotes:[],
    
    globalTranspose: 0, // 新規: グローバルトランスポーズ

    selectionBox: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    },

    get notes() {
        const track = this.tracks.find(t => t.id === this.activeTrackId);
        return track ? track.notes :[];
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

// 新規: トラックの追加関数
export function addTrack() {
    const nextId = STATE.tracks.length > 0 ? Math.max(...STATE.tracks.map(t => t.id)) + 1 : 1;
    
    // 未使用の色を探す（32色パレットから）
    const usedColors = STATE.tracks.map(t => t.color);
    let newColorObj = TRACK_COLORS_PALETTE.find(c => !usedColors.includes(c.fill));
    
    // 全て使われていればランダムに選ぶ
    if (!newColorObj) {
        newColorObj = TRACK_COLORS_PALETTE[Math.floor(Math.random() * TRACK_COLORS_PALETTE.length)];
    }

    STATE.tracks.push({
        id: nextId,
        name: `Track ${nextId}`,
        color: newColorObj.fill,
        borderColor: newColorObj.border,
        notes:[],
        volume: 1.0,
        waveform: 'sawtooth',
        attack: 0.0001,
        decay: 0.1,
        sustain: 0.75,
        release: 0.005
    });
}