let player;
let timerInterval;
let timeLeft = 25 * 60;
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

    // Load saved notes
    notesArea.value = localStorage.getItem('studyTube_notes') || '';

    // Save notes automatically
    notesArea.addEventListener('input', () => {
        localStorage.setItem('studyTube_notes', notesArea.value);
    });

    // Video Loading Logic
    loadBtn.addEventListener('click', () => {
        const query = videoInput.value.trim();
        if (!query) return;

        let videoId = extractVideoId(query);

        if (videoId) {
            loadVideo(videoId);
        } else {
            searchVideos(query);
        }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            hideSearchMenu();
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
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent('https://api.invidious.io/instances?sort_by=health,type')}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();

            const filtered = data
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
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

            console.log(`Attempting search using: ${instance}`);
            const response = await fetch(proxyUrl);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const results = await response.json();

            if (!results || !Array.isArray(results)) throw new Error('Invalid JSON response');

            // Artificial delay of 3 seconds to let the user read the meme
            await new Promise(resolve => setTimeout(resolve, 3000));

            displaySearchResults(results.slice(0, 3));
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

    const studyKeywords = ['studio', 'tutorial', 'lezione', 'spiegazione', 'corso', 'scuola', 'università', 'appunti', 'howto', 'learn', 'impara', 'education', 'math', 'matematica', 'storia', 'fisica', 'chimica', 'scienza', 'informatica', 'coding', 'programmazione'];
    const distractionKeywords = ['gameplay', 'gaming', 'funny', 'vlog', 'trailer', 'reazione', 'reaction', 'official music', 'official video', 'prank', 'sfida'];

    function isStudyVideo(title, author = "") {
        const fullText = (title + " " + author).toLowerCase();

        // Check for distraction keywords first
        const hasDistraction = distractionKeywords.some(kw => fullText.includes(kw));
        if (hasDistraction) return false;

        // Check for study keywords
        const hasStudyKw = studyKeywords.some(kw => fullText.includes(kw));
        return hasStudyKw;
    }

    function displaySearchResults(results) {
        const menu = document.getElementById('search-results-menu');
        menu.innerHTML = '';

        // Filter results based on the algorithm
        const filteredResults = results.filter(v => isStudyVideo(v.title, v.author));

        if (filteredResults.length === 0) {
            menu.innerHTML = '<div style="padding: 10px; font-size: 0.9rem; color: var(--accent);">Nessun video educativo trovato. Prova una ricerca più specifica (es. "Lezione di storia").</div>';
            return;
        }

        filteredResults.slice(0, 3).forEach(video => {
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

    async function loadVideo(id) {
        // Fetch metadata to check if it's educational before loading
        try {
            const instance = healthyInstances[currentInstanceIndex % healthyInstances.length];
            const apiUrl = `${instance}/api/v1/videos/${id}`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

            const response = await fetch(proxyUrl);
            const data = await response.json();

            if (!isStudyVideo(data.title, data.author)) {
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

    resetBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
        timeLeft = 25 * 60;
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
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Focus Mode Logic
    focusBtn.addEventListener('click', () => {
        document.body.classList.toggle('focus-mode');

        // Micro-animazione feedback
        focusBtn.style.transform = 'scale(1.3)';
        setTimeout(() => focusBtn.style.transform = '', 200);
    });
});
