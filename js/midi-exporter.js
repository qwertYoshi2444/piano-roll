import { STATE } from './state.js';
import MidiWriter from 'https://cdn.jsdelivr.net/npm/midi-writer-js@2.1.4/build/index.browser.js';

export function exportToMIDI() {
    const hasNotes = STATE.tracks.some(track => track.notes.length > 0);
    if (!hasNotes) {
        alert("ノートが配置されていません。");
        return;
    }

    const midiTracks = [];

    // 重要: midi-writer-js は内部的に 128 PPQ (デフォルト) を想定して時間を計算する。
    // 私たちのアプリは 96 PPQ なので、Ticksをそのまま渡すと 96/128 倍の長さ(速いテンポ)になってしまう。
    // そのため、書き込む前に時間を変換する係数を用意する。
    const targetPPQ = 128; 
    const tickMultiplier = targetPPQ / STATE.ppq;

    // トラック0として「コンダクタートラック（メタデータ用）」を作成する
    const conductorTrack = new MidiWriter.Track();
    conductorTrack.setTempo(STATE.bpm); // GUIで設定したBPMを反映
    conductorTrack.addTrackName('Conductor');
    midiTracks.push(conductorTrack);

    // 各ノートトラックの変換
    STATE.tracks.forEach((track, trackIndex) => {
        const activeNotes = track.notes.filter(n => !n.muted);
        if (activeNotes.length === 0) return;

        const midiTrack = new MidiWriter.Track();
        midiTrack.addTrackName(track.name);
        const channel = trackIndex + 1; // 1-16

        activeNotes.sort((a, b) => a.tick - b.tick);

        activeNotes.forEach(note => {
            // 長さと開始位置を midi-writer-js 用の解像度(128 PPQ)に補正
            const adjustedDuration = Math.round(note.duration * tickMultiplier);
            const adjustedTick = Math.round(note.tick * tickMultiplier);

            const noteEvent = new MidiWriter.NoteEvent({
                pitch: [note.pitch],
                duration: `T${adjustedDuration}`, // 補正済みのTick単位長
                tick: adjustedTick,               // 補正済みの開始絶対位置
                channel: channel,
                velocity: 100 
            });

            midiTrack.addEvent(noteEvent);
        });

        midiTracks.push(midiTrack);
    });

    if (midiTracks.length <= 1) return; // コンダクタートラックしか無い場合はエクスポートしない

    // 補正したデータをライブラリに渡す。
    const write = new MidiWriter.Writer(midiTracks);
    const dataUri = write.dataUri();
    
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