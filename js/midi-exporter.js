import { STATE } from './state.js';
// CDNから midi-writer-js をインポート
import MidiWriter from 'https://cdn.jsdelivr.net/npm/midi-writer-js@2.1.4/build/index.browser.js';

export function exportToMIDI() {
    const hasNotes = STATE.tracks.some(track => track.notes.length > 0);
    if (!hasNotes) {
        alert("ノートが配置されていません。");
        return;
    }

    const midiTracks =[];

    // ライブラリの固定PPQ(128)に合わせてアプリのPPQ(96)を変換する係数
    const targetPPQ = 128; 
    const tickMultiplier = targetPPQ / STATE.ppq;

    // 各トラックの変換
    STATE.tracks.forEach((track, trackIndex) => {
        const activeNotes = track.notes.filter(n => !n.muted);
        if (activeNotes.length === 0) return;

        const midiTrack = new MidiWriter.Track();
        
        // DAWが確実にメタデータを読み取れるよう、各トラックにBPMと拍子を書き込む
        midiTrack.addTrackName(track.name);
        midiTrack.setTempo(STATE.bpm);
        midiTrack.setTimeSignature(4, 4);
        
        const channel = trackIndex + 1; // MIDIチャンネル 1-16

        // --- 確実な解決法: イベントの低レベル分解 ---
        const events =[];

        // 1. すべてのノートを「発音(On)」と「消音(Off)」の2つの独立したイベントに分解
        activeNotes.forEach(note => {
            const startTick = Math.round(note.tick * tickMultiplier);
            const endTick = Math.round((note.tick + note.duration) * tickMultiplier);

            events.push({
                type: 'on',
                pitch: note.pitch,
                tick: startTick
            });

            events.push({
                type: 'off',
                pitch: note.pitch,
                tick: endTick
            });
        });

        // 2. 曲の先頭からの絶対時間(tick)でイベントを昇順ソート
        events.sort((a, b) => {
            if (a.tick !== b.tick) {
                return a.tick - b.tick; // 時間が早い順
            }
            // ★重要: 全く同じタイミングにOnとOffが重なった場合は、
            // 必ず「Offを先」に処理することで音が詰まるバグを防ぐ
            if (a.type === 'off' && b.type === 'on') return -1;
            if (a.type === 'on' && b.type === 'off') return 1;
            return 0;
        });

        // 3. 直前のイベントからの差分（デルタタイム）を計算しながら順番に書き込む
        let currentTick = 0;
        events.forEach(ev => {
            const deltaTick = ev.tick - currentTick;
            const waitTime = `T${deltaTick}`; // ライブラリ指定の Tick 待機フォーマット

            if (ev.type === 'on') {
                const noteOn = new MidiWriter.NoteOnEvent({
                    pitch: [ev.pitch],
                    wait: waitTime,
                    channel: channel,
                    velocity: 100 // 音量
                });
                midiTrack.addEvent(noteOn);
            } else {
                const noteOff = new MidiWriter.NoteOffEvent({
                    pitch: [ev.pitch],
                    wait: waitTime,
                    channel: channel,
                    velocity: 0
                });
                midiTrack.addEvent(noteOff);
            }

            // 現在の時間を更新
            currentTick = ev.tick;
        });

        midiTracks.push(midiTrack);
    });

    if (midiTracks.length === 0) return;

    // データ生成とBase64化
    const write = new MidiWriter.Writer(midiTracks);
    const dataUri = write.dataUri();
    
    // ダウンロード
    downloadURI(dataUri, `fl_clone_${STATE.bpm}bpm.mid`);
}

function downloadURI(uri, name) {
    const link = document.createElement("a");
    link.download = name;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}