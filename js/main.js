import { STATE, clearSelection, addTrack, TRACK_COLORS_PALETTE } from './state.js';
import { initRenderer, renderAll } from './renderer.js';
import { initEvents } from './events.js';

let editingTrackId = null; 
let editingColorTrackId = null;

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
    setupSynthModal();
    setupColorPickerModal();
    setTool('draw');
});

function resizeCanvas() {
    const rollArea = document.getElementById('roll-area');
    const rect = rollArea.getBoundingClientRect();
    
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
    
    // グローバルトランスポーズのイベント設定
    const transposeInput = document.getElementById('transpose-input');
    if (transposeInput) {
        transposeInput.addEventListener('change', e => {
            let val = parseInt(e.target.value, 10);
            if (isNaN(val)) val = 0;
            if (val < -24) val = -24;
            if (val > 24) val = 24;
            e.target.value = val;
            STATE.globalTranspose = val;
        });
    }

    const tools =['draw', 'select', 'mute', 'delete'];
    tools.forEach(tool => {
        const btn = document.getElementById(`btn-${tool}`);
        btn.addEventListener('click', () => setTool(tool));
    });
}

function setupTrackPanel() {
    const trackList = document.getElementById('track-list');
    trackList.innerHTML = ''; 

    STATE.tracks.forEach(track => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `track-item ${track.id === STATE.activeTrackId ? 'active' : ''}`;
        itemDiv.dataset.trackId = track.id;

        const colorDiv = document.createElement('div');
        colorDiv.className = 'track-color-indicator';
        colorDiv.style.backgroundColor = track.color;
        colorDiv.title = "Click to change color";
        colorDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            editingColorTrackId = track.id;
            document.getElementById('color-picker-modal').classList.add('show');
        });

        const nameDiv = document.createElement('div');
        nameDiv.className = 'track-name';
        nameDiv.textContent = track.name;
        nameDiv.title = "Double-click to rename";
        nameDiv.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const newName = prompt("Enter new track name:", track.name);
            if (newName && newName.trim() !== '') {
                track.name = newName.trim();
                nameDiv.textContent = track.name;
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

        const topRow = document.createElement('div');
        topRow.className = 'track-item-top';
        topRow.appendChild(colorDiv);
        topRow.appendChild(nameDiv);
        topRow.appendChild(controlsDiv);

        // 音量スライダの組み立て
        const volContainer = document.createElement('div');
        volContainer.className = 'track-vol-container';
        const volLabel = document.createElement('label');
        volLabel.textContent = 'Vol';
        const volSlider = document.createElement('input');
        volSlider.type = 'range';
        volSlider.className = 'track-vol';
        volSlider.min = '0';
        volSlider.max = '150';
        volSlider.value = Math.round((track.volume !== undefined ? track.volume : 1.0) * 100);
        volSlider.title = `Volume: ${volSlider.value}%`;
        
        volSlider.addEventListener('input', (e) => {
            let val = parseInt(e.target.value, 10);
            // 95〜105 の範囲で 100 にスナップさせる
            if (val >= 95 && val <= 105) {
                val = 100;
                e.target.value = val;
            }
            track.volume = val / 100;
            volSlider.title = `Volume: ${val}%`;
        });
        // スライダ操作時に行選択をトリガーしないようにする
        volSlider.addEventListener('mousedown', e => e.stopPropagation());
        volSlider.addEventListener('touchstart', e => e.stopPropagation(), {passive: true});

        volContainer.appendChild(volLabel);
        volContainer.appendChild(volSlider);

        itemDiv.appendChild(topRow);
        itemDiv.appendChild(volContainer);

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

    // 「+ Add Track」ボタン
    const addBtn = document.createElement('div');
    addBtn.id = 'btn-add-track';
    addBtn.textContent = '+ Add Track';
    addBtn.addEventListener('click', () => {
        addTrack();
        setupTrackPanel();
    });
    trackList.appendChild(addBtn);
}

function setupSynthModal() {
    const modal = document.getElementById('synth-modal');
    const closeBtn = document.getElementById('modal-close');
    
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

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        editingTrackId = null;
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
    
    document.getElementById('synth-modal').classList.add('show');
}

function setupColorPickerModal() {
    const modal = document.getElementById('color-picker-modal');
    const closeBtn = document.getElementById('color-modal-close');
    const grid = document.getElementById('color-grid');
    
    TRACK_COLORS_PALETTE.forEach(colorObj => {
        const cell = document.createElement('div');
        cell.className = 'color-cell';
        cell.style.backgroundColor = colorObj.fill;
        cell.addEventListener('click', () => {
            if (editingColorTrackId) {
                const track = STATE.tracks.find(t => t.id === editingColorTrackId);
                if (track) {
                    track.color = colorObj.fill;
                    track.borderColor = colorObj.border;
                    setupTrackPanel(); 
                    renderAll(); 
                }
            }
            modal.classList.remove('show');
            editingColorTrackId = null;
        });
        grid.appendChild(cell);
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        editingColorTrackId = null;
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