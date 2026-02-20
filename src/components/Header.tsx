
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

interface HeaderProps {
    title?: string;
    logoUrl?: string;
    onProfileClick?: () => void;
    onUserSettingsClick?: () => void;
    onLogout?: () => void;
    onBackClick?: () => void;
    onMenuClick?: () => void;
    onQRScanClick?: () => void;
    onNotificationClick?: () => void;
    userAvatar?: string;
    userName?: string;
    showBackButton?: boolean;
    notificationCount?: number;
}

const Header: React.FC<HeaderProps> = ({ 
    title = "SafeSphere", 
    logoUrl, 
    onProfileClick,
    onUserSettingsClick,
    onLogout,
    onBackClick,
    onMenuClick,
    onQRScanClick,
    onNotificationClick,
    userAvatar,
    userName,
    showBackButton = false,
    notificationCount = 0
}) => {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="flex items-center justify-between p-4 sm:p-5 bg-white/90 backdrop-blur-sm border-b border-gray-100 transition-colors duration-300">
            {/* Left Side - Back/Menu Button or Logo */}
            <div className="flex items-center gap-2">
                {showBackButton ? (
                    <button
                        onClick={onBackClick}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition-colors mr-2 touch-manipulation"
                        title={t('goBack')}
                        aria-label="Go back"
                    >
                        <Icons.ChevronLeft size={20} />
                    </button>
                ) : onMenuClick ? (
                    <button
                        onClick={onMenuClick}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition-colors mr-2 touch-manipulation"
                        title={t('menuTitle')}
                        aria-label="Open menu"
                    >
                        <Icons.Menu size={20} />
                    </button>
                ) : null}
                
                {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-sm">
                        <Icons.ShieldCheck size={18} />
                    </div>
                )}
                <div className="font-bold text-xl tracking-tight">{title}</div>
            </div>

            {/* Right Side - Actions */}
            <div className="flex items-center gap-2">
                {/* QR Code Scanner */}
                {onQRScanClick && (
                    <button 
                        onClick={onQRScanClick}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition-colors touch-manipulation"
                        title={t('qrScanner')}
                        aria-label={t('qrScanner')}
                    >
                        <Icons.QrCode size={18} />
                    </button>
                )}

                {/* Notifications */}
                {onNotificationClick && (
                    <button 
                        onClick={onNotificationClick}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition-colors relative touch-manipulation"
                        title={t('notificationsTitle')}
                        aria-label="Notifications"
                    >
                        <Icons.Bell size={18} />
                        {notificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                {notificationCount > 9 ? '9+' : notificationCount}
                            </span>
                        )}
                    </button>
                )}
                
                {/* User Menu */}
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white hover:shadow-lg active:scale-95 transition-all touch-manipulation"
                        aria-label="User menu"
                    >
                        {userAvatar ? (
                            <img src={userAvatar} alt="User" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <Icons.User size={16} />
                        )}
                    </button>

                    {/* Dropdown Menu - stop propagation so outside-click uses document, not dropdown */}
                    {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50" onClick={(e) => e.stopPropagation()}>
                            {/* User Info */}
                            <div className="px-4 py-3 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
                                <div className="font-semibold text-sm">{userName || 'User'}</div>
                                <div className="text-xs opacity-90">{t('myProfile')}</div>
                            </div>

                            {/* Menu Items */}
                            <div className="py-2">
                                {onProfileClick && (
                                    <button
                                        onClick={() => {
                                            onProfileClick();
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <Icons.UserCircle size={18} className="text-gray-600" />
                                        <span className="font-medium text-gray-900">{t('myProfile')}</span>
                                    </button>
                                )}
                                
                                {onUserSettingsClick && (
                                    <button
                                        onClick={() => {
                                            onUserSettingsClick();
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <Icons.Settings size={18} className="text-gray-600" />
                                        <span className="font-medium text-gray-900">{t('settings')}</span>
                                    </button>
                                )}

                                <div className="my-2 border-t border-gray-100"></div>

                                {onLogout && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            onLogout();
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left text-red-600"
                                        aria-label={t('signOut')}
                                    >
                                        <Icons.LogOut size={18} />
                                        <span className="font-medium">{t('signOut')}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Header;

