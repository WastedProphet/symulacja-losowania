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
    const cbShowFields = document.getElementById('cb-show-fields');

    const STORAGE_KEY = 'lottery_templates';
    const SESSION_KEY = 'lottery_last_session';

    const DEFAULT_SETTINGS = {
        ballCount: 100,
        holeCount: 100,
        ballsPerHole: 1,
        ballNames: "",
        zones: [],
        magnetEnabled: true,
        superRandom: false,
        showFields: false
    };

    window.ZONES = [];
    window.ALL_GUIDES_ON = false; 
    window.activeZonePopovers = {};

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
        
        cbMagnet.checked = data.magnetEnabled !== false; 
        cbSuperRandom.checked = data.superRandom === true;
        cbShowFields.checked = data.showFields === true;
    }

    function saveCurrentSession() {
        const currentData = {
            ballCount: parseInt(inputBallCount.value),
            holeCount: parseInt(inputHoleCount.value),
            ballsPerHole: parseInt(inputBallsPerHole.value),
            ballNames: inputBallNames.value,
            zones: window.ZONES,
            magnetEnabled: cbMagnet.checked,
            superRandom: cbSuperRandom.checked,
            showFields: cbShowFields.checked
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
            zones: window.ZONES,
            magnetEnabled: cbMagnet.checked,
            superRandom: cbSuperRandom.checked,
            showFields: cbShowFields.checked
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
	
	// --- IMPORT / EKSPORT KODÓW SZABLONÓW ---
    const btnGenerateCode = document.getElementById('btn-generate-code');
    const templateCodeOutput = document.getElementById('templateCodeOutput');
    const btnLoadCode = document.getElementById('btn-load-code');
    const templateCodeInput = document.getElementById('templateCodeInput');

    // Generowanie kodu dla obecnych ustawień
    btnGenerateCode.addEventListener('click', () => {
        const currentData = {
            ballCount: parseInt(inputBallCount.value),
            holeCount: parseInt(inputHoleCount.value),
            ballsPerHole: parseInt(inputBallsPerHole.value),
            ballNames: inputBallNames.value,
            zones: window.ZONES,
            magnetEnabled: cbMagnet.checked,
            superRandom: cbSuperRandom.checked,
            showFields: cbShowFields.checked
        };
        
        try {
            // Zamiana obiektu JSON na string, zabezpieczenie znaków specjalnych i kodowanie Base64
            const codeString = btoa(encodeURIComponent(JSON.stringify(currentData)));
            templateCodeOutput.value = codeString;
            
            // Opcjonalne automatyczne skopiowanie do schowka
            navigator.clipboard.writeText(codeString).then(() => {
                const originalText = btnGenerateCode.textContent;
                btnGenerateCode.textContent = 'Skopiowano kod do schowka!';
                setTimeout(() => { btnGenerateCode.textContent = originalText; }, 2000);
            });
        } catch(e) {
            alert('Wystąpił błąd podczas generowania kodu.');
        }
    });

    // Wczytywanie ustawień z kodu użytkownika
    btnLoadCode.addEventListener('click', () => {
        const codeString = templateCodeInput.value.trim();
        if (!codeString) {
            alert('Najpierw wklej kod szablonu do pola!');
            return;
        }
        
        try {
            // Odkodowanie z Base64 i zamiana tekstu z powrotem na obiekt JSON
            const decodedString = decodeURIComponent(atob(codeString));
            const data = JSON.parse(decodedString);
            
            // Zastosowanie wczytanych parametrów na panel (korzystamy z istniejącej funkcji)
            applySettings(data);
            
            // Zapis do sesji i zrestartowanie płótna by narysować nowe strefy/dołki
            saveCurrentSession();
            btnRestart.click(); 
            
            templateCodeInput.value = '';
            alert('Ustawienia z kodu zostały załadowane\nWpisz nazwę i kliknij "Zapisz jako szablon", jeśli chcesz zapisać je na swojej liście.');
        } catch(e) {
            alert('Nieprawidłowy kod szablonu! Upewnij się, że skopiowałeś go w całości.');
        }
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

    [inputBallCount, inputHoleCount, inputBallsPerHole, inputBallNames, cbMagnet, cbSuperRandom, cbShowFields].forEach(el => {
        el.addEventListener('change', saveCurrentSession);
    });

    [cbMagnet, cbSuperRandom, cbShowFields].forEach(el => {
        el.addEventListener('change', () => {
            window.MAGNET_ENABLED = cbMagnet.checked;
            window.SUPER_RANDOM_ENABLED = cbSuperRandom.checked;
            window.SHOW_MAGNET_FIELDS = cbShowFields.checked;
        });
    });

    window.openZonePopover = function(zone, screenX, screenY) {
        if (window.activeZonePopovers[zone.id]) return; 

        // Upewniamy się, że nowa strefa ma rejestr dostępu
        if (!zone.allowedBalls) zone.allowedBalls = [];

        const popover = document.createElement('div');
        popover.className = 'zone-editor-popover';
        
        popover.innerHTML = `
            <div class="ze-capacity-indicator" title="Ilość objętych dołków">
                <span class="ze-capacity-number">${Math.abs(zone.end - zone.start) + 1}</span>
                <span class="ze-capacity-icon"></span>
            </div>
            <div class="ze-close-btn" title="Zamknij">✖</div>
            <div class="popover-header">Edytuj strefę</div>
            <input type="text" class="ze-name" placeholder="Nazwa strefy" value="${zone.name}">
            <div class="ze-row">
                <input type="color" class="ze-color" title="Kolor strefy" value="${zone.color}">
                <input type="number" class="ze-start" min="1" max="${window.HOLE_COUNT}" title="Dołek początkowy" value="${zone.start}">
                <span> - </span>
                <input type="number" class="ze-end" min="1" max="${window.HOLE_COUNT}" title="Dołek końcowy" value="${zone.end}">
            </div>
            
            <div class="ze-access-btn" title="piłki z zaznaczoną nazwą będą mogły wpaść tylko do stref z dostępem">Dostęp... ▼</div>
            <div class="ze-access-list">
                <!-- Lista kuleczek generowana z JS -->
            </div>

            <div class="ze-actions">
                <button class="ze-save primary-btn">Zapisz / Zamknij</button>
                <button class="ze-delete danger-btn">Usuń</button>
            </div>
        `;

        const applyPopoverColor = (hex) => {
            let r = parseInt(hex.slice(1, 3), 16);
            let g = parseInt(hex.slice(3, 5), 16);
            let b = parseInt(hex.slice(5, 7), 16);
            
            let lightR = Math.round(r + (255 - r) * 0.4);
            let lightG = Math.round(g + (255 - g) * 0.4);
            let lightB = Math.round(b + (255 - b) * 0.4);

            let luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            let lumaFactor = luminance / 255; 
            
            let greenL = 50 - (lumaFactor * 15); 
            let greenBorderColor = `hsl(145, 60%, ${greenL}%)`;
            let greenBgColor = `hsla(145, 60%, ${greenL}%, 0.15)`;
            
            let redL = 75 - (lumaFactor * 25);
            let redColor = `hsl(0, 80%, ${redL}%)`;
            
            popover.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
            popover.style.borderColor = `rgba(${r}, ${g}, ${b}, 1)`;
            
            const header = popover.querySelector('.popover-header');
            if (header) {
                header.style.color = `rgb(${lightR}, ${lightG}, ${lightB})`;
            }

            const capacityIndicator = popover.querySelector('.ze-capacity-indicator');
            if (capacityIndicator) {
                capacityIndicator.style.color = `rgb(${lightR}, ${lightG}, ${lightB})`;
            }
            
            const inputs = popover.querySelectorAll('input:not([type="checkbox"])');
            inputs.forEach(input => {
                input.style.borderColor = `rgba(${r}, ${g}, ${b}, 1)`;
            });

            const accessBtn = popover.querySelector('.ze-access-btn');
            if (accessBtn) {
                accessBtn.style.borderColor = `rgba(${r}, ${g}, ${b}, 1)`;
                accessBtn.style.color = `rgb(${lightR}, ${lightG}, ${lightB})`;
            }

            const saveBtn = popover.querySelector('.ze-save');
            const deleteBtn = popover.querySelector('.ze-delete');
            
            if (saveBtn) {
                saveBtn.style.backgroundColor = greenBgColor;
                saveBtn.style.borderColor = greenBorderColor;
                saveBtn.style.color = greenBorderColor;
            }
            
            if (deleteBtn) {
                deleteBtn.style.borderColor = redColor;
                deleteBtn.style.color = redColor;
                deleteBtn.style.backgroundColor = 'transparent';
            }
        };
        
        applyPopoverColor(zone.color); 

        // Generowanie listy dostępu (checkboxy) na bazie nazw z głównego panelu
        const accessListContainer = popover.querySelector('.ze-access-list');
        const currentBallNames = inputBallNames.value.split('\n').map(n => n.trim()).filter(n => n);
        
        if (currentBallNames.length === 0) {
            accessListContainer.innerHTML = '<span style="color:#a0aab5; font-size:12px;">Brak nazwanych piłeczek w ustawieniach.</span>';
        } else {
            currentBallNames.forEach(ballName => {
                const label = document.createElement('label');
                const isChecked = zone.allowedBalls.includes(ballName) ? 'checked' : '';
                label.innerHTML = `<input type="checkbox" value="${ballName}" class="ze-access-checkbox" ${isChecked}> ${ballName}`;
                
                label.querySelector('input').addEventListener('change', (e) => {
                    if(e.target.checked) {
                        if (!zone.allowedBalls.includes(e.target.value)) zone.allowedBalls.push(e.target.value);
                    } else {
                        zone.allowedBalls = zone.allowedBalls.filter(n => n !== e.target.value);
                    }
                    saveCurrentSession();
                });
                accessListContainer.appendChild(label);
            });
        }

        const accessBtn = popover.querySelector('.ze-access-btn');
        accessBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            accessListContainer.classList.toggle('active');
        });

        document.getElementById('game-container').appendChild(popover);
        window.activeZonePopovers[zone.id] = popover;

        let startX = screenX - 130; 
        let startY = screenY - 180;
        let maxX = window.innerWidth - 350 - 260 - 15;
        let maxY = window.innerHeight - 200 - 15;
        startX = Math.max(15, Math.min(startX, maxX));
        startY = Math.max(15, Math.min(startY, maxY));
        
        popover.style.left = startX + 'px';
        popover.style.top = startY + 'px';

        const closeBtn = popover.querySelector('.ze-close-btn');
        const saveBtn = popover.querySelector('.ze-save');
        const deleteBtn = popover.querySelector('.ze-delete');
        const inputs = popover.querySelectorAll('input:not([type="checkbox"])');

        const closePopover = () => {
            popover.remove();
            delete window.activeZonePopovers[zone.id];
        };

        closeBtn.addEventListener('click', closePopover);
        saveBtn.addEventListener('click', closePopover);

        deleteBtn.addEventListener('click', () => {
            window.ZONES = window.ZONES.filter(z => z.id !== zone.id);
            closePopover();
            saveCurrentSession();
            if(window.drawPhaserZones) window.drawPhaserZones();
        });

        const updateZone = () => {
            zone.name = popover.querySelector('.ze-name').value;
            zone.color = popover.querySelector('.ze-color').value;
            
            applyPopoverColor(zone.color);
            
            let startInput = popover.querySelector('.ze-start');
            let endInput = popover.querySelector('.ze-end');
            
            if (startInput.value === '' || endInput.value === '') return;

            let s = parseInt(startInput.value) || 1;
            let e = parseInt(endInput.value) || 1;
            
            if (s > window.HOLE_COUNT) s = window.HOLE_COUNT;
            if (e > window.HOLE_COUNT) e = window.HOLE_COUNT;
            
            let desiredStart = Math.min(s, e);
            let desiredEnd = Math.max(s, e);

            let rowZones = window.ZONES.filter(z => z.row === zone.row && z.id !== zone.id);

            let leftZones = rowZones.filter(z => z.end < zone.start);
            let rightZones = rowZones.filter(z => z.start > zone.end);

            let leftBound = 1;
            if (leftZones.length > 0) {
                leftBound = Math.max(...leftZones.map(z => z.end)) + 1;
            }

            let rightBound = window.HOLE_COUNT;
            if (rightZones.length > 0) {
                rightBound = Math.min(...rightZones.map(z => z.start)) - 1;
            }

            zone.start = Math.max(leftBound, Math.min(desiredStart, rightBound));
            zone.end = Math.max(leftBound, Math.min(desiredEnd, rightBound));

            if (s !== zone.start || e !== zone.end) {
                startInput.value = zone.start;
                endInput.value = zone.end;
            }

            popover.querySelector('.ze-capacity-number').textContent = (zone.end - zone.start) + 1;

            saveCurrentSession();
            if(window.drawPhaserZones) window.drawPhaserZones();
        };

        inputs.forEach(input => {
            input.addEventListener('input', updateZone);
            input.addEventListener('mousedown', e => e.stopPropagation());
        });
        
        [saveBtn, deleteBtn, closeBtn, accessListContainer].forEach(btn => btn.addEventListener('mousedown', e => e.stopPropagation()));

        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        const onMouseMove = (e) => {
            if (!isDragging) return;
            let newX = e.clientX - dragOffsetX;
            let newY = e.clientY - dragOffsetY;
            
            let mx = window.innerWidth - 350 - popover.offsetWidth - 15;
            let my = window.innerHeight - popover.offsetHeight - 15;
            
            newX = Math.max(15, Math.min(newX, mx));
            newY = Math.max(15, Math.min(newY, my));
            
            popover.style.left = newX + 'px';
            popover.style.top = newY + 'px';
        };

        const onMouseUp = () => {
            isDragging = false;
            popover.style.zIndex = 1000;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        popover.addEventListener('mousedown', (e) => {
            if(['input', 'button', 'span', 'label'].includes(e.target.tagName.toLowerCase()) || e.target.classList.contains('ze-access-btn')) return;
            
            isDragging = true;
            dragOffsetX = e.clientX - popover.getBoundingClientRect().left;
            dragOffsetY = e.clientY - popover.getBoundingClientRect().top;
            popover.style.zIndex = 1001; 
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        popover.addEventListener('pointerdown', e => e.stopPropagation());
        popover.addEventListener('wheel', e => e.stopPropagation());
    };

    btnRestart.addEventListener('click', () => {
        if (window.activeZonePopovers) {
            for (let id in window.activeZonePopovers) {
                window.activeZonePopovers[id].remove();
            }
        }
        window.activeZonePopovers = {};

        saveCurrentSession(); 

        window.BALL_COUNT = parseInt(inputBallCount.value);
        window.HOLE_COUNT = parseInt(inputHoleCount.value);
        window.BALLS_PER_HOLE = parseInt(inputBallsPerHole.value);
        window.BALL_NAMES = inputBallNames.value.split('\n').map(n => n.trim()).filter(n => n);
        
        window.MAGNET_ENABLED = cbMagnet.checked;
        window.SUPER_RANDOM_ENABLED = cbSuperRandom.checked;
        window.SHOW_MAGNET_FIELDS = cbShowFields.checked;

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

            if (activeNamesArray.length === 0) {
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
