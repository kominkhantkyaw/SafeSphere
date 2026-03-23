import React, { useMemo, useState } from 'react';
import { Icons } from './Icon';
import type { DrillSession } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarView = 'month' | 'week' | 'day' | 'list';

const EVENT_TYPE_KEYS = ['course', 'session', 'appointment', 'deadline'] as const;
type EventTypeKey = typeof EVENT_TYPE_KEYS[number];

const EVENT_TYPE_STYLES: Record<EventTypeKey, { bg: string; border: string; text: string; label: string }> = {
    course: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', label: 'Course' },
    session: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', label: 'Session' },
    appointment: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Appointment' },
    deadline: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Deadline' },
};

const getEventTypeStyle = (eventType?: string) => {
    const key = (eventType || 'session').toLowerCase() as string;
    if (key === 'course' || key === 'session' || key === 'appointment' || key === 'deadline') {
        return EVENT_TYPE_STYLES[key as EventTypeKey];
    }
    return EVENT_TYPE_STYLES.session;
};

/** A calendar slot entry - drill + specific date/time (for drills with multiple slots) */
export interface CalendarSlotEntry {
    drill: DrillSession;
    slot: { date: string; time: string };
}

interface DrillRegistration {
    drillId: number;
    slotDate?: string;
    slotTime?: string;
}

interface DrillsCalendarProps {
    drills: DrillSession[];
    currentMonth: Date;
    onMonthChange: (date: Date) => void;
    /** E-learning style: click a slot on calendar to register - opens registration with that drill */
    onSlotClick?: (drill: DrillSession, slot: { date: string; time: string }) => void;
    onDrillClick?: (drill: DrillSession) => void;
    registeredIds: number[];
    /** Slot-level registrations - for showing booked icon on specific date+time */
    registeredSlots?: DrillRegistration[];
    t: (key: string) => string;
    isAdmin?: boolean;
    /** Ref for scroll-into-view when Register directs to calendar */
    calendarRef?: React.RefObject<HTMLDivElement | null>;
    /** When List is clicked, scroll to Upcoming Sessions (same content) instead of showing inline list */
    onListClick?: () => void;
    /** Hide Session/Appointment/Deadline from legend - user-centric view (Booked, Completed, Today only) */
    hideEventTypeLegend?: boolean;
}

/** Get all slot entries for a drill - slots array or single date+time */
const getSlotEntries = (drill: DrillSession): { date: string; time: string }[] => {
    if (drill.slots && drill.slots.length > 0) {
        return drill.slots.map(s => ({ date: s.date, time: s.time }));
    }
    return [{ date: drill.date, time: drill.time || '09:00' }];
};

const isSlotBooked = (drillId: number, slot: { date: string; time: string }, regs: DrillRegistration[]): boolean =>
    regs.some(r => r.drillId === drillId && (r.slotDate === slot.date || !r.slotDate) && (r.slotTime === slot.time || !r.slotTime));

const isToday = (dateKey: string): boolean => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return dateKey === `${y}-${m}-${d}`;
};

export const DrillsCalendar: React.FC<DrillsCalendarProps> = ({
    drills,
    currentMonth,
    onMonthChange,
    onSlotClick,
    onDrillClick,
    registeredIds,
    registeredSlots = [],
    t,
    isAdmin,
    calendarRef,
    onListClick,
    hideEventTypeLegend = false,
}) => {
    const [viewMode, setViewMode] = useState<CalendarView>('month');

    const { days, startOffset } = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        const startOffset = first.getDay();
        const totalDays = last.getDate();
        const days: (number | null)[] = [];
        for (let i = 0; i < startOffset; i++) days.push(null);
        for (let d = 1; d <= totalDays; d++) days.push(d);
        return { days, startOffset };
    }, [currentMonth]);

    /** E-learning style: each slot on its date - Upcoming (active/coming) + Completed */
    const slotsByDate = useMemo(() => {
        const map: Record<string, CalendarSlotEntry[]> = {};
        drills.forEach(drill => {
            getSlotEntries(drill).forEach(slot => {
                const key = slot.date;
                if (!map[key]) map[key] = [];
                map[key].push({ drill, slot });
            });
        });
        return map;
    }, [drills]);

    const prevMonth = () => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    const nextMonth = () => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

    const monthLabel = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const viewTabs = [
        { id: 'month' as const, label: t('viewMonth') || 'Month' },
        { id: 'week' as const, label: t('viewWeek') || 'Week' },
        { id: 'day' as const, label: t('viewDay') || 'Day' },
        { id: 'list' as const, label: t('viewList') || 'List' },
    ];

    const goToToday = () => onMonthChange(new Date());

    const getStatusFlags = (status: string | undefined) => {
        const normalized = (status || '').toLowerCase();
        const isCompleted = normalized.startsWith('completed');
        const isCancelled = normalized === 'cancelled' || normalized === 'cancel' || normalized.includes('cancel');
        const isUpcomingLike = !isCompleted && !isCancelled;
        return { isCompleted, isCancelled, isUpcomingLike };
    };

    return (
        <div ref={calendarRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden scroll-mt-4">
            {/* Header: Today | Month Year | Month, Week, Day, List (all in one row) */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 bg-slate-50">
                {/* Left: Nav arrows + today */}
                <div className="flex items-center gap-1">
                    <button type="button" onClick={prevMonth} className="p-2 rounded bg-slate-700 text-white hover:bg-slate-600" aria-label={t('previousMonth') || 'Previous month'}>
                        <Icons.ChevronLeft size={18} />
                    </button>
                    <button type="button" onClick={nextMonth} className="p-2 rounded bg-slate-700 text-white hover:bg-slate-600" aria-label={t('nextMonth') || 'Next month'}>
                        <Icons.ChevronRight size={18} />
                    </button>
                    <button type="button" onClick={goToToday} className="px-3 py-2 rounded bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 lowercase">
                        {t('activeToday') || 'today'}
                    </button>
                </div>
                {/* Center: Month Year */}
                <h3 className="font-bold text-gray-900 text-lg capitalize">{monthLabel}</h3>
                {/* Right: View switcher */}
                <div className="flex gap-0.5">
                    {viewTabs.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => {
                                if (id === 'list' && onListClick) {
                                    onListClick(); // Scroll to Upcoming Sessions (same content)
                                } else {
                                    setViewMode(id);
                                }
                            }}
                            className={`px-3 py-2 text-xs font-bold rounded transition-colors ${
                                viewMode === id && id !== 'list'
                                    ? 'bg-slate-800 text-white ring-1 ring-slate-600'
                                    : 'bg-slate-700 text-white hover:bg-slate-600'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Weekday headers - hide for non-month views */}
            {viewMode === 'month' && (
                <div className="grid grid-cols-7 border-b border-gray-200">
                    {WEEKDAYS.map(day => (
                        <div key={day} className="py-2 text-center text-xs font-bold text-blue-600 underline">
                            {day}
                        </div>
                    ))}
                </div>
            )}

            {/* Month view - calendar grid */}
            {viewMode === 'month' && (
            <div className="grid grid-cols-7">
                {days.map((day, idx) => {
                    const dateKey = day !== null
                        ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        : '';
                    const daySlots = dateKey ? (slotsByDate[dateKey] || []) : [];
                    const isTodayCell = dateKey === todayKey;
                    return (
                        <div
                            key={idx}
                            className={`min-h-[80px] p-1 border-b border-r border-gray-200 last:border-r-0 ${
                                day === null ? 'bg-gray-50/50' : isTodayCell ? 'bg-[#FFF9E3]' : 'bg-white'
                            }`}
                        >
                            {day !== null && (
                                <>
                                    <span className={`text-xs font-medium ${isTodayCell ? 'text-blue-700 font-bold' : 'text-blue-600'}`}>{day}</span>
                                    <div className="mt-0.5 space-y-0.5">
                                        {daySlots.slice(0, 3).map((entry, ei) => {
                                            const { drill, slot } = entry;
                                            const { isCompleted, isCancelled, isUpcomingLike } = getStatusFlags(drill.status);
                                            const slotBooked = isSlotBooked(drill.id, slot, registeredSlots);
                                            const isUpcoming = isUpcomingLike;
                                            const slotIsToday = isToday(dateKey);
                                            const style = (isCompleted || isCancelled)
                                                ? { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-600' }
                                                : getEventTypeStyle(drill.eventType);
                                            const rawStatus = String(drill.status || '');
                                            const [baseStatus, ...rest] = rawStatus.split(' - ');
                                            const baseLower = baseStatus.trim().toLowerCase();
                                            const customPart = rest.length ? rest.join(' - ') : '';
                                            const statusPillText =
                                                baseLower === 'upcoming' || baseLower === 'completed'
                                                    ? (customPart || null)
                                                    : isCancelled
                                                        ? (customPart || (t('cancel') || 'Cancel'))
                                                        : baseLower === 'progress' || baseLower === 'happening'
                                                            ? (customPart || 'Progress')
                                                            : (customPart || rawStatus);
                                            const handleClick = () => {
                                                if (isCompleted || isCancelled) return;
                                                if (onSlotClick && !isAdmin && isUpcomingLike) {
                                                    onSlotClick(drill, slot);
                                                } else {
                                                    onDrillClick?.(drill);
                                                }
                                            };
                                            return (
                                                <div
                                                    key={`${drill.id}-${slot.date}-${slot.time}-${ei}`}
                                                    onClick={handleClick}
                                                    className={`text-[10px] px-1 py-0.5 rounded border truncate flex items-center gap-0.5 ${style.bg} ${style.border} ${style.text} ${!(isCompleted || isCancelled) ? 'cursor-pointer hover:opacity-90' : 'opacity-75'}`}
                                                    title={`${drill.title} ${slot.time}${slotBooked
                                                        ? ' ✓ ' + (t('booked') || 'Booked')
                                                        : isCompleted
                                                            ? ' ✓ ' + (t('completed') || 'Completed')
                                                            : isCancelled
                                                                ? ' — Cancelled'
                                                                : ' — ' + (t('clickToRegister') || 'Click to register')}`}
                                                >
                                                    {slotBooked && <Icons.Booked size={10} className="shrink-0 text-green-600" />}
                                                    {isCompleted && !slotBooked && <Icons.Check size={10} className="shrink-0 text-gray-500" />}
                                                    {slotIsToday && isUpcoming && !slotBooked && <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" title={t('activeToday') || 'Today'} />}
                                                    <span className="font-mono shrink-0">{slot.time}</span>
                                                    {statusPillText ? (
                                                        <span className="inline-block max-w-[52px] truncate shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/70 border border-white/40">
                                                            {statusPillText}
                                                        </span>
                                                    ) : null}
                                                    <span className="truncate">{drill.title}</span>
                                                </div>
                                            );
                                        })}
                                        {daySlots.length > 3 && (
                                            <span className="text-[10px] text-gray-500">+{daySlots.length - 3}</span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
            )}

            {/* Week view - 7 days of current week */}
            {viewMode === 'week' && (() => {
                const weekStart = new Date(currentMonth);
                weekStart.setDate(1);
                const dayOfWeek = weekStart.getDay();
                const firstSunday = new Date(weekStart);
                firstSunday.setDate(weekStart.getDate() - dayOfWeek);
                const weekDays = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(firstSunday);
                    d.setDate(firstSunday.getDate() + i);
                    return d;
                });
                return (
                    <div className="grid grid-cols-7 border-b border-gray-100">
                        {weekDays.map(d => {
                            const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
                            const dateKey = `${y}-${m}-${day}`;
                            const daySlots = slotsByDate[dateKey] || [];
                            const isTodayCell = dateKey === todayKey;
                            return (
                                <div key={dateKey} className={`min-h-[100px] p-2 border-r border-gray-200 last:border-r-0 ${isTodayCell ? 'bg-[#FFF9E3]' : 'bg-white'}`}>
                                    <div className="text-center mb-1">
                                        <span className={`text-xs ${isTodayCell ? 'font-bold text-blue-700' : 'text-gray-500'}`}>{WEEKDAYS[d.getDay()]}</span>
                                        <span className={`block text-lg font-bold ${isTodayCell ? 'text-blue-700' : 'text-gray-800'}`}>{d.getDate()}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {daySlots.map((entry, ei) => {
                                            const { drill, slot } = entry;
                                            const { isCompleted, isCancelled, isUpcomingLike } = getStatusFlags(drill.status);
                                            const slotBooked = isSlotBooked(drill.id, slot, registeredSlots);
                                            const style = (isCompleted || isCancelled)
                                                ? { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-600' }
                                                : getEventTypeStyle(drill.eventType);
                                            const rawStatus = String(drill.status || '');
                                            const [baseStatus, ...rest] = rawStatus.split(' - ');
                                            const baseLower = baseStatus.trim().toLowerCase();
                                            const customPart = rest.length ? rest.join(' - ') : '';
                                            const statusPillText =
                                                baseLower === 'upcoming' || baseLower === 'completed'
                                                    ? (customPart || null)
                                                    : isCancelled
                                                        ? (customPart || (t('cancel') || 'Cancel'))
                                                        : baseLower === 'progress' || baseLower === 'happening'
                                                            ? (customPart || 'Progress')
                                                            : (customPart || rawStatus);
                                            return (
                                                <div
                                                    key={ei}
                                                    onClick={() => !(isCompleted || isCancelled) && onSlotClick?.(drill, slot)}
                                                    className={`text-[10px] p-1.5 rounded border truncate ${!(isCompleted || isCancelled) ? 'cursor-pointer' : 'opacity-75'} ${style.bg} ${style.border} ${style.text}`}
                                                >
                                                    {slotBooked && <Icons.Booked size={10} className="inline mr-1" />}
                                                    <span className="font-mono">{slot.time}</span> {drill.title}
                                                    {statusPillText ? (
                                                        <span className="inline-block max-w-[46px] truncate shrink-0 ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/70 border border-white/40">
                                                            {statusPillText}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Day view - single day (today) */}
            {viewMode === 'day' && (() => {
                const slots = slotsByDate[todayKey] || [];
                return (
                    <div className="p-4 min-h-[120px] bg-[#FFF9E3] border border-amber-200">
                        <h4 className="font-bold text-gray-900 mb-2">
                            {new Date(todayKey + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            <span className="ml-2 text-blue-600 text-sm">({t('activeToday') || 'Today'})</span>
                        </h4>
                        <div className="space-y-2">
                            {slots.length ? slots.map((entry, ei) => {
                                const { drill, slot } = entry;
                                const { isCompleted, isCancelled } = getStatusFlags(drill.status);
                                const slotBooked = isSlotBooked(drill.id, slot, registeredSlots);
                                const style = (isCompleted || isCancelled)
                                    ? { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-600' }
                                    : getEventTypeStyle(drill.eventType);
                                const rawStatus = String(drill.status || '');
                                const [baseStatus, ...rest] = rawStatus.split(' - ');
                                const baseLower = baseStatus.trim().toLowerCase();
                                const customPart = rest.length ? rest.join(' - ') : '';
                                const statusPillText =
                                    baseLower === 'upcoming' || baseLower === 'completed'
                                        ? (customPart || null)
                                        : isCancelled
                                            ? (customPart || (t('cancel') || 'Cancel'))
                                            : baseLower === 'progress' || baseLower === 'happening'
                                                ? (customPart || 'Progress')
                                                : (customPart || rawStatus);
                                return (
                                    <div
                                        key={ei}
                                        onClick={() => !(isCompleted || isCancelled) && onSlotClick?.(drill, slot)}
                                        className={`p-3 rounded-lg border ${!(isCompleted || isCancelled) ? 'cursor-pointer' : 'opacity-75'} ${style.bg} ${style.border} ${style.text}`}
                                    >
                                        <span className="font-mono font-bold">{slot.time}</span>
                                        {statusPillText ? (
                                            <span className="inline-block max-w-[70px] truncate shrink-0 ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/70 border border-white/40">
                                                {statusPillText}
                                            </span>
                                        ) : null}
                                        <span className="ml-2 truncate">— {drill.title}</span>
                                        {slotBooked && <Icons.Booked size={14} className="inline ml-1" />}
                                    </div>
                                );
                            }) : (
                                <p className="text-sm text-gray-500 italic">{t('noSessionsThisDay') || 'No sessions on this day.'}</p>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Legend: User-centric (Booked, Completed, Today) - optionally include event types */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 border-t border-gray-100 text-xs">
                {!hideEventTypeLegend && EVENT_TYPE_KEYS.map(et => {
                    const s = EVENT_TYPE_STYLES[et];
                    return (
                        <span key={et} className={`flex items-center gap-1.5 ${s.text}`}>
                            <span className={`w-2.5 h-2.5 rounded ${s.bg} ${s.border} border`} />
                            {t(`eventType${et.charAt(0).toUpperCase() + et.slice(1)}`) || s.label}
                        </span>
                    );
                })}
                <span className="flex items-center gap-1.5 text-green-600">
                    <Icons.Booked size={14} />
                    {t('booked') || 'Booked'}
                </span>
                <span className="flex items-center gap-1.5 text-gray-500">
                    <Icons.Check size={14} />
                    {t('completed') || 'Completed'}
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {t('activeToday') || 'Today'}
                </span>
            </div>
        </div>
    );
};
