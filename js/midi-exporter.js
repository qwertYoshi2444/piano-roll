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

    // ライブラリの想定PPQ(128)とアプリ内PPQ(96)の変換係数
    const targetPPQ = 128; 
    const tickMultiplier = targetPPQ / STATE.ppq;

    // 各トラックの変換
    STATE.tracks.forEach((track, trackIndex) => {
        // ミュートされていないノートのみを抽出
        const activeNotes = track.notes.filter(n => !n.muted);
        if (activeNotes.length === 0) return;

        const midiTrack = new MidiWriter.Track();
        
        // DAWが確実にメタデータを読み取れるよう、各楽器トラックに直接BPMと拍子を書き込む
        midiTrack.addTrackName(track.name);
        midiTrack.setTempo(STATE.bpm);
        midiTrack.setTimeSignature(4, 4);
        
        const channel = trackIndex + 1; // MIDIチャンネル 1-16

        // 1. ノートを開始位置(tick)の昇順でソートする
        activeNotes.sort((a, b) => a.tick - b.tick);

        // 2. 解決法: 和音（同じtick、同じdurationのノート）を1つのグループにまとめる
        const groupedNotes =[];
        
        activeNotes.forEach(note => {
            // 既に同じタイミング・長さで登録されたグループがあるか探す
            const existingGroup = groupedNotes.find(g => g.tick === note.tick && g.duration === note.duration);
            
            if (existingGroup) {
                // 存在すれば、そのグループのピッチ配列に音を追加（和音化）
                existingGroup.pitches.push(note.pitch);
            } else {
                // 存在しなければ新しいグループを作成
                groupedNotes.push({
                    tick: note.tick,
                    duration: note.duration,
                    pitches: [note.pitch]
                });
            }
        });

        // 3. グループ化されたノート群をライブラリに渡す
        groupedNotes.forEach(group => {
            // 長さと開始位置を 128 PPQ 用に補正
            const adjustedDuration = Math.round(group.duration * tickMultiplier);
            const adjustedTick = Math.round(group.tick * tickMultiplier);

            const noteEvent = new MidiWriter.NoteEvent({
                pitch: group.pitches,             // 配列で渡すことで、ライブラリが1つの和音イベントとして正確に処理する
                duration: `T${adjustedDuration}`, // 補正済みのTick単位長
                tick: adjustedTick,               // 補正済みの開始絶対位置
                channel: channel,
                velocity: 100 
            });

            midiTrack.addEvent(noteEvent);
        });

        midiTracks.push(midiTrack);
    });

    if (midiTracks.length === 0) return;

    // 補正したデータをWriterに渡し、Base64URIを生成
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