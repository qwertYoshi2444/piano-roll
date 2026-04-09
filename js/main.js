import { STATE, clearSelection } from './state.js';
import { initRenderer, renderAll } from './renderer.js';
import { initEvents } from './events.js';

let editingTrackId = null; // 現在音色設定を開いているトラックID

document.addEventListener('DOMContentLoaded', () => {
    const gridCvs = document.getElementById('grid-canvas');
    // キーボードキャンバスは廃止し、トラックリストに置き換わりました
    const timeCvs = document.getElementById('timeline-canvas');

    // rendererの初期化シグネチャを変更（鍵盤キャンバスを渡さない）
    initRenderer(gridCvs, null, timeCvs);
    initEvents(gridCvs);

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    setupToolbar();
    setupTrackPanel();
    setupSynthModal();
    setTool('draw');
});

function resizeCanvas() {
    const editorArea = document.getElementById('editor-area');
    const rect = editorArea.getBoundingClientRect();
    
    const gridCvs = document.getElementById('grid-canvas');
    const timeCvs = document.getElementById('timeline-canvas');

    // CSS Grid の設定に合わせて幅を計算 (左側トラックパネルが200px)
    const w = rect.width - 200;
    const h = rect.height - 30;

    gridCvs.width = w; 
    gridCvs.height = h;
    timeCvs.width = w; 
    timeCvs.height = 30;

    renderAll();
}

function setupToolbar() {
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
}

// --- 新規: トラック管理パネルの動的生成とイベントバインド ---
function setupTrackPanel() {
    const trackList = document.getElementById('track-list');
    trackList.innerHTML = ''; // クリア

    STATE.tracks.forEach(track => {
        // トラック全体を囲むdiv
        const itemDiv = document.createElement('div');
        itemDiv.className = `track-item ${track.id === STATE.activeTrackId ? 'active' : ''}`;
        itemDiv.dataset.trackId = track.id;

        // カラーインジケータ
        const colorDiv = document.createElement('div');
        colorDiv.className = 'track-color-indicator';
        colorDiv.style.backgroundColor = track.color;

        // トラック名
        const nameDiv = document.createElement('div');
        nameDiv.className = 'track-name';
        nameDiv.textContent = track.name;

        // コントロールボタン群
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'track-controls';

        // Mute ボタン
        const muteBtn = document.createElement('button');
        muteBtn.className = `tc-btn ${track.isMuted ? 'muted' : ''}`;
        muteBtn.textContent = 'M';
        muteBtn.title = 'Mute';
        muteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // トラック選択イベントの発火を防ぐ
            track.isMuted = !track.isMuted;
            muteBtn.classList.toggle('muted', track.isMuted);
            renderAll();
        });

        // Solo ボタン
        const soloBtn = document.createElement('button');
        soloBtn.className = `tc-btn ${track.isSoloed ? 'soloed' : ''}`;
        soloBtn.textContent = 'S';
        soloBtn.title = 'Solo';
        soloBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            track.isSoloed = !track.isSoloed;
            soloBtn.classList.toggle('soloed', track.isSoloed);
            
            // Soloが押されたら、Mute状態は解除しておくのが一般的
            if (track.isSoloed && track.isMuted) {
                track.isMuted = false;
                muteBtn.classList.remove('muted');
            }
            renderAll();
        });

        // 音色設定(⚙) ボタン
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
        itemDiv.appendChild(nameDiv);
        itemDiv.appendChild(controlsDiv);

        // トラック自体をクリックした時（アクティブトラックの切り替え）
        itemDiv.addEventListener('click', () => {
            if (STATE.activeTrackId !== track.id) {
                clearSelection();
                STATE.activeTrackId = track.id;
                
                // UIのハイライトを更新
                document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
                itemDiv.classList.add('active');
                
                renderAll();
            }
        });

        trackList.appendChild(itemDiv);
    });
}

// --- 新規: 音色設定モーダルの制御 ---
function setupSynthModal() {
    const modal = document.getElementById('synth-modal');
    const closeBtn = document.getElementById('modal-close');
    
    // 各入力項目のイベントリスナー（値が変更されたら即座にトラックデータに反映）
    const inputs = ['waveform', 'attack', 'decay', 'sustain', 'release'];
    inputs.forEach(key => {
        document.getElementById(`synth-${key}`).addEventListener('input', (e) => {
            if (editingTrackId) {
                const track = STATE.tracks.find(t => t.id === editingTrackId);
                // waveformは文字列、それ以外は数値として保存
                track[key] = key === 'waveform' ? e.target.value : parseFloat(e.target.value);
            }
        });
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        editingTrackId = null;
    });
}

function openSynthModal(trackId) {
    const track = STATE.tracks.find(t => t.id === trackId);
    if (!track) return;
    
    editingTrackId = trackId;
    
    // モーダル内のUIに現在のトラック設定を反映
    document.getElementById('modal-track-name').textContent = `${track.name} Settings`;
    document.getElementById('synth-waveform').value = track.waveform;
    document.getElementById('synth-attack').value = track.attack;
    document.getElementById('synth-decay').value = track.decay;
    document.getElementById('synth-sustain').value = track.sustain;
    document.getElementById('synth-release').value = track.release;
    
    // 表示
    document.getElementById('synth-modal').classList.add('show');
}

export function setTool(toolName) {
    STATE.currentTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${toolName}`).classList.add('active');
    
    const gridCvs = document.getElementById('grid-canvas');
    if (toolName === 'draw') gridCvs.style.cursor = 'crosshair';
    else if (toolName === 'select') gridCvs.style.cursor = 'cell';
    else if (toolName === 'mute') gridCvs.style.cursor = 'not-allowed';
    else if (toolName === 'delete') gridCvs.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'red\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><line x1=\'18\' y1=\'6\' x2=\'6\' y2=\'18\'></line><line x1=\'6\' y1=\'6\' x2=\'18\' y2=\'18\'></line></svg>") 8 8, auto';
}