import React, { useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/** Play a short success chime using Web Audio API (no external audio files) */
function playSuccessSound(): void {
    try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
        const now = audioContext.currentTime;

        // Two-tone ascending chime (Duolingo-style)
        const playTone = (freq: number, start: number, duration: number, gain = 0.15) => {
            const osc = audioContext.createOscillator();
            const g = audioContext.createGain();
            osc.connect(g);
            g.connect(audioContext.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(gain, now + start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
            osc.start(now + start);
            osc.stop(now + start + duration);
        };
        playTone(523.25, 0, 0.12);      // C5
        playTone(659.25, 0.08, 0.14);    // E5
        playTone(783.99, 0.18, 0.2);     // G5
    } catch {
        // Silently fail if Web Audio not supported (e.g. autoplay blocked)
    }
}

const BALLOON_COLORS = ['#58cc02', '#1cb0f6', '#ff9600', '#ce82ff', '#ff4b4b'];
const CONFETTI_COLORS = ['#58cc02', '#1cb0f6', '#ff9600', '#ce82ff', '#ff4b4b', '#ffc800', '#7c8798'];

interface CelebrationOverlayProps {
    xpEarned: number;
    onComplete?: () => void;
    duration?: number;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
    xpEarned,
    onComplete,
    duration = 2200,
}) => {
    const { t } = useLanguage();
    const containerRef = useRef<HTMLDivElement>(null);
    const onCompleteRef = useRef(onComplete);

    const cleanup = useCallback(() => {
        onCompleteRef.current?.();
    }, []);

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        playSuccessSound();
        const timeoutId = setTimeout(cleanup, duration);
        return () => clearTimeout(timeoutId);
    }, [duration, cleanup]);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"
            aria-live="polite"
            aria-label={`Celebration! +${xpEarned} XP earned`}
        >
            {/* Semi-transparent overlay - allows seeing content behind */}
            <div className="absolute inset-0 bg-black/5" />

            {/* Balloons - Duolingo-style floating up */}
            <div className="absolute inset-0 overflow-hidden">
                {BALLOON_COLORS.map((color, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full opacity-90"
                        style={{
                            left: `${20 + i * 15}%`,
                            bottom: '-60px',
                            width: 36 + (i % 3) * 8,
                            height: 44 + (i % 3) * 10,
                            backgroundColor: color,
                            animation: `celebrationBalloonRise 2s ease-out ${i * 0.08}s forwards`,
                            transformOrigin: 'bottom center',
                            boxShadow: `inset -4px -4px 8px rgba(0,0,0,0.15), 2px 2px 6px rgba(0,0,0,0.1)`,
                        }}
                    />
                ))}
            </div>

            {/* Confetti burst - sparkles from center */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                {CONFETTI_COLORS.flatMap((color, i) =>
                    Array.from({ length: 3 }, (_, j) => {
                        const angle = (i * 51 + j * 17) * (Math.PI / 180);
                        const dist = 80 + j * 40;
                        return (
                            <div
                                key={`cf-${i}-${j}`}
                                className="absolute w-2 h-2 rounded-sm opacity-90"
                                style={{
                                    backgroundColor: color,
                                    animation: `celebrationConfettiBurst 1.4s ease-out ${(i + j) * 0.03}s forwards`,
                                    '--cf-x': `${Math.cos(angle) * dist}px`,
                                    '--cf-y': `${Math.sin(angle) * dist}px`,
                                } as React.CSSProperties}
                            />
                        );
                    })
                )}
            </div>

            {/* XP badge - prominent +XX XP */}
            <div
                className="relative z-10 flex flex-col items-center animate-celebrationPop"
                style={{ animationDuration: '0.5s' }}
            >
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-8 py-4 shadow-xl border-2 border-amber-200 flex flex-col items-center gap-1">
                    <span className="text-4xl font-black text-amber-500">+{xpEarned}</span>
                    <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">XP</span>
                </div>
                <p className="mt-3 text-sm font-bold text-gray-600 animate-pulse">{t('greatJob') || 'Great job!'}</p>
            </div>

            {/* Sparkle accents around the badge */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
                    <div
                        key={i}
                        className="absolute w-3 h-3 rounded-full bg-amber-300/80"
                        style={{
                            animation: `celebrationSparkle 1.2s ease-out ${i * 0.05}s forwards`,
                            transform: `rotate(${deg}deg) translateY(-80px)`,
                            opacity: 0,
                            ['--sparkle-deg' as string]: `${deg}deg`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};
