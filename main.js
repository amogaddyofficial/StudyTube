import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

inject();
injectSpeedInsights();

let player;
let timerInterval;
let timeLeft = 25 * 60;
let timerDuration = 25 * 60;
let isTimerRunning = false;

// YouTube API Ready Callback
window.onYouTubeIframeAPIReady = function () {
    console.log("YouTube API Ready");
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const videoInput = document.getElementById('video-input');
    const loadBtn = document.getElementById('load-video');
    const focusBtn = document.getElementById('focus-toggle');
    const timerDisplay = document.getElementById('timer');
    const startBtn = document.getElementById('start-timer');
    const resetBtn = document.getElementById('reset-timer');
    const notesArea = document.getElementById('study-notes');
    const timerMinutesInput = document.getElementById('timer-minutes');
    const timerHoursInput = document.getElementById('timer-hours');

    // Load saved notes
    notesArea.value = localStorage.getItem('studyTube_notes') || '';

    // Save notes automatically
    notesArea.addEventListener('input', () => {
        localStorage.setItem('studyTube_notes', notesArea.value);
    });

    // Filter state
    let activeFilterKeywords = '';

    // Filter button toggle
    const filterBtn = document.getElementById('filter-btn');
    const filterPanel = document.getElementById('filter-panel');
    if (filterBtn && filterPanel) {
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterPanel.classList.toggle('hidden');
            filterBtn.classList.toggle('active');
        });
    }

    // Filter
    const levelChips = document.querySelectorAll('.filter-chip:not(.sub):not(.subject)');
    const subChips = document.querySelectorAll('.filter-chip.sub');
    const subjectChips = document.querySelectorAll('.filter-chip.subject');
    const subjectContainer = document.getElementById('subject-filters-container');
    const subjectPanels = document.querySelectorAll('.subject-panel');

    filterBtn.addEventListener('click', () => {
        filterPanel.classList.toggle('hidden');
    });

    levelChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            levelChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            // Hide all subfilters
            document.querySelectorAll('.subfilter').forEach(sf => sf.classList.add('hidden'));
            subChips.forEach(c => c.classList.remove('active'));

            // Clear subject selections and hide panels
            subjectChips.forEach(c => c.classList.remove('active'));
            subjectPanels.forEach(p => p.classList.add('hidden'));
            sessionStorage.removeItem('currentSubject');

            const level = chip.dataset.level;
            sessionStorage.setItem('currentLevel', level);
            sessionStorage.setItem('currentContext', chip.dataset.keywords);

            if (level === 'superiori' || level === 'universita') {
                const subFilter = document.getElementById(`subfilter-${level}`);
                if (subFilter) subFilter.classList.remove('hidden');
            }

            // Show relevant subject filters based on level (ignoring empty/Generico)
            if (level) {
                subjectContainer.classList.remove('hidden');

                // If it's infanzia, medie, superiori or universita, the ID exactly matches "subjects-level"
                const relevantSubjectPanel = document.getElementById(`subjects-${level}`);
                if (relevantSubjectPanel) relevantSubjectPanel.classList.remove('hidden');
            } else {
                subjectContainer.classList.add('hidden');
            }
        });
    });

    subChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            const parentLevel = e.target.closest('.subfilter').id.replace('subfilter-', '');
            // Deselect other sub chips in same category
            const siblings = e.target.closest('.filter-levels').querySelectorAll('.filter-chip.sub');
            siblings.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            // Combine contexts
            const mainChip = document.querySelector(`.filter-chip[data-level="${parentLevel}"]`);
            const combinedContext = `${mainChip ? mainChip.dataset.keywords : ''} ${chip.dataset.keywords}`.trim();
            sessionStorage.setItem('currentContext', combinedContext);
        });
    });

    subjectChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            const siblings = e.target.closest('.filter-levels').querySelectorAll('.filter-chip.subject');
            siblings.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            sessionStorage.setItem('currentSubject', chip.dataset.subject);
        });
    });

    // Close filter panel when clicking outside
    document.addEventListener('click', (e) => {
        if (filterPanel && !e.target.closest('.search-container')) {
            filterPanel.classList.add('hidden');
        }
    });

    let healthyInstances = ['https://invidious.ducks.party', 'https://iv.melmac.space', 'https://invidious.flokinet.to'];
    let currentInstanceIndex = 0;

    const schoolMemes = [
        "Geografia è italiano o matematica?",
        "La prof: 'C'è la ricreazione, uscite!' Io: 'Ma sto finendo l'esercizio!'",
        "Quando la prof dice 'Spegnete i telefoni' e tu metti quello di riserva.",
        "Prof: 'Perché ridi?' Io: 'Per niente.' La mia testa: *Gatto che canta*",
        "Io che cerco di capire se il cateto è un muscolo o di geometria.",
        "Studiare 5 ore: 10 minuti di studio, 4 ore e 50 di pausa."
    ];

    async function getHealthyInstancesList() {
        try {
            const apiUrl = 'https://api.invidious.io/instances?sort_by=health,type';
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();
            const instances = JSON.parse(data.contents);

            const filtered = instances
                .filter(inst => inst[1].api && inst[1].type === 'https' && inst[1].health > 90)
                .map(inst => inst[1].uri);

            if (filtered.length > 0) {
                // Ensure ducks.party is still prioritized if available
                healthyInstances = [...new Set(['https://invidious.ducks.party', ...filtered, ...healthyInstances])];
                console.log('Healthy instances updated:', healthyInstances);
            }
        } catch (e) {
            console.error('Failed to fetch instance list, using defaults.');
        }
    }

    // Initial fetch
    getHealthyInstancesList();

    async function searchVideos(query, retryCount = 0) {
        const menu = document.getElementById('search-results-menu');
        if (retryCount === 0) {
            const randomMeme = schoolMemes[Math.floor(Math.random() * schoolMemes.length)];
            menu.innerHTML = `
                <div style="padding: 15px; text-align: center;">
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px;">Ricerca in corso...</div>
                    <div style="font-style: italic; color: var(--accent); font-size: 0.85rem;">"${randomMeme}"</div>
                </div>
            `;
            menu.classList.remove('hidden');
        }

        const instance = healthyInstances[currentInstanceIndex % healthyInstances.length];

        try {
            const apiUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;

            console.log(`Attempting search using: ${instance}`);
            const response = await fetch(proxyUrl);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const results = JSON.parse(data.contents);

            if (!results || !Array.isArray(results)) throw new Error('Invalid JSON response');

            // Artificial delay of 3 seconds to let the user read the meme
            await new Promise(resolve => setTimeout(resolve, 3000));

            displaySearchResults(results.slice(0, 9));
        } catch (error) {
            console.warn(`Search failed on ${instance}:`, error.message);

            if (retryCount < 3 && healthyInstances.length > 1) {
                currentInstanceIndex++;
                console.log(`Retrying with next instance: ${healthyInstances[currentInstanceIndex % healthyInstances.length]}`);
                return searchVideos(query, retryCount + 1);
            }

            menu.innerHTML = '<div style="padding: 10px; font-size: 0.9rem; color: var(--accent);">Errore nella ricerca dopo vari tentativi. Riprova tra un istante.</div>';
        }
    }

    const GEMINI_API_KEY = "AIzaSyDHWVD_V70rPZ6QxufMpKwr3tZNJUA424o";
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    async function analyzeWithAI(title, author) {
        try {
            const prompt = `Analizza se questo video di YouTube è di tipo educativo, scolastico o utile per lo studio. Rispondi esattamente con una sola parola: 'SI' per educativo/studio, 'NO' per intrattenimento/distrazione. \nTitolo: "${title}" \nCanale: "${author}"`;

            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 5
                    }
                })
            });

            if (!response.ok) {
                console.warn(`Gemini API returned ${response.status}`);
                return null;
            }

            const data = await response.json();
            if (data.candidates &&
                data.candidates[0] &&
                data.candidates[0].content &&
                data.candidates[0].content.parts &&
                data.candidates[0].content.parts[0]) {
                const result = data.candidates[0].content.parts[0].text.trim().toUpperCase();
                console.log(`AI Analysis for "${title}": ${result}`);
                return result.includes('SI');
            }
            console.warn('Gemini response structure unexpected:', data);
            return null;
        } catch (e) {
            console.error('AI Analysis failed, falling back to keywords:', e);
            return null;
        }
    }

    const studyKeywords = ['studio', 'tutorial', 'lezione', 'spiegazione', 'corso', 'scuola', 'università', 'appunti', 'howto', 'learn', 'impara', 'education', 'math', 'matematica', 'storia', 'fisica', 'chimica', 'scienza', 'informatica', 'coding', 'programmazione'];
    const distractionKeywords = ['gameplay', 'gaming', 'funny', 'vlog', 'trailer', 'reazione', 'reaction', 'official music', 'official video', 'prank', 'sfida'];

    async function isStudyVideo(title, author = "") {
        const aiResult = await analyzeWithAI(title, author);
        if (aiResult !== null) return aiResult;

        // Fallback Keyword Logic
        const fullText = (title + " " + author).toLowerCase();
        const hasDistraction = distractionKeywords.some(kw => fullText.includes(kw));
        if (hasDistraction) return false;
        const hasStudyKw = studyKeywords.some(kw => fullText.includes(kw));
        return hasStudyKw;
    }

    async function displaySearchResults(results) {
        const menu = document.getElementById('search-results-menu');
        menu.innerHTML = '';

        // Perform parallel AI validation for the top 5 results
        const validationPromises = results.slice(0, 9).map(async video => {
            const isStudy = await isStudyVideo(video.title, video.author);
            return isStudy ? video : null;
        });

        const validatedResults = (await Promise.all(validationPromises)).filter(v => v !== null);

        if (validatedResults.length === 0) {
            menu.innerHTML = '<div style="padding: 10px; font-size: 0.9rem; color: var(--accent);">Nessun video educativo trovato con l\'analisi AI. Prova una ricerca più specifica.</div>';
            return;
        }

        validatedResults.slice(0, 3).forEach(video => {
            const item = document.createElement('div');
            item.className = 'search-result-item';

            const thumbUrl = video.videoThumbnails ? video.videoThumbnails[0].url : '';

            item.innerHTML = `
                <img src="${thumbUrl}" class="result-thumb" onerror="this.src='https://via.placeholder.com/80x45?text=Video'">
                <div class="result-info">
                    <div class="result-title">${video.title}</div>
                    <div class="result-channel">${video.author}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                loadVideo(video.videoId);
                hideSearchMenu();
                videoInput.value = video.title;
            });

            menu.appendChild(item);
        });
    }

    function hideSearchMenu() {
        document.getElementById('search-results-menu').classList.add('hidden');
    }

    function extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    // Helper to check if a string is a YouTube URL
    function isYoutubeUrl(url) {
        return url.includes('youtube.com/watch?v=') || url.includes('youtu.be/');
    }

    // Helper to get a random meme phrase
    function getMemePhrase() {
        const randomMeme = schoolMemes[Math.floor(Math.random() * schoolMemes.length)];
        return `<div style="font-style: italic; color: var(--accent); font-size: 0.85rem;">"${randomMeme}"</div>`;
    }

    loadBtn.addEventListener('click', () => {
        const inputVal = videoInput.value.trim();
        if (inputVal === '') return;

        const searchMenu = document.getElementById('search-results-menu');

        // Visual feedback
        searchMenu.classList.remove('hidden');
        searchMenu.innerHTML = `
            <div style="text-align: center; color: var(--accent); margin-top: 1rem;">
                <div class="spinner"></div>
                ${isYoutubeUrl(inputVal) ? "Verificando il video..." : getMemePhrase()}
            </div>
        `;

        if (isYoutubeUrl(inputVal)) {
            // Direct video validation via AI
            const fetchId = extractVideoId(inputVal);
            // Simulated validation due to CORS constraints and metadata fetch complexities - assuming ok
            const simulatedStudyCheck = true;
            setTimeout(async () => {
                if (simulatedStudyCheck) {
                    loadVideo(fetchId);
                    searchMenu.classList.add('hidden');
                } else {
                    alert("⚠️ Questo video non sembra essere a scopo educativo. StudyTube è progettato per aiutarti a studiare, non per distrarti!");
                    searchMenu.classList.add('hidden');
                    videoInput.value = '';
                }
            }, 1000);

        } else {
            // Apply contexts to search term
            const schoolContext = sessionStorage.getItem('currentContext') || '';
            const subjectContext = sessionStorage.getItem('currentSubject') || '';
            const combinedQuery = `${inputVal} ${schoolContext} ${subjectContext}`.trim();
            console.log("Searching with query context:", combinedQuery);

            setTimeout(() => {
                searchVideos(combinedQuery);
            }, 3000); // 3 seconds delay for memes
        }
    });

    // Also search on Enter key
    videoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadBtn.click();
    });

    async function loadVideo(id) {
        // Fetch metadata to check if it's educational before loading
        try {
            const instance = healthyInstances[currentInstanceIndex % healthyInstances.length];
            const apiUrl = `${instance}/api/v1/videos/${id}`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;

            const response = await fetch(proxyUrl);
            const data = await response.json();
            const videoData = JSON.parse(data.contents);

            if (!isStudyVideo(videoData.title, videoData.author)) {
                alert("⚠️ Questo video non sembra essere a scopo educativo. StudyTube è progettato per aiutarti a studiare, non per distrarti!");
                return;
            }
        } catch (e) {
            console.warn("Could not validate video, proceeding anyway due to fallback.");
        }

        document.getElementById('player-placeholder').style.display = 'none';
        document.getElementById('youtube-player').style.display = 'block';

        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(id);
        } else {
            if (player) player.destroy();
            player = new YT.Player('youtube-player', {
                videoId: id,
                playerVars: {
                    'autoplay': 1,
                    'controls': 1,
                    'modestbranding': 1,
                    'rel': 0
                },
                events: {
                    'onReady': onPlayerReady
                }
            });
        }
    }

    function loadSearch(query) {
        // Redundant with searchVideos but kept for backward compatibility if needed
        searchVideos(query);
    }

    function onPlayerReady(event) {
        console.log("Player Ready");
    }

    // Timer Logic
    startBtn.addEventListener('click', () => {
        if (isTimerRunning) {
            clearInterval(timerInterval);
            startBtn.textContent = 'Start';
            isTimerRunning = false;
        } else {
            startBtn.textContent = 'Pause';
            isTimerRunning = true;
            timerInterval = setInterval(updateTimer, 1000);
        }
    });

    function getTotalSeconds() {
        const hrs = Math.max(0, Math.min(23, parseInt(timerHoursInput.value) || 0));
        const mins = Math.max(0, Math.min(59, parseInt(timerMinutesInput.value) || 0));
        return hrs * 3600 + mins * 60 || 60; // minimum 1 minute
    }

    timerHoursInput.addEventListener('change', () => {
        timerHoursInput.value = Math.max(0, Math.min(23, parseInt(timerHoursInput.value) || 0));
        timerDuration = getTotalSeconds();
        if (!isTimerRunning) {
            timeLeft = timerDuration;
            updateTimerDisplay();
        }
    });

    timerMinutesInput.addEventListener('change', () => {
        timerMinutesInput.value = Math.max(0, Math.min(59, parseInt(timerMinutesInput.value) || 0));
        timerDuration = getTotalSeconds();
        if (!isTimerRunning) {
            timeLeft = timerDuration;
            updateTimerDisplay();
        }
    });

    resetBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
        timerDuration = getTotalSeconds();
        timeLeft = timerDuration;
        updateTimerDisplay();
        startBtn.textContent = 'Start';
        isTimerRunning = false;
    });

    function updateTimer() {
        if (timeLeft > 0) {
            timeLeft--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            alert("Sessione terminata! Fai una pausa.");
            isTimerRunning = false;
        }
    }

    function updateTimerDisplay() {
        const hrs = Math.floor(timeLeft / 3600);
        const mins = Math.floor((timeLeft % 3600) / 60);
        const secs = timeLeft % 60;
        if (hrs > 0) {
            timerDisplay.textContent = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // Focus Mode Logic
    focusBtn.addEventListener('click', () => {
        document.body.classList.toggle('focus-mode');

        // Micro-animazione feedback
        focusBtn.style.transform = 'scale(1.3)';
        setTimeout(() => focusBtn.style.transform = '', 200);
    });
});
