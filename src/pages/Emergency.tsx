import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/Icon';
import { IncidentReport } from '../types';
import { fetchReports, updateReportStatus, incidentBelongsToReporter, deleteReport } from '../services/api';
import ReportForm from '../components/ReportForm';
import IncidentMap from '../components/IncidentMap';
import ReportTriageBarV2, { type ReportProgressStep, type ReportTriageKind } from '../components/ReportTriageBarV2';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { sendSosViaBluetooth } from '../services/bleDistress';
import { announceSosLocationSpeech, startSosLocalAlarm, stopSosLocalAlarm } from '../services/sosLocalAlarm';

/** Search + filter row under Reports / Active / History (see Report_UI_Layout.md). */
const EmergencyListToolbar: React.FC<{
    searchValue: string;
    onSearchChange: (v: string) => void;
    filtersOpen: boolean;
    onToggleFilters: () => void;
    filterHighlight: boolean;
    searchPlaceholder: string;
    searchAria: string;
    filterButtonLabel: string;
    children?: React.ReactNode;
}> = ({
    searchValue,
    onSearchChange,
    filtersOpen,
    onToggleFilters,
    filterHighlight,
    searchPlaceholder,
    searchAria,
    filterButtonLabel,
    children,
}) => (
    <>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
            <div className="relative min-w-0 flex-1">
                <Icons.Search
                    className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-gray-400"
                    size={16}
                    aria-hidden
                />
                <input
                    type="search"
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchAria}
                    className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-black focus:outline-none focus:ring-0"
                    autoComplete="off"
                />
            </div>
            <button
                type="button"
                onClick={onToggleFilters}
                aria-label={filterButtonLabel}
                className={`flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition-colors sm:min-w-[7.5rem] ${
                    filterHighlight || filtersOpen
                        ? 'border-gray-900 bg-gray-100 text-gray-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
            >
                <Icons.Filter size={16} className="shrink-0 text-gray-600" aria-hidden />
                <span>{filterButtonLabel}</span>
            </button>
        </div>
        {filtersOpen ? (
            <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">{children}</div>
        ) : null}
    </>
);

/** Reporter may update their own submission only while it awaits responder approval. */
const canEditOwnReportBeforeApproval = (
    report: IncidentReport,
    userId: string | undefined,
    myReportIds: Set<string>
): boolean => {
    const s = (report.status || '').toLowerCase();
    if (s !== 'pending' && s !== 'info_requested' && s !== 'delayed') return false;
    if (userId == null || userId === '') return false;
    if (report.reporterId != null && String(report.reporterId) === userId) return true;
    return myReportIds.has(report.id);
};

/** Admin / Responder: triage on incoming queue (Report_UI_Layout.md) */
const canUseEmergencyTriage = (role: string | undefined): boolean =>
    role === 'Responder' || role === 'Admin';

const isActiveLikeStatus = (status?: string): boolean => {
    const s = (status || '').toLowerCase();
    return (
        s === 'active' ||
        s === 'approved' ||
        s === 'en_route' ||
        s === 'on_scene'
    );
};

const Emergency: React.FC = () => {
    const { t, translateDescription, translateReportType } = useLanguage();
    const { user } = useUser();
    const isStaff = canUseEmergencyTriage(user?.role);
    const [reports, setReports] = useState<IncidentReport[]>([]);
    const [showReportForm, setShowReportForm] = useState(false);
    const [editingReport, setEditingReport] = useState<IncidentReport | null>(null);
    const [viewMode, setViewMode] = useState<'reports' | 'active' | 'history'>('reports');
    const [emergencyState, setEmergencyState] = useState<'normal' | 'safe' | 'sos'>('normal');
    const [sosLocation, setSosLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [sosLocationStatus, setSosLocationStatus] = useState<'fetching' | 'ok' | 'error'>('ok');
    const [bleState, setBleState] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'unsupported'>('idle');
    const [bleError, setBleError] = useState<string | null>(null);
    
    // Details modal state
    const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
    const [triageEditorOpen, setTriageEditorOpen] = useState(false);

    useEffect(() => {
        if (!selectedReport) setTriageEditorOpen(false);
    }, [selectedReport]);

    const [reportsSearch, setReportsSearch] = useState('');
    const [reportsFiltersOpen, setReportsFiltersOpen] = useState(false);
    const [reportsFType, setReportsFType] = useState('all');
    const [reportsFUrgency, setReportsFUrgency] = useState('all');
    const [reportsFQueueStatus, setReportsFQueueStatus] = useState('all');

    const [activeSearch, setActiveSearch] = useState('');
    const [activeFiltersOpen, setActiveFiltersOpen] = useState(false);
    const [activeFType, setActiveFType] = useState('all');
    const [activeFUrgency, setActiveFUrgency] = useState('all');
    const [activeFStage, setActiveFStage] = useState('all');

    const [historySearch, setHistorySearch] = useState('');
    const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
    const [historyFType, setHistoryFType] = useState('all');
    const [historyFUrgency, setHistoryFUrgency] = useState('all');
    const [historyFOutcome, setHistoryFOutcome] = useState('all');

    const sortedReports = useMemo(() => {
        return [...reports].sort((a, b) => {
            const tA = Date.parse(a.timestamp);
            const tB = Date.parse(b.timestamp);
            if (!Number.isNaN(tA) && !Number.isNaN(tB)) return tB - tA;
            const nb = Number(b.id);
            const na = Number(a.id);
            if (Number.isFinite(nb) && Number.isFinite(na)) return nb - na;
            return String(b.id).localeCompare(String(a.id));
        });
    }, [reports]);

    const activeReports = useMemo(() => {
        return sortedReports.filter(r => {
            const s = (r.status || '').toLowerCase();
            return (
                s === 'active' ||
                s === 'approved' ||
                s === 'en_route' ||
                s === 'on_scene'
            );
        });
    }, [sortedReports]);

    const queuedReports = useMemo(() => {
        return sortedReports.filter(r => {
            const s = (r.status || '').toLowerCase();
            return s === 'pending' || s === 'info_requested' || s === 'delayed';
        });
    }, [sortedReports]);

    /**
     * Resolved / rejected: staff see all incidents.
     * Reporters: scan full feed (same source as responders) so closed rows are not dropped when
     * reporterId was stripped on merge/server — use same ownership rules as fetchMyReports.
     */
    const historyReportsList = useMemo(() => {
        const isClosed = (r: IncidentReport) => {
            const s = (r.status || '').toLowerCase();
            return s === 'resolved' || s === 'rejected';
        };
        if (canUseEmergencyTriage(user?.role)) {
            return sortedReports.filter(isClosed);
        }
        return sortedReports.filter(
            (r) => isClosed(r) && incidentBelongsToReporter(r, user ?? undefined)
        );
    }, [sortedReports, user]);

    const reportMatchesSearch = useCallback(
        (r: IncidentReport, q: string) => {
            if (!q.trim()) return true;
            const needle = q.trim().toLowerCase();
            const hay = [
                String(r.id),
                r.type,
                translateReportType(r.type),
                r.description,
                translateDescription(r.description),
                r.department ?? '',
                r.contactPerson ?? '',
            ]
                .join(' ')
                .toLowerCase();
            return hay.includes(needle);
        },
        [translateDescription, translateReportType]
    );

    const queueTypeOptions = useMemo(
        () => Array.from(new Set(queuedReports.map((r) => r.type))).sort(),
        [queuedReports]
    );
    const activeTypeOptions = useMemo(
        () => Array.from(new Set(activeReports.map((r) => r.type))).sort(),
        [activeReports]
    );
    const historyTypeOptions = useMemo(
        () => Array.from(new Set(historyReportsList.map((r) => r.type))).sort(),
        [historyReportsList]
    );

    const filteredQueuedReports = useMemo(() => {
        return queuedReports.filter((r) => {
            if (!reportMatchesSearch(r, reportsSearch)) return false;
            if (reportsFType !== 'all' && r.type !== reportsFType) return false;
            if (reportsFUrgency !== 'all' && r.urgency !== reportsFUrgency) return false;
            if (reportsFQueueStatus !== 'all') {
                const s = (r.status || '').toLowerCase();
                if (reportsFQueueStatus === 'pending' && s !== 'pending') return false;
                if (reportsFQueueStatus === 'info_requested' && s !== 'info_requested')
                    return false;
                if (reportsFQueueStatus === 'delayed' && s !== 'delayed') return false;
            }
            return true;
        });
    }, [
        queuedReports,
        reportsSearch,
        reportsFType,
        reportsFUrgency,
        reportsFQueueStatus,
        reportMatchesSearch,
    ]);

    const filteredActiveReports = useMemo(() => {
        return activeReports.filter((r) => {
            if (!reportMatchesSearch(r, activeSearch)) return false;
            if (activeFType !== 'all' && r.type !== activeFType) return false;
            if (activeFUrgency !== 'all' && r.urgency !== activeFUrgency) return false;
            if (activeFStage !== 'all') {
                const s = (r.status || '').toLowerCase();
                if (activeFStage === 'accepted' && !(s === 'active' || s === 'approved'))
                    return false;
                if (activeFStage === 'en_route' && s !== 'en_route') return false;
                if (activeFStage === 'on_scene' && s !== 'on_scene') return false;
            }
            return true;
        });
    }, [
        activeReports,
        activeSearch,
        activeFType,
        activeFUrgency,
        activeFStage,
        reportMatchesSearch,
    ]);

    const filteredHistoryReports = useMemo(() => {
        return historyReportsList.filter((r) => {
            if (!reportMatchesSearch(r, historySearch)) return false;
            if (historyFType !== 'all' && r.type !== historyFType) return false;
            if (historyFUrgency !== 'all' && r.urgency !== historyFUrgency) return false;
            if (historyFOutcome !== 'all') {
                const s = (r.status || '').toLowerCase();
                if (historyFOutcome === 'resolved' && s !== 'resolved') return false;
                if (historyFOutcome === 'rejected' && s !== 'rejected') return false;
            }
            return true;
        });
    }, [
        historyReportsList,
        historySearch,
        historyFType,
        historyFUrgency,
        historyFOutcome,
        reportMatchesSearch,
    ]);

    const myReportIds = useMemo(
        () =>
            new Set(
                sortedReports
                    .filter((r) => incidentBelongsToReporter(r, user ?? undefined))
                    .map((r) => r.id)
            ),
        [sortedReports, user]
    );

    const canDeleteSelectedReport = useMemo(() => {
        if (!selectedReport) return false;
        const s = (selectedReport.status || '').toLowerCase();
        const isClosed = s === 'resolved' || s === 'rejected';
        if (!isClosed) return false;
        if (canUseEmergencyTriage(user?.role)) return true;
        return incidentBelongsToReporter(selectedReport, user ?? undefined);
    }, [selectedReport, user]);

    const handleDeleteSelectedReport = async () => {
        if (!selectedReport) return;
        if (!canDeleteSelectedReport) return;
        await deleteReport(selectedReport.id);
        await loadData();
        setSelectedReport(null);
    };
    const handleAcceptReport = async (reportId: string, note?: string) => {
        const messageForReporter = note?.trim() ? note.trim() : t('defaultActiveTeamOnTheWayMessage');
        await updateReportStatus(reportId, 'active', messageForReporter);
        await loadData();
        setSelectedReport(prev =>
            prev && String(prev.id) === String(reportId)
                ? { ...prev, status: 'active', adminNotes: messageForReporter }
                : prev
        );
    };

    const handleDelayReport = async (reportId: string, note?: string) => {
        await updateReportStatus(reportId, 'delayed', note);
        await loadData();
        setSelectedReport(prev =>
            prev && String(prev.id) === String(reportId)
                ? { ...prev, status: 'delayed', ...(note ? { adminNotes: note } : {}) }
                : prev
        );
    };

    /** PENDING: keep in incoming queue */
    const handlePendingReport = async (reportId: string, note?: string) => {
        await updateReportStatus(reportId, 'pending', note);
        await loadData();
        setSelectedReport(prev =>
            prev && String(prev.id) === String(reportId)
                ? { ...prev, status: 'pending', ...(note ? { adminNotes: note } : {}) }
                : prev
        );
    };

    const handleRejectReport = async (reportId: string, note?: string) => {
        if (!window.confirm(t('rejectReportConfirm'))) {
            throw new DOMException('User cancelled reject', 'AbortError');
        }
        await updateReportStatus(reportId, 'rejected', note);
        await loadData();
        setSelectedReport(prev =>
            prev && String(prev.id) === String(reportId)
                ? { ...prev, status: 'rejected', ...(note ? { adminNotes: note } : {}) }
                : prev
        );
    };

    const handleProgressReport = async (
        reportId: string,
        step: ReportProgressStep,
        note?: string
    ) => {
        const n = note?.trim() ? note.trim() : undefined;
        let nextStatus: IncidentReport['status'] = 'resolved';
        if (step === 'en_route') nextStatus = 'en_route';
        else if (step === 'on_scene') nextStatus = 'on_scene';
        await updateReportStatus(reportId, nextStatus, n);
        await loadData();
        if (step === 'completed') {
            setHistorySearch('');
            setHistoryFType('all');
            setHistoryFUrgency('all');
            setHistoryFOutcome('all');
            setHistoryFiltersOpen(false);
            setSelectedReport(null);
            setViewMode('history');
            return;
        }
        setSelectedReport(prev =>
            prev && String(prev.id) === String(reportId)
                ? {
                      ...prev,
                      status: nextStatus,
                      ...(n != null ? { adminNotes: n } : {}),
                  }
                : prev
        );
    };

    const handleReopenReport = async (reportId: string, note?: string) => {
        const messageForReporter = note?.trim()
            ? note.trim()
            : t('defaultActiveTeamOnTheWayMessage');
        await updateReportStatus(reportId, 'active', messageForReporter);
        await loadData();
        setSelectedReport(prev =>
            prev && String(prev.id) === String(reportId)
                ? {
                      ...prev,
                      status: 'active',
                      adminNotes: messageForReporter,
                  }
                : prev
        );
    };

    const renderStatusPill = (status?: string) => {
        const s = (status || '').toLowerCase();
        if (s === 'pending' || s === 'info_requested') {
            return <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-yellow-100 text-yellow-700">🟡 {t('pendingStatus')}</span>;
        }
        if (s === 'delayed') {
            return <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-amber-100 text-amber-800">⏸ {t('delayedStatus')}</span>;
        }
        if (s === 'rejected') {
            return <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-red-100 text-red-700">✕ {t('rejectedStatus')}</span>;
        }
        if (s === 'active' || s === 'approved') {
            return <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-green-100 text-green-700">🟢 {t('active')}</span>;
        }
        if (s === 'en_route') {
            return <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-sky-100 text-sky-800">🚐 {t('statusEnRoute')}</span>;
        }
        if (s === 'on_scene') {
            return <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-indigo-100 text-indigo-800">📍 {t('statusOnScene')}</span>;
        }
        if (s === 'resolved') {
            return <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-gray-100 text-gray-700">✅ {t('resolvedStatus')}</span>;
        }
        return <span className="text-[10px] font-bold px-2 py-1 rounded uppercase bg-gray-100 text-gray-600">{status || 'N/A'}</span>;
    };

    const loadData = async () => {
        const allReports = await fetchReports();
        setReports(allReports);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Refresh feeds after queued offline writes are synced.
    useEffect(() => {
        const handleQueueSynced = () => loadData();
        window.addEventListener('safesphere-offline-queue-synced', handleQueueSynced);
        return () => window.removeEventListener('safesphere-offline-queue-synced', handleQueueSynced);
    }, []);

    // Loud local alarm (siren + vibration + optional speech) while SOS is active — works without BLE.
    useEffect(() => {
        if (emergencyState !== 'sos') return;
        startSosLocalAlarm();
        return () => stopSosLocalAlarm();
    }, [emergencyState]);

    // Speak GPS once when coordinates become available (after user gesture from SOS tap).
    useEffect(() => {
        if (emergencyState !== 'sos') return;
        if (sosLocationStatus !== 'ok' || !sosLocation) return;
        announceSosLocationSpeech(sosLocation.lat, sosLocation.lng);
    }, [emergencyState, sosLocationStatus, sosLocation]);

    // BLE SOS: after GPS is ready, open the device picker and write to a responder-capable GATT characteristic.
    useEffect(() => {
        if (emergencyState !== 'sos') return;
        if (sosLocationStatus !== 'ok') return;
        if (!sosLocation) return;
        if (bleState !== 'idle') return;

        let cancelled = false;

        const run = async () => {
            setBleError(null);

            if (!(navigator as any).bluetooth) {
                setBleState('unsupported');
                return;
            }

            setBleState('sending');
            const res = await sendSosViaBluetooth({
                lat: sosLocation.lat,
                lng: sosLocation.lng,
                timestamp: Date.now(),
            });

            if (cancelled) return;

            if (res.ok) {
                setBleState('sent');
            } else {
                setBleState('failed');
                setBleError(res.message);
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [emergencyState, sosLocationStatus, sosLocation, bleState]);

    // Called when the user clicks "Close" on the Success screen of the ReportForm
    const handleReportFlowComplete = (wasEdit: boolean) => {
        setEditingReport(null);
        setShowReportForm(false);
        loadData();
        if (!wasEdit) setViewMode('history'); // New submission: show My Submissions
        else setViewMode('reports'); // Stay on queue tab after updating a pending report
    };

    if (showReportForm) {
        return (
            <div className="p-4 pt-8 min-h-screen">
                <ReportForm 
                    initialData={editingReport}
                    onCancel={() => { setEditingReport(null); setShowReportForm(false); }}
                    onSuccess={() => handleReportFlowComplete(!!editingReport)}
                />
            </div>
        );
    }

    if (emergencyState === 'safe') {
        return (
            <div className="fixed inset-0 z-[60] bg-green-500 flex flex-col items-center justify-center p-8 text-white animate-in zoom-in duration-300">
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-8 backdrop-blur-sm">
                    <Icons.Check size={64} strokeWidth={4} />
                </div>
                <h1 className="text-4xl font-black mb-4 text-center">{t('imSafe').toUpperCase()}</h1>
                <p className="text-xl font-medium text-green-50 text-center mb-12 max-w-xs">
                    {t('safeStatusUpdated')}
                </p>
                <button 
                    onClick={() => setEmergencyState('normal')}
                    className="w-full max-w-sm py-4 bg-white text-green-600 rounded-2xl font-bold text-lg shadow-xl hover:bg-green-50 transition-colors"
                >
                    {t('returnToDashboard')}
                </button>
            </div>
        );
    }

    if (emergencyState === 'sos') {
        return (
            <div className="fixed inset-0 z-[60] bg-red-600 flex flex-col items-center justify-center p-8 text-white animate-in zoom-in duration-300">
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-8 animate-pulse backdrop-blur-sm">
                    <Icons.Emergency size={64} strokeWidth={3} />
                </div>
                <h1 className="text-4xl font-black mb-2 text-center">{t('sosActivated')}</h1>
                <p className="text-lg font-medium text-red-100 text-center mb-8 max-w-xs">
                    {sosLocationStatus === 'fetching'
                        ? t('gettingLocation')
                        : bleState === 'sent'
                            ? t('emergencyNotified')
                            : bleState === 'failed'
                                ? t('sendSosWithoutInternet')
                                : t('broadcastingSignal')}
                </p>
                
                <div className="bg-white/10 p-6 rounded-2xl w-full max-w-sm mb-6 backdrop-blur-md border border-white/20 space-y-3">
                    <p className="text-xs text-red-100/95 leading-snug">{t('sosLocalAudibleHint')}</p>
                    <p className="text-xs text-red-100/90 leading-snug border-t border-white/15 pt-3">{t('sosBluetoothDeviceHint')}</p>
                    <div className="flex items-center gap-3 text-red-50 pt-1">
                        <Icons.MapPin size={20} />
                        <span className="font-mono text-sm">
                            {sosLocationStatus === 'fetching' && t('gettingLocation')}
                            {sosLocationStatus === 'ok' && sosLocation && `Lat: ${sosLocation.lat.toFixed(4)}, Lng: ${sosLocation.lng.toFixed(4)}`}
                            {sosLocationStatus === 'error' && t('locationUnavailable')}
                        </span>
                    </div>
                    <div className="flex items-start gap-3 text-red-50">
                        <Icons.Wifi size={20} className="shrink-0 mt-0.5" />
                        <span className="text-sm">
                            {bleState === 'sent'
                                ? t('emergencyNotified')
                                : bleState === 'failed'
                                    ? (bleError ? `${t('sendSosWithoutInternet')} (${bleError})` : t('sendSosWithoutInternet'))
                                    : bleState === 'unsupported'
                                        ? t('sendSosWithoutInternet')
                                        : t('broadcastingSignal')}
                        </span>
                    </div>
                </div>

                {bleState === 'failed' && (
                    <button
                        type="button"
                        onClick={() => {
                            setBleError(null);
                            setBleState('idle');
                        }}
                        className="w-full max-w-sm py-3 bg-white/10 text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-white/15 transition-colors mb-4"
                    >
                        Try Bluetooth Again
                    </button>
                )}

                {(bleState === 'failed' || bleState === 'unsupported') && (
                    <button
                        type="button"
                        onClick={() => {
                            stopSosLocalAlarm();
                            setEmergencyState('normal');
                            setSosLocation(null);
                            setSosLocationStatus('ok');
                            setBleState('idle');
                            setBleError(null);
                            setEditingReport(null);
                            setShowReportForm(true);
                        }}
                        className="w-full max-w-sm py-4 bg-white/10 text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-white/15 transition-colors mb-4"
                    >
                        {t('reportAnIncident')}
                    </button>
                )}

                <button 
                    onClick={() => {
                        stopSosLocalAlarm();
                        setEmergencyState('normal');
                        setSosLocation(null);
                        setSosLocationStatus('ok');
                        setBleState('idle');
                        setBleError(null);
                    }}
                    className="w-full max-w-sm py-4 bg-white text-red-600 rounded-2xl font-bold text-lg shadow-xl hover:bg-red-50 transition-colors"
                >
                    {t('cancelAlert')}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col pb-24 p-4 sm:p-5 md:p-6 min-h-screen relative">
             <div className="flex flex-col items-center text-center mb-8 mt-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4">
                    <Icons.Emergency size={32} />
                </div>
                <h1 className="text-2xl font-bold">{t('emergencyResponse')}</h1>
                <p className="text-gray-600 text-sm mt-2 max-w-xs">
                    {t('shareStatusReport')}<br/>{t('respondersNotified')}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <button 
                    onClick={() => setEmergencyState('safe')}
                    className="bg-green-500 hover:bg-green-600 active:scale-95 transition-all text-white rounded-xl p-8 flex flex-col items-center justify-center gap-3 shadow-lg shadow-green-200"
                >
                    <Icons.Check size={32} />
                    <span className="font-bold text-lg">{t('imSafe')}</span>
                </button>
                <button 
                    onClick={() => {
                        setSosLocationStatus('fetching');
                        setSosLocation(null);
                        setBleState('idle');
                        setBleError(null);
                        setEmergencyState('sos');
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => {
                                    setSosLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                                    setSosLocationStatus('ok');
                                },
                                () => setSosLocationStatus('error'),
                                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
                            );
                        } else {
                            setSosLocationStatus('error');
                        }
                    }}
                    className="bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white rounded-xl p-8 flex flex-col items-center justify-center gap-3 shadow-lg shadow-red-200"
                >
                    <Icons.Emergency size={32} />
                    <span className="font-bold text-lg">{t('sosHelp')}</span>
                </button>
            </div>

            <button 
                onClick={() => { setEditingReport(null); setShowReportForm(true); }}
                className="w-full py-4 border-2 border-dashed border-black rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors mb-8"
            >
                {t('reportAnIncident')}
            </button>

            {/* Content Toggles */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button 
                    onClick={() => setViewMode('reports')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'reports' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                    Reports
                </button>
                <button 
                    onClick={() => setViewMode('active')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'active' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                    Active
                </button>
                <button 
                    onClick={() => setViewMode('history')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'history' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                    {t('history')}
                </button>
            </div>

            {/* Reports */}
            {viewMode === 'reports' && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <Icons.FileText size={16} className="text-gray-500"/>
                        <h2 className="font-bold">Reports</h2>
                    </div>

                    <EmergencyListToolbar
                        searchValue={reportsSearch}
                        onSearchChange={setReportsSearch}
                        filtersOpen={reportsFiltersOpen}
                        onToggleFilters={() => setReportsFiltersOpen((o) => !o)}
                        filterHighlight={
                            reportsFType !== 'all' ||
                            reportsFUrgency !== 'all' ||
                            reportsFQueueStatus !== 'all'
                        }
                        searchPlaceholder={t('emergencySearchPlaceholder')}
                        searchAria={t('emergencySearchAria')}
                        filterButtonLabel={t('emergencyFilterButton')}
                    >
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                {t('hazardType')}
                            </label>
                            <select
                                value={reportsFType}
                                onChange={(e) => setReportsFType(e.target.value)}
                                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
                                aria-label={t('hazardType')}
                            >
                                <option value="all">{t('emergencyFilterAny')}</option>
                                {queueTypeOptions.map((ty) => (
                                    <option key={ty} value={ty}>
                                        {translateReportType(ty)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                {t('urgencyLabel')}
                            </label>
                            <select
                                value={reportsFUrgency}
                                onChange={(e) => setReportsFUrgency(e.target.value)}
                                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
                                aria-label={t('urgencyLabel')}
                            >
                                <option value="all">{t('emergencyFilterAny')}</option>
                                <option value="Low">{t('low')}</option>
                                <option value="Medium">{t('moderate')}</option>
                                <option value="High">{t('high')}</option>
                                <option value="Critical">{t('criticalSeverity')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                {t('emergencyFilterQueueStatus')}
                            </label>
                            <select
                                value={reportsFQueueStatus}
                                onChange={(e) => setReportsFQueueStatus(e.target.value)}
                                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
                                aria-label={t('emergencyFilterQueueStatus')}
                            >
                                <option value="all">{t('emergencyFilterAny')}</option>
                                <option value="pending">{t('pendingStatus')}</option>
                                <option value="info_requested">{t('infoRequestedStatus')}</option>
                                <option value="delayed">{t('delayedStatus')}</option>
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setReportsFType('all');
                                setReportsFUrgency('all');
                                setReportsFQueueStatus('all');
                            }}
                            className="text-xs font-bold text-blue-700 underline decoration-blue-400 underline-offset-2 min-h-[40px] px-0 py-1"
                        >
                            {t('emergencyFilterClear')}
                        </button>
                    </EmergencyListToolbar>

                    <div className="space-y-3">
                        {filteredQueuedReports.map(report => (
                            <div 
                                key={report.id}
                                onClick={() => setSelectedReport(report)}
                                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-blue-300 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">{translateReportType(report.type)}</span>
                                        <span className="text-xs text-gray-400">ID: #{report.id}</span>
                                    </div>
                                    {renderStatusPill(report.status)}
                                </div>
                                <p className="text-sm text-gray-700 mb-2 line-clamp-2">{translateDescription(report.description)}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
                                    <div className="flex items-center gap-1">
                                        <Icons.Calendar size={12} />
                                        {report.timestamp}
                                    </div>
                                    {report.department && (
                                        <div className="flex items-center gap-1">
                                            <Icons.User size={12} />
                                            {report.department}
                                        </div>
                                    )}
                                </div>
                                {canEditOwnReportBeforeApproval(report, user?.id, myReportIds) && (
                                    <div className="flex justify-end mt-2">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingReport(report);
                                                setShowReportForm(true);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors min-h-[40px]"
                                            title={t('editReport')}
                                        >
                                            <Icons.Edit size={14} />
                                            {t('editReport')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {filteredQueuedReports.length === 0 && (
                            <div className="text-center text-gray-400 py-4">
                                {queuedReports.length === 0
                                    ? t('noReportsSubmitted')
                                    : t('tryAdjustingSearch')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Active */}
            {viewMode === 'active' && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <h2 className="font-bold">Active</h2>
                    </div>

                    <EmergencyListToolbar
                        searchValue={activeSearch}
                        onSearchChange={setActiveSearch}
                        filtersOpen={activeFiltersOpen}
                        onToggleFilters={() => setActiveFiltersOpen((o) => !o)}
                        filterHighlight={
                            activeFType !== 'all' ||
                            activeFUrgency !== 'all' ||
                            activeFStage !== 'all'
                        }
                        searchPlaceholder={t('emergencySearchPlaceholder')}
                        searchAria={t('emergencySearchAria')}
                        filterButtonLabel={t('emergencyFilterButton')}
                    >
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                {t('hazardType')}
                            </label>
                            <select
                                value={activeFType}
                                onChange={(e) => setActiveFType(e.target.value)}
                                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
                                aria-label={t('hazardType')}
                            >
                                <option value="all">{t('emergencyFilterAny')}</option>
                                {activeTypeOptions.map((ty) => (
                                    <option key={ty} value={ty}>
                                        {translateReportType(ty)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                {t('urgencyLabel')}
                            </label>
                            <select
                                value={activeFUrgency}
                                onChange={(e) => setActiveFUrgency(e.target.value)}
                                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
                                aria-label={t('urgencyLabel')}
                            >
                                <option value="all">{t('emergencyFilterAny')}</option>
                                <option value="Low">{t('low')}</option>
                                <option value="Medium">{t('moderate')}</option>
                                <option value="High">{t('high')}</option>
                                <option value="Critical">{t('criticalSeverity')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                {t('emergencyFilterResponseProgress')}
                            </label>
                            <select
                                value={activeFStage}
                                onChange={(e) => setActiveFStage(e.target.value)}
                                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
                                aria-label={t('emergencyFilterResponseProgress')}
                            >
                                <option value="all">{t('emergencyFilterAny')}</option>
                                <option value="accepted">{t('active')}</option>
                                <option value="en_route">{t('statusEnRoute')}</option>
                                <option value="on_scene">{t('statusOnScene')}</option>
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveFType('all');
                                setActiveFUrgency('all');
                                setActiveFStage('all');
                            }}
                            className="text-xs font-bold text-blue-700 underline decoration-blue-400 underline-offset-2 min-h-[40px] px-0 py-1"
                        >
                            {t('emergencyFilterClear')}
                        </button>
                    </EmergencyListToolbar>

                    <div className="space-y-3">
                        {filteredActiveReports.map(report => (
                            <div
                                key={report.id}
                                onClick={() => setSelectedReport(report)}
                                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-blue-300 transition-colors"
                            >
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-sm">{translateReportType(report.type)}</span>
                                        <span className="text-xs text-gray-400">ID: #{report.id}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 max-w-[58%] shrink-0 text-right">
                                        {renderStatusPill(report.status)}
                                        <p className="text-[10px] font-medium leading-snug text-green-800 line-clamp-4">
                                            {(report.adminNotes || '').trim() || t('defaultActiveTeamOnTheWayMessage')}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-700 mb-2 line-clamp-2">{translateDescription(report.description)}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
                                    <div className="flex items-center gap-1">
                                        <Icons.Calendar size={12} />
                                        {report.timestamp}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredActiveReports.length === 0 && (
                            <div className="text-center text-gray-400 py-4">
                                {activeReports.length === 0
                                    ? t('noActiveReports')
                                    : t('tryAdjustingSearch')}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* History View (Offline Capable) */}
            {viewMode === 'history' && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <Icons.Clipboard size={16} className="text-gray-500"/>
                        <h2 className="font-bold">
                            {canUseEmergencyTriage(user?.role)
                                ? t('emergencyHistoryClosedReports')
                                : t('mySubmissions')}
                        </h2>
                    </div>

                    <EmergencyListToolbar
                        searchValue={historySearch}
                        onSearchChange={setHistorySearch}
                        filtersOpen={historyFiltersOpen}
                        onToggleFilters={() => setHistoryFiltersOpen((o) => !o)}
                        filterHighlight={
                            historyFType !== 'all' ||
                            historyFUrgency !== 'all' ||
                            historyFOutcome !== 'all'
                        }
                        searchPlaceholder={t('emergencySearchPlaceholder')}
                        searchAria={t('emergencySearchAria')}
                        filterButtonLabel={t('emergencyFilterButton')}
                    >
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                {t('hazardType')}
                            </label>
                            <select
                                value={historyFType}
                                onChange={(e) => setHistoryFType(e.target.value)}
                                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
                                aria-label={t('hazardType')}
                            >
                                <option value="all">{t('emergencyFilterAny')}</option>
                                {historyTypeOptions.map((ty) => (
                                    <option key={ty} value={ty}>
                                        {translateReportType(ty)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                {t('urgencyLabel')}
                            </label>
                            <select
                                value={historyFUrgency}
                                onChange={(e) => setHistoryFUrgency(e.target.value)}
                                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
                                aria-label={t('urgencyLabel')}
                            >
                                <option value="all">{t('emergencyFilterAny')}</option>
                                <option value="Low">{t('low')}</option>
                                <option value="Medium">{t('moderate')}</option>
                                <option value="High">{t('high')}</option>
                                <option value="Critical">{t('criticalSeverity')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                {t('emergencyFilterOutcome')}
                            </label>
                            <select
                                value={historyFOutcome}
                                onChange={(e) => setHistoryFOutcome(e.target.value)}
                                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm"
                                aria-label={t('emergencyFilterOutcome')}
                            >
                                <option value="all">{t('emergencyFilterAny')}</option>
                                <option value="resolved">{t('resolvedStatus')}</option>
                                <option value="rejected">{t('rejectedStatus')}</option>
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setHistoryFType('all');
                                setHistoryFUrgency('all');
                                setHistoryFOutcome('all');
                            }}
                            className="text-xs font-bold text-blue-700 underline decoration-blue-400 underline-offset-2 min-h-[40px] px-0 py-1"
                        >
                            {t('emergencyFilterClear')}
                        </button>
                    </EmergencyListToolbar>

                    <div className="space-y-3">
                        {filteredHistoryReports.length > 0 ? (
                            filteredHistoryReports.map(report => (
                                <div 
                                    key={report.id} 
                                    onClick={() => setSelectedReport(report)}
                                    className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-blue-300 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{translateReportType(report.type)}</span>
                                            <span className="text-xs text-gray-400">ID: #{report.id}</span>
                                        </div>
                                        {renderStatusPill(report.status)}
                                    </div>
                                    <p className="text-sm text-gray-700 mb-2 line-clamp-2">{translateDescription(report.description)}</p>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-50">
                                        <div className="flex items-center gap-1">
                                            <Icons.Calendar size={12} />
                                            {report.timestamp}
                                        </div>
                                        {report.department && (
                                            <div className="flex items-center gap-1">
                                                <Icons.User size={12} />
                                                {report.department}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                <Icons.FileText className="mx-auto text-gray-300 mb-2" size={32} />
                                <p className="text-gray-500 text-sm font-medium">
                                    {historyReportsList.length === 0
                                        ? canUseEmergencyTriage(user?.role)
                                            ? t('emergencyHistoryEmptyClosed')
                                            : t('emergencyHistoryEmptyMy')
                                        : t('tryAdjustingSearch')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- MY REPORT DETAIL MODAL --- */}
            {selectedReport && (
                <div
                    className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setSelectedReport(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('reportDetails')}
                >
                    <div className="bg-white w-full h-[80vh] sm:h-auto sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-10" onClick={(e) => e.stopPropagation()}>
                         <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="font-bold">{t('reportDetails')} #{selectedReport.id}</h3>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedReport(null); }} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-200 rounded-full" aria-label={t('close') || 'Close'}>
                                <Icons.X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                                    <Icons.FileText size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-lg">{selectedReport.type}</div>
                                    <div className="text-xs text-gray-500">{selectedReport.timestamp}</div>
                                </div>
                            </div>

                            <div className="bg-white border rounded-xl p-4 mb-4 shadow-sm">
                                <p className="text-sm text-gray-700">{translateDescription(selectedReport.description)}</p>
                            </div>

                            {selectedReport.lat != null && selectedReport.lng != null && typeof window !== 'undefined' && window.L && (
                                <div className="mb-4 rounded-xl overflow-hidden border border-gray-200">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2 px-2">{t('incidentLocationLabel')}</p>
                                    <div className="h-40 w-full">
                                        <IncidentMap reports={[selectedReport]} centerLat={selectedReport.lat} centerLng={selectedReport.lng} />
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between gap-3 border-b pb-2 items-start">
                                    <span className="text-gray-500 shrink-0">{t('status')}</span>
                                    <div className="text-right min-w-0">
                                        <div className="font-bold capitalize">
                                            {(() => {
                                                const s = (selectedReport.status || '').toLowerCase();
                                                if (s === 'resolved') return `✅ ${t('resolvedStatus')}`;
                                                if (s === 'rejected') return `✕ ${t('rejectedStatus')}`;
                                                if (s === 'delayed') return `⏸ ${t('delayedStatus')}`;
                                                if (s === 'en_route') return `🚐 ${t('statusEnRoute')}`;
                                                if (s === 'on_scene') return `📍 ${t('statusOnScene')}`;
                                                if (s === 'active' || s === 'approved')
                                                    return `🟢 ${t('active')}`;
                                                if (s === 'pending' || s === 'info_requested')
                                                    return `🟡 ${t('pendingStatus')}`;
                                                return selectedReport.status;
                                            })()}
                                        </div>
                                        {isActiveLikeStatus(selectedReport.status) && (
                                            <p className="mt-2 text-xs font-medium leading-snug text-green-800">
                                                {(selectedReport.adminNotes || '').trim() || t('defaultActiveTeamOnTheWayMessage')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">{t('urgencyLabel')}</span>
                                    <span className="font-bold">{selectedReport.urgency || t('notAvailable')}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">{t('incidentLocation')}</span>
                                    <span className="font-bold">{selectedReport.department || t('notAvailable')}</span>
                                </div>
                                {selectedReport.adminNotes && !isActiveLikeStatus(selectedReport.status) && (
                                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mt-4">
                                        <span className="block text-xs font-bold text-yellow-700 uppercase mb-1">{t('adminResponse')}</span>
                                        <p className="text-gray-800">{selectedReport.adminNotes}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
                            {viewMode === 'history' ? (
                                <div className="flex-1">
                                    <ReportTriageBarV2
                                        status={selectedReport.status}
                                        footerVariant="history"
                                        startOpen
                                        hideTriageControls={false}
                                        allowedTypes={isStaff ? undefined : (['pending', 'accept'] as const)}
                                        allowedStatuses={isStaff ? undefined : (['pending', 'active'] as const)}
                                        canDelete={canDeleteSelectedReport}
                                        onDelete={canDeleteSelectedReport ? handleDeleteSelectedReport : undefined}
                                        onOpenChange={setTriageEditorOpen}
                                        onAfterSave={() => setSelectedReport(null)}
                                        onAfterDelete={() => setSelectedReport(null)}
                                        onTriage={async (action, note) => {
                                            const id = selectedReport.id;
                                            if (isStaff) {
                                                if (action === 'accept') await handleAcceptReport(id, note);
                                                else if (action === 'delay') await handleDelayReport(id, note);
                                                else if (action === 'pending') await handlePendingReport(id, note);
                                                else await handleRejectReport(id, note);
                                                return;
                                            }

                                            // Reporter can only re-open as Pending or set back to Active.
                                            if (action === 'pending') await handlePendingReport(id, note);
                                            else if (action === 'accept') await handleAcceptReport(id, note);
                                        }}
                                        onProgress={
                                            isStaff
                                                ? async (step, note) => {
                                                      await handleProgressReport(selectedReport.id, step, note);
                                                  }
                                                : undefined
                                        }
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <ReportTriageBarV2
                                            status={selectedReport.status}
                                            footerVariant="default"
                                            hideTriageControls={false}
                                            allowedTypes={isStaff ? undefined : (['pending', 'accept'] as const)}
                                            allowedStatuses={isStaff ? undefined : (['pending', 'active'] as const)}
                                            canDelete={canDeleteSelectedReport}
                                            onDelete={canDeleteSelectedReport ? handleDeleteSelectedReport : undefined}
                                            onOpenChange={setTriageEditorOpen}
                                            onAfterSave={() => setSelectedReport(null)}
                                            onTriage={async (action, note) => {
                                                const id = selectedReport.id;
                                                if (isStaff) {
                                                    if (action === 'accept') await handleAcceptReport(id, note);
                                                    else if (action === 'delay') await handleDelayReport(id, note);
                                                    else if (action === 'pending') await handlePendingReport(id, note);
                                                    else await handleRejectReport(id, note);
                                                    return;
                                                }

                                                // Reporter can only re-open as Pending or set back to Active.
                                                if (action === 'pending') await handlePendingReport(id, note);
                                                else if (action === 'accept') await handleAcceptReport(id, note);
                                            }}
                                            onProgress={
                                                isStaff
                                                    ? async (step, note) => {
                                                          await handleProgressReport(selectedReport.id, step, note);
                                                      }
                                                    : undefined
                                            }
                                        />
                                    </div>

                                    {!triageEditorOpen && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedReport(null)}
                                            className="flex-shrink-0 w-[140px] py-3 bg-black text-white rounded-xl font-bold min-h-[44px]"
                                        >
                                            {t('close')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Emergency;
