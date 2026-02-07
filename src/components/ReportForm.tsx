import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icon';
import { submitReport } from '../services/api';
import { IncidentReport } from '../types';
import { getRandomFloodZoneYangon } from '../constants';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import IncidentMap from './IncidentMap';

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
    const [submittedId, setSubmittedId] = useState<number | null>(null);
    const [showViewModal, setShowViewModal] = useState(false);

    // -- Form State --
    const [type, setType] = useState('Structural Fire');
    const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
    const [department, setDepartment] = useState('Maintenance');
    const [description, setDescription] = useState('');
    
    // Contact Info (Optional)
    const [contactPerson, setContactPerson] = useState('');
    const [contactPhone, setContactPhone] = useState('');

    // Advanced
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [structuralDamage, setStructuralDamage] = useState('None');
    const [repairDays, setRepairDays] = useState<number>(0);
    const [cost, setCost] = useState<number>(0);
    const [repeatable, setRepeatable] = useState(false);
    const [discussed, setDiscussed] = useState(false);
    const [mitigation, setMitigation] = useState('');

    // Location
    const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
    const [locating, setLocating] = useState(true);
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
            setDepartment(initialData.department || 'Maintenance');
            setDescription(initialData.description);
            setLocation({ lat: initialData.lat, lng: initialData.lng });
            setStructuralDamage(initialData.structuralDamage || 'None');
            setRepairDays(initialData.estRepairDays || 0);
            setCost(initialData.estCost || 0);
            setRepeatable(initialData.repeatable || false);
            setDiscussed(initialData.situationDiscussed || false);
            setMitigation(initialData.mitigationPlan || '');
            setContactPerson(initialData.contactPerson || '');
            setContactPhone(initialData.contactPhone || '');
            if (initialData.image) setImage(initialData.image);
            if (initialData.video) setVideo(initialData.video);
            if (initialData.audio) setAudio(initialData.audio);
            if (initialData.structuralDamage || initialData.estRepairDays || initialData.estCost) setShowAdvanced(true);
        }
    }, [initialData]);

    const refreshLocation = useCallback((useCache = false) => {
        if (!('geolocation' in navigator)) return;
        setLocating(true);
        const opts: PositionOptions = useCache
            ? { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
            : { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setLocation(coords);
                lastLocationRef.current = coords;
                setLocating(false);
            },
            (err) => {
                setLocating(false);
                if (!useCache) refreshLocation(true);
                else if (lastLocationRef.current) setLocation(lastLocationRef.current);
                else if (type.toLowerCase().includes('flood')) {
                    const floodZone = getRandomFloodZoneYangon();
                    setLocation(floodZone);
                    lastLocationRef.current = floodZone;
                }
            },
            opts
        );
    }, [type]);

    const handleGetLocation = () => refreshLocation();

    const handleLocationUpdate = useCallback((lat: number, lng: number) => {
        const coords = { lat, lng };
        setLocation((prev) => prev ? { ...prev, ...coords } : coords);
        lastLocationRef.current = coords;
        setLocating(false);
    }, []);

    // Auto-sync GPS: watchPosition for live updates (independent of map)
    useEffect(() => {
        if (initialData || !('geolocation' in navigator)) return;
        setLocating(true);
        const opts: PositionOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setLocation(coords);
                lastLocationRef.current = coords;
                setLocating(false);
            },
            (err) => {
                setLocating(false);
                if (err.code === 2 || err.code === 3) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                            setLocation(c);
                            lastLocationRef.current = c;
                        },
                        () => { if (lastLocationRef.current) setLocation(lastLocationRef.current); },
                        { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }
                    );
                }
            },
            opts
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [initialData]);

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
            alert('Camera access denied or not available.');
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
            alert('Camera not ready. Please wait a moment and try again.');
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
            alert('Could not capture frame. Please try again.');
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
            alert('Camera access denied or not available.');
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
            } catch (err) { alert("Microphone access denied or not supported."); }
        }
    };

    const handleSubmit = async () => {
        if (!location) { alert("Please include a location."); return; }
        setLoading(true);
        const newId = initialData?.id || Math.floor(Math.random() * 100000);
        const reportData: Partial<IncidentReport> = {
            id: newId, 
            type, urgency, department, description, structuralDamage, estRepairDays: repairDays, estCost: cost,
            repeatable, situationDiscussed: discussed, mitigationPlan: mitigation, lat: location.lat, lng: location.lng,
            contactPerson, contactPhone,
            timestamp: initialData?.timestamp || new Date().toLocaleTimeString(), image: image || undefined, video: video || undefined, audio: audio || undefined,
            reporterId: user?.id
        };
        const success = await submitReport(reportData);
        setLoading(false);
        if (success) { setSubmittedId(newId); setStep('SUCCESS'); } else { alert("Failed to submit."); }
    };

    const handlePrint = () => window.print();

    const handleShare = async () => {
        const shareUrl = submittedId ? `${window.location.origin}/report/${submittedId}` : window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: `Incident #${submittedId}: ${type}`, text: description, url: shareUrl }); } catch (err) { console.log('Error sharing', err); }
        } else { navigator.clipboard.writeText(shareUrl); alert("Report link copied to clipboard!"); }
    };

    const renderHeader = (title: string, icon: React.ReactNode) => (
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">{icon} {title}</h2>
            {step === 'EDIT' && <button onClick={onCancel} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><Icons.X size={20} /></button>}
        </div>
    );

    if (step === 'REVIEW') {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 h-full overflow-y-auto">
                {renderHeader("Review Report", <Icons.FileText className="text-blue-500" size={24} />)}
                <div className="space-y-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Type:</span> <span className="font-bold">{type}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Urgency:</span> <span className={`font-bold ${urgency === 'Critical' ? 'text-red-600' : 'text-black'}`}>{urgency}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Dept:</span> <span className="font-bold">{department}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Location:</span> <span className="font-mono">{location?.lat.toFixed(5)}, {location?.lng.toFixed(5)}</span></div>
                    </div>
                    {location && typeof window !== 'undefined' && window.L && (
                        <div className="rounded-xl overflow-hidden border border-gray-200">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Incident Location Map</p>
                            <div className="w-full aspect-[4/3] min-h-[200px]">
                                <IncidentMap reports={[{ id: 0, lat: location.lat, lng: location.lng, type, description, timestamp: new Date().toLocaleTimeString(), status: 'pending' }]} centerLat={location.lat} centerLng={location.lng} />
                            </div>
                        </div>
                    )}
                    
                    {(contactPerson || contactPhone) && (
                        <div className="bg-blue-50 p-4 rounded-xl space-y-2 text-sm border border-blue-100">
                             <h3 className="text-xs font-bold text-blue-600 uppercase mb-1">Point of Contact</h3>
                             {contactPerson && <div className="flex justify-between"><span className="text-gray-500">Name:</span> <span className="font-bold">{contactPerson}</span></div>}
                             {contactPhone && <div className="flex justify-between"><span className="text-gray-500">Phone:</span> <span className="font-bold">{contactPhone}</span></div>}
                        </div>
                    )}

                    <div><h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Description</h3><p className="p-3 bg-gray-50 rounded-xl text-sm">{description}</p></div>
                    {(repairDays > 0 || cost > 0 || mitigation) && (
                        <div className="bg-gray-50 p-4 rounded-xl text-sm space-y-1">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Advanced</h3>
                            {repairDays > 0 && <div>Est Repair: {repairDays} days</div>}
                            {cost > 0 && <div>Est Cost: €{cost}</div>}
                            {mitigation && <div>Plan: {mitigation}</div>}
                        </div>
                    )}
                    <div className="flex gap-2">
                         {image && <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1"><Icons.Image size={12}/> Image Attached</div>}
                         {video && <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1"><Icons.Video size={12}/> Video Attached</div>}
                         {audio && <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center gap-1"><Icons.Mic size={12}/> Audio Attached</div>}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setStep('EDIT')} className="flex-1 py-3 rounded-xl border border-gray-300 font-bold text-gray-600">Back</button>
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700">{loading ? 'Submitting...' : initialData ? 'Update Report' : 'Submit Now'}</button>
                </div>
            </div>
        );
    }

    if (step === 'SUCCESS') {
        const reportUrl = `${window.location.origin}/report/${submittedId}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reportUrl)}`;
        const handleDownloadQR = async () => {
            try {
                const response = await fetch(qrUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `SafeSphere-QR-${submittedId}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) { window.open(qrUrl, '_blank'); }
        };
        const handleDownloadReport = () => {
            const lines = [
                'SAFE SPHERE INCIDENT REPORT',
                '===========================',
                `Report ID: #${submittedId}`,
                `Date/Time: ${new Date().toLocaleString()}`,
                '',
                'INCIDENT DETAILS',
                `Type: ${type}`,
                `Urgency: ${urgency}`,
                `Department: ${department}`,
                `Description: ${description}`,
                '',
                'LOCATION (GPS)',
                `Latitude: ${location?.lat?.toFixed(6) ?? 'N/A'}`,
                `Longitude: ${location?.lng?.toFixed(6) ?? 'N/A'}`,
                `Map: https://www.google.com/maps?q=${location?.lat},${location?.lng}`,
                '',
                'CONTACT',
                `Name: ${contactPerson || 'N/A'}`,
                `Phone: ${contactPhone || 'N/A'}`,
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
                '--- SafeSphere ---'
            ];
            const text = lines.join('\n');
            const element = document.createElement('a');
            element.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            element.download = `Incident_Report_${submittedId}.txt`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            URL.revokeObjectURL(element.href);
        };
        const handleDelete = () => { if (window.confirm("Delete this report?")) onCancel(); };

        const getStaticMapTiles = (lat: number, lng: number, gridSize: 1 | 4 = 1) => {
            const zoom = gridSize === 4 ? 15 : 16;
            const n = Math.pow(2, zoom);
            const x = Math.floor((lng + 180) / 360 * n);
            const latRad = (lat * Math.PI) / 180;
            const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
            const xtileRaw = (lng + 180) / 360 * n;
            const ytileRaw = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
            const fracX = xtileRaw - Math.floor(xtileRaw);
            const fracY = ytileRaw - Math.floor(ytileRaw);
            const tileSize = 256;
            const base = 'https://tile.openstreetmap.org';
            if (gridSize === 4) {
                const tiles = [
                    { url: `${base}/${zoom}/${x - 1}/${y - 1}.png`, left: 0, top: 0 },
                    { url: `${base}/${zoom}/${x}/${y - 1}.png`, left: tileSize, top: 0 },
                    { url: `${base}/${zoom}/${x - 1}/${y}.png`, left: 0, top: tileSize },
                    { url: `${base}/${zoom}/${x}/${y}.png`, left: tileSize, top: tileSize },
                ];
                const markerLeft = tileSize + fracX * tileSize - 5;
                const markerTop = tileSize + fracY * tileSize - 5;
                return { tiles, markerLeft, markerTop, gridSize: 4 as const };
            }
            const tileUrl = `${base}/${zoom}/${x}/${y}.png`;
            const markerLeft = fracX * tileSize - 5;
            const markerTop = fracY * tileSize - 5;
            return { tileUrl, markerLeft, markerTop, gridSize: 1 as const };
        };

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
                        <tr><td style={{ padding: '3px 0', color: '#6b7280', width: '28%', fontSize: 9 }}>Type</td><td style={{ padding: '3px 0', fontWeight: 600, fontSize: 9 }}>{type}</td></tr>
                        <tr><td style={{ padding: '3px 0', color: '#6b7280', fontSize: 9 }}>Urgency</td><td style={{ padding: '3px 0', fontWeight: 600, fontSize: 9 }}>{urgency}</td></tr>
                        <tr><td style={{ padding: '3px 0', color: '#6b7280', fontSize: 9 }}>Department</td><td style={{ padding: '3px 0', fontWeight: 600, fontSize: 9 }}>{department}</td></tr>
                        <tr><td style={{ padding: '3px 0', color: '#6b7280', fontSize: 9 }}>Location</td><td style={{ padding: '3px 0', fontFamily: 'monospace', fontSize: 8 }}>{location?.lat.toFixed(5)}, {location?.lng.toFixed(5)}</td></tr>
                    </tbody>
                </table>
                {location && (() => {
                    const res = getStaticMapTiles(location.lat, location.lng, 4);
                    if (res.gridSize !== 4 || !('tiles' in res)) return null;
                    const srcSize = 512;
                    const pw = 567;
                    const ph = 424;
                    const scaleX = pw / srcSize;
                    const scaleY = ph / srcSize;
                    const markerSize = 18;
                    return (
                        <div className="report-print-map" style={{ width: '100%', marginBottom: 6 }}>
                            <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Incident Location Map</p>
                            <div className="report-print-map-inner" style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, width: srcSize, height: srcSize, transform: `scale(${scaleX}, ${scaleY})`, transformOrigin: 'top left' }}>
                                    {res.tiles.map((t, i) => (
                                        <img key={i} src={t.url} alt="" style={{ position: 'absolute', left: t.left, top: t.top, width: 600, height: 500, marginLeft: -t.left, marginTop: -t.top }} />
                                    ))}
                                </div>
                                <div style={{ position: 'absolute', left: res.markerLeft * scaleX - markerSize / 2, top: res.markerTop * scaleY - markerSize / 2, width: markerSize, height: markerSize, borderRadius: '50%', backgroundColor: '#ef4444', border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
                            </div>
                        </div>
                    );
                })()}
                {(contactPerson || contactPhone) && (
                    <div style={{ marginBottom: 8, padding: 8, backgroundColor: '#eff6ff', borderRadius: 4, border: '1px solid #bfdbfe' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Point of Contact</p>
                        {contactPerson && <p style={{ margin: '0 0 2px', fontSize: 9 }}><strong>Name:</strong> {contactPerson}</p>}
                        {contactPhone && <p style={{ margin: 0, fontSize: 9 }}><strong>Phone:</strong> {contactPhone}</p>}
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

        return (
            <>
                {createPortal(printContent, document.body)}
                <div className="no-print bg-white rounded-2xl p-6 shadow-xl border border-gray-100 text-center animate-in zoom-in duration-300 h-full overflow-y-auto">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><Icons.Check size={32} strokeWidth={3} /></div>
                <h2 className="text-xl font-bold mb-1">{initialData ? 'Your report has been successfully updated!' : 'Your report has been successfully submitted!'}</h2>
                <p className="text-sm text-gray-500 mb-6">ID: #{submittedId} • Sent to {department}</p>
                <div className="bg-white border-2 border-gray-100 p-4 rounded-xl inline-block mb-6 shadow-inner relative group">
                    <img src={qrUrl} alt="QR Code" className="w-32 h-32 mix-blend-multiply" />
                    <button onClick={handleDownloadQR} className="absolute -bottom-2 -right-2 w-8 h-8 bg-black text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform cursor-pointer" title="Download QR"><Icons.Download size={14} /></button>
                    <div className="text-[10px] text-gray-400 mt-2 font-mono uppercase tracking-wider">Scan to View Case</div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <button onClick={() => setShowViewModal(true)} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 active:scale-95"><div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Icons.Info size={18} /></div><span className="text-xs font-medium">View Report</span></button>
                    <button onClick={handlePrint} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 active:scale-95"><div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center"><Icons.Printer size={18} /></div><span className="text-xs font-medium">Print</span></button>
                    <button onClick={handleDownloadReport} className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 active:scale-95"><div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center"><Icons.Download size={18} /></div><span className="text-xs font-medium">Download</span></button>
                    <button onClick={handleShare} className="col-span-3 flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 active:scale-95"><div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><Icons.Share size={18} /></div><span className="text-xs font-medium">Share</span></button>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t pt-4">
                    <button onClick={() => { setStep('EDIT'); }} className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg"><Icons.Edit size={16} /> Edit Report</button>
                    <button onClick={handleDelete} className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"><Icons.Trash size={16} /> Delete</button>
                </div>
                <button onClick={onSuccess} className="mt-4 w-full py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-200 transition-colors">Close</button>
                </div>

                {showViewModal && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center">
                                <h3 className="font-bold text-lg">Incident Report #{submittedId}</h3>
                                <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><Icons.X size={20} /></button>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                    <div><span className="text-gray-500">Type:</span> <span className="font-semibold">{type}</span></div>
                                    <div><span className="text-gray-500">Urgency:</span> <span className={`font-semibold ${urgency === 'Critical' ? 'text-red-600' : ''}`}>{urgency}</span></div>
                                    <div><span className="text-gray-500">Department:</span> <span className="font-semibold">{department}</span></div>
                                    <div><span className="text-gray-500">Status:</span> <span className="font-semibold text-green-600">Submitted</span></div>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-xs uppercase font-bold mb-1">Description</span>
                                    <p className="text-gray-800">{description}</p>
                                </div>
                                <div>
                                    <span className="text-gray-500 block text-xs uppercase font-bold mb-1">Location (GPS)</span>
                                    <p className="font-mono text-xs">{location?.lat?.toFixed(6)}, {location?.lng?.toFixed(6)}</p>
                                    <a href={`https://www.google.com/maps?q=${location?.lat},${location?.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 text-xs mt-1 inline-flex items-center gap-1">View on map <Icons.ChevronRight size={12} /></a>
                                </div>
                                {(contactPerson || contactPhone) && (
                                    <div>
                                        <span className="text-gray-500 block text-xs uppercase font-bold mb-1">Contact</span>
                                        <p>{contactPerson} {contactPhone}</p>
                                    </div>
                                )}
                                {(repairDays > 0 || cost > 0 || mitigation) && (
                                    <div>
                                        <span className="text-gray-500 block text-xs uppercase font-bold mb-1">Advanced</span>
                                        <p>{[repairDays > 0 && `${repairDays} days repair`, cost > 0 && `€${cost}`, mitigation].filter(Boolean).join(' • ')}</p>
                                    </div>
                                )}
                                <div>
                                    <span className="text-gray-500 block text-xs uppercase font-bold mb-1">Attachments</span>
                                    <p className="flex gap-2 flex-wrap">{image && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Image</span>}{video && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Video</span>}{audio && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Audio</span>}{!image && !video && !audio && <span className="text-gray-400">None</span>}</p>
                                </div>
                            </div>
                            <div className="p-4 border-t flex gap-2">
                                <button onClick={handlePrint} className="flex-1 py-2 rounded-xl bg-gray-100 font-semibold text-gray-700 flex items-center justify-center gap-2"><Icons.Printer size={16} /> Print</button>
                                <button onClick={handleDownloadReport} className="flex-1 py-2 rounded-xl bg-black text-white font-semibold flex items-center justify-center gap-2"><Icons.Download size={16} /> Download</button>
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
            <form onSubmit={(e) => {
                e.preventDefault();
                if (!location) {
                    alert('Please confirm your location first. Tap "Use GPS" or wait for GPS to lock.');
                    return;
                }
                setStep('REVIEW');
            }} className="space-y-4 pb-6">
                <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hazard Type</label><select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"><option>Structural Fire</option><option>Flash Flood</option><option>Medical Emergency</option><option>Power Outage</option><option>Hazardous Spill</option><option>Other</option></select></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Department</label><select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"><option>Maintenance</option><option>IT</option><option>Operations</option><option>Security</option><option>HR</option></select></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Urgency</label><div className="flex bg-gray-100 p-1 rounded-xl">{['Low', 'Medium', 'High', 'Critical'].map((u) => (<button key={u} type="button" onClick={() => setUrgency(u as any)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${urgency === u ? 'bg-white shadow text-black' : 'text-gray-500'}`}>{u}</button>))}</div></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the situation..." className="w-full p-3 rounded-xl border border-gray-300 text-sm min-h-20 resize-y" rows={4} required /></div>
                
                {/* Optional Contact Fields */}
                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                    <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Icons.User size={12}/> Contact Info (Optional)</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 text-sm" placeholder="Your Name" />
                        </div>
                        <div>
                            <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 text-sm" placeholder="Phone Number" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3"><input type="checkbox" id="repeatable" checked={repeatable} onChange={(e) => setRepeatable(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"/><label htmlFor="repeatable" className="text-sm font-medium text-gray-700">This is a Repeatable Incident</label></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label><button type="button" onClick={handleGetLocation} className={`w-full p-3 rounded-xl border border-dashed flex items-center justify-between transition-colors ${location ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}><div className="flex items-center gap-2">{locating ? <span className="animate-pulse">…</span> : location ? <Icons.Check size={16} /> : <Icons.MapPin size={16} />}<span className="text-sm font-medium">{locating ? 'Syncing…' : location ? 'Live' : 'Waiting for GPS…'}</span></div>{location && <span className="text-xs font-mono">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>}</button>
                {locating && !location && <p className="text-xs text-gray-500 mt-1">Auto-syncing your location. Tap above to refresh.</p>}
                {type.toLowerCase().includes('flood') && (
                    <p className="text-xs text-blue-600 mt-2 flex items-center gap-1.5 bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <Icons.Info size={14} className="shrink-0" />
                        {t('floodPlacementHint')}
                    </p>
                )}
                </div>
                {typeof window !== 'undefined' && window.L && (
                    <div className="rounded-xl overflow-hidden border border-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Incident Location Map <span className="text-green-600 font-normal">(GPS active)</span></p>
                        <div className="w-full aspect-[4/3] min-h-[200px]">
                            <IncidentMap
                                reports={location ? [{ id: 0, lat: location.lat, lng: location.lng, type, description: '', timestamp: new Date().toLocaleTimeString(), status: 'pending' }] : []}
                                centerLat={location?.lat ?? 16.866}
                                centerLng={location?.lng ?? 96.195}
                                showUserLocation
                                onLocationUpdate={handleLocationUpdate}
                            />
                        </div>
                    </div>
                )}
                <div className="border-t pt-3">
                    <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm font-bold text-blue-600"><Icons.ChevronRight size={16} className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`} /> Advanced Details</button>
                    {showAdvanced && (
                        <div className="mt-3 space-y-3 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Structural Damage</label><select value={structuralDamage} onChange={(e) => setStructuralDamage(e.target.value)} className="w-full p-2 rounded-lg border text-sm"><option>None</option><option>Minor</option><option>Major</option><option>Total Loss</option></select></div><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Est. Repair (Days)</label><input type="number" value={repairDays} onChange={(e) => setRepairDays(Number(e.target.value))} className="w-full p-2 rounded-lg border text-sm"/></div></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Est. Cost (€)</label><input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} className="w-full p-2 rounded-lg border text-sm"/></div>
                            <div className="flex flex-col gap-2"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={discussed} onChange={(e) => setDiscussed(e.target.checked)} className="rounded text-blue-600"/> Situation Discussed</label></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Follow-up / Mitigation</label><textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} placeholder="Required actions..." className="w-full p-2 rounded-lg border text-sm h-16"/></div>
                        </div>
                    )}
                </div>
                <div className="border-t pt-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Evidence & Media</label>
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
                                            Retake
                                        </button>
                                        <button type="button" onClick={savePhoto} className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]">
                                            <Icons.Check size={24} aria-hidden /> Save Photo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-4">
                                        <button type="button" onClick={closeCamera} className="flex-1 py-4 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-bold text-lg shadow-lg active:scale-[0.98]">
                                            Cancel
                                        </button>
                                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); takePhoto(); }} disabled={!cameraReady} className={`flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] ${cameraReady ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}>
                                            <Icons.Camera size={24} aria-hidden /> {cameraReady ? 'Take Photo' : 'Loading...'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
                <div className="flex gap-3 pt-4">
                    {!location && <p className="text-xs text-gray-500">Location will sync automatically. Tap the location button above to refresh if needed.</p>}
                    <button type="submit" disabled={!location} className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg shadow-gray-200 ${location ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>{initialData ? t('save') : t('reviewReport')}</button>
                </div>
            </form>
        </div>
    );
};

export default ReportForm;
