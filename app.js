// --- Web Audio API Ambient Sound Synthesizer ---
class SoundscapeManager {
    constructor() {
        this.ctx = null;
        this.sources = {};      // Stores active noise/oscillator source nodes
        this.gains = {};        // Stores gain nodes for individual sound sliders
        this.filters = {};      // Stores filter nodes
        this.lfos = {};         // Stores LFO nodes for sweeping frequencies
        this.timers = {};       // Stores intervals/timeouts for event generation (e.g. coffee clinks)
        this.masterGain = null; // Master volume controls
        this.buffers = {};      // Cache for generated audio buffers
    }

    initContext() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
            
            // Build noise buffers
            this.buffers.white = this.generateWhiteNoise();
            this.buffers.pink = this.generatePinkNoise();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    generateWhiteNoise() {
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds loop
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    generatePinkNoise() {
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds loop
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0, b1, b2, b3, b4, b5, b6;
        b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            data[i] *= 0.11; // rescale to prevent clipping
            b6 = white * 0.115926;
        }
        return buffer;
    }

    play(soundName, volume = 0.5) {
        this.initContext();
        if (this.sources[soundName]) return; // Already playing

        this.gains[soundName] = this.ctx.createGain();
        this.gains[soundName].gain.setValueAtTime(volume, this.ctx.currentTime);
        this.gains[soundName].connect(this.masterGain);

        if (soundName === 'noise') {
            // White Noise Loop
            const src = this.ctx.createBufferSource();
            src.buffer = this.buffers.white;
            src.loop = true;
            src.connect(this.gains[soundName]);
            src.start();
            this.sources[soundName] = src;

        } else if (soundName === 'rain') {
            // Rain Synthesis: Pink noise through a lowpass filter + pitter patter highpass crackle
            const mainRainSrc = this.ctx.createBufferSource();
            mainRainSrc.buffer = this.buffers.pink;
            mainRainSrc.loop = true;

            const lp = this.ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 650; // Heavy rumble rain base

            mainRainSrc.connect(lp);
            lp.connect(this.gains[soundName]);
            mainRainSrc.start();
            this.sources[soundName] = mainRainSrc;

            // Extra high-frequency droplets for detail
            const crackleSrc = this.ctx.createBufferSource();
            crackleSrc.buffer = this.buffers.white;
            crackleSrc.loop = true;

            const hp = this.ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 4000;

            const hpGain = this.ctx.createGain();
            hpGain.gain.value = 0.04; // Very subtle patter

            crackleSrc.connect(hp);
            hp.connect(hpGain);
            hpGain.connect(this.gains[soundName]);
            crackleSrc.start();
            
            // Store extra sources as arrays so we can dispose them
            this.sources[soundName] = [mainRainSrc, crackleSrc];

        } else if (soundName === 'wind') {
            // Wind Synthesis: Pink noise through bandpass modulated by slow LFO
            const windSrc = this.ctx.createBufferSource();
            windSrc.buffer = this.buffers.pink;
            windSrc.loop = true;

            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 2.5; // High selectivity for howling sound
            bp.frequency.value = 350;

            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 0.06; // 16 second sweeps

            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 220; // swept frequency ranges +/- 220Hz

            lfo.connect(lfoGain);
            lfoGain.connect(bp.frequency);
            
            windSrc.connect(bp);
            bp.connect(this.gains[soundName]);
            
            lfo.start();
            windSrc.start();

            this.sources[soundName] = [windSrc, lfo];

        } else if (soundName === 'cafe') {
            // Cafe Synthesis: 
            // 1. Low rumble base (Pink noise + lowpass)
            // 2. Murmur: detuned low sines modulated in volume
            // 3. Periodic coffee clinks
            const murmurSrc = this.ctx.createBufferSource();
            murmurSrc.buffer = this.buffers.pink;
            murmurSrc.loop = true;

            const rumbleLp = this.ctx.createBiquadFilter();
            rumbleLp.type = 'lowpass';
            rumbleLp.frequency.value = 180;

            murmurSrc.connect(rumbleLp);
            rumbleLp.connect(this.gains[soundName]);
            murmurSrc.start();

            // Sines for speech hum
            const speakOsc1 = this.ctx.createOscillator();
            speakOsc1.frequency.value = 130;
            const speakGain1 = this.ctx.createGain();
            speakGain1.gain.value = 0.08;
            speakOsc1.connect(speakGain1);
            speakGain1.connect(this.gains[soundName]);
            speakOsc1.start();

            const speakOsc2 = this.ctx.createOscillator();
            speakOsc2.frequency.value = 210;
            const speakGain2 = this.ctx.createGain();
            speakGain2.gain.value = 0.05;
            speakOsc2.connect(speakGain2);
            speakGain2.connect(this.gains[soundName]);
            speakOsc2.start();

            // Periodic clinks
            const clinkTimer = setInterval(() => {
                if (this.ctx && this.ctx.state !== 'suspended') {
                    this.playCoffeeClink(this.gains[soundName]);
                }
            }, 3500);

            this.sources[soundName] = [murmurSrc, speakOsc1, speakOsc2];
            this.timers[soundName] = clinkTimer;
        }
    }

    playCoffeeClink(destinationGain) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        // Dynamic pitch for random clink objects
        osc.frequency.value = 1600 + Math.random() * 1400;
        
        gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.04 + Math.random() * 0.06, this.ctx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12); // rapid decay
        
        osc.connect(gainNode);
        gainNode.connect(destinationGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    stop(soundName) {
        if (!this.sources[soundName]) return;

        // Clean up intervals
        if (this.timers[soundName]) {
            clearInterval(this.timers[soundName]);
            delete this.timers[soundName];
        }

        // Clean up sound source nodes
        const activeSrc = this.sources[soundName];
        if (Array.isArray(activeSrc)) {
            activeSrc.forEach(node => {
                try { node.stop(); } catch(e) {}
                node.disconnect();
            });
        } else {
            try { activeSrc.stop(); } catch(e) {}
            activeSrc.disconnect();
        }

        if (this.gains[soundName]) {
            this.gains[soundName].disconnect();
            delete this.gains[soundName];
        }

        delete this.sources[soundName];
    }

    setVolume(soundName, volume) {
        if (this.gains[soundName]) {
            this.gains[soundName].gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
        }
    }
}

// --- App Orchestration ---
document.addEventListener("DOMContentLoaded", () => {
    // Sound Manager Instantiation
    const soundscape = new SoundscapeManager();

    // Soundboard event bindings
    const soundCards = document.querySelectorAll(".sound-card");
    soundCards.forEach(card => {
        const soundName = card.getAttribute("data-sound");
        const toggleBtn = card.querySelector(".sound-toggle");
        const volumeSlider = card.querySelector(".sound-volume");
        const statusSpan = card.querySelector(".sound-status");
        
        let isPlaying = false;

        const startSound = () => {
            soundscape.play(soundName, parseFloat(volumeSlider.value));
            card.classList.add("active");
            toggleBtn.innerHTML = `<i data-lucide="square"></i>`;
            statusSpan.innerText = "Çalıyor";
            statusSpan.style.color = "var(--accent)";
            isPlaying = true;
            lucide.createIcons();
        };

        const stopSound = () => {
            soundscape.stop(soundName);
            card.classList.remove("active");
            toggleBtn.innerHTML = `<i data-lucide="play"></i>`;
            statusSpan.innerText = "Kapalı";
            statusSpan.style.color = "var(--text-secondary)";
            isPlaying = false;
            lucide.createIcons();
        };

        toggleBtn.addEventListener("click", () => {
            if (isPlaying) {
                stopSound();
            } else {
                startSound();
            }
        });

        volumeSlider.addEventListener("input", (e) => {
            const vol = parseFloat(e.target.value);
            soundscape.setVolume(soundName, vol);
            if (!isPlaying && vol > 0) {
                startSound();
            } else if (isPlaying && vol === 0) {
                stopSound();
            }
        });
    });

    // Timer Variables
    let timerInterval = null;
    let timeRemaining = 25 * 60; // default 25 mins
    let currentMode = "work";    // work, short, long
    let timerState = "paused";   // running, paused
    
    // Configurations (loaded from localStorage or defaults)
    const configs = JSON.parse(localStorage.getItem("pomodoro_configs")) || {
        work: 25,
        short: 5,
        long: 15
    };

    // Apply config values to inputs
    document.getElementById("cfg-work").value = configs.work;
    document.getElementById("cfg-short").value = configs.short;
    document.getElementById("cfg-long").value = configs.long;

    // Elements
    const timeLeftEl = document.getElementById("time-left");
    const currentTaskEl = document.getElementById("current-task-label");
    const startBtn = document.getElementById("start-btn");
    const playIcon = document.getElementById("play-icon");
    const resetBtn = document.getElementById("reset-btn");
    const skipBtn = document.getElementById("skip-btn");
    const modeBtns = document.querySelectorAll(".mode-btn");
    const progressCircle = document.querySelector(".progress-ring__circle");

    // Circular progress constants
    const ringRadius = 130;
    const ringCircumference = 2 * Math.PI * ringRadius; // ~816.8
    progressCircle.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
    progressCircle.style.strokeDashoffset = ringCircumference;

    // Set countdown timer state
    function updateTimerDisplay() {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Update interface
        timeLeftEl.innerText = timeStr;

        // Update browser tab
        const modeEmoji = currentMode === "work" ? "🧠" : "☕";
        document.title = `(${timeStr}) ${modeEmoji} Pomodoro Focus`;

        // Update progress ring offset
        const totalDuration = configs[currentMode] * 60;
        const fraction = timeRemaining / totalDuration;
        const offset = ringCircumference * (1 - fraction);
        progressCircle.style.strokeDashoffset = offset;
    }

    function changeMode(newMode) {
        currentMode = newMode;
        
        // Manage active states
        modeBtns.forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-mode") === newMode);
        });

        // Set state texts
        if (newMode === "work") {
            currentTaskEl.innerText = "Çalışma Zamanı";
            currentTaskEl.style.color = "var(--accent)";
        } else if (newMode === "short") {
            currentTaskEl.innerText = "Kısa Ara";
            currentTaskEl.style.color = "var(--success)";
        } else {
            currentTaskEl.innerText = "Uzun Ara";
            currentTaskEl.style.color = "var(--accent-secondary)";
        }

        // Reset clock
        pauseTimer();
        timeRemaining = configs[newMode] * 60;
        updateTimerDisplay();
    }

    function startTimer() {
        if (timerInterval) return;

        // Context trigger to enable Synthesizer on user gesture
        soundscape.initContext();

        timerState = "running";
        startBtn.innerHTML = `<i data-lucide="pause"></i> Duraklat`;
        startBtn.classList.remove("btn-primary");
        startBtn.classList.add("btn-secondary");
        lucide.createIcons();

        timerInterval = setInterval(() => {
            if (timeRemaining > 0) {
                timeRemaining--;
                updateTimerDisplay();
            } else {
                // Timer finished!
                playSystemBeep();
                handleTimerFinished();
            }
        }, 1000);
    }

    function pauseTimer() {
        if (!timerInterval) return;
        
        clearInterval(timerInterval);
        timerInterval = null;
        timerState = "paused";
        startBtn.innerHTML = `<i data-lucide="play"></i> Başlat`;
        startBtn.classList.remove("btn-secondary");
        startBtn.classList.add("btn-primary");
        lucide.createIcons();
    }

    function resetTimer() {
        pauseTimer();
        timeRemaining = configs[currentMode] * 60;
        updateTimerDisplay();
    }

    function skipTimer() {
        pauseTimer();
        // Shift modes automatically
        if (currentMode === "work") {
            changeMode("short");
        } else {
            changeMode("work");
        }
    }

    function playSystemBeep() {
        // Built-in Synthesized Beep for Pomodoro Completion alarm (No external asset dependency)
        soundscape.initContext();
        const ctx = soundscape.ctx;
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    }

    function handleTimerFinished() {
        pauseTimer();
        
        if (currentMode === "work") {
            // Log session data
            logCompletedSession(configs.work);
            
            // Auto transition to short break
            changeMode("short");
        } else {
            // Transition back to work
            changeMode("work");
        }
    }

    // --- Stats Dashboard Management ---
    function logCompletedSession(minutes) {
        const today = new Date().toISOString().split('T')[0];
        const stats = JSON.parse(localStorage.getItem("pomodoro_stats")) || {};
        
        if (!stats[today]) {
            stats[today] = { sessions: 0, minutes: 0 };
        }
        
        stats[today].sessions += 1;
        stats[today].minutes += minutes;

        localStorage.setItem("pomodoro_stats", JSON.stringify(stats));
        renderStats();
    }

    function renderStats() {
        const stats = JSON.parse(localStorage.getItem("pomodoro_stats")) || {};
        
        // Calculate totals for today
        const today = new Date().toISOString().split('T')[0];
        const todayStats = stats[today] || { sessions: 0, minutes: 0 };
        
        document.getElementById("stat-sessions").innerText = todayStats.sessions;
        document.getElementById("stat-minutes").innerText = `${todayStats.minutes} dk`;

        // Render Bar Chart for past 5 days
        const chartArea = document.getElementById("stats-chart");
        chartArea.innerHTML = "";

        const daysToDisplay = [];
        for (let i = 4; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            daysToDisplay.push({
                dateStr,
                label: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
                data: stats[dateStr] || { sessions: 0, minutes: 0 }
            });
        }

        // Find max minutes to scale chart heights (min scale 25 mins)
        const maxMinutes = Math.max(...daysToDisplay.map(d => d.data.minutes), 25);

        daysToDisplay.forEach(day => {
            const heightPercent = (day.data.minutes / maxMinutes) * 100;
            
            const barContainer = document.createElement("div");
            barContainer.className = "chart-bar-container";
            
            barContainer.innerHTML = `
                <div class="chart-bar" style="height: ${Math.max(heightPercent, 2)}%" data-value="${day.data.minutes}"></div>
                <span class="chart-label">${day.label}</span>
            `;
            chartArea.appendChild(barContainer);
        });
    }

    // Populate mock data if no stats are present so the chart doesn't look empty and sad
    function initMockStatsIfEmpty() {
        const stats = localStorage.getItem("pomodoro_stats");
        if (!stats) {
            const mockStats = {};
            const today = new Date();
            for (let i = 4; i >= 0; i--) {
                const tempDate = new Date();
                tempDate.setDate(today.getDate() - i);
                const tempStr = tempDate.toISOString().split('T')[0];
                // Random sessions between 1 and 4
                const sess = Math.floor(Math.random() * 4) + 1;
                mockStats[tempStr] = {
                    sessions: sess,
                    minutes: sess * 25
                };
            }
            localStorage.setItem("pomodoro_stats", JSON.stringify(mockStats));
        }
    }

    // --- Settings Panels ---
    const tabBtns = document.querySelectorAll(".panel-tab-btn");
    const tabContents = document.querySelectorAll(".panel-tab-content");
    
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            const target = btn.getAttribute("data-tab");
            document.getElementById(`tab-${target}`).classList.add("active");
        });
    });

    document.getElementById("save-settings-btn").addEventListener("click", () => {
        const workMin = parseInt(document.getElementById("cfg-work").value);
        const shortMin = parseInt(document.getElementById("cfg-short").value);
        const longMin = parseInt(document.getElementById("cfg-long").value);

        if (isNaN(workMin) || workMin < 1 || isNaN(shortMin) || shortMin < 1 || isNaN(longMin) || longMin < 1) {
            alert("Lütfen geçerli süreler giriniz!");
            return;
        }

        configs.work = workMin;
        configs.short = shortMin;
        configs.long = longMin;

        localStorage.setItem("pomodoro_configs", JSON.stringify(configs));
        
        // Reset current view with new configs
        changeMode(currentMode);
        
        // Feedback animation on save button
        const saveBtn = document.getElementById("save-settings-btn");
        const originalText = saveBtn.innerText;
        saveBtn.innerText = "Kaydedildi!";
        saveBtn.style.background = "var(--success)";
        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.removeAttribute("style");
        }, 1500);
    });

    // Theme Toggle
    const themeToggleBtn = document.getElementById("theme-toggle");
    themeToggleBtn.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark-mode");
        document.body.classList.toggle("light-mode", !isDark);
        themeToggleBtn.innerHTML = isDark ? `<i data-lucide="sun"></i>` : `<i data-lucide="moon"></i>`;
        lucide.createIcons();
    });

    // Timer Bindings
    startBtn.addEventListener("click", () => {
        if (timerState === "running") {
            pauseTimer();
        } else {
            startTimer();
        }
    });

    resetBtn.addEventListener("click", resetTimer);
    skipBtn.addEventListener("click", skipTimer);

    // Mode trigger buttons
    modeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const targetMode = e.target.getAttribute("data-mode");
            changeMode(targetMode);
        });
    });

    // Initialize Page
    initMockStatsIfEmpty();
    changeMode("work");
    renderStats();
    
    // Lucide Icon Draw
    lucide.createIcons();
});
