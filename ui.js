document.addEventListener('DOMContentLoaded', () => {
    const inputBallCount = document.getElementById('ballCount');
    const inputHoleCount = document.getElementById('holeCount');
    const inputBallsPerHole = document.getElementById('ballsPerHole');
    const inputBallNames = document.getElementById('ballNames');
    
    const btnRestart = document.getElementById('btn-restart');
    const btnCopyResults = document.getElementById('btn-copy-results');
    
    const selectTemplate = document.getElementById('templateSelect');
    const inputTemplateName = document.getElementById('templateName');
    const btnSaveTemplate = document.getElementById('btn-save-template');
    const btnDeleteTemplate = document.getElementById('btn-delete-template');
    
    const resultsList = document.getElementById('results-list');
    const namesOverlay = document.getElementById('names-overlay');
    const cbShowAll = document.getElementById('cb-show-all');
    const cbMagnet = document.getElementById('cb-magnet');
    const cbSuperRandom = document.getElementById('cb-super-random');
    
    const popover = document.getElementById('zone-editor-popover');
    const zeName = document.getElementById('ze-name');
    const zeColor = document.getElementById('ze-color');
    const zeStart = document.getElementById('ze-start');
    const zeEnd = document.getElementById('ze-end');
    const btnZeSave = document.getElementById('ze-save');
    const btnZeDelete = document.getElementById('ze-delete');

    const STORAGE_KEY = 'lottery_templates';
    const SESSION_KEY = 'lottery_last_session';

    const DEFAULT_SETTINGS = {
        ballCount: 100,
        holeCount: 100,
        ballsPerHole: 1,
        ballNames: "",
        zones: []
    };

    window.ZONES = [];
    window.ALL_GUIDES_ON = false; 
    let currentEditingZone = null;

    function loadTemplates() {
        const templatesRaw = localStorage.getItem(STORAGE_KEY);
        let templates = {};
        if (templatesRaw) {
            try { templates = JSON.parse(templatesRaw); } catch (e) {}
        }
        if (!templates['DOMYŚLNE']) {
            templates['DOMYŚLNE'] = DEFAULT_SETTINGS;
        }
        return templates;
    }

    function saveTemplatesToStorage(templates) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }

    function updateTemplateDropdown() {
        const templates = loadTemplates();
        selectTemplate.innerHTML = '<option value="">-- Wybierz --</option>';
        for (const name of Object.keys(templates)) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            selectTemplate.appendChild(option);
        }
    }

    function applySettings(data) {
        inputBallCount.value = data.ballCount || 100;
        inputHoleCount.value = data.holeCount || data.ballCount || 100;
        inputBallsPerHole.value = data.ballsPerHole || 1;
        inputBallNames.value = data.ballNames || '';
        window.ZONES = data.zones ? JSON.parse(JSON.stringify(data.zones)) : [];
    }

    function saveCurrentSession() {
        const currentData = {
            ballCount: parseInt(inputBallCount.value),
            holeCount: parseInt(inputHoleCount.value),
            ballsPerHole: parseInt(inputBallsPerHole.value),
            ballNames: inputBallNames.value,
            zones: window.ZONES
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(currentData));
    }
    
    window.saveCurrentSession = saveCurrentSession;

    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
        try { applySettings(JSON.parse(savedSession)); } catch (e) { applySettings(DEFAULT_SETTINGS); }
    } else {
        applySettings(DEFAULT_SETTINGS);
    }
    updateTemplateDropdown();

    btnSaveTemplate.addEventListener('click', () => {
        const name = inputTemplateName.value.trim();
        if (!name) return alert('Podaj nazwę szablonu!');
        const templates = loadTemplates();
        templates[name] = {
            ballCount: parseInt(inputBallCount.value),
            holeCount: parseInt(inputHoleCount.value),
            ballsPerHole: parseInt(inputBallsPerHole.value),
            ballNames: inputBallNames.value,
            zones: window.ZONES
        };
        saveTemplatesToStorage(templates);
        updateTemplateDropdown();
        inputTemplateName.value = '';
        selectTemplate.value = name;
    });

    selectTemplate.addEventListener('change', (e) => {
        const selectedName = e.target.value;
        if (!selectedName) return;
        const templates = loadTemplates();
        if (templates[selectedName]) applySettings(templates[selectedName]);
        saveCurrentSession();
        btnRestart.click(); 
    });

    btnDeleteTemplate.addEventListener('click', () => {
        const selectedName = selectTemplate.value;
        if (!selectedName || selectedName === 'DOMYŚLNE') return alert('Wybierz utworzony szablon do usunięcia.');
        const templates = loadTemplates();
        delete templates[selectedName];
        saveTemplatesToStorage(templates);
        updateTemplateDropdown();
    });

    function updateVisibility() {
        const showAll = cbShowAll.checked;
        for (let i = 0; i < window.HOLE_COUNT; i++) {
            const slot = document.getElementById('result-hole-' + i);
            if (!slot) continue;
            
            const isFilled = slot.classList.contains('filled');
            const namesArray = JSON.parse(slot.dataset.names || '[]');
            const hasName = namesArray.length > 0;

            if (showAll) {
                slot.style.display = 'flex';
            } else {
                slot.style.display = (isFilled && hasName) ? 'flex' : 'none';
            }
        }
    }

    cbShowAll.addEventListener('change', updateVisibility);

    [inputBallCount, inputHoleCount, inputBallsPerHole, inputBallNames].forEach(el => {
        el.addEventListener('change', saveCurrentSession);
    });

    window.openZonePopover = function(zone, screenX, screenY) {
        currentEditingZone = zone;
        popover.classList.remove('hidden');
        
        popover.style.left = screenX + 'px';
        popover.style.top = screenY + 'px'; 

        zeName.value = zone.name;
        zeColor.value = zone.color;
        zeStart.value = zone.start;
        zeEnd.value = zone.end;
        
        zeStart.max = window.HOLE_COUNT;
        zeEnd.max = window.HOLE_COUNT;
    };

    window.closeZonePopover = function() {
        popover.classList.add('hidden');
        currentEditingZone = null;
    };

    btnZeSave.addEventListener('click', window.closeZonePopover);
    popover.addEventListener('pointerdown', (e) => e.stopPropagation());

    btnZeDelete.addEventListener('click', () => {
        if(!currentEditingZone) return;
        window.ZONES = window.ZONES.filter(z => z.id !== currentEditingZone.id);
        window.closeZonePopover();
        saveCurrentSession();
        if(window.drawPhaserZones) window.drawPhaserZones();
    });

    [zeName, zeColor, zeStart, zeEnd].forEach(input => {
        input.addEventListener('input', () => {
            if(!currentEditingZone) return;
            currentEditingZone.name = zeName.value;
            currentEditingZone.color = zeColor.value;
            
            let s = parseInt(zeStart.value) || 1;
            let e = parseInt(zeEnd.value) || 1;
            
            if (s > window.HOLE_COUNT) s = window.HOLE_COUNT;
            if (e > window.HOLE_COUNT) e = window.HOLE_COUNT;
            
            currentEditingZone.start = Math.min(s, e);
            currentEditingZone.end = Math.max(s, e);

            saveCurrentSession();
            if(window.drawPhaserZones) window.drawPhaserZones();
        });
    });

    btnRestart.addEventListener('click', () => {
        window.closeZonePopover();
        saveCurrentSession(); 

        window.BALL_COUNT = parseInt(inputBallCount.value);
        window.HOLE_COUNT = parseInt(inputHoleCount.value);
        window.BALLS_PER_HOLE = parseInt(inputBallsPerHole.value);
        window.BALL_NAMES = inputBallNames.value.split('\n').map(n => n.trim()).filter(n => n);

        resultsList.innerHTML = '';
        for(let i = 0; i < window.HOLE_COUNT; i++) {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.id = 'result-hole-' + i;
            div.dataset.names = '[]'; 
            div.style.display = cbShowAll.checked ? 'flex' : 'none'; 
            div.innerHTML = `<span class="hole-num">${i + 1}</span> <span class="ball-name"></span>`;
            resultsList.appendChild(div);
        }

        namesOverlay.innerHTML = '';

        if (window.BALL_NAMES.length > 0) {
            const globalToggle = document.createElement('div');
            globalToggle.className = 'overlay-name global-eye';
            globalToggle.style.order = 0;
            globalToggle.innerHTML = `
                <span class="name-label">Wyświetl prowadnice</span> 
                <span class="eye-icon" id="global-eye-icon">👁️∞</span>
            `;
            
            if (window.ALL_GUIDES_ON) {
                globalToggle.querySelector('.eye-icon').classList.add('active');
            }

            globalToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                window.ALL_GUIDES_ON = !window.ALL_GUIDES_ON;
                
                if (window.toggleAllGuides) window.toggleAllGuides(window.ALL_GUIDES_ON);
                
                if (window.ALL_GUIDES_ON) {
                    globalToggle.querySelector('.eye-icon').classList.add('active');
                    document.querySelectorAll('.single-eye').forEach(eye => eye.classList.add('active'));
                } else {
                    globalToggle.querySelector('.eye-icon').classList.remove('active');
                    document.querySelectorAll('.single-eye').forEach(eye => eye.classList.remove('active'));
                }
            });
            namesOverlay.appendChild(globalToggle);
        }

        window.BALL_NAMES.forEach((name, idx) => {
            if (!name) return;
            const el = document.createElement('div');
            el.className = 'overlay-name';
            el.dataset.originalName = name;
            el.style.order = 9999 + idx; 
            
            el.innerHTML = `
                <span class="name-label">${name}</span> 
                <span class="pos-tag"></span>
                <span class="eye-icon single-eye" data-name="${name}">👁️</span>
            `;
            
            if (window.ALL_GUIDES_ON) {
                el.querySelector('.eye-icon').classList.add('active');
            }

            el.querySelector('.name-label').addEventListener('click', (e) => {
                e.stopPropagation(); 
                if (window.toggleHighlight) window.toggleHighlight(name);
            });

            el.querySelector('.eye-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                let eye = e.target;
                let isActive = eye.classList.toggle('active');
                if (window.toggleGuide) window.toggleGuide(name, isActive);
            });

            namesOverlay.appendChild(el);
        });

        if (typeof window.restartSimulation === 'function') {
            window.restartSimulation();
        }
    });

    window.reportResult = function(holeIndex, ballName) {
        const slot = document.getElementById('result-hole-' + holeIndex);
        if(slot) {
            slot.classList.add('filled');
            let namesArray = JSON.parse(slot.dataset.names || '[]');
            
            if (ballName && ballName !== '') {
                namesArray.push(ballName);
                slot.dataset.names = JSON.stringify(namesArray);
                
                const overlayItems = document.querySelectorAll('.overlay-name');
                overlayItems.forEach(el => {
                    if (el.dataset.originalName === ballName) {
                        el.querySelector('.pos-tag').textContent = `[#${holeIndex + 1}]`;
                        el.style.order = holeIndex + 1; 
                    }
                });
            }

            if (namesArray.length > 0) {
                slot.querySelector('.ball-name').textContent = namesArray.join(', ');
            } else {
                slot.querySelector('.ball-name').textContent = '---'; 
            }
            updateVisibility();
        }
    };

    window.updateHighlightUI = function(activeNamesArray) {
        document.querySelectorAll('.overlay-name').forEach(el => {
            if (el.classList.contains('global-eye')) return; 

            if (!activeNamesArray || activeNamesArray.length === 0) {
                el.style.opacity = '1';
                el.style.color = '#ffffff';
            } else if (activeNamesArray.includes(el.dataset.originalName)) {
                el.style.opacity = '1';
                el.style.color = '#99FFFF';
            } else {
                el.style.opacity = '0.4';
                el.style.color = '#ffffff';
            }
        });
    };

    btnCopyResults.addEventListener('click', () => {
        let resultsToCopy = [];
        for (let i = 0; i < window.HOLE_COUNT; i++) {
            const slot = document.getElementById('result-hole-' + i);
            if (slot && slot.classList.contains('filled')) {
                const namesArray = JSON.parse(slot.dataset.names || '[]');
                if (namesArray.length > 0) {
                    resultsToCopy.push(...namesArray);
                }
            }
        }
        
        if (resultsToCopy.length === 0) return alert('Brak nazwanych wyników do skopiowania.');

        navigator.clipboard.writeText(resultsToCopy.join('\n')).then(() => {
            const originalText = btnCopyResults.textContent;
            btnCopyResults.textContent = 'Skopiowano!';
            setTimeout(() => { btnCopyResults.textContent = originalText; }, 2000);
        });
    });

    setTimeout(() => { document.getElementById('btn-restart').click(); }, 100);
});
