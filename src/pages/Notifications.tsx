import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/Icon';
import { fetchEarthquakes } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { getNotifications, markNotificationRead, removeNotification, type UserNotification } from '../services/notificationService';

interface NotificationsProps {
    onBack?: () => void;
    onNavigateToMap?: () => void;
    onNavigateToPrepare?: () => void;
}

interface Notification {
    id: number;
    type: 'emergency' | 'alert' | 'info' | 'success' | 'seismic';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    linkTab?: string;
}

const formatTimeAgo = (epochMs: number, t: (key: string) => string): string => {
    const diff = Date.now() - epochMs;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return mins <= 1 ? t('justNow') : `${mins} ${t('minAgo')}`;
    if (hours < 24) return hours === 1 ? `1 ${t('hourAgo')}` : `${hours} ${t('hoursAgo')}`;
    if (days < 7) return days === 1 ? `1 ${t('dayAgo')}` : `${days} ${t('daysAgo')}`;
    return new Date(epochMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const USER_NOTIFICATION_ID_OFFSET = 50000; // User notifications use IDs >= this

const Notifications: React.FC<NotificationsProps> = ({ onBack, onNavigateToMap, onNavigateToPrepare }) => {
    const { t } = useLanguage();
    const [earthquakes, setEarthquakes] = useState<{ id: string; mag: number; place: string; time: number; title?: string }[]>([]);
    const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);

    const initialNotifications = useMemo<Notification[]>(() => [
        {
            id: 1,
            type: 'emergency',
            title: t('emergencyAlert'),
            message: t('severeWeatherWarning'),
            timestamp: formatTimeAgo(Date.now() - 5 * 60000, t),
            read: false
        },
        {
            id: 2,
            type: 'alert',
            title: t('newReportUpdate'),
            message: t('reportReviewedApproved'),
            timestamp: formatTimeAgo(Date.now() - 3600000, t),
            read: false
        },
        {
            id: 3,
            type: 'success',
            title: t('safetyCheckComplete'),
            message: t('weeklySafetyCheck'),
            timestamp: formatTimeAgo(Date.now() - 3 * 3600000, t),
            read: true
        },
        {
            id: 4,
            type: 'info',
            title: t('communityUpdate'),
            message: t('newSafetyResources'),
            timestamp: t('yesterdayLabel'),
            read: true
        },
        {
            id: 5,
            type: 'emergency',
            title: t('sosAlertNearby'),
            message: t('sosSignalTriggered'),
            timestamp: formatTimeAgo(Date.now() - 2 * 86400000, t),
            read: true
        }
    ], [t]);

    const [notifications, setNotifications] = React.useState<Notification[]>(initialNotifications);

    useEffect(() => {
        fetchEarthquakes().then(data => {
            if (!data?.length) return;
            setEarthquakes(data.slice(0, 5).map((e: any) => ({
                id: e.id || String(e.properties?.time),
                mag: e.properties?.mag ?? 0,
                place: e.properties?.place ?? '',
                time: e.properties?.time ?? 0,
                title: e.properties?.title
            })));
        });
    }, []);

    useEffect(() => {
        setUserNotifications(getNotifications());
        const interval = setInterval(() => setUserNotifications(getNotifications()), 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setNotifications(prev => {
            const updatedMap = new Map<number, Notification>(prev.map((n): [number, Notification] => [n.id, n]));
            initialNotifications.forEach(initial => {
                const existing = updatedMap.get(initial.id);
                if (existing) {
                    updatedMap.set(initial.id, {
                        ...existing,
                        title: initial.title,
                        message: initial.message,
                        timestamp: initial.timestamp
                    });
                } else {
                    updatedMap.set(initial.id, initial);
                }
            });
            return Array.from(updatedMap.values()).sort((a, b) => a.id - b.id);
        });
    }, [initialNotifications]);

    const seismicNotifications = useMemo((): Notification[] => {
        return earthquakes.map((eq, idx) => ({
            id: 90000 + idx,
            type: 'seismic',
            title: t('seismicEventTitle').replace('{magnitude}', eq.mag.toFixed(1)),
            message: eq.place || eq.title || t('magnitudeDetected').replace('{magnitude}', eq.mag.toFixed(1)),
            timestamp: eq.time ? formatTimeAgo(eq.time, t) : t('justNow'),
            read: false
        }));
    }, [earthquakes, t]);

    const mappedUserNotifications = useMemo((): Notification[] => {
        return userNotifications.map(un => ({
            id: USER_NOTIFICATION_ID_OFFSET + un.id,
            type: un.type as Notification['type'],
            title: un.title,
            message: un.message,
            timestamp: formatTimeAgo(un.timestamp, t),
            read: un.read,
            linkTab: un.linkTab,
        }));
    }, [userNotifications, t]);

    const displayNotifications = useMemo(() => {
        return [...mappedUserNotifications, ...seismicNotifications, ...notifications.filter(n => n.id < 90000 && n.id < USER_NOTIFICATION_ID_OFFSET)];
    }, [mappedUserNotifications, seismicNotifications, notifications]);

    const markAsRead = (id: number) => {
        if (id >= USER_NOTIFICATION_ID_OFFSET) {
            markNotificationRead(id - USER_NOTIFICATION_ID_OFFSET);
            setUserNotifications(getNotifications());
        } else {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        }
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        userNotifications.forEach(un => markNotificationRead(un.id));
        setUserNotifications(getNotifications());
    };

    const clearNotification = (id: number) => {
        if (id >= USER_NOTIFICATION_ID_OFFSET) {
            removeNotification(id - USER_NOTIFICATION_ID_OFFSET);
            setUserNotifications(getNotifications());
        } else {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
    };

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'emergency':
                return 'bg-red-50 border-red-200';
            case 'seismic':
                return 'bg-amber-50 border-amber-300';
            case 'alert':
                return 'bg-amber-50 border-amber-200';
            case 'success':
                return 'bg-green-50 border-green-200';
            default:
                return 'bg-blue-50 border-blue-200';
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'emergency':
                return <Icons.AlertTriangle size={24} className="text-red-600" />;
            case 'seismic':
                return <Icons.AlertTriangle size={24} className="text-amber-600" />;
            case 'alert':
                return <Icons.Bell size={24} className="text-amber-600" />;
            case 'success':
                return <Icons.CheckCircle size={24} className="text-green-600" />;
            default:
                return <Icons.Bell size={24} className="text-blue-600" />;
        }
    };

    const unreadCount = displayNotifications.filter(n => !n.read).length;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-20">
            {/* Header with Back Button */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                            aria-label="Go back"
                        >
                            <Icons.ArrowLeft size={20} className="text-gray-700" />
                        </button>
                    )}
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-gray-900">{t('notificationsHeading')}</h1>
                        {unreadCount > 0 && (
                            <p className="text-sm text-gray-500">{unreadCount} {unreadCount !== 1 ? t('unreadMessages') : t('unreadMessage')}</p>
                        )}
                    </div>
                    <button className="text-sm text-blue-600 font-semibold hover:text-blue-700" onClick={markAllAsRead}>
                        {t('markAllRead')}
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{displayNotifications.length}</div>
                        <div className="text-xs text-gray-500">{t('totalLabel')}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{unreadCount}</div>
                        <div className="text-xs text-gray-500">{t('unreadLabel')}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{displayNotifications.length - unreadCount}</div>
                        <div className="text-xs text-gray-500">{t('readLabel')}</div>
                    </div>
                </div>
            </div>

            {/* Notifications List */}
            <div className="px-6 py-4 space-y-3">
                {displayNotifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`p-4 rounded-2xl border-2 transition-all hover:shadow-md cursor-pointer ${
                            getNotificationColor(notification.type)
                        } ${!notification.read ? 'border-l-4' : ''}`}
                        onClick={() => markAsRead(notification.id)}
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white flex items-center justify-center">
                                {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-bold text-gray-900 text-sm">
                                        {notification.title}
                                        {!notification.read && (
                                            <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                                        )}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 whitespace-nowrap">
                                            {notification.timestamp}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                clearNotification(notification.id);
                                            }}
                                            className="p-1 hover:bg-white rounded-full transition-colors"
                                            aria-label="Delete notification"
                                        >
                                            <Icons.X size={16} className="text-gray-500 hover:text-red-600" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-700 mt-1">
                                    {notification.message}
                                </p>
                                {(notification.type === 'emergency' || notification.type === 'seismic') && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); notification.type === 'seismic' && onNavigateToMap?.(); }}
                                        className="mt-3 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                                    >
                                        {notification.type === 'seismic' ? t('viewOnLiveMap') : t('viewDetailsBtn')}
                                    </button>
                                )}
                                {notification.linkTab === 'prepare' && onNavigateToPrepare && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onNavigateToPrepare(); }}
                                        className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        {t('viewDrills') || 'View Drills'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {displayNotifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Icons.Bell size={40} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('noNotifications')}</h3>
                    <p className="text-sm text-gray-500 text-center">
                        {t('allCaughtUp')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Notifications;
