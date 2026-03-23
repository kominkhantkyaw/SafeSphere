import React, { useEffect } from 'react';
import { Icons } from './Icon';

interface SuccessToastProps {
    message: string;
    onClose: () => void;
    duration?: number;
    /** Override z-index when toast must sit above modals (e.g. z-[200]) */
    zIndexClass?: string;
}

/** Toast popup for success feedback - auto-dismisses or user can click OK */
export const SuccessToast: React.FC<SuccessToastProps> = ({ message, onClose, duration = 4000, zIndexClass = 'z-[60]' }) => {
    useEffect(() => {
        const t = setTimeout(onClose, duration);
        return () => clearTimeout(t);
    }, [duration, onClose]);

    return (
        <div
            className={`fixed inset-x-4 top-4 ${zIndexClass} mx-auto max-w-md animate-in slide-in-from-top-4 fade-in duration-300 rounded-xl bg-green-600 px-4 py-3 text-white shadow-lg flex items-center gap-3`}
            role="alert"
        >
            <Icons.CheckCircle size={24} className="shrink-0 text-green-200" />
            <p className="flex-1 font-medium">{message}</p>
            <button
                type="button"
                onClick={onClose}
                className="shrink-0 p-1 rounded hover:bg-green-500/50"
                aria-label="Close"
            >
                <Icons.X size={18} />
            </button>
        </div>
    );
};
