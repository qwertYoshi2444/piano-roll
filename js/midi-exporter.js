import { STATE } from './state.js';

export function exportToMIDI() {
    const hasNotes = STATE.tracks.some(track => track.notes.length > 0);
    if (!hasNotes) {
        alert("ノートが配置されていません。");
        return;
    }

    // --- MIDIバイナリ構築のためのヘルパー関数 ---
    
    // 可変長数値 (VLQ: Variable Length Quantity) への変換
    // MIDIのデルタタイム（待機時間）はこの特殊な形式でバイナリ化される
    function toVLQ(value) {
        let buffer = [value & 0x7F];
        while ((value >>= 7) > 0) {
            buffer.unshift((value & 0x7F) | 0x80);
        }
        return buffer;
    }

    // 文字列をASCIIバイト配列に変換
    function stringToBytes(str) {
        return Array.from(str).map(c => c.charCodeAt(0));
    }

    // 16ビット（2バイト）の数値を配列に変換
    function to16Bit(value) {
        return[(value >> 8) & 0xFF, value & 0xFF];
    }

    // 32ビット（4バイト）の数値を配列に変換
    function to32Bit(value) {
        return[(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
    }

    // --- トラックデータの生成 ---
    
    const trackChunks =[];
    
    // 1. コンダクタートラック (Track 0: テンポと拍子情報のみ)
    let conductorData =[];
    // Delta time: 0
    conductorData.push(0x00);
    // Tempo Meta Event: 0xFF 0x51 0x03 [t1, t2, t3]
    const microsecondsPerBeat = Math.round(60000000 / STATE.bpm);
    conductorData.push(0xFF, 0x51, 0x03, (microsecondsPerBeat >> 16) & 0xFF, (microsecondsPerBeat >> 8) & 0xFF, microsecondsPerBeat & 0xFF);
    
    // Delta time: 0
    conductorData.push(0x00);
    // Time Signature Meta Event (4/4拍子): 0xFF 0x58 0x04 0x04 0x02 0x18 0x08
    conductorData.push(0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);
    
    // End of Track: 0x00 0xFF 0x2F 0x00
    conductorData.push(0x00, 0xFF, 0x2F, 0x00);
    trackChunks.push(conductorData);

    // 2. 各楽器トラック (Track 1〜16)
    STATE.tracks.forEach((track, trackIndex) => {
        const activeNotes = track.notes.filter(n => !n.muted);
        if (activeNotes.length === 0) return;

        let trackData =[];
        const channel = trackIndex; // MIDIチャンネル (0-15 = Ch1-16)

        // トラック名 Meta Event: 0x00 0xFF 0x03 [length] [text...]
        trackData.push(0x00, 0xFF, 0x03);
        const nameBytes = stringToBytes(track.name);
        trackData.push(...toVLQ(nameBytes.length), ...nameBytes);

        // すべてのノートを「Note On」と「Note Off」の2つのイベントに完全に分解する
        let events =[];
        activeNotes.forEach(note => {
            events.push({ type: 'on', tick: note.tick, pitch: note.pitch, velocity: 100 });
            events.push({ type: 'off', tick: note.tick + note.duration, pitch: note.pitch, velocity: 0 });
        });

        // 絶対時間 (tick) で昇順にソート。完全に同時の場合は Off を先に処理して音が詰まるのを防ぐ
        events.sort((a, b) => {
            if (a.tick !== b.tick) return a.tick - b.tick;
            if (a.type !== b.type) return a.type === 'off' ? -1 : 1;
            return 0;
        });

        // デルタタイム（前のイベントからの差分）を計算しながらバイナリ化
        let currentTick = 0;
        events.forEach(ev => {
            const deltaTick = ev.tick - currentTick;
            currentTick = ev.tick;

            trackData.push(...toVLQ(deltaTick)); // 待機時間

            if (ev.type === 'on') {
                trackData.push(0x90 + channel, ev.pitch, ev.velocity); // Note On
            } else {
                trackData.push(0x80 + channel, ev.pitch, ev.velocity); // Note Off
            }
        });

        // End of Track
        trackData.push(0x00, 0xFF, 0x2F, 0x00);
        trackChunks.push(trackData);
    });

    // --- MIDIファイル全体の結合 (SMF Format 1) ---
    
    let midiBytes =[];

    // ヘッダチャンク (MThd)
    midiBytes.push(
        0x4D, 0x54, 0x68, 0x64, // "MThd"
        0x00, 0x00, 0x00, 0x06, // Chunk length: 6 bytes
        0x00, 0x01,             // Format 1 (マルチトラック)
        ...to16Bit(trackChunks.length), // トラック数
        ...to16Bit(STATE.ppq)   // 時間分解能 (PPQ=96 をそのまま指定！)
    );

    // トラックチャンク (MTrk)
    trackChunks.forEach(data => {
        midiBytes.push(
            0x4D, 0x54, 0x72, 0x6B, // "MTrk"
            ...to32Bit(data.length), // データ長
            ...data                  // データ本体
        );
    });

    // --- ダウンロード処理 ---
    
    // Uint8Array（純粋なバイナリ配列）に変換
    const buffer = new Uint8Array(midiBytes);
    
    // Blob を作成し、オブジェクトURLを発行
    const blob = new Blob([buffer], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `fl_clone_${STATE.bpm}bpm.mid`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // メモリ解放
    URL.revokeObjectURL(url);
}