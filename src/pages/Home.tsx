import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ChecklistItem, DrillSession, IncidentReport, User } from '../types';
import { Icons } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { fetchAlerts, fetchChecklist, fetchDrills, fetchEarthquakesByRange, fetchReports } from '../services/api';
import { fetchWeather, WeatherData } from '../services/weather';

interface HomeProps {
    onNavigate: (tab: string) => void;
    onOpenSystemStatus?: () => void;
}

/** Replaces first space with <br/> for two-line labels (e.g. "View Score Breakdown" → "View" / "Score Breakdown") */
const breakFirstSpace = (s: string) => s.replace(' ', '<br/>');

const Home: React.FC<HomeProps> = ({ onNavigate, onOpenSystemStatus }) => {
    const { t, translateDescription, translateAlertTitle } = useLanguage();
    const { user: contextUser } = useUser();
    const user = contextUser;
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [earthquakes, setEarthquakes] = useState<{ id: string; mag: number; place: string; time: number; title?: string; lat?: number; lng?: number }[]>([]);
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [drills, setDrills] = useState<DrillSession[]>([]);
    const [reports, setReports] = useState<IncidentReport[]>([]);
    const [showScoreDetails, setShowScoreDetails] = useState(false);
    const [chartRange, setChartRange] = useState<'24h' | '7d' | '1M' | '1Y'>('24h');
    const [showBroadcastForm, setShowBroadcastForm] = useState(false);
    const [broadcastForm, setBroadcastForm] = useState({
        title: '',
        severity: 'low' as 'low' | 'moderate' | 'high',
        type: 'general',
        description: ''
    });
    
    // Offline State Detection locally for UI
    const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

    // Live Coordinates (real Geolocation API)
    const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [coordsLoading, setCoordsLoading] = useState(true);
    const [coordsError, setCoordsError] = useState(false);

    // Live Weather (real Open-Meteo API)
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);

    useEffect(() => {
        if ('geolocation' in navigator) {
            setCoordsLoading(true);
            navigator.geolocation.getCurrentPosition(
                (p) => {
                    setLiveCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
                    setCoordsError(false);
                    setCoordsLoading(false);
                },
                () => {
                    setLiveCoords({ lat: 46.6231, lng: 14.3025 });
                    setCoordsError(true);
                    setCoordsLoading(false);
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
            );
        } else {
            setLiveCoords({ lat: 46.6231, lng: 14.3025 });
            setCoordsLoading(false);
        }
    }, []);

    const fetchWeatherForCoords = (coords: { lat: number; lng: number }, forceRefresh = false) => {
        setWeatherLoading(true);
        fetchWeather(coords.lat, coords.lng, forceRefresh)
            .then((data) => {
                setWeather(data);
                setWeatherLoading(false);
            })
            .catch(() => {
                setWeather(null);
                setWeatherLoading(false);
            });
    };

    useEffect(() => {
        if (!liveCoords) return;
        fetchWeatherForCoords(liveCoords);
    }, [liveCoords?.lat, liveCoords?.lng]);

    const syncLiveData = () => {
        if ('geolocation' in navigator) {
            setCoordsLoading(true);
            navigator.geolocation.getCurrentPosition(
                (p) => {
                    const coords = { lat: p.coords.latitude, lng: p.coords.longitude };
                    setLiveCoords(coords);
                    setCoordsError(false);
                    setCoordsLoading(false);
                    fetchWeatherForCoords(coords, true);
                },
                () => {
                    const fallback = { lat: 46.6231, lng: 14.3025 };
                    setLiveCoords(fallback);
                    setCoordsError(true);
                    setCoordsLoading(false);
                    fetchWeatherForCoords(fallback, true);
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        } else if (liveCoords) {
            setWeatherLoading(true);
            fetchWeatherForCoords(liveCoords, true);
        }
    };

    const loadSeismicData = useCallback(async (range: '24h' | '7d' | '1M' | '1Y') => {
        const eqData = await fetchEarthquakesByRange(range);
        setEarthquakes((eqData || []).map(e => {
            const coords = e.geometry?.coordinates;
            return {
                id: e.id || String(e.properties?.time),
                mag: e.properties?.mag ?? 0,
                place: e.properties?.place ?? '',
                time: e.properties?.time ?? 0,
                title: e.properties?.title,
                lat: coords ? coords[1] : undefined,
                lng: coords ? coords[0] : undefined
            };
        }));
    }, []);

    useEffect(() => {
        const loadData = async () => {
            const [alertData, checklistData, drillData, reportData] = await Promise.all([
                fetchAlerts(),
                fetchChecklist(),
                fetchDrills(),
                fetchReports()
            ]);
            setAlerts(alertData);
            setChecklist(checklistData);
            setDrills(drillData);
            setReports(reportData);
        };
        loadData();

        const handleOnline = () => setIsOfflineMode(false);
        const handleOffline = () => setIsOfflineMode(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Live seismic data – fetch by chartRange, refresh when range changes and every 2 min
    useEffect(() => {
        loadSeismicData(chartRange);
        const interval = setInterval(() => loadSeismicData(chartRange), 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [chartRange, loadSeismicData]);

    if (!user) return <div className="p-8 text-gray-700">Loading...</div>;

    // Handle broadcast alert submission
    const handleSendBroadcast = () => {
        if (!broadcastForm.title || !broadcastForm.description) {
            alert('Please fill in all required fields');
            return;
        }
        
        const newAlert: Alert = {
            id: Date.now(),
            title: broadcastForm.title,
            description: broadcastForm.description,
            severity: broadcastForm.severity,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            type: broadcastForm.type as any
        };
        
        setAlerts([newAlert, ...alerts]);
        setShowBroadcastForm(false);
        setBroadcastForm({ title: '', severity: 'low', type: 'general', description: '' });
    };

    // --- Dynamic Score Calculation ---
    // 1. Kit Readiness: Based on completed checklist items
    const completedItems = checklist.filter(i => i.completed);
    const kitMax = checklist.length * 10 || 50; // Fallback if empty
    const kitPoints = completedItems.reduce((acc, item) => acc + item.xp, 0);
    const kitProgress = (kitPoints / kitMax) * 100;
    
    // 2. Profile Completeness: Based on fields present
    let profilePoints = 0;
    const profileMax = 30;
    if (user.phone) profilePoints += 10;
    if (user.bloodType && user.bloodType !== 'Unknown') profilePoints += 10;
    if (user.skills && user.skills.length > 0) profilePoints += 10;
    const profileProgress = (profilePoints / profileMax) * 100;

    // 3. Drill Participation: Based on completed drills
    const completedDrills = drills.filter(d => d.status === 'Completed').length;
    const drillMax = 20;
    const drillPoints = Math.min(completedDrills * 10, drillMax);
    const drillProgress = (drillPoints / drillMax) * 100;

    const calculatedScore = Math.min(100, kitPoints + profilePoints + drillPoints);
    
    // Derived Level (translated)
    let level = t('beginner');
    if (calculatedScore > 40) level = t('awareCitizen');
    if (calculatedScore > 75) level = t('safetyExpert');

    // Suggest Action (translated)
    let nextAction = t('fullyPrepared');
    if (drillPoints < drillMax) nextAction = t('joinSafetyDrill');
    else if (profilePoints < profileMax) nextAction = t('completeProfile');
    else if (kitPoints < kitMax) nextAction = t('completeEmergencyKit');

    // SVG Score Props
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (calculatedScore / 100) * circumference;

    // Seismic Alerts - magnitude wave (X.XM), dotted line. Scale 1–8M (2025 Myanmar 7.7M).
    const MAG_MIN = 1;
    const MAG_MAX = 8;
    const DAY_COUNT = 7;
    const msPerDay = 24 * 60 * 60 * 1000;
    const msPer24h = msPerDay;

    const MYANMAR_CENTER = { lat: 21.0, lng: 96.0 };
    const seismicWaveData24h = useMemo(() => {
        const now = Date.now();
        const dayAgo = now - msPer24h;

        let points: { mag: number; time: number; lat?: number; lng?: number; place?: string }[] = [];
        if (earthquakes.length === 0) {
            // Day: narrower range (incidents in 24h tend to cluster) – e.g. 3.0–5.2M
            const demoMags = [3.2, 4.1, 3.5, 4.8, 3.8, 5.2, 3.0, 4.5, 3.6, 4.2];
            demoMags.forEach((mag, i) => {
                const t = dayAgo + (i / (demoMags.length - 1)) * msPer24h;
                points.push({ mag, time: t, lat: MYANMAR_CENTER.lat, lng: MYANMAR_CENTER.lng, place: 'Demo location' });
            });
        } else {
            earthquakes
                .filter(eq => (eq.time || 0) >= dayAgo)
                .sort((a, b) => (a.time || 0) - (b.time || 0))
                .forEach(eq => points.push({ mag: eq.mag || 0, time: eq.time || 0, lat: eq.lat, lng: eq.lng, place: eq.place }));
        }

        const hourLabels = ['00:00', '06:00', '12:00', '18:00', '24:00'];
        const allMags = points.map(p => p.mag);
        const dataMin = allMags.length ? Math.min(...allMags) : MAG_MIN;
        const dataMax = allMags.length ? Math.max(...allMags) : MAG_MAX;

        return { points, xLabels: hourLabels, xLabelCount: 5, minMag: dataMin, maxMag: dataMax, totalAlerts: points.length, timeRange: { start: dayAgo, end: dayAgo + msPer24h } };
    }, [earthquakes]);

    const MAX_POINTS_WEEK = 10; // Same density as Day for clear low/mod/high
    const seismicWaveData7d = useMemo(() => {
        const now = Date.now();
        const weekAgo = now - DAY_COUNT * msPerDay;
        const weekEnd = weekAgo + DAY_COUNT * msPerDay;

        let points: { mag: number; time: number; lat?: number; lng?: number; place?: string }[] = [];
        if (earthquakes.length === 0) {
            // Week: same density as Day – ~8 points for clear low/mod/high
            const demoMags = [2.5, 3.2, 4.5, 3.9, 5.2, 4.2, 3.5, 5.0];
            demoMags.forEach((mag, i) => {
                const t = weekAgo + (i / (demoMags.length - 1)) * (DAY_COUNT * msPerDay);
                points.push({ mag, time: t, lat: MYANMAR_CENTER.lat, lng: MYANMAR_CENTER.lng, place: 'Demo location' });
            });
        } else {
            const filtered = earthquakes
                .filter(eq => (eq.time || 0) >= weekAgo && (eq.time || 0) < weekEnd)
                .map(eq => ({ mag: eq.mag || 0, time: eq.time || 0, lat: eq.lat, lng: eq.lng, place: eq.place }))
                .sort((a, b) => a.time - b.time);
            if (filtered.length <= MAX_POINTS_WEEK) {
                points = filtered;
            } else {
                const byMag = [...filtered].sort((a, b) => a.mag - b.mag);
                const minP = byMag[0];
                const maxP = byMag[byMag.length - 1];
                const idxMin = filtered.findIndex(p => p.time === minP.time && p.mag === minP.mag);
                const idxMax = filtered.findIndex(p => p.time === maxP.time && p.mag === maxP.mag);
                const indices = new Set<number>([idxMin, idxMax]);
                for (let i = 0; i < MAX_POINTS_WEEK - 2; i++) {
                    indices.add(Math.min(Math.floor((i + 1) / (MAX_POINTS_WEEK - 1) * filtered.length), filtered.length - 1));
                }
                points = [...indices].sort((a, b) => a - b).map(i => filtered[i]).sort((a, b) => a.time - b.time);
            }
        }

        const dayLabels = [...Array(DAY_COUNT)].map((_, i) => {
            const d = new Date(weekAgo + i * msPerDay);
            return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
        });

        const allMags = points.length ? points.map(p => p.mag) : [];
        const dataMin = allMags.length ? Math.min(...allMags) : MAG_MIN;
        const dataMax = allMags.length ? Math.max(...allMags) : MAG_MAX;
        const totalAlerts = earthquakes.length === 0 ? points.length : earthquakes.filter(eq => (eq.time || 0) >= weekAgo && (eq.time || 0) < weekEnd).length;

        return { points, xLabels: dayLabels, xLabelCount: DAY_COUNT, minMag: dataMin, maxMag: dataMax, totalAlerts, timeRange: { start: weekAgo, end: weekEnd } };
    }, [earthquakes]);

    const MONTH_DAYS = 30;
    const MONTH_WEEKS = 5;
    const MAX_POINTS_MONTH = 12; // Same density as Year for clear low/mod/high
    const seismicWaveData1M = useMemo(() => {
        const now = Date.now();
        const monthAgo = now - MONTH_DAYS * msPerDay;
        const monthEnd = monthAgo + MONTH_DAYS * msPerDay;

        let points: { mag: number; time: number; lat?: number; lng?: number; place?: string }[] = [];
        if (earthquakes.length === 0) {
            // Month: same density as Year – ~10 points for clear low/mod/high
            const demoMags = [2.1, 3.5, 5.2, 4.0, 6.0, 3.1, 4.8, 2.5, 5.5, 6.4];
            demoMags.forEach((mag, i) => {
                const t = monthAgo + (i / (demoMags.length - 1)) * (MONTH_DAYS * msPerDay);
                points.push({ mag, time: t, lat: MYANMAR_CENTER.lat, lng: MYANMAR_CENTER.lng, place: 'Demo location' });
            });
        } else {
            const filtered = earthquakes
                .filter(eq => (eq.time || 0) >= monthAgo && (eq.time || 0) < monthEnd)
                .map(eq => ({ mag: eq.mag || 0, time: eq.time || 0, lat: eq.lat, lng: eq.lng, place: eq.place }))
                .sort((a, b) => a.time - b.time);
            if (filtered.length <= MAX_POINTS_MONTH) {
                points = filtered;
            } else {
                const byMag = [...filtered].sort((a, b) => a.mag - b.mag);
                const minP = byMag[0];
                const maxP = byMag[byMag.length - 1];
                const idxMin = filtered.findIndex(p => p.time === minP.time && p.mag === minP.mag);
                const idxMax = filtered.findIndex(p => p.time === maxP.time && p.mag === maxP.mag);
                const indices = new Set<number>([idxMin, idxMax]);
                for (let i = 0; i < MAX_POINTS_MONTH - 2; i++) {
                    indices.add(Math.min(Math.floor((i + 1) / (MAX_POINTS_MONTH - 1) * filtered.length), filtered.length - 1));
                }
                points = [...indices].sort((a, b) => a - b).map(i => filtered[i]).sort((a, b) => a.time - b.time);
            }
        }

        const weekLabels = [...Array(MONTH_WEEKS)].map((_, i) => {
            const d = new Date(monthAgo + i * 7 * msPerDay);
            return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
        });

        const allMags = points.length ? points.map(p => p.mag) : [];
        const dataMin = allMags.length ? Math.min(...allMags) : MAG_MIN;
        const dataMax = allMags.length ? Math.max(...allMags) : MAG_MAX;
        const totalAlerts = earthquakes.length === 0 ? points.length : earthquakes.filter(eq => (eq.time || 0) >= monthAgo && (eq.time || 0) < monthEnd).length;

        return { points, xLabels: weekLabels, xLabelCount: MONTH_WEEKS, minMag: dataMin, maxMag: dataMax, totalAlerts, timeRange: { start: monthAgo, end: monthEnd } };
    }, [earthquakes]);

    const YEAR_DAYS = 365;
    const seismicWaveData1Y = useMemo(() => {
        const now = Date.now();
        const yearAgo = now - YEAR_DAYS * msPerDay;

        let points: { mag: number; time: number; lat?: number; lng?: number; place?: string }[] = [];
        if (earthquakes.length === 0) {
            // Year: full range including major events – e.g. 2.0–7.7M
            const demoMags = [3.2, 5.1, 2.8, 4.5, 3.9, 5.8, 2.1, 4.2, 3.5, 6.0, 2.9, 4.8, 3.1, 5.2, 4.0, 2.5, 6.5, 3.8, 7.2, 2.0, 7.7];
            demoMags.forEach((mag, i) => {
                const t = yearAgo + (i / (demoMags.length - 1)) * (YEAR_DAYS * msPerDay);
                points.push({ mag, time: t, lat: MYANMAR_CENTER.lat, lng: MYANMAR_CENTER.lng, place: 'Demo location' });
            });
        } else {
            earthquakes
                .filter(eq => (eq.time || 0) >= yearAgo)
                .sort((a, b) => (a.time || 0) - (b.time || 0))
                .forEach(eq => points.push({ mag: eq.mag || 0, time: eq.time || 0, lat: eq.lat, lng: eq.lng, place: eq.place }));
        }

        const monthLabels = [...Array(12)].map((_, i) => {
            const d = new Date(yearAgo + (i + 0.5) * (YEAR_DAYS / 12) * msPerDay);
            return d.toLocaleDateString('en-GB', { month: 'short' });
        });

        const allMags = points.map(p => p.mag);
        const dataMin = allMags.length ? Math.min(...allMags) : MAG_MIN;
        const dataMax = allMags.length ? Math.max(...allMags) : MAG_MAX;
        const yearEnd = yearAgo + YEAR_DAYS * msPerDay;

        return { points, xLabels: monthLabels, xLabelCount: 12, minMag: dataMin, maxMag: dataMax, totalAlerts: points.length, timeRange: { start: yearAgo, end: yearEnd } };
    }, [earthquakes]);

    const seismicWaveData = chartRange === '24h' ? seismicWaveData24h : chartRange === '7d' ? seismicWaveData7d : chartRange === '1M' ? seismicWaveData1M : seismicWaveData1Y;

    // Active Alerts: seismic events (live, severity by chartRange) merged with other alerts, sorted newest first
    const sortedAlerts = useMemo(() => {
        const { minMag, maxMag, points } = seismicWaveData;
        const magRange = Math.max(maxMag - minMag, 0.5);
        const lowMax = minMag + magRange / 3;
        const modMax = minMag + (2 * magRange) / 3;
        const getSeverity = (mag: number): 'low' | 'moderate' | 'high' =>
            mag < lowMax ? 'low' : mag < modMax ? 'moderate' : 'high';
        const seismicAlertsList: Alert[] = points.slice(0, 5).map((p, idx) => ({
            id: 90000 + idx,
            title: `Seismic Event – M${p.mag.toFixed(1)}`,
            description: p.place || `Magnitude ${p.mag.toFixed(1)} earthquake detected.`,
            severity: getSeverity(p.mag),
            timestamp: p.time ? new Date(p.time).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
            type: 'earthquake' as const
        }));
        const merged = [...seismicAlertsList, ...alerts];
        return merged.sort((a, b) => {
            const tA = a.timestamp && /^\d/.test(a.timestamp) ? Date.parse(a.timestamp) : (a.id >= 90000 ? 1e15 : 0);
            const tB = b.timestamp && /^\d/.test(b.timestamp) ? Date.parse(b.timestamp) : (b.id >= 90000 ? 1e15 : 0);
            if (!Number.isNaN(tA) && !Number.isNaN(tB)) return tB - tA;
            if (a.type === 'earthquake' && b.type !== 'earthquake') return -1;
            if (b.type === 'earthquake' && a.type !== 'earthquake') return 1;
            if (!Number.isNaN(tA)) return -1;
            if (!Number.isNaN(tB)) return 1;
            return b.id - a.id;
        });
    }, [seismicWaveData, alerts]);

    return (
        <div className="home-page-content flex flex-col space-y-6 pb-24 p-4 relative min-h-screen">
            {/* Live Coordinates & Weather Bar - centred, same style as Check Status */}
            <button
                type="button"
                onClick={syncLiveData}
                disabled={coordsLoading || weatherLoading}
                aria-label={t('syncLiveData')}
                className="flex items-center justify-between w-full px-4 sm:px-5 py-3 rounded-2xl bg-slate-700 border border-slate-700 text-white shadow-lg cursor-pointer hover:bg-slate-600 active:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors text-left outline-none focus:outline-none focus:ring-0"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Icons.MapPin size={18} className="text-green-400 shrink-0" />
                    <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{t('liveCoordinates')}</div>
                        <div className="text-sm font-mono font-medium truncate">
                            {coordsLoading ? '...' : liveCoords ? `${liveCoords.lat.toFixed(4)}, ${liveCoords.lng.toFixed(4)}${coordsError ? ' (approx)' : ''}` : '—'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-3 border-l border-slate-500/50">
                    <Icons.CloudRain size={18} className="text-slate-200" />
                    <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{t('weather')}</div>
                        <div className="text-sm font-medium truncate">
                            {weatherLoading ? '...' : weather ? weather.displayText : isOfflineMode ? t('offline') : t('weatherUnavailable')}
                        </div>
                    </div>
                </div>
            </button>

            {/* Greeting & Status Hero */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{(() => { const h = new Date().getHours(); const key = h < 12 ? 'goodMorning' : h < 17 ? 'goodAfternoon' : 'goodEvening'; return t(key); })()}, {user.name}</h1>
                    <p className="text-sm text-gray-500 mt-1">{t('status')}: <span className="font-semibold text-black">{t('monitoring')}</span></p>
                    <div className="flex gap-2 mt-4">
                        <button 
                            onClick={onOpenSystemStatus}
                            className="px-4 py-2 bg-slate-700 text-white border border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
                        >
                            {t('checkStatus')}
                        </button>
                        <button 
                            onClick={() => onNavigate('prepare')}
                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all"
                        >
                            {t('viewKit')}
                        </button>
                    </div>
                </div>
                {/* Dynamic SVG Progress Ring */}
                <div className="flex flex-col items-center">
                    <div 
                        onClick={() => setShowScoreDetails(true)} 
                        className="relative w-28 h-28 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                    >
                        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                            {/* Background Ring */}
                            <circle
                                cx="60"
                                cy="60"
                                r={radius}
                                fill="none"
                                stroke="#f3f4f6" // gray-100
                                strokeWidth="10"
                            />
                            {/* Progress Ring */}
                            <circle
                                cx="60"
                                cy="60"
                                r={radius}
                                fill="none"
                                stroke={calculatedScore > 75 ? "#16a34a" : calculatedScore > 40 ? "#ca8a04" : "#ef4444"} 
                                strokeWidth="10"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute flex items-center justify-center">
                            <span className={`text-3xl font-black ${calculatedScore > 75 ? "text-green-600" : calculatedScore > 40 ? "text-yellow-600" : "text-red-500"}`}>
                                {calculatedScore}
                            </span>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Score</span>
                    <div className="flex items-center gap-0.5 mt-0.5">
                        <Icons.TrendingUp size={10} className={calculatedScore >= 75 ? "text-green-500" : calculatedScore >= 40 ? "text-amber-500" : "text-red-500"} />
                        <span className={`text-[9px] font-bold ${calculatedScore >= 75 ? "text-green-500" : calculatedScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                            {`${calculatedScore}%`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Active Alerts – live seismic data by chartRange */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        {t('activeAlerts')}
                        {!isOfflineMode && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200" title={t('liveData') || 'Live data'}>
                                Live
                            </span>
                        )}
                        {isOfflineMode && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold border border-orange-200">
                                {t('offline')}
                            </span>
                        )}
                    </h2>
                    {user?.role === 'Admin' && (
                        <button 
                            onClick={() => setShowBroadcastForm(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                        >
                            <Icons.Plus size={14} />
                            {t('broadcast')}
                        </button>
                    )}
                </div>
                <div className="space-y-3">
                    {sortedAlerts.slice(0, 3).map(alert => (
                        <div key={alert.id} className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 border-l-4 ${
                            alert.type === 'earthquake' ? 'border-l-amber-600' :
                            alert.severity === 'high' ? 'border-l-red-500' : 'border-l-orange-500'
                        }`}>
                            <div className="shrink-0 mt-1">
                                {alert.type === 'earthquake' ? (
                                    <Icons.AlertTriangle className="text-amber-600" />
                                ) : (
                                    <Icons.Emergency className={alert.severity === 'high' ? 'text-red-500' : 'text-orange-500'} />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-bold text-sm">{translateAlertTitle(alert.title)}</h3>
                                    {alert.type === 'earthquake' && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">Seismic</span>
                                    )}
                                    <span className="text-xs text-gray-400 ml-auto">{alert.timestamp}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{translateDescription(alert.description)}</p>
                            </div>
                        </div>
                    ))}
                    {sortedAlerts.length === 0 && <div className="text-gray-500 text-sm">{t('noActiveAlerts')}</div>}
                </div>
            </div>

            {/* Quick Actions - Report Incident & View Score Breakdown (prototype: both white cards) */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => onNavigate('emergency')}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center gap-2 active:scale-95 transition-transform"
                    aria-label={t('reportIncident')}
                >
                    <Icons.Emergency size={28} className="text-red-500" />
                    <span className="font-bold text-sm text-gray-900" dangerouslySetInnerHTML={{ __html: breakFirstSpace(t('reportIncident')) }} />
                </button>
                <button
                    onClick={() => setShowScoreDetails(true)}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center gap-2 active:scale-95 transition-transform"
                    aria-label={t('viewScoreBreakdown')}
                >
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center shadow-inner ring-1 ring-emerald-200/50">
                        <Icons.Trophy size={28} className="fill-amber-400 text-amber-600" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 1px 2px rgba(251,191,36,0.5))' }} />
                    </div>
                    <span className="font-bold text-sm text-gray-900" dangerouslySetInnerHTML={{ __html: breakFirstSpace(t('viewScoreBreakdown')) }} />
                </button>
            </div>

            {/* Seismic Alerts - magnitude wave (X.XM), dotted line, 24h or 7 days */}
            <div className="bg-[#e8e8e8] p-4 sm:p-5 rounded-xl border border-slate-400/60 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="font-bold text-sm text-slate-800">
                        {chartRange === '24h' ? t('incidentFrequencyByDay') : chartRange === '7d' ? t('incidentFrequencyByWeek') : chartRange === '1M' ? t('incidentFrequencyByMonth') : t('incidentFrequencyByYear')}
                    </h3>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setChartRange('24h')}
                            className={`px-2.5 py-1 text-[10px] font-semibold rounded border transition-colors ${chartRange === '24h' ? 'bg-slate-600 text-white border-slate-600' : 'bg-slate-200/80 text-slate-600 border-slate-300 hover:bg-slate-300/80'}`}
                            title={t('incidentFrequencyLast24h')}
                            aria-label={t('incidentFrequencyLast24h')}
                        >
                            24h
                        </button>
                        <button
                            type="button"
                            onClick={() => setChartRange('7d')}
                            className={`px-2.5 py-1 text-[10px] font-semibold rounded border transition-colors ${chartRange === '7d' ? 'bg-slate-600 text-white border-slate-600' : 'bg-slate-200/80 text-slate-600 border-slate-300 hover:bg-slate-300/80'}`}
                            title={t('incidentFrequencyByWeek')}
                            aria-label={t('incidentFrequencyByWeek')}
                        >
                            7d
                        </button>
                        <button
                            type="button"
                            onClick={() => setChartRange('1M')}
                            className={`px-2.5 py-1 text-[10px] font-semibold rounded border transition-colors ${chartRange === '1M' ? 'bg-slate-600 text-white border-slate-600' : 'bg-slate-200/80 text-slate-600 border-slate-300 hover:bg-slate-300/80'}`}
                            title={t('incidentFrequencyLast1Month')}
                            aria-label={t('incidentFrequencyLast1Month')}
                        >
                            1M
                        </button>
                        <button
                            type="button"
                            onClick={() => setChartRange('1Y')}
                            className={`px-2.5 py-1 text-[10px] font-semibold rounded border transition-colors ${chartRange === '1Y' ? 'bg-slate-600 text-white border-slate-600' : 'bg-slate-200/80 text-slate-600 border-slate-300 hover:bg-slate-300/80'}`}
                            title={t('incidentFrequencyLast1Year')}
                            aria-label={t('incidentFrequencyLast1Year')}
                        >
                            1Y
                        </button>
                    </div>
                    {seismicWaveData.totalAlerts > 0 && (
                        <span className="text-[10px] font-semibold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">
                            {seismicWaveData.totalAlerts} {t('seismicAlerts')} · {seismicWaveData.minMag.toFixed(1)}M – {seismicWaveData.maxMag.toFixed(1)}M
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-[9px] text-slate-600 mb-2" title={t('severityLegendHint')}>
                    {(() => {
                        const { minMag, maxMag } = seismicWaveData;
                        const range = Math.max(maxMag - minMag, 0.5);
                        const lowMax = minMag + range / 3;
                        const modMax = minMag + (2 * range) / 3;
                        const lowRange = `${minMag.toFixed(1)}–${lowMax.toFixed(1)}M`;
                        const modRange = `${lowMax.toFixed(1)}–${modMax.toFixed(1)}M`;
                        const highRange = `${modMax.toFixed(1)}–${maxMag.toFixed(1)}M`;
                        return (
                            <>
                                <span className="flex items-center gap-1" title={`${t('lowSeverity')} (${lowRange})`}><span className="w-2 h-2 rounded-full bg-green-500" /> Low {lowRange}</span>
                                <span className="flex items-center gap-1" title={`${t('moderateSeverity')} (${modRange})`}><span className="w-2 h-2 rounded-full bg-orange-500" /> Mod {modRange}</span>
                                <span className="flex items-center gap-1" title={`${t('highSeverity')} (${highRange})`}><span className="w-2 h-2 rounded-full bg-red-500" /> High {highRange}</span>
                            </>
                        );
                    })()}
                </div>
                <div className="bg-[#f5f5f5] rounded-lg border border-slate-300/80 overflow-hidden">
                    {(() => {
                        const { points, xLabels, xLabelCount, minMag, maxMag, timeRange } = seismicWaveData as typeof seismicWaveData & { timeRange?: { start: number; end: number } };
                        const chartTop = 20;
                        const chartBottom = 85;
                        const chartLeft = 38;
                        const chartRight = 278;
                        const chartH = chartBottom - chartTop;
                        const magRange = Math.max(maxMag - minMag, 0.5);
                        const toY = (mag: number) => chartBottom - ((Math.min(Math.max(mag, minMag), maxMag) - minMag) / magRange) * chartH;

                        const lowMax = minMag + magRange / 3;
                        const modMax = minMag + (2 * magRange) / 3;
                        const getSeverityLabel = (mag: number) => mag < lowMax ? t('lowSeverity') : mag < modMax ? t('moderateSeverity') : t('highSeverity');
                        const getSeverityRange = (mag: number) => mag < lowMax ? `${minMag.toFixed(1)}–${lowMax.toFixed(1)}M` : mag < modMax ? `${lowMax.toFixed(1)}–${modMax.toFixed(1)}M` : `${modMax.toFixed(1)}–${maxMag.toFixed(1)}M`;

                        const pts = points.map((p, i) => {
                            let x: number;
                            if (timeRange && (p as { time?: number }).time != null) {
                                const t = (p as { time: number }).time;
                                const frac = Math.max(0, Math.min(1, (t - timeRange.start) / (timeRange.end - timeRange.start)));
                                x = chartLeft + frac * (chartRight - chartLeft);
                            } else if (points.length > 1) {
                                x = chartLeft + (i / (points.length - 1)) * (chartRight - chartLeft);
                            } else {
                                x = chartLeft + (chartRight - chartLeft) / 2;
                            }
                            const y = toY(p.mag);
                            return [x, y, p] as const;
                        });
                        const linePoints = pts.map(([x, y]) => `${x},${y}`).join(' ');

                        const yTickCount = 5;
                        const yTicks = [...Array(yTickCount)].map((_, i) => minMag + (i / Math.max(yTickCount - 1, 1)) * magRange);
                        const divisor = Math.max(xLabelCount - 1, 1);
                        const handlePointClick = (p: { lat?: number; lng?: number; place?: string }) => {
                            if (p.lat != null && p.lng != null) {
                                try {
                                    sessionStorage.setItem('safesphere_map_focus', JSON.stringify({ lat: p.lat, lng: p.lng, place: p.place }));
                                    onNavigate('maps');
                                } catch (_) {}
                            }
                        };

                        return (
                            <div className="h-40 sm:h-44 relative px-1">
                                <svg viewBox="0 0 300 130" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                                    {/* Horizontal grid - magnitude labels with severity tooltip (Low 1-4M, Mod 4-6M, High 6-8M) */}
                                    {yTicks.map((magVal) => {
                                        const y = toY(magVal);
                                        const sevLabel = getSeverityLabel(magVal);
                                        const sevRange = getSeverityRange(magVal);
                                        return (
                                            <g key={magVal} title={`${sevLabel} (${sevRange})`}>
                                                <line x1={chartLeft} y1={y} x2={chartRight} y2={y} stroke="rgba(148,163,184,0.35)" strokeWidth="0.5" />
                                                <text x={chartLeft - 6} y={y + 3} textAnchor="end" fill="#475569" fontSize="9" fontWeight="600">{magVal.toFixed(1)}M</text>
                                            </g>
                                        );
                                    })}
                                    {/* Vertical grid */}
                                    {xLabels.map((_, i) => {
                                        const x = chartLeft + (i / divisor) * (chartRight - chartLeft);
                                        return (
                                            <line key={i} x1={x} y1={chartTop} x2={x} y2={chartBottom} stroke="rgba(148,163,184,0.2)" strokeWidth="0.5" />
                                        );
                                    })}
                                    {/* Dotted line - sound wave form */}
                                    <polyline fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 5" points={linePoints} />
                                    {/* Tiny data points - click to view location on map */}
                                    {pts.map(([x, y, p], i) => {
                                        const pTime = (p as { time?: number }).time;
                                        const labelIdx = (timeRange && pTime != null)
                                            ? Math.min(Math.floor(((pTime - timeRange.start) / (timeRange.end - timeRange.start)) * xLabelCount), xLabelCount - 1)
                                            : Math.min(Math.floor((i / Math.max(pts.length - 1, 1)) * xLabelCount), xLabelCount - 1);
                                        const showLabel = pts.length <= 15;
                                        const hasLocation = p.lat != null && p.lng != null;
                                        return (
                                            <g key={i} className={hasLocation ? 'cursor-pointer' : ''} onClick={() => hasLocation && handlePointClick(p)}>
                                                <circle cx={x} cy={y} r="1.5" fill="#f97316" stroke="none" />
                                                {showLabel && (
                                                    <text x={x} y={y - 6} textAnchor="middle" fill="#334155" fontSize="7" fontWeight="600">{p.mag.toFixed(1)}M</text>
                                                )}
                                                <title>{p.mag.toFixed(1)}M · {getSeverityLabel(p.mag)} ({getSeverityRange(p.mag)}) · {xLabels[labelIdx]} · {hasLocation ? t('clickToViewLocation') : ''}</title>
                                            </g>
                                        );
                                    })}
                                    {/* X-axis labels (24h: 00:00–24:00, 7d: day names) */}
                                    {xLabels.map((label, i) => {
                                        const x = chartLeft + (i / divisor) * (chartRight - chartLeft);
                                        return (
                                            <text key={i} x={x} y={chartBottom + 14} textAnchor="middle" fill="#64748b" fontSize="8" fontWeight="500">{label}</text>
                                        );
                                    })}
                                </svg>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Safety Score Modal */}
            {showScoreDetails && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in">
                    <div className="bg-slate-800 backdrop-blur-xl rounded-2xl w-full max-w-sm sm:max-w-md p-6 overflow-y-auto max-h-[90vh] shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">{t('scoreBreakdown')}</h2>
                            <button onClick={() => setShowScoreDetails(false)} className="text-slate-400 hover:text-white transition-colors">
                                <Icons.X size={24} />
                            </button>
                        </div>
                        
                        {/* Score breakdown with bar chart */}
                        {(() => {
                            const scoreZone = calculatedScore <= 40 ? 'low' : calculatedScore <= 75 ? 'middle' : 'high';
                            const zoneColors = {
                                low: { crownBg: 'bg-red-500/20', crownBorder: 'border-red-400/40', crownIcon: 'text-red-400', level: 'text-red-400', bar: 'bg-red-500' },
                                middle: { crownBg: 'bg-amber-500/20', crownBorder: 'border-amber-400/40', crownIcon: 'text-amber-400', level: 'text-amber-400', bar: 'bg-amber-500' },
                                high: { crownBg: 'bg-emerald-500/20', crownBorder: 'border-emerald-400/40', crownIcon: 'text-emerald-400', level: 'text-emerald-400', bar: 'bg-emerald-500' }
                            };
                            const c = zoneColors[scoreZone];
                            const barData = [
                                { label: t('kitReadinessTitle'), value: kitProgress },
                                { label: t('profileCompletenessTitle'), value: profileProgress },
                                { label: t('drillParticipation'), value: drillProgress }
                            ];
                            return (
                                <div className="mb-8 overflow-hidden rounded-2xl bg-slate-700/40 border border-slate-600/60">
                                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${c.crownBg} border ${c.crownBorder}`}>
                                                <Icons.Crown size={22} className={c.crownIcon} />
                                            </div>
                                            <span className="text-2xl font-black text-white">{calculatedScore}</span>
                                            <span className="text-[10px] font-medium text-slate-400 uppercase">{t('score')}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase ${c.level}`}>{t('level')}: {level}</span>
                                    </div>
                                    {/* Vertical bar chart - rounded tops */}
                                    <div className="px-4 pb-4">
                                        <div className="flex items-end justify-around gap-4 h-36 sm:h-40">
                                            {barData.map(({ label, value }, i) => {
                                                const pct = Math.min(100, Math.max(0, value));
                                                const barHeightPx = 112; /* ~h-28 */
                                                const h = Math.round((pct / 100) * barHeightPx);
                                                return (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                                                        <div className="w-full h-28 sm:h-32 flex flex-col justify-end items-center">
                                                            <div
                                                                className="w-full max-w-[48px] mx-auto rounded-t-lg bg-blue-500 transition-all duration-500 ease-out"
                                                                style={{ height: `${Math.max(pct > 0 ? 6 : 0, h)}px` }}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] font-medium text-slate-400 text-center leading-tight line-clamp-2">{label}</span>
                                                        <span className="text-[10px] font-bold text-white">{Math.round(value)}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/60 mb-6">
                            <h4 className="font-bold text-xs uppercase text-slate-400 mb-3 flex items-center gap-2"><Icons.Zap size={12} className="text-amber-400"/> Recommended Actions</h4>
                            <ul className="space-y-3">
                                {kitPoints < kitMax && (
                                    <li 
                                        onClick={() => { setShowScoreDetails(false); onNavigate('prepare'); }}
                                        className="flex items-center justify-between text-sm bg-slate-700 p-3 rounded-lg border border-slate-600 cursor-pointer hover:border-slate-400 transition-colors"
                                    >
                                        <span className="text-slate-200">{t('completePreparednessKit')}</span>
                                        <Icons.ChevronRight size={14} className="text-slate-500" />
                                    </li>
                                )}
                                {profilePoints < profileMax && (
                                    <li 
                                        onClick={() => { setShowScoreDetails(false); onNavigate('profile'); }}
                                        className="flex items-center justify-between text-sm bg-slate-700 p-3 rounded-lg border border-slate-600 cursor-pointer hover:border-slate-400 transition-colors"
                                    >
                                        <span className="text-slate-200">{t('updateMedicalProfile')}</span>
                                        <Icons.ChevronRight size={14} className="text-slate-500" />
                                    </li>
                                )}
                                {drillPoints < drillMax && (
                                    <li 
                                        onClick={() => { setShowScoreDetails(false); onNavigate('prepare'); }}
                                        className="flex items-center justify-between text-sm bg-slate-700 p-3 rounded-lg border border-slate-600 cursor-pointer hover:border-slate-400 transition-colors"
                                    >
                                        <span className="text-slate-200">{t('joinDrillSession')}</span>
                                        <Icons.ChevronRight size={14} className="text-slate-500" />
                                    </li>
                                )}
                                {calculatedScore === 100 && (
                                    <li className="text-sm text-emerald-300 font-bold bg-emerald-500/20 p-3 rounded-lg border border-emerald-500/30">
                                        {t('fullyPreparedMessage')}
                                    </li>
                                )}
                            </ul>
                        </div>

                        <button 
                            onClick={() => { setShowScoreDetails(false); }}
                            className="w-full py-3 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 transition-colors"
                        >
                            {t('closeBreakdown')}
                        </button>
                    </div>
                </div>
            )}

            {/* Broadcast Alert Form Modal */}
            {showBroadcastForm && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Icons.AlertTriangle className="text-orange-500" size={24} />
                                <h2 className="text-xl font-bold">{t('broadcastAlert')}</h2>
                            </div>
                            <button onClick={() => setShowBroadcastForm(false)} className="text-gray-400 hover:text-black transition-colors">
                                <Icons.X size={24} />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Alert Title */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('alertTitle')}</label>
                                <input 
                                    type="text" 
                                    value={broadcastForm.title}
                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                                    placeholder={t('alertTitlePlaceholder')}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>

                            {/* Severity and Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('severity')}</label>
                                    <select 
                                        value={broadcastForm.severity}
                                        onChange={(e) => setBroadcastForm({ ...broadcastForm, severity: e.target.value as any })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-gray-400 transition-colors"
                                    >
                                        <option value="low">{t('low')}</option>
                                        <option value="moderate">{t('moderate')}</option>
                                        <option value="high">{t('high')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('type')}</label>
                                    <select 
                                        value={broadcastForm.type}
                                        onChange={(e) => setBroadcastForm({ ...broadcastForm, type: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-gray-400 transition-colors"
                                    >
                                        <option value="general">{t('general')}</option>
                                        <option value="flood">{t('flood')}</option>
                                        <option value="fire">{t('fire')}</option>
                                        <option value="earthquake">{t('earthquake')}</option>
                                        <option value="storm">{t('storm')}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('description')}</label>
                                <textarea 
                                    value={broadcastForm.description}
                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, description: e.target.value })}
                                    placeholder={t('descriptionPlaceholder')}
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-gray-400 transition-colors resize-none"
                                />
                            </div>

                            {/* Send Alert Button */}
                            <button
                                onClick={handleSendBroadcast}
                                className="w-full py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-lg mt-2"
                            >
                                {t('sendAlert')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;