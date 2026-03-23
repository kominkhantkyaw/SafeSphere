/** User-generated notifications (drill registration, etc.) - persisted to localStorage */

const NOTIFICATIONS_KEY = 'safesphere_user_notifications';

export interface UserNotification {
    id: number;
    type: 'success' | 'info' | 'alert';
    title: string;
    message: string;
    timestamp: number; // epoch ms
    read: boolean;
    /** Optional link target, e.g. 'prepare' for Drills tab */
    linkTab?: string;
}

const getStored = (): UserNotification[] => {
    try {
        const raw = localStorage.getItem(NOTIFICATIONS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const setStored = (items: UserNotification[]) => {
    try {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items));
    } catch (e) {
        console.error('Failed to save notifications', e);
    }
};

let nextId = 1;
const genId = () => {
    const items = getStored();
    const max = items.reduce((m, n) => Math.max(m, n.id), 0);
    return max + 1;
};

/** Add a notification (e.g. after drill registration) */
export const addNotification = (notification: Omit<UserNotification, 'id' | 'read' | 'timestamp'>): UserNotification => {
    const items = getStored();
    const n: UserNotification = {
        ...notification,
        id: genId(),
        timestamp: Date.now(),
        read: false,
    };
    items.unshift(n);
    setStored(items);
    return n;
};

/** Get all user notifications */
export const getNotifications = (): UserNotification[] => getStored();

/** Mark notification as read */
export const markNotificationRead = (id: number): void => {
    const items = getStored().map(n => n.id === id ? { ...n, read: true } : n);
    setStored(items);
};

/** Remove a notification */
export const removeNotification = (id: number): void => {
    setStored(getStored().filter(n => n.id !== id));
};
