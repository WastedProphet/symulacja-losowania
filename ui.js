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
    
    const STORAGE_KEY = 'lottery_templates';

    function loadTemplates() {
        const templatesRaw = localStorage.getItem(STORAGE_KEY);
        let templates = {};
        if (templatesRaw) {
            try { templates = JSON.parse(templatesRaw); } catch (e) {}
        }
        return templates;
    }

    function saveTemplatesToStorage(templates) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }

    function updateTemplateDropdown() {
        const templates = loadTemplates();
        selectTemplate.innerHTML = '<option value="">-- Wybierz --</option>';
        for (const [name, data] of Object.entries(templates)) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            selectTemplate.appendChild(option);
        }
    }

    btnSaveTemplate.addEventListener('click', () => {
        const name = inputTemplateName.value.trim();
        if (!name) return alert('Podaj nazwę szablonu!');

        const templates = loadTemplates();
        templates[name] = {
            ballCount: parseInt(inputBallCount.value),
            holeCount: parseInt(inputHoleCount.value),
            ballsPerHole: parseInt(inputBallsPerHole.value),
            ballNames: inputBallNames.value
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
        const data = templates[selectedName];
        if (data) {
            inputBallCount.value = data.ballCount;
            inputHoleCount.value = data.holeCount || data.ballCount;
            inputBallsPerHole.value = data.ballsPerHole;
            inputBallNames.value = data.ballNames || '';
        }
    });

    btnDeleteTemplate.addEventListener('click', () => {
        const selectedName = selectTemplate.value;
        if (!selectedName) return alert('Wybierz szablon do usunięcia.');
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

    btnRestart.addEventListener('click', () => {
        window.BALL_COUNT = parseInt(inputBallCount.value);
        window.HOLE_COUNT = parseInt(inputHoleCount.value);
        window.BALLS_PER_HOLE = parseInt(inputBallsPerHole.value);
        
        window.BALL_NAMES = inputBallNames.value.split('\n').map(n => n.trim()).filter(n => n);

        // Generowanie dołków HTML
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

        // Generowanie interaktywnej nakładki na grę (prawy górny róg)
        namesOverlay.innerHTML = '';
        window.BALL_NAMES.forEach(name => {
            if (!name) return;
            const el = document.createElement('div');
            el.className = 'overlay-name';
            el.textContent = name;
            el.addEventListener('click', (e) => {
                e.stopPropagation(); 
                if (window.toggleHighlight) window.toggleHighlight(name);
            });
            namesOverlay.appendChild(el);
        });

        if (typeof window.restartSimulation === 'function') {
            window.restartSimulation();
        }
    });

    // Odbieranie sygnałów o wpadnięciu z game.js
    window.reportResult = function(holeIndex, ballName) {
        const slot = document.getElementById('result-hole-' + holeIndex);
        if(slot) {
            slot.classList.add('filled');
            let namesArray = JSON.parse(slot.dataset.names || '[]');
            
            if (ballName && ballName !== '') {
                namesArray.push(ballName);
                slot.dataset.names = JSON.stringify(namesArray);
            }

            if (namesArray.length > 0) {
                slot.querySelector('.ball-name').textContent = namesArray.join(', ');
            } else {
                slot.querySelector('.ball-name').textContent = '---'; 
            }
            
            updateVisibility();
        }
    };

    window.updateHighlightUI = function(activeName) {
        document.querySelectorAll('.overlay-name').forEach(el => {
            if (activeName === null) {
                el.style.opacity = '1';
                el.style.color = '#ffffff';
            } else if (el.textContent === activeName) {
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
        
        if (resultsToCopy.length === 0) {
            alert('Brak nazwanych wyników do skopiowania.');
            return;
        }

        navigator.clipboard.writeText(resultsToCopy.join('\n')).then(() => {
            const originalText = btnCopyResults.textContent;
            btnCopyResults.textContent = 'Skopiowano!';
            setTimeout(() => {
                btnCopyResults.textContent = originalText;
            }, 2000);
        });
    });

    updateTemplateDropdown();
});
