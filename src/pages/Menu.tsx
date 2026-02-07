import React from 'react';
import { Icons } from '../components/Icon';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';

interface MenuProps {
    onNavigate: (page: string) => void;
    onThemeSettingsClick?: () => void;
    onBack?: () => void;
}

const Menu: React.FC<MenuProps> = ({ onNavigate, onThemeSettingsClick, onBack }) => {
    const { user, logout } = useUser();
    const { t } = useLanguage();

    if (!user) return null;

    const handleLogout = () => {
        if (confirm(t('signOutConfirm'))) {
            logout();
        }
    };

    const handleShareApp = async () => {
        const shareData = {
            title: 'SafeSphere - Emergency Response System',
            text: '🚨 Stay prepared and connected during emergencies! Download SafeSphere - your comprehensive emergency response companion with real-time alerts, incident reporting, and safety resources.',
            url: window.location.origin
        };

        try {
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
            } else {
                // Fallback to clipboard
                await copyToClipboard(shareData.url);
            }
        } catch (error) {
            // User cancelled or error occurred
            if (error instanceof Error && error.name !== 'AbortError') {
                await copyToClipboard(shareData.url);
            }
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            alert('✅ SafeSphere app link copied to clipboard!\n\nShare with your friends and family to keep them safe.');
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('✅ SafeSphere app link copied to clipboard!');
        }
    };

    const menuItems = [
        {
            id: 'profile-settings',
            labelKey: 'profileSettings',
            icon: Icons.User,
            action: () => onNavigate('profile')
        },
        {
            id: 'app-preferences',
            labelKey: 'appPreferences',
            icon: Icons.Settings,
            action: () => onNavigate('settings')
        },
        {
            id: 'notification-settings',
            labelKey: 'notificationSettings',
            icon: Icons.Bell,
            action: () => {
                onNavigate('settings');
                // Add a small delay to let the page load, then switch to notifications tab
                setTimeout(() => {
                    const notifTab = document.querySelector('[data-tab="notifications"]') as HTMLElement;
                    if (notifTab) notifTab.click();
                }, 100);
            }
        },
        {
            id: 'emergency-plan',
            labelKey: 'emergencyPlan',
            icon: Icons.Clipboard,
            action: () => onNavigate('prepare')
        },
        {
            id: 'learn',
            labelKey: 'learn',
            icon: Icons.BookOpen,
            action: () => onNavigate('learn')
        },
        {
            id: 'share-app',
            labelKey: 'shareApp',
            icon: Icons.Share,
            action: handleShareApp
        },
        {
            id: 'help-support',
            labelKey: 'helpSupport',
            icon: Icons.HelpCircle,
            action: () => {
                const helpText = 
                    `🆘 ${t('helpSupportTitle')}\n` +
                    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                    `📧 ${t('emailSupport')}\n` +
                    'support@safesphere.app\n' +
                    `${t('responseTime')}\n\n` +
                    `📞 ${t('emergencyHotline')}\n` +
                    '1-800-SAFE-911 (24/7)\n\n' +
                    `💬 ${t('liveChat')}\n` +
                    `${t('liveChatDesc')}\n\n` +
                    `🌐 ${t('helpCenter')}\n` +
                    'www.safesphere.app/help\n\n' +
                    `📱 ${t('technicalSupport')}\n` +
                    'tech@safesphere.app\n\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━\n' +
                    t('emergencyCallNote');
                alert(helpText);
            }
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Icons.ArrowLeft size={24} className="text-gray-900" />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900">SafeSphere</h1>
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Icons.Menu size={24} className="text-gray-900" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
                            <Icons.Bell size={24} className="text-gray-900" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>
                        <div className="w-8 h-8 rounded-full border-2 border-gray-300 overflow-hidden">
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs font-bold">
                                    {(user?.name ?? '').charAt(0).toUpperCase() || '?'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Menu Title */}
            <div className="px-6 py-6">
                <h2 className="text-2xl font-bold text-gray-900">Menu</h2>
            </div>

            {/* Menu Sections */}
            <div className="px-6 -mt-12 space-y-4">
                {/* Profile Card with View Profile Button */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full border-2 border-gray-200 overflow-hidden bg-white">
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white text-2xl font-bold">
                                    {(user?.name ?? '').charAt(0).toUpperCase() || '?'}
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
                            <p className="text-sm text-gray-500">{user?.email || 'min.khant@safesphere.app'}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onNavigate('profile')}
                        className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors"
                    >
                        View Profile
                    </button>
                </div>

                {/* Menu Items */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden divide-y divide-gray-100">
                    {menuItems.map((item) => {
                        const Icon = item.icon ?? Icons.Settings;
                        return (
                            <button
                                key={item.id}
                                onClick={item.action}
                                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                                    <Icon size={20} />
                                </div>
                                <span className="flex-1 text-left font-medium text-gray-900">
                                    {t(item.labelKey)}
                                </span>
                                <Icons.ChevronRight size={20} className="text-gray-400" />
                            </button>
                        );
                    })}
                </div>

                {/* App Version */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden p-4">
                    <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>App Version</span>
                        <span className="font-semibold text-gray-900">2.0.0</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-500 mt-2">
                        <span>Last Updated</span>
                        <span className="font-semibold text-gray-900">Dec 10, 2025</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400 text-center">
                            SafeSphere Emergency Response System
                        </p>
                        <p className="text-xs text-gray-400 text-center mt-1">
                            © 2025 SafeSphere. All rights reserved.
                        </p>
                    </div>
                </div>

                {/* Logout Button */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 p-4 text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <Icons.LogOut size={20} />
                        <span className="font-semibold">Log Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Menu;
