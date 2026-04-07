import { STATE, clearSelection } from './state.js';
import { initRenderer, renderAll } from './renderer.js';
import { initEvents } from './events.js';

document.addEventListener('DOMContentLoaded', () => {
    const gridCvs = document.getElementById('grid-canvas');
    const keyCvs = document.getElementById('keyboard-canvas');
    const timeCvs = document.getElementById('timeline-canvas');

    initRenderer(gridCvs, keyCvs, timeCvs);
    initEvents(gridCvs);

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    setupToolbar();
    setTool('draw');
});

function resizeCanvas() {
    const editorArea = document.getElementById('editor-area');
    const rect = editorArea.getBoundingClientRect();
    
    const gridCvs = document.getElementById('grid-canvas');
    const keyCvs = document.getElementById('keyboard-canvas');
    const timeCvs = document.getElementById('timeline-canvas');

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
    // --- トラック選択プルダウンの動的生成 ---
    const trackSelect = document.getElementById('track-select');
    STATE.tracks.forEach(track => {
        const option = document.createElement('option');
        option.value = track.id;
        // トラック名に色を示す絵文字などを添えることも可能
        option.textContent = track.name; 
        trackSelect.appendChild(option);
    });

    // トラック切り替えイベント
    trackSelect.addEventListener('change', e => {
        clearSelection(); 
        STATE.activeTrackId = parseInt(e.target.value, 10);
        
        // プルダウン自体の文字色を、選択中トラックの色に合わせる（視覚的フィードバック）
        const activeTrack = STATE.tracks.find(t => t.id === STATE.activeTrackId);
        trackSelect.style.color = activeTrack.color;
        
        renderAll();
    });
    
    // 初期状態の色を設定
    trackSelect.style.color = STATE.tracks[0].color;

    // --- スナップ設定 ---
    document.getElementById('snap-select').addEventListener('change', e => {
        STATE.snap = parseInt(e.target.value, 10);
    });

    // --- ツールボタン ---
    const tools = ['draw', 'select', 'mute', 'delete'];
    tools.forEach(tool => {
        const btn = document.getElementById(`btn-${tool}`);
        btn.addEventListener('click', () => setTool(tool));
    });
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