import React, { useCallback, useState } from 'react';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { SuccessToast } from './SuccessToast';
import type { IncidentReport } from '../types';

export type ReportTriageKind = 'accept' | 'delay' | 'reject';

export type ReportProgressStep = 'en_route' | 'on_scene' | 'completed';

export interface ReportTriageBarProps {
    /** Current report status — drives which buttons are shown (Report_UI_Layout.md). */
    status: IncidentReport['status'];
    /** NEW queue: Accept | Delay | Reject */
    onTriage: (action: ReportTriageKind, note?: string) => Promise<void>;
    /** ACCEPTED → EN_ROUTE → ON_SCENE → COMPLETED */
    onProgress?: (step: ReportProgressStep, note?: string) => Promise<void>;
    /** Closed reports: reopen as accepted (active). */
    onReopen?: (note?: string) => Promise<void>;
    disabled?: boolean;
    className?: string;
}

type ResponderUiMode = 'incoming' | 'accepted' | 'en_route' | 'on_scene' | 'terminal';

function getResponderUiMode(status: string): ResponderUiMode {
    const s = (status || '').toLowerCase();
    if (s === 'pending' || s === 'info_requested' || s === 'delayed') return 'incoming';
    if (s === 'active' || s === 'approved') return 'accepted';
    if (s === 'en_route') return 'en_route';
    if (s === 'on_scene') return 'on_scene';
    return 'terminal';
}

/**
 * Report_UI_Layout.md §5–6: direct action buttons (no Manage toggle).
 * NEW → row Accept | Delay | Reject; ACCEPTED → En route; EN_ROUTE → On scene; ON_SCENE → Complete.
 */
const ReportTriageBar: React.FC<ReportTriageBarProps> = ({
    status,
    onTriage,
    onProgress,
    onReopen,
    disabled = false,
    className = '',
}) => {
    const { t } = useLanguage();
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const mode = getResponderUiMode(status);

    const showSavedSuccessfully = useCallback(() => {
        setSuccessMessage(t('triageLatestChangesSaved'));
    }, [t]);

    const trimmedNote = () => {
        const x = note.trim();
        return x || undefined;
    };

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

    const needsProgress =
        mode === 'accepted' || mode === 'en_route' || mode === 'on_scene';
    if (mode === 'terminal' && !onReopen) return null;
    if (needsProgress && !onProgress) return null;

    const noteBlock = (
        <div className="space-y-1.5">
            <label htmlFor="responder-report-note" className="block text-xs font-bold uppercase tracking-wide text-gray-500">
                {t('reportTriageNotificationLabel')}
            </label>
            <textarea
                id="responder-report-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                disabled={busy}
                placeholder={t('reportTriageNotificationPlaceholder')}
                className="w-full resize-y rounded-lg border border-gray-300 p-3 text-sm focus:border-black focus:outline-none focus:ring-0"
            />
        </div>
    );

    return (
        <div className={className}>
            {successMessage && (
                <SuccessToast
                    message={successMessage}
                    onClose={() => setSuccessMessage(null)}
                    zIndexClass="z-[200]"
                />
            )}

            <p className="text-xs text-gray-500 mb-2">{t('responderReportActionsIntro')}</p>

            {mode === 'incoming' && (
                <div className="space-y-3">
                    {noteBlock}
                    <div
                        className="flex flex-row items-stretch overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm ring-1 ring-black/[0.04]"
                        role="group"
                        aria-label={t('reportTriageSelectAction')}
                    >
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void run(() => onTriage('accept', trimmedNote()))}
                            className="flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 border-r border-gray-200 bg-green-50/90 px-2 py-2.5 text-center text-xs font-bold text-green-900 transition-colors hover:bg-green-600 hover:text-white disabled:opacity-50 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm"
                        >
                            <Icons.CheckCircle size={18} className="shrink-0" />
                            <span className="leading-tight">{t('reportTriageAccept')}</span>
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void run(() => onTriage('delay', trimmedNote()))}
                            className="flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 border-r border-gray-200 bg-amber-50/90 px-2 py-2.5 text-center text-xs font-bold text-amber-950 transition-colors hover:bg-amber-500 hover:text-white disabled:opacity-50 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm"
                        >
                            <Icons.Clock size={18} className="shrink-0" />
                            <span className="leading-tight">{t('reportTriageDelay')}</span>
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void run(() => onTriage('reject', trimmedNote()))}
                            className="flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 bg-red-50/90 px-2 py-2.5 text-center text-xs font-bold text-red-900 transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm"
                        >
                            <Icons.X size={18} className="shrink-0" />
                            <span className="leading-tight">{t('reportTriageReject')}</span>
                        </button>
                    </div>
                </div>
            )}

            {mode === 'accepted' && onProgress && (
                <div className="space-y-3">
                    {noteBlock}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => onProgress('en_route', trimmedNote()))}
                        className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Icons.Navigation size={18} />
                        {t('reportTriageEnRoute')}
                    </button>
                </div>
            )}

            {mode === 'en_route' && onProgress && (
                <div className="space-y-3">
                    {noteBlock}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => onProgress('on_scene', trimmedNote()))}
                        className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Icons.MapPin size={18} />
                        {t('reportTriageOnScene')}
                    </button>
                </div>
            )}

            {mode === 'on_scene' && onProgress && (
                <div className="space-y-3">
                    {noteBlock}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => onProgress('completed', trimmedNote()))}
                        className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 text-sm font-bold text-white shadow-sm hover:bg-black disabled:opacity-50"
                    >
                        <Icons.CheckCircle size={18} />
                        {t('reportTriageMarkComplete')}
                    </button>
                </div>
            )}

            {mode === 'terminal' && onReopen && (
                <div className="space-y-3">
                    {noteBlock}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => onReopen(trimmedNote()))}
                        className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                    >
                        <Icons.Activity size={18} />
                        {t('reportTriageReopen')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReportTriageBar;
