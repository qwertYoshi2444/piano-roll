import { STATE } from './state.js';
import { initRenderer, renderAll } from './renderer.js';
import { initEvents } from './events.js';

// DOM読み込み完了時に初期化を行う
document.addEventListener('DOMContentLoaded', () => {
    const gridCvs = document.getElementById('grid-canvas');
    const keyCvs = document.getElementById('keyboard-canvas');
    const timeCvs = document.getElementById('timeline-canvas');

    // モジュールの初期化
    initRenderer(gridCvs, keyCvs, timeCvs);
    initEvents(gridCvs);

    // リサイズ処理のバインド
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // 初回リサイズ＆描画

    // ツールバーUIのバインド
    setupToolbar();
    setTool('draw'); // デフォルトツール
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
    // スナップ設定
    document.getElementById('snap-select').addEventListener('change', e => {
        STATE.snap = parseInt(e.target.value, 10);
    });

    // ツールボタンのクリックイベント
    const tools = ['draw', 'select', 'mute', 'delete'];
    tools.forEach(tool => {
        const btn = document.getElementById(`btn-${tool}`);
        btn.addEventListener('click', () => setTool(tool));
    });
}

// ツールの切り替えとUI反映を行う公開関数
export function setTool(toolName) {
    STATE.currentTool = toolName;
    
    // ボタンのハイライト状態を更新
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${toolName}`).classList.add('active');
    
    // ツールに応じたデフォルトカーソルを設定
    const gridCvs = document.getElementById('grid-canvas');
    if (toolName === 'draw') gridCvs.style.cursor = 'crosshair';
    else if (toolName === 'select') gridCvs.style.cursor = 'cell';
    else if (toolName === 'mute') gridCvs.style.cursor = 'not-allowed';
    else if (toolName === 'delete') gridCvs.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'red\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><line x1=\'18\' y1=\'6\' x2=\'6\' y2=\'18\'></line><line x1=\'6\' y1=\'6\' x2=\'18\' y2=\'18\'></line></svg>") 8 8, auto'; // 簡易的な消しゴムカーソル
}