import { STATE } from './state.js';

let audioCtx = null;

// プレビュー用の変数
let previewOsc = null;
let previewGain = null;
let currentPreviewPitch = -1;

// シーケンサー再生用の変数
const scheduledNoteIds = new Set(); // 既にスケジュール済みのノートIDを記録
let activeNodes =[]; // 再生中・スケジュール中のオシレーターとゲインを管理

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

// 再生停止やシーク時に、予約されている音と鳴っている音を全て強制停止する
export function stopAllSounds() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    activeNodes.forEach(node => {
        try {
            node.gain.gain.cancelScheduledValues(t);
            node.gain.gain.setValueAtTime(node.gain.gain.value, t);
            node.gain.gain.linearRampToValueAtTime(0, t + 0.02); // 短いフェードアウトでノイズ防止
            node.osc.stop(t + 0.02);
        } catch (e) {
            // すでに終了しているノードへの操作エラーを無視
        }
    });
    
    activeNodes =[];
    scheduledNoteIds.clear();
}

// 毎フレーム呼ばれ、少し未来までのノートをAudio APIに予約する
export function scheduleNotes(currentTick, lookaheadTime, secondsPerTick) {
    if (!audioCtx) return;
    
    const lookaheadTicks = lookaheadTime / secondsPerTick;
    const endTick = currentTick + lookaheadTicks;
    
    STATE.tracks.forEach(track => {
        if (!isTrackAudible(track)) return;
        
        track.notes.forEach(note => {
            // スケジュール範囲内で、まだ予約されていないノートを探す
            if (note.tick >= currentTick && note.tick < endTick && !note.muted && !scheduledNoteIds.has(note.id)) {
                
                // 現在のAudioContext時間を基準に、正確な発音時刻を計算
                const timeOffset = (note.tick - currentTick) * secondsPerTick;
                const startTime = audioCtx.currentTime + timeOffset;
                const durationTime = note.duration * secondsPerTick;
                
                scheduleSingleNote(note, track, startTime, durationTime);
                scheduledNoteIds.add(note.id); // 予約済みにマーキング
            }
        });
    });
}

// 単一ノートの予約処理
function scheduleSingleNote(note, track, startTime, durationTime) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = track.waveform;
    osc.frequency.value = pitchToFreq(note.pitch);
    
    const maxVolume = 0.3;
    
    // ADSRエンベロープのスケジューリング
    gain.gain.setValueAtTime(0, startTime);
    // Attack
    gain.gain.linearRampToValueAtTime(maxVolume, startTime + track.attack);
    // Decay & Sustain
    const sustainLevel = maxVolume * Math.max(0.01, track.sustain); // 0完全回避
    gain.gain.setTargetAtTime(sustainLevel, startTime + track.attack, track.decay);
    
    // Note Off (Release)
    const releaseStartTime = startTime + durationTime;
    // リリース開始時に予測されるサステインレベルをセット
    gain.gain.setValueAtTime(sustainLevel, releaseStartTime); 
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStartTime + track.release);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(startTime);
    osc.stop(releaseStartTime + track.release);
    
    // 停止用の管理配列に追加
    const nodeObj = { osc, gain };
    activeNodes.push(nodeObj);
    
    // 再生が終わったら管理配列から削除しメモリ解放
    osc.onended = () => {
        activeNodes = activeNodes.filter(n => n !== nodeObj);
    };
}