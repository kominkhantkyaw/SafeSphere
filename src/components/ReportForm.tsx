import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icon';
import { submitReport } from '../services/api';
import { IncidentReport } from '../types';
import { getRandomFloodZoneYangon } from '../constants';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import IncidentMap from './IncidentMap';
import { getPrintableOsmMapTiles } from '../utils/printMapTiles';

interface ReportFormProps {
    onCancel: () => void;
    onSuccess: () => void;
    initialData?: IncidentReport | null;
}

type Step = 'EDIT' | 'REVIEW' | 'SUCCESS';

const ReportForm: React.FC<ReportFormProps> = ({ onCancel, onSuccess, initialData }) => {
    const { user } = useUser();
    const { t } = useLanguage();
    const [step, setStep] = useState<Step>('EDIT');
    const [loading, setLoading] = useState(false);
    const [submittedId, setSubmittedId] = useState<string | null>(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [includeMapInPrint, setIncludeMapInPrint] = useState(true);
    const [printSeq, setPrintSeq] = useState(0);

    // -- Form State --
    const [type, setType] = useState('Structural Fire');
    const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
    const [department, setDepartment] = useState('Main Building');
    const [description, setDescription] = useState('');
    
    // Contact Info (Optional)
    const [contactPerson, setContactPerson] = useState('');
    const [countryCode, setCountryCode] = useState('+43');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');

    /** Combined phone for display and submission, e.g. "+43 6601234567" */
    const fullPhone = contactPhone ? `${countryCode} ${contactPhone}` : '';

    // Advanced
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [structuralDamage, setStructuralDamage] = useState('None');
    const [repairDays, setRepairDays] = useState<number>(0);
    const [cost, setCost] = useState<number>(0);
    const [repeatable, setRepeatable] = useState(false);
    const [discussed, setDiscussed] = useState(false);
    const [mitigation, setMitigation] = useState('');

    // Location — includeGpsMap false = submit with site description only (no map / GPS payload).
    const [includeGpsMap, setIncludeGpsMap] = useState(false);
    const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
    const [locating, setLocating] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const lastLocationRef = useRef<{lat: number, lng: number} | null>(null);

    // Media
    const [image, setImage] = useState<string | null>(null); // Base64 or Blob URL
    const [video, setVideo] = useState<string | null>(null);
    const [audio, setAudio] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (initialData) {
            setType(initialData.type);
            setUrgency(initialData.urgency || 'Medium');
            setDepartment(initialData.department || 'Main Building');
            setDescription(initialData.description);
            const siteOnly =
                initialData.locationSource === 'site_only' ||
                (initialData.lat === 0 && initialData.lng === 0 && initialData.locationSource !== 'gps');
            if (siteOnly) {
                setIncludeGpsMap(false);
                setLocation(null);
            } else {
                setIncludeGpsMap(true);
                setLocation({ lat: initialData.lat, lng: initialData.lng });
            }
            setStructuralDamage(initialData.structuralDamage || 'None');
            setRepairDays(initialData.estRepairDays || 0);
            setCost(initialData.estCost || 0);
            setRepeatable(initialData.repeatable || false);
            setDiscussed(initialData.situationDiscussed || false);
            setMitigation(initialData.mitigationPlan || '');
            setContactPerson(initialData.contactPerson || '');
            // Parse country code from existing phone (e.g. "+43 6601234567")
            if (initialData.contactPhone) {
                const phoneMatch = initialData.contactPhone.match(/^(\+\d{1,4})\s*(.*)$/);
                if (phoneMatch) {
                    setCountryCode(phoneMatch[1]);
                    setContactPhone(phoneMatch[2]);
                } else {
                    setContactPhone(initialData.contactPhone);
                }
            }
            if (initialData.contactEmail) setContactEmail(initialData.contactEmail);
            if (initialData.image) setImage(initialData.image);
            if (initialData.video) setVideo(initialData.video);
            if (initialData.audio) setAudio(initialData.audio);
            if (initialData.structuralDamage || initialData.estRepairDays || initialData.estCost) setShowAdvanced(true);
        }
    }, [initialData]);

    useEffect(() => {
        if (printSeq === 0) return;
        window.print();
    }, [printSeq]);

    const stampSyncTime = useCallback(() => {
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, []);

    const refreshLocation = useCallback((useCache = false) => {
        if (!('geolocation' in navigator)) return;
        setLocating(true);
        const timeoutMs = useCache ? 5000 : 15000;
        const opts: PositionOptions = useCache
            ? { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300000 }
            : { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 };

        let finished = false;
        let timeoutId: number | null = null;

        const fallbackToReasonableLocation = () => {
            if (lastLocationRef.current) {
                setLocation(lastLocationRef.current);
                stampSyncTime();
                return;
            }
            if (type.toLowerCase().includes('flood')) {
                const floodZone = getRandomFloodZoneYangon();
                setLocation(floodZone);
                lastLocationRef.current = floodZone;
                stampSyncTime();
                return;
            }
            // Final fallback: keep the form usable even when GPS is blocked.
            const fallback = { lat: 16.866, lng: 96.195 };
            setLocation(fallback);
            lastLocationRef.current = fallback;
            stampSyncTime();
        };

        const finish = (fn: () => void) => {
            if (finished) return;
            finished = true;
            if (timeoutId != null) window.clearTimeout(timeoutId);
            fn();
        };

        // If the browser never calls the GPS callbacks, avoid leaving the UI stuck in "Waiting".
        timeoutId = window.setTimeout(() => {
            finish(() => {
                if (!useCache) {
                    refreshLocation(true);
                    return;
                }
                setLocating(false);
                fallbackToReasonableLocation();
            });
        }, timeoutMs + 1500);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                finish(() => {
                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setLocation(coords);
                    lastLocationRef.current = coords;
                    stampSyncTime();
                    setLocating(false);
                });
            },
            () => {
                finish(() => {
                    if (!useCache) {
                        refreshLocation(true);
                        return;
                    }
                    setLocating(false);
                    fallbackToReasonableLocation();
                });
            },
            opts
        );
    }, [type, stampSyncTime]);

    const handleGetLocation = () => refreshLocation();

    const handleLocationUpdate = useCallback((lat: number, lng: number) => {
        const coords = { lat, lng };
        setLocation((prev) => prev ? { ...prev, ...coords } : coords);
        lastLocationRef.current = coords;
        setLocating(false);
    }, []);

    // Auto-sync GPS (watchPosition) is intentionally disabled.
    // The incident location should be pinned by the user (map click) or confirmed via the manual "Sync GPS" button.

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImage(reader.result as string);
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setVideo(URL.createObjectURL(file));
        e.target.value = '';
    };

    const openCamera = async () => {
        try {
            const constraints: MediaStreamConstraints = { video: { facingMode: 'environment' }, audio: false };
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }
            streamRef.current = stream;
            setShowCamera(true);
        } catch (err) {
            alert(t('cameraAccessDenied'));
        }
    };

    const closeCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCapturedPhoto(null);
        setCameraReady(false);
        setShowCamera(false);
        if (!location && lastLocationRef.current) setLocation(lastLocationRef.current);
        refreshLocation();
    };

    const takePhoto = () => {
        const videoEl = videoRef.current;
        const stream = streamRef.current;
        if (!videoEl || !stream) {
            alert(t('cameraNotReady'));
            return;
        }
        const w = videoEl.videoWidth || 640;
        const h = videoEl.videoHeight || 480;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        try {
            ctx.drawImage(videoEl, 0, 0, w, h);
        } catch (err) {
            alert(t('captureFrameFailed'));
            return;
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCapturedPhoto(dataUrl);
    };

    const handleVideoLoaded = () => {
        setCameraReady(true);
    };

    const savePhoto = () => {
        if (capturedPhoto) setImage(capturedPhoto);
        setCapturedPhoto(null);
        setShowCamera(false);
        if (!location && lastLocationRef.current) setLocation(lastLocationRef.current);
        refreshLocation();
    };

    const retakePhoto = async () => {
        setCapturedPhoto(null);
        setCameraReady(false);
        try {
            const constraints: MediaStreamConstraints = { video: { facingMode: 'environment' }, audio: false };
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            alert(t('cameraAccessDenied'));
        }
    };

    useEffect(() => {
        if (!showCamera || capturedPhoto) return;
        const videoEl = videoRef.current;
        const stream = streamRef.current;
        if (videoEl && stream) {
            videoEl.srcObject = stream;
            const fallback = setTimeout(() => setCameraReady(true), 2000);
            return () => {
                clearTimeout(fallback);
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            };
        }
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };
    }, [showCamera, capturedPhoto]);

    const toggleAudioRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];
                mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                    setAudio(URL.createObjectURL(audioBlob));
                };
                mediaRecorder.start();
                setIsRecording(true);
            } catch (err) { alert(t('microphoneAccessDenied')); }
        }
    };

    const handleSubmit = async () => {
        if (includeGpsMap && !location) {
            alert(t('pleaseIncludeLocation'));
            return;
        }

        setLoading(true);
        try {
            const newId =
                initialData?.id != null ? String(initialData.id) : String(Math.floor(Math.random() * 100000));
            const reportData: Partial<IncidentReport> = {
                id: newId,
                type,
                urgency,
                department,
                description,
                structuralDamage,
                estRepairDays: repairDays,
                estCost: cost,
                repeatable,
                situationDiscussed: discussed,
                mitigationPlan: mitigation,
                lat: includeGpsMap && location ? location.lat : 0,
                lng: includeGpsMap && location ? location.lng : 0,
                locationSource: includeGpsMap && location ? 'gps' : 'site_only',
                contactPerson,
                contactPhone: fullPhone,
                contactEmail: contactEmail || undefined,
                timestamp: initialData?.timestamp || new Date().toLocaleTimeString(),
                image: image || undefined,
                video: video || undefined,
                audio: audio || undefined,
                reporterId: user?.id,
                // Keep pending / info_requested (etc.) when reporter updates before responder approval.
                status: initialData?.status,
            };

            const success = await submitReport(reportData);
            if (success) {
                setSubmittedId(newId);
                setStep('SUCCESS');
            } else {
                alert(t('failedToSubmit'));
            }
        } catch (err) {
            console.error('[ReportForm] submit failed:', err);
            alert(t('failedToSubmit'));
        } finally {
            setLoading(false);
        }
    };

    const requestPrint = useCallback((withMap: boolean) => {
        setIncludeMapInPrint(withMap);
        setPrintSeq((s) => s + 1);
    }, []);

    const handleShare = async () => {
        const shareUrl = submittedId ? `${window.location.origin}/report/${submittedId}` : window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: `Incident #${submittedId}: ${type}`, text: description, url: shareUrl }); } catch (err) { console.log('Error sharing', err); }
        } else { navigator.clipboard.writeText(shareUrl); alert(t('reportLinkCopied')); }
    };

    const renderHeader = (title: string, icon: React.ReactNode) => (
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">{icon} {title}</h2>
            {step === 'EDIT' && (
                <button
                    type="button"
                    onClick={onCancel}
                    title={t('closeButton')}
                    aria-label={t('closeButton')}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                    <Icons.X size={20} />
                </button>
            )}
        </div>
    );

    if (step === 'REVIEW') {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 h-full overflow-y-auto">
                {renderHeader(t('reviewReport'), <Icons.FileText className="text-blue-500" size={24} />)}
                <div className="space-y-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">{t('hazardType')}:</span> <span className="font-bold">{type}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{t('urgencyLabel')}:</span> <span className={`font-bold ${urgency === 'Critical' ? 'text-red-600' : 'text-black'}`}>{urgency}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">{t('incidentLocation')}:</span> <span className="font-bold">{department}</span></div>
                        <div className="flex justify-between gap-2">
                            <span className="text-gray-500 shrink-0">{t('gpsLabel')}:</span>
                            <span className={`font-mono text-right text-xs sm:text-sm ${includeGpsMap && location ? '' : 'text-amber-700 font-sans font-semibold'}`}>
                                {includeGpsMap && location
                                    ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
                                    : t('reportGpsNotIncluded')}
                            </span>
                        </div>
                    </div>
                    {includeGpsMap && location && typeof window !== 'undefined' && window.L && (
                        <div className="rounded-xl overflow-hidden border border-gray-200">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">{t('incidentLocationMap')}</p>
                            <div className="w-full aspect-[4/3] min-h-[200px]">
                                <IncidentMap reports={[{ id: '0', lat: location.lat, lng: location.lng, type, description, timestamp: new Date().toLocaleTimeString(), status: 'pending' }]} centerLat={location.lat} centerLng={location.lng} />
                            </div>
                        </div>
                    )}
                    
                    {(contactPerson || fullPhone || contactEmail) && (
                        <div className="bg-blue-50 p-4 rounded-xl space-y-2 text-sm border border-blue-100">
                             <h3 className="text-xs font-bold text-blue-600 uppercase mb-1">{t('pointOfContact')}</h3>
                             {contactPerson && <div className="flex justify-between"><span className="text-gray-500">{t('name')}:</span> <span className="font-bold">{contactPerson}</span></div>}
                             {fullPhone && <div className="flex justify-between"><span className="text-gray-500">{t('phone')}:</span> <span className="font-bold">{fullPhone}</span></div>}
                             {contactEmail && <div className="flex justify-between"><span className="text-gray-500">{t('emailLabel')}:</span> <span className="font-bold">{contactEmail}</span></div>}
                        </div>
                    )}

                    <div><h3 className="text-xs font-bold text-gray-500 uppercase mb-1">{t('description')}</h3><p className="p-3 bg-gray-50 rounded-xl text-sm">{description}</p></div>
                    {(repairDays > 0 || cost > 0 || mitigation) && (
                        <div className="bg-gray-50 p-4 rounded-xl text-sm space-y-1">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">{t('advancedLabel')}</h3>
                            {repairDays > 0 && <div>{t('estRepairLabel')}: {repairDays} {t('daysUnit')}</div>}
                            {cost > 0 && <div>{t('estCostPrefix')}: €{cost}</div>}
                            {mitigation && <div>{t('planLabel')}: {mitigation}</div>}
                        </div>
                    )}
                    <div className="flex gap-2">
                         {image && <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1"><Icons.Image size={12}/> {t('imageAttached')}</div>}
                         {video && <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1"><Icons.Video size={12}/> {t('videoAttached')}</div>}
                         {audio && <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center gap-1"><Icons.Mic size={12}/> {t('audioAttached')}</div>}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setStep('EDIT')} className="flex-1 py-3 rounded-xl border border-gray-300 font-bold text-gray-600">{t('back')}</button>
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700">{loading ? t('submittingBtn') : initialData ? t('updateReport') : t('submitNow')}</button>
                </div>
            </div>
        );
    }

    if (step === 'SUCCESS') {
        const reportUrl = `${window.location.origin}/report/${submittedId}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reportUrl)}`;
        const handleDownloadQR = async () => {
            const fname = `SafeSphere-QR-${submittedId}.png`;
            try {
                const response = await fetch(qrUrl);
                const blob = await response.blob();
                if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined') {
                    try {
                        const file = new File([blob], fname, { type: blob.type || 'image/png' });
                        const data: ShareData = { files: [file], title: fname };
                        if (!navigator.canShare || navigator.canShare(data)) {
                            await navigator.share(data);
                            return;
                        }
                    } catch (err) {
                        if ((err as Error).name === 'AbortError') return;
                    }
                }
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fname;
                link.rel = 'noopener';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                window.setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 500);
            } catch {
                window.open(qrUrl, '_blank');
            }
        };
        const handleDownloadReport = async () => {
            const lines = [
                'SAFE SPHERE INCIDENT REPORT',
                '===========================',
                `Report ID: #${submittedId}`,
                `Date/Time: ${new Date().toLocaleString()}`,
                '',
                'INCIDENT DETAILS',
                `Hazard Type: ${type}`,
                `Urgency: ${urgency}`,
                `Location of Incident: ${department}`,
                `Description: ${description}`,
                '',
                'LOCATION (GPS)',
                location
                    ? `Latitude: ${location.lat.toFixed(6)}\nLongitude: ${location.lng.toFixed(6)}\nMap: https://www.google.com/maps?q=${location.lat},${location.lng}`
                    : t('reportPrintNoGpsCoordinates'),
                '',
                'CONTACT',
                `Name: ${contactPerson || 'N/A'}`,
                `Phone: ${fullPhone || 'N/A'}`,
                `Email: ${contactEmail || 'N/A'}`,
                '',
                'ADVANCED',
                `Structural Damage: ${structuralDamage}`,
                `Est. Repair Days: ${repairDays}`,
                `Est. Cost: €${cost}`,
                `Mitigation: ${mitigation || 'N/A'}`,
                '',
                'ATTACHMENTS',
                `Image: ${image ? 'Yes' : 'No'}`,
                `Video: ${video ? 'Yes' : 'No'}`,
                `Audio: ${audio ? 'Yes' : 'No'}`,
                '',
                '--- SafeSphere ---',
            ];
            const text = lines.join('\n');
            const filename = `Incident_Report_${submittedId}.txt`;
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });

            if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined') {
                try {
                    const file = new File([blob], filename, { type: 'text/plain' });
                    const fileShare: ShareData = { files: [file], title: filename };
                    if (!navigator.canShare || navigator.canShare(fileShare)) {
                        await navigator.share(fileShare);
                        return;
                    }
                } catch (err) {
                    if ((err as Error).name === 'AbortError') return;
                }
                try {
                    await navigator.share({ title: filename, text });
                    return;
                } catch (err) {
                    if ((err as Error).name === 'AbortError') return;
                }
            }

            try {
                const objectUrl = URL.createObjectURL(blob);
                const element = document.createElement('a');
                element.href = objectUrl;
                element.download = filename;
                element.rel = 'noopener';
                element.style.display = 'none';
                document.body.appendChild(element);
                element.click();
                window.setTimeout(() => {
                    document.body.removeChild(element);
                    URL.revokeObjectURL(objectUrl);
                }, 500);
                return;
            } catch {
                /* fall through */
            }

            try {
                await navigator.clipboard.writeText(text);
                alert(t('reportDownloadCopied'));
            } catch {
                alert(t('reportDownloadFailed'));
            }
        };
        const handleDelete = () => { if (window.confirm(t('deleteReportConfirm'))) onCancel(); };

        const printContent = (
            <div className="report-print-content" style={{ fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1d4ed8', paddingBottom: 8 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e40af' }}>SafeSphere Incident Report</h1>
                        <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: '#374151' }}>Report ID: #{submittedId}</p>
                    </div>
                    <img src={qrUrl} alt="QR Code" style={{ width: 48, height: 48 }} />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                    <tbody>
                        <tr><td style={{ padding: '3px 0', color: '#6b7280', width: '28%', fontSize: 9 }}>Hazard Type</td><td style={{ padding: '3px 0', fontWeight: 600, fontSize: 9 }}>{type}</td></tr>
                        <tr><td style={{ padding: '3px 0', color: '#6b7280', fontSize: 9 }}>Urgency</td><td style={{ padding: '3px 0', fontWeight: 600, fontSize: 9 }}>{urgency}</td></tr>
                        <tr><td style={{ padding: '3px 0', color: '#6b7280', fontSize: 9 }}>Location</td><td style={{ padding: '3px 0', fontWeight: 600, fontSize: 9 }}>{department}</td></tr>
                        <tr>
                            <td style={{ padding: '3px 0', color: '#6b7280', fontSize: 9 }}>{t('locationGps')}</td>
                            <td style={{ padding: '3px 0', fontFamily: 'monospace', fontSize: 8 }}>
                                {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : t('reportPrintNoGpsCoordinates')}
                            </td>
                        </tr>
                    </tbody>
                </table>
                {location && includeMapInPrint && (() => {
                    const res = getPrintableOsmMapTiles(location.lat, location.lng);
                    const srcSize = 512;
                    const pw = 567;
                    const ph = 424;
                    const scaleX = pw / srcSize;
                    const scaleY = ph / srcSize;
                    const markerSize = 18;
                    return (
                        <div className="report-print-map" style={{ width: '100%', marginBottom: 6 }}>
                            <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{t('incidentPrintMapHeading')}</p>
                            <div className="report-print-map-inner" style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, width: srcSize, height: srcSize, transform: `scale(${scaleX}, ${scaleY})`, transformOrigin: 'top left' }}>
                                    {res.tiles.map((tile, i) => (
                                        <img key={i} src={tile.url} alt="" style={{ position: 'absolute', left: tile.left, top: tile.top, width: 600, height: 500, marginLeft: -tile.left, marginTop: -tile.top }} />
                                    ))}
                                </div>
                                <div style={{ position: 'absolute', left: res.markerLeft * scaleX - markerSize / 2, top: res.markerTop * scaleY - markerSize / 2, width: markerSize, height: markerSize, borderRadius: '50%', backgroundColor: '#ef4444', border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
                            </div>
                        </div>
                    );
                })()}
                {location && !includeMapInPrint && (
                    <p style={{ margin: '0 0 8px', padding: 8, backgroundColor: '#f9fafb', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 9, color: '#4b5563' }}>{t('reportPrintOmitMapNote')}</p>
                )}
                {!location && (
                    <p style={{ margin: '0 0 8px', padding: 8, backgroundColor: '#fffbeb', borderRadius: 4, border: '1px solid #fcd34d', fontSize: 9, color: '#92400e' }}>{t('reportPrintNoGpsCoordinates')}</p>
                )}
                {(contactPerson || fullPhone || contactEmail) && (
                    <div style={{ marginBottom: 8, padding: 8, backgroundColor: '#eff6ff', borderRadius: 4, border: '1px solid #bfdbfe' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Point of Contact</p>
                        {contactPerson && <p style={{ margin: '0 0 2px', fontSize: 9 }}><strong>Name:</strong> {contactPerson}</p>}
                        {fullPhone && <p style={{ margin: '0 0 2px', fontSize: 9 }}><strong>Phone:</strong> {fullPhone}</p>}
                        {contactEmail && <p style={{ margin: 0, fontSize: 9 }}><strong>Email:</strong> {contactEmail}</p>}
                    </div>
                )}
                <div style={{ marginBottom: 8 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Description</p>
                    <p style={{ margin: 0, padding: 8, backgroundColor: '#f9fafb', borderRadius: 4, whiteSpace: 'pre-wrap', fontSize: 9 }}>{description}</p>
                </div>
                {(repairDays > 0 || cost > 0 || mitigation) && (
                    <div style={{ marginBottom: 8, padding: 8, backgroundColor: '#f9fafb', borderRadius: 4 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Advanced</p>
                        <p style={{ margin: 0, fontSize: 9 }}>{[repairDays > 0 && `Repair: ${repairDays}d`, cost > 0 && `Cost: €${cost}`, mitigation].filter(Boolean).join(' • ')}</p>
                    </div>
                )}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Attachments</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        {image && (
                            <>
                                <div className="report-print-attachment" style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', marginBottom: 4 }}>
                                    <img src={image} alt="Incident" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <span style={{ fontSize: 9, color: '#15803d', fontWeight: 600 }}>Image Attached</span>
                            </>
                        )}
                        {video && <span style={{ fontSize: 9, color: '#1d4ed8', fontWeight: 600 }}>Video Attached</span>}
                        {audio && <span style={{ fontSize: 9, color: '#7c3aed', fontWeight: 600 }}>Audio Attached</span>}
                        {!image && !video && !audio && <span style={{ fontSize: 9, color: '#9ca3af' }}>None</span>}
                    </div>
                </div>
                <p style={{ marginTop: 8, fontSize: 8, color: '#9ca3af' }}>Scan QR to view online • SafeSphere</p>
            </div>
        );

        // Incident type icon & colour
        const getIncidentVisuals = (incidentType: string) => {
            const t = incidentType.toLowerCase();
            if (t.includes('fire') || t.includes('explosion')) return { Icon: Icons.Flame, bg: 'bg-red-100', text: 'text-red-600', ring: 'ring-red-200' };
            if (t.includes('flood') || t.includes('tsunami')) return { Icon: Icons.Droplets, bg: 'bg-blue-100', text: 'text-blue-600', ring: 'ring-blue-200' };
            if (t.includes('earthquake')) return { Icon: Icons.Activity, bg: 'bg-orange-100', text: 'text-orange-600', ring: 'ring-orange-200' };
            if (t.includes('storm') || t.includes('hurricane')) return { Icon: Icons.CloudRain, bg: 'bg-sky-100', text: 'text-sky-600', ring: 'ring-sky-200' };
            if (t.includes('medical') || t.includes('injury')) return { Icon: Icons.Medical, bg: 'bg-pink-100', text: 'text-pink-600', ring: 'ring-pink-200' };
            if (t.includes('gas') || t.includes('hazardous')) return { Icon: Icons.AlertTriangle, bg: 'bg-yellow-100', text: 'text-yellow-600', ring: 'ring-yellow-200' };
            if (t.includes('power')) return { Icon: Icons.Zap, bg: 'bg-amber-100', text: 'text-amber-600', ring: 'ring-amber-200' };
            if (t.includes('security') || t.includes('missing')) return { Icon: Icons.Shield, bg: 'bg-purple-100', text: 'text-purple-600', ring: 'ring-purple-200' };
            return { Icon: Icons.AlertTriangle, bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-200' };
        };

        const urgencyStyles: Record<string, string> = {
            'Critical': 'bg-red-600 text-white',
            'High': 'bg-orange-500 text-white',
            'Medium': 'bg-yellow-400 text-yellow-900',
            'Low': 'bg-green-100 text-green-700',
        };

        const visuals = getIncidentVisuals(type);
        const IncidentIcon = visuals.Icon;
        const submittedAt = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

        return (
            <>
                {createPortal(printContent, document.body)}
                <div className="no-print bg-white rounded-2xl p-6 shadow-xl border border-gray-100 text-center animate-in zoom-in duration-300 h-full overflow-y-auto">

                {/* Success header */}
                <div className="relative mb-5">
                    <div className={`w-16 h-16 ${visuals.bg} ${visuals.text} rounded-full flex items-center justify-center mx-auto ring-4 ${visuals.ring}`}>
                        <IncidentIcon size={30} strokeWidth={2.5} />
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center ring-2 ring-white shadow">
                        <Icons.Check size={16} strokeWidth={3} />
                    </div>
                </div>
                <h2 className="text-xl font-bold mb-1">{initialData ? t('reportUpdatedSuccess') : t('reportSubmittedSuccess')}</h2>
                <p className="text-sm text-gray-500 mb-4">{t('confirmationIdPrefix')} <span className="font-mono font-bold text-gray-700">#{submittedId}</span></p>

                {/* Confirmation summary card */}
                <div className="text-left bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <IncidentIcon size={16} className={visuals.text} />
                            <span className="text-sm font-bold text-gray-800">{type}</span>
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${urgencyStyles[urgency] || 'bg-gray-200 text-gray-600'}`}>{urgency}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-gray-500">
                            <Icons.MapPin size={12} className="shrink-0" />
                            <span className="truncate">{department}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500">
                            <Icons.Clock size={12} className="shrink-0" />
                            <span className="truncate">{submittedAt}</span>
                        </div>
                        {location && (
                            <div className="flex items-center gap-1.5 text-gray-400 col-span-2 font-mono text-[11px]">
                                <Icons.Navigation size={12} className="shrink-0" />
                                <span>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
                            </div>
                        )}
                    </div>
                    {description && (
                        <p className="text-xs text-gray-500 line-clamp-2 border-t border-gray-200 pt-2">{description}</p>
                    )}
                    <div className="flex gap-1.5 flex-wrap">
                        {image && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">{t('imageAttached')}</span>}
                        {video && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{t('videoAttached')}</span>}
                        {audio && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">{t('audioAttached')}</span>}
                    </div>
                </div>

                {/* What happens next */}
                <div className="text-left bg-blue-50/60 rounded-xl p-4 mb-5 border border-blue-100">
                    <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Icons.Info size={13} />
                        {t('whatHappensNext')}
                    </h3>
                    <div className="space-y-2.5">
                        <div className="flex items-start gap-2.5">
                            <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 mt-0.5"><Icons.Check size={12} strokeWidth={3} /></div>
                            <p className="text-xs text-gray-700"><span className="font-bold">{t('nextStep1Title')}</span> — {t('nextStep1Desc')}</p>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">2</div>
                            <p className="text-xs text-gray-700"><span className="font-bold">{t('nextStep2Title')}</span> — {t('nextStep2Desc')}</p>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">3</div>
                            <p className="text-xs text-gray-700"><span className="font-bold">{t('nextStep3Title')}</span> — {t('nextStep3Desc')}</p>
                        </div>
                    </div>
                </div>

                {/* QR Code */}
                <div className="bg-white border-2 border-gray-100 p-4 rounded-xl inline-block mb-5 shadow-inner relative group">
                    <img src={qrUrl} alt="QR Code" className="w-28 h-28 mix-blend-multiply" />
                    <button onClick={() => void handleDownloadQR()} className="absolute -bottom-2 -right-2 w-9 h-9 bg-black text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform cursor-pointer" title={t('downloadQrImage')} type="button"><Icons.Download size={14} /></button>
                    <div className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-wider">{t('scanToViewCase')}</div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                    <button type="button" onClick={() => setShowViewModal(true)} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 active:scale-95"><div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Icons.Info size={18} /></div><span className="text-xs font-medium text-center leading-tight">{t('viewReport')}</span></button>
                    <button type="button" onClick={() => void handleDownloadReport()} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 active:scale-95"><div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center"><Icons.Download size={18} /></div><span className="text-xs font-medium text-center leading-tight">{t('downloadIncidentReport')}</span></button>
                    <button type="button" onClick={handleShare} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 active:scale-95"><div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><Icons.Share size={18} /></div><span className="text-xs font-medium text-center leading-tight">{t('share')}</span></button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-5">
                    <button type="button" onClick={() => requestPrint(false)} className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 border-gray-200 hover:bg-gray-50 transition-colors active:scale-[0.98] min-h-[72px]"><Icons.Printer size={18} className="text-gray-600" /><span className="text-[11px] sm:text-xs font-semibold text-center text-gray-800 leading-tight">{t('reportPrintWithoutMap')}</span></button>
                    <button
                        type="button"
                        disabled={!location}
                        title={!location ? t('reportGpsNotIncluded') : undefined}
                        onClick={() => requestPrint(true)}
                        className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 transition-colors active:scale-[0.98] min-h-[72px] ${
                            location
                                ? 'border-blue-600 hover:bg-blue-50'
                                : 'border-gray-200 opacity-50 cursor-not-allowed'
                        }`}
                    >
                        <Icons.Printer size={18} className={location ? 'text-blue-700' : 'text-gray-400'} />
                        <span className={`text-[11px] sm:text-xs font-semibold text-center leading-tight ${location ? 'text-blue-900' : 'text-gray-500'}`}>{t('reportPrintWithMap')}</span>
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t pt-4">
                    <button onClick={() => { setStep('EDIT'); }} className="flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg min-h-[44px]"><Icons.Edit size={16} /> {t('editReport')}</button>
                    <button onClick={handleDelete} className="flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg min-h-[44px]"><Icons.Trash size={16} /> {t('delete')}</button>
                </div>
                <button onClick={onSuccess} className="mt-4 w-full py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-200 transition-colors min-h-[44px]">{t('close')}</button>
                </div>

                {showViewModal && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center">
                                <h3 className="font-bold text-lg">{t('incidentReportTitle')} #{submittedId}</h3>
                                <button
                                    type="button"
                                    onClick={() => setShowViewModal(false)}
                                    title={t('closeButton')}
                                    aria-label={t('closeButton')}
                                    className="p-2 hover:bg-gray-100 rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center"
                                >
                                    <Icons.X size={20} />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-sm">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div><span className="text-gray-500">{t('hazardType')}:</span> <span className="font-semibold">{type}</span></div>
                                    <div><span className="text-gray-500">{t('urgencyLabel')}:</span> <span className={`font-semibold ${urgency === 'Critical' ? 'text-red-600' : ''}`}>{urgency}</span></div>
                                    <div><span className="text-gray-500">{t('incidentLocation')}:</span> <span className="font-semibold">{department}</span></div>
                                    <div><span className="text-gray-500">{t('status')}:</span> <span className="font-semibold text-green-600">{t('submittedStatus')}</span></div>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-xs uppercase font-bold mb-1">{t('description')}</span>
                                    <p className="text-gray-800">{description}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-xs uppercase font-bold mb-1">{t('locationGps')}</span>
                                    {location ? (
                                        <>
                                            <p className="font-mono text-xs">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
                                            <a href={`https://www.google.com/maps?q=${location.lat},${location.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 text-xs mt-1 inline-flex items-center gap-1">View on map <Icons.ChevronRight size={12} /></a>
                                        </>
                                    ) : (
                                        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2 border border-amber-100">{t('reportGpsNotIncluded')}</p>
                                    )}
                                </div>
                                {(contactPerson || fullPhone || contactEmail) && (
                                    <div>
                                        <span className="text-gray-500 block text-xs uppercase font-bold mb-1">{t('contactLabel')}</span>
                                        {contactPerson && <p className="font-semibold">{contactPerson}</p>}
                                        {fullPhone && <p className="text-gray-700">{fullPhone}</p>}
                                        {contactEmail && <p className="text-blue-600">{contactEmail}</p>}
                                    </div>
                                )}
                                {(repairDays > 0 || cost > 0 || mitigation) && (
                                    <div>
                                        <span className="text-gray-500 block text-xs uppercase font-bold mb-1">{t('advancedLabel')}</span>
                                        <p>{[repairDays > 0 && `${repairDays} days repair`, cost > 0 && `€${cost}`, mitigation].filter(Boolean).join(' • ')}</p>
                                    </div>
                                )}
                                <div>
                                    <span className="text-gray-500 block text-xs uppercase font-bold mb-1">{t('attachmentsLabel')}</span>
                                    <p className="flex gap-2 flex-wrap">{image && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{t('imageAttached')}</span>}{video && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{t('videoAttached')}</span>}{audio && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{t('audioAttached')}</span>}{!image && !video && !audio && <span className="text-gray-400">{t('noneLabel')}</span>}</p>
                                </div>
                            </div>
                            <div className="p-4 border-t flex flex-col gap-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => requestPrint(false)} className="py-2.5 rounded-xl bg-gray-100 font-semibold text-gray-700 flex items-center justify-center gap-1.5 min-h-[44px] text-xs sm:text-sm"><Icons.Printer size={16} /> {t('reportPrintWithoutMap')}</button>
                                    <button
                                        type="button"
                                        disabled={!location}
                                        title={!location ? t('reportGpsNotIncluded') : undefined}
                                        onClick={() => requestPrint(true)}
                                        className={`py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 min-h-[44px] text-xs sm:text-sm ${
                                            location ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        <Icons.Printer size={16} /> {t('reportPrintWithMap')}
                                    </button>
                                </div>
                                <button type="button" onClick={() => void handleDownloadReport()} className="w-full py-2.5 rounded-xl border-2 border-gray-200 font-semibold text-gray-800 flex items-center justify-center gap-2 min-h-[44px]"><Icons.Download size={16} /> {t('downloadIncidentReport')}</button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 h-full overflow-y-auto">
            {renderHeader(initialData ? `${t('edit')} Incident #${initialData.id}` : t('reportIncident'), <Icons.Emergency className="text-red-500" size={24} />)}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (includeGpsMap && !location) {
                        alert(t('locationConfirmRequired'));
                        return;
                    }
                    setStep('REVIEW');
                }}
                className="space-y-4 pb-6"
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="hazard-type" className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('hazardType')}</label>
                        <select
                            id="hazard-type"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                        >
                            <option value="Structural Fire">{t('structuralFire')}</option>
                            <option value="Flash Flood">{t('flashFlood')}</option>
                            <option value="Earthquake">{t('earthquake')}</option>
                            <option value="Tsunami">{t('tsunami')}</option>
                            <option value="Volcano">{t('volcano')}</option>
                            <option value="Hurricane">{t('hurricane')}</option>
                            <option value="Storm">{t('storm')}</option>
                            <option value="Gas Leak">{t('gasLeak')}</option>
                            <option value="Explosion">{t('explosion')}</option>
                            <option value="Medical Emergency">{t('medicalEmergency')}</option>
                            <option value="Injury">{t('injury')}</option>
                            <option value="Missing Person">{t('missingPerson')}</option>
                            <option value="Security Threat">{t('securityThreat')}</option>
                            <option value="Power Outage">{t('powerOutage')}</option>
                            <option value="Hazardous Spill">{t('hazardousSpill')}</option>
                            <option value="Other">{t('other')}</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="incident-location" className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('incidentLocation')}</label>
                        <select
                            id="incident-location"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                        >
                            <option value="Main Building">{t('mainBuilding')}</option>
                            <option value="Office">{t('office')}</option>
                            <option value="Company Compound">{t('companyCompound')}</option>
                            <option value="Warehouse">{t('warehouse')}</option>
                            <option value="Workshop">{t('workshop')}</option>
                            <option value="Parking Lot">{t('parkingLot')}</option>
                            <option value="Factory">{t('factory')}</option>
                            <option value="Construction Site">{t('constructionSite')}</option>
                            <option value="School">{t('school')}</option>
                            <option value="City Centre">{t('cityCentre')}</option>
                            <option value="Highway">{t('highway')}</option>
                            <option value="Airport">{t('airport')}</option>
                            <option value="Urban Area">{t('urbanArea')}</option>
                            <option value="Rural Area">{t('ruralArea')}</option>
                            <option value="Other">{t('other')}</option>
                        </select>
                    </div>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('urgencyLabel')}</label><div className="flex bg-gray-100 p-1 rounded-xl">{['Low', 'Medium', 'High', 'Critical'].map((u) => (<button key={u} type="button" onClick={() => setUrgency(u as any)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${urgency === u ? 'bg-white shadow text-black' : 'text-gray-500'}`}>{u}</button>))}</div></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('description')}</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('describeSituation')} className="w-full p-3 rounded-xl border border-gray-300 text-sm min-h-20 resize-y" rows={4} required /></div>
                
                {/* Optional Contact Fields */}
                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Icons.User size={12}/> {t('contactInfoOptional')}</h3>
                    {/* Name */}
                    <div>
                        <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 text-sm bg-white" placeholder={t('yourName')} />
                    </div>
                    {/* Phone with country code */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('phoneNumber')}</label>
                        <div className="flex gap-0 rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/20 transition-colors">
                            <select
                                value={countryCode}
                                onChange={e => setCountryCode(e.target.value)}
                                className="shrink-0 pl-2.5 pr-1 py-2.5 text-sm bg-gray-50 border-r border-gray-200 text-gray-700 font-medium outline-none cursor-pointer appearance-none"
                                title={t('countryCodeLabel')}
                                style={{ backgroundImage: 'none' }}
                            >
                                <option value="+43">🇦🇹 +43</option>
                                <option value="+95">🇲🇲 +95</option>
                                <option value="+49">🇩🇪 +49</option>
                                <option value="+44">🇬🇧 +44</option>
                                <option value="+1">🇺🇸 +1</option>
                                <option value="+33">🇫🇷 +33</option>
                                <option value="+39">🇮🇹 +39</option>
                                <option value="+41">🇨🇭 +41</option>
                                <option value="+34">🇪🇸 +34</option>
                                <option value="+31">🇳🇱 +31</option>
                                <option value="+46">🇸🇪 +46</option>
                                <option value="+47">🇳🇴 +47</option>
                                <option value="+48">🇵🇱 +48</option>
                                <option value="+81">🇯🇵 +81</option>
                                <option value="+82">🇰🇷 +82</option>
                                <option value="+86">🇨🇳 +86</option>
                                <option value="+91">🇮🇳 +91</option>
                                <option value="+61">🇦🇺 +61</option>
                                <option value="+65">🇸🇬 +65</option>
                                <option value="+66">🇹🇭 +66</option>
                                <option value="+60">🇲🇾 +60</option>
                                <option value="+63">🇵🇭 +63</option>
                                <option value="+84">🇻🇳 +84</option>
                                <option value="+62">🇮🇩 +62</option>
                                <option value="+7">🇷🇺 +7</option>
                                <option value="+90">🇹🇷 +90</option>
                                <option value="+971">🇦🇪 +971</option>
                                <option value="+966">🇸🇦 +966</option>
                                <option value="+20">🇪🇬 +20</option>
                                <option value="+27">🇿🇦 +27</option>
                                <option value="+55">🇧🇷 +55</option>
                                <option value="+52">🇲🇽 +52</option>
                            </select>
                            <input
                                type="tel"
                                value={contactPhone}
                                onChange={e => setContactPhone(e.target.value)}
                                className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none bg-transparent"
                                placeholder="660 123 4567"
                            />
                        </div>
                    </div>
                    {/* Email */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('emailLabel')}</label>
                        <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/20 transition-colors">
                            <div className="pl-2.5 pr-1.5 text-gray-400">
                                <Icons.Mail size={16} />
                            </div>
                            <input
                                type="email"
                                value={contactEmail}
                                onChange={e => setContactEmail(e.target.value)}
                                className="flex-1 min-w-0 px-2 py-2.5 text-sm outline-none bg-transparent"
                                placeholder={t('emailPlaceholder')}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3"><input type="checkbox" id="repeatable" checked={repeatable} onChange={(e) => setRepeatable(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"/><label htmlFor="repeatable" className="text-sm font-medium text-gray-700">{t('repeatableIncident')}</label></div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('reportLocationModeLabel')}</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl">
                        <button
                            type="button"
                            onClick={() => {
                                setIncludeGpsMap(false);
                                setLocation(null);
                            }}
                            className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                !includeGpsMap
                                    ? 'bg-white dark:bg-gray-900 shadow text-black dark:text-white ring-2 ring-black/10'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            {t('reportLocationTextOnlyTitle')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIncludeGpsMap(true)}
                            className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                includeGpsMap
                                    ? 'bg-white dark:bg-gray-900 shadow text-black dark:text-white ring-2 ring-blue-200'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            {t('reportLocationWithGpsTitle')}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-snug">
                        {includeGpsMap ? t('reportLocationWithGpsHint') : t('reportLocationTextOnlyHint')}
                    </p>
                </div>

                {/* GPS Location Card + map — only when reporter chose GPS mode */}
                {includeGpsMap && (
                <>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('gpsLocationLabel')}</label>
                    <div className={`rounded-xl border-2 p-4 transition-all duration-300 ${location ? 'border-green-200 bg-gradient-to-br from-green-50/80 to-emerald-50/40' : locating ? 'border-blue-200 bg-gradient-to-br from-blue-50/60 to-sky-50/30' : 'border-gray-200 bg-gray-50'}`}>
                        {/* Status Row */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                {location ? (
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                    </span>
                                ) : locating ? (
                                    <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300"></span>
                                )}
                                <span className={`text-sm font-bold ${location ? 'text-green-700' : locating ? 'text-blue-600' : 'text-gray-500'}`}>
                                    {locating ? t('syncingLocation') : location ? t('gpsLiveConnected') : t('waitingForGps')}
                                </span>
                            </div>
                            {lastSyncTime && location && (
                                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                    <Icons.Clock size={10} />
                                    {lastSyncTime}
                                </span>
                            )}
                        </div>

                        {/* Coordinates Display */}
                        {location && (
                            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 mb-3 border border-green-100/80">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Icons.MapPin size={12} className="text-green-600" />
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('coordinatesLabel')}</span>
                                </div>
                                <p className="font-mono text-sm text-gray-800 tracking-wide">
                                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                </p>
                            </div>
                        )}

                        {/* Sync GPS Live Button */}
                        <button
                            type="button"
                            onClick={handleGetLocation}
                            disabled={locating}
                            className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                                locating
                                    ? 'bg-blue-100 text-blue-400 cursor-wait'
                                    : location
                                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow-md'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                            }`}
                        >
                            {locating ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                                    {t('syncingGps')}
                                </>
                            ) : (
                                <>
                                    <Icons.RefreshCw size={15} />
                                    {location ? t('updateGpsLive') : t('syncGpsLive')}
                                </>
                            )}
                        </button>

                        {/* Helper text */}
                        {!location && !locating && (
                            <p className="text-xs text-gray-400 mt-2 text-center">{t('tapToSyncGps')}</p>
                        )}
                        {locating && !location && (
                            <p className="text-xs text-blue-500 mt-2 text-center animate-pulse">{t('acquiringGpsSignal')}</p>
                        )}
                    </div>

                    {/* Flood zone hint */}
                    {type.toLowerCase().includes('flood') && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1.5 bg-blue-50 p-2 rounded-lg border border-blue-100">
                            <Icons.Info size={14} className="shrink-0" />
                            {t('floodPlacementHint')}
                        </p>
                    )}
                </div>
                {typeof window !== 'undefined' && window.L && (
                    <div className="rounded-xl overflow-hidden border border-gray-200 mt-3">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">{t('incidentLocationMap')} <span className="text-green-600 font-normal">({t('gpsActive')})</span></p>
                        <div className="w-full aspect-[4/3] min-h-[200px]">
                            <IncidentMap
                                reports={location ? [{ id: '0', lat: location.lat, lng: location.lng, type, description: '', timestamp: new Date().toLocaleTimeString(), status: 'pending' }] : []}
                                centerLat={location?.lat ?? 16.866}
                                centerLng={location?.lng ?? 96.195}
                                onLocationUpdate={handleLocationUpdate}
                            />
                        </div>
                    </div>
                )}
                </>
                )}
                <div className="border-t pt-3">
                    <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm font-bold text-blue-600"><Icons.ChevronRight size={16} className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`} /> {t('advancedDetails')}</button>
                    {showAdvanced && (
                        <div className="mt-3 space-y-3 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="structural-damage" className="block text-[11px] sm:text-xs font-bold text-gray-500 uppercase mb-1">
                                    {t('structuralDamageLabel')}
                                </label>
                                <select
                                    id="structural-damage"
                                    value={structuralDamage}
                                    onChange={(e) => setStructuralDamage(e.target.value)}
                                    className="w-full p-2.5 rounded-lg border text-sm"
                                >
                                    <option>None</option>
                                    <option>Minor</option>
                                    <option>Major</option>
                                    <option>Total Loss</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="est-repair-days" className="block text-[11px] sm:text-xs font-bold text-gray-500 uppercase mb-1">
                                    {t('estRepairDays')}
                                </label>
                                <input
                                    id="est-repair-days"
                                    type="number"
                                    value={repairDays}
                                    onChange={(e) => setRepairDays(Number(e.target.value))}
                                    placeholder="0"
                                    className="w-full p-2.5 rounded-lg border text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="est-cost" className="block text-[11px] sm:text-xs font-bold text-gray-500 uppercase mb-1">
                                {t('estCostLabel')}
                            </label>
                            <input
                                id="est-cost"
                                type="number"
                                value={cost}
                                onChange={(e) => setCost(Number(e.target.value))}
                                placeholder="0"
                                className="w-full p-2.5 rounded-lg border text-sm"
                            />
                        </div>
                            <div className="flex flex-col gap-2"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={discussed} onChange={(e) => setDiscussed(e.target.checked)} className="rounded text-blue-600"/> {t('situationDiscussed')}</label></div>
                            <div><label className="block text-[11px] sm:text-xs font-bold text-gray-500 uppercase mb-1">{t('followUpMitigation')}</label><textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} placeholder={t('requiredActionsPlaceholder')} className="w-full p-2.5 rounded-lg border text-sm h-16"/></div>
                        </div>
                    )}
                </div>
                <div className="border-t pt-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('evidenceMedia')}</label>
                    <div className="flex gap-2">
                        <div className="relative"><input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="img-upload" /><label htmlFor="img-upload" title="Upload image" className={`w-14 h-14 rounded-xl border flex items-center justify-center cursor-pointer ${image ? 'bg-green-100 border-green-500 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}><Icons.Image size={20} /></label></div>
                        <button type="button" onClick={openCamera} title="Take photo" className={`w-14 h-14 rounded-xl border flex items-center justify-center cursor-pointer ${image ? 'bg-blue-100 border-blue-500 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}><Icons.Video size={20} /></button>
                        <button type="button" onClick={toggleAudioRecording} className={`w-14 h-14 rounded-xl border flex items-center justify-center transition-all ${isRecording ? 'bg-red-100 border-red-500 text-red-600 animate-pulse' : audio ? 'bg-purple-100 border-purple-500 text-purple-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>{isRecording ? <Icons.Stop size={20} /> : <Icons.Mic size={20} />}</button>
                    </div>
                    {(image || video || audio) && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                            <p className="text-xs font-bold text-gray-500 uppercase">Attachments</p>
                            <div className="flex flex-wrap gap-3">
                                {image && (
                                    <div className="w-full space-y-1">
                                        <div className="w-full aspect-[4/3] min-h-[200px] rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                                            <img src={image} alt="Attached" className="w-full h-full object-cover" />
                                        </div>
                                        <span className="text-sm font-medium text-green-700 flex items-center gap-1">
                                            <Icons.Image size={14} /> Image Attached
                                        </span>
                                    </div>
                                )}
                                {video && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-14 h-14 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
                                            <Icons.Video size={24} className="text-blue-600" />
                                        </div>
                                        <span className="text-sm font-medium text-blue-700 flex items-center gap-1">
                                            <Icons.Video size={14} /> Video file Attached
                                        </span>
                                    </div>
                                )}
                                {audio && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-14 h-14 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center">
                                            <Icons.Mic size={24} className="text-purple-600" />
                                        </div>
                                        <span className="text-sm font-medium text-purple-700 flex items-center gap-1">
                                            <Icons.Mic size={14} /> Audio file Attached
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {showCamera && createPortal(
                        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
                            <button type="button" onClick={closeCamera} className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white" aria-label="Close">
                                <Icons.X size={24} />
                            </button>
                            <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
                                {capturedPhoto ? (
                                    <img src={capturedPhoto} alt="Preview" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" onLoadedData={handleVideoLoaded} />
                                )}
                            </div>
                            <div
                                className="shrink-0 flex flex-col px-5 pt-5 pb-6 bg-gray-900 border-t-2 border-gray-600"
                                style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
                            >
                                {capturedPhoto ? (
                                    <div className="flex gap-4">
                                        <button type="button" onClick={retakePhoto} className="flex-1 py-4 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-bold text-lg shadow-lg active:scale-[0.98]">
                                            {t('retakeBtn')}
                                        </button>
                                        <button type="button" onClick={savePhoto} className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]">
                                            <Icons.Check size={24} aria-hidden /> {t('savePhotoBtn')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-4">
                                        <button type="button" onClick={closeCamera} className="flex-1 py-4 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-bold text-lg shadow-lg active:scale-[0.98]">
                                            {t('cancel')}
                                        </button>
                                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); takePhoto(); }} disabled={!cameraReady} className={`flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] ${cameraReady ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}>
                                            <Icons.Camera size={24} aria-hidden /> {cameraReady ? t('takePhotoBtn') : t('loading')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
                <div className="flex gap-3 pt-4">
                    {includeGpsMap && !location && <p className="text-xs text-gray-500">{t('locationSyncHint')}</p>}
                    <button
                        type="submit"
                        disabled={!(!includeGpsMap || !!location)}
                        className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg shadow-gray-200 ${
                            !includeGpsMap || location ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        {initialData ? t('save') : t('reviewReport')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ReportForm;
