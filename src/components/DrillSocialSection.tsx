import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icon';
import type { DrillSession } from '../types';
import { DRILL_REACTIONS } from '../types';
import { fetchDrillComments, addDrillComment, updateDrillComment, deleteDrillComment, fetchDrillReactions, setDrillReaction, getDrillShareUrl, getUserId } from '../services/api';
import type { DrillComment, DrillReaction } from '../types';

interface DrillSocialSectionProps {
    drill: DrillSession;
    t: (key: string) => string;
    onShareSuccess?: (message: string) => void;
    /** When provided, clicking Comment in compact mode opens the drill modal */
    onOpenDrill?: (drill: DrillSession) => void;
    /** Compact mode: show only counts + share (for cards) */
    compact?: boolean;
    /** Current user id for edit/delete checks */
    currentUserId?: string | number;
}

/** Share URLs for social platforms */
const getShareUrls = (url: string, title: string, text: string) => {
    const enc = encodeURIComponent;
    return {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
        telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`,
        whatsapp: `https://wa.me/?text=${enc(`${title} ${url}`)}`,
        signal: `https://signal.me/#share?url=${enc(url)}`,
        twitter: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`,
    };
};

/** GIF icon - Facebook-style badge (letters in rounded square) */
const GifIcon = () => (
    <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-1.5 py-0.5 rounded-[4px]">GIF</span>
);

/** Facebook-style social section: Reactions, Comments, Share */
export const DrillSocialSection: React.FC<DrillSocialSectionProps> = ({
    drill,
    t,
    onShareSuccess,
    onOpenDrill,
    compact = false,
    currentUserId,
}) => {
    const [comments, setComments] = useState<DrillComment[]>([]);
    const [reactionCounts, setReactionCounts] = useState<Record<DrillReaction, number>>({
        like: 0, love: 0, smile: 0, laugh: 0, sad: 0, cry: 0,
    });
    const [totalReactions, setTotalReactions] = useState(0);
    const [userReaction, setUserReaction] = useState<DrillReaction | null>(null);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [shareCount, setShareCount] = useState(0);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    /** In full (modal) mode, show composer by default so user can type immediately */
    const [showCommentComposer, setShowCommentComposer] = useState(!compact);
    const [shareUrl, setShareUrl] = useState('');
    const reactionPickerRef = useRef<HTMLDivElement>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);
    const shareCountKey = `safesphere-drill-share-count-${drill.id}`;

    useEffect(() => {
        fetchDrillComments(drill.id).then(setComments);
        fetchDrillReactions(drill.id).then(({ counts, total, userReaction: r }) => {
            setReactionCounts(counts);
            setTotalReactions(total);
            setUserReaction(r);
        });
    }, [drill.id]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
                setShowReactionPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (showCommentComposer) {
            setTimeout(() => commentInputRef.current?.focus(), 50);
        }
    }, [showCommentComposer]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(shareCountKey);
            setShareCount(raw ? Number(raw) || 0 : 0);
        } catch {
            setShareCount(0);
        }
    }, [shareCountKey]);

    const incrementShareCount = () => {
        setShareCount(prev => {
            const next = prev + 1;
            try {
                localStorage.setItem(shareCountKey, String(next));
            } catch {
                // Ignore storage errors and keep UI responsive.
            }
            return next;
        });
    };

    const handleReaction = async (reaction: DrillReaction) => {
        const next = userReaction === reaction ? null : reaction;
        const res = await setDrillReaction(drill.id, next);
        setReactionCounts(res.counts);
        setTotalReactions(res.total);
        setUserReaction(res.userReaction);
        setShowReactionPicker(false);
    };

    const handleAddComment = async (e?: React.FormEvent) => {
        e?.preventDefault();
        e?.stopPropagation();
        const content = newComment.trim();
        if (!content || submitting) return;
        setSubmitting(true);
        try {
            const updated = await addDrillComment(drill.id, content);
            setComments(updated);
            setNewComment('');
            commentInputRef.current?.focus();
        } catch (err) {
            console.error('Failed to add comment:', err);
            onShareSuccess?.((t('commentFailed') || 'Failed to post comment. Try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    const copyToClipboard = (text: string): boolean => {
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(text);
                return true;
            }
        } catch { /* fallback */ }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        } catch { /* ignore */ }
        document.body.removeChild(textarea);
        return ok;
    };

    const handleShareClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const url = getDrillShareUrl(drill.id);
        setShareUrl(url);
        setShowShareModal(true);
    };

    const handleCopyFromModal = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const ok = copyToClipboard(shareUrl);
        if (ok) {
            incrementShareCount();
            onShareSuccess?.((t('shareLinkCopied') || 'Link copied!'));
            setShowShareModal(false);
        }
    };

    const handleNativeShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const url = getDrillShareUrl(drill.id);
        try {
            if (navigator.share) {
                await navigator.share({
                    title: drill.title,
                    text: (t('shareCourseText') || 'Check out this course on SafeSphere').replace('{title}', drill.title),
                    url,
                });
                incrementShareCount();
                onShareSuccess?.((t('sharedSuccessfully') || 'Shared successfully!'));
                setShowShareModal(false);
            }
        } catch {
            handleCopyFromModal(e);
        }
    };

    const openShareWindow = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
        incrementShareCount();
        setShowShareModal(false);
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return t('justNow') || 'Just now';
        if (diff < 3600000) return t('minAgo') || 'min ago';
        if (diff < 86400000) return t('hourAgo') || 'hour ago';
        return d.toLocaleDateString();
    };

    const userReactionEmoji = userReaction ? DRILL_REACTIONS.find(r => r.type === userReaction)?.emoji : null;
    const shareText = (t('shareCourseText') || 'Check out this course on SafeSphere').replace('{title}', drill.title);
    const shareUrls = shareUrl ? getShareUrls(shareUrl, drill.title, shareText) : null;

    /** Common emojis for quick insert */
    const EMOJI_LIST = ['😀', '😊', '😂', '❤️', '👍', '🎉', '🔥', '🙏', '😢', '😍', '👏', '💪', '✨', '🙌', '😎'];

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showStickerPicker, setShowStickerPicker] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const gifPickerRef = useRef<HTMLDivElement>(null);
    const stickerPickerRef = useRef<HTMLDivElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const insertEmoji = (emoji: string) => {
        setNewComment(prev => prev + emoji);
        commentInputRef.current?.focus();
    };

    const GIF_LIST = [
        { label: 'Thumbs up', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
        { label: 'Celebration', url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif' },
        { label: 'Great', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif' },
        { label: 'Approved', url: 'https://media.giphy.com/media/26BRQTezZrKak4BeE/giphy.gif' },
        { label: 'Nice', url: 'https://media.giphy.com/media/3oz8xAFtqoOUUrsh7W/giphy.gif' },
    ];

    const STICKER_LIST = ['🎉', '🔥', '👏', '💪', '✅', '💯', '🚨', '🛟', '🧯', '🏆', '🙌', '⭐'];

    const insertGif = (gifUrl: string) => {
        setNewComment(prev => `${prev}${prev ? ' ' : ''}${gifUrl}`);
        setShowGifPicker(false);
        commentInputRef.current?.focus();
    };

    const insertSticker = (sticker: string) => {
        setNewComment(prev => `${prev}${prev ? ' ' : ''}${sticker}`);
        setShowStickerPicker(false);
        commentInputRef.current?.focus();
    };

    const handleCameraPick = (file?: File | null) => {
        if (!file) return;
        const token = `[Photo: ${file.name}]`;
        setNewComment(prev => `${prev}${prev ? ' ' : ''}${token}`);
        onShareSuccess?.(t('photoAttached') || 'Photo added to your comment.');
        commentInputRef.current?.focus();
    };

    // GIF URL parsing:
    // - `gifGlobalRe` is used for splitting a mixed comment into text + gif-url parts.
    // - `GIF_URL_WITH_TRAILING_PUNCTUATION_RE` allows cases like "...gif)." so we still embed the gif.
    const GIF_URL_GLOBAL_RE = /(https?:\/\/[^\s]+\.gif(?:\?[^\s]*)?)/gi;
    const GIF_URL_ONLY_RE = /^(https?:\/\/[^\s]+\.gif(?:\?[^\s]*)?)$/i;
    const GIF_URL_WITH_TRAILING_PUNCTUATION_RE =
        /^(https?:\/\/[^\s]+\.gif(?:\?[^\s]*)?)([),.?!]*)$/i;

    const renderCommentContent = (content: string, opts?: { compact?: boolean }) => {
        const trimmed = content.trim();
        if (!trimmed) return null;

        // Sticker-only: make it feel like a "sticker reaction".
        if (STICKER_LIST.includes(trimmed)) {
            const fontClass = opts?.compact ? 'text-xl' : 'text-2xl';
            return (
                <span
                    className={`inline-flex items-center justify-center ${fontClass} px-3 py-1.5 rounded-2xl bg-white/70 border border-gray-200 shadow-sm`}
                >
                    {trimmed}
                </span>
            );
        }

        // GIF-only: embed the gif.
        const gifOnlyMatch = trimmed.match(GIF_URL_WITH_TRAILING_PUNCTUATION_RE);
        if (gifOnlyMatch && GIF_URL_ONLY_RE.test(gifOnlyMatch[1]) && !trimmed.match(/\s/)) {
            return (
                <img
                    src={gifOnlyMatch[1]}
                    alt="GIF"
                    className={
                        opts?.compact
                            ? 'max-w-[160px] max-h-[130px] object-contain rounded-lg border border-gray-200 bg-white/70 shadow-sm'
                            : 'max-w-[260px] max-h-[220px] object-contain rounded-lg border border-gray-200 bg-white/70 shadow-sm'
                    }
                    loading="eager"
                    referrerPolicy="no-referrer"
                />
            );
        }

        // Mixed content: replace any gif URLs with embedded images.
        const gifGlobalRe = new RegExp(GIF_URL_GLOBAL_RE.source, 'gi'); // avoid global-regex state issues
        const parts = content.split(gifGlobalRe);
        return (
            <span className="inline">
                {parts.map((part, idx) => {
                    if (!part) return null;
                    const gifMatch = part.match(GIF_URL_WITH_TRAILING_PUNCTUATION_RE);
                    if (gifMatch && GIF_URL_ONLY_RE.test(gifMatch[1])) {
                        const url = gifMatch[1];
                        const trailing = gifMatch[2];
                        return (
                            <React.Fragment key={`${idx}-${part}`}>
                                <img
                                    src={url}
                                    alt="GIF"
                                    className={
                                        opts?.compact
                                            ? 'inline-block max-w-[140px] max-h-[110px] object-contain align-middle rounded-lg mx-1 border border-gray-200 bg-white/70 shadow-sm'
                                            : 'inline-block max-w-[220px] max-h-[180px] object-contain align-middle rounded-lg mx-1 border border-gray-200 bg-white/70 shadow-sm'
                                    }
                                    loading="eager"
                                    referrerPolicy="no-referrer"
                                />
                                {trailing ? <span>{trailing}</span> : null}
                            </React.Fragment>
                        );
                    }
                    return (
                        <span key={`${idx}-${part}`}>
                            {part}
                        </span>
                    );
                })}
            </span>
        );
    };

    const handleEditComment = async (commentId: string) => {
        const content = editContent.trim();
        if (!content) return;
        try {
            const updated = await updateDrillComment(drill.id, commentId, content);
            setComments(updated);
            setEditingCommentId(null);
            setEditContent('');
        } catch (err) {
            console.error('Failed to edit comment:', err);
            onShareSuccess?.((t('commentFailed') || 'Failed to update comment. Try again.'));
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            const updated = await deleteDrillComment(drill.id, commentId);
            setComments(updated);
            setEditingCommentId(null);
        } catch (err) {
            console.error('Failed to delete comment:', err);
            onShareSuccess?.((t('commentFailed') || 'Failed to delete comment. Try again.'));
        }
    };

    const startEdit = (c: DrillComment) => {
        setEditingCommentId(c.id);
        setEditContent(c.content);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
            if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
                setShowGifPicker(false);
            }
            if (stickerPickerRef.current && !stickerPickerRef.current.contains(e.target as Node)) {
                setShowStickerPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /** Facebook-style comment composer: single pill container, text + icons + send */
    const CommentComposer = ({ isCompact = false }: { isCompact?: boolean }) => (
        <div className="relative" dir="ltr" lang="en">
            <form onSubmit={handleAddComment} className="bg-[#f0f2f5] rounded-[20px] px-4 py-3 flex flex-col gap-2 min-h-[52px]">
                <input
                    ref={commentInputRef}
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder={t('addCommentPlaceholder') || 'Write a comment...'}
                    className="w-full bg-transparent text-gray-800 placeholder-gray-500 text-[15px] focus:outline-none min-h-[24px] py-1 comment-input-ltr"
                    dir="ltr"
                    lang="en"
                    maxLength={500}
                    autoComplete="off"
                    aria-label={t('addCommentPlaceholder') || 'Write a comment'}
                    tabIndex={0}
                    autoFocus
                />
                <div className="flex items-center justify-between gap-1 -mb-1">
                    <div className="flex items-center gap-0.5 relative">
                        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-full hover:bg-gray-300/50 text-gray-500" title={t('emoji') || 'Emoji'} aria-label="Emoji">
                            <Icons.Smile size={20} strokeWidth={1.5} />
                        </button>
                        {showEmojiPicker && (
                            <div ref={emojiPickerRef} className="absolute bottom-full left-0 mb-1 p-2 bg-white rounded-xl shadow-lg border border-gray-200 z-50 grid grid-cols-5 gap-1">
                                {EMOJI_LIST.map(emoji => (
                                    <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="text-xl hover:bg-gray-100 rounded p-1">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            aria-label={t('camera') || 'Camera'}
                            title={t('camera') || 'Camera'}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                handleCameraPick(file);
                                e.currentTarget.value = '';
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="p-2 rounded-full hover:bg-gray-300/50 text-gray-500"
                            title={t('camera') || 'Camera'}
                            aria-label="Camera"
                        >
                            <Icons.Camera size={20} strokeWidth={1.5} />
                        </button>
                        <div className="relative" ref={gifPickerRef}>
                            <button
                                type="button"
                                onClick={() => setShowGifPicker(!showGifPicker)}
                                className="p-2 rounded-full hover:bg-gray-300/50 text-gray-500 flex items-center"
                                title="GIF"
                                aria-label="GIF"
                            >
                                <GifIcon />
                            </button>
                            {showGifPicker && (
                                <div className="absolute bottom-full left-0 mb-1 p-2 bg-white rounded-xl shadow-lg border border-gray-200 z-50 w-56">
                                    <p className="text-[11px] font-semibold text-gray-500 mb-1">Trending GIFs</p>
                                    <div className="grid grid-cols-1 gap-1 max-h-44 overflow-y-auto">
                                        {GIF_LIST.map(gif => (
                                            <button
                                                key={gif.url}
                                                type="button"
                                                onClick={() => insertGif(gif.url)}
                                                className="text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100"
                                            >
                                                {gif.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="relative" ref={stickerPickerRef}>
                            <button
                                type="button"
                                onClick={() => setShowStickerPicker(!showStickerPicker)}
                                className="p-2 rounded-full hover:bg-gray-300/50 text-gray-500"
                                title="Sticker"
                                aria-label="Sticker"
                            >
                                <Icons.Sticker size={20} strokeWidth={1.5} />
                            </button>
                            {showStickerPicker && (
                                <div className="absolute bottom-full left-0 mb-1 p-2 bg-white rounded-xl shadow-lg border border-gray-200 z-50 grid grid-cols-4 gap-1">
                                    {STICKER_LIST.map(sticker => (
                                        <button key={sticker} type="button" onClick={() => insertSticker(sticker)} className="text-xl hover:bg-gray-100 rounded p-1">
                                            {sticker}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!newComment.trim() || submitting}
                        className="p-2 rounded-full bg-white hover:bg-gray-100 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm -mr-1 shrink-0"
                        title={t('send') || 'Send'}
                        aria-label={t('send') || 'Send'}
                    >
                        <Icons.Send size={20} strokeWidth={1.5} />
                    </button>
                </div>
            </form>
        </div>
    );

    /** Share modal content - used in both compact and full */
    const ShareModalContent = () => (
        <>
            <h4 className="font-bold text-lg mb-2">{t('share') || 'Share'}</h4>
            <p className="text-sm text-gray-600 mb-4">{drill.title}</p>
            <div className="space-y-2">
                <button type="button" onClick={handleCopyFromModal} className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center gap-2 font-medium text-gray-800">
                    <Icons.Link size={18} />
                    {t('copyLink') || 'Copy link'}
                </button>
                {navigator.share && (
                    <button type="button" onClick={handleNativeShare} className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center gap-2 font-medium text-gray-800">
                        <Icons.Share size={18} />
                        {t('shareVia') || 'Share via...'}
                    </button>
                )}
                {shareUrls && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <button type="button" onClick={() => openShareWindow(shareUrls.facebook)} className="py-3 px-4 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl flex items-center justify-center gap-2 font-medium text-sm">
                            <FacebookIcon size={20} />
                            Facebook
                        </button>
                        <button type="button" onClick={() => openShareWindow(shareUrls.telegram)} className="py-3 px-4 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl flex items-center justify-center gap-2 font-medium text-sm">
                            <TelegramIcon size={20} />
                            Telegram
                        </button>
                        <button type="button" onClick={() => openShareWindow(shareUrls.whatsapp)} className="py-3 px-4 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl flex items-center justify-center gap-2 font-medium text-sm">
                            <WhatsAppIcon size={20} />
                            WhatsApp
                        </button>
                        <button type="button" onClick={() => openShareWindow(shareUrls.signal)} className="py-3 px-4 bg-[#3A76F0] hover:bg-[#2E6AE0] text-white rounded-xl flex items-center justify-center gap-2 font-medium text-sm">
                            <SignalIcon size={20} />
                            Signal
                        </button>
                        <button type="button" onClick={() => openShareWindow(shareUrls.twitter)} className="py-3 px-4 bg-black hover:bg-gray-900 text-white rounded-xl flex items-center justify-center gap-2 font-medium text-sm col-span-2">
                            <XTwitterIcon size={20} />
                            X (Twitter)
                        </button>
                    </div>
                )}
            </div>
            <button type="button" onClick={() => setShowShareModal(false)} className="w-full mt-4 py-2 text-gray-500 text-sm">{t('cancel') || 'Cancel'}</button>
        </>
    );

    if (compact) {
        return (
            <>
                <div className="flex items-center justify-around border-t border-b border-gray-100 -mx-2 mt-2" onClick={e => e.stopPropagation()}>
                    <div className="relative flex-1 flex justify-center" ref={reactionPickerRef}>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowReactionPicker(!showReactionPicker); }}
                            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors flex-1 ${userReaction ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'}`}
                            title={t('like') || 'Like'}
                        >
                            {userReactionEmoji ? (
                                <span className="text-lg">{userReactionEmoji}</span>
                            ) : (
                                <span className="inline-flex text-gray-400" aria-hidden>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M10.43 3.12a1 1 0 0 1 1.24.66l.66 2.08c.22.69.2 1.44-.05 2.11L11.4 10H19a2 2 0 0 1 1.95 2.45l-1.23 5A3 3 0 0 1 16.8 20H9a3 3 0 0 1-3-3v-6.5a3 3 0 0 1 .88-2.12l2.9-2.9a1 1 0 0 0 .23-1.03l-.24-.75a1 1 0 0 1 .66-1.24zM4 10h1v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" />
                                    </svg>
                                </span>
                            )}
                            <span className="text-sm font-medium">{t('like') || 'Like'}</span>
                        </button>
                        {showReactionPicker && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex gap-1 bg-white rounded-full shadow-lg border border-gray-200 px-3 py-2 z-50">
                                {DRILL_REACTIONS.map(r => (
                                    <button key={r.type} type="button" onClick={(e) => { e.stopPropagation(); handleReaction(r.type); }} className="text-xl hover:scale-125 transition-transform p-1" title={r.label}>{r.emoji}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenDrill) onOpenDrill(drill);
                            else setShowCommentComposer(!showCommentComposer);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors ${showCommentComposer ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'}`}
                        title={t('comment') || 'Comment'}
                    >
                        <Icons.Chat size={18} />
                        <span className="text-sm font-medium">{t('comment') || 'Comment'} ({comments.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleShareClick}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                        title={t('share') || 'Share'}
                    >
                        <Icons.Share size={18} />
                        <span className="text-sm font-medium">{t('share') || 'Share'} ({shareCount})</span>
                    </button>
                </div>
                <div className="px-1 text-xs text-gray-500 flex items-center gap-2 mt-1">
                    <span>{comments.length} {t('comments') || 'Comments'}</span>
                    <span>•</span>
                    <span>{shareCount} {t('share') || 'Share'}</span>
                </div>
                {showCommentComposer && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3" onClick={e => e.stopPropagation()}>
                        <CommentComposer isCompact />
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {comments.map(c => (
                                <div key={c.id} className="flex gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs">{(c.userName || 'A')[0].toUpperCase()}</div>
                                    <div className="flex-1 min-w-0">
                                        {editingCommentId === c.id ? (
                                            <div className="space-y-1">
                                                <input type="text" value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs comment-input-ltr" dir="ltr" placeholder={t('addCommentPlaceholder') || 'Write a comment...'} aria-label={t('edit') || 'Edit comment'} autoFocus />
                                                <div className="flex gap-1">
                                                    <button type="button" onClick={() => handleEditComment(c.id)} className="px-2 py-1 bg-blue-600 text-white text-xs rounded">{t('updateComment') || 'Update'}</button>
                                                    <button type="button" onClick={() => { setEditingCommentId(null); setEditContent(''); }} className="px-2 py-1 bg-gray-200 text-xs rounded">{t('cancelEdit') || 'Cancel edit'}</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-gray-100 rounded-xl rounded-tl-none px-2 py-1.5">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-xs font-semibold text-gray-800">{c.userName}</span>
                                                    {String(currentUserId ?? getUserId()) === String(c.userId) && (
                                                        <div className="flex gap-0.5">
                                                            <button type="button" onClick={() => startEdit(c)} className="p-1 rounded hover:bg-blue-100 text-blue-600" title={t('edit') || 'Edit'}><Icons.Edit size={12} /></button>
                                                            <button type="button" onClick={() => handleDeleteComment(c.id)} className="p-1 rounded hover:bg-red-100 text-red-600" title={t('delete') || 'Delete'}><Icons.Trash size={12} /></button>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-700">
                                                    {renderCommentContent(c.content, { compact: true })}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {showShareModal && (
                    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
                        <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <ShareModalContent />
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-around border-t border-b border-gray-100 -mx-2 -mb-2">
                <div className="relative flex-1 flex justify-center" ref={reactionPickerRef}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setShowReactionPicker(!showReactionPicker); }} className={`flex items-center gap-2 py-3 px-4 rounded-lg transition-colors flex-1 justify-center ${userReaction ? 'text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title={t('like') || 'Like'}>
                        <span className="text-lg">{userReactionEmoji || '👍'}</span>
                        <span className="text-sm font-medium">{totalReactions ? `${totalReactions}` : (t('like') || 'Like')}</span>
                    </button>
                    {showReactionPicker && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex gap-1 bg-white rounded-full shadow-lg border border-gray-200 px-3 py-2 z-50">
                            {DRILL_REACTIONS.map(r => (
                                <button key={r.type} type="button" onClick={(e) => { e.stopPropagation(); handleReaction(r.type); }} className="text-xl hover:scale-125 transition-transform p-1" title={r.label}>{r.emoji}</button>
                            ))}
                        </div>
                    )}
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowCommentComposer(!showCommentComposer); }} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors ${showCommentComposer ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <Icons.Chat size={18} />
                    <span className="text-sm font-medium">{t('comment') || 'Comment'} ({comments.length})</span>
                </button>
                <button type="button" onClick={handleShareClick} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
                    <Icons.Share size={18} />
                    <span className="text-sm font-medium">{t('share') || 'Share'} ({shareCount})</span>
                </button>
            </div>
            <div className="px-1 text-xs text-gray-500 flex items-center gap-2 -mt-1">
                <span>{comments.length} {t('comments') || 'Comments'}</span>
                <span>•</span>
                <span>{shareCount} {t('share') || 'Share'}</span>
            </div>

            {showCommentComposer && (
                <div className="bg-gray-50 rounded-xl p-3">
                    <CommentComposer />
                </div>
            )}

            <div className="space-y-3 max-h-48 overflow-y-auto">
                {comments.length === 0 && <p className="text-sm text-gray-400 italic py-2">{t('noCommentsYet') || 'No comments yet. Be the first!'}</p>}
                {comments.map(c => (
                    <div key={c.id} className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold text-sm">{(c.userName || 'A')[0].toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                            {editingCommentId === c.id ? (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg text-sm comment-input-ltr"
                                        dir="ltr"
                                        placeholder={t('addCommentPlaceholder') || 'Write a comment...'}
                                        aria-label={t('edit') || 'Edit comment'}
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => handleEditComment(c.id)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg">
                                            {t('updateComment') || 'Update'}
                                        </button>
                                        <button type="button" onClick={() => { setEditingCommentId(null); setEditContent(''); }} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg">
                                            {t('cancelEdit') || 'Cancel edit'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-100 rounded-2xl rounded-tl-none px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-gray-800">{c.userName}</p>
                                        {String(currentUserId ?? getUserId()) === String(c.userId) && (
                                            <div className="flex gap-1 shrink-0">
                                                <button type="button" onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600" title={t('edit') || 'Edit'} aria-label={t('edit') || 'Edit'}>
                                                    <Icons.Edit size={14} />
                                                </button>
                                                <button type="button" onClick={() => handleDeleteComment(c.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600" title={t('delete') || 'Delete'} aria-label={t('delete') || 'Delete'}>
                                                    <Icons.Trash size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-700">
                                        {renderCommentContent(c.content)}
                                    </p>
                                    <span className="text-xs text-gray-400">{formatDate(c.updatedAt || c.createdAt)}{c.updatedAt ? ` (${t('edited') || 'edited'})` : ''}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {showShareModal && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
                    <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <ShareModalContent />
                    </div>
                </div>
            )}
        </div>
    );
};

/** Platform icons for share modal */
const FacebookIcon = ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
);
const TelegramIcon = ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
);
const WhatsAppIcon = ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
);
const SignalIcon = ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm-1 4v6h2V6h-2zm0 8v2h2v-2h-2z" /></svg>
);
const XTwitterIcon = ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
);
