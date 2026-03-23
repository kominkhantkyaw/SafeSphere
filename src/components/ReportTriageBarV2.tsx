import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { SuccessToast } from './SuccessToast';
import type { IncidentReport } from '../types';

export type ReportTriageKind = 'accept' | 'delay' | 'pending' | 'reject';
export type ReportProgressStep = 'en_route' | 'on_scene' | 'completed';

export interface ReportTriageBarPropsV2 {
    /** Current report status. */
    status: IncidentReport['status'];
    /** Applies the chosen TYPE. */
    onTriage?: (action: ReportTriageKind, note?: string) => Promise<void>;
    /** Applies the chosen STATUS for Accept flow. */
    onProgress?: (step: ReportProgressStep, note?: string) => Promise<void>;

    /**
     * If true, hides triage UI (note + TYPE/STATUS + Save) and only shows
     * secondary actions like Delete.
     */
    hideTriageControls?: boolean;

    /** Delete a closed report from the expanded editor. */
    onDelete?: () => Promise<void>;
    canDelete?: boolean;

    /**
     * Changes the footer layout:
     * - 'default': Close + Save (no delete button)
     * - 'history': Delete + Save (no close button)
     */
    footerVariant?: 'default' | 'history';

    /** If true, the editor starts expanded (useful for History modal UX). */
    startOpen?: boolean;

    /** Notify parent when editor opens/closes (for hiding duplicate Close buttons). */
    onOpenChange?: (open: boolean) => void;

    /** Called after Save succeeds (for "Save and close" flows). */
    onAfterSave?: () => void;

    /** Called after Delete succeeds. */
    onAfterDelete?: () => void;

    /**
     * Limits the selectable actions/statuses.
     * Used to enforce role-based access (e.g. Reporter can only pick Pending/Active).
     */
    allowedTypes?: ReportTriageKind[];
    allowedStatuses?: StatusChoice[];

    disabled?: boolean;
    className?: string;
}

type TypeChoice = ReportTriageKind;
type StatusChoice = 'active' | 'en_route' | 'on_scene' | 'resolved' | 'pending' | 'delayed' | 'rejected';

type Tone = 'green' | 'amber' | 'yellow' | 'red' | 'sky' | 'indigo' | 'gray';

const typeTone: Record<TypeChoice, Tone> = {
    accept: 'green',
    delay: 'amber',
    pending: 'yellow',
    reject: 'red',
};

const statusTone: Record<StatusChoice, Tone> = {
    active: 'green',
    en_route: 'sky',
    on_scene: 'indigo',
    resolved: 'gray',
    pending: 'yellow',
    delayed: 'amber',
    rejected: 'red',
};

function toneSelectedClasses(tone: Tone) {
    switch (tone) {
        case 'green':
            return 'bg-green-600 text-white hover:bg-green-700';
        case 'amber':
            return 'bg-amber-600 text-white hover:bg-amber-700';
        case 'yellow':
            return 'bg-yellow-600 text-white hover:bg-yellow-700';
        case 'red':
            return 'bg-red-600 text-white hover:bg-red-700';
        case 'sky':
            return 'bg-sky-600 text-white hover:bg-sky-700';
        case 'indigo':
            return 'bg-indigo-600 text-white hover:bg-indigo-700';
        case 'gray':
            return 'bg-gray-800 text-white hover:bg-gray-900';
    }
}

function toneUnselectedClasses(tone: Tone) {
    switch (tone) {
        case 'green':
            return 'bg-green-50/90 text-green-900 hover:bg-green-600 hover:text-white';
        case 'amber':
            return 'bg-amber-50/90 text-amber-950 hover:bg-amber-600 hover:text-white';
        case 'yellow':
            return 'bg-yellow-50/90 text-yellow-900 hover:bg-yellow-600 hover:text-white';
        case 'red':
            return 'bg-red-50/90 text-red-900 hover:bg-red-600 hover:text-white';
        case 'sky':
            return 'bg-sky-50/90 text-sky-900 hover:bg-sky-600 hover:text-white';
        case 'indigo':
            return 'bg-indigo-50/90 text-indigo-900 hover:bg-indigo-600 hover:text-white';
        case 'gray':
            return 'bg-gray-50/90 text-gray-800 hover:bg-gray-800 hover:text-white';
    }
}

const ReportTriageBarV2: React.FC<ReportTriageBarPropsV2> = ({
    status,
    onTriage,
    onProgress,
    hideTriageControls = false,
    onDelete,
    canDelete = false,
    footerVariant = 'default',
    startOpen = false,
    onOpenChange,
    onAfterSave,
    onAfterDelete,
    allowedTypes,
    allowedStatuses,
    disabled = false,
    className = '',
}) => {
    const { t } = useLanguage();

    const [open, setOpen] = useState(startOpen);
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        onOpenChange?.(open);
    }, [open, onOpenChange]);

    const [selectedType, setSelectedType] = useState<TypeChoice | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<StatusChoice | null>(null);
    const [note, setNote] = useState('');

    const trimmedNote = () => {
        const x = note.trim();
        return x || undefined;
    };

    const showSavedSuccessfully = useCallback(() => {
        setSuccessMessage(t('triageLatestChangesSaved'));
    }, [t]);

    const run = async (fn: () => Promise<void>) => {
        if (disabled || busy) return;
        setBusy(true);
        try {
            await fn();
            showSavedSuccessfully();
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            if (e instanceof Error && e.name === 'NotAllowedError') return;
            throw e;
        } finally {
            setBusy(false);
        }
    };

    const closeEditor = () => {
        setOpen(false);
        setSelectedType(null);
        setSelectedStatus(null);
        setNote('');
        setTypeOpen(false);
        setStatusOpen(false);
    };

    const [typeOpen, setTypeOpen] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);

    const typeBoxRef = useRef<HTMLDivElement | null>(null);
    const statusBoxRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Close dropdowns when the user clicks outside the TYPE/STATUS textbox controls.
        if (!typeOpen && !statusOpen) return;

        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node | null;
            if (!target) return;

            if (typeBoxRef.current?.contains(target)) return;
            if (statusBoxRef.current?.contains(target)) return;

            setTypeOpen(false);
            setStatusOpen(false);
        };

        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [typeOpen, statusOpen]);

    const initialSelectionsFromStatus = useMemo(() => {
        const s = (status || '').toLowerCase();
        if (s === 'pending' || s === 'info_requested') {
            return { type: 'pending' as const, status: 'pending' as const };
        }
        if (s === 'delayed') {
            return { type: 'delay' as const, status: 'delayed' as const };
        }
        if (s === 'rejected') {
            return { type: 'reject' as const, status: 'rejected' as const };
        }
        if (s === 'en_route') {
            return { type: 'accept' as const, status: 'en_route' as const };
        }
        if (s === 'on_scene') {
            return { type: 'accept' as const, status: 'on_scene' as const };
        }
        if (s === 'resolved') {
            return { type: 'accept' as const, status: 'resolved' as const };
        }
        // active / approved / unknown -> treat as accept + active
        return { type: 'accept' as const, status: 'active' as const };
    }, [status]);

    const typeOptions = useMemo(() => {
        const base = [
            { value: 'accept' as const, label: t('reportTriageAccept') },
            { value: 'delay' as const, label: t('reportTriageDelay') },
            { value: 'pending' as const, label: t('pendingStatus') },
            { value: 'reject' as const, label: t('reportTriageReject') },
        ] as const;
        if (!allowedTypes || allowedTypes.length === 0) return base;
        return base.filter((opt) => allowedTypes.includes(opt.value));
    }, [t, allowedTypes]);

    const statusOptions = useMemo(() => {
        if (!selectedType) return [];
        if (selectedType === 'accept') {
            const base = [
                { value: 'active' as const, label: t('active') },
                { value: 'en_route' as const, label: t('statusEnRoute') },
                { value: 'on_scene' as const, label: t('statusOnScene') },
                { value: 'resolved' as const, label: t('resolvedStatus') },
            ];
            return allowedStatuses?.length ? base.filter((o) => allowedStatuses.includes(o.value)) : base;
        }
        if (selectedType === 'delay') {
            const base = [{ value: 'delayed' as const, label: t('delayedStatus') }];
            return allowedStatuses?.length ? base.filter((o) => allowedStatuses.includes(o.value)) : base;
        }
        if (selectedType === 'pending') {
            const base = [{ value: 'pending' as const, label: t('pendingStatus') }];
            return allowedStatuses?.length ? base.filter((o) => allowedStatuses.includes(o.value)) : base;
        }
        const base = [{ value: 'rejected' as const, label: t('rejectedStatus') }];
        return allowedStatuses?.length ? base.filter((o) => allowedStatuses.includes(o.value)) : base;
    }, [selectedType, t, allowedStatuses]);

    const selectedTypeLabel = useMemo(() => {
        if (!selectedType) return t('reportTriageSelectAction');
        return typeOptions.find((o) => o.value === selectedType)?.label ?? t('reportTriageSelectAction');
    }, [selectedType, t, typeOptions]);

    const selectedStatusLabel = useMemo(() => {
        if (!selectedStatus) return t('status');
        return statusOptions.find((o) => o.value === selectedStatus)?.label ?? t('status');
    }, [selectedStatus, statusOptions, t]);

    const canSave = useMemo(() => {
        if (disabled || busy || deleting) return false;
        if (hideTriageControls) return false;
        if (!onTriage) return false;
        if (selectedType == null || selectedStatus == null) return false;
        if (selectedType === 'accept' && selectedStatus !== 'active' && !onProgress) return false;
        return true;
    }, [disabled, busy, deleting, hideTriageControls, onTriage, selectedType, selectedStatus, onProgress]);

    const handleOpen = () => {
        if (disabled) return;
        setOpen(true);
        const initial = initialSelectionsFromStatus;
        const nextType =
            allowedTypes?.length && !allowedTypes.includes(initial.type) ? allowedTypes[0] : initial.type;

        const initialStatus = initial.status;
        if (allowedStatuses?.length) {
            const candidates: Record<TypeChoice, StatusChoice[]> = {
                accept: ['active', 'en_route', 'on_scene', 'resolved'],
                delay: ['delayed'],
                pending: ['pending'],
                reject: ['rejected'],
            };
            const preferred =
                candidates[nextType].find((s) => allowedStatuses.includes(s)) ??
                allowedStatuses[0] ??
                null;
            setSelectedStatus(allowedStatuses.includes(initialStatus) ? initialStatus : preferred);
        } else {
            setSelectedStatus(initialStatus);
        }

        setSelectedType(nextType);
        setNote('');
        setTypeOpen(false);
        setStatusOpen(false);
    };

    const handleSave = async () => {
        if (!selectedType || !selectedStatus) return;
        if (hideTriageControls) return;
        if (!onTriage) return;

        await run(async () => {
            const n = trimmedNote();

            if (selectedType === 'delay') {
                await onTriage('delay', n);
                return;
            }
            if (selectedType === 'pending') {
                await onTriage('pending', n);
                return;
            }
            if (selectedType === 'reject') {
                await onTriage('reject', n);
                return;
            }

            // accept flow => selected STATUS decides progress vs accept
            if (selectedStatus === 'active') {
                await onTriage('accept', n);
                return;
            }
            if (!onProgress) return;
            if (selectedStatus === 'en_route') await onProgress('en_route', n);
            else if (selectedStatus === 'on_scene') await onProgress('on_scene', n);
            else await onProgress('completed', n); // resolved
        });

        closeEditor();
        onAfterSave?.();
    };

    const handleDelete = async () => {
        if (!onDelete || disabled || busy || deleting || !canDelete) return;
        const ok = window.confirm(t('deleteReportConfirm'));
        if (!ok) return;

        setDeleting(true);
        try {
            await onDelete();
            if (isMountedRef.current) closeEditor();
            onAfterDelete?.();
        } finally {
            if (isMountedRef.current) setDeleting(false);
        }
    };

    // Close editor (used for both Cancel and reset-like behaviour).
    const handleClose = () => closeEditor();

    const setType = (nextType: TypeChoice) => {
        setSelectedType(nextType);
        // Default STATUS for that TYPE (first option).
        // Per UX: choose TYPE first, then STATUS.
        setSelectedStatus(null);
        setNote('');
        setTypeOpen(false);
        setStatusOpen(false);
    };

    return (
        <div className={className}>
            {successMessage && (
                <SuccessToast
                    message={successMessage}
                    onClose={() => setSuccessMessage(null)}
                    zIndexClass="z-[200]"
                />
            )}

            {!open ? (
                <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={handleOpen}
                    className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white shadow-sm hover:bg-black disabled:opacity-50"
                >
                    {t('triageBtnUpdate')}
                </button>
            ) : (
                <div className="space-y-3">
                    {!hideTriageControls && <p className="text-xs text-gray-500">{t('responderReportActionsIntro')}</p>}

                    {hideTriageControls ? (
                        <>
                            <p className="text-xs text-gray-500">
                                {t('deleteRecord')} — {t('deleteReportConfirm')}
                            </p>

                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    disabled={!canDelete || busy || deleting}
                                    onClick={() => void handleDelete()}
                                    className="flex-1 min-h-[48px] items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-bold text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50"
                                >
                                    {t('deleteRecord')}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Notification note */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="responder-report-note-v2"
                                    className="block text-[10px] font-bold uppercase tracking-wide text-gray-500"
                                >
                                    {t('reportTriageNotificationLabel')}
                                </label>

                                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                    <textarea
                                        id="responder-report-note-v2"
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        rows={3}
                                        disabled={busy || deleting}
                                        placeholder={t('reportTriageNotificationPlaceholder')}
                                        className="w-full resize-y bg-transparent p-3 text-sm focus:outline-none focus:ring-0"
                                    />
                                </div>
                            </div>

                            {/* TYPE + STATUS must remain parallel (side-by-side). */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* TYPE dropdown */}
                                <div className="space-y-2 min-w-0">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                        {t('reportTriageSelectAction')}
                                    </div>
                                    <div ref={typeBoxRef} className="relative">
                                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                            <button
                                                type="button"
                                                disabled={disabled || busy || deleting}
                                                onClick={() => {
                                                    setTypeOpen((o) => !o);
                                                    setStatusOpen(false);
                                                }}
                                                className="w-full min-h-[56px] px-4 text-left text-sm font-bold text-gray-900 flex items-center justify-between hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                <span className="line-clamp-1">{selectedTypeLabel}</span>
                                                <Icons.ChevronDown
                                                    size={20}
                                                    className={[
                                                        'text-gray-400 shrink-0 transition-transform',
                                                        typeOpen ? 'rotate-180' : 'rotate-0',
                                                    ].join(' ')}
                                                    aria-hidden
                                                />
                                            </button>

                                            {typeOpen ? (
                                                <div className="border-t border-gray-200 bg-white">
                                                    <div className="max-h-44 overflow-y-auto">
                                                        {typeOptions.map((opt) => {
                                                            const selected = selectedType === opt.value;
                                                            const disabledBtn = disabled || busy || deleting;
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    disabled={disabledBtn}
                                                                    onClick={() => {
                                                                        setType(opt.value);
                                                                    }}
                                                                    className={[
                                                                        'w-full px-4 py-3 text-sm font-bold text-left',
                                                                        selected ? 'bg-black text-white hover:bg-black' : 'bg-white text-gray-900 hover:bg-gray-50',
                                                                        disabledBtn ? 'opacity-50 cursor-not-allowed' : '',
                                                                    ].join(' ')}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                {/* STATUS dropdown */}
                                <div className="space-y-2 min-w-0">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                        {t('status')}
                                    </div>
                                    <div ref={statusBoxRef} className="relative">
                                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                            <button
                                                type="button"
                                                disabled={disabled || busy || deleting || !selectedType}
                                                onClick={() => {
                                                    setStatusOpen((o) => !o);
                                                    setTypeOpen(false);
                                                }}
                                                className="w-full min-h-[56px] px-4 text-left text-sm font-bold text-gray-900 flex items-center justify-between hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                <span className="line-clamp-1">{selectedStatusLabel}</span>
                                                <Icons.ChevronDown
                                                    size={20}
                                                    className={[
                                                        'text-gray-400 shrink-0 transition-transform',
                                                        statusOpen ? 'rotate-180' : 'rotate-0',
                                                    ].join(' ')}
                                                    aria-hidden
                                                />
                                            </button>

                                            {statusOpen ? (
                                                <div className="border-t border-gray-200 bg-white">
                                                    <div className="max-h-44 overflow-y-auto">
                                                        {statusOptions.map((opt) => {
                                                            const selected = selectedStatus === opt.value;
                                                            const disabledBtn =
                                                                disabled ||
                                                                busy ||
                                                                deleting ||
                                                                (selectedType === 'accept' && !onProgress && opt.value !== 'active');
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    disabled={disabledBtn}
                                                                    onClick={() => {
                                                                        setSelectedStatus(opt.value);
                                                                        setStatusOpen(false);
                                                                    }}
                                                                    className={[
                                                                        'w-full px-4 py-3 text-sm font-bold text-left',
                                                                        selected ? 'bg-black text-white hover:bg-black' : 'bg-white text-gray-900 hover:bg-gray-50',
                                                                        disabledBtn ? 'opacity-50 cursor-not-allowed' : '',
                                                                    ].join(' ')}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {footerVariant === 'history' ? (
                                <div className="flex gap-2 pt-1">
                                    {canDelete ? (
                                        <button
                                            type="button"
                                            disabled={busy || deleting}
                                            onClick={() => void handleDelete()}
                                            className="flex-1 min-h-[48px] items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-bold text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50"
                                        >
                                            {t('deleteRecord')}
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        disabled={!canSave}
                                        onClick={() => void handleSave()}
                                        className="flex-1 min-h-[48px] items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white shadow-sm hover:bg-gray-900 disabled:opacity-50 disabled:hover:bg-black"
                                    >
                                        {t('save')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2 pt-1">
                                    <button
                                        type="button"
                                        disabled={busy || deleting}
                                        onClick={handleClose}
                                        className="flex-1 min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-4 text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-200 disabled:opacity-50"
                                    >
                                        {t('close')}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canSave}
                                        onClick={() => void handleSave()}
                                        className="flex-1 min-h-[48px] items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white shadow-sm hover:bg-gray-900 disabled:opacity-50 disabled:hover:bg-black"
                                    >
                                        {t('save')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportTriageBarV2;

