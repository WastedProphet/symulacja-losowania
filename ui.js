document.addEventListener('DOMContentLoaded', () => {
    const btnRestart = document.getElementById('btn-restart');
    const btnSaveTemplate = document.getElementById('btn-save-template');
    const btnDeleteTemplate = document.getElementById('btn-delete-template');
    const btnCopyResults = document.getElementById('btn-copy-results');
    const templateSelect = document.getElementById('templateSelect');
    const cbShowAll = document.getElementById('cb-show-all');

    let resultsData = [];

    loadTemplates();

    btnRestart.addEventListener('click', () => {
        window.BALL_COUNT = parseInt(document.getElementById('ballCount').value) || 4;
        window.HOLE_COUNT = parseInt(document.getElementById('holeCount').value) || 4;
        window.BALLS_PER_HOLE = parseInt(document.getElementById('ballsPerHole').value) || 1;
        
        const namesText = document.getElementById('ballNames').value.trim();
        window.ballNamesArray = namesText ? namesText.split('\n').map(n => n.trim()) : [];
        
        resultsData = [];
        renderResults();
        
        if (window.restartSimulation) {
            window.restartSimulation();
        }
    });

    window.reportResult = function(ballIndex, ballName, color, holeNum) {
        resultsData.push({ ballIndex, ballName, color, holeNum });
        resultsData.sort((a, b) => a.holeNum - b.holeNum);
        renderResults();
    };

    function renderResults() {
        const list = document.getElementById('results-list');
        list.innerHTML = '';
        
        const showAll = cbShowAll.checked;
        
        for (let i = 1; i <= window.HOLE_COUNT; i++) {
            const found = resultsData.find(r => r.holeNum === i);
            
            if (found) {
                if (!showAll && !found.ballName) continue;
                
                const div = document.createElement('div');
                div.className = 'result-item filled';
                div.innerHTML = `<span class="hole-num">Dołek #${i}</span> <span class="ball-name" style="color: ${found.color}">${found.ballName || '---'}</span>`;
                list.appendChild(div);
            } else if (showAll) {
                const div = document.createElement('div');
                div.className = 'result-item';
                div.innerHTML = `<span class="hole-num">Dołek #${i}</span> <span class="ball-name" style="color: #666">Pusty</span>`;
                list.appendChild(div);
            }
        }
    }

    cbShowAll.addEventListener('change', renderResults);

    btnCopyResults.addEventListener('click', () => {
        const lines = resultsData
            .filter(r => r.ballName)
            .sort((a, b) => a.holeNum - b.holeNum)
            .map(r => r.ballName);
            
        if (lines.length > 0) {
            navigator.clipboard.writeText(lines.join(' ')).then(() => {
                alert('Skopiowano wyniki do schowka!');
            });
        } else {
            alert('Brak nazwanych piłeczek do skopiowania.');
        }
    });

    function getTemplates() {
        const data = localStorage.getItem('simTemplates');
        return data ? JSON.parse(data) : {};
    }

    function saveTemplates(templates) {
        localStorage.setItem('simTemplates', JSON.stringify(templates));
    }

    function loadTemplates() {
        const templates = getTemplates();
        templateSelect.innerHTML = '<option value="">-- Wybierz --</option>';
        for (let name in templates) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            templateSelect.appendChild(opt);
        }
    }

    btnSaveTemplate.addEventListener('click', () => {
        const name = document.getElementById('templateName').value.trim();
        if (!name) return alert('Podaj nazwę szablonu.');
        
        const templates = getTemplates();
        templates[name] = {
            ballCount: document.getElementById('ballCount').value,
            holeCount: document.getElementById('holeCount').value,
            ballsPerHole: document.getElementById('ballsPerHole').value,
            ballNames: document.getElementById('ballNames').value
        };
        
        saveTemplates(templates);
        loadTemplates();
        templateSelect.value = name;
        document.getElementById('templateName').value = '';
    });

    btnDeleteTemplate.addEventListener('click', () => {
        const name = templateSelect.value;
        if (!name) return;
        
        const templates = getTemplates();
        delete templates[name];
        saveTemplates(templates);
        loadTemplates();
    });

    templateSelect.addEventListener('change', () => {
        const name = templateSelect.value;
        if (!name) return;
        
        const templates = getTemplates();
        const tpl = templates[name];
        if (tpl) {
            document.getElementById('ballCount').value = tpl.ballCount;
            document.getElementById('holeCount').value = tpl.holeCount;
            document.getElementById('ballsPerHole').value = tpl.ballsPerHole;
            document.getElementById('ballNames').value = tpl.ballNames;
        }
    });
});
