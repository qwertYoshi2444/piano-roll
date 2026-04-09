import { STATE, clearSelection, deleteSelectedNotes } from './state.js';

let clipboardData =[];

export function copyNotes() {
    const selected = STATE.notes.filter(n => n.selected);
    if (selected.length === 0) return;

    selected.sort((a, b) => a.tick - b.tick);
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

    // --- 変更: ペーストの基準位置を画面左端からプレイヘッド位置に変更 ---
    let pasteBaseTick = STATE.playheadTick;
    if (STATE.snap > 0) {
        // スナップ設定に合わせて丸める
        pasteBaseTick = Math.floor(pasteBaseTick / STATE.snap) * STATE.snap;
    }

    clearSelection();

    clipboardData.forEach(item => {
        const newNote = {
            id: STATE.nextNoteId++,
            pitch: item.pitch,
            tick: pasteBaseTick + item.relativeTick,
            duration: item.duration,
            selected: true,
            muted: item.muted || false
        };
        STATE.notes.push(newNote);
    });
}