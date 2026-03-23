import React, { useEffect, useMemo, useRef, useState } from 'react';

export type RichTextEditorVariant = 'title' | 'description';

interface RichTextEditorProps {
    value: string; // HTML string
    onChange: (nextHtml: string) => void;
    placeholder?: string;
    variant?: RichTextEditorVariant;
    disabled?: boolean;
}

const fontSizeMap: Record<string, string> = {
    small: '2',
    normal: '3',
    large: '5',
    xlarge: '6',
};

// Reuse the same SOS/emergency symbols used in the Chat UI.
const symbols = [
    '🆘',
    '⚠️',
    '🏥',
    '🚒',
    '💧',
    '🌍',
    '👍',
    '🏠',
    '🔌',
    '📵',
    '🤕',
    '🤐',
    '🚪',
    '🚰',
    '🍞',
    '☢️',
    '☠️',
    '🔫',
    '👮',
    '🚑',
    '🚨',
    '🛩️',
    '🌊',
    '⛽',
    '🏚️',
    '⛈️',
    '🌪️',
    '🩹',
    '🩸',
    '❤️‍🩹',
    '😵',
    '💊',
    '♿',
    '👶',
    '👴',
    '🏃',
    '✅',
    '⛔',
    '💥',
    '🌋',
    '🔥',
    '🌀',
    '❄️',
    '🌡️',
    '🗺️',
    '🐻',
    '🏊',
    '⚡',
    '🧣',
    '🙋',
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
    value,
    onChange,
    placeholder,
    variant = 'description',
    disabled = false,
}) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const lastSelectionRef = useRef<Range | null>(null);
    const [fontSizeValue, setFontSizeValue] = useState<'small' | 'normal' | 'large' | 'xlarge'>('normal');
    const [colorValue, setColorValue] = useState<string>('#111827'); // default: slate-900
    const [fontNameValue, setFontNameValue] = useState<string>('Arial');

    const isEmpty = useMemo(() => {
        const plain = value
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim();
        return plain.length === 0;
    }, [value]);

    const syncFromDom = () => {
        const el = editorRef.current;
        if (!el) return;
        const next = el.innerHTML;
        if (next !== value) onChange(next);
    };

    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        if (el.innerHTML !== value) {
            // Avoid cursor-jumps: only update when DOM differs from the controlled value.
            el.innerHTML = value;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const focusEditor = () => {
        editorRef.current?.focus({ preventScroll: true } as any);
    };

    const saveSelection = () => {
        const editor = editorRef.current;
        const sel = window.getSelection?.();
        if (!editor || !sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const anchorNode = sel.anchorNode;
        if (anchorNode && editor.contains(anchorNode)) {
            lastSelectionRef.current = range.cloneRange();
        }
    };

    const restoreSelection = () => {
        const sel = window.getSelection?.();
        const r = lastSelectionRef.current;
        if (!sel || !r) return;
        sel.removeAllRanges();
        sel.addRange(r);
    };

    const applyCommand = (cmd: string, arg?: string) => {
        if (disabled) return;
        restoreSelection();
        focusEditor();
        try {
            // eslint-disable-next-line deprecation/deprecation
            document.execCommand(cmd, false, arg);
        } catch {
            // ignore
        }
        // execCommand doesn't always trigger onInput reliably, so sync explicitly.
        syncFromDom();
    };

    const insertText = (text: string) => {
        if (disabled) return;
        restoreSelection();
        focusEditor();
        try {
            // eslint-disable-next-line deprecation/deprecation
            const ok = document.execCommand('insertText', false, text);
            if (!ok) throw new Error('insertText not supported');
        } catch {
            // Fallback: insert via selection range.
            const sel = window.getSelection?.();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
            syncFromDom();
        }
        syncFromDom();
    };

    return (
        <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 items-center">
                {variant === 'description' && (
                    <>
                        <button
                            type="button"
                            onClick={() => applyCommand('bold')}
                            disabled={disabled}
                            className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-70"
                            aria-label="Bold"
                            title="Bold"
                        >
                            B
                        </button>
                        <button
                            type="button"
                            onClick={() => applyCommand('italic')}
                            disabled={disabled}
                            className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs italic font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-70"
                            aria-label="Italic"
                            title="Italic"
                        >
                            I
                        </button>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold uppercase text-gray-500">Size</label>
                            <select
                                value={fontSizeValue}
                                onChange={(e) => {
                                    const next = e.target.value as typeof fontSizeValue;
                                    setFontSizeValue(next);
                                    applyCommand('fontSize', fontSizeMap[next] ?? fontSizeMap.normal);
                                }}
                                disabled={disabled}
                                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-gray-400 disabled:opacity-70"
                                aria-label="Font size"
                                title="Font size"
                            >
                                <option value="small">S</option>
                                <option value="normal">M</option>
                                <option value="large">L</option>
                                <option value="xlarge">XL</option>
                            </select>
                        </div>
                    </>
                )}

                {variant === 'description' && (
                    <button
                        type="button"
                        onClick={() => applyCommand('underline')}
                        disabled={disabled}
                        className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-70 underline"
                        aria-label="Underline"
                        title="Underline"
                    >
                        U
                    </button>
                )}

                {variant === 'description' && (
                    <>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold uppercase text-gray-500">Font</label>
                            <select
                                value={fontNameValue}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setFontNameValue(next);
                                    applyCommand('fontName', next);
                                }}
                                disabled={disabled}
                                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-gray-400 disabled:opacity-70"
                                aria-label="Font family"
                                title="Font family"
                            >
                                <option value="Arial">Arial</option>
                                <option value="Georgia">Georgia</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Courier New</option>
                                <option value="Verdana">Verdana</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold uppercase text-gray-500">Color</label>
                            <select
                                value={colorValue}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setColorValue(next);
                                    applyCommand('foreColor', next);
                                }}
                                disabled={disabled}
                                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-gray-400 disabled:opacity-70"
                                aria-label="Text colour"
                                title="Text colour"
                            >
                                <option value="#111827">Black</option>
                                <option value="#ef4444">Red</option>
                                <option value="#f97316">Orange</option>
                                <option value="#f59e0b">Amber</option>
                                <option value="#eab308">Yellow</option>
                                <option value="#22c55e">Green</option>
                                <option value="#3b82f6">Blue</option>
                                <option value="#4f46e5">Indigo</option>
                                <option value="#a855f7">Purple</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => applyCommand('justifyLeft')}
                                disabled={disabled}
                                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-70"
                                aria-label="Align left"
                                title="Align left"
                            >
                                ↤
                            </button>
                            <button
                                type="button"
                                onClick={() => applyCommand('justifyCenter')}
                                disabled={disabled}
                                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-70"
                                aria-label="Align centre"
                                title="Align centre"
                            >
                                ↔
                            </button>
                            <button
                                type="button"
                                onClick={() => applyCommand('justifyRight')}
                                disabled={disabled}
                                className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-70"
                                aria-label="Align right"
                                title="Align right"
                            >
                                ↦
                            </button>
                        </div>
                    </>
                )}
                <div className="flex items-center gap-1">
                    {variant === 'title' ? null : (
                        <div className="flex items-center gap-1">
                            {symbols.slice(0, 14).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => insertText(s)}
                                    disabled={disabled}
                                    className="w-9 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-lg disabled:opacity-70"
                                    title={`Insert ${s}`}
                                    aria-label={`Insert ${s}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Editor */}
            <div className="relative">
                {isEmpty && placeholder ? (
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 text-sm">
                        {placeholder}
                    </div>
                ) : null}
                <div
                    ref={editorRef}
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    onInput={() => syncFromDom()}
                    onMouseUp={() => saveSelection()}
                    onKeyUp={() => saveSelection()}
                    onFocus={() => saveSelection()}
                    onBlur={() => syncFromDom()}
                    className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-gray-400 transition-colors ${
                        variant === 'title'
                            ? 'min-h-[48px] max-h-[92px] overflow-y-auto'
                            : 'min-h-[160px] max-h-[70vh] resize-y overflow-auto'
                    }`}
                />
            </div>
        </div>
    );
};

