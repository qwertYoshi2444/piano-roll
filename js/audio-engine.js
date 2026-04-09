import { STATE } from './state.js';

let audioCtx = null;
let previewOsc = null;
let previewGain = null;
let currentPreviewPitch = -1;

// オーディオコンテキストの初期化（ユーザー操作をトリガーにして呼ぶ必要がある）
export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // ブラウザの自動再生ポリシー対策
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// MIDIノート番号(0-127)を周波数(Hz)に変換する数式
function pitchToFreq(pitch) {
    return 440 * Math.pow(2, (pitch - 69) / 12);
}

// ノートのプレビュー音を鳴らす（マウスダウン、または移動時）
export function playPreview(pitch, trackId) {
    if (!audioCtx) return;

    // 同じ音高が既に鳴っている場合はスキップ（処理の重複を防ぐ）
    if (previewOsc && currentPreviewPitch === pitch) return;

    // もし別の音が鳴っていたら即座に止める
    stopPreview(true);

    const track = STATE.tracks.find(t => t.id === trackId);
    if (!track) return;

    currentPreviewPitch = pitch;
    const freq = pitchToFreq(pitch);

    // オシレーター（発振器）とゲイン（音量制御）ノードを作成
    previewOsc = audioCtx.createOscillator();
    previewGain = audioCtx.createGain();

    previewOsc.type = track.waveform;
    previewOsc.frequency.value = freq;

    // エンベロープ (ADSR) の適用
    const t = audioCtx.currentTime;
    const maxVolume = 0.3; // プレビューのマスター音量（うるさすぎないように制限）

    // 1. Gainを一旦0にする
    previewGain.gain.setValueAtTime(0, t);
    
    // 2. Attack: 指定時間かけて最大音量まで上げる
    previewGain.gain.linearRampToValueAtTime(maxVolume, t + track.attack);
    
    // 3. Decay & Sustain: Attack完了後、Decay時間かけてSustainレベルまで下げる
    const sustainLevel = maxVolume * track.sustain;
    previewGain.gain.setTargetAtTime(sustainLevel, t + track.attack, track.decay);

    // ノードの接続と発音開始
    previewOsc.connect(previewGain);
    previewGain.connect(audioCtx.destination);
    previewOsc.start();
}

// プレビュー音を止める（マウスアップ時）
// immediateがtrueの場合は余韻を残さず即座に切る（ドラッグ移動時用）
export function stopPreview(immediate = false) {
    if (!previewOsc || !previewGain || !audioCtx) return;

    const t = audioCtx.currentTime;
    
    // スケジュールされている音量変化をキャンセル
    previewGain.gain.cancelScheduledValues(t);
    // 現在の音量を固定
    previewGain.gain.setValueAtTime(previewGain.gain.value, t);

    if (immediate) {
        previewGain.gain.linearRampToValueAtTime(0, t + 0.01);
        previewOsc.stop(t + 0.01);
    } else {
        // Release: トラックの設定時間かけてフェードアウト
        const track = STATE.tracks.find(t => t.id === STATE.activeTrackId);
        const releaseTime = track ? track.release : 0.1;
        
        // 0を直接指定するとエラーになるブラウザがあるため、極小値を指定
        previewGain.gain.exponentialRampToValueAtTime(0.0001, t + releaseTime);
        previewOsc.stop(t + releaseTime);
    }

    previewOsc = null;
    previewGain = null;
    currentPreviewPitch = -1;
}