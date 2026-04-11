import { STATE } from './state.js';

let audioCtx = null;

// プレビュー用の変数
let previewOsc = null;
let previewGain = null;
let currentPreviewPitch = -1;

// シーケンサー再生用の変数
const scheduledNoteIds = new Set();
let activeNodes = [];

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// --- 変更: トランスポーズを考慮して周波数を計算 ---
function pitchToFreq(pitch) {
    // globalTranspose の値（-24 〜 +24 半音）を足して計算
    const transposedPitch = pitch + STATE.globalTranspose;
    return 440 * Math.pow(2, (transposedPitch - 69) / 12);
}

export function isTrackAudible(track) {
    if (!track) return false;
    if (track.isMuted) return false;
    
    const isAnyTrackSoloed = STATE.tracks.some(t => t.isSoloed);
    if (isAnyTrackSoloed && !track.isSoloed) {
        return false;
    }
    return true;
}

// --- プレビュー発音（マウスクリック等） ---
export function playPreview(pitch, trackId) {
    if (!audioCtx) return;
    const track = STATE.tracks.find(t => t.id === trackId);
    if (!isTrackAudible(track)) return;

    if (previewOsc && currentPreviewPitch === pitch) return;
    stopPreview(true);

    currentPreviewPitch = pitch;
    const freq = pitchToFreq(pitch);

    previewOsc = audioCtx.createOscillator();
    previewGain = audioCtx.createGain();

    previewOsc.type = track.waveform;
    previewOsc.frequency.value = freq;

    const t = audioCtx.currentTime;
    const maxVolume = 0.3;

    previewGain.gain.setValueAtTime(0, t);
    previewGain.gain.linearRampToValueAtTime(maxVolume, t + track.attack);
    const sustainLevel = maxVolume * track.sustain;
    previewGain.gain.setTargetAtTime(sustainLevel, t + track.attack, track.decay);

    previewOsc.connect(previewGain);
    previewGain.connect(audioCtx.destination);
    previewOsc.start();
}

export function stopPreview(immediate = false) {
    if (!previewOsc || !previewGain || !audioCtx) return;

    const t = audioCtx.currentTime;
    previewGain.gain.cancelScheduledValues(t);
    previewGain.gain.setValueAtTime(previewGain.gain.value, t);

    if (immediate) {
        previewGain.gain.linearRampToValueAtTime(0, t + 0.01);
        previewOsc.stop(t + 0.01);
    } else {
        const track = STATE.tracks.find(t => t.id === STATE.activeTrackId);
        const releaseTime = track ? track.release : 0.1;
        previewGain.gain.exponentialRampToValueAtTime(0.0001, t + releaseTime);
        previewOsc.stop(t + releaseTime);
    }

    previewOsc = null;
    previewGain = null;
    currentPreviewPitch = -1;
}

// --- 再生シーケンサー（スケジューリング） ---

export function startScheduler() {
    scheduledNoteIds.clear();
    stopAllSounds();
}

export function stopAllSounds() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    activeNodes.forEach(node => {
        try {
            node.gain.gain.cancelScheduledValues(t);
            node.gain.gain.setValueAtTime(node.gain.gain.value, t);
            node.gain.gain.linearRampToValueAtTime(0, t + 0.02); 
            node.osc.stop(t + 0.02);
        } catch (e) {}
    });
    
    activeNodes = [];
    scheduledNoteIds.clear();
}

export function scheduleNotes(currentTick, lookaheadTime, secondsPerTick) {
    if (!audioCtx) return;
    
    const lookaheadTicks = lookaheadTime / secondsPerTick;
    const endTick = currentTick + lookaheadTicks;
    
    STATE.tracks.forEach(track => {
        if (!isTrackAudible(track)) return;
        
        track.notes.forEach(note => {
            if (note.tick >= currentTick && note.tick < endTick && !note.muted && !scheduledNoteIds.has(note.id)) {
                
                const timeOffset = (note.tick - currentTick) * secondsPerTick;
                const startTime = audioCtx.currentTime + timeOffset;
                const durationTime = note.duration * secondsPerTick;
                
                scheduleSingleNote(note, track, startTime, durationTime);
                scheduledNoteIds.add(note.id);
            }
        });
    });
}

function scheduleSingleNote(note, track, startTime, durationTime) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = track.waveform;
    // 発音時の周波数計算にトランスポーズを適用
    osc.frequency.value = pitchToFreq(note.pitch);
    
    const maxVolume = 0.3;
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(maxVolume, startTime + track.attack);
    
    // サステインレベルが0の場合のAudioContextエラーを回避
    const sustainLevel = maxVolume * Math.max(0.01, track.sustain); 
    gain.gain.setTargetAtTime(sustainLevel, startTime + track.attack, track.decay);
    
    const releaseStartTime = startTime + durationTime;
    gain.gain.setValueAtTime(sustainLevel, releaseStartTime); 
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStartTime + track.release);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(startTime);
    osc.stop(releaseStartTime + track.release);
    
    const nodeObj = { osc, gain };
    activeNodes.push(nodeObj);
    
    osc.onended = () => {
        activeNodes = activeNodes.filter(n => n !== nodeObj);
    };
}