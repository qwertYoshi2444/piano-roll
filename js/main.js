import { STATE, clearSelection, addTrack, changeTrackColor, TRACK_COLORS } from './state.js';
import { initRenderer, renderAll } from './renderer.js';
import { initEvents } from './events.js';

let editingTrackId = null; 
let coloringTrackId = null; // 色を変更中のトラックID

document.addEventListener('DOMContentLoaded', () => {
    const gridCvs = document.getElementById('grid-canvas');
    const keyCvs = document.getElementById('keyboard-canvas');
    const timeCvs = document.getElementById('timeline-canvas');

    initRenderer(gridCvs, keyCvs, timeCvs);
    initEvents(gridCvs);

    window.addEventListener('resize', resizeCanvas);
    document.getElementById('track-panel-container').addEventListener('transitionend', resizeCanvas);
    
    resizeCanvas();
    setupToolbar();
    setupTrackPanel();
    setupModals();
    setTool('draw');
});

function resizeCanvas() {
    const rollArea = document.getElementById('roll-area');
    const rect = rollArea.getBoundingClientRect();
    
    const gridCvs = document.getElementById('grid-canvas');
    const keyCvs = document.getElementById('keyboard-canvas');
    const timeCvs = document.getElementById('timeline-canvas');

    // モバイル端末でのバグを防ぐため、幅が0以下の場合は計算をスキップ
    if (rect.width <= 0 || rect.height <= 0) return;

    const w = rect.width - 80;
    const h = rect.height - 30;

    gridCvs.width = w; 
    gridCvs.height = h;
    keyCvs.width = 80; 
    keyCvs.height = h;
    timeCvs.width = w; 
    timeCvs.height = 30;

    renderAll();
}

function setupToolbar() {
    const btnTogglePanel = document.getElementById('btn-toggle-panel');
    const panelContainer = document.getElementById('track-panel-container');
    btnTogglePanel.addEventListener('click', () => {
        panelContainer.classList.toggle('closed');
    });

    document.getElementById('snap-select').addEventListener('change', e => {
        STATE.snap = parseInt(e.target.value, 10);
    });

    const bpmInput = document.getElementById('bpm-input');
    bpmInput.addEventListener('change', e => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 20) val = 20;
        if (val > 300) val = 300;
        e.target.value = val;
        STATE.bpm = val;
    });

    const tools = ['draw', 'select', 'mute', 'delete'];
    tools.forEach(tool => {
        const btn = document.getElementById(`btn-${tool}`);
        btn.addEventListener('click', () => setTool(tool));
    });
    
    // トラック追加ボタンのイベント
    document.getElementById('btn-add-track').addEventListener('click', () => {
        addTrack();
        setupTrackPanel(); // パネルを再構築
        renderAll();
        
        // 追加されたトラックが見えるように一番下までスクロール
        const trackList = document.getElementById('track-list');
        trackList.scrollTop = trackList.scrollHeight;
    });
}

// --- トラック管理パネルの動的生成 ---
function setupTrackPanel() {
    const trackList = document.getElementById('track-list');
    trackList.innerHTML = ''; 

    STATE.tracks.forEach(track => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `track-item ${track.id === STATE.activeTrackId ? 'active' : ''}`;
        itemDiv.dataset.trackId = track.id;

        // カラーインジケーター（クリックで色変更モーダルを開く）
        const colorDiv = document.createElement('div');
        colorDiv.className = 'track-color-indicator';
        colorDiv.style.backgroundColor = track.color;
        colorDiv.title = 'Change Color';
        colorDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            openColorModal(track.id);
        });

        // トラック名（ダブルクリックで編集可能な input に変更）
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'track-name-input';
        nameInput.value = track.name;
        // 通常時はreadonlyにしておき、ダブルクリックで編集可能に
        nameInput.readOnly = true;
        
        nameInput.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            nameInput.readOnly = false;
            nameInput.focus();
            nameInput.select();
        });
        
        // 編集完了（エンターキーまたはフォーカスが外れた時）
        const finishEditing = () => {
            nameInput.readOnly = true;
            if (nameInput.value.trim() === '') {
                nameInput.value = `Track ${track.id}`; // 空ならデフォルト名に戻す
            }
            track.name = nameInput.value;
            // フォーカスをキャンバスに戻す
            document.getElementById('grid-canvas').focus();
        };
        nameInput.addEventListener('blur', finishEditing);
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameInput.blur(); // blurイベントをトリガーして保存
            }
        });
        // Inputフィールドをクリックした際、親要素(itemDiv)のクリックイベント(アクティブ化)も発火させる
        nameInput.addEventListener('click', (e) => {
            if(nameInput.readOnly) {
                // readOnlyの時は、通常のテキストのようにクリックイベントを親に伝える
                itemDiv.click();
            } else {
                e.stopPropagation(); // 編集モード中は親への伝播を止める
            }
        });

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'track-controls';

        const muteBtn = document.createElement('button');
        muteBtn.className = `tc-btn ${track.isMuted ? 'muted' : ''}`;
        muteBtn.textContent = 'M';
        muteBtn.title = 'Mute';
        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            track.isMuted = !track.isMuted;
            muteBtn.classList.toggle('muted', track.isMuted);
            renderAll();
        });

        const soloBtn = document.createElement('button');
        soloBtn.className = `tc-btn ${track.isSoloed ? 'soloed' : ''}`;
        soloBtn.textContent = 'S';
        soloBtn.title = 'Solo';
        soloBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            track.isSoloed = !track.isSoloed;
            soloBtn.classList.toggle('soloed', track.isSoloed);
            if (track.isSoloed && track.isMuted) {
                track.isMuted = false;
                muteBtn.classList.remove('muted');
            }
            renderAll();
        });

        const synthBtn = document.createElement('button');
        synthBtn.className = 'tc-btn';
        synthBtn.textContent = '⚙';
        synthBtn.title = 'Synth Settings';
        synthBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSynthModal(track.id);
        });

        controlsDiv.appendChild(muteBtn);
        controlsDiv.appendChild(soloBtn);
        controlsDiv.appendChild(synthBtn);

        itemDiv.appendChild(colorDiv);
        itemDiv.appendChild(nameInput); // nameDiv から nameInput に変更
        itemDiv.appendChild(controlsDiv);

        itemDiv.addEventListener('click', () => {
            if (STATE.activeTrackId !== track.id) {
                clearSelection();
                STATE.activeTrackId = track.id;
                document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
                itemDiv.classList.add('active');
                renderAll();
            }
        });

        trackList.appendChild(itemDiv);
    });
}

// --- モーダル (設定・色選択) の初期化と制御 ---
function setupModals() {
    const overlay = document.getElementById('modal-overlay');
    
    // --- シンセ設定モーダル ---
    const synthModal = document.getElementById('synth-modal');
    const synthCloseBtn = document.getElementById('modal-close');
    
    const inputHandlers = {
        'waveform': (val) => val,
        'attack':   (val) => Math.max(0.0001, parseFloat(val) / 1000), 
        'decay':    (val) => parseFloat(val) / 1000,                   
        'sustain':  (val) => parseFloat(val) / 100,                    
        'release':  (val) => parseFloat(val) / 1000                    
    };

    Object.keys(inputHandlers).forEach(key => {
        document.getElementById(`synth-${key}`).addEventListener('input', (e) => {
            if (editingTrackId) {
                const track = STATE.tracks.find(t => t.id === editingTrackId);
                track[key] = inputHandlers[key](e.target.value);
            }
        });
    });

    const closeSynthModal = () => {
        synthModal.classList.remove('show');
        overlay.classList.remove('show');
        editingTrackId = null;
        document.getElementById('grid-canvas').focus(); // フォーカスを戻す
    };
    synthCloseBtn.addEventListener('click', closeSynthModal);

    // --- 色選択モーダル ---
    const colorModal = document.getElementById('color-modal');
    const colorCloseBtn = document.getElementById('color-modal-close');
    const paletteContainer = document.getElementById('color-palette');
    
    // 32色のスウォッチ（色見本）を生成
    TRACK_COLORS.forEach((colorObj, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = colorObj.fill;
        swatch.dataset.index = index;
        
        swatch.addEventListener('click', () => {
            if (coloringTrackId) {
                changeTrackColor(coloringTrackId, index);
                setupTrackPanel(); // パネルのUI(丸い色)を更新
                renderAll();       // 描画されているノートの色も即座に更新
                closeColorModal();
            }
        });
        paletteContainer.appendChild(swatch);
    });

    const closeColorModal = () => {
        colorModal.classList.remove('show');
        overlay.classList.remove('show');
        coloringTrackId = null;
        document.getElementById('grid-canvas').focus();
    };
    colorCloseBtn.addEventListener('click', closeColorModal);

    // --- オーバーレイクリックで両方閉じる ---
    overlay.addEventListener('click', () => {
        closeSynthModal();
        closeColorModal();
    });
}

function openSynthModal(trackId) {
    const track = STATE.tracks.find(t => t.id === trackId);
    if (!track) return;
    
    editingTrackId = trackId;
    
    document.getElementById('modal-track-name').textContent = `${track.name} Settings`;
    document.getElementById('synth-waveform').value = track.waveform;
    document.getElementById('synth-attack').value = track.attack * 1000;
    document.getElementById('synth-decay').value = track.decay * 1000;
    document.getElementById('synth-sustain').value = track.sustain * 100;
    document.getElementById('synth-release').value = track.release * 1000;
    
    document.getElementById('modal-overlay').classList.add('show');
    document.getElementById('synth-modal').classList.add('show');
}

function openColorModal(trackId) {
    coloringTrackId = trackId;
    const track = STATE.tracks.find(t => t.id === trackId);
    
    // 現在選択されている色にハイライトをつける
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('selected');
        if (parseInt(swatch.dataset.index, 10) === track.colorIndex) {
            swatch.classList.add('selected');
        }
    });

    document.getElementById('modal-overlay').classList.add('show');
    document.getElementById('color-modal').classList.add('show');
}

export function setTool(toolName) {
    STATE.currentTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    
    // toggle-panelボタンなどを除外するためIDで取得
    const targetBtn = document.getElementById(`btn-${toolName}`);
    if(targetBtn) targetBtn.classList.add('active');
    
    const gridCvs = document.getElementById('grid-canvas');
    if(!gridCvs) return;

    if (toolName === 'draw') gridCvs.style.cursor = 'crosshair';
    else if (toolName === 'select') gridCvs.style.cursor = 'cell';
    else if (toolName === 'mute') gridCvs.style.cursor = 'not-allowed';
    else if (toolName === 'delete') gridCvs.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'red\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><line x1=\'18\' y1=\'6\' x2=\'6\' y2=\'18\'></line><line x1=\'6\' y1=\'6\' x2=\'18\' y2=\'18\'></line></svg>") 8 8, auto';
}