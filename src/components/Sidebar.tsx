import React, { useState } from 'react';
import { Icons } from './Icon';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeSettings, ThemeMode } from '../types';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (page: string) => void;
    onThemeSettingsClick?: () => void;
    onLogout: () => void;
    appTheme?: ThemeSettings;
    onThemeUpdate?: (theme: ThemeSettings) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    isOpen, 
    onClose, 
    onNavigate, 
    onThemeSettingsClick,
    onLogout,
    appTheme,
    onThemeUpdate
}) => {
    const { user } = useUser();
    const { language, setLanguage, t } = useLanguage();
    const [pendingLanguage, setPendingLanguage] = useState<'en' | 'de' | 'my' | null>(null);
    const [pendingThemeMode, setPendingThemeMode] = useState<ThemeMode | null>(null);
    const [showSavedMessage, setShowSavedMessage] = useState(false);

    if (!user) return null;

    const handleNavigate = (page: string) => {
        onNavigate(page);
        onClose();
    };

    const handleThemeSettings = () => {
        if (onThemeSettingsClick) {
            onThemeSettingsClick();
            onClose();
        }
    };

    const handleLogout = () => {
        onClose();
        onLogout();
    };

    const savedThemeMode: ThemeMode = appTheme?.themeMode ?? (typeof appTheme?.darkMode === 'boolean' ? (appTheme.darkMode ? 'dark' : 'light') : 'system');
    const effectiveThemeMode = pendingThemeMode ?? savedThemeMode;
    const hasPreferencesChanges =
        (pendingLanguage !== null && pendingLanguage !== language) || pendingThemeMode !== null;

    const handleSavePreferences = () => {
        if (pendingLanguage !== null && pendingLanguage !== language) {
            setLanguage(pendingLanguage);
            setPendingLanguage(null);
        }
        if (pendingThemeMode !== null && onThemeUpdate && appTheme) {
            onThemeUpdate({ ...appTheme, themeMode: pendingThemeMode });
            setPendingThemeMode(null);
        }
        setShowSavedMessage(true);
        setTimeout(() => setShowSavedMessage(false), 2500);
    };

    const handleLanguageSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setPendingLanguage(e.target.value as 'en' | 'de' | 'my');
    };

    const handleThemeModeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setPendingThemeMode(e.target.value as ThemeMode);
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Drawer - left */}
            <div 
                className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* SafeSphere Header with Logo */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        {appTheme?.logoUrl ? (
                            <img src={appTheme.logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-sm">
                                <Icons.ShieldCheck size={22} />
                            </div>
                        )}
                        <div>
                            <div className="font-bold text-base tracking-tight text-gray-900">SafeSphere</div>
                            <div className="text-xs text-gray-500">Tactical Node</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        aria-label="Close menu"
                    >
                        <Icons.X size={18} className="text-gray-600" />
                    </button>
                </div>

                {/* User Profile Section */}
                <div className="p-4">
                    <button
                        onClick={() => handleNavigate('profile')}
                        className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
                    >
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name ?? ''} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-lg font-bold text-blue-700">{(user?.name ?? '').charAt(0).toUpperCase() || '?'}</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 truncate">{user?.name ?? 'User'}</div>
                            <div className="text-sm text-gray-500">{user?.role ?? 'Viewer'}</div>
                        </div>
                    </button>
                </div>

                {/* Menu Items */}
                <div className="py-2 px-3">
                    <nav className="space-y-1">
                        <MenuItem
                            icon={Icons.House}
                            label={t('home')}
                            onClick={() => handleNavigate('home')}
                        />
                        <MenuItem
                            icon={Icons.Map}
                            label={t('map')}
                            onClick={() => handleNavigate('maps')}
                        />
                        <MenuItem
                            icon={Icons.ShieldCheck}
                            label={t('prepare')}
                            onClick={() => handleNavigate('prepare')}
                        />
                        <MenuItem
                            icon={Icons.SOS}
                            label={t('sos')}
                            onClick={() => handleNavigate('emergency')}
                        />
                        <MenuItem
                            icon={Icons.Chat}
                            label={t('chat')}
                            onClick={() => handleNavigate('chat')}
                        />
                        <MenuItem
                            icon={Icons.Users}
                            label={t('directory')}
                            onClick={() => handleNavigate('directory')}
                        />
                        {(user.role === 'Admin' || user.role === 'Responder') && (
                            <MenuItem
                                icon={Icons.Shield}
                                label={t('adminPanel')}
                                onClick={() => handleNavigate('admin')}
                            />
                        )}
                        <MenuItem
                            icon={Icons.Settings}
                            label={t('settings')}
                            onClick={() => handleNavigate('settings')}
                        />
                        <MenuItem
                            icon={Icons.Lock}
                            label={t('privacyPolicy')}
                            onClick={() => handleNavigate('privacy')}
                        />
                    </nav>

                    {/* Language Section - draft until Save */}
                    <div className="mt-6 mb-4 px-2">
                        <div className="flex items-center gap-3 mb-3">
                            <Icons.Globe size={20} className="text-gray-500 shrink-0" />
                            <div>
                                <div className="font-semibold text-gray-900 text-sm">{t('language')}</div>
                                <div className="text-xs text-gray-500">{t('saveToApply')}</div>
                            </div>
                        </div>
                        <select
                            value={pendingLanguage ?? language}
                            onChange={handleLanguageSelect}
                            aria-label={t('language')}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="en">🇬🇧 {t('english')}</option>
                            <option value="de">🇩🇪 {t('german')}</option>
                            <option value="my">🇲🇲 {t('myanmar')}</option>
                        </select>
                        <p className="mt-1.5 text-xs text-gray-500">
                            {t('current')}: {language === 'en' ? t('english') : language === 'de' ? t('german') : t('myanmar')}
                        </p>
                    </div>

                    {/* Theme Mode Section - draft until Save */}
                    {appTheme && onThemeUpdate && (
                        <div className="mt-6 mb-4 px-2">
                            <div className="flex items-center gap-3 mb-3">
                                <Icons.Palette size={20} className="text-gray-500 shrink-0" />
                                <div>
                                    <div className="font-semibold text-gray-900 text-sm">{t('themeMode')}</div>
                                    <div className="text-xs text-gray-500">{t('saveToApply')}</div>
                                </div>
                            </div>
                            <select
                                value={effectiveThemeMode}
                                onChange={handleThemeModeSelect}
                                aria-label={t('themeMode')}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="light">☀️ {t('light')}</option>
                                <option value="dark">🌙 {t('dark')}</option>
                                <option value="system">💻 {t('system')}</option>
                            </select>
                            <p className="mt-1.5 text-xs text-gray-500">
                                {t('current')}: {savedThemeMode === 'light' ? t('light') : savedThemeMode === 'dark' ? t('dark') : t('system')}
                            </p>
                            {onThemeSettingsClick && (
                                <button
                                    type="button"
                                    onClick={handleThemeSettings}
                                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    <Icons.Palette size={14} />
                                    Customise colours & more
                                </button>
                            )}
                        </div>
                    )}

                    {/* Save Language & Theme (when there are pending changes) */}
                    {hasPreferencesChanges && (
                        <div className="mt-4 mb-4 px-2 space-y-2">
                            <button
                                type="button"
                                onClick={handleSavePreferences}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                            >
                                <Icons.CheckCircle size={20} />
                                {t('save')}
                            </button>
                            {showSavedMessage && (
                                <p className="text-center text-sm text-green-600 font-medium flex items-center justify-center gap-1.5" role="status">
                                    <Icons.CheckCircle size={18} />
                                    {t('settingsSaved')}
                                </p>
                            )}
                        </div>
                    )}
                    {showSavedMessage && !hasPreferencesChanges && (
                        <div className="mt-4 mb-4 px-2">
                            <p className="text-center text-sm text-green-600 font-medium flex items-center justify-center gap-1.5" role="status">
                                <Icons.CheckCircle size={18} />
                                {t('settingsSaved')}
                            </p>
                        </div>
                    )}

                    {/* Logout Button */}
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                            aria-label={t('signOut')}
                        >
                            <Icons.LogOut size={20} />
                            {t('signOut')}
                        </button>
                        <p className="mt-3 text-center text-xs text-gray-400/70 font-mono">v2.5.0-STABLE</p>
                    </div>
                </div>
            </div>
        </>
    );
};

// Menu Item Component
interface MenuItemProps {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon: Icon, label, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group"
        >
            <Icon size={20} className="text-gray-500 group-hover:text-gray-700" />
            <span className="font-medium">{label}</span>
        </button>
    );
};

export default Sidebar;
