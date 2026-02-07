import React from 'react';
import { Icons } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';

const FallbackIcon = Icons.BookOpen ?? Icons.ShieldCheck;

interface LearnProps {
    onBack?: () => void;
    onNavigate?: (tab: string) => void;
}

const Learn: React.FC<LearnProps> = ({ onBack, onNavigate }) => {
    const { t } = useLanguage();

    const howToGuides = [
        { icon: Icons.Emergency ?? FallbackIcon, titleKey: 'learnReportIncident', descKey: 'learnReportIncidentDesc', tab: 'emergency' as const },
        { icon: Icons.CheckCircle ?? FallbackIcon, titleKey: 'learnChecklist', descKey: 'learnChecklistDesc', tab: 'prepare' as const },
        { icon: Icons.Map ?? FallbackIcon, titleKey: 'learnLiveMap', descKey: 'learnLiveMapDesc', tab: 'maps' as const },
        { icon: Icons.Chat ?? FallbackIcon, titleKey: 'learnChat', descKey: 'learnChatDesc', tab: 'chat' as const },
    ];

    const tutorials = [
        { titleKey: 'tutorialEmergencyBasics', descKey: 'tutorialEmergencyBasicsDesc', url: 'https://www.redcross.org/get-help/how-to-prepare-for-emergencies.html', source: 'Red Cross' },
        { titleKey: 'tutorialFirstAid', descKey: 'tutorialFirstAidDesc', url: 'https://www.redcross.org/take-a-class/first-aid', source: 'Red Cross' },
        { titleKey: 'tutorialDisasterPrep', descKey: 'tutorialDisasterPrepDesc', url: 'https://www.ready.gov', source: 'FEMA / Ready.gov' },
        { titleKey: 'tutorialEarthquake', descKey: 'tutorialEarthquakeDesc', url: 'https://www.earthquakecountry.org/sevensteps/', source: 'Earthquake Country Alliance' },
    ];

    const externalResources = [
        { name: 'Red Cross', url: 'https://www.redcross.org', descKey: 'resourceRedCross' },
        { name: 'FEMA', url: 'https://www.fema.gov', descKey: 'resourceFEMA' },
        { name: 'WHO Emergency', url: 'https://www.who.int/emergencies', descKey: 'resourceWHO' },
        { name: 'CDC Emergency', url: 'https://emergency.cdc.gov', descKey: 'resourceCDC' },
    ];

    const ArrowLeftIcon = Icons.ArrowLeft ?? Icons.ChevronRight ?? FallbackIcon;
    const BookOpenIcon = Icons.BookOpen ?? FallbackIcon;
    const VideoIcon = Icons.Video ?? Icons.Play ?? FallbackIcon;
    const PlayIcon = Icons.Play ?? Icons.Video ?? FallbackIcon;
    const ChevronRightIcon = Icons.ChevronRight ?? FallbackIcon;
    const GlobeIcon = Icons.Globe ?? FallbackIcon;
    const ShieldIcon = Icons.Shield ?? FallbackIcon;

    return (
        <div className="min-h-screen bg-gray-50 pb-24 sm:pb-28">
            {/* Subtitle bar - App Header above shows SafeSphere + logo */}
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
                <div className="flex items-center gap-3 max-w-2xl mx-auto">
                    <button onClick={onBack} className="p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors touch-manipulation shrink-0" aria-label={t('back')}>
                        <ArrowLeftIcon size={22} className="text-gray-700 shrink-0" />
                    </button>
                    <p className="text-sm sm:text-base text-gray-600 font-medium">{t('learnSubtitle')}</p>
                </div>
            </div>

            <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10 max-w-2xl mx-auto">
                {/* How to guides */}
                <section>
                    <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <BookOpenIcon size={18} className="text-blue-600 shrink-0" />
                        {t('howToGuides')}
                    </h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                        {howToGuides.map((item, i) => {
                            const Icon = item.icon ?? FallbackIcon;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => onNavigate?.(item.tab)}
                                    className="w-full p-4 sm:p-5 text-left hover:bg-gray-50/50 transition-colors touch-manipulation active:scale-[0.99] group"
                                >
                                    <div className="flex gap-3 sm:gap-4 items-start">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                            <Icon size={20} className="text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900">{t(item.titleKey)}</h3>
                                            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{t(item.descKey)}</p>
                                            <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                                                {t('readMore')}
                                                <ChevronRightIcon size={14} className="shrink-0" />
                                            </span>
                                        </div>
                                        <ChevronRightIcon size={16} className="text-gray-400 shrink-0 mt-1" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Tutorial videos & resources */}
                <section>
                    <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <VideoIcon size={18} className="text-amber-600 shrink-0" />
                        {t('tutorialVideos')}
                    </h2>
                    <div className="space-y-3">
                        {tutorials.map((item, i) => (
                            <a
                                key={i}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 hover:border-blue-300 hover:shadow transition-all group touch-manipulation active:scale-[0.99]"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                                        <PlayIcon size={24} className="text-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">{t(item.titleKey)}</h3>
                                        <p className="text-sm text-gray-600 mt-0.5">{t(item.descKey)}</p>
                                        <span className="inline-block mt-2 text-xs font-medium text-blue-600">{item.source} →</span>
                                    </div>
                                    <ChevronRightIcon size={16} className="text-gray-400 shrink-0 mt-1" />
                                </div>
                            </a>
                        ))}
                    </div>
                </section>

                {/* External resources */}
                <section>
                    <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <GlobeIcon size={18} className="text-emerald-600 shrink-0" />
                        {t('externalResources')}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {externalResources.map((res, i) => (
                            <a
                                key={i}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 hover:border-emerald-300 hover:shadow transition-all flex items-center gap-3 touch-manipulation active:scale-[0.99] min-h-[72px]"
                            >
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                    <ShieldIcon size={20} className="text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                    <span className="font-semibold text-gray-900 block">{res.name}</span>
                                    <span className="text-xs text-gray-500">{t(res.descKey)}</span>
                                </div>
                                <ChevronRightIcon size={14} className="text-gray-400 shrink-0 ml-auto" />
                            </a>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Learn;
