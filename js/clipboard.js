import { STATE, clearSelection, deleteSelectedNotes } from './state.js';

let clipboardData = [];

export function copyNotes() {
    const selected = STATE.notes.filter(n => n.selected);
    if (selected.length === 0) return;

    // 時間順にソート
    selected.sort((a, b) => a.tick - b.tick);
    
    // 最初のノートの位置を0とする相対的な位置情報を保存
    const baseTick = selected[0].tick;

    clipboardData = selected.map(note => ({
        pitch: note.pitch,
        relativeTick: note.tick - baseTick,
        duration: note.duration,
        muted: note.muted
    }));
}

export function cutNotes() {
    copyNotes();
    deleteSelectedNotes(); 
}

export function pasteNotes() {
    if (clipboardData.length === 0) return;

    // --- ペーストの基準位置をプレイヘッド(再生バー)位置に変更 ---
    let pasteBaseTick = STATE.playheadTick;
    
    // スナップが有効な場合は、プレイヘッド位置をスナップ値に丸めてからペースト
    if (STATE.snap > 0) {
        pasteBaseTick = Math.floor(pasteBaseTick / STATE.snap) * STATE.snap;
    }

    clearSelection();

    clipboardData.forEach(item => {
        const newNote = {
            id: STATE.nextNoteId++,
            pitch: item.pitch,
            tick: pasteBaseTick + item.relativeTick,
            duration: item.duration,
            selected: true, // ペースト直後は選択状態にして移動しやすくする
            muted: item.muted || false
        };
        STATE.notes.push(newNote);
    });
}