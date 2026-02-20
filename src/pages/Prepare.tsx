import React, { useEffect, useState } from 'react';
import { Icons } from '../components/Icon';
import Onboarding from '../components/Onboarding';
import { useLanguage } from '../contexts/LanguageContext';
import { ChecklistItem, DrillSession, LearnItem, Tutorial, User } from '../types';
import { fetchChecklist, fetchDrills, fetchUser, fetchTutorials, fetchTutorialProgress, completeTutorial, submitChecklist, deleteChecklist, submitDrill, deleteDrill, submitTutorial, deleteTutorial, fetchLearnItems, submitLearnItem, deleteLearnItem } from '../services/api';

const CHECKLIST_KEY_MAP: Record<number, string> = {
    1: 'checklistBuildKit', 2: 'checklistSaveNumbers', 3: 'checklistStoreWater', 4: 'checklistStockFood',
    5: 'checklistRadio', 6: 'checklistFlashlight', 7: 'checklistWrench', 8: 'checklistMedications',
    9: 'checklistCash', 10: 'checklistSecureFurniture', 11: 'checklistDropCoverHold',
    12: 'checklistTsunamiRoute', 13: 'checklistGoBag', 14: 'checklistFireExtinguisher',
    15: 'checklistMeetingPoint',
};
const LEARN_KEY_MAP: Record<number, { title: string; desc: string }> = {
    1: { title: 'communityEmergencyGuide', desc: 'localProcedures' },
};
const DRILL_KEY_MAP: Record<number, string> = {
    1: 'drillAnnualFire', 2: 'drillEarthquake', 3: 'drillActiveShooter',
};
const DRILL_TYPE_KEYS: Record<string, string> = {
    Fire: 'fire', Evacuation: 'evacuation', Lockdown: 'lockdown',
};
const TUTORIAL_KEY_MAP: Record<number, { title: string; desc: string }> = {
    1: { title: 'tutorialEarthquake', desc: 'tutorialEarthquakeDesc' },
    2: { title: 'tutorialFirstAid', desc: 'tutorialFirstAidDesc' },
    3: { title: 'tutorialTrauma', desc: 'tutorialTraumaDesc' },
    4: { title: 'tutorialCpr', desc: 'tutorialCprDesc' },
    5: { title: 'tutorialEvac', desc: 'tutorialEvacDesc' },
};

/** Parse YouTube watch or playlist URL into embed URL for in-app playback */
const getYouTubeEmbedUrl = (url: string): string | null => {
    try {
        const playlistMatch = url.match(/youtube\.com\/playlist\?list=([^&]+)/);
        if (playlistMatch) {
            return `https://www.youtube.com/embed/videoseries?list=${playlistMatch[1]}`;
        }
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)(?:&t=(\d+)s?)?/);
        if (!match) return null;
        const [, videoId, t] = match;
        const start = t ? parseInt(t, 10) : 0;
        return `https://www.youtube.com/embed/${videoId}${start ? `?start=${start}` : ''}`;
    } catch {
        return null;
    }
};

interface PrepareProps {
    onNavigate?: (tab: string) => void;
}

const Prepare: React.FC<PrepareProps> = ({ onNavigate }) => {
    const { t } = useLanguage();
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [drills, setDrills] = useState<DrillSession[]>([]);
    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
    const [completedTutorialIds, setCompletedTutorialIds] = useState<number[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState<'learn' | 'checklist' | 'drills' | 'tutorials'>('learn');
    const [drillsSubTab, setDrillsSubTab] = useState<'upcoming' | 'logs'>('upcoming');
    const [displayedXp, setDisplayedXp] = useState(0);

    // Admin Forms State
    const [showChecklistForm, setShowChecklistForm] = useState(false);
    const [editingChecklist, setEditingChecklist] = useState<ChecklistItem | null>(null);
    const [checklistTitle, setChecklistTitle] = useState('');
    const [checklistXp, setChecklistXp] = useState(10);

    const [showDrillForm, setShowDrillForm] = useState(false);
    const [editingDrill, setEditingDrill] = useState<DrillSession | null>(null);
    const [drillTitle, setDrillTitle] = useState('');
    const [drillDate, setDrillDate] = useState('');
    const [drillType, setDrillType] = useState<'Fire' | 'Evacuation' | 'Lockdown'>('Fire');
    const [drillStatus, setDrillStatus] = useState<'Upcoming' | 'Completed'>('Upcoming');
    const [drillNotes, setDrillNotes] = useState('');

    const [showTutorialForm, setShowTutorialForm] = useState(false);
    const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
    const [tutorialTitle, setTutorialTitle] = useState('');
    const [tutorialDescription, setTutorialDescription] = useState('');
    const [tutorialUrl, setTutorialUrl] = useState('');
    const [tutorialSource, setTutorialSource] = useState<'YouTube' | 'External'>('YouTube');
    const [tutorialXp, setTutorialXp] = useState(25);

    const [videoModalTutorial, setVideoModalTutorial] = useState<Tutorial | null>(null);

    const [learnItems, setLearnItems] = useState<LearnItem[]>([]);
    const [showLearnForm, setShowLearnForm] = useState(false);
    const [editingLearn, setEditingLearn] = useState<LearnItem | null>(null);
    const [learnTitle, setLearnTitle] = useState('');
    const [learnDescription, setLearnDescription] = useState('');
    const [learnUrl, setLearnUrl] = useState('');
    const [learnType, setLearnType] = useState<'guide' | 'video' | 'resource'>('guide');

    const isAdmin = user?.role === 'Admin';
    const BASE_XP = 400; // Base XP for registration and profile setup

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const c = await fetchChecklist();
        const d = await fetchDrills();
        const tut = await fetchTutorials();
        const completed = await fetchTutorialProgress();
        const u = await fetchUser();
        const learn = await fetchLearnItems();
        
        setChecklist(c);
        setDrills(d);
        setTutorials(tut);
        setLearnItems(learn);
        setCompletedTutorialIds(completed);
        setUser(u);
        
        // Dynamic Calculation: Base XP + Checklist + Tutorial completions
        const checklistScore = c.reduce((acc, item) => item.completed ? acc + item.xp : acc, 0);
        const tutorialScore = tut.filter(t => completed.includes(t.id)).reduce((acc, t) => acc + t.xpReward, 0);
        setDisplayedXp(BASE_XP + checklistScore + tutorialScore);
    };

    // Checklist Handlers
    const toggleItem = async (id: number) => {
        const item = checklist.find(i => i.id === id);
        if (!item) return;

        const isCompleting = !item.completed;
        const xpChange = isCompleting ? item.xp : -item.xp;

        // Optimistic update
        setDisplayedXp(prev => prev + xpChange);
        setChecklist(prev => prev.map(i => 
            i.id === id ? { ...i, completed: isCompleting } : i
        ));

        await submitChecklist({ id: item.id, completed: isCompleting });
    };

    const handleSaveChecklist = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitChecklist({ id: editingChecklist?.id, title: checklistTitle, xp: checklistXp });
        setShowChecklistForm(false);
        loadData();
    };

    const handleDeleteChecklist = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(t('deleteChecklistConfirm'))) {
            await deleteChecklist(id);
            loadData();
        }
    };

    const openChecklistForm = (item?: ChecklistItem) => {
        if (item) {
            setEditingChecklist(item);
            setChecklistTitle(item.title);
            setChecklistXp(item.xp);
        } else {
            setEditingChecklist(null);
            setChecklistTitle('');
            setChecklistXp(10);
        }
        setShowChecklistForm(true);
    };

    // Drill Handlers
    const handleSaveDrill = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitDrill({ 
            id: editingDrill?.id, 
            title: drillTitle, 
            date: drillDate, 
            type: drillType, 
            status: drillStatus,
            notes: drillNotes
        });
        setShowDrillForm(false);
        loadData();
    };

    const handleDeleteDrill = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(t('deleteDrillConfirm'))) {
            await deleteDrill(id);
            loadData();
        }
    };

    const openDrillForm = (item?: DrillSession) => {
        if (item) {
            setEditingDrill(item);
            setDrillTitle(item.title);
            setDrillDate(item.date);
            setDrillType(item.type);
            setDrillStatus(item.status);
            setDrillNotes(item.notes || '');
        } else {
            setEditingDrill(null);
            setDrillTitle('');
            setDrillDate('');
            setDrillType('Fire');
            setDrillStatus('Upcoming');
            setDrillNotes('');
        }
        setShowDrillForm(true);
    };

    const openTutorialForm = (tutorial?: Tutorial) => {
        if (tutorial) {
            setEditingTutorial(tutorial);
            setTutorialTitle(tutorial.title);
            setTutorialDescription(tutorial.description);
            setTutorialUrl(tutorial.url);
            setTutorialSource(tutorial.source);
            setTutorialXp(tutorial.xpReward);
        } else {
            setEditingTutorial(null);
            setTutorialTitle('');
            setTutorialDescription('');
            setTutorialUrl('');
            setTutorialSource('YouTube');
            setTutorialXp(25);
        }
        setShowTutorialForm(true);
    };

    const handleSaveTutorial = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitTutorial({
            id: editingTutorial?.id,
            title: tutorialTitle,
            description: tutorialDescription,
            url: tutorialUrl,
            source: tutorialSource,
            xpReward: tutorialXp,
        });
        setShowTutorialForm(false);
        loadData();
    };

    const handleDeleteTutorial = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(t('deleteTutorialConfirm'))) {
            await deleteTutorial(id);
            loadData();
        }
    };

    const openLearnForm = (item?: LearnItem) => {
        if (item) {
            setEditingLearn(item);
            setLearnTitle(item.title);
            setLearnDescription(item.description);
            setLearnUrl(item.url);
            setLearnType(item.type);
        } else {
            setEditingLearn(null);
            setLearnTitle('');
            setLearnDescription('');
            setLearnUrl('');
            setLearnType('guide');
        }
        setShowLearnForm(true);
    };

    const handleSaveLearn = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitLearnItem({
            id: editingLearn?.id,
            title: learnTitle,
            description: learnDescription,
            url: learnUrl,
            type: learnType,
        });
        setShowLearnForm(false);
        loadData();
    };

    const handleDeleteLearn = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(t('deleteLearnItemConfirm'))) {
            await deleteLearnItem(id);
            loadData();
        }
    };

    // Tutorial Handlers
    const handleMarkTutorialComplete = async (tutorial: Tutorial) => {
        if (completedTutorialIds.includes(tutorial.id)) return;
        await completeTutorial(tutorial.id);
        setCompletedTutorialIds(prev => [...prev, tutorial.id]);
        setDisplayedXp(prev => prev + tutorial.xpReward);
    };

    const completedCount = checklist.filter(c => c.completed).length;
    const progress = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;

    return (
        <div className="flex flex-col pb-24 p-4 sm:p-5 md:p-6 relative min-h-screen">
            <Onboarding onGoToLearn={() => onNavigate?.('learn')} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{t('preparedness')}</h1>
                    {isAdmin && <span className="text-xs bg-black text-white px-2 py-0.5 rounded">{t('adminMode')}</span>}
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <button 
                            onClick={() => activeTab === 'learn' ? openLearnForm() : activeTab === 'checklist' ? openChecklistForm() : activeTab === 'drills' ? openDrillForm() : openTutorialForm()}
                            className="bg-black text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                        >
                            <Icons.Plus size={20} />
                        </button>
                    )}
                    <button className="bg-gray-100 text-black w-10 h-10 rounded-full flex items-center justify-center">
                        <Icons.Share size={20} />
                    </button>
                </div>
            </div>

            {/* Gamification Card */}
            <div className="bg-white rounded-3xl border border-gray-100 p-8 flex flex-col items-center justify-center shadow-sm mb-8 transition-all duration-300">
                <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-500 mb-4 ring-4 ring-yellow-50/50">
                    <Icons.Trophy size={32} />
                </div>
                <div className="text-3xl font-black mb-1 animate-in fade-in zoom-in duration-300">
                    {displayedXp} <span className="text-sm font-medium text-gray-400">XP</span>
                </div>
                <div className="font-semibold text-gray-600 mb-6">
                    {displayedXp < 420 ? 'Beginner' : displayedXp < 500 ? 'Aware Citizen' : 'Safety Expert'}
                </div>
                
                <div className="w-full flex justify-between text-xs font-medium text-gray-500 mb-2">
                    <span>{t('checklistProgress')}</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-black rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            {/* Tabs: Learn, Checklist, Drills & Logs, Tutorials - 2x2 grid for full label visibility */}
            <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1.5 rounded-xl mb-6">
                {[
                    { id: 'learn' as const, label: t('learn'), icon: Icons.BookOpen },
                    { id: 'checklist' as const, label: t('checklist'), icon: Icons.CheckCircle },
                    { id: 'drills' as const, label: t('drillsAndLogs'), icon: Icons.Calendar },
                    { id: 'tutorials' as const, label: t('tutorials'), icon: Icons.Play },
                ].map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-sm font-bold transition-all duration-200 min-w-0 ${
                            activeTab === id
                                ? 'bg-white shadow-sm text-gray-900'
                                : 'text-gray-500 hover:bg-gray-200/80 hover:text-gray-700 active:bg-gray-200'
                        }`}
                    >
                        {Icon && <Icon size={16} className="shrink-0 flex-shrink-0" />}
                        <span className="truncate">{label}</span>
                    </button>
                ))}
            </div>

            {/* Learn View - Learn items, how-to guides, tutorials & resources */}
            {activeTab === 'learn' && (
                <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300 pb-6">
                    {/* Learn Items (admin-created) */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Icons.BookOpen size={18} className="text-blue-600 shrink-0" />
                            {t('learnItems')}
                        </h3>
                        <div className="space-y-3">
                            {learnItems.map(item => (
                                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-blue-200 transition-colors group relative">
                                    <div className="flex gap-3 items-start">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            item.type === 'video' ? 'bg-amber-50 group-hover:bg-amber-100' :
                                            item.type === 'resource' ? 'bg-emerald-50 group-hover:bg-emerald-100' : 'bg-blue-50 group-hover:bg-blue-100'
                                        }`}>
                                            {item.type === 'video' ? <Icons.Play size={20} className="text-amber-600" /> :
                                             item.type === 'resource' ? <Icons.Shield size={20} className="text-emerald-600" /> :
                                             <Icons.BookOpen size={20} className="text-blue-600" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-900">{LEARN_KEY_MAP[item.id] ? t(LEARN_KEY_MAP[item.id].title) : item.title}</h4>
                                            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{LEARN_KEY_MAP[item.id] ? t(LEARN_KEY_MAP[item.id].desc) : item.description}</p>
                                            {item.url && (
                                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">
                                                    {t('readMore')} <Icons.ChevronRight size={14} className="shrink-0" />
                                                </a>
                                            )}
                                        </div>
                                        {isAdmin && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={(e) => { e.stopPropagation(); openLearnForm(item); }} className="p-2 text-gray-400 hover:text-blue-600" aria-label={t('edit')}><Icons.Edit size={16} /></button>
                                                <button onClick={(e) => handleDeleteLearn(item.id, e)} className="p-2 text-gray-400 hover:text-red-600" aria-label={t('delete')}><Icons.Trash size={16} /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {learnItems.length === 0 && <div className="text-gray-400 text-sm py-4 text-center italic">{t('noLearnItems')}</div>}
                        </div>
                    </section>

                    {/* How-to guides */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Icons.BookOpen size={18} className="text-blue-600 shrink-0" />
                            {t('howToGuides')}
                        </h3>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                            {[
                                { icon: Icons.Emergency, titleKey: 'learnReportIncident', descKey: 'learnReportIncidentDesc', tab: 'emergency' as const },
                                { icon: Icons.CheckCircle, titleKey: 'learnChecklist', descKey: 'learnChecklistDesc', tab: 'prepare' as const },
                                { icon: Icons.Map, titleKey: 'learnLiveMap', descKey: 'learnLiveMapDesc', tab: 'maps' as const },
                                { icon: Icons.Chat, titleKey: 'learnChat', descKey: 'learnChatDesc', tab: 'chat' as const },
                            ].map((item, i) => {
                                const Icon = item.icon ?? Icons.BookOpen;
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => onNavigate?.(item.tab)}
                                        className="w-full p-4 text-left hover:bg-gray-50 transition-colors active:scale-[0.99] group"
                                    >
                                        <div className="flex gap-3 items-start">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                                <Icon size={20} className="text-blue-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-gray-900">{t(item.titleKey)}</h4>
                                                <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{t(item.descKey)}</p>
                                                <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                                                    {t('readMore')} <Icons.ChevronRight size={14} className="shrink-0" />
                                                </span>
                                            </div>
                                            <Icons.ChevronRight size={16} className="text-gray-400 shrink-0 mt-1" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Tutorial videos & resources */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Icons.Video size={18} className="text-amber-600 shrink-0" />
                            {t('tutorialVideos')}
                        </h3>
                        <div className="space-y-3">
                            {[
                                { titleKey: 'tutorialEmergencyBasics', descKey: 'tutorialEmergencyBasicsDesc', url: 'https://www.redcross.org/get-help/how-to-prepare-for-emergencies.html', source: 'Red Cross' },
                                { titleKey: 'tutorialFirstAid', descKey: 'tutorialFirstAidDesc', url: 'https://www.redcross.org/take-a-class/first-aid', source: 'Red Cross' },
                                { titleKey: 'tutorialDisasterPrep', descKey: 'tutorialDisasterPrepDesc', url: 'https://www.ready.gov', source: 'FEMA / Ready.gov' },
                                { titleKey: 'tutorialEarthquake', descKey: 'tutorialEarthquakeDesc', url: 'https://www.earthquakecountry.org/sevensteps/', source: 'Earthquake Country Alliance' },
                            ].map((item, i) => (
                                <a
                                    key={i}
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:shadow transition-all group active:scale-[0.99]"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                                            <Icons.Play size={24} className="text-amber-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-900 group-hover:text-blue-700">{t(item.titleKey)}</h4>
                                            <p className="text-sm text-gray-600 mt-0.5">{t(item.descKey)}</p>
                                            <span className="inline-block mt-2 text-xs font-medium text-blue-600">{item.source} →</span>
                                        </div>
                                        <Icons.ChevronRight size={16} className="text-gray-400 shrink-0 mt-1" />
                                    </div>
                                </a>
                            ))}
                        </div>
                    </section>

                    {/* External resources */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Icons.Globe size={18} className="text-emerald-600 shrink-0" />
                            {t('externalResources')}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { name: 'Red Cross', url: 'https://www.redcross.org', descKey: 'resourceRedCross' },
                                { name: 'FEMA', url: 'https://www.fema.gov', descKey: 'resourceFEMA' },
                                { name: 'WHO Emergency', url: 'https://www.who.int/emergencies', descKey: 'resourceWHO' },
                                { name: 'CDC Emergency', url: 'https://emergency.cdc.gov', descKey: 'resourceCDC' },
                            ].map((res, i) => (
                                <a
                                    key={i}
                                    href={res.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-emerald-300 hover:shadow transition-all flex items-center gap-3 active:scale-[0.99] min-h-[72px]"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                        <Icons.Shield size={20} className="text-emerald-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="font-semibold text-gray-900 block">{res.name}</span>
                                        <span className="text-xs text-gray-500">{t(res.descKey)}</span>
                                    </div>
                                    <Icons.ChevronRight size={14} className="text-gray-400 shrink-0 ml-auto" />
                                </a>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {/* Checklist View */}
            {activeTab === 'checklist' && (
                <div className="space-y-3 animate-in slide-in-from-left-4 fade-in duration-300">
                    {checklist.map(item => (
                        <div 
                            key={item.id} 
                            onClick={() => toggleItem(item.id)}
                            className={`p-4 rounded-xl border-2 flex items-center gap-4 cursor-pointer transition-all relative group ${
                                item.completed 
                                ? 'bg-gray-50 border-gray-200 opacity-60' 
                                : 'bg-white border-black hover:bg-gray-50'
                            }`}
                        >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                item.completed ? 'border-green-500 bg-green-500 text-white' : 'border-black'
                            }`}>
                                {item.completed && <Icons.Check size={14} />}
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-bold text-sm ${item.completed ? 'line-through transition-all' : ''}`}>
                                    {CHECKLIST_KEY_MAP[item.id] ? t(CHECKLIST_KEY_MAP[item.id]) : item.title}
                                </h3>
                                <span className="text-xs text-gray-500">+{item.xp} XP</span>
                            </div>
                            {isAdmin && (
                                <div className="flex items-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); openChecklistForm(item); }} className="p-2 text-gray-400 hover:text-blue-600"><Icons.Edit size={16} /></button>
                                    <button onClick={(e) => handleDeleteChecklist(item.id, e)} className="p-2 text-gray-400 hover:text-red-600"><Icons.Trash size={16} /></button>
                                </div>
                            )}
                        </div>
                    ))}
                    {checklist.length === 0 && <div className="text-center text-gray-400 py-4">{t('noChecklistItems')}</div>}
                </div>
            )}

            {/* Drills View */}
            {activeTab === 'drills' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300 pb-6">
                    {/* Sub-tabs: Upcoming Drills | Past Logs */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setDrillsSubTab('upcoming')}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all duration-200 ${
                                drillsSubTab === 'upcoming'
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-gray-500 hover:bg-gray-200/80 hover:text-gray-700'
                            }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <Icons.Calendar size={16} />
                                {t('upcomingDrills')}
                            </span>
                        </button>
                        <button
                            onClick={() => setDrillsSubTab('logs')}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all duration-200 ${
                                drillsSubTab === 'logs'
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-gray-500 hover:bg-gray-200/80 hover:text-gray-700'
                            }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <Icons.Clipboard size={16} />
                                {t('pastLogs')}
                            </span>
                        </button>
                    </div>

                    {/* Upcoming Drills */}
                    {drillsSubTab === 'upcoming' && (
                        <div className="space-y-3">
                            {drills.filter(d => d.status === 'Upcoming').map(drill => (
                                <div key={drill.id} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold">{DRILL_KEY_MAP[drill.id] ? t(DRILL_KEY_MAP[drill.id]) : drill.title}</h4>
                                            <span className="text-xs text-gray-500">{drill.date} • {DRILL_TYPE_KEYS[drill.type] ? t(DRILL_TYPE_KEYS[drill.type]) : drill.type}</span>
                                        </div>
                                        {!isAdmin && <button className="px-4 py-2 bg-black text-white text-xs font-bold rounded-lg">{t('register')}</button>}
                                    </div>
                                    {isAdmin && (
                                        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-50">
                                            <button onClick={() => openDrillForm(drill)} className="text-xs font-bold text-blue-600">{t('edit')}</button>
                                            <button onClick={(e) => handleDeleteDrill(drill.id, e)} className="text-xs font-bold text-red-600">{t('delete')}</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {drills.filter(d => d.status === 'Upcoming').length === 0 && (
                                <div className="text-gray-400 text-sm py-6 text-center italic">{t('noUpcomingDrills')}</div>
                            )}
                        </div>
                    )}

                    {/* Past Logs */}
                    {drillsSubTab === 'logs' && (
                        <div className="space-y-3">
                            {drills.filter(d => d.status === 'Completed').map(drill => (
                                <div key={drill.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors">
                                    <div className="flex justify-between mb-2">
                                        <h4 className="font-bold text-gray-700">{DRILL_KEY_MAP[drill.id] ? t(DRILL_KEY_MAP[drill.id]) : drill.title}</h4>
                                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">{t('complete')}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">{drill.date}</p>
                                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                                        {drill.notes || t('noNotesRecorded')} <br/>
                                        {drill.participants && <span className="font-bold">{drill.participants} {t('participants')}</span>}
                                    </div>
                                    {isAdmin && (
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button onClick={() => openDrillForm(drill)} className="text-xs font-bold text-gray-500 hover:text-blue-600">{t('edit')}</button>
                                            <button onClick={(e) => handleDeleteDrill(drill.id, e)} className="text-xs font-bold text-gray-500 hover:text-red-500">{t('delete')}</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {drills.filter(d => d.status === 'Completed').length === 0 && (
                                <div className="text-gray-400 text-sm py-6 text-center italic">{t('noPastLogs')}</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Tutorials View */}
            {activeTab === 'tutorials' && (
                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                    <p className="text-sm text-gray-500 mb-4">{t('learnAndEarn')}</p>
                    {tutorials.map(tutorial => {
                        const meta = TUTORIAL_KEY_MAP[tutorial.id];
                        const title = meta ? t(meta.title) : tutorial.title;
                        const description = meta ? t(meta.desc) : tutorial.description;
                        const isCompleted = completedTutorialIds.includes(tutorial.id);
                        return (
                            <div 
                                key={tutorial.id} 
                                className={`p-4 rounded-xl border-2 flex flex-col gap-3 transition-all ${
                                    isCompleted 
                                        ? 'bg-gray-50 border-green-200' 
                                        : 'bg-white border-gray-200 hover:border-blue-200'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-bold text-gray-900 ${isCompleted ? 'line-through text-gray-600' : ''}`}>{title}</h4>
                                        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                                        <span className="inline-block mt-2 text-xs font-medium text-amber-600">+{tutorial.xpReward} XP</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                        {isAdmin && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); openTutorialForm(tutorial); }} className="p-2 text-gray-400 hover:text-blue-600" aria-label={t('edit')}><Icons.Edit size={16} /></button>
                                                <button onClick={(e) => handleDeleteTutorial(tutorial.id, e)} className="p-2 text-gray-400 hover:text-red-600" aria-label={t('delete')}><Icons.Trash size={16} /></button>
                                            </>
                                        )}
                                        {isCompleted && (
                                            <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
                                                <Icons.Check size={14} /> {t('completed')}
                                            </span>
                                        )}
                                        {tutorial.source === 'YouTube' && getYouTubeEmbedUrl(tutorial.url) ? (
                                            <button
                                                type="button"
                                                onClick={() => setVideoModalTutorial(tutorial)}
                                                aria-label={`${t('watchTutorial')}: ${title}`}
                                                className="px-3 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                                            >
                                                {t('watchTutorial')}
                                            </button>
                                        ) : (
                                            <a 
                                                href={tutorial.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                aria-label={`${t('watchTutorial')}: ${title}`}
                                                className="px-3 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                                            >
                                                {t('watchTutorial')}
                                            </a>
                                        )}
                                        {!isCompleted && (
                                            <button 
                                                onClick={() => handleMarkTutorialComplete(tutorial)}
                                                aria-label={`${t('markComplete')}: ${title}`}
                                                className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                                            >
                                                {t('markComplete')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {tutorial.source === 'YouTube' && (
                                    <span className="text-xs text-gray-400">{tutorial.source}</span>
                                )}
                            </div>
                        );
                    })}
                    {tutorials.length === 0 && <div className="text-center text-gray-400 py-4">{t('noTutorials')}</div>}
                </div>
            )}

            {/* Video Player Modal - watch tutorials directly in app */}
            {videoModalTutorial && (
                <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-2xl flex flex-col gap-3">
                        <div className="flex items-center justify-between text-white">
                            <h3 className="font-bold text-lg">{TUTORIAL_KEY_MAP[videoModalTutorial.id] ? t(TUTORIAL_KEY_MAP[videoModalTutorial.id].title) : videoModalTutorial.title}</h3>
                            <button
                                type="button"
                                onClick={() => setVideoModalTutorial(null)}
                                aria-label="Close video"
                                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                            >
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                            {getYouTubeEmbedUrl(videoModalTutorial.url) && (
                                <iframe
                                    title={videoModalTutorial.title}
                                    src={getYouTubeEmbedUrl(videoModalTutorial.url)!}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    className="absolute inset-0 w-full h-full"
                                />
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setVideoModalTutorial(null)}
                            className="w-full py-3 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Checklist Modal */}
            {showChecklistForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6">
                        <h3 className="font-bold text-lg mb-4">{editingChecklist ? t('editItem') : t('newChecklistItem')}</h3>
                        <form onSubmit={handleSaveChecklist} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('title')}</label>
                                <input className="w-full p-2 border rounded-lg" value={checklistTitle} onChange={e => setChecklistTitle(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('xpPointsLabel')}</label>
                                <input type="number" className="w-full p-2 border rounded-lg" value={checklistXp} onChange={e => setChecklistXp(Number(e.target.value))} required />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowChecklistForm(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-bold text-sm">{t('cancel')}</button>
                                <button type="submit" className="flex-1 py-2 bg-black text-white rounded-lg font-bold text-sm">{t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Drill Modal */}
            {showDrillForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6">
                        <h3 className="font-bold text-lg mb-4">{editingDrill ? t('editDrill') : t('newDrillSession')}</h3>
                        <form onSubmit={handleSaveDrill} className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('title')}</label>
                                <input className="w-full p-2 border rounded-lg" value={drillTitle} onChange={e => setDrillTitle(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('dateLabel')}</label>
                                <input type="date" className="w-full p-2 border rounded-lg" value={drillDate} onChange={e => setDrillDate(e.target.value)} required />
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('alertType')}</label>
                                    <select className="w-full p-2.5 border rounded-lg bg-white" value={drillType} onChange={e => setDrillType(e.target.value as any)}>
                                        <option>Fire</option>
                                        <option>Evacuation</option>
                                        <option>Lockdown</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('status')}</label>
                                    <select className="w-full p-2 border rounded-lg bg-white" value={drillStatus} onChange={e => setDrillStatus(e.target.value as any)}>
                                        <option>Upcoming</option>
                                        <option>Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes / Outcomes</label>
                                <textarea className="w-full p-2 border rounded-lg text-sm" value={drillNotes} onChange={e => setDrillNotes(e.target.value)} placeholder="Results, participant count..." />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowDrillForm(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-bold text-sm">{t('cancel')}</button>
                                <button type="submit" className="flex-1 py-2 bg-black text-white rounded-lg font-bold text-sm">{t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Tutorial Modal */}
            {showTutorialForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4">{editingTutorial ? t('editTutorial') : t('newTutorialItem')}</h3>
                        <form onSubmit={handleSaveTutorial} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('title')}</label>
                                <input className="w-full p-2 border rounded-lg" value={tutorialTitle} onChange={e => setTutorialTitle(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('description')}</label>
                                <textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={tutorialDescription} onChange={e => setTutorialDescription(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL</label>
                                <input type="url" className="w-full p-2 border rounded-lg" value={tutorialUrl} onChange={e => setTutorialUrl(e.target.value)} placeholder="https://..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Source</label>
                                <select className="w-full p-2 border rounded-lg bg-white" value={tutorialSource} onChange={e => setTutorialSource(e.target.value as 'YouTube' | 'External')}>
                                    <option value="YouTube">YouTube</option>
                                    <option value="External">External</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('xpPointsLabel')}</label>
                                <input type="number" className="w-full p-2 border rounded-lg" value={tutorialXp} onChange={e => setTutorialXp(Number(e.target.value))} min={1} max={100} />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowTutorialForm(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-bold text-sm">{t('cancel')}</button>
                                <button type="submit" className="flex-1 py-2 bg-black text-white rounded-lg font-bold text-sm">{t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Learn Item Modal */}
            {showLearnForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6">
                        <h3 className="font-bold text-lg mb-4">{editingLearn ? t('editLearnItem') : t('newLearnItem')}</h3>
                        <form onSubmit={handleSaveLearn} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('title')}</label>
                                <input className="w-full p-2 border rounded-lg" value={learnTitle} onChange={e => setLearnTitle(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('description')}</label>
                                <textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={learnDescription} onChange={e => setLearnDescription(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL</label>
                                <input type="url" className="w-full p-2 border rounded-lg" value={learnUrl} onChange={e => setLearnUrl(e.target.value)} placeholder="https://..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('learnItemType')}</label>
                                <select className="w-full p-2 border rounded-lg bg-white" value={learnType} onChange={e => setLearnType(e.target.value as 'guide' | 'video' | 'resource')}>
                                    <option value="guide">Guide</option>
                                    <option value="video">Video</option>
                                    <option value="resource">Resource</option>
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowLearnForm(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-bold text-sm">{t('cancel')}</button>
                                <button type="submit" className="flex-1 py-2 bg-black text-white rounded-lg font-bold text-sm">{t('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Prepare;
