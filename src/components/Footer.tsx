import React from 'react';
import { Icons } from './Icon';
import SafeSphereLogo from './SafeSphereLogo';

interface FooterProps {
    onNavigate?: (tab: string) => void;
    onOpenSystemStatus?: () => void;
    darkMode?: boolean;
}

const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenSystemStatus, darkMode = false }) => {
    const baseText = darkMode ? 'text-gray-300' : 'text-gray-600';
    const headingText = darkMode ? 'text-gray-200' : 'text-gray-800';
    const linkText = darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900';
    const bgClass = darkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50/80 border-gray-200';

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'SafeSphere',
                text: 'Unified emergency framework for tactical theater logistics and real-time civilian safety.',
                url: window.location.origin
            }).catch(() => {});
        }
    };

    return (
        <footer className={`border-t ${bgClass} mt-auto`}>
            <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-6">
                    {/* SafeSphere branding - logo, tagline, system status */}
                    <div className="space-y-3 min-w-0 overflow-hidden">
                        <SafeSphereLogo size="xl" showText={true} darkMode={darkMode} variant="minimal" />
                        <p className={`text-[10px] leading-relaxed ${baseText}`}>
                            Unified emergency framework for tactical theater logistics and real-time civilian safety.
                        </p>
                        <div className="flex flex-col gap-1 text-[10px] sm:text-[11px]">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <span className={baseText}>Network: Optimal</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <span className={baseText}>Sync: Active</span>
                            </div>
                        </div>
                    </div>

                    {/* Safety Hub */}
                    <div className="min-w-0">
                        <h4 className={`font-bold text-[10px] sm:text-[11px] uppercase tracking-wider mb-3 ${headingText}`}>Safety Hub</h4>
                        <ul className="space-y-1.5 text-[10px]">
                            {[
                                { label: 'Live Command Map', tab: 'maps' },
                                { label: 'Resources', tab: 'resources' },
                                { label: 'Directory', tab: 'directory' },
                                { label: 'Prepare', tab: 'prepare' },
                                { label: 'Learn', tab: 'learn' },
                                { label: 'Notifications', tab: 'notifications' },
                            ].map(({ label, tab }) => (
                                <li key={label}>
                                    <button type="button" onClick={() => onNavigate?.(tab)} className={`${linkText} transition-colors`}>
                                        {label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Safety Protocols */}
                    <div className="min-w-0">
                        <h4 className={`font-bold text-[10px] sm:text-[11px] uppercase tracking-wider mb-3 ${headingText}`}>Safety Protocols</h4>
                        <ul className="space-y-1.5 text-[10px]">
                            {[
                                { label: 'Privacy Policy', tab: 'privacy' },
                                { label: 'Settings', tab: 'settings' },
                                { label: 'Profile', tab: 'profile' },
                                { label: 'System Status', action: 'status' },
                            ].map(({ label, tab, action }) => (
                                <li key={label}>
                                    <button
                                        type="button"
                                        onClick={() => (tab ? onNavigate?.(tab) : action === 'status' && onOpenSystemStatus?.())}
                                        className={`${linkText} transition-colors`}
                                    >
                                        {label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Quick Operations */}
                    <div className="min-w-0">
                        <h4 className={`font-bold text-[10px] sm:text-[11px] uppercase tracking-wider mb-3 ${headingText}`}>Quick Operations</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { icon: Icons.Share ?? Icons.User, label: 'Share', onClick: handleShare },
                                { icon: Icons.Download ?? Icons.FileText, label: 'Export', onClick: () => {} },
                                { icon: Icons.FileText ?? Icons.Activity, label: 'Status', onClick: onOpenSystemStatus },
                                { icon: Icons.Shield ?? Icons.Emergency, label: 'Report', onClick: () => onNavigate?.('emergency') },
                            ].map(({ icon: Icon, label, onClick }) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={onClick}
                                    className={`flex flex-col items-center justify-center p-2 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-800/50 hover:bg-gray-700/50' : 'border-gray-200 bg-white hover:bg-gray-50'} transition-colors`}
                                >
                                    <Icon size={16} className={baseText} />
                                    <span className={`text-[10px] sm:text-[11px] font-medium mt-1 ${baseText}`}>{label}</span>
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={onOpenSystemStatus}
                            className={`mt-3 flex items-center gap-2 text-left w-full ${linkText} transition-colors`}
                        >
                            <Icons.Activity size={14} className="text-emerald-500 shrink-0" />
                            <span className="text-[10px] font-medium">Health Status: Stable</span>
                        </button>
                    </div>
                </div>

                {/* Copyright & status bar */}
                <div className={`pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex flex-wrap items-center justify-center sm:justify-between gap-3 text-[10px] sm:text-[11px] ${baseText}`}>
                    <span>© 2025 SafeSphere Crisis Management</span>
                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4">
                        <span className="font-mono">v2.5.0-STABLE</span>
                        <span className="flex items-center gap-1">
                            <Icons.Shield size={12} className="text-emerald-500" />
                            AES-256 Valid
                        </span>
                        <span className="flex items-center gap-1">
                            <Icons.Globe size={12} className="text-blue-500" />
                            Global Uptime 99.9%
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
