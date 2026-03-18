import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

inject();
injectSpeedInsights();

const GEMINI_API_KEY = "AIzaSyDHWVD_V70rPZ6QxufMpKwr3tZNJUA424o";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('ai-search-btn');
    const searchInput = document.getElementById('ai-search-input');
    const resultContainer = document.getElementById('ai-result-container');

    let schoolContext = "";
    let subjectContext = "";

    // Filter Logic
    const filterBtn = document.getElementById('filter-btn');
    const filterPanel = document.getElementById('filter-panel');
    const levelChips = document.querySelectorAll('.filter-levels > .filter-chip[data-level]');
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

    async function performAISearch(query) {
        if (!query.trim()) return;

        // Retrieve current context
        schoolContext = sessionStorage.getItem('currentContext') || "generale";
        subjectContext = sessionStorage.getItem('currentSubject') || "";

        resultContainer.innerHTML = `
            <div style="text-align: center; color: var(--accent); margin-top: 2rem;">
                <div class="spinner"></div>
                <h2>Sto elaborando il riassunto...</h2>
                <p>L'AI sta analizzando i dati per darti la migliore risposta.</p>
            </div>
        `;

        try {
            const prompt = `Sei un insegnante AI specializzato per "StudyTube" che aiuta studenti a studiare.
Livello dello studente: ${schoolContext}. Adatta il tuo linguaggio, la complessità del riassunto e gli esempi al livello dello studente.
Materia: ${subjectContext || "generale"}. Resta in tema con questa materia.
Rispondi in modo chiaro, strutturato e conciso alla seguente richiesta di studio. Usa elenchi puntati se necessario.
Formattazione: usa HTML base (<b> per grassetto, <br> per andare a capo, <ul>/<li> per liste) per formattare la tua risposta. Non usare markdown.

Domanda: "${query}"`;

            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 1024
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const resultHtml = data.candidates[0].content.parts[0].text.trim();

                resultContainer.innerHTML = `
                    <h2 style="color: var(--accent); margin-bottom: 1.5rem;">Risultato per: "${query}"</h2>
                    <div style="color: var(--text-primary); line-height: 1.6; font-size: 1.1rem; text-align: left;">
                        ${resultHtml}
                    </div>
                `;
            } else {
                throw new Error("Invalid response format");
            }

        } catch (e) {
            console.error("AI Search failed:", e);
            resultContainer.innerHTML = `
                <div style="text-align: center; color: #ff6b6b; margin-top: 2rem;">
                    <h2>Errore di Comunicazione</h2>
                    <p>Purtroppo non sono riuscito a elaborare la risposta in questo momento. Riprova tra poco!</p>
                </div>
            `;
        }
    }

    searchBtn.addEventListener('click', () => {
        performAISearch(searchInput.value);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performAISearch(searchInput.value);
        }
    });
});
