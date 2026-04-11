import { STATE, addTrack } from './state.js';
import { renderAll } from './renderer.js';
import { setupTrackPanel } from './main.js';
// CDNから @tonejs/midi をインポート
import { Midi } from 'https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/build/Midi.js';

let pendingMidiData = null; // ロードダイアログ表示中に保持するデータ

// ファイル入力を受け取り、解析してダイアログを開く
export async function handleMidiFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // ファイル入力の値をリセット（同じファイルを再度選べるようにするため）
    event.target.value = '';

    try {
        // ファイルを ArrayBuffer として読み込む
        const arrayBuffer = await file.arrayBuffer();
        
        // Tone.js の Midi クラスで解析
        const midi = new Midi(arrayBuffer);
        
        // データが正常かチェック
        if (!midi.tracks || midi.tracks.length === 0) {
            alert("No tracks found in the MIDI file.");
            return;
        }

        pendingMidiData = midi;

        // --- ロード設定ダイアログの表示 ---
        document.getElementById('modal-overlay').classList.add('show');
        document.getElementById('load-midi-modal').classList.add('show');
        
        // BPM上書きオプションの表示制御 (MIDIファイルにBPM情報があるか)
        const bpmRow = document.getElementById('load-bpm-row');
        if (midi.header.tempos && midi.header.tempos.length > 0) {
            bpmRow.style.display = 'flex';
        } else {
            bpmRow.style.display = 'none';
        }

    } catch (error) {
        console.error("MIDI Parse Error:", error);
        alert("Failed to parse the MIDI file. It might be corrupted or unsupported.");
    }
}

// ダイアログで「Import」が押された際の実際のデータ統合処理
export function confirmMidiLoad() {
    if (!pendingMidiData) return;
    
    const midi = pendingMidiData;
    const mode = document.getElementById('load-mode-select').value;
    const bpmOption = document.getElementById('load-bpm-select').value;
    
    // --- 1. BPM の適用 ---
    if (bpmOption === 'import' && midi.header.tempos && midi.header.tempos.length > 0) {
        // 最初のテンポチェンジイベントを取得して上書き
        const newBpm = Math.round(midi.header.tempos[0].bpm);
        STATE.bpm = newBpm;
        document.getElementById('bpm-input').value = newBpm;
    }

    // --- 2. トラックの Merge / Replace 処理 ---
    if (mode === 'replace') {
        // 全トラックを削除し、初期状態(空)に戻す
        STATE.tracks = [];
        STATE.nextTrackId = 1;
    }
    
    // MIDIの各トラックをアプリのトラックに変換
    let loadedTrackCount = 0;
    
    midi.tracks.forEach(midiTrack => {
        // ノートが1つもないトラック（メタデータ専用など）は無視
        if (midiTrack.notes.length === 0) return;
        
        // 新規トラックを生成
        const newAppTrack = addTrack();
        
        // トラック名があれば反映
        if (midiTrack.name) {
            newAppTrack.name = midiTrack.name;
        } else {
            newAppTrack.name = `Imported Track ${loadedTrackCount + 1}`;
        }
        
        // --- ノートデータの変換 ---
        // Tonejs/midi は時間を「秒(time)」または「MIDIネイティブのTick(ticks)」で返します。
        // このMIDIファイルの元の分解能(PPQ)を取得
        const sourcePPQ = midi.header.ppq || 128; 
        
        // 私たちのアプリのPPQ(96)に変換するための係数
        const tickMultiplier = STATE.ppq / sourcePPQ;
        
        midiTrack.notes.forEach(midiNote => {
            const adjustedTick = Math.round(midiNote.ticks * tickMultiplier);
            const adjustedDuration = Math.round(midiNote.durationTicks * tickMultiplier);
            
            // 短すぎるノート(1Tick未満)の補正
            const duration = Math.max(1, adjustedDuration);
            
            newAppTrack.notes.push({
                id: STATE.nextNoteId++,
                pitch: midiNote.midi, // MIDIノートナンバー(0-127)
                tick: adjustedTick,
                duration: duration,
                selected: false,
                muted: false
            });
        });
        
        loadedTrackCount++;
    });

    if (loadedTrackCount > 0) {
        // 最初にロードされたトラックをアクティブにする
        STATE.activeTrackId = STATE.tracks[STATE.tracks.length - loadedTrackCount].id;
    } else if (STATE.tracks.length === 0) {
        // ノートが全くなかった場合のフォールバック
        addTrack();
    }

    // --- 3. クリーンアップとUI更新 ---
    pendingMidiData = null;
    closeLoadModal();
    
    // トラックパネル（HTML要素）を再生成
    setupTrackPanel();
    
    // 全体を再描画
    renderAll();
}

export function closeLoadModal() {
    pendingMidiData = null;
    document.getElementById('load-midi-modal').classList.remove('show');
    document.getElementById('modal-overlay').classList.remove('show');
    document.getElementById('grid-canvas').focus();
}