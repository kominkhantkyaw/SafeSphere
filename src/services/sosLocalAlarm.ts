/**
 * Local SOS alarm on the victim's device: audible + vibration (+ optional speech).
 * Web Bluetooth cannot stream voice to arbitrary nearby phones/TVs; this makes the
 * handset itself a strong local distress signal while BLE targets dedicated receivers.
 */

let audioCtx: AudioContext | null = null;
let beepTimer: ReturnType<typeof setInterval> | null = null;
let vibrateTimer: ReturnType<typeof setInterval> | null = null;
let speechSpokenForCoords = false;

function playBeep(ctx: AudioContext, destination: AudioNode): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    osc.connect(g);
    g.connect(destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.start(t);
    osc.stop(t + 0.2);
}

/** Start repeating alarm. Safe to call again (restarts cleanly). */
export function startSosLocalAlarm(): void {
    stopSosLocalAlarm();
    speechSpokenForCoords = false;

    try {
        if (typeof window === 'undefined') return;
        const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
        void audioCtx.resume().catch(() => {});

        const master = audioCtx.createGain();
        master.gain.value = 0.55;
        master.connect(audioCtx.destination);

        playBeep(audioCtx, master);
        beepTimer = setInterval(() => {
            if (!audioCtx || !master) return;
            playBeep(audioCtx, master);
            try {
                const o2 = audioCtx.createOscillator();
                const g2 = audioCtx.createGain();
                o2.type = 'sawtooth';
                o2.frequency.value = 1320;
                o2.connect(g2);
                g2.connect(master);
                const t = audioCtx.currentTime;
                g2.gain.setValueAtTime(0.001, t);
                g2.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
                g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
                o2.start(t);
                o2.stop(t + 0.14);
            } catch {
                /* ignore */
            }
        }, 420);
    } catch {
        /* ignore */
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            navigator.vibrate([500, 250, 500, 250, 800]);
            vibrateTimer = setInterval(() => {
                navigator.vibrate?.([400, 200, 400, 200, 600]);
            }, 3800);
        } catch {
            /* ignore */
        }
    }
}

/** Optional spoken location (runs once per SOS session when coords are known). */
export function announceSosLocationSpeech(lat: number, lng: number): void {
    if (speechSpokenForCoords) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    speechSpokenForCoords = true;
    try {
        const u = new SpeechSynthesisUtterance(
            `Emergency. I need help. My GPS coordinates are latitude ${lat.toFixed(4)}, longitude ${lng.toFixed(4)}.`
        );
        u.rate = 0.92;
        u.volume = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
    } catch {
        /* ignore */
    }
}

export function stopSosLocalAlarm(): void {
    if (beepTimer != null) {
        clearInterval(beepTimer);
        beepTimer = null;
    }
    if (vibrateTimer != null) {
        clearInterval(vibrateTimer);
        vibrateTimer = null;
    }
    try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(0);
    } catch {
        /* ignore */
    }
    try {
        window.speechSynthesis?.cancel();
    } catch {
        /* ignore */
    }
    if (audioCtx) {
        try {
            void audioCtx.close();
        } catch {
            /* ignore */
        }
        audioCtx = null;
    }
    speechSpokenForCoords = false;
}
