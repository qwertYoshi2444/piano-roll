import { STATE } from './state.js';

let audioCtx = null;
let previewOsc = null;
let previewGain = null;
let currentPreviewPitch = -1;

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function pitchToFreq(pitch) {
    return 440 * Math.pow(2, (pitch - 69) / 12);
}

// --- 追加: トラックが現在発音可能(ミュートされていない)か判定するヘルパー ---
export function isTrackAudible(track) {
    if (!track) return false;
    
    // 1. 自身がMuteされていたら鳴らない
    if (track.isMuted) return false;
    
    // 2. Solo機能の判定
    // いずれかのトラックがSolo化されているかチェック
    const isAnyTrackSoloed = STATE.tracks.some(t => t.isSoloed);
    
    // もしSolo化されているトラックが存在する場合、
    // 自身もSolo化されていなければ鳴らない
    if (isAnyTrackSoloed && !track.isSoloed) {
        return false;
    }
    
    return true; // 鳴る
}

export function playPreview(pitch, trackId) {
    if (!audioCtx) return;

    const track = STATE.tracks.find(t => t.id === trackId);
    
    // トラックがミュート状態の場合はプレビュー音を鳴らさない
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