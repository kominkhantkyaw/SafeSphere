import React, { useState, useEffect } from 'react';
import { Icons } from '../components/Icon';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeSettings as ThemeSettingsType, ThemeMode } from '../types';
import { supabase } from '../services/supabase';
import {
    enrollMfa,
    verifyMfaEnrollment,
    listMfaFactors,
    unenrollMfa,
    setFaceIdEnabled as setFaceIdEnabledSupabase,
    getFaceIdEnabled,
    isDemoUser,
} from '../services/auth';
import {
    isWebAuthnAvailable,
    getWebAuthnRegisterOptions,
    verifyWebAuthnRegistration,
} from '../services/webauthn';

interface SettingsProps {
    onBack?: () => void;
    onNavigate?: (page: string) => void;
    theme?: ThemeSettingsType;
    onThemeUpdate?: (theme: ThemeSettingsType) => void;
    onThemeSettingsClick?: () => void;
}

const KEEP_ON_CLEAR = ['safesphere_user', 'safesphere_theme', 'safesphere_language', 'safesphere_token'];

const Settings: React.FC<SettingsProps> = ({ onBack, onNavigate, theme: appTheme, onThemeUpdate, onThemeSettingsClick }) => {
    const { user, updateUser, logout } = useUser();
    const { language, setLanguage, t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'privacy' | 'security'>('account');
    
    // Language & theme – draft until Save is clicked
    const [pendingLanguage, setPendingLanguage] = useState<'en' | 'de' | 'my' | null>(null);
    const [showSavedMessage, setShowSavedMessage] = useState(false);
    
    // Theme mode - draft until saved (uses app theme when available)
    const [pendingThemeMode, setPendingThemeMode] = useState<ThemeMode | null>(null);
    const effectiveThemeMode: ThemeMode = pendingThemeMode ?? 
        appTheme?.themeMode ?? 
        (typeof appTheme?.darkMode === 'boolean' ? (appTheme.darkMode ? 'dark' : 'light') : 'system');

    // Notification settings
    const [notifications, setNotifications] = useState({
        emergencyAlerts: true,
        reportUpdates: true,
        systemMessages: false,
        emailNotifications: true,
        pushNotifications: true,
        smsAlerts: false,
        // Offline mode features
        bluetoothEnabled: true,
        gpsEnabled: true,
        offlineMode: true,
        localStorageSync: true,
        emergencyBeacon: true
    });

    // Location services setting
    const [locationServicesEnabled, setLocationServicesEnabled] = useState(true);

    // Privacy settings
    const [privacy, setPrivacy] = useState({
        profileVisibility: 'public',
        shareLocation: true,
        showActivity: true,
        allowMessaging: true
    });

    // Password change
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // 2FA & Face ID — demo: localStorage; real users: Supabase (MFA + user_metadata)
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(() => localStorage.getItem('safesphere_2fa_enabled') === '1');
    const [faceIdEnabled, setFaceIdEnabled] = useState(() => localStorage.getItem('safesphere_faceid_enabled') === '1');
    const [isSupabaseUser, setIsSupabaseUser] = useState(false);
    const [loadingSupabaseSecurity, setLoadingSupabaseSecurity] = useState(false);
    // Pending Security changes (like language/theme) — apply only on Save
    const [pendingTwoFactor, setPendingTwoFactor] = useState<boolean | null>(null);
    const [pendingFaceId, setPendingFaceId] = useState<boolean | null>(null);
    const [securityPopupMessage, setSecurityPopupMessage] = useState<string | null>(null);
    // 2FA enrollment modal (Supabase real users only)
    const [showEnrollMfa, setShowEnrollMfa] = useState(false);
    const [mfaEnrollFactorId, setMfaEnrollFactorId] = useState('');
    const [mfaEnrollQrSvg, setMfaEnrollQrSvg] = useState('');
    const [mfaEnrollCode, setMfaEnrollCode] = useState('');
    const [mfaEnrollError, setMfaEnrollError] = useState<string | null>(null);
    const [mfaEnrollLoading, setMfaEnrollLoading] = useState(false);

    // Display values for Security toggles (pending overrides saved)
    const twoFactorDisplay = pendingTwoFactor ?? twoFactorEnabled;
    const faceIdDisplay = pendingFaceId ?? faceIdEnabled;
    const hasSecurityChanges = pendingTwoFactor !== null || pendingFaceId !== null;

    // Detect Supabase user and load 2FA / Face ID state from Supabase when on Security tab
    useEffect(() => {
        if (!user?.email || isDemoUser(user.email)) return;
        if (activeTab !== 'security' || !supabase) return;
        let cancelled = false;
        setLoadingSupabaseSecurity(true);
        setPendingTwoFactor(null);
        setPendingFaceId(null);
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (cancelled) return;
            if (session?.user?.email?.toLowerCase() === user.email?.toLowerCase()) {
                setIsSupabaseUser(true);
                const factors = await listMfaFactors();
                if (factors.success && factors.totp.length > 0) setTwoFactorEnabled(true);
                const faceOn = await getFaceIdEnabled();
                setFaceIdEnabled(faceOn);
            } else {
                setIsSupabaseUser(false);
            }
            setLoadingSupabaseSecurity(false);
        })();
        return () => { cancelled = true; };
    }, [user?.email, activeTab]);

    const handleToggle2FA = () => {
        setPendingTwoFactor(!twoFactorDisplay);
    };

    const handleToggleFaceId = () => {
        setPendingFaceId(!faceIdDisplay);
    };

    const handleSaveSecurity = async () => {
        if (pendingTwoFactor !== null) {
            if (isSupabaseUser) {
                if (pendingTwoFactor) {
                    const res = await enrollMfa();
                    if (res.success) {
                        setMfaEnrollFactorId(res.factorId);
                        setMfaEnrollQrSvg(res.qrCodeSvg);
                        setMfaEnrollCode('');
                        setMfaEnrollError(null);
                        setShowEnrollMfa(true);
                    }
                } else {
                    const factors = await listMfaFactors();
                    if (factors.success && factors.totp[0]) {
                        const res = await unenrollMfa(factors.totp[0].id);
                        if (res.success) {
                            setTwoFactorEnabled(false);
                            setSecurityPopupMessage(t('twoFactorDisabled'));
                        }
                    }
                    setPendingTwoFactor(null);
                }
            } else {
                setTwoFactorEnabled(pendingTwoFactor);
                localStorage.setItem('safesphere_2fa_enabled', pendingTwoFactor ? '1' : '0');
                setPendingTwoFactor(null);
                setSecurityPopupMessage(pendingTwoFactor ? t('twoFactorActivated') : t('twoFactorDisabled'));
            }
        }
        if (pendingFaceId !== null) {
            if (isSupabaseUser) {
                const res = await setFaceIdEnabledSupabase(pendingFaceId);
                if (res.success) {
                    setFaceIdEnabled(pendingFaceId);
                    if (pendingFaceId && isWebAuthnAvailable()) {
                        try {
                            const opts = await getWebAuthnRegisterOptions();
                            if (opts.success && opts.options.publicKey) {
                                const credential = await navigator.credentials.create(opts.options) as PublicKeyCredential | null;
                                if (credential) {
                                    await verifyWebAuthnRegistration(credential);
                                }
                            }
                        } catch {
                            // WebAuthn registration optional; metadata already set
                        }
                    }
                    setSecurityPopupMessage(pendingFaceId ? t('faceIdActivated') : t('faceIdDisabled'));
                }
            } else {
                setFaceIdEnabled(pendingFaceId);
                localStorage.setItem('safesphere_faceid_enabled', pendingFaceId ? '1' : '0');
                setSecurityPopupMessage(pendingFaceId ? t('faceIdActivated') : t('faceIdDisabled'));
            }
            setPendingFaceId(null);
        }
    };

    const handleDiscardSecurity = () => {
        setPendingTwoFactor(null);
        setPendingFaceId(null);
    };

    const handleVerifyMfaEnrollment = async () => {
        if (!mfaEnrollFactorId || !mfaEnrollCode.trim()) {
            setMfaEnrollError(t('mfaCodeRequired'));
            return;
        }
        setMfaEnrollLoading(true);
        setMfaEnrollError(null);
        const res = await verifyMfaEnrollment(mfaEnrollFactorId, mfaEnrollCode);
        setMfaEnrollLoading(false);
        if (res.success) {
            setTwoFactorEnabled(true);
            setPendingTwoFactor(null);
            setShowEnrollMfa(false);
            setSecurityPopupMessage(t('twoFactorActivated'));
        } else {
            setMfaEnrollError(res.message || t('invalidCredentials'));
        }
    };


    // Active Sessions - detect current device & manage other sessions
    const getDeviceInfo = (): { device: string; browser: string } => {
        if (typeof navigator === 'undefined') return { device: 'Unknown', browser: 'Unknown' };
        const ua = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        let device = 'Other';
        if (isMobile) {
            if (/iPhone|iPad|iPod/i.test(ua)) device = 'iPhone/iPad';
            else if (/Android/i.test(ua)) device = 'Android';
            else device = 'Mobile';
        } else {
            if (/Win/i.test(ua)) device = 'Windows';
            else if (/Mac/i.test(ua)) device = 'Mac';
            else if (/Linux/i.test(ua)) device = 'Linux';
        }
        let browser = 'Unknown';
        if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = 'Chrome';
        else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
        else if (/Firefox/i.test(ua)) browser = 'Firefox';
        else if (/Edge|Edg/i.test(ua)) browser = 'Edge';
        return { device, browser };
    };

    const currentDevice = getDeviceInfo();
    const currentDeviceLabel = `${currentDevice.device} • ${currentDevice.browser}`;

    const [otherSessions, setOtherSessions] = useState<Array<{ id: string; device: string; lastActive: string }>>(() => {
        try {
            const saved = localStorage.getItem('safesphere_other_sessions');
            if (saved) {
                const parsed = JSON.parse(saved);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch {}
        // Demo: seed with sample other sessions if none
        return [
            { id: '1', device: 'iPhone • Safari', lastActive: '2 hours ago' },
            { id: '2', device: 'Android • Chrome', lastActive: '1 day ago' },
        ];
    });

    const handleEndAllOtherSessions = () => {
        if (otherSessions.length === 0) return;
        if (!confirm(t('endAllOtherSessionsConfirm'))) return;
        setOtherSessions([]);
        localStorage.setItem('safesphere_other_sessions', '[]');
    };

    const handleDownloadMyData = () => {
        const data: Record<string, unknown> = {
            exportedAt: new Date().toISOString(),
            profile: user ?? null,
            theme: appTheme ?? null,
            language: typeof localStorage !== 'undefined' ? localStorage.getItem('safesphere_language') : null,
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SafeSphere_MyData_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleClearCache = () => {
        if (!confirm(t('clearCacheConfirm'))) return;
        try {
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith('safesphere_') && !KEEP_ON_CLEAR.includes(key)) {
                    localStorage.removeItem(key);
                }
            });
            sessionStorage.clear();
        } catch {}
        setOtherSessions([]);
    };

    const handleDeleteAccount = () => {
        if (!confirm(t('deleteAccountConfirm'))) return;
        try {
            const keys = Object.keys(localStorage).filter((k) => k.startsWith('safesphere_'));
            keys.forEach((k) => localStorage.removeItem(k));
            sessionStorage.clear();
        } catch {}
        logout();
        onNavigate?.('home');
    };

    const handleThemeModeSelect = (mode: ThemeMode) => {
        setPendingThemeMode(mode);
    };

    const savedThemeMode: ThemeMode = appTheme?.themeMode ?? (typeof appTheme?.darkMode === 'boolean' ? (appTheme.darkMode ? 'dark' : 'light') : 'system');
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

    const handlePasswordChange = (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess(false);

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return;
        }

        // Simulate password change
        setTimeout(() => {
            setPasswordSuccess(true);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => {
                setShowPasswordForm(false);
                setPasswordSuccess(false);
            }, 2000);
        }, 500);
    };

    const handleLanguageSelect = (newLanguage: 'en' | 'de' | 'my') => {
        setPendingLanguage(newLanguage);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24 sm:pb-28">
            {/* Tabs */}
            <div className="px-4 sm:px-6 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-100 rounded-xl p-1">
                    <button
                        onClick={() => setActiveTab('account')}
                        className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-all touch-manipulation min-h-[44px] ${
                            activeTab === 'account'
                                ? 'bg-white text-gray-900 shadow-md'
                                : 'text-gray-500'
                        }`}
                    >
                        {t('account')}
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-all touch-manipulation min-h-[44px] ${
                            activeTab === 'notifications'
                                ? 'bg-white text-gray-900 shadow-md'
                                : 'text-gray-500'
                        }`}
                    >
                        {t('notifications')}
                    </button>
                    <button
                        onClick={() => setActiveTab('privacy')}
                        className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-all touch-manipulation min-h-[44px] ${
                            activeTab === 'privacy'
                                ? 'bg-white text-gray-900 shadow-md'
                                : 'text-gray-500'
                        }`}
                    >
                        {t('privacy')}
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-all touch-manipulation min-h-[44px] ${
                            activeTab === 'security'
                                ? 'bg-white text-gray-900 shadow-md'
                                : 'text-gray-500'
                        }`}
                    >
                        {t('security')}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-6 space-y-4 max-w-2xl mx-auto">
                {/* Account Settings */}
                {activeTab === 'account' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('accountInfo')}</h2>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <Icons.User size={20} className="text-gray-500" />
                                        <div>
                                            <div className="text-sm text-gray-500">{t('username')}</div>
                                            <div className="font-semibold text-gray-900">{user?.name}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <Icons.Shield size={20} className="text-gray-500" />
                                        <div>
                                            <div className="text-sm text-gray-500">{t('role')}</div>
                                            <div className="font-semibold text-gray-900">{user?.role}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <Icons.Phone size={20} className="text-gray-500" />
                                        <div>
                                            <div className="text-sm text-gray-500">{t('phone')}</div>
                                            <div className="font-semibold text-gray-900">{user?.phone || t('notSet')}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* App Preferences */}
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('preferences')}</h2>
                            
                            <div className="space-y-4">
                                {/* Language Selection */}
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <Icons.Globe size={20} className="text-gray-500" />
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('language')}</div>
                                            <div className="text-sm text-gray-500">{t('selectLanguage')}. {t('saveToApply')}</div>
                                        </div>
                                    </div>
                                    <select 
                                        value={pendingLanguage ?? language}
                                        onChange={(e) => handleLanguageSelect(e.target.value as 'en' | 'de' | 'my')}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        aria-label={t('language')}
                                    >
                                        <option value="en">🇬🇧 {t('english')}</option>
                                        <option value="de">🇩🇪 {t('german')}</option>
                                        <option value="my">🇲🇲 {t('myanmar')}</option>
                                    </select>
                                    {language && (
                                        <p className="mt-1.5 text-xs text-gray-500">
                                            {t('current')}: {language === 'en' ? t('english') : language === 'de' ? t('german') : t('myanmar')}
                                        </p>
                                    )}
                                </div>

                                {/* Time Zone Selection */}
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <Icons.Clock size={20} className="text-gray-500" />
                                        <div>
                                            <div className="font-semibold text-gray-900">Time Zone</div>
                                            <div className="text-sm text-gray-500">Synchronize with local time</div>
                                        </div>
                                    </div>
                                    <select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="auto">Auto-detect (Recommended)</option>
                                        <optgroup label="Americas">
                                            <option value="America/New_York">Eastern Time (ET) - New York</option>
                                            <option value="America/Chicago">Central Time (CT) - Chicago</option>
                                            <option value="America/Denver">Mountain Time (MT) - Denver</option>
                                            <option value="America/Los_Angeles">Pacific Time (PT) - Los Angeles</option>
                                            <option value="America/Sao_Paulo">Brazil Time (BRT) - São Paulo</option>
                                        </optgroup>
                                        <optgroup label="Europe">
                                            <option value="Europe/London">GMT - London</option>
                                            <option value="Europe/Paris">CET - Paris</option>
                                            <option value="Europe/Berlin">CET - Berlin</option>
                                            <option value="Europe/Moscow">MSK - Moscow</option>
                                        </optgroup>
                                        <optgroup label="Asia">
                                            <option value="Asia/Dubai">GST - Dubai</option>
                                            <option value="Asia/Kolkata">IST - India</option>
                                            <option value="Asia/Shanghai">CST - China</option>
                                            <option value="Asia/Tokyo">JST - Tokyo</option>
                                            <option value="Asia/Singapore">SGT - Singapore</option>
                                        </optgroup>
                                        <optgroup label="Pacific">
                                            <option value="Australia/Sydney">AEDT - Sydney</option>
                                            <option value="Pacific/Auckland">NZDT - Auckland</option>
                                        </optgroup>
                                    </select>
                                </div>

                                {/* Theme Mode Selection */}
                                <div className="border-t border-gray-100 pt-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Icons.Palette size={20} className="text-gray-500" />
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('themeMode')}</div>
                                            <div className="text-sm text-gray-500">{t('saveToApply')}</div>
                                        </div>
                                    </div>
                                    <select
                                        value={effectiveThemeMode}
                                        onChange={(e) => handleThemeModeSelect(e.target.value as ThemeMode)}
                                        aria-label={t('themeMode')}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                            onClick={onThemeSettingsClick}
                                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            <Icons.Palette size={16} />
                                            Customise colours & more
                                        </button>
                                    )}
                                </div>

                                {/* Save preferences (Language + Theme) */}
                                {hasPreferencesChanges && (
                                    <div className="border-t border-gray-100 pt-4 space-y-2">
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
                                    <div className="border-t border-gray-100 pt-4">
                                        <p className="text-center text-sm text-green-600 font-medium flex items-center justify-center gap-1.5" role="status">
                                            <Icons.CheckCircle size={18} />
                                            {t('settingsSaved')}
                                        </p>
                                    </div>
                                )}

                                {/* Location Services Toggle */}
                                <div className="border-t border-gray-100 pt-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                locationServicesEnabled ? 'bg-green-100' : 'bg-gray-100'
                                            }`}>
                                                <Icons.MapPin size={20} className={
                                                    locationServicesEnabled ? 'text-green-600' : 'text-gray-400'
                                                } />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900">{t('locationServices')}</div>
                                                <div className="text-sm text-gray-500">
                                                    {locationServicesEnabled ? t('locationEnabled') : t('locationDisabled')}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setLocationServicesEnabled(!locationServicesEnabled)}
                                            className={`w-12 h-7 rounded-full transition-colors relative ${
                                                locationServicesEnabled ? 'bg-green-500' : 'bg-gray-300'
                                            }`}
                                        >
                                            <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                                locationServicesEnabled ? 'right-1' : 'left-1'
                                            }`}></div>
                                        </button>
                                    </div>
                                    {!locationServicesEnabled && (
                                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border-l-4 border-amber-500">
                                            <p className="text-sm text-amber-900">
                                                <Icons.AlertTriangle size={16} className="inline mr-2" />
                                                {t('disablingLocationWarning')}
                                            </p>
                                        </div>
                                    )}
                                    {locationServicesEnabled && (
                                        <div className="mt-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                                            <p className="text-sm text-green-900">
                                                <Icons.ShieldCheck size={16} className="inline mr-2" />
                                                {t('locationDataEncrypted')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Help & Support */}
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Icons.HelpCircle size={20} className="text-blue-600" />
                                </div>
                                <h2 className="text-lg font-bold text-gray-900">{t('helpAndSupport')}</h2>
                            </div>
                            
                            <p className="text-gray-600 text-sm mb-4">
                                {t('helpSupportIntro')}
                            </p>

                            <div className="space-y-3">
                                {/* Email Support */}
                                <a 
                                    href="mailto:support@safesphere.app"
                                    className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group"
                                >
                                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                        <Icons.Mail size={20} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900 group-hover:text-blue-600">{t('emailSupport')}</div>
                                        <div className="text-sm text-gray-600">support@safesphere.app</div>
                                    </div>
                                    <Icons.ChevronRight size={20} className="text-gray-400" />
                                </a>

                                {/* Live Chat */}
                                <button 
                                    onClick={() => onNavigate?.('chat')}
                                    className="w-full flex items-center gap-3 p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors group"
                                >
                                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                        <Icons.MessageCircle size={20} className="text-white" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-semibold text-gray-900 group-hover:text-green-600">{t('liveChat')}</div>
                                        <div className="text-sm text-gray-600">{t('liveChatHelpDesc')}</div>
                                    </div>
                                    <Icons.ChevronRight size={20} className="text-gray-400" />
                                </button>

                                {/* Phone Support */}
                                <a 
                                    href="tel:+18005233773"
                                    className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors group"
                                >
                                    <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                                        <Icons.Phone size={20} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-gray-900 group-hover:text-purple-600">{t('phoneSupport')}</div>
                                        <div className="text-sm text-gray-600">+1 (800) 523-3773 (24/7)</div>
                                    </div>
                                    <Icons.ChevronRight size={20} className="text-gray-400" />
                                </a>

                                {/* Documentation */}
                                <button 
                                    onClick={() => onNavigate?.('learn')}
                                    className="w-full flex items-center gap-3 p-4 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors group"
                                >
                                    <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                                        <Icons.FileText size={20} className="text-white" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-semibold text-gray-900 group-hover:text-amber-600">{t('documentation')}</div>
                                        <div className="text-sm text-gray-600">{t('documentationDesc')}</div>
                                    </div>
                                    <Icons.ChevronRight size={20} className="text-gray-400" />
                                </button>
                            </div>

                            {/* Response Time Info */}
                            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                                <div className="flex items-start gap-2">
                                    <Icons.Clock size={18} className="text-blue-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{t('averageResponseTime')}</p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {t('responseTimeDetails')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notification Settings */}
                {activeTab === 'notifications' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('alertPreferences')}</h2>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                            <Icons.AlertTriangle size={20} className="text-red-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('emergencyAlertsLabel')}</div>
                                            <div className="text-sm text-gray-500">{t('criticalNotifications')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, emergencyAlerts: !notifications.emergencyAlerts })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.emergencyAlerts ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.emergencyAlerts ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Icons.FileText size={20} className="text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('reportUpdates')}</div>
                                            <div className="text-sm text-gray-500">{t('statusChanges')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, reportUpdates: !notifications.reportUpdates })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.reportUpdates ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.reportUpdates ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                            <Icons.Bell size={20} className="text-purple-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('systemMessages')}</div>
                                            <div className="text-sm text-gray-500">{t('appUpdates')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, systemMessages: !notifications.systemMessages })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.systemMessages ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.systemMessages ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('deliveryMethods')}</h2>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-gray-900">{t('pushNotifications')}</div>
                                        <div className="text-sm text-gray-500">{t('instantMobileAlerts')}</div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, pushNotifications: !notifications.pushNotifications })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.pushNotifications ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.pushNotifications ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-gray-900">{t('emailNotifications')}</div>
                                        <div className="text-sm text-gray-500">Summary emails</div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, emailNotifications: !notifications.emailNotifications })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.emailNotifications ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.emailNotifications ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-gray-900">SMS Alerts</div>
                                        <div className="text-sm text-gray-500">Text messages</div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, smsAlerts: !notifications.smsAlerts })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.smsAlerts ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.smsAlerts ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Offline Features Section */}
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Icons.Wifi size={20} className="text-orange-600" />
                                <h2 className="text-lg font-bold text-gray-900">{t('offlineModeFeatures')}</h2>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                {t('offlineFeaturesDesc')}
                            </p>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Icons.Settings size={20} className="text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('bluetoothBeacon')}</div>
                                            <div className="text-sm text-gray-500">{t('broadcastSosBluetooth')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, bluetoothEnabled: !notifications.bluetoothEnabled })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.bluetoothEnabled ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.bluetoothEnabled ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                            <Icons.MapPin size={20} className="text-green-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('gpsLocation')}</div>
                                            <div className="text-sm text-gray-500">{t('trackLocationOffline')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, gpsEnabled: !notifications.gpsEnabled })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.gpsEnabled ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.gpsEnabled ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                            <Icons.Wifi size={20} className="text-orange-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('offlineMode')}</div>
                                            <div className="text-sm text-gray-500">{t('workWithoutInternet')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, offlineMode: !notifications.offlineMode })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.offlineMode ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.offlineMode ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                            <Icons.Archive size={20} className="text-purple-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('localStorageSync')}</div>
                                            <div className="text-sm text-gray-500">{t('cacheDataLocally')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, localStorageSync: !notifications.localStorageSync })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.localStorageSync ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.localStorageSync ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                            <Icons.AlertTriangle size={20} className="text-red-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{t('emergencyBeacon')}</div>
                                            <div className="text-sm text-gray-500">{t('sendSosWithoutInternet')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setNotifications({ ...notifications, emergencyBeacon: !notifications.emergencyBeacon })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            notifications.emergencyBeacon ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            notifications.emergencyBeacon ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>
                            </div>

                            {/* Offline Mode Info */}
                            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <div className="flex items-start gap-3">
                                    <Icons.ShieldCheck size={20} className="text-blue-600 mt-0.5" />
                                    <div>
                                        <div className="font-semibold text-blue-900 text-sm mb-1">{t('whyOfflineFeaturesMatter')}</div>
                                        <div className="text-xs text-blue-700 leading-relaxed">
                                            {t('offlineFeaturesBullets')}<br/>
                                            • {t('offlineBullet1')}<br/>
                                            • {t('offlineBullet2')}<br/>
                                            • {t('offlineBullet3')}<br/>
                                            • {t('syncReportsWhenOnline')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Privacy Settings */}
                {activeTab === 'privacy' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('privacyControls')}</h2>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-gray-900">{t('profileVisibility')}</div>
                                        <div className="text-sm text-gray-500">Who can see your profile</div>
                                    </div>
                                    <select
                                        value={privacy.profileVisibility}
                                        onChange={(e) => setPrivacy({ ...privacy, profileVisibility: e.target.value })}
                                        className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
                                    >
                                        <option value="public">Public</option>
                                        <option value="responders">Responders Only</option>
                                        <option value="private">Private</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-gray-900">{t('shareLocation')}</div>
                                        <div className="text-sm text-gray-500">Allow location sharing</div>
                                    </div>
                                    <button
                                        onClick={() => setPrivacy({ ...privacy, shareLocation: !privacy.shareLocation })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            privacy.shareLocation ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            privacy.shareLocation ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-gray-900">Show Activity</div>
                                        <div className="text-sm text-gray-500">Display online status</div>
                                    </div>
                                    <button
                                        onClick={() => setPrivacy({ ...privacy, showActivity: !privacy.showActivity })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            privacy.showActivity ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            privacy.showActivity ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-gray-900">Allow Messaging</div>
                                        <div className="text-sm text-gray-500">Receive direct messages</div>
                                    </div>
                                    <button
                                        onClick={() => setPrivacy({ ...privacy, allowMessaging: !privacy.allowMessaging })}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${
                                            privacy.allowMessaging ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all ${
                                            privacy.allowMessaging ? 'right-1' : 'left-1'
                                        }`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('dataManagement')}</h2>
                            
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={handleDownloadMyData}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Icons.Download size={20} className="text-blue-600 shrink-0" />
                                        <span className="font-semibold text-gray-900">{t('downloadMyData')}</span>
                                    </div>
                                    <Icons.ChevronRight size={20} className="text-gray-400 shrink-0" />
                                </button>

                                <button
                                    type="button"
                                    onClick={handleClearCache}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Icons.Archive size={20} className="text-gray-600 shrink-0" />
                                        <span className="font-semibold text-gray-900">{t('clearCache')}</span>
                                    </div>
                                    <Icons.ChevronRight size={20} className="text-gray-400 shrink-0" />
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDeleteAccount}
                                    className="w-full flex items-center justify-between p-4 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Icons.Trash size={20} className="text-red-600 shrink-0" />
                                        <span className="font-semibold text-red-600">{t('deleteAccount')}</span>
                                    </div>
                                    <Icons.ChevronRight size={20} className="text-red-400 shrink-0" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Security Settings */}
                {activeTab === 'security' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('passwordAndAuthentication')}</h2>
                            
                            {!showPasswordForm ? (
                                <button
                                    onClick={() => setShowPasswordForm(true)}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Icons.Lock size={20} className="text-blue-600" />
                                        <span className="font-semibold text-gray-900">{t('changePassword')}</span>
                                    </div>
                                    <Icons.ChevronRight size={20} className="text-gray-400" />
                                </button>
                            ) : (
                                <form onSubmit={handlePasswordChange} className="space-y-4">
                                    {passwordError && (
                                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
                                            <Icons.AlertTriangle size={18} />
                                            <span className="text-sm font-semibold">{passwordError}</span>
                                        </div>
                                    )}
                                    
                                    {passwordSuccess && (
                                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-600">
                                            <Icons.Check size={18} />
                                            <span className="text-sm font-semibold">{t('passwordChangedSuccess')}</span>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('currentPassword')}</label>
                                        <input
                                            type="password"
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('newPassword')}</label>
                                        <input
                                            type="password"
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('confirmNewPassword')}</label>
                                        <input
                                            type="password"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                            required
                                        />
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowPasswordForm(false);
                                                setPasswordError('');
                                                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                            }}
                                            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                                        >
                                            {t('updatePassword')}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('twoFactorAuthentication')}</h2>
                            {hasSecurityChanges && (
                                <p className="text-sm text-gray-500 mb-3">{t('saveToApply')}</p>
                            )}
                            <div className="p-4 bg-blue-50 rounded-xl mb-4">
                                <div className="flex items-start gap-3">
                                    <Icons.ShieldCheck size={24} className="text-blue-600 mt-1 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-gray-900 mb-1">{t('extraSecurityLayer')}</div>
                                        <div className="text-sm text-gray-600 mb-2">
                                            {t('twoFactorDesc')}
                                        </div>
                                        <p className="text-sm font-medium text-blue-800">
                                            {t('twoFactorFaceIdRequirement')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={handleToggle2FA}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Icons.Fingerprint size={20} className="text-purple-600 shrink-0" />
                                        <span className="font-semibold text-gray-900">{t('enable2fa')}</span>
                                    </div>
                                    <div className={`w-12 h-7 rounded-full transition-colors relative ${twoFactorDisplay ? 'bg-purple-500' : 'bg-gray-300'}`}>
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all shadow ${twoFactorDisplay ? 'right-1' : 'left-1'}`} />
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleToggleFaceId}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <Icons.ScanFace size={20} className="text-blue-600 shrink-0" />
                                        <span className="font-semibold text-gray-900">{t('enableFaceId')}</span>
                                    </div>
                                    <div className={`w-12 h-7 rounded-full transition-colors relative ${faceIdDisplay ? 'bg-blue-500' : 'bg-gray-300'}`}>
                                        <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all shadow ${faceIdDisplay ? 'right-1' : 'left-1'}`} />
                                    </div>
                                </button>
                            </div>

                            {hasSecurityChanges && (
                                <div className="mt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={handleDiscardSecurity}
                                        className="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                        {t('discard')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveSecurity}
                                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                                    >
                                        {t('saveChanges')}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('activeSessions')}</h2>
                            
                            <div className="space-y-3">
                                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-gray-900">{t('currentSession')}</span>
                                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">{t('active')}</span>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <div>{currentDeviceLabel}</div>
                                        <div className="text-xs text-gray-500 mt-1">{t('lastActive')}: Just now</div>
                                    </div>
                                </div>

                                {otherSessions.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('otherDevices')}</div>
                                        {otherSessions.map((s) => (
                                            <div key={s.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{s.device}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{t('lastActive')}: {s.lastActive}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleEndAllOtherSessions}
                                    disabled={otherSessions.length === 0}
                                    className="w-full p-4 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-50"
                                >
                                    {t('endAllOtherSessions')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Security confirmation popup (2FA / Face ID activated or disabled) */}
            {securityPopupMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSecurityPopupMessage(null)}>
                    <div
                        className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                            <Icons.ShieldCheck size={24} className="text-green-600" />
                        </div>
                        <p className="text-gray-900 font-medium">{securityPopupMessage}</p>
                        <button
                            type="button"
                            onClick={() => setSecurityPopupMessage(null)}
                            className="mt-5 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                        >
                            {t('ok')}
                        </button>
                    </div>
                </div>
            )}

            {/* 2FA enrollment modal (Supabase real users) */}
            {showEnrollMfa && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowEnrollMfa(false)}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('enable2fa')}</h3>
                        <p className="text-sm text-gray-600 mb-4">{t('mfaEnterCode')}</p>
                        {mfaEnrollQrSvg && (
                            <div className="flex justify-center mb-4 p-4 bg-gray-50 rounded-xl">
                                <img
                                    src={`data:image/svg+xml;utf8,${encodeURIComponent(mfaEnrollQrSvg)}`}
                                    alt="QR code for authenticator app"
                                    className="w-48 h-48"
                                />
                            </div>
                        )}
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('mfaCodeLabel')}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={mfaEnrollCode}
                                onChange={e => { setMfaEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setMfaEnrollError(null); }}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-center text-lg tracking-widest font-mono"
                                placeholder="000000"
                                maxLength={6}
                            />
                        </div>
                        {mfaEnrollError && <p className="text-sm text-red-600 mb-2">{mfaEnrollError}</p>}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowEnrollMfa(false)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleVerifyMfaEnrollment}
                                disabled={mfaEnrollLoading}
                                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                            >
                                {mfaEnrollLoading ? '...' : t('verify')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            </div>
    );
};

export default Settings;
