import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/Icon';
import { Alert, IncidentReport } from '../types';
import { fetchAlerts, fetchReports, fetchMyReports } from '../services/api';
import ReportForm from '../components/ReportForm';
import IncidentMap from '../components/IncidentMap';
import { useLanguage } from '../contexts/LanguageContext';

const Emergency: React.FC = () => {
    const { t, translateDescription, translateReportType, translateAlertTitle } = useLanguage();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [reports, setReports] = useState<IncidentReport[]>([]);
    const [myReports, setMyReports] = useState<IncidentReport[]>([]);
    const [showReportForm, setShowReportForm] = useState(false);
    const [viewMode, setViewMode] = useState<'feed' | 'map' | 'history'>('feed');
    const [emergencyState, setEmergencyState] = useState<'normal' | 'safe' | 'sos'>('normal');
    const [sosLocation, setSosLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [sosLocationStatus, setSosLocationStatus] = useState<'fetching' | 'ok' | 'error'>('ok');
    
    // Details Modals State
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);

    // Show up-to-date (latest) events above: sort alerts newest first
    const sortedAlerts = useMemo(() => {
        return [...alerts].sort((a, b) => {
            const tA = Date.parse(a.timestamp);
            const tB = Date.parse(b.timestamp);
            if (!Number.isNaN(tA) && !Number.isNaN(tB)) return tB - tA;
            if (!Number.isNaN(tA)) return -1;
            if (!Number.isNaN(tB)) return 1;
            return b.id - a.id;
        });
    }, [alerts]);

    // SOS map: show only one alarm (fire preferred) to avoid confusion
    const mapReports = useMemo(() => {
        if (reports.length === 0) return [];
            const earthquake = reports.find(r => {
            const t = (r.type || '').toUpperCase();
            return t.includes('EARTHQUAKE') || t.includes('FIRE') && !t.includes('FLOOD') || t.includes('STORM') || t.includes('TYPHOON') || t.includes('TSUNAMI') || t.includes('VOLCANO') || t.includes('HURRICANE');
        });
        const tsunami = reports.find(r => {
            const t = (r.type || '').toUpperCase();
            return t.includes('TSUNAMI');
        });
        const volcano = reports.find(r => {
            const t = (r.type || '').toUpperCase();
            return t.includes('VOLCANO');
        });
        const hurricane = reports.find(r => {
            const t = (r.type || '').toUpperCase();
            return t.includes('HURRICANE');
        });
        return earthquake ? [earthquake] : tsunami ? [tsunami] : volcano ? [volcano] : hurricane ? [hurricane] : [reports[0]];  
    }, [reports]);

    const loadData = () => {
        fetchAlerts().then(setAlerts);
        fetchReports().then(setReports);
        fetchMyReports().then(setMyReports);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Called when the user clicks "Close" on the Success screen of the ReportForm
    const handleReportFlowComplete = () => {
        setShowReportForm(false);
        loadData(); // Refresh all data, including the new submission
        setViewMode('history'); // Switch to history so user sees their new report
    };

    if (showReportForm) {
        return (
            <div className="p-4 pt-8 min-h-screen">
                <ReportForm 
                    onCancel={() => setShowReportForm(false)}
                    onSuccess={handleReportFlowComplete}
                />
            </div>
        );
    }

    if (emergencyState === 'safe') {
        return (
            <div className="fixed inset-0 z-50 bg-green-500 flex flex-col items-center justify-center p-8 text-white animate-in zoom-in duration-300">
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
            <div className="fixed inset-0 z-50 bg-red-600 flex flex-col items-center justify-center p-8 text-white animate-in zoom-in duration-300">
                <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-8 animate-pulse backdrop-blur-sm">
                    <Icons.Emergency size={64} strokeWidth={3} />
                </div>
                <h1 className="text-4xl font-black mb-2 text-center">{t('sosActivated')}</h1>
                <p className="text-lg font-medium text-red-100 text-center mb-8 max-w-xs">
                    {t('emergencyNotified')}
                </p>
                
                <div className="bg-white/10 p-6 rounded-2xl w-full max-w-sm mb-8 backdrop-blur-md border border-white/20">
                    <div className="flex items-center gap-3 mb-3 text-red-50">
                        <Icons.MapPin size={20} />
                        <span className="font-mono">
                            {sosLocationStatus === 'fetching' && t('gettingLocation')}
                            {sosLocationStatus === 'ok' && sosLocation && `Lat: ${sosLocation.lat.toFixed(4)}, Lng: ${sosLocation.lng.toFixed(4)}`}
                            {sosLocationStatus === 'error' && t('locationUnavailable')}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-red-50">
                        <Icons.Wifi size={20} />
                        <span>{t('broadcastingSignal')}</span>
                    </div>
                </div>

                <button 
                    onClick={() => { setEmergencyState('normal'); setSosLocation(null); setSosLocationStatus('ok'); }}
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
                onClick={() => setShowReportForm(true)}
                className="w-full py-4 border-2 border-dashed border-black rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors mb-8"
            >
                {t('reportAnIncident')}
            </button>

            {/* Content Toggles */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button 
                    onClick={() => setViewMode('feed')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'feed' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                    {t('activeAlerts')}
                </button>
                <button 
                    onClick={() => setViewMode('map')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'map' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                    {t('map')}
                </button>
                <button 
                    onClick={() => setViewMode('history')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'history' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                    {t('history')}
                </button>
            </div>

            {/* Map View - single alarm only (fire preferred) for clarity */}
            {viewMode === 'map' && (
                <div className="h-[400px] bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 mb-6 relative z-0">
                    <IncidentMap reports={mapReports} />
                </div>
            )}

            {/* Live Feed */}
            {viewMode === 'feed' && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <h2 className="font-bold">{t('activeAlerts')}</h2>
                    </div>

                    <div className="space-y-3">
                        {sortedAlerts.map(alert => (
                            <div 
                                key={alert.id} 
                                onClick={() => setSelectedAlert(alert)}
                                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden cursor-pointer hover:border-red-300 transition-colors"
                            >
                                {/* Severity + Type Tag */}
                                <div className={`absolute top-4 left-4 text-[10px] font-bold px-2 py-1 rounded uppercase ${
                                    alert.type === 'tsunami' ? 'bg-cyan-100 text-cyan-700' :
                                    alert.type === 'volcano' ? 'bg-red-100 text-red-700' :
                                    alert.type === 'hurricane' ? 'bg-violet-100 text-violet-700' :
                                    alert.type === 'storm' ? 'bg-indigo-100 text-indigo-700' :
                                    alert.type === 'earthquake' ? 'bg-amber-100 text-amber-700' :
                                    alert.type === 'flood' ? 'bg-blue-100 text-blue-700' :
                                    alert.type === 'fire' ? 'bg-orange-100 text-orange-700' :
                                    alert.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                }`}>
                                    {alert.type !== 'general' && alert.type !== 'heat' ? t(alert.type) : (alert.severity === 'high' ? t('highSeverity') : alert.severity === 'critical' ? t('criticalSeverity') : alert.severity === 'low' ? t('lowSeverity') : t('moderateSeverity'))}
                                </div>
                                <div className="flex justify-end mb-6">
                                    <span className="text-xs text-gray-500">{alert.timestamp}</span>
                                </div>
                                <h3 className="font-bold mb-1">{translateAlertTitle(alert.title)}</h3>
                                <p className="text-sm text-gray-600 line-clamp-2">{translateDescription(alert.description)}</p>
                            </div>
                        ))}
                        {sortedAlerts.length === 0 && (
                            <div className="text-center text-gray-400 py-4">{t('noActiveAlerts')}</div>
                        )}
                    </div>
                </div>
            )}

            {/* History View (Offline Capable) */}
            {viewMode === 'history' && (
                <div className="animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                        <Icons.Clipboard size={16} className="text-gray-500"/>
                        <h2 className="font-bold">{t('mySubmissions')}</h2>
                    </div>

                    <div className="space-y-3">
                        {myReports.length > 0 ? (
                            myReports.map(report => (
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
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                                            report.status === 'resolved' || report.status === 'approved' ? 'bg-green-100 text-green-700' : 
                                            report.status === 'active' ? 'bg-blue-100 text-blue-700' : 
                                            report.status === 'info_requested' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {report.status}
                                        </span>
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
                                <p className="text-gray-500 text-sm font-medium">{t('noReportsSubmitted')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- ALERT DETAIL MODAL --- */}
            {selectedAlert && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
                        <button 
                            onClick={() => setSelectedAlert(null)} 
                            className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"
                        >
                            <Icons.X size={20} />
                        </button>
                        
                        <div className="flex flex-col items-center mb-6 text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                                selectedAlert.type === 'tsunami' ? 'bg-cyan-100 text-cyan-700' :
                                selectedAlert.type === 'volcano' ? 'bg-red-100 text-red-700' :
                                selectedAlert.type === 'hurricane' ? 'bg-violet-100 text-violet-700' :
                                selectedAlert.type === 'storm' ? 'bg-indigo-100 text-indigo-700' :
                                selectedAlert.type === 'earthquake' ? 'bg-amber-100 text-amber-700' :
                                selectedAlert.type === 'flood' ? 'bg-blue-100 text-blue-700' :
                                selectedAlert.type === 'fire' ? 'bg-orange-100 text-orange-700' :
                                selectedAlert.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                            }`}>
                                {['earthquake', 'tsunami', 'volcano', 'hurricane', 'storm', 'flood'].includes(selectedAlert.type) ? (
                                    <Icons.AlertTriangle size={32} />
                                ) : (
                                    <Icons.Emergency size={32} />
                                )}
                            </div>
                            <h2 className="text-xl font-bold mb-1">{translateAlertTitle(selectedAlert.title)}</h2>
                            <span className="text-xs text-gray-500 font-mono">{selectedAlert.timestamp}</span>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                            <p className="text-sm text-gray-800 leading-relaxed">{translateDescription(selectedAlert.description)}</p>
                        </div>

                        <div className="flex gap-2">
                             <button onClick={() => setSelectedAlert(null)} className="flex-1 py-3 bg-black text-white rounded-xl font-bold text-sm">{t('acknowledge')}</button>
                             <button 
                                onClick={() => { setSelectedAlert(null); setViewMode('map'); }}
                                className="flex-1 py-3 bg-gray-100 text-gray-800 rounded-xl font-bold text-sm hover:bg-gray-200"
                            >
                                {t('viewMap')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MY REPORT DETAIL MODAL --- */}
            {selectedReport && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full h-[80vh] sm:h-auto sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col relative animate-in slide-in-from-bottom-10">
                         <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="font-bold">{t('reportDetails')} #{selectedReport.id}</h3>
                            <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-gray-200 rounded-full">
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
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">{t('status')}</span>
                                    <span className="font-bold capitalize">{selectedReport.status}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">{t('urgencyLabel')}</span>
                                    <span className="font-bold">{selectedReport.urgency || t('notAvailable')}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">{t('incidentLocation')}</span>
                                    <span className="font-bold">{selectedReport.department || t('notAvailable')}</span>
                                </div>
                                {selectedReport.adminNotes && (
                                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mt-4">
                                        <span className="block text-xs font-bold text-yellow-700 uppercase mb-1">{t('adminResponse')}</span>
                                        <p className="text-gray-800">{selectedReport.adminNotes}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
                            <button onClick={() => setSelectedReport(null)} className="w-full py-3 bg-black text-white rounded-xl font-bold">{t('closeDetails')}</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Emergency;
