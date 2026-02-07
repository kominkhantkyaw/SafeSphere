import React from 'react';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

interface SystemStatusProps {
    isOpen: boolean;
    onClose: () => void;
}

const SystemStatus: React.FC<SystemStatusProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-white rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="relative p-6 pb-8 bg-gradient-to-br from-green-50 to-emerald-50">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/50 backdrop-blur-sm flex items-center justify-center hover:bg-white/80 transition-colors"
                    >
                        <Icons.X size={20} className="text-gray-600" />
                    </button>
                    
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <Icons.CheckCircle size={40} className="text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('systemOperational')}</h2>
                        <p className="text-sm text-gray-600 text-center">{t('allSystemsNormal')}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Active Alerts */}
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <Icons.AlertTriangle size={20} className="text-red-600" />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900">{t('activeAlerts')}</div>
                                <div className="text-xs text-gray-500">{t('criticalNotifications')}</div>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-red-600">2</div>
                    </div>

                    {/* GPS Signal */}
                    <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                                <Icons.Navigation size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900">{t('gpsSignal')}</div>
                                <div className="text-xs text-gray-500">{t('locationServices')}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-amber-600">{t('searching')}</span>
                            <div className="flex gap-1">
                                <div className="w-1 h-4 bg-amber-600 rounded-full animate-pulse"></div>
                                <div className="w-1 h-4 bg-amber-600 rounded-full animate-pulse delay-100"></div>
                                <div className="w-1 h-4 bg-amber-600 rounded-full animate-pulse delay-200"></div>
                            </div>
                        </div>
                    </div>

                    {/* Your Status */}
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <Icons.User size={20} className="text-green-600" />
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900">{t('yourStatus')}</div>
                                <div className="text-xs text-gray-500">{t('currentSafetyStatus')}</div>
                            </div>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
                            {t('safe')}
                        </span>
                    </div>

                    {/* Additional System Info */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-center">
                            <div className="text-2xl font-bold text-blue-600">98%</div>
                            <div className="text-xs text-gray-600 mt-1">{t('network')}</div>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-xl text-center">
                            <div className="text-2xl font-bold text-purple-600">24/7</div>
                            <div className="text-xs text-gray-600 mt-1">{t('active')}</div>
                        </div>
                    </div>

                    {/* Last Updated */}
                    <div className="flex items-center justify-center gap-2 pt-2">
                        <Icons.Clock size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-500">
                            {t('lastUpdated')}: {new Date().toLocaleTimeString()}
                        </span>
                    </div>
                </div>

                {/* Close Button */}
                <div className="p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
                    >
                        {t('close')}
                    </button>
                </div>
            </div>
        </>
    );
};

export default SystemStatus;
