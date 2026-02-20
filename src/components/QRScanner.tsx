import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

const READER_ID = 'safesphere-qr-reader';

interface QRScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan?: (data: string) => void;
}

interface RescueCenter {
    id: string;
    name: string;
    type: 'hospital' | 'police' | 'fire' | 'shelter';
    address: string;
    phone: string;
    distance: string;
    status: 'available' | 'busy' | 'full';
}

const RESCUE_CENTERS: RescueCenter[] = [
    { id: 'SAFESPHERE-RC-001', name: 'City General Hospital', type: 'hospital', address: '123 Health Street, Medical District', phone: '+1 (555) 0123', distance: '0.8 km', status: 'available' },
    { id: 'SAFESPHERE-RC-002', name: 'Community Emergency Center', type: 'shelter', address: '456 Community Blvd, Downtown', phone: '+1 (555) 0124', distance: '1.2 km', status: 'available' },
    { id: 'SAFESPHERE-RC-003', name: 'Central Police Station', type: 'police', address: '789 Safety Avenue, Government Quarter', phone: '911 / +1 (555) 0125', distance: '1.5 km', status: 'available' },
    { id: 'SAFESPHERE-RC-004', name: 'Fire Station #4', type: 'fire', address: '321 Rescue Road, Fire District', phone: '911 / +1 (555) 0126', distance: '2.1 km', status: 'available' },
    { id: 'SAFESPHERE-RC-005', name: 'Memorial Hospital', type: 'hospital', address: '555 Medical Center Drive', phone: '+1 (555) 0127', distance: '3.4 km', status: 'busy' },
    { id: 'SAFESPHERE-RC-006', name: 'Emergency Shelter - North', type: 'shelter', address: '777 North Street, Civic Center', phone: '+1 (555) 0128', distance: '4.2 km', status: 'available' },
];

function parseScannedData(data: string): { type: 'rescue' | 'url' | 'resource' | 'generic'; payload: RescueCenter | string } {
    const trimmed = data.trim();

    const rescue = RESCUE_CENTERS.find(r => r.id === trimmed);
    if (rescue) return { type: 'rescue', payload: rescue };

    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.id !== 'undefined' && parsed.type === 'resource') {
            return { type: 'resource', payload: `Resource #${parsed.id}` };
        }
    } catch { /* not JSON */ }

    if (/^https?:\/\//i.test(trimmed)) {
        return { type: 'url', payload: trimmed };
    }

    return { type: 'generic', payload: trimmed };
}

async function safeStop(instance: Html5Qrcode | null): Promise<void> {
    if (!instance) return;
    try {
        const state = instance.getState();
        // 2 = SCANNING, 3 = PAUSED
        if (state === 2 || state === 3) {
            await instance.stop();
        }
    } catch {
        // Already stopped or transitional state
    }
}

function cleanupReaderDOM() {
    const el = document.getElementById(READER_ID);
    if (!el) return;
    // html5-qrcode injects <video> and <canvas> — remove them so the next
    // instance can start fresh, but keep the container div itself intact.
    while (el.firstChild) el.removeChild(el.firstChild);
}

const QRScanner: React.FC<QRScannerProps> = ({ isOpen, onClose, onScan }) => {
    const { t } = useLanguage();
    const [scanning, setScanning] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [rescueCenter, setRescueCenter] = useState<RescueCenter | null>(null);
    const [genericContent, setGenericContent] = useState<string | null>(null);
    const [scanResultType, setScanResultType] = useState<'rescue' | 'url' | 'resource' | 'generic' | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const html5QrRef = useRef<Html5Qrcode | null>(null);
    const mountedRef = useRef(true);
    const startingRef = useRef(false);
    const onScanRef = useRef(onScan);

    useEffect(() => { onScanRef.current = onScan; }, [onScan]);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const startCamera = useCallback(async () => {
        if (startingRef.current) return;
        startingRef.current = true;

        try {
            // 1. Tear down any previous instance
            await safeStop(html5QrRef.current);
            html5QrRef.current = null;
            cleanupReaderDOM();

            if (!mountedRef.current) return;

            // 2. Wait for the reader div to be fully rendered with layout
            await new Promise(r => setTimeout(r, 250));
            if (!mountedRef.current) return;

            const el = document.getElementById(READER_ID);
            if (!el) {
                if (mountedRef.current) {
                    setCameraError(t('scannerElementNotFound'));
                    setScanning(false);
                }
                return;
            }

            // 3. Responsive QR box — 70% of container width, capped at 250px
            const containerWidth = el.clientWidth || 300;
            const qrBoxSize = Math.min(Math.floor(containerWidth * 0.70), 250);

            // 4. Create instance
            const html5Qr = new Html5Qrcode(READER_ID, { verbose: false });
            html5QrRef.current = html5Qr;

            const scanConfig = {
                fps: 10,
                qrbox: { width: qrBoxSize, height: qrBoxSize },
                disableFlip: false,
            };

            let scanned = false;
            const onSuccess = (decodedText: string) => {
                if (scanned) return;
                scanned = true;

                // Stop camera then process result
                safeStop(html5Qr).then(() => {
                    html5QrRef.current = null;
                });

                if (!mountedRef.current) return;

                const result = parseScannedData(decodedText);
                setScanning(false);
                setScannedData(decodedText);
                setScanResultType(result.type);
                if (result.type === 'rescue') {
                    setRescueCenter(result.payload as RescueCenter);
                } else {
                    setGenericContent(typeof result.payload === 'string' ? result.payload : decodedText);
                }
                onScanRef.current?.(decodedText);
            };

            // 5. Start camera — try rear first, then front, then any available device
            //    Do NOT call getCameras() beforehand; it triggers a separate permission
            //    prompt that conflicts with the start() call on many browsers.
            let started = false;

            // Attempt A: rear camera via facingMode constraint
            if (!started) {
                try {
                    await html5Qr.start(
                        { facingMode: 'environment' },
                        scanConfig,
                        onSuccess,
                        () => {}
                    );
                    started = true;
                } catch {
                    // Rear camera unavailable or constraint rejected
                }
            }

            // Attempt B: front camera
            if (!started) {
                try {
                    await html5Qr.start(
                        { facingMode: 'user' },
                        scanConfig,
                        onSuccess,
                        () => {}
                    );
                    started = true;
                } catch {
                    // Front camera also failed
                }
            }

            // Attempt C: enumerate devices and try the first available camera
            if (!started) {
                try {
                    const cameras = await Html5Qrcode.getCameras();
                    if (cameras && cameras.length > 0) {
                        await html5Qr.start(
                            cameras[0].id,
                            scanConfig,
                            onSuccess,
                            () => {}
                        );
                        started = true;
                    }
                } catch {
                    // Final attempt also failed
                }
            }

            if (!started) {
                throw new Error('Could not access any camera on this device.');
            }

        } catch (err) {
            if (!mountedRef.current) return;
            const msg = err instanceof Error ? err.message : String(err);

            let friendlyMsg = msg || t('cameraAccessFailed');
            if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
                friendlyMsg = 'Camera permission denied. Please allow camera access in your browser settings and try again.';
            } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
                friendlyMsg = 'No camera found. Please connect a camera or use a device with a built-in camera.';
            } else if (msg.includes('NotReadableError') || msg.includes('Could not start')) {
                friendlyMsg = 'Camera is in use by another application. Please close other apps using the camera and try again.';
            } else if (msg.includes('InsecureContext') || msg.includes('Only secure origins')) {
                friendlyMsg = 'Camera requires HTTPS. Please use https:// or localhost.';
            }

            setCameraError(friendlyMsg);
            setScanning(false);
            html5QrRef.current = null;
        } finally {
            startingRef.current = false;
        }
    }, [t]);

    useEffect(() => {
        if (!isOpen) {
            safeStop(html5QrRef.current).then(() => {
                html5QrRef.current = null;
                cleanupReaderDOM();
            });
            return;
        }

        setCameraError(null);
        setScanning(true);
        setScannedData(null);
        setRescueCenter(null);
        setGenericContent(null);
        setScanResultType(null);

        const timerId = setTimeout(() => {
            if (mountedRef.current) startCamera();
        }, 300);

        return () => {
            clearTimeout(timerId);
            safeStop(html5QrRef.current).then(() => {
                html5QrRef.current = null;
                cleanupReaderDOM();
            });
        };
    }, [isOpen, startCamera]);

    const handleScanAgain = useCallback(() => {
        setScannedData(null);
        setRescueCenter(null);
        setGenericContent(null);
        setScanResultType(null);
        setCameraError(null);
        setScanning(true);
        setTimeout(() => {
            if (mountedRef.current) startCamera();
        }, 200);
    }, [startCamera]);

    const showToast = useCallback((msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 2500);
    }, []);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/90 z-50 transition-opacity duration-300" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md z-50">
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="relative p-5 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all"
                            aria-label={t('close')}
                        >
                            <Icons.X size={20} className="text-white" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                <Icons.QrCode size={22} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">{t('qrScanner')}</h2>
                                <p className="text-xs text-white/80">{t('scanSafesphereQrCodes')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-5">
                        {cameraError ? (
                            <div className="text-center py-6">
                                <Icons.AlertTriangle size={44} className="text-amber-500 mx-auto mb-3" />
                                <p className="text-gray-700 dark:text-gray-200 font-medium mb-2">{t('cameraAccessFailed')}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 px-2">{cameraError}</p>
                                <p className="text-xs text-gray-400 mb-4">{t('cameraHttpsHint')}</p>
                                <button
                                    onClick={handleScanAgain}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all inline-flex items-center gap-2"
                                >
                                    <Icons.RefreshCw size={16} />
                                    {t('tryAgain')}
                                </button>
                            </div>

                        ) : scanning && !scannedData ? (
                            <div className="space-y-3">
                                <div className="relative">
                                    <div
                                        id={READER_ID}
                                        className="rounded-2xl overflow-hidden bg-black w-full"
                                        style={{ minHeight: 280 }}
                                    />
                                    {/* Scanning overlay with animated corners */}
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className="w-[65%] aspect-square relative">
                                            <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-white rounded-tl-lg" />
                                            <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-white rounded-tr-lg" />
                                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-white rounded-bl-lg" />
                                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-white rounded-br-lg" />
                                            <div className="absolute left-0 right-0 h-0.5 bg-blue-400/80 animate-scan-line" />
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-sm text-gray-500 dark:text-gray-400">{t('positionQrInFrame')}</p>
                            </div>

                        ) : scannedData && (rescueCenter || genericContent !== null) ? (
                            <div className="space-y-4">
                                {rescueCenter ? (
                                    <>
                                        <div className="flex flex-col items-center py-3">
                                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                                <Icons.CheckCircle size={36} className="text-green-600" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('rescueCenterFound')}</h3>
                                            <p className="text-sm text-gray-500 text-center mb-3">{t('nearestEmergencyFacilityScanned')}</p>
                                            <div className="w-full bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 rounded-2xl p-4 border-2 border-blue-200 dark:border-blue-800">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                        rescueCenter.type === 'hospital' ? 'bg-red-100 text-red-700' :
                                                        rescueCenter.type === 'police' ? 'bg-blue-100 text-blue-700' :
                                                        rescueCenter.type === 'fire' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                        {rescueCenter.type === 'hospital' && <Icons.Heart size={13} />}
                                                        {rescueCenter.type === 'police' && <Icons.Shield size={13} />}
                                                        {rescueCenter.type === 'fire' && <Icons.Flame size={13} />}
                                                        {rescueCenter.type === 'shelter' && <Icons.Home size={13} />}
                                                        <span className="uppercase">{rescueCenter.type}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        <Icons.MapPin size={13} className="text-blue-600" />
                                                        {rescueCenter.distance}
                                                    </span>
                                                </div>
                                                <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">{rescueCenter.name}</h4>
                                                <div className="space-y-1.5 mb-3">
                                                    <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                        <Icons.MapPin size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                                        <span>{rescueCenter.address}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                        <Icons.Phone size={15} className="text-gray-400 flex-shrink-0" />
                                                        <a href={`tel:${rescueCenter.phone}`} className="text-blue-600 font-semibold hover:underline">
                                                            {rescueCenter.phone}
                                                        </a>
                                                    </div>
                                                </div>
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                    rescueCenter.status === 'available' ? 'bg-green-100 text-green-700' :
                                                    rescueCenter.status === 'busy' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    <div className={`w-2 h-2 rounded-full ${
                                                        rescueCenter.status === 'available' ? 'bg-green-500' :
                                                        rescueCenter.status === 'busy' ? 'bg-yellow-500' : 'bg-red-500'
                                                    } animate-pulse`} />
                                                    {rescueCenter.status.toUpperCase()}
                                                </div>
                                                <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                    <div className="text-xs text-gray-400">{t('qrCodeId')}</div>
                                                    <div className="font-mono text-xs text-gray-500 break-all">{scannedData}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={handleScanAgain}
                                                className="py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Icons.QrCode size={17} />
                                                {t('scanAgain')}
                                            </button>
                                            <a
                                                href={`tel:${rescueCenter.phone}`}
                                                className="py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Icons.Phone size={17} />
                                                {t('callNow')}
                                            </a>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-4">
                                        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Icons.CheckCircle size={30} className="text-blue-600" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">{t('qrCodeScanned')}</h3>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-3 font-mono text-sm text-gray-700 dark:text-gray-300 break-all max-h-32 overflow-auto">
                                            {genericContent}
                                        </div>
                                        {scanResultType === 'url' && genericContent && (
                                            <a
                                                href={genericContent}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-center hover:bg-blue-700 active:scale-95 transition-all mb-3"
                                            >
                                                {t('openUrl')}
                                            </a>
                                        )}
                                        {scanResultType === 'resource' && (
                                            <p className="text-sm text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-400 rounded-lg p-3 mb-3 text-center font-medium">
                                                {t('resourceDetectedNavigating')}
                                            </p>
                                        )}
                                        <button
                                            onClick={handleScanAgain}
                                            className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                                        >
                                            {t('scanAgain')}
                                        </button>
                                    </div>
                                )}
                                <button
                                    onClick={onClose}
                                    className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                                >
                                    {t('close')}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Toast notification */}
                {toastMsg && (
                    <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg animate-fade-in whitespace-nowrap">
                        {toastMsg}
                    </div>
                )}
            </div>

            {/* Scan-line animation */}
            <style>{`
                @keyframes scanLine {
                    0% { top: 0; }
                    50% { top: 100%; }
                    100% { top: 0; }
                }
                .animate-scan-line {
                    position: absolute;
                    animation: scanLine 2.5s ease-in-out infinite;
                }
                .border-3 { border-width: 3px; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.3s ease-out; }
            `}</style>
        </>
    );
};

export default QRScanner;
