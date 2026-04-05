import { STATE, clearSelection } from './state.js';

let clipboardData =[]; // コピーされたノートのテンプレートを保持

export function copyNotes() {
    const selected = STATE.notes.filter(n => n.selected);
    if (selected.length === 0) return;

    // Tick順にソート
    selected.sort((a, b) => a.tick - b.tick);

    // 最も早いTickを基準(0)として、相対的な位置を保存する
    const baseTick = selected[0].tick;

    clipboardData = selected.map(note => ({
        pitch: note.pitch,
        relativeTick: note.tick - baseTick, // 基準からの差分
        duration: note.duration,
        muted: note.muted
    }));
}

export function cutNotes() {
    copyNotes();
    // 選択されているノートを削除
    STATE.notes = STATE.notes.filter(n => !n.selected);
}

export function pasteNotes() {
    if (clipboardData.length === 0) return;

    // ペースト先は現在の画面左端（scrollTick）のスナップ位置
    // もしスナップが0ならそのまま
    let pasteBaseTick = STATE.scrollTick;
    if (STATE.snap > 0) {
        pasteBaseTick = Math.ceil(pasteBaseTick / STATE.snap) * STATE.snap;
    }

    // 既存の選択を解除
    clearSelection();

    // クリップボードのデータから新しいノートを生成
    clipboardData.forEach(item => {
        const newNote = {
            id: STATE.nextNoteId++,
            pitch: item.pitch,
            tick: pasteBaseTick + item.relativeTick,
            duration: item.duration,
            selected: true, // ペースト直後は選択状態にする
            muted: item.muted || false
        };
        STATE.notes.push(newNote);
    });
}