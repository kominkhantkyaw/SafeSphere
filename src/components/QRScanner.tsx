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

    // Match rescue center ID
    const rescue = RESCUE_CENTERS.find(r => r.id === trimmed);
    if (rescue) return { type: 'rescue', payload: rescue };

    // Match SafeSphere resource JSON: {"id":...,"type":"resource"}
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.id !== 'undefined' && parsed.type === 'resource') {
            return { type: 'resource', payload: `Resource #${parsed.id}` };
        }
    } catch { /* not JSON */ }

    // URL
    if (/^https?:\/\//i.test(trimmed)) {
        return { type: 'url', payload: trimmed };
    }

    return { type: 'generic', payload: trimmed };
}

/** Safely stop a running Html5Qrcode instance, awaiting completion. */
async function safeStop(instance: Html5Qrcode | null): Promise<void> {
    if (!instance) return;
    try {
        const state = instance.getState();
        // States: NOT_STARTED = 1, SCANNING = 2, PAUSED = 3
        if (state === 2 || state === 3) {
            await instance.stop();
        }
    } catch {
        // Already stopped or in a transitional state — ignore
    }
}

const QRScanner: React.FC<QRScannerProps> = ({ isOpen, onClose, onScan }) => {
    const { t } = useLanguage();
    const [scanning, setScanning] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [rescueCenter, setRescueCenter] = useState<RescueCenter | null>(null);
    const [genericContent, setGenericContent] = useState<string | null>(null);
    const [scanResultType, setScanResultType] = useState<'rescue' | 'url' | 'resource' | 'generic' | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const html5QrRef = useRef<Html5Qrcode | null>(null);
    const mountedRef = useRef(true);
    const readerElRef = useRef<HTMLDivElement | null>(null);

    // Track mounted state for safe async updates
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const startCamera = useCallback(async () => {
        // Wait for the DOM element — use the ref directly
        const element = readerElRef.current || document.getElementById(READER_ID);
        if (!element) {
            if (mountedRef.current) {
                setCameraError(t('scannerElementNotFound'));
                setScanning(false);
            }
            return;
        }

        // Ensure any previous instance is fully stopped before creating a new one
        await safeStop(html5QrRef.current);
        html5QrRef.current = null;

        if (!mountedRef.current) return;

        try {
            const html5Qr = new Html5Qrcode(READER_ID);
            html5QrRef.current = html5Qr;

            const scanConfig = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 };

            const onSuccess = (decodedText: string) => {
                safeStop(html5Qr).then(() => {
                    html5QrRef.current = null;
                });
                if (!mountedRef.current) return;
                setScanning(false);
                const result = parseScannedData(decodedText);
                setScannedData(decodedText);
                setScanResultType(result.type);
                if (result.type === 'rescue') {
                    setRescueCenter(result.payload as RescueCenter);
                } else {
                    setGenericContent(typeof result.payload === 'string' ? result.payload : decodedText);
                }
                onScan?.(decodedText);
            };

            // Try rear camera first (mobile), fall back to front camera (desktop/laptop)
            try {
                await html5Qr.start(
                    { facingMode: { ideal: 'environment' } },
                    scanConfig,
                    onSuccess,
                    () => {}
                );
            } catch {
                // Rear camera failed — try front camera
                try {
                    await html5Qr.start(
                        { facingMode: 'user' },
                        scanConfig,
                        onSuccess,
                        () => {}
                    );
                } catch (innerErr) {
                    throw innerErr; // Let the outer catch handle the final error
                }
            }
        } catch (err) {
            if (!mountedRef.current) return;
            const msg = err instanceof Error ? err.message : String(err);
            setCameraError(msg || t('cameraAccessFailed'));
            setScanning(false);
            html5QrRef.current = null;
        }
    }, [onScan, t]);

    // Open / close effect
    useEffect(() => {
        if (!isOpen) {
            safeStop(html5QrRef.current).then(() => {
                html5QrRef.current = null;
            });
            return;
        }

        // Reset state when opening
        setCameraError(null);
        setScanning(true);
        setScannedData(null);
        setRescueCenter(null);
        setGenericContent(null);
        setScanResultType(null);

        // Give React one frame to render the <div id={READER_ID}> before starting
        const rafId = requestAnimationFrame(() => {
            startCamera();
        });

        return () => {
            cancelAnimationFrame(rafId);
            safeStop(html5QrRef.current).then(() => {
                html5QrRef.current = null;
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
        // One frame delay so the reader div is rendered before we access it
        requestAnimationFrame(() => {
            startCamera();
        });
    }, [startCamera]);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/90 z-50 transition-opacity duration-300" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md z-50">
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    <div className="relative p-6 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30"
                            aria-label={t('close')}
                        >
                            <Icons.X size={20} className="text-white" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                <Icons.QrCode size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{t('qrScanner')}</h2>
                                <p className="text-sm text-white/80">{t('scanSafesphereQrCodes')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {cameraError ? (
                            <div className="text-center py-8">
                                <Icons.AlertTriangle size={48} className="text-amber-500 mx-auto mb-4" />
                                <p className="text-gray-700 font-medium mb-2">{t('cameraAccessFailed')}</p>
                                <p className="text-sm text-gray-500 mb-4">{cameraError}</p>
                                <p className="text-xs text-gray-400 mb-4">{t('cameraHttpsHint')}</p>
                                <button
                                    onClick={handleScanAgain}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 inline-flex items-center gap-2"
                                >
                                    <Icons.RefreshCw size={16} />
                                    {t('tryAgain')}
                                </button>
                            </div>
                        ) : scanning && !scannedData ? (
                            <div className="space-y-4">
                                <div
                                    id={READER_ID}
                                    ref={readerElRef}
                                    className="rounded-2xl overflow-hidden bg-black min-h-[250px]"
                                />
                                <p className="text-center text-sm text-gray-600">{t('positionQrInFrame')}</p>
                            </div>
                        ) : scannedData && (rescueCenter || genericContent !== null) ? (
                            <div className="space-y-4">
                                {rescueCenter ? (
                                    <>
                                        <div className="flex flex-col items-center py-4">
                                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                                <Icons.CheckCircle size={40} className="text-green-600" />
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 mb-1">{t('rescueCenterFound')}</h3>
                                            <p className="text-sm text-gray-600 text-center mb-4">{t('nearestEmergencyFacilityScanned')}</p>
                                            <div className="w-full bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-5 border-2 border-blue-200">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                                        rescueCenter.type === 'hospital' ? 'bg-red-100 text-red-700' :
                                                        rescueCenter.type === 'police' ? 'bg-blue-100 text-blue-700' :
                                                        rescueCenter.type === 'fire' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                        {rescueCenter.type === 'hospital' && <Icons.Heart size={14} />}
                                                        {rescueCenter.type === 'police' && <Icons.Shield size={14} />}
                                                        {rescueCenter.type === 'fire' && <Icons.Flame size={14} />}
                                                        {rescueCenter.type === 'shelter' && <Icons.Home size={14} />}
                                                        <span className="uppercase">{rescueCenter.type}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1 text-sm font-semibold text-gray-700">
                                                        <Icons.MapPin size={14} className="text-blue-600" />
                                                        {rescueCenter.distance}
                                                    </span>
                                                </div>
                                                <h4 className="text-lg font-bold text-gray-900 mb-3">{rescueCenter.name}</h4>
                                                <div className="space-y-2 mb-4">
                                                    <div className="flex items-start gap-2 text-sm text-gray-700">
                                                        <Icons.MapPin size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
                                                        <span>{rescueCenter.address}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-gray-700">
                                                        <Icons.Phone size={16} className="text-gray-500 flex-shrink-0" />
                                                        <a href={`tel:${rescueCenter.phone}`} className="text-blue-600 font-semibold hover:underline">
                                                            {rescueCenter.phone}
                                                        </a>
                                                    </div>
                                                </div>
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
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
                                                <div className="mt-4 pt-3 border-t border-gray-200">
                                                    <div className="text-xs text-gray-500">{t('qrCodeId')}</div>
                                                    <div className="font-mono text-xs text-gray-600 break-all">{scannedData}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={handleScanAgain}
                                                className="py-3 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 flex items-center justify-center gap-2"
                                            >
                                                <Icons.QrCode size={18} />
                                                {t('scanAgain')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(rescueCenter.phone).catch(() => {});
                                                    alert(t('phoneNumberCopied'));
                                                }}
                                                className="py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
                                            >
                                                <Icons.Phone size={18} />
                                                {t('callNow')}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-6">
                                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Icons.CheckCircle size={32} className="text-blue-600" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{t('qrCodeScanned')}</h3>
                                        <div className="bg-gray-50 rounded-xl p-4 mb-4 font-mono text-sm text-gray-700 break-all">
                                            {genericContent}
                                        </div>
                                        {scanResultType === 'url' && genericContent && (
                                            <a
                                                href={genericContent}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-center hover:bg-blue-700 mb-3"
                                            >
                                                {t('openUrl')}
                                            </a>
                                        )}
                                        {scanResultType === 'resource' && (
                                            <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3 mb-3 text-center font-medium">
                                                {t('resourceDetectedNavigating')}
                                            </p>
                                        )}
                                        <button
                                            onClick={handleScanAgain}
                                            className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300"
                                        >
                                            {t('scanAgain')}
                                        </button>
                                    </div>
                                )}
                                <button onClick={onClose} className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300">
                                    {t('close')}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    );
};

export default QRScanner;
