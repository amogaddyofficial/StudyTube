/**
 * StudyTube V2 - Engine Core Logic
 * Handles File Uploads, Notebook DNA, and Media Generation Orchestration
 */

import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

inject();
injectSpeedInsights();

// Configuration
const GEMINI_API_KEY = "AIzaSyDHWVD_V70rPZ6QxufMpKwr3tZNJUA424o";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// App State
let sources = []; // { name: string, type: string, content: string }
let sessionHistory = [];
let notebookDNA = {
    sources: [],
    history: [],
    schemas: {}
};

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const sourceList = document.getElementById('source-list');
    const engineOutput = document.getElementById('engine-output');
    const engineQuery = document.getElementById('engine-query');
    const askBtn = document.getElementById('ask-btn');
    const brainStatus = document.getElementById('brain-status');
    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.getElementById('gen-progress');

    // --- 1. File Upload Logic ---
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    async function handleFiles(files) {
        for (let file of files) {
            if (file.type === "application/pdf") {
                await processPDF(file);
            } else if (file.type === "text/plain") {
                await processText(file);
            } else {
                addLog(`Tipo di file non supportato: ${file.name}`, "error");
            }
        }
        updateSourceUI();
    }

    async function processText(file) {
        const text = await file.text();
        sources.push({ name: file.name, type: 'TXT', content: text });
        addLog(`Caricato: ${file.name}`);
    }

    async function processPDF(file) {
        addLog(`Analizzando PDF: ${file.name}...`);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfData = new Uint8Array(arrayBuffer);
            const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
            let fullText = "";
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                fullText += content.items.map(item => item.str).join(" ") + "\n";
            }
            
            sources.push({ name: file.name, type: 'PDF', content: fullText });
            addLog(`PDF Pronto: ${file.name}`);
        } catch (e) {
            console.error(e);
            addLog(`Errore nel caricamento PDF: ${file.name}`, "error");
        }
    }

    function updateSourceUI() {
        sourceList.innerHTML = sources.map((s, idx) => `
            <li class="source-item">
                <span>${s.type === 'PDF' ? '📄' : '📝'}</span>
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s.name}</span>
                <button onclick="removeSource(${idx})" style="background: none; border: none; color: #ff6b6b; cursor: pointer;">✕</button>
            </li>
        `).join('');
    }

    window.removeSource = (idx) => {
        sources.splice(idx, 1);
        updateSourceUI();
    };

    // --- 2. Brain Logic (Gemini) ---
    async function askBrain(query) {
        if (!query.trim()) return;
        
        const userMsg = { role: "user", text: query };
        sessionHistory.push(userMsg);
        renderChat();
        engineQuery.value = "";

        brainStatus.innerText = "Pensando...";
        brainStatus.className = "status-badge working";

        try {
            // Build context from sources
            const context = sources.map(s => `FONTE [${s.name}]: ${s.content}`).join("\n\n");
            const prompt = `Sei il motore logico "Phi-3.5" integrato in StudyTube V2.
            Il tuo compito è l'ANALISI DELLE FONTI: rispondi SOLO ed ESCLUSIVAMENTE sui documenti caricati.
            Se l'informazione non è presente nelle fonti, rispondi con: "Informazione non trovata nelle fonti caricate."
            
            Usa una struttura logica chiara:
            - Identifica i concetti chiave
            - Organizza in Punti Elenco
            - Mantieni un tono sintetico e professionale
            
            CONTESTO FONTI:
            ${context}
            
            DOMANDA DELLO STUDENTE: ${query}
            
            Rispondi in HTML semplice (<b>, <br>, <li>). Non usare Markdown.`;

            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            const aiText = data.candidates[0].content.parts[0].text;
            
            sessionHistory.push({ role: "ai", text: aiText });
            renderChat();
        } catch (e) {
            console.error(e);
            addLog("Errore di connessione con il Cervello.", "error");
        } finally {
            brainStatus.innerText = "Pronto";
            brainStatus.className = "status-badge ready";
        }
    }

    function renderChat() {
        engineOutput.innerHTML = sessionHistory.map(m => `
            <div class="ai-message ${m.role === 'user' ? '' : 'system'}">
                <b>${m.role === 'user' ? 'Tu' : 'AI'}:</b><br>
                ${m.text}
            </div>
        `).join('');
        engineOutput.scrollTop = engineOutput.scrollHeight;
    }

    askBtn.addEventListener('click', () => askBrain(engineQuery.value));
    engineQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') askBrain(engineQuery.value);
    });

    function addLog(msg, type = "info") {
        const div = document.createElement('div');
        div.className = `ai-message system`;
        div.style.borderLeft = type === "error" ? "3px solid #ff6b6b" : "3px solid var(--accent)";
        div.innerHTML = `<i>${msg}</i>`;
        engineOutput.appendChild(div);
        engineOutput.scrollTop = engineOutput.scrollHeight;
    }

    // --- 3. Media Generation (PPTX Example) ---
    const genPptxBtn = document.querySelector('#gen-pptx button');
    genPptxBtn.addEventListener('click', async () => {
        if (sources.length === 0) {
            addLog("Carica almeno una fonte per generare slide!", "error");
            return;
        }

        addLog("Generando schema slide via AI...");
        progressContainer.style.display = "block";
        progressBar.style.width = "30%";

        try {
            const context = sources.map(s => s.content).join("\n");
            const prompt = `Basandoti su questo testo, genera uno schema per una presentazione PowerPoint di 5 slide.
            Restituisci SOLO un oggetto JSON valido con questo formato:
            { "slides": [ { "title": "...", "bullets": ["...", "..."] } ] }
            
            TESTO: ${context.substring(0, 5000)}`; // Token limit safety

            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            let rawText = data.candidates[0].content.parts[0].text;
            // Clean markdown if present
            rawText = rawText.replace(/```json|```/g, "").trim();
            const schema = JSON.parse(rawText);

            progressBar.style.width = "70%";
            addLog("Schema pronto. Creazione file PPTX...");

            // Use PptxGenJS
            let pptx = new PptxGenJS();
            schema.slides.forEach(s => {
                let slide = pptx.addSlide();
                slide.addText(s.title, { x: 0.5, y: 0.5, fontSize: 24, color: '363636', bold: true });
                slide.addText(s.bullets.join("\n"), { x: 0.5, y: 1.5, fontSize: 18, color: '666666' });
            });

            pptx.writeFile({ fileName: `StudioTube_Lezione_${Date.now()}.pptx` });
            
            progressBar.style.width = "100%";
            addLog("PowerPoint scaricato con successo! 🎉");
            setTimeout(() => progressContainer.style.display = "none", 2000);
        } catch (e) {
            console.error(e);
            addLog("Errore nella generazione slide.", "error");
            progressContainer.style.display = "none";
        }
    });

    // --- 5. Podcast Script Generation ---
    const genPodcastBtn = document.querySelector('#gen-podcast button');
    genPodcastBtn.addEventListener('click', async () => {
        if (sources.length === 0) {
            addLog("Carica almeno una fonte per generare il podcast!", "error");
            return;
        }

        addLog("Generando script podcast (Dialogo tra 2 voci)...");
        progressContainer.style.display = "block";
        progressBar.style.width = "40%";

        try {
            const context = sources.map(s => s.content).join("\n");
            const prompt = `Sei l'autore di un podcast educativo. Crea un DIALOGO tra due persone (Alex: Insegnante esperto e Sam: Studente curioso) che spiegano il contenuto dei documenti caricati.
            Il dialogo deve essere coinvolgente, semplice e durare circa 3 minuti di lettura.
            Restituisci il testo formattato con i nomi dei parlanti.
            
            FONTI: ${context.substring(0, 5000)}`;

            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            const script = data.candidates[0].content.parts[0].text;
            
            sessionHistory.push({ role: "ai", text: `<b>🎭 Script Podcast Generato:</b><br><div style="font-size: 0.85rem; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">${script.replace(/\n/g, "<br>")}</div>` });
            renderChat();

            progressBar.style.width = "100%";
            addLog("Script Podcast pronto nella chat! 🎙️");
            setTimeout(() => progressContainer.style.display = "none", 2000);
        } catch (e) {
            console.error(e);
            addLog("Errore nella generazione del podcast.", "error");
            progressContainer.style.display = "none";
        }
    });

    // --- 6. Audio Lesson Generation (Web Speech API) ---
    const genAudioBtn = document.querySelector('#gen-audio button');
    genAudioBtn.addEventListener('click', () => {
        const lastMsg = sessionHistory.filter(m => m.role === 'ai').pop();
        if (!lastMsg) {
            addLog("Chiedi qualcosa all'AI o genera uno script per trasformarlo in audio!", "error");
            return;
        }

        addLog("Preparazione audio della lezione...");
        const synth = window.speechSynthesis;
        const textToSpeak = lastMsg.text.replace(/<[^>]*>/g, '');
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        
        // Try to find an Italian voice
        const voices = synth.getVoices();
        const itaVoice = voices.find(v => v.lang.startsWith('it'));
        if (itaVoice) utterance.voice = itaVoice;
        
        utterance.onstart = () => {
            addLog("Audio in riproduzione... 🔊");
            progressBar.style.width = "50%";
            progressContainer.style.display = "block";
        };
        
        utterance.onend = () => {
            progressBar.style.width = "100%";
            addLog("Riproduzione completata.");
            setTimeout(() => progressContainer.style.display = "none", 1000);
        };

        synth.speak(utterance);
    });

    // --- 7. Notebook Export/Import ---
    const exportBtn = document.getElementById('export-notebook');
    exportBtn.addEventListener('click', () => {
        const dna = {
            sources,
            history: sessionHistory,
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(dna, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `StudyTube_DNA_${Date.now()}.json`;
        a.click();
        addLog("Notebook DNA esportato!");
    });

    const importBtn = document.getElementById('import-notebook');
    const importInput = document.getElementById('import-input');
    importBtn.addEventListener('click', () => importInput.click());
    
    importInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const dna = JSON.parse(text);
        
        sources = dna.sources || [];
        sessionHistory = dna.history || [];
        updateSourceUI();
        renderChat();
        addLog("Sessione ripristinata dal Notebook!");
    });

    // Reset Engine
    document.getElementById('reset-engine').addEventListener('click', () => {
        if (confirm("Sei sicuro? Questo cancellerà tutti i documenti e la chat per la tua privacy.")) {
            sources = [];
            sessionHistory = [];
            updateSourceUI();
            engineOutput.innerHTML = '<div class="ai-message system">Sessione resettata. Privacy garantita.</div>';
            addLog("Tutto pulito.");
        }
    });
});
