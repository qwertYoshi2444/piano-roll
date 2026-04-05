import { STATE, clearSelection } from './state.js';
import { getNoteAt, xToTick, getPitchAtY, snapTick, tickToX, pitchToY } from './utils.js';

// ツール共通の操作状態
export const editState = {
    action: null,          // 'create', 'move', 'resize', 'delete', 'select', 'mute'
    targetNote: null,      // 主要な操作対象ノート
    startMouseTick: 0,
    startMousePitch: 0,
    originalNotesData:[], // 複数選択移動用のオリジナルデータ保存
    processedNoteIds: new Set() // ドラグ中の重複処理防止用（Mute等）
};

// --- ヘルパー: 矩形選択の当たり判定 ---
function updateSelectionBox() {
    const box = STATE.selectionBox;
    const minX = Math.min(box.startX, box.currentX);
    const maxX = Math.max(box.startX, box.currentX);
    const minY = Math.min(box.startY, box.currentY);
    const maxY = Math.max(box.startY, box.currentY);

    STATE.notes.forEach(note => {
        const nx = tickToX(note.tick);
        const ny = pitchToY(note.pitch);
        const nw = note.duration * STATE.zoomX;
        const nh = STATE.zoomY;
        
        // AABB (Axis-Aligned Bounding Box) 衝突判定
        const isIntersecting = nx < maxX && (nx + nw) > minX && ny < maxY && (ny + nh) > minY;
        note.selected = isIntersecting;
    });
}

// --- Draw Tool (P) ---
export const DrawTool = {
    onMouseDown: (e, mouseX, mouseY) => {
        const rawTick = xToTick(mouseX);
        const pitch = getPitchAtY(mouseY);
        if (pitch === -1) return;

        let clickedNote = getNoteAt(mouseX, mouseY);

        // [Ctrl + 左ドラッグ] 矩形選択
        if (e.ctrlKey && e.button === 0) {
            editState.action = 'select';
            STATE.selectionBox.active = true;
            STATE.selectionBox.startX = mouseX;
            STATE.selectionBox.startY = mouseY;
            STATE.selectionBox.currentX = mouseX;
            STATE.selectionBox.currentY = mouseY;
            if (!e.shiftKey) clearSelection(); // Shiftを押していなければ既存選択を解除
            return;
        }

        // [左クリック]
        if (e.button === 0) {
            if (clickedNote) {
                // Shiftキーで複製 (Clone)
                if (e.shiftKey) {
                    let notesToCopy = STATE.notes.filter(n => n.selected);
                    // 選択されていないノートをShift+クリックした場合は、そのノート単体を複製
                    if (!clickedNote.selected) {
                        notesToCopy = [clickedNote];
                    }
                    
                    const clones = notesToCopy.map(n => ({
                        ...n,
                        id: STATE.nextNoteId++,
                        selected: true // 複製された側を選択状態に
                    }));
                    
                    STATE.notes.forEach(n => n.selected = false); // 元の選択を解除
                    STATE.notes.push(...clones);
                    
                    // クリックしたノートのクローンを新しいターゲットに設定
                    clickedNote = clones.find(c => c.pitch === clickedNote.pitch && c.tick === clickedNote.tick);
                }

                // ノートが選択されていなければ、それを単独選択
                if (!clickedNote.selected && !e.shiftKey) {
                    clearSelection();
                    clickedNote.selected = true;
                }

                const edgeHitArea = 8 / STATE.zoomX;
                if (Math.abs(rawTick - (clickedNote.tick + clickedNote.duration)) <= edgeHitArea) {
                    editState.action = 'resize';
                } else {
                    editState.action = 'move';
                }

                editState.targetNote = clickedNote;
                editState.startMouseTick = rawTick;
                editState.startMousePitch = pitch;
                
                // 選択されている全ノートの初期状態を保存（複数同時移動・リサイズのため）
                editState.originalNotesData = STATE.notes.filter(n => n.selected).map(n => ({
                    note: n, originalTick: n.tick, originalPitch: n.pitch, originalDuration: n.duration
                }));

            } else {
                // 空き地をクリック (新規作成)
                clearSelection();
                editState.action = 'create';
                const snappedTick = snapTick(rawTick, e.altKey);
                const newNote = { 
                    id: STATE.nextNoteId++, pitch: pitch, tick: snappedTick, 
                    duration: STATE.lastDuration, selected: true, muted: false 
                };
                STATE.notes.push(newNote);
                editState.targetNote = newNote;
            }
        } 
        // [右クリック] (削除)
        else if (e.button === 2) {
            editState.action = 'delete';
            if (clickedNote) {
                STATE.notes = STATE.notes.filter(n => n.id !== clickedNote.id);
            }
        }
    },

    onMouseMove: (e, mouseX, mouseY, rawTick, pitch) => {
        if (editState.action === 'select') {
            STATE.selectionBox.currentX = mouseX;
            STATE.selectionBox.currentY = mouseY;
            updateSelectionBox();
            return;
        }

        if (editState.action === 'resize') {
            const newRightEdge = snapTick(rawTick, e.altKey);
            const deltaTick = newRightEdge - (editState.targetNote.tick + editState.targetNote.duration);
            
            // 選択された全てのノートの長さを変更
            editState.originalNotesData.forEach(item => {
                let newDuration = item.originalDuration + deltaTick;
                if (newDuration < 1) newDuration = 1;
                item.note.duration = newDuration;
            });
            
        } else if (editState.action === 'move') {
            const tickDiff = rawTick - editState.startMouseTick;
            const pitchDiff = pitch - editState.startMousePitch;

            // スナップ処理はターゲットノート基準で計算し、その差分を他に適用する
            const snappedTargetTick = snapTick(editState.originalNotesData.find(i => i.note === editState.targetNote).originalTick + tickDiff, e.altKey);
            const actualTickDiff = snappedTargetTick - editState.originalNotesData.find(i => i.note === editState.targetNote).originalTick;

            editState.originalNotesData.forEach(item => {
                let newTick = item.originalTick + actualTickDiff;
                let newPitch = item.originalPitch + pitchDiff;
                item.note.tick = Math.max(0, newTick);
                item.note.pitch = Math.min(127, Math.max(0, newPitch));
            });

        } else if (editState.action === 'create' && editState.targetNote) {
             const snappedTick = snapTick(rawTick, e.altKey);
             editState.targetNote.tick = Math.max(0, snappedTick);
             editState.targetNote.pitch = Math.min(127, Math.max(0, pitch));

        } else if (editState.action === 'delete') {
            const hoveredNote = getNoteAt(mouseX, mouseY);
            if (hoveredNote) {
                STATE.notes = STATE.notes.filter(n => n.id !== hoveredNote.id);
            }
        }
    },

    onMouseUp: () => {
        if (editState.action === 'select') {
            STATE.selectionBox.active = false;
        } else if ((editState.action === 'resize' || editState.action === 'create') && editState.targetNote) {
            STATE.lastDuration = editState.targetNote.duration;
        }
        resetEditState();
    }
};

// --- その他のツール ---

export const SelectTool = {
    onMouseDown: (e, mouseX, mouseY) => {
        if (e.button === 0) {
            editState.action = 'select';
            STATE.selectionBox.active = true;
            STATE.selectionBox.startX = mouseX; STATE.selectionBox.startY = mouseY;
            STATE.selectionBox.currentX = mouseX; STATE.selectionBox.currentY = mouseY;
            if (!e.shiftKey) clearSelection();
        }
    },
    onMouseMove: (e, mouseX, mouseY) => {
        if (editState.action === 'select') {
            STATE.selectionBox.currentX = mouseX;
            STATE.selectionBox.currentY = mouseY;
            updateSelectionBox();
        }
    },
    onMouseUp: () => {
        STATE.selectionBox.active = false;
        resetEditState();
    }
};

export const MuteTool = {
    onMouseDown: (e, mouseX, mouseY) => {
        if (e.button === 0) {
            editState.action = 'mute';
            editState.processedNoteIds.clear();
            toggleMuteAt(mouseX, mouseY);
        }
    },
    onMouseMove: (e, mouseX, mouseY) => {
        if (editState.action === 'mute') toggleMuteAt(mouseX, mouseY);
    },
    onMouseUp: () => resetEditState()
};

function toggleMuteAt(x, y) {
    const note = getNoteAt(x, y);
    if (note && !editState.processedNoteIds.has(note.id)) {
        note.muted = !note.muted;
        editState.processedNoteIds.add(note.id); // 一度のドラッグで何度も反転しないように記録
    }
}

export const DeleteTool = {
    onMouseDown: (e, mouseX, mouseY) => {
        if (e.button === 0) {
            editState.action = 'delete';
            deleteAt(mouseX, mouseY);
        }
    },
    onMouseMove: (e, mouseX, mouseY) => {
        if (editState.action === 'delete') deleteAt(mouseX, mouseY);
    },
    onMouseUp: () => resetEditState()
};

function deleteAt(x, y) {
    const note = getNoteAt(x, y);
    if (note) STATE.notes = STATE.notes.filter(n => n.id !== note.id);
}

// 共通リセット処理
function resetEditState() {
    editState.action = null;
    editState.targetNote = null;
    editState.originalNotesData =