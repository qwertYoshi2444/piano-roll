import { STATE } from './state.js';

export function exportToMIDI() {
    const hasNotes = STATE.tracks.some(track => track.notes.length > 0);
    if (!hasNotes) {
        alert("ノートが配置されていません。");
        return;
    }

    // --- MIDIバイナリ構築のためのヘルパー関数 ---
    
    // 可変長数値 (VLQ) への変換
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
        return [(value >> 8) & 0xFF, value & 0xFF];
    }

    // 32ビット（4バイト）の数値を配列に変換
    function to32Bit(value) {
        return [(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
    }

    // --- トラックデータの生成 ---
    
    const trackChunks = [];
    
    // 1. コンダクタートラック (Track 0: テンポと拍子情報のみ)
    let conductorData = [];
    conductorData.push(0x00);
    const microsecondsPerBeat = Math.round(60000000 / STATE.bpm);
    conductorData.push(0xFF, 0x51, 0x03, (microsecondsPerBeat >> 16) & 0xFF, (microsecondsPerBeat >> 8) & 0xFF, microsecondsPerBeat & 0xFF);
    conductorData.push(0x00);
    conductorData.push(0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);
    conductorData.push(0x00, 0xFF, 0x2F, 0x00);
    trackChunks.push(conductorData);

    // 2. 各楽器トラック (Track 1〜)
    STATE.tracks.forEach((track, trackIndex) => {
        const activeNotes = track.notes.filter(n => !n.muted);
        if (activeNotes.length === 0) return;

        let trackData = [];
        const channel = trackIndex % 16; // MIDIチャンネル (0-15 = Ch1-16)

        trackData.push(0x00, 0xFF, 0x03);
        const nameBytes = stringToBytes(track.name);
        trackData.push(...toVLQ(nameBytes.length), ...nameBytes);

        let events = [];
        activeNotes.forEach(note => {
            // --- 変更: グローバルトランスポーズを適用してピッチを補正 ---
            let transposedPitch = note.pitch + STATE.globalTranspose;
            
            // MIDI規格の範囲外 (0-127) にならないようにクリップする
            transposedPitch = Math.max(0, Math.min(127, transposedPitch));
            
            events.push({ type: 'on', tick: note.tick, pitch: transposedPitch, velocity: 100 });
            events.push({ type: 'off', tick: note.tick + note.duration, pitch: transposedPitch, velocity: 0 });
        });

        // 時間順でソート (完全に同時の場合は off を先に処理)
        events.sort((a, b) => {
            if (a.tick !== b.tick) return a.tick - b.tick;
            if (a.type !== b.type) return a.type === 'off' ? -1 : 1;
            return 0;
        });

        let currentTick = 0;
        events.forEach(ev => {
            const deltaTick = ev.tick - currentTick;
            currentTick = ev.tick;

            trackData.push(...toVLQ(deltaTick)); 

            if (ev.type === 'on') {
                trackData.push(0x90 + channel, ev.pitch, ev.velocity); 
            } else {
                trackData.push(0x80 + channel, ev.pitch, ev.velocity); 
            }
        });

        trackData.push(0x00, 0xFF, 0x2F, 0x00);
        trackChunks.push(trackData);
    });

    // --- MIDIファイル全体の結合 (SMF Format 1) ---
    
    let midiBytes = [];

    midiBytes.push(
        0x4D, 0x54, 0x68, 0x64, // "MThd"
        0x00, 0x00, 0x00, 0x06, // Chunk length: 6 bytes
        0x00, 0x01,             // Format 1
        ...to16Bit(trackChunks.length), 
        ...to16Bit(STATE.ppq)   // 96 PPQ をそのまま指定
    );

    trackChunks.forEach(data => {
        midiBytes.push(
            0x4D, 0x54, 0x72, 0x6B, // "MTrk"
            ...to32Bit(data.length), 
            ...data                  
        );
    });

    // --- ダウンロード処理 ---
    
    const buffer = new Uint8Array(midiBytes);
    const blob = new Blob([buffer], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `fl_clone_${STATE.bpm}bpm.mid`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
}