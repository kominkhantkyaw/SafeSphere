/**
 * Face scan modal — opens camera (like QR Scanner) and detects a face.
 * On success calls onSuccess(). Uses Face Detector API when available, else fallback with manual continue.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

interface FaceScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const DETECT_FRAMES_REQUIRED = 12;
const DETECT_INTERVAL_MS = 100;

declare global {
    interface Window {
        FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
            detect: (source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
        };
    }
}

export const FaceScanModal: React.FC<FaceScanModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useLanguage();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [status, setStatus] = useState<'starting' | 'detecting' | 'success' | 'error'>('starting');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const faceCountRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    const stopCamera = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            stopCamera();
        };
    }, [stopCamera]);

    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            setStatus('starting');
            setErrorMessage(null);
            faceCountRef.current = 0;
            return;
        }

        let cancelled = false;
        const video = videoRef.current;

        (async () => {
            setStatus('starting');
            setErrorMessage(null);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                    },
                    audio: false,
                });
                if (cancelled || !mountedRef.current) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (video) {
                    video.srcObject = stream;
                    await video.play();
                }
                if (!mountedRef.current) return;
                setStatus('detecting');
                faceCountRef.current = 0;

                const hasFaceDetector = typeof window !== 'undefined' && 'FaceDetector' in window;

                if (hasFaceDetector && video) {
                    const FaceDetectorClass = (window as Window & { FaceDetector: typeof window.FaceDetector }).FaceDetector;
                    const detector = new FaceDetectorClass({ fastMode: true, maxDetectedFaces: 1 });

                    intervalRef.current = setInterval(async () => {
                        if (!mountedRef.current || !video || video.readyState < 2) return;
                        try {
                            const faces = await detector.detect(video);
                            if (faces.length > 0 && mountedRef.current) {
                                faceCountRef.current += 1;
                                if (faceCountRef.current >= DETECT_FRAMES_REQUIRED) {
                                    if (intervalRef.current) {
                                        clearInterval(intervalRef.current);
                                        intervalRef.current = null;
                                    }
                                    setStatus('success');
                                    onSuccess();
                                }
                            } else {
                                faceCountRef.current = 0;
                            }
                        } catch {
                            faceCountRef.current = 0;
                        }
                    }, DETECT_INTERVAL_MS);
                }
            } catch (err) {
                if (mountedRef.current) {
                    setStatus('error');
                    setErrorMessage((err as Error).message || t('biometricFailed'));
                }
            }
        })();

        return () => {
            cancelled = true;
            stopCamera();
        };
    }, [isOpen, onSuccess, t]);

    if (!isOpen) return null;

    const showFallbackButton = status === 'detecting' && typeof window !== 'undefined' && !('FaceDetector' in window);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
            <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label={t('cancel')}
            >
                <Icons.X size={24} />
            </button>

            <h2 className="text-white text-lg font-bold mb-2 mt-2">{t('faceIdButton')}</h2>
            <p className="text-white/80 text-sm mb-4 text-center">
                {typeof window !== 'undefined' && 'FaceDetector' in window
                    ? t('faceScanPrompt')
                    : t('faceScanPromptFallback')}
            </p>

            <div className="relative w-full max-w-sm aspect-[4/3] bg-black rounded-2xl overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: 'scaleX(-1)' }}
                />
                {status === 'success' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-green-500/30">
                        <Icons.ScanFace size={64} className="text-white" />
                    </div>
                )}
                {status === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/30 p-4">
                        <p className="text-white text-sm text-center">{errorMessage}</p>
                    </div>
                )}
            </div>

            {status === 'detecting' && (
                <p className="text-white/90 text-sm mt-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    {t('faceScanDetecting')}
                </p>
            )}

            {showFallbackButton && (
                <button
                    type="button"
                    onClick={() => {
                        setStatus('success');
                        onSuccess();
                    }}
                    className="mt-5 w-full max-w-sm py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                    {t('faceScanContinue')}
                </button>
            )}

            {status === 'error' && (
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-5 w-full max-w-sm py-3 rounded-xl border border-white/30 text-white font-semibold"
                >
                    {t('cancel')}
                </button>
            )}
        </div>
    );
};
