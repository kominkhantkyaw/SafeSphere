import React from 'react';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const navItems = [
    { id: 'home', labelKey: 'home', icon: Icons.House },
    { id: 'maps', labelKey: 'map', icon: Icons.Map },
    { id: 'prepare', labelKey: 'prepare', icon: Icons.Prepare },
    { id: 'emergency', labelKey: 'sos', icon: Icons.SOS },
    { id: 'chat', labelKey: 'chat', icon: Icons.Chat },
    { id: 'menu', labelKey: 'menu', icon: Icons.PanelLeft },
] as const;

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
    const { t } = useLanguage();

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 safe-bottom flex justify-center px-2 sm:px-4"
            role="navigation"
            aria-label="Main navigation"
        >
            <div className="w-full max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto sm:mb-4">
                <div className="flex justify-between items-stretch gap-0.5 sm:gap-1 px-1 sm:px-3 py-2 sm:py-2.5 rounded-t-2xl sm:rounded-2xl bg-white/50 sm:bg-white/45 backdrop-blur-md border border-gray-200/60 sm:border-gray-200/50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] sm:shadow-xl">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        const Icon = item.icon;
                        const isSos = item.id === 'emergency';
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onTabChange(item.id)}
                                aria-label={t(item.labelKey)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`
                                    relative flex flex-col items-center justify-center flex-1 min-w-0 
                                    px-1.5 sm:px-2 py-2 sm:py-2.5 min-h-[52px] sm:min-h-[56px]
                                    rounded-xl sm:rounded-xl transition-all duration-200 ease-out
                                    select-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1
                                    active:scale-[0.96] touch-manipulation
                                    ${isActive
                                        ? isSos
                                            ? 'text-red-600 bg-red-50/70 shadow-sm'
                                            : 'text-blue-600 bg-blue-50/70 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                                    }
                                `}
                            >
                                <span
                                    className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg transition-colors ${
                                        isActive ? (isSos ? 'bg-red-100' : 'bg-blue-100') : ''
                                    }`}
                                >
                                    <Icon
                                        size={isActive ? 22 : 20}
                                        strokeWidth={isActive ? 2.25 : 2}
                                        className="shrink-0 transition-transform duration-200"
                                    />
                                </span>
                                <span
                                    className={`mt-1 text-[10px] sm:text-[11px] font-medium truncate w-full text-center leading-tight ${
                                        isActive ? 'opacity-100' : 'opacity-90'
                                    }`}
                                >
                                    {t(item.labelKey)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};

export default BottomNav;