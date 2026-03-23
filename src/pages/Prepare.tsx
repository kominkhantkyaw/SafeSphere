import React, { useEffect, useState, useRef } from 'react';
import { Icons } from '../components/Icon';
import Onboarding from '../components/Onboarding';
import { CelebrationOverlay } from '../components/CelebrationOverlay';
import { DrillsCalendar } from '../components/DrillsCalendar';
import { DrillSocialSection } from '../components/DrillSocialSection';
import { RegisterDrillModal } from '../components/RegisterDrillModal';
import { SuccessToast } from '../components/SuccessToast';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { ChecklistItem, DrillSession, LearnItem, Tutorial } from '../types';
import { fetchChecklist, fetchDrills, fetchTutorials, fetchTutorialProgress, completeTutorial, uncompleteTutorial, submitChecklist, deleteChecklist, submitDrill, deleteDrill, submitTutorial, deleteTutorial, fetchLearnItems, submitLearnItem, deleteLearnItem, getUserDrillRegistrations, getUserDrillRegistrationsWithSlots, registerForDrill, unregisterFromDrill, notifyDrillRegistration, notifyCancelRegistration, type DrillRegistration } from '../services/api';
import { canManagePrepareContent, canManageSessionsAndCourses, isAdminOnly } from '../utils/permissions';

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
    4: 'drillFirstAidCert', 5: 'drillEmergencyKitDeadline',
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
    6: { title: 'tutorialChoking', desc: 'tutorialChokingDesc' },
};

/** Parse YouTube watch or playlist URL into embed URL for in-app playback */
const getYouTubeEmbedUrl = (url: string): string | null => {
    try {
        const playlistMatch = url.match(/youtube\.com\/playlist\?list=([^&]+)/);
        if (playlistMatch) {
            return `https://www.youtube.com/embed/videoseries?list=${playlistMatch[1]}`;
        }
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
        if (!match) return null;
        const videoId = match[1];
        const tMatch = url.match(/[&?](?:t|start)=(\d+)/);
        const start = tMatch ? parseInt(tMatch[1], 10) : 0;
        const params = new URLSearchParams();
        if (start > 0) params.set('start', String(start));
        params.set('rel', '0');
        const q = params.toString();
        return `https://www.youtube.com/embed/${videoId}${q ? `?${q}` : ''}`;
    } catch {
        return null;
    }
};

interface PrepareProps {
    onNavigate?: (tab: string) => void;
    initialDrillId?: number | null;
    onDrillOpened?: () => void;
}

const Prepare: React.FC<PrepareProps> = ({ onNavigate, initialDrillId, onDrillOpened }) => {
    const { t } = useLanguage();
    const { user } = useUser();
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [drills, setDrills] = useState<DrillSession[]>([]);
    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
    const [completedTutorialIds, setCompletedTutorialIds] = useState<number[]>([]);
    const [activeTab, setActiveTab] = useState<'learn' | 'checklist' | 'drills' | 'tutorials'>('learn');
    const [drillsSubTab, setDrillsSubTab] = useState<'total' | 'my' | 'booked' | 'completed'>('total');
    const [displayedXp, setDisplayedXp] = useState(0);

    // Admin Forms State
    const [showChecklistForm, setShowChecklistForm] = useState(false);
    const [editingChecklist, setEditingChecklist] = useState<ChecklistItem | null>(null);
    const [checklistTitle, setChecklistTitle] = useState('');
    const [checklistDescription, setChecklistDescription] = useState('');
    const [checklistXp, setChecklistXp] = useState(10);

    const [showDrillForm, setShowDrillForm] = useState(false);
    const [editingDrill, setEditingDrill] = useState<DrillSession | null>(null);
    const [drillTitle, setDrillTitle] = useState('');
    const [drillDate, setDrillDate] = useState('');
    const [drillTime, setDrillTime] = useState('');
    type DrillEventTypeChoice = 'course' | 'appointment' | 'session' | 'deadline';
    const [drillEventTypeChoice, setDrillEventTypeChoice] = useState<DrillEventTypeChoice>('course');
    const [drillEventTypeOverride, setDrillEventTypeOverride] = useState('');

    type DrillTypeChoice = 'Fire' | 'Evacuation' | 'Lockdown';
    const [drillTypeChoice, setDrillTypeChoice] = useState<DrillTypeChoice>('Fire');
    const [drillTypeOverride, setDrillTypeOverride] = useState('');

    type DrillStatusChoice = 'Upcoming' | 'Progress' | 'Completed' | 'Cancel';
    const [drillStatusChoice, setDrillStatusChoice] = useState<DrillStatusChoice>('Upcoming');
    const [drillStatusOverride, setDrillStatusOverride] = useState('');
    const [drillNotes, setDrillNotes] = useState('');
    const [drillCalendarMonth, setDrillCalendarMonth] = useState(() => new Date());
    const [registeredDrillIds, setRegisteredDrillIds] = useState<number[]>([]);
    const [registeredSlots, setRegisteredSlots] = useState<DrillRegistration[]>([]);
    const [selectedDrill, setSelectedDrill] = useState<DrillSession | null>(null);
    const [drillToRegister, setDrillToRegister] = useState<DrillSession | null>(null);
    const [registerInitialSlot, setRegisterInitialSlot] = useState<{ date: string; time: string } | undefined>(undefined);
    const [drillToCancel, setDrillToCancel] = useState<{ drill: DrillSession; fromDetailModal: boolean } | null>(null);
    const [successToast, setSuccessToast] = useState<string | null>(null);
    const calendarRef = useRef<HTMLDivElement>(null);
    const upcomingSessionsRef = useRef<HTMLDivElement>(null);

    const [showTutorialForm, setShowTutorialForm] = useState(false);
    const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
    const [tutorialTitle, setTutorialTitle] = useState('');
    const [tutorialDescription, setTutorialDescription] = useState('');
    const [tutorialUrl, setTutorialUrl] = useState('');
    const [tutorialSource, setTutorialSource] = useState<'YouTube' | 'External'>('YouTube');
    const [tutorialXp, setTutorialXp] = useState(25);

    const [videoModalTutorial, setVideoModalTutorial] = useState<Tutorial | null>(null);
    const [celebrationXp, setCelebrationXp] = useState<number | null>(null);

    const [learnItems, setLearnItems] = useState<LearnItem[]>([]);
    const [learnItemsSubTab, setLearnItemsSubTab] = useState<'resourceHub' | 'communityGuide'>('communityGuide');
    const [showLearnForm, setShowLearnForm] = useState(false);
    const [editingLearn, setEditingLearn] = useState<LearnItem | null>(null);
    const [learnTitle, setLearnTitle] = useState('');
    const [learnDescription, setLearnDescription] = useState('');
    const [learnUrl, setLearnUrl] = useState('');
    const [learnType, setLearnType] = useState<'guide' | 'video' | 'resource'>('guide');

    /** Admin: full content management. Responder: sessions/courses only. Reporter: view and complete only. */
    const canManageContent = canManagePrepareContent(user);
    const canManageDrills = canManageSessionsAndCourses(user);
    const BASE_XP = 400; // Base XP for registration and profile setup

    const isActiveDrillStatus = (status: string) => {
        const normalized = (status || '').toLowerCase();
        const isCompleted = normalized.startsWith('completed');
        const isCancelled = normalized === 'cancelled' || normalized === 'cancel' || normalized.includes('cancel');
        return !isCompleted && !isCancelled;
    };

    const isCompletedStatus = (status: string) => (status || '').toLowerCase().startsWith('completed');

    const isVisibleInTotalTab = (status: string) => {
        const normalized = (status || '').toLowerCase();
        if (canManageDrills) {
            // Responder/Admin view: show everything except completed so they can still review cancelled/custom statuses.
            return !normalized.startsWith('completed');
        }
        // Reporter view: show only "active" drills (exclude cancelled/completed).
        return isActiveDrillStatus(status);
    };

    useEffect(() => {
        loadData();
        const handleQueueSynced = () => { void loadData(); };
        window.addEventListener('safesphere-offline-queue-synced', handleQueueSynced);
        return () => {
            window.removeEventListener('safesphere-offline-queue-synced', handleQueueSynced);
        };
    }, []);

    // Open drill modal when arriving via shared link (?tab=prepare&drill=123)
    useEffect(() => {
        if (!initialDrillId || drills.length === 0) return;
        const drill = drills.find(d => d.id === initialDrillId);
        if (drill) {
            setActiveTab('drills');
            setSelectedDrill(drill);
            onDrillOpened?.();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when initialDrillId or drills change
    }, [initialDrillId, drills]);

    const loadData = async () => {
        const c = await fetchChecklist();
        const d = await fetchDrills();
        const tut = await fetchTutorials();
        const completed = await fetchTutorialProgress();
        const learn = await fetchLearnItems();
        const regIds = await getUserDrillRegistrations();
        const regSlots = await getUserDrillRegistrationsWithSlots();
        
        setChecklist(c);
        setDrills(d);
        setTutorials(tut);
        setLearnItems(learn);
        setCompletedTutorialIds(completed);
        setRegisteredDrillIds(regIds);
        setRegisteredSlots(regSlots);
        
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

        // Gamified celebration when completing (not when unchecking)
        if (isCompleting) {
            setCelebrationXp(item.xp);
        }
    };

    const handleSaveChecklist = async (e: React.FormEvent) => {
        e.preventDefault();
        const updated = await submitChecklist({ id: editingChecklist?.id, title: checklistTitle, description: checklistDescription || undefined, xp: checklistXp });
        setChecklist(updated);
        setShowChecklistForm(false);
        loadData(); // refresh tutorials, drills, etc. (checklist already set above)
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
            setChecklistDescription(item.description || '');
            setChecklistXp(item.xp);
        } else {
            setEditingChecklist(null);
            setChecklistTitle('');
            setChecklistDescription('');
            setChecklistXp(10);
        }
        setShowChecklistForm(true);
    };

    // Drill Handlers
    const handleSaveDrill = async (e: React.FormEvent) => {
        e.preventDefault();
        const effectiveEventType = drillEventTypeOverride.trim() || drillEventTypeChoice;
        const effectiveType = drillTypeOverride.trim() || drillTypeChoice;
        const statusOverride = drillStatusOverride.trim();
        // Preserve the selected STATUS meaning even if the responder adds a custom label.
        // Example: "Cancel - Not happening due to maintenance".
        const effectiveStatus = statusOverride ? `${drillStatusChoice} - ${statusOverride}` : drillStatusChoice;
        const updated = await submitDrill({ 
            id: editingDrill?.id, 
            title: drillTitle, 
            date: drillDate, 
            time: drillTime || undefined,
            eventType: effectiveEventType,
            type: effectiveType, 
            status: effectiveStatus,
            notes: drillNotes
        });
        setDrills(updated);
        setShowDrillForm(false);
        loadData(); // refresh checklist, tutorials, registrations, etc. (drills already set above)
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
            setDrillTime(item.time || '');
            const et = (item.eventType || 'course');
            const etNormalized = String(et).trim().toLowerCase();
            if (etNormalized === 'course' || etNormalized === 'session' || etNormalized === 'appointment' || etNormalized === 'deadline') {
                setDrillEventTypeChoice(etNormalized as any);
                setDrillEventTypeOverride('');
            } else {
                // Unknown eventType: keep dropdown default; store the preferred label in the textbox.
                setDrillEventTypeChoice('course');
                setDrillEventTypeOverride(String(et));
            }

            const itemType = String(item.type);
            if (itemType === 'Fire' || itemType === 'Evacuation' || itemType === 'Lockdown') {
                setDrillTypeChoice(itemType as any);
                setDrillTypeOverride('');
            } else {
                setDrillTypeChoice('Fire');
                setDrillTypeOverride(itemType);
            }

            const st = String(item.status || '');
            const stNormalized = st.trim();
            const [baseStatus, ...rest] = stNormalized.split(' - ');
            const baseLower = baseStatus.trim().toLowerCase();
            const customPart = rest.length ? rest.join(' - ') : '';

            if (baseLower === 'upcoming') {
                setDrillStatusChoice('Upcoming');
                setDrillStatusOverride(customPart);
            } else if (baseLower === 'progress' || baseLower === 'happening') {
                setDrillStatusChoice('Progress');
                setDrillStatusOverride(customPart);
            } else if (baseLower === 'completed') {
                setDrillStatusChoice('Completed');
                setDrillStatusOverride(customPart);
            } else if (baseLower === 'cancelled' || baseLower === 'cancel') {
                setDrillStatusChoice('Cancel');
                setDrillStatusOverride(customPart);
            } else {
                // Unknown status: treat it as a label override (textbox).
                setDrillStatusChoice('Upcoming');
                setDrillStatusOverride(stNormalized);
            }
            setDrillNotes(item.notes || '');
        } else {
            setEditingDrill(null);
            setDrillTitle('');
            setDrillDate('');
            setDrillTime('');
            setDrillEventTypeChoice('course');
            setDrillEventTypeOverride('');
            setDrillTypeChoice('Fire');
            setDrillTypeOverride('');
            setDrillStatusChoice('Upcoming');
            setDrillStatusOverride('');
            setDrillNotes('');
        }
        setShowDrillForm(true);
    };

    const handleRegisterDrill = async (drill: DrillSession, slot?: { date: string; time: string }) => {
        const effectiveSlot = slot || { date: drill.date, time: drill.time || '09:00' };
        await registerForDrill(drill.id, effectiveSlot);
        setRegisteredDrillIds(prev => [...prev, drill.id]);
        setRegisteredSlots(prev => [...prev, { drillId: drill.id, slotDate: effectiveSlot.date, slotTime: effectiveSlot.time }]);
        await notifyDrillRegistration(drill.title, effectiveSlot.date, effectiveSlot.time, t);
    };

    const openRegisterModal = (drill: DrillSession, slot?: { date: string; time: string }) => {
        setSelectedDrill(null);
        setDrillToRegister(drill);
        setRegisterInitialSlot(slot);
        setActiveTab('drills');
        setDrillsSubTab('total');
        setTimeout(() => calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    };

    const handleConfirmCancel = async () => {
        if (!drillToCancel) return;
        const { drill, fromDetailModal } = drillToCancel;
        await unregisterFromDrill(drill.id);
        setRegisteredDrillIds(prev => prev.filter(id => id !== drill.id));
        setRegisteredSlots(prev => prev.filter(r => r.drillId !== drill.id));
        await notifyCancelRegistration(drill.title, t);
        setSuccessToast((t('cancelSuccessMessage') || 'You have cancelled {title} successfully.').replace('{title}', drill.title));
        setDrillToCancel(null);
        if (fromDetailModal) setSelectedDrill(null);
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
        setCelebrationXp(tutorial.xpReward);
    };

    const handleUndoTutorial = async (tutorial: Tutorial) => {
        if (!completedTutorialIds.includes(tutorial.id)) return;
        await uncompleteTutorial(tutorial.id);
        setCompletedTutorialIds(prev => prev.filter(id => id !== tutorial.id));
        setDisplayedXp(prev => prev - tutorial.xpReward);
    };

    const completedCount = checklist.filter(c => c.completed).length;
    const progress = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;

    return (
        <div className="flex flex-col pb-24 p-4 sm:p-5 md:p-6 relative min-h-screen">
            <Onboarding onGoToLearn={() => onNavigate?.('learn')} />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{t('preparedness')}</h1>
                    {isAdminOnly(user) && <span className="text-xs bg-black text-white px-2 py-0.5 rounded">{t('adminMode')}</span>}
                </div>
                <div className="flex gap-2">
                    {((canManageContent && activeTab !== 'drills') || (canManageDrills && activeTab === 'drills')) && (
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
                        <div
                            className="flex items-stretch mb-4 p-1 rounded-xl bg-gray-100 border border-gray-200/80 gap-0"
                            role="group"
                            aria-label={`${t('learnItems')}: ${t('resourceHub')}, ${t('communityEmergencyGuide')}`}
                        >
                            <button
                                type="button"
                                onClick={() => setLearnItemsSubTab('resourceHub')}
                                className={`flex-1 min-w-0 py-2.5 px-2 sm:px-3 rounded-lg text-sm font-bold transition-all border-r border-gray-300/80 ${
                                    learnItemsSubTab === 'resourceHub'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {t('resourceHub')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setLearnItemsSubTab('communityGuide')}
                                className={`flex-1 min-w-0 py-2.5 px-2 sm:px-3 rounded-lg text-sm font-bold transition-all ${
                                    learnItemsSubTab === 'communityGuide'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {t('communityEmergencyGuide')}
                            </button>
                        </div>

                        {learnItemsSubTab === 'resourceHub' && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <div className="flex gap-3 items-start">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                        <Icons.Map size={20} className="text-emerald-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-gray-900">{t('resourceHub')}</h4>
                                        <p className="text-sm text-gray-600 mt-0.5">{t('learnResourceHubTabDesc')}</p>
                                        <button
                                            type="button"
                                            onClick={() => onNavigate?.('resources')}
                                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                                        >
                                            {t('readMore')} <Icons.ChevronRight size={14} className="shrink-0" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {learnItemsSubTab === 'communityGuide' && (
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
                                            {canManageContent && (
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
                        )}
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

            {/* Checklist View - same style as Tutorials */}
            {activeTab === 'checklist' && (
                <div className="space-y-3 animate-in slide-in-from-left-4 fade-in duration-300">
                    {checklist.map(item => (
                        <div 
                            key={item.id} 
                            onClick={() => toggleItem(item.id)}
                            className={`p-4 rounded-xl border-2 flex items-center gap-4 cursor-pointer transition-all relative group ${
                                item.completed 
                                ? 'bg-gray-50 border-green-200' 
                                : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                            }`}
                        >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                item.completed ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'
                            }`}>
                                {item.completed && <Icons.Check size={14} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm text-gray-900">
                                    {CHECKLIST_KEY_MAP[item.id] ? t(CHECKLIST_KEY_MAP[item.id]) : item.title}
                                </h3>
                                {item.description && (
                                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{item.description}</p>
                                )}
                                <span className="text-xs text-gray-500">+{item.xp} XP</span>
                            </div>
                            {item.completed && (
                                <>
                                    <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded shrink-0">
                                        <Icons.Check size={14} /> {t('completed')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                                        aria-label={t('undo')}
                                        className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-1.5 shrink-0"
                                        title={t('undo')}
                                    >
                                        <Icons.Undo size={14} />
                                        {t('undo')}
                                    </button>
                                </>
                            )}
                            {canManageContent && (
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
                    {/* Sub-tabs: Total Courses | My Courses | Booked | Completed */}
                    <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto gap-0.5">
                        <button
                            onClick={() => setDrillsSubTab('total')}
                            className={`flex-1 min-w-0 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                                drillsSubTab === 'total'
                                    ? 'bg-slate-700 text-white shadow-md'
                                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                            }`}
                        >
                            {t('totalCourses') || 'Total Courses'}
                        </button>
                        <button
                            onClick={() => setDrillsSubTab('my')}
                            className={`flex-1 min-w-0 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                                drillsSubTab === 'my'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-600 hover:bg-blue-100 hover:text-blue-700'
                            }`}
                        >
                            {t('myCourses') || 'My Courses'}
                        </button>
                        <button
                            onClick={() => setDrillsSubTab('booked')}
                            className={`flex-1 min-w-0 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                                drillsSubTab === 'booked'
                                    ? 'bg-green-600 text-white shadow-md'
                                    : 'text-slate-600 hover:bg-green-100 hover:text-green-700'
                            }`}
                        >
                            {t('booked') || 'Booked'}
                        </button>
                        <button
                            onClick={() => setDrillsSubTab('completed')}
                            className={`flex-1 min-w-0 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                                drillsSubTab === 'completed'
                                    ? 'bg-slate-500 text-white shadow-md'
                                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                            }`}
                        >
                            {t('completed') || 'Completed'}
                        </button>
                    </div>

                    {/* Total Courses - Calendar + all available */}
                    {drillsSubTab === 'total' && (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-gray-600 mb-3">{t('calendarRegistrationHint') || 'Explore available courses and select a suitable date and time from the calendar.'}</p>
                                <DrillsCalendar
                                    drills={drills}
                                    currentMonth={drillCalendarMonth}
                                    onMonthChange={setDrillCalendarMonth}
                                    onSlotClick={(d, slot) => openRegisterModal(d, slot)}
                                    onDrillClick={(d) => setSelectedDrill(d)}
                                    registeredIds={registeredDrillIds}
                                    registeredSlots={registeredSlots}
                                    t={t}
                                    isAdmin={canManageDrills}
                                    calendarRef={calendarRef}
                                    onListClick={() => upcomingSessionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                    hideEventTypeLegend
                                />
                            </div>
                            <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-4 text-sm text-gray-700">
                                <p className="font-medium text-blue-900 mb-1">{t('howToBookSessionsTitle') || 'How to book sessions or courses'}</p>
                                <p>{t('howToBookSessionsText') || 'To register for an upcoming session or course: click a slot on the calendar above (or use the Register button below), choose your preferred date and time, then confirm. You can cancel anytime if you have conflicts or need to postpone.'}</p>
                            </div>
                            <div ref={upcomingSessionsRef} className="space-y-3 scroll-mt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('availableCourses') || 'Available Courses'}</h4>
                                    <button
                                        type="button"
                                        onClick={() => calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 shrink-0"
                                    >
                                        <Icons.Calendar size={14} />
                                        {t('viewOnCalendar') || 'View on Calendar'}
                                    </button>
                                </div>
                                {drills.filter(d => isVisibleInTotalTab(d.status)).map(drill => {
                                    const isRegistered = registeredDrillIds.includes(drill.id);
                                    const et = drill.eventType || 'session';
                                    const etNormalized = String(et).toLowerCase();
                                    const eventLabel =
                                        etNormalized === 'session'
                                            ? (t('eventTypeSession') || 'Session')
                                            : etNormalized === 'course'
                                                ? 'Course'
                                            : etNormalized === 'appointment'
                                                ? (t('eventTypeAppointment') || 'Appointment')
                                                : etNormalized === 'deadline'
                                                    ? (t('eventTypeDeadline') || 'Deadline')
                                                    : String(et);
                                    return (
                                        <div key={drill.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-200 transition-colors">
                                            <div className="flex justify-between items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{eventLabel}</span>
                                                        <h4
                                                            className="font-bold cursor-pointer hover:text-blue-600"
                                                            onClick={() => setSelectedDrill(drill)}
                                                            role="button"
                                                            tabIndex={0}
                                                            onKeyDown={e => e.key === 'Enter' && setSelectedDrill(drill)}
                                                        >
                                                            {DRILL_KEY_MAP[drill.id] ? t(DRILL_KEY_MAP[drill.id]) : drill.title}
                                                        </h4>
                                                    </div>
                                                    <span className="text-xs text-gray-500 block mt-0.5">
                                                        {drill.date}{drill.time ? ` • ${drill.time}` : ''} • {DRILL_TYPE_KEYS[drill.type] ? t(DRILL_TYPE_KEYS[drill.type]) : drill.type}
                                                    </span>
                                                    {canManageDrills && (() => {
                                                        const raw = String(drill.status || '');
                                                        const [baseStatus, ...rest] = raw.split(' - ');
                                                        const baseLower = baseStatus.trim().toLowerCase();
                                                        const customPart = rest.length ? rest.join(' - ') : '';

                                                        if (baseLower === 'upcoming' || baseLower === 'completed') {
                                                            return customPart ? (
                                                                <span className="mt-1 inline-block text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200">
                                                                    {customPart}
                                                                </span>
                                                            ) : null;
                                                        }
                                                        if (baseLower === 'cancelled' || baseLower === 'cancel' || baseLower.includes('cancel')) {
                                                            return (
                                                                <span className="mt-1 inline-block text-[10px] font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">
                                                                    {customPart || (t('cancel') || 'Cancel')}
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className="mt-1 inline-block text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200">
                                                                {customPart || raw}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                {!canManageDrills && (
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {isRegistered ? (
                                                            <>
                                                                <span className="px-3 py-2 bg-green-100 text-green-700 text-xs font-bold rounded-lg flex items-center gap-1.5">
                                                                    <Icons.Check size={14} /> {t('registered') || 'Registered'}
                                                                </span>
                                                                <button
                                                                    onClick={() => setDrillToCancel({ drill, fromDetailModal: false })}
                                                                    className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                                                                    title={t('cancelRegistrationHint') || 'Cancel registration (e.g. conflicts, postpone)'}
                                                                >
                                                                    {t('cancelRegistration') || 'Cancel registration'}
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => openRegisterModal(drill)}
                                                                className="px-4 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                                                            >
                                                                {t('register')}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <DrillSocialSection drill={drill} t={t} compact onShareSuccess={setSuccessToast} onOpenDrill={setSelectedDrill} currentUserId={user?.id} />
                                            {canManageDrills && (
                                                <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-50">
                                                    <button onClick={() => openDrillForm(drill)} className="text-xs font-bold text-blue-600">{t('edit')}</button>
                                                    <button onClick={(e) => handleDeleteDrill(drill.id, e)} className="text-xs font-bold text-red-600">{t('delete')}</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {drills.filter(d => isVisibleInTotalTab(d.status)).length === 0 && (
                                    <div className="text-gray-400 text-sm py-6 text-center italic">{t('noUpcomingDrills')}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* My Courses - user's registered (booked + completed) */}
                    {drillsSubTab === 'my' && (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-gray-600 mb-3">{t('myCoursesHint') || 'View and manage the courses you’ve registered for.'}</p>
                                <DrillsCalendar
                                    drills={drills.filter(d => registeredDrillIds.includes(d.id))}
                                    currentMonth={drillCalendarMonth}
                                    onMonthChange={setDrillCalendarMonth}
                                    onSlotClick={(d, slot) => openRegisterModal(d, slot)}
                                    onDrillClick={(d) => setSelectedDrill(d)}
                                    registeredIds={registeredDrillIds}
                                    registeredSlots={registeredSlots}
                                    t={t}
                                    isAdmin={canManageDrills}
                                    calendarRef={calendarRef}
                                    onListClick={() => upcomingSessionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                    hideEventTypeLegend
                                />
                            </div>
                            <div ref={upcomingSessionsRef} className="space-y-3 scroll-mt-4">
                                <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('myCourses') || 'My Courses'}</h4>
                                {drills.filter(d => registeredDrillIds.includes(d.id)).map(drill => (
                                    <div key={drill.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-200 transition-colors">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold">{DRILL_KEY_MAP[drill.id] ? t(DRILL_KEY_MAP[drill.id]) : drill.title}</h4>
                                                <span className="text-xs text-gray-500 block mt-0.5">
                                                    {drill.date}{drill.time ? ` • ${drill.time}` : ''} • {(() => {
                                                        const raw = String(drill.status || '');
                                                        const [baseStatus, ...rest] = raw.split(' - ');
                                                        const baseLower = baseStatus.trim().toLowerCase();
                                                        const customPart = rest.length ? rest.join(' - ') : '';

                                                        if (baseLower === 'completed') return t('completed') || 'Completed';
                                                        if (baseLower === 'cancel' || baseLower === 'cancelled' || baseLower.includes('cancel')) return customPart || (t('cancel') || 'Cancel');
                                                        return t('booked') || 'Booked';
                                                    })()}
                                                </span>
                                            </div>
                                            {!canManageDrills && isActiveDrillStatus(drill.status) && (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="px-3 py-2 bg-green-100 text-green-700 text-xs font-bold rounded-lg flex items-center gap-1.5">
                                                        <Icons.Booked size={14} /> {t('booked') || 'Booked'}
                                                    </span>
                                                    <button
                                                        onClick={() => setDrillToCancel({ drill, fromDetailModal: false })}
                                                        className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                                                    >
                                                        {t('cancelRegistration') || 'Cancel registration'}
                                                    </button>
                                                </div>
                                            )}
                                            {isCompletedStatus(drill.status) && (
                                                <span className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg">{t('completed') || 'Completed'}</span>
                                            )}
                                            {String(drill.status || '').toLowerCase().includes('cancel') && !isCompletedStatus(drill.status) && (() => {
                                                const raw = String(drill.status || '');
                                                const [baseStatus, ...rest] = raw.split(' - ');
                                                const baseLower = baseStatus.trim().toLowerCase();
                                                const customPart = rest.length ? rest.join(' - ') : '';
                                                if (!(baseLower === 'cancel' || baseLower === 'cancelled' || baseLower.includes('cancel'))) return null;
                                                return (
                                                    <span className="px-3 py-2 bg-red-50 text-red-700 text-xs font-bold rounded-lg">
                                                        {customPart || (t('cancel') || 'Cancel')}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <DrillSocialSection drill={drill} t={t} compact onShareSuccess={setSuccessToast} onOpenDrill={setSelectedDrill} currentUserId={user?.id} />
                                    </div>
                                ))}
                                {drills.filter(d => registeredDrillIds.includes(d.id)).length === 0 && (
                                    <div className="text-gray-400 text-sm py-6 text-center italic">{t('noMyCourses') || 'No courses yet. Book from Total Courses.'}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Booked - user's registered upcoming only */}
                    {drillsSubTab === 'booked' && (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-gray-600 mb-3">{t('bookedHint') || 'Upcoming courses you have successfully reserved.'}</p>
                                <DrillsCalendar
                                    drills={drills.filter(d => isActiveDrillStatus(d.status) && registeredDrillIds.includes(d.id))}
                                    currentMonth={drillCalendarMonth}
                                    onMonthChange={setDrillCalendarMonth}
                                    onSlotClick={(d, slot) => openRegisterModal(d, slot)}
                                    onDrillClick={(d) => setSelectedDrill(d)}
                                    registeredIds={registeredDrillIds}
                                    registeredSlots={registeredSlots}
                                    t={t}
                                    isAdmin={canManageDrills}
                                    calendarRef={calendarRef}
                                    onListClick={() => upcomingSessionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                    hideEventTypeLegend
                                />
                            </div>
                            <div ref={upcomingSessionsRef} className="space-y-3 scroll-mt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('booked') || 'Booked'}</h4>
                                    <button
                                        type="button"
                                        onClick={() => calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 shrink-0"
                                    >
                                        <Icons.Calendar size={14} />
                                        {t('viewOnCalendar') || 'View on Calendar'}
                                    </button>
                                </div>
                                {drills.filter(d => isActiveDrillStatus(d.status) && registeredDrillIds.includes(d.id)).map(drill => (
                                <div key={drill.id} className="bg-white p-4 rounded-xl border border-green-200 shadow-sm">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold">{DRILL_KEY_MAP[drill.id] ? t(DRILL_KEY_MAP[drill.id]) : drill.title}</h4>
                                            <span className="text-xs text-gray-500 block mt-0.5">
                                                {drill.date}{drill.time ? ` • ${drill.time}` : ''}
                                            </span>
                                        </div>
                                        {!canManageDrills && (
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="px-3 py-2 bg-green-100 text-green-700 text-xs font-bold rounded-lg flex items-center gap-1.5">
                                                    <Icons.Booked size={14} /> {t('booked') || 'Booked'}
                                                </span>
                                                <button
                                                    onClick={() => setDrillToCancel({ drill, fromDetailModal: false })}
                                                    className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                                                >
                                                    {t('cancelRegistration') || 'Cancel registration'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <DrillSocialSection drill={drill} t={t} compact onShareSuccess={setSuccessToast} onOpenDrill={setSelectedDrill} currentUserId={user?.id} />
                                </div>
                            ))}
                                {drills.filter(d => isActiveDrillStatus(d.status) && registeredDrillIds.includes(d.id)).length === 0 && (
                                    <div className="text-gray-400 text-sm py-6 text-center italic">{t('noBookedCourses') || 'No booked courses. Register from Total Courses.'}</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Completed - past logs */}
                    {drillsSubTab === 'completed' && (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-gray-600 mb-3">{t('completedCoursesHint') || 'Courses you’ve completed and the achievements you’ve earned.'}</p>
                                <DrillsCalendar
                                    drills={drills.filter(d => isCompletedStatus(d.status))}
                                    currentMonth={drillCalendarMonth}
                                    onMonthChange={setDrillCalendarMonth}
                                    onSlotClick={(d, slot) => openRegisterModal(d, slot)}
                                    onDrillClick={(d) => setSelectedDrill(d)}
                                    registeredIds={registeredDrillIds}
                                    registeredSlots={registeredSlots}
                                    t={t}
                                    isAdmin={canManageDrills}
                                    calendarRef={calendarRef}
                                    onListClick={() => upcomingSessionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                    hideEventTypeLegend
                                />
                            </div>
                            <div ref={upcomingSessionsRef} className="space-y-3 scroll-mt-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{t('completed') || 'Completed'}</h4>
                                    <button
                                        type="button"
                                        onClick={() => calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 shrink-0"
                                    >
                                        <Icons.Calendar size={14} />
                                        {t('viewOnCalendar') || 'View on Calendar'}
                                    </button>
                                </div>
                                {drills.filter(d => isCompletedStatus(d.status)).map(drill => (
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
                                    <DrillSocialSection drill={drill} t={t} compact onShareSuccess={setSuccessToast} onOpenDrill={setSelectedDrill} currentUserId={user?.id} />
                                    {canManageDrills && (
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button onClick={() => openDrillForm(drill)} className="text-xs font-bold text-gray-500 hover:text-blue-600">{t('edit')}</button>
                                            <button onClick={(e) => handleDeleteDrill(drill.id, e)} className="text-xs font-bold text-gray-500 hover:text-red-500">{t('delete')}</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                                {drills.filter(d => isCompletedStatus(d.status)).length === 0 && (
                                    <div className="text-gray-400 text-sm py-6 text-center italic">{t('noCompletedCourses') || 'No completed courses yet.'}</div>
                                )}
                            </div>
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
                                <div className="flex items-start gap-4">
                                    {/* Checkmark circle - same style as Checklist */}
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                        isCompleted ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'
                                    }`}>
                                        {isCompleted && <Icons.Check size={14} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900">{title}</h4>
                                        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                                        <span className="inline-block mt-2 text-xs font-medium text-amber-600">+{tutorial.xpReward} XP</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                        {canManageContent && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); openTutorialForm(tutorial); }} className="p-2 text-gray-400 hover:text-blue-600" aria-label={t('edit')}><Icons.Edit size={16} /></button>
                                                <button onClick={(e) => handleDeleteTutorial(tutorial.id, e)} className="p-2 text-gray-400 hover:text-red-600" aria-label={t('delete')}><Icons.Trash size={16} /></button>
                                            </>
                                        )}
                                        {isCompleted && (
                                            <>
                                                <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
                                                    <Icons.Check size={14} /> {t('completed')}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUndoTutorial(tutorial)}
                                                    aria-label={`${t('undo')}: ${title}`}
                                                    className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-1.5"
                                                >
                                                    <Icons.Undo size={14} />
                                                    {t('undo')}
                                                </button>
                                            </>
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
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4">{editingChecklist ? t('editItem') : t('newChecklistItem')}</h3>
                        <form onSubmit={handleSaveChecklist} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('title')}</label>
                                <input className="w-full p-2 border rounded-lg" value={checklistTitle} onChange={e => setChecklistTitle(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('description')}</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg text-sm resize-y min-h-[80px]"
                                    rows={3}
                                    value={checklistDescription}
                                    onChange={e => setChecklistDescription(e.target.value)}
                                    placeholder={t('descriptionPlaceholder') || 'Optional details...'}
                                />
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

            {/* Register Drill Modal - select session date/time */}
            {drillToRegister && (
                <RegisterDrillModal
                    drill={drillToRegister}
                    initialSlot={registerInitialSlot}
                    onRegister={(drill, slot) => {
                        handleRegisterDrill(drill, slot);
                        // Modal stays open to show success message; closes via onClose when user clicks OK
                    }}
                    onClose={() => { setDrillToRegister(null); setRegisterInitialSlot(undefined); }}
                    t={t}
                />
            )}

            {/* Confirm Cancel Modal - Do you want to cancel this Session or Course? */}
            {drillToCancel && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
                        <h3 className="font-bold text-lg mb-4">{t('confirmCancelTitle') || 'Cancel booking'}</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            {t('confirmCancelMessage') || 'Do you want to cancel this Session or Course?'}
                        </p>
                        <p className="text-sm font-medium text-gray-900 mb-4">
                            {drillToCancel.drill.title}
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setDrillToCancel(null)}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl"
                            >
                                {t('keepBooking') || 'Keep booking'}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCancel}
                                className="flex-1 py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                            >
                                {t('confirm') || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success toast - after booking or cancelling */}
            {successToast && (
                <SuccessToast
                    message={successToast}
                    onClose={() => setSuccessToast(null)}
                />
            )}

            {/* Drill Detail Modal - for calendar click / register */}
            {selectedDrill && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && setSelectedDrill(null)}>
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto my-4" dir="ltr">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg">{DRILL_KEY_MAP[selectedDrill.id] ? t(DRILL_KEY_MAP[selectedDrill.id]) : selectedDrill.title}</h3>
                            <button type="button" onClick={() => setSelectedDrill(null)} className="p-2 rounded-full hover:bg-gray-100" aria-label={t('close')}>
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                            <p><span className="font-bold text-gray-500">{t('dateLabel')}:</span> {selectedDrill.date}{selectedDrill.time ? ` ${selectedDrill.time}` : ''}</p>
                            <p><span className="font-bold text-gray-500">{t('alertType')}:</span> {DRILL_TYPE_KEYS[selectedDrill.type] ? t(DRILL_TYPE_KEYS[selectedDrill.type]) : selectedDrill.type}</p>
                            <p>
                                <span className="font-bold text-gray-500">{t('status') || 'Status'}:</span>{' '}
                                {(() => {
                                    const raw = String(selectedDrill.status || '');
                                    const [baseStatus, ...rest] = raw.split(' - ');
                                    const baseLower = baseStatus.trim().toLowerCase();
                                    const customPart = rest.length ? rest.join(' - ') : '';

                                    if (baseLower === 'cancelled' || baseLower === 'cancel' || baseLower.includes('cancel')) {
                                        return customPart || (t('cancel') || 'Cancel');
                                    }
                                    if (baseLower === 'completed') {
                                        return customPart || (t('completed') || 'Completed');
                                    }
                                    if (baseLower === 'progress' || baseLower === 'happening') {
                                        return customPart || 'Progress';
                                    }
                                    if (baseLower === 'upcoming') {
                                        return customPart || 'Upcoming';
                                    }
                                    return customPart || selectedDrill.status;
                                })()}
                            </p>
                            {selectedDrill.eventType && (
                                <p>
                                    <span className="font-bold text-gray-500">{t('eventType') || 'Type'}:</span>
                                    {(() => {
                                        const et = selectedDrill.eventType || 'session';
                                        const etNormalized = String(et).toLowerCase();
                                        if (etNormalized === 'session') return t('eventTypeSession') || 'Session';
                                        if (etNormalized === 'course') return 'Course';
                                        if (etNormalized === 'appointment') return t('eventTypeAppointment') || 'Appointment';
                                        if (etNormalized === 'deadline') return t('eventTypeDeadline') || 'Deadline';
                                        return String(et);
                                    })()}
                                </p>
                            )}
                            {selectedDrill.notes && (
                                <p className="mt-2"><span className="font-bold text-gray-500">{t('description')}:</span> {selectedDrill.notes}</p>
                            )}
                        </div>
                        {/* Social: Like, Share, Comments (Edit, Update, Delete) */}
                        <DrillSocialSection drill={selectedDrill} t={t} onShareSuccess={setSuccessToast} currentUserId={user?.id} />
                        {/* Booking actions intentionally hidden in detail modal for normal users */}
                        {canManageDrills && (
                            <div className="mt-6 flex gap-2">
                                <button onClick={() => { setSelectedDrill(null); openDrillForm(selectedDrill); }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm">{t('edit')}</button>
                                <button onClick={(e) => { handleDeleteDrill(selectedDrill.id, e); setSelectedDrill(null); }} className="flex-1 py-2 bg-red-100 text-red-600 rounded-lg font-bold text-sm">{t('delete')}</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Drill Modal */}
            {showDrillForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4">{editingDrill ? t('editDrill') : t('newDrillSession')}</h3>
                        <form onSubmit={handleSaveDrill} className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('title')}</label>
                                <input className="w-full p-2 border rounded-lg" value={drillTitle} onChange={e => setDrillTitle(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('description')}</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg text-sm resize-y min-h-[80px]"
                                    rows={3}
                                    value={drillNotes}
                                    onChange={e => setDrillNotes(e.target.value)}
                                    placeholder={t('descriptionPlaceholder') || 'Details, outcomes, participant count...'}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('dateLabel')}</label>
                                    <input type="date" className="w-full p-2 border rounded-lg" value={drillDate} onChange={e => setDrillDate(e.target.value)} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('timeLabel') || 'Time'}</label>
                                    <input type="time" className="w-full p-2 border rounded-lg" value={drillTime} onChange={e => setDrillTime(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('eventType') || 'Event Type'}</label>
                                <select
                                    className="w-full p-2 border rounded-lg bg-white"
                                    value={drillEventTypeChoice}
                                    onChange={e => {
                                        const next = e.target.value as any;
                                        setDrillEventTypeChoice(next);
                                        // If the user changes the dropdown, we should not keep any old custom override.
                                        setDrillEventTypeOverride('');
                                    }}
                                >
                                    <option value="course">Course</option>
                                    <option value="appointment">{t('eventTypeAppointment') || 'Appointment'}</option>
                                    <option value="session">{t('eventTypeSession') || 'Session'}</option>
                                    <option value="deadline">{t('eventTypeDeadline') || 'Deadline'}</option>
                                </select>
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('alertType')}</label>
                                    <select
                                        className="w-full p-2.5 border rounded-lg bg-white"
                                        value={drillTypeChoice}
                                        onChange={e => {
                                            const next = e.target.value as any;
                                            setDrillTypeChoice(next);
                                            // If the user changes the dropdown, we should not keep any old custom override.
                                            setDrillTypeOverride('');
                                        }}
                                    >
                                        <option>Fire</option>
                                        <option>Evacuation</option>
                                        <option>Lockdown</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('status')}</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white"
                                        value={drillStatusChoice}
                                        onChange={e => {
                                            const next = e.target.value as any;
                                            setDrillStatusChoice(next);
                                            // If the user changes the dropdown, we should not keep any old custom override.
                                            setDrillStatusOverride('');
                                        }}
                                    >
                                        <option>Upcoming</option>
                                        <option>Progress</option>
                                        <option value="Cancel">{t('cancel') || 'Cancel'}</option>
                                        <option>Completed</option>
                                    </select>
                                </div>
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
                                <textarea
                                    className="w-full p-2 border rounded-lg text-sm resize-y min-h-[80px]"
                                    rows={3}
                                    value={tutorialDescription}
                                    onChange={e => setTutorialDescription(e.target.value)}
                                    placeholder={t('descriptionPlaceholder') || 'Optional details...'}
                                />
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

            {/* Gamified celebration overlay - Duolingo-style balloons, confetti, sound */}
            {celebrationXp !== null && (
                <CelebrationOverlay
                    xpEarned={celebrationXp}
                    onComplete={() => setCelebrationXp(null)}
                />
            )}

            {/* Learn Item Modal */}
            {showLearnForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4">{editingLearn ? t('editLearnItem') : t('newLearnItem')}</h3>
                        <form onSubmit={handleSaveLearn} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('title')}</label>
                                <input className="w-full p-2 border rounded-lg" value={learnTitle} onChange={e => setLearnTitle(e.target.value)} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('description')}</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg text-sm resize-y min-h-[80px]"
                                    rows={3}
                                    value={learnDescription}
                                    onChange={e => setLearnDescription(e.target.value)}
                                    placeholder={t('descriptionPlaceholder') || 'Optional details...'}
                                />
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
