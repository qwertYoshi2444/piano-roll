import { STATE } from './state.js';
// CDNから midi-writer-js をインポート (ES Module版)
import MidiWriter from 'https://cdn.jsdelivr.net/npm/midi-writer-js@2.1.4/build/index.browser.js';

export function exportToMIDI() {
    // トラックが1つもノートを持っていない場合はエクスポートしない
    const hasNotes = STATE.tracks.some(track => track.notes.length > 0);
    if (!hasNotes) {
        alert("ノートが配置されていません。");
        return;
    }

    const midiTracks = [];

    // 各トラックの変換
    STATE.tracks.forEach((track, trackIndex) => {
        // ミュートされていないノートのみを抽出
        const activeNotes = track.notes.filter(n => !n.muted);
        
        if (activeNotes.length === 0) return; // 空のトラックはスキップ

        // midi-writer-js のトラックインスタンスを生成
        const midiTrack = new MidiWriter.Track();
        
        // トラック名を設定 (DAWに読み込んだ際に表示される)
        midiTrack.addTrackName(track.name);
        
        // トラックごとに異なるMIDIチャンネルを割り当てる (1〜16)
        // ※ midi-writer-js はチャンネル番号を 1 からカウントします
        const channel = trackIndex + 1;

        // ノートをTick順にソートする (MIDIファイルの仕様上、時間順の処理が安全)
        activeNotes.sort((a, b) => a.tick - b.tick);

        activeNotes.forEach(note => {
            // midi-writer-js の NoteEvent を生成
            // ※ pitch は数値 (0-127) をそのまま渡せます。
            // ※ tick は絶対位置 (曲の先頭からのTick数) を指定します。ライブラリ内部でデルタタイムに自動変換してくれます。
            const noteEvent = new MidiWriter.NoteEvent({
                pitch: [note.pitch],
                duration: `T${note.duration}`, // Tick単位の長さを指定するフォーマット
                tick: note.tick,
                channel: channel,
                velocity: 100 // 今回はベロシティ固定
            });

            midiTrack.addEvent(noteEvent);
        });

        midiTracks.push(midiTrack);
    });

    if (midiTracks.length === 0) return;

    // Writerインスタンスを生成（ここで分解能 PPQ を指定）
    // 第二引数に null, 第三引数に PPQ を渡す仕様
    const write = new MidiWriter.Writer(midiTracks);
    // ただし、MidiWriter.Writer のコンストラクタは現在PPQの直接指定をサポートしていない場合があるため、
    // 生成されたファイルはデフォルトのPPQ（128等）になる可能性があります。
    // （DAW側でインポート時にBPMや拍子が調整されます）

    // Base64エンコードされたURIを取得
    const dataUri = write.dataUri();
    
    // ダウンロード処理のトリガー
    downloadURI(dataUri, 'fl_clone_project.mid');
}

// Base64 URI をファイルとしてダウンロードさせるヘルパー関数
function downloadURI(uri, name) {
    const link = document.createElement("a");
    link.download = name;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}