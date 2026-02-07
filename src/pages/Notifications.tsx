import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/Icon';
import { fetchEarthquakes } from '../services/api';

interface NotificationsProps {
    onBack?: () => void;
    onNavigateToMap?: () => void;
}

interface Notification {
    id: number;
    type: 'emergency' | 'alert' | 'info' | 'success' | 'seismic';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
}

const formatTimeAgo = (epochMs: number): string => {
    const diff = Date.now() - epochMs;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return mins <= 1 ? 'Just now' : `${mins} min ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return new Date(epochMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const Notifications: React.FC<NotificationsProps> = ({ onBack, onNavigateToMap }) => {
    const [earthquakes, setEarthquakes] = useState<{ id: string; mag: number; place: string; time: number; title?: string }[]>([]);

    const [notifications, setNotifications] = React.useState<Notification[]>([
        {
            id: 1,
            type: 'emergency',
            title: 'Emergency Alert',
            message: 'Severe weather warning in your area. Seek shelter immediately.',
            timestamp: '5 min ago',
            read: false
        },
        {
            id: 2,
            type: 'alert',
            title: 'New Report Update',
            message: 'Your incident report #12345 has been reviewed and approved.',
            timestamp: '1 hour ago',
            read: false
        },
        {
            id: 3,
            type: 'success',
            title: 'Safety Check Complete',
            message: 'Your weekly safety check has been successfully completed.',
            timestamp: '3 hours ago',
            read: true
        },
        {
            id: 4,
            type: 'info',
            title: 'Community Update',
            message: 'New safety resources are available in your area.',
            timestamp: 'Yesterday',
            read: true
        },
        {
            id: 5,
            type: 'emergency',
            title: 'SOS Alert Nearby',
            message: 'An SOS signal was triggered 2km from your location.',
            timestamp: '2 days ago',
            read: true
        }
    ]);

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

    const seismicNotifications = useMemo((): Notification[] => {
        return earthquakes.map((eq, idx) => ({
            id: 90000 + idx,
            type: 'seismic',
            title: `Seismic Event – M${eq.mag.toFixed(1)}`,
            message: eq.place || eq.title || `Magnitude ${eq.mag.toFixed(1)} earthquake detected. View Live Command Map for details.`,
            timestamp: eq.time ? formatTimeAgo(eq.time) : 'Just now',
            read: false
        }));
    }, [earthquakes]);

    const displayNotifications = useMemo(() => {
        return [...seismicNotifications, ...notifications.filter(n => n.id < 90000)];
    }, [seismicNotifications, notifications]);

    const markAsRead = (id: number) => {
        setNotifications(prev => 
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const clearNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
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
                        <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
                        {unreadCount > 0 && (
                            <p className="text-sm text-gray-500">{unreadCount} unread message{unreadCount !== 1 ? 's' : ''}</p>
                        )}
                    </div>
                    <button className="text-sm text-blue-600 font-semibold hover:text-blue-700" onClick={markAllAsRead}>
                        Mark all read
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{displayNotifications.length}</div>
                        <div className="text-xs text-gray-500">Total</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{unreadCount}</div>
                        <div className="text-xs text-gray-500">Unread</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{displayNotifications.length - unreadCount}</div>
                        <div className="text-xs text-gray-500">Read</div>
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
                                        {notification.type === 'seismic' ? 'View on Live Command Map' : 'View Details'}
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
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Notifications</h3>
                    <p className="text-sm text-gray-500 text-center">
                        You're all caught up! Check back later for updates.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Notifications;
