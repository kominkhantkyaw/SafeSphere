

import React, { useState, useEffect } from 'react';
import { UserProvider, useUser } from './contexts/UserContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Emergency from './pages/Emergency';
import Prepare from './pages/Prepare';
import Resources from './pages/Resources';
import Admin from './pages/Admin';
import Maps from './pages/Maps';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Chat from './pages/Chat';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Notifications from './pages/Notifications';
import Menu from './pages/Menu';
import Directory from './pages/Directory';
import Learn from './pages/Learn';
import ThemeSettings from './components/ThemeSettings';
import SystemStatus from './components/SystemStatus';
import QRScanner from './components/QRScanner';
import Footer from './components/Footer';
import { Icons } from './components/Icon';
import { ThemeSettings as ThemeSettingsType, User } from './types';
import { getInstallPromptAvailable, installPWA } from './pwa-install';

/** Tabs that show back button and hide footer/bottom nav (Learn, Settings, Privacy, Profile show Footer) */
const BACK_ENABLED_TABS = ['admin', 'resources', 'notifications', 'directory'] as const;

const getDefaultTheme = (): ThemeSettingsType => ({
    primaryColor: '#1d4ed8',
    backgroundColor: '#f8fafc',
    fontFamily: 'inter',
    themeMode: 'system',
    appName: 'SafeSphere',
    logoUrl: '',
    enableSeo: true
});

const AppContent: React.FC = () => {
    const { user, isAuthenticated, login, logout } = useUser();
    const { t } = useLanguage();
    
    // -- Theme State (safe parse to avoid blank page on corrupt localStorage) --
    const [theme, setTheme] = useState<ThemeSettingsType>(() => {
        try {
            const saved = localStorage.getItem('safesphere_theme');
            if (!saved) return getDefaultTheme();
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                if (!parsed.themeMode && typeof parsed.darkMode === 'boolean') {
                    parsed.themeMode = parsed.darkMode ? 'dark' : 'light';
                }
                return { ...getDefaultTheme(), ...parsed };
            }
        } catch (_e) {
            localStorage.removeItem('safesphere_theme');
        }
        return getDefaultTheme();
    });
    const [showThemeSettings, setShowThemeSettings] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showSystemStatus, setShowSystemStatus] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);

    // -- App State --
    const [activeTab, setActiveTab] = useState('home');
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [notificationCount, setNotificationCount] = useState(3); // Demo notification count
    const [installAvailable, setInstallAvailable] = useState(getInstallPromptAvailable);
    const [installBannerDismissed, setInstallBannerDismissed] = useState(() =>
        typeof sessionStorage !== 'undefined' && sessionStorage.getItem('safesphere-install-banner-dismissed') === '1'
    );

    // -- Effects --
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Handle menu tab click - open sidebar and reset to home
    useEffect(() => {
        if (activeTab === 'menu') {
            setSidebarOpen(true);
            setActiveTab('home');
        }
    }, [activeTab]);

    // PWA install prompt available (e.g. Android/Chrome)
    useEffect(() => {
        const onAvailable = () => setInstallAvailable(true);
        window.addEventListener('safesphere-install-available', onAvailable);
        return () => window.removeEventListener('safesphere-install-available', onAvailable);
    }, []);

    // Resolve effective dark mode (light/dark/system)
    const effectiveDarkMode = theme.themeMode === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : theme.themeMode === 'dark';

    // Apply Theme to Body and Persist
    useEffect(() => {
        const body = document.body;
        
        // Font
        body.classList.remove('font-inter', 'font-roboto', 'font-serif');
        body.classList.add(`font-${theme.fontFamily}`);

        // Login page: dark blue outer background
        if (!isAuthenticated) {
            body.classList.add('login-page-active');
            body.style.backgroundColor = '#1e40af';
        } else {
            body.classList.remove('login-page-active');
            // Dark Mode (resolved from themeMode)
            if (effectiveDarkMode) {
                body.classList.add('theme-dark');
                body.style.backgroundColor = '#111827';
            } else {
                body.classList.remove('theme-dark');
                body.style.backgroundColor = theme.backgroundColor;
            }
        }

        // Primary Color CSS Variable (optional usage in css)
        body.style.setProperty('--primary-color', theme.primaryColor);
        
        // Save to local storage
        localStorage.setItem('safesphere_theme', JSON.stringify(theme));

        // Update Title for SEO
        if (theme.enableSeo) {
            document.title = `${theme.appName} - Emergency Response`;
        } else {
            document.title = theme.appName;
        }

    }, [theme, isAuthenticated, effectiveDarkMode]);

    // Listen for system preference changes when themeMode is 'system'
    useEffect(() => {
        if (theme.themeMode !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => setTheme((prev) => ({ ...prev })); // Force re-render
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme.themeMode]);

    const handleLogin = (role: string, user?: User) => {
        if (user) {
            login(user);
            try { sessionStorage.removeItem('safesphere-install-banner-dismissed'); } catch {}
            setInstallBannerDismissed(false);
            return;
        }
        // Create a user object with demo data for existing users
        const demoUser: User = {
            id: 1,
            name: role === 'Admin' ? 'Admin User' : role === 'Responder' ? 'Responder User' : 'Reporter User',
            role: role as User['role'],
            safetyScore: 85,
            xp: 450,
            email: role.toLowerCase() + '@safesphere.app',
            phone: '+1 234 567 8900',
            bloodType: 'O+',
            volunteerPoints: 24,
            skills: role === 'Admin' ? ['Emergency Management', 'First Aid', 'Crisis Communication'] :
                   role === 'Responder' ? ['First Aid', 'CPR Certified', 'Search & Rescue'] :
                   ['First Aid'],
            emergencyContactName: 'Emergency Contact',
            emergencyContactPhone: '+1 234 567 8901'
        };
        login(demoUser);
        try { sessionStorage.removeItem('safesphere-install-banner-dismissed'); } catch {}
        setInstallBannerDismissed(false);
    };

    const handleLogout = () => {
        setSidebarOpen(false);
        if (confirm(t('signOutConfirm'))) {
            logout();
            setActiveTab('home');
        }
    };

    const handleProfileClick = () => {
        setActiveTab('profile');
    };

    const handleSettingsClick = () => {
        setActiveTab('settings');
    };

    const handleQRScan = () => {
        setShowQRScanner(true);
    };

    const handleNotificationClick = () => {
        setActiveTab('notifications');
    };

    const handleBackClick = () => {
        if (BACK_ENABLED_TABS.includes(activeTab as typeof BACK_ENABLED_TABS[number])) {
            setActiveTab('home');
        }
    };

    const handleHomeClick = () => {
        setActiveTab('home');
    };

    const handleMenuClick = () => {
        setSidebarOpen(true);
    };

    const handleNavigate = (page: string) => {
        setActiveTab(page);
    };

    const shouldShowBackButton = BACK_ENABLED_TABS.includes(activeTab as typeof BACK_ENABLED_TABS[number]);

    const renderContent = () => {
        switch (activeTab) {
            case 'home': return <Home onNavigate={setActiveTab} onOpenSystemStatus={() => setShowSystemStatus(true)} />;
            case 'emergency': return <Emergency />;
            case 'prepare': return <Prepare onNavigate={setActiveTab} />;
            case 'resources': return <Resources />;
            case 'maps': return <Maps />;
            case 'admin': return (user?.role === 'Admin' || user?.role === 'Responder') ? <Admin /> : <Home onNavigate={setActiveTab} onOpenSystemStatus={() => setShowSystemStatus(true)} />;
            case 'profile': return <Profile onBack={() => setActiveTab('home')} />;
            case 'settings': return <Settings onBack={() => setActiveTab('home')} onNavigate={setActiveTab} theme={theme} onThemeUpdate={setTheme} onThemeSettingsClick={() => setShowThemeSettings(true)} />;
            case 'chat': return <Chat />;
            case 'privacy': return <PrivacyPolicy onBack={() => setActiveTab('home')} />;
            case 'notifications': return <Notifications onBack={() => setActiveTab('home')} onNavigateToMap={() => setActiveTab('maps')} />;
            case 'directory': return <Directory onBack={() => setActiveTab('home')} />;
            case 'learn': return <Learn onBack={() => setActiveTab('home')} onNavigate={setActiveTab} />;
            case 'menu': return <Menu onNavigate={setActiveTab} onThemeSettingsClick={() => setShowThemeSettings(true)} onBack={() => setActiveTab('home')} />;
            default: return <Home onNavigate={setActiveTab} onOpenSystemStatus={() => setShowSystemStatus(true)} />;
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen min-h-[100dvh] w-full" style={{ background: '#1e40af' }}>
                <Login onLogin={handleLogin} theme={theme} />
            </div>
        );
    }

    return (
        <div 
            className="min-h-screen min-h-[100dvh] font-sans w-full max-w-full min-w-0 sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto relative shadow-2xl overflow-x-hidden flex flex-col transition-colors duration-300"
            style={{ backgroundColor: effectiveDarkMode ? '#1f2937' : theme.backgroundColor, color: effectiveDarkMode ? '#fff' : '#000' }}
        >
            
            {/* Header with Settings Trigger */}
            <div className="sticky top-0 z-40 safe-top shrink-0">
                <Header 
                    title={activeTab === 'profile' ? t('myProfile') : 
                           activeTab === 'settings' ? t('settings') : 
                           activeTab === 'chat' ? t('messages') :
                           activeTab === 'directory' ? t('directory') :
                           activeTab === 'notifications' ? t('notifications') :
                           activeTab === 'learn' ? theme.appName :
                           activeTab === 'menu' ? t('menu') :
                           theme.appName} 
                    logoUrl={theme.logoUrl} 
                    onProfileClick={handleProfileClick}
                    onUserSettingsClick={handleSettingsClick}
                    onLogout={handleLogout}
                    onBackClick={handleBackClick}
                    onMenuClick={handleMenuClick}
                    onQRScanClick={handleQRScan}
                    onNotificationClick={handleNotificationClick}
                    userAvatar={user?.avatar}
                    userName={user?.name}
                    showBackButton={shouldShowBackButton}
                    notificationCount={notificationCount}
                />
            </div>
            
            {/* Offline Banner */}
            {isOffline && (
                <div className="bg-gray-800 text-white text-xs py-1 px-4 text-center flex items-center justify-center gap-2 animate-in slide-in-from-top">
                    <Icons.Wifi size={12} className="opacity-50" />
                    <span>{t('offlineBanner')}</span>
                </div>
            )}

            {/* Install PWA Banner (one-time dismissible) – text and buttons centred in blue bar */}
            {installAvailable && !installBannerDismissed && !window.matchMedia('(display-mode: standalone)').matches && (
                <div className="bg-blue-600 text-white text-sm min-h-[56px] py-4 px-4 flex items-center justify-between gap-3">
                    <span className="flex-1 min-w-0 leading-snug">{t('installBannerMessage')}</span>
                    <div className="flex items-center gap-2 shrink-0 self-center">
                        <button
                            type="button"
                            onClick={() => installPWA()}
                            className="px-3 py-2 rounded-lg bg-white text-blue-600 font-semibold text-xs"
                        >
                            {t('installApp')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                try { sessionStorage.setItem('safesphere-install-banner-dismissed', '1'); } catch {}
                                setInstallBannerDismissed(true);
                            }}
                            className="px-3 py-2 rounded-lg bg-white/20 text-white font-medium text-xs"
                            aria-label={t('installBannerLater')}
                        >
                            {t('installBannerLater')}
                        </button>
                    </div>
                </div>
            )}

            <div className={`flex-1 min-w-0 overflow-y-auto overflow-x-hidden no-scrollbar relative flex flex-col app-scroll-container ${!BACK_ENABLED_TABS.includes(activeTab as typeof BACK_ENABLED_TABS[number]) ? 'pb-content-nav' : ''}`}>
                <div className="flex-1 min-w-0 flex flex-col app-page-wrap">
                    {renderContent()}
                </div>
                {!BACK_ENABLED_TABS.includes(activeTab as typeof BACK_ENABLED_TABS[number]) && (
                    <Footer
                        onNavigate={handleNavigate}
                        onOpenSystemStatus={() => setShowSystemStatus(true)}
                        darkMode={effectiveDarkMode}
                    />
                )}
            </div>
            
            {/* Only show BottomNav on main pages, not on Profile, Settings, Admin, Resources, Privacy, Notifications, or Directory */}
            {!BACK_ENABLED_TABS.includes(activeTab as typeof BACK_ENABLED_TABS[number]) && (
                <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
            )}

            {/* Sidebar Drawer */}
            <Sidebar 
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onNavigate={handleNavigate}
                onThemeSettingsClick={() => setShowThemeSettings(true)}
                onLogout={handleLogout}
                appTheme={theme}
                onThemeUpdate={setTheme}
            />

            {/* Theme Settings Modal */}
            {showThemeSettings && (
                <ThemeSettings 
                    settings={theme} 
                    onUpdate={setTheme} 
                    onClose={() => setShowThemeSettings(false)} 
                />
            )}

            {/* System Status Modal */}
            <SystemStatus 
                isOpen={showSystemStatus}
                onClose={() => setShowSystemStatus(false)}
            />

            {/* QR Scanner Modal */}
            <QRScanner 
                isOpen={showQRScanner}
                onClose={() => setShowQRScanner(false)}
                onScan={(data) => {
                    console.log('Scanned:', data);
                    const trimmed = data.trim();

                    // Navigate to resources page when a resource QR is scanned
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (parsed && parsed.type === 'resource') {
                            setShowQRScanner(false);
                            setActiveTab('resources');
                            return;
                        }
                    } catch { /* not JSON */ }

                    // Rescue-centre IDs (SAFESPHERE-RC-*) — keep scanner open to show details
                    if (/^SAFESPHERE-RC-\d+$/.test(trimmed)) return;

                    // SafeSphere internal URLs — navigate to the right tab
                    try {
                        const url = new URL(trimmed);
                        const path = url.pathname.toLowerCase();
                        if (path.includes('/report')) { setShowQRScanner(false); setActiveTab('report'); }
                        else if (path.includes('/resource')) { setShowQRScanner(false); setActiveTab('resources'); }
                        else if (path.includes('/map')) { setShowQRScanner(false); setActiveTab('map'); }
                        else if (path.includes('/chat')) { setShowQRScanner(false); setActiveTab('chat'); }
                        else if (path.includes('/learn')) { setShowQRScanner(false); setActiveTab('learn'); }
                        // External URL — scanner already shows "Open URL" button
                    } catch { /* not a URL */ }
                }}
            />
        </div>
    );
};

const App: React.FC = () => {
    return (
        <LanguageProvider>
            <UserProvider>
                <AppContent />
            </UserProvider>
        </LanguageProvider>
    );
};

export default App;
