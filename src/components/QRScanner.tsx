import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';
import type { Resource } from '../types';
import { DOWNTOWN_YANGON } from '../constants';
import { fetchResources } from '../services/api';

const READER_ID = 'safesphere-qr-reader';
/** After the camera is live, wait this long then show nearby services (no real QR required). */
const NEARBY_REVEAL_AFTER_MS = 2800;
/**
 * Stop the camera if no QR is decoded within this window (battery / UX).
 * Change to `60 * 1000` for a 1-minute timeout.
 */
const QR_SCAN_IDLE_TIMEOUT_MS = 1 * 60 * 1000;

interface QRScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan?: (data: string) => void;
    /** Parent closes scanner and opens Resources tab (full list / map). */
    onViewAllResources?: () => void;
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

/** Demo QR payloads — Yangon, Myanmar (matches MOCK_RESOURCES themes). */
const RESCUE_CENTERS: RescueCenter[] = [
    { id: 'SAFESPHERE-RC-001', name: 'Yangon General Hospital (YGH)', type: 'hospital', address: 'Lanmadaw Street, Bahan Township, Yangon', phone: '+95 1 538 055', distance: '0.8 km', status: 'available' },
    { id: 'SAFESPHERE-RC-002', name: 'People\'s Park relief point', type: 'shelter', address: 'Dhammazedi Road, Bahan Township, Yangon', phone: '+95 9 450 123456', distance: '1.1 km', status: 'available' },
    { id: 'SAFESPHERE-RC-003', name: 'Kyauktada Township Police Station', type: 'police', address: 'Strand Road area, downtown Yangon', phone: '199', distance: '1.4 km', status: 'available' },
    { id: 'SAFESPHERE-RC-004', name: 'Yangon Region Fire Services', type: 'fire', address: 'Lanmadaw / downtown corridor, Yangon', phone: '191', distance: '1.9 km', status: 'available' },
    { id: 'SAFESPHERE-RC-005', name: 'Insein General Hospital', type: 'hospital', address: 'Insein Township, Yangon', phone: '+95 1 640 446', distance: '3.2 km', status: 'busy' },
    { id: 'SAFESPHERE-RC-006', name: 'Thuwunna evacuation site', type: 'shelter', address: 'Thingangyun Township, Yangon', phone: '+95 9 790 123456', distance: '4.0 km', status: 'available' },
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

type NearbySvcType = 'hospital' | 'police' | 'fire' | 'shelter';

function mapResourceType(rt: Resource['type']): NearbySvcType {
    return rt === 'medical' ? 'hospital' : rt;
}

interface NearbyListItem {
    id: number;
    name: string;
    type: NearbySvcType;
    address: string;
    phone: string;
    distanceLabel: string;
    sortKm: number;
}

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

const QRScanner: React.FC<QRScannerProps> = ({ isOpen, onClose, onScan, onViewAllResources }) => {
    const { t } = useLanguage();
    const [scanning, setScanning] = useState(false);
    const [scannedData, setScannedData] = useState<string | null>(null);
    const [rescueCenter, setRescueCenter] = useState<RescueCenter | null>(null);
    const [genericContent, setGenericContent] = useState<string | null>(null);
    const [scanResultType, setScanResultType] = useState<'rescue' | 'url' | 'resource' | 'generic' | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const [nearbyItems, setNearbyItems] = useState<NearbyListItem[]>([]);
    const [nearbyLoading, setNearbyLoading] = useState(false);
    const [nearbyLocNote, setNearbyLocNote] = useState<string | null>(null);
    /** Nearby list is only loaded and shown after the initial “scan” phase (timed), not immediately on open. */
    const [nearbyRevealed, setNearbyRevealed] = useState(false);
    const [scanIdleTimedOut, setScanIdleTimedOut] = useState(false);
    const html5QrRef = useRef<Html5Qrcode | null>(null);
    const mountedRef = useRef(true);
    const startingRef = useRef(false);
    const onScanRef = useRef(onScan);
    const scanIdleTimerRef = useRef<number | null>(null);
    const hasScanResultRef = useRef(false);

    const clearScanIdleTimer = useCallback(() => {
        if (scanIdleTimerRef.current != null) {
            clearTimeout(scanIdleTimerRef.current);
            scanIdleTimerRef.current = null;
        }
    }, []);

    useEffect(() => { onScanRef.current = onScan; }, [onScan]);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    /** Load nearby services only after `nearbyRevealed` (post-scan phase). */
    useEffect(() => {
        if (!isOpen || !nearbyRevealed) {
            if (!isOpen) {
                setNearbyItems([]);
                setNearbyLoading(false);
                setNearbyLocNote(null);
            }
            return;
        }
        let cancelled = false;
        setNearbyLoading(true);
        setNearbyLocNote(null);

        const run = async () => {
            try {
                const resources = await fetchResources();
                if (cancelled) return;

                let userLat: number | null = null;
                let userLng: number | null = null;
                await new Promise<void>((resolve) => {
                    if (!navigator.geolocation) {
                        resolve();
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            userLat = pos.coords.latitude;
                            userLng = pos.coords.longitude;
                            resolve();
                        },
                        () => {
                            resolve();
                        },
                        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
                    );
                });
                if (cancelled) return;

                // If GPS unavailable or denied, sort from downtown Yangon so distances stay local (Myanmar demo focus).
                if (userLat == null || userLng == null) {
                    userLat = DOWNTOWN_YANGON.lat;
                    userLng = DOWNTOWN_YANGON.lng;
                    if (!cancelled) setNearbyLocNote(t('qrNearbyYangonReference'));
                }

                const items: NearbyListItem[] = resources
                    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && !(r.lat === 0 && r.lng === 0))
                    .map((r) => {
                        let sortKm = 9999;
                        let distanceLabel = '—';
                        if (userLat != null && userLng != null) {
                            sortKm = haversineKm(userLat, userLng, r.lat, r.lng);
                            distanceLabel =
                                sortKm < 1 ? `${Math.round(sortKm * 1000)} m` : `${sortKm.toFixed(1)} km`;
                        } else if (r.distanceNum != null && Number.isFinite(r.distanceNum)) {
                            sortKm = r.distanceNum;
                            distanceLabel = r.distance || `${r.distanceNum.toFixed(1)} km`;
                        } else if (r.distance) {
                            distanceLabel = r.distance;
                        }
                        const phone = (r.phone || r.contactPhone || '').trim();
                        return {
                            id: r.id,
                            name: r.name,
                            type: mapResourceType(r.type),
                            address: r.address,
                            phone,
                            distanceLabel,
                            sortKm,
                        };
                    })
                    .sort((a, b) => a.sortKm - b.sortKm)
                    .slice(0, 8);

                if (!cancelled) setNearbyItems(items);
            } catch {
                if (!cancelled) setNearbyItems([]);
            } finally {
                if (!cancelled) setNearbyLoading(false);
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [isOpen, nearbyRevealed, t]);

    /** Simulate “scan complete” then reveal nearby list — real QR is optional. */
    useEffect(() => {
        if (!isOpen || !scanning || cameraError || scannedData || scanIdleTimedOut) return;
        const id = window.setTimeout(() => setNearbyRevealed(true), NEARBY_REVEAL_AFTER_MS);
        return () => clearTimeout(id);
    }, [isOpen, scanning, cameraError, scannedData, scanIdleTimedOut]);

    const startCamera = useCallback(async () => {
        if (startingRef.current) return;
        startingRef.current = true;
        clearScanIdleTimer();
        hasScanResultRef.current = false;

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
                hasScanResultRef.current = true;
                clearScanIdleTimer();

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

            hasScanResultRef.current = false;
            clearScanIdleTimer();
            scanIdleTimerRef.current = window.setTimeout(() => {
                void (async () => {
                    if (!mountedRef.current || hasScanResultRef.current) return;
                    await safeStop(html5QrRef.current);
                    html5QrRef.current = null;
                    cleanupReaderDOM();
                    if (!mountedRef.current || hasScanResultRef.current) return;
                    setScanning(false);
                    setScanIdleTimedOut(true);
                    setToastMsg(t('qrScannerNotFoundNotify'));
                    window.setTimeout(() => {
                        if (mountedRef.current) setToastMsg(null);
                    }, 4000);
                })();
            }, QR_SCAN_IDLE_TIMEOUT_MS);
        } catch (err) {
            clearScanIdleTimer();
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
    }, [t, clearScanIdleTimer]);

    useEffect(() => {
        if (!isOpen) {
            clearScanIdleTimer();
            safeStop(html5QrRef.current).then(() => {
                html5QrRef.current = null;
                cleanupReaderDOM();
            });
            return;
        }

        setCameraError(null);
        setScanIdleTimedOut(false);
        setScanning(true);
        setScannedData(null);
        setRescueCenter(null);
        setGenericContent(null);
        setScanResultType(null);
        setNearbyRevealed(false);

        const timerId = setTimeout(() => {
            if (mountedRef.current) startCamera();
        }, 300);

        return () => {
            clearTimeout(timerId);
            clearScanIdleTimer();
            safeStop(html5QrRef.current).then(() => {
                html5QrRef.current = null;
                cleanupReaderDOM();
            });
        };
    }, [isOpen, startCamera, clearScanIdleTimer]);

    const handleScanAgain = useCallback(() => {
        clearScanIdleTimer();
        setScanIdleTimedOut(false);
        setScannedData(null);
        setRescueCenter(null);
        setGenericContent(null);
        setScanResultType(null);
        setCameraError(null);
        setNearbyRevealed(false);
        setScanning(true);
        setTimeout(() => {
            if (mountedRef.current) startCamera();
        }, 200);
    }, [startCamera, clearScanIdleTimer]);

    const showToast = useCallback((msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 2500);
    }, []);

    const nearbyResultsSection =
        nearbyRevealed && !scannedData ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 p-3">
                <div className="mb-2">
                    <h3 className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                        {t('qrNearbyEmergencyTitle')}
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                        {t('qrNearbyEmergencyHint')}
                    </p>
                    {nearbyLocNote && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">{nearbyLocNote}</p>
                    )}
                </div>
                {nearbyLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-2">
                        <Icons.RefreshCw className="animate-spin flex-shrink-0" size={14} />
                        {t('qrNearbyLoading')}
                    </div>
                ) : nearbyItems.length > 0 ? (
                    <>
                        <ul className="max-h-40 overflow-y-auto space-y-2 pr-0.5 mb-2">
                            {nearbyItems.map((item) => (
                                <li
                                    key={item.id}
                                    className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/80 p-2.5"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <span
                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                                                item.type === 'hospital'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                                    : item.type === 'police'
                                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                      : item.type === 'fire'
                                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                                                        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                            }`}
                                        >
                                            {item.type === 'hospital' && <Icons.Heart size={11} />}
                                            {item.type === 'police' && <Icons.Shield size={11} />}
                                            {item.type === 'fire' && <Icons.Flame size={11} />}
                                            {item.type === 'shelter' && <Icons.Home size={11} />}
                                            <span className="uppercase">{item.type}</span>
                                        </span>
                                        <span className="flex items-center gap-0.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0">
                                            <Icons.MapPin size={11} className="text-blue-600" />
                                            {item.distanceLabel}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight mb-1">
                                        {item.name}
                                    </p>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug mb-1">
                                        {item.address}
                                    </p>
                                    {item.phone ? (
                                        <a
                                            href={`tel:${item.phone}`}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                                        >
                                            <Icons.Phone size={12} />
                                            {item.phone}
                                        </a>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                        {onViewAllResources ? (
                            <button
                                type="button"
                                onClick={onViewAllResources}
                                className="w-full py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors"
                            >
                                {t('qrNearbyOpenResources')}
                            </button>
                        ) : null}
                    </>
                ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 py-1">{t('qrNearbyEmpty')}</p>
                )}
            </div>
        ) : null;

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
                                <div className="flex flex-col sm:flex-row gap-2 justify-center items-stretch sm:items-center">
                                    <button
                                        onClick={handleScanAgain}
                                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
                                    >
                                        <Icons.RefreshCw size={16} />
                                        {t('tryAgain')}
                                    </button>
                                    {!nearbyRevealed && (
                                        <button
                                            type="button"
                                            onClick={() => setNearbyRevealed(true)}
                                            className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
                                        >
                                            <Icons.MapPin size={16} />
                                            {t('qrNearbyShowAnyway')}
                                        </button>
                                    )}
                                </div>
                                {nearbyResultsSection}
                            </div>

                        ) : scanIdleTimedOut && !scannedData ? (
                            <div className="text-center py-6 space-y-3">
                                <Icons.Pause size={44} className="text-amber-500 mx-auto mb-1" />
                                <p className="text-gray-900 dark:text-white font-bold text-lg">{t('qrScannerNotFoundTitle')}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 px-1 leading-relaxed">
                                    {t('qrScannerNotFoundSubtitle')}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 justify-center items-stretch sm:items-center pt-2">
                                    <button
                                        type="button"
                                        onClick={handleScanAgain}
                                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
                                    >
                                        <Icons.RefreshCw size={16} />
                                        {t('tryAgain')}
                                    </button>
                                    {!nearbyRevealed && (
                                        <button
                                            type="button"
                                            onClick={() => setNearbyRevealed(true)}
                                            className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
                                        >
                                            <Icons.MapPin size={16} />
                                            {t('qrNearbyShowAnyway')}
                                        </button>
                                    )}
                                </div>
                                {nearbyResultsSection}
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
                                <p className="text-center text-sm text-gray-500 dark:text-gray-400">{t('qrScannerNearbyAfterScan')}</p>
                                <p className="text-center text-xs text-gray-400 dark:text-gray-500">{t('positionQrInFrame')}</p>
                                {nearbyResultsSection}
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
