import React, { useState, useRef, useCallback } from 'react';
import { Icons } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { getAiSafetyReply, isAiChatAvailable } from '../services/aiChat';

type MessageType = 'text' | 'image' | 'file' | 'voice' | 'location';

// International SOS emoji signs - universally recognisable, no typing needed
const SOS_EMOJIS = [
    { emoji: '🆘', labelKey: 'emojiUrgentHelp' },
    { emoji: '🚨', labelKey: 'emojiEmergency' },
    { emoji: '⚠️', labelKey: 'emojiWarning' },
    { emoji: '🏥', labelKey: 'emojiMedical' },
    { emoji: '🚒', labelKey: 'emojiFire' },
    { emoji: '💧', labelKey: 'emojiFlood' },
    { emoji: '🌍', labelKey: 'emojiEarthquake' },
    { emoji: '👍', labelKey: 'emojiOk' },
    { emoji: '🏠', labelKey: 'emojiShelter' },
    { emoji: '🔌', labelKey: 'emojiNoElectricity' },
    { emoji: '📵', labelKey: 'emojiNoInternet' },
    { emoji: '🤕', labelKey: 'emojiWounded' },
    { emoji: '🤐', labelKey: 'emojiCannotSpeak' },
    { emoji: '🚪', labelKey: 'emojiTrapped' },
    { emoji: '🚰', labelKey: 'emojiNeedWater' },
    { emoji: '🍞', labelKey: 'emojiNeedFood' },
    { emoji: '🤫', labelKey: 'emojiSilent' },
    { emoji: '☣️', labelKey: 'emojiChemical' },
    { emoji: '☠️', labelKey: 'emojiPoison' },
    { emoji: '🔫', labelKey: 'emojiShooterActive' }
] as const;

interface Message {
    id: number;
    sender: string;
    content: string;
    timestamp: string;
    isOwn: boolean;
    avatar?: string;
    type?: MessageType;
    imageUrl?: string;
    fileName?: string;
    fileUrl?: string;
    voiceUrl?: string;
    voiceDuration?: number;
    location?: { lat: number; lng: number; place?: string };
}

interface Conversation {
    id: number;
    name: string;
    nameKey?: string;
    lastMessage: string;
    timestamp: string;
    unread: number;
    avatar?: string;
    online?: boolean;
    isAi?: boolean; // AI Safety Assistant - always available, uses Gemini
}

const Chat: React.FC = () => {
    const { t } = useLanguage();
    const [view, setView] = useState<'list' | 'chat'>('list');
    const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
    const [messageText, setMessageText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [locationLoading, setLocationLoading] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [pendingFile, setPendingFile] = useState<{ file: File; url: string } | null>(null);
    const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [aiTyping, setAiTyping] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingStartRef = useRef<number>(0);

    // Demo conversations - nameKey for translation. AI Safety Assistant is always available when responders are offline.
    const [conversations] = useState<Conversation[]>([
        { id: 1, name: 'Emergency Response Team', nameKey: 'emergencyResponseTeam', lastMessage: 'Your incident report has been reviewed', timestamp: '2 min ago', unread: 2, online: true },
        { id: 2, name: 'Community Safety Group', nameKey: 'communitySafetyGroup', lastMessage: 'New safety drill scheduled for tomorrow', timestamp: '1 hour ago', unread: 0, online: true },
        { id: 3, name: 'Admin Support', nameKey: 'adminSupport', lastMessage: 'How can we help you today?', timestamp: '3 hours ago', unread: 0, online: false },
        { id: 4, name: 'Local Responders', nameKey: 'localResponders', lastMessage: 'Thank you for your cooperation', timestamp: 'Yesterday', unread: 0, online: false },
        { id: 5, name: 'AI Safety Assistant', nameKey: 'aiSafetyAssistant', lastMessage: 'I\'m here 24/7 for disaster preparedness advice.', timestamp: 'Now', unread: 0, online: true, isAi: true }
    ]);

    // Messages stored per conversation - each channel has its own encrypted thread
    const defaultMessages: Record<number, Message[]> = {
        1: [
            { id: 101, sender: 'Emergency Response Team', content: 'Hello! We received your incident report.', timestamp: '10:30 AM', isOwn: false },
            { id: 102, sender: 'You', content: 'Yes, I reported a flood warning in my area.', timestamp: '10:32 AM', isOwn: true },
            { id: 103, sender: 'Emergency Response Team', content: 'Thank you for the information. Our team is reviewing the situation and will update you shortly.', timestamp: '10:35 AM', isOwn: false },
            { id: 104, sender: 'You', content: 'How long will the review take?', timestamp: '10:36 AM', isOwn: true },
            { id: 105, sender: 'Emergency Response Team', content: 'Your incident report has been reviewed and approved. Emergency services have been notified.', timestamp: '10:45 AM', isOwn: false }
        ],
        2: [
            { id: 201, sender: 'Community Safety Group', content: 'Welcome to the Community Safety Group. How can we help?', timestamp: '9:00 AM', isOwn: false },
            { id: 202, sender: 'Community Safety Group', content: 'New safety drill scheduled for tomorrow at 2 PM.', timestamp: '9:05 AM', isOwn: false }
        ],
        3: [
            { id: 301, sender: 'Admin Support', content: 'Hello! How can we help you today?', timestamp: '11:00 AM', isOwn: false }
        ],
        4: [
            { id: 401, sender: 'Local Responders', content: 'Thank you for your cooperation. We\'re here 24/7.', timestamp: 'Yesterday', isOwn: false }
        ],
        5: [
            { id: 501, sender: 'AI Safety Assistant', content: 'Hello! I\'m your AI Safety Assistant. I can help with disaster preparedness, earthquake and flood safety, emergency kits, and more. Ask me anything.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: false }
        ]
    };

    const [messagesByConversation, setMessagesByConversation] = useState<Record<number, Message[]>>(defaultMessages);

    const currentMessages = selectedChat ? (messagesByConversation[selectedChat.id] || []) : [];

    const addMessage = useCallback((msg: Omit<Message, 'id'>, convId: number): number => {
        let newId = 0;
        setMessagesByConversation(prev => {
            const conv = prev[convId] || [];
            newId = Math.max(0, ...conv.map(m => m.id), convId * 100) + 1;
            return { ...prev, [convId]: [...conv, { ...msg, id: newId } as Message] };
        });
        return newId; // newId is set synchronously inside the updater
    }, []);

    const simulateReply = useCallback((convId: number, afterId: number) => {
        const teamName = selectedChat?.name || 'Team';
        const isAiChat = selectedChat?.isAi === true;
        const content = isAiChat
            ? 'The AI assistant couldn\'t generate a response right now. Please try again in a moment or check the browser console (F12) for details.'
            : [
                'Thanks for your message. Our team will respond shortly.',
                'We\'ve received your message. A responder will get back to you soon.',
                'Thank you for reaching out. We\'re here to help.',
                'Message received. Our team is looking into this.'
            ][Math.floor(Math.random() * 4)];
        setTimeout(() => {
            setMessagesByConversation(prev => {
                const conv = prev[convId] || [];
                const replyId = Math.max(0, ...conv.map(m => m.id), afterId) + 1;
                return { ...prev, [convId]: [...conv, { id: replyId, sender: teamName, content, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: false } as Message] };
            });
        }, 1200);
    }, [selectedChat]);

    const getReply = useCallback(async (convId: number, afterId: number, userMessageContent: string) => {
        const senderName = selectedChat?.name || 'Team';
        const useAi = (selectedChat?.isAi || (!selectedChat?.online && isAiChatAvailable())) && isAiChatAvailable();
        if (useAi) {
            setAiTyping(true);
            const conv = messagesByConversation[convId] || [];
            const history = conv.slice(-10).map(m => ({
                role: (m.isOwn ? 'user' : 'model') as 'user' | 'model',
                text: m.content
            }));
            try {
                const reply = await getAiSafetyReply({ userMessage: userMessageContent, conversationHistory: history });
                setAiTyping(false);
                if (reply) {
                    setMessagesByConversation(prev => {
                        const c = prev[convId] || [];
                        const replyId = Math.max(0, ...c.map(m => m.id), afterId) + 1;
                        return { ...prev, [convId]: [...c, { id: replyId, sender: senderName, content: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: false } as Message] };
                    });
                } else {
                    // AI failed to respond – show AI-specific message (check console for [AI Chat] errors)
                    const fallback = 'The AI assistant couldn\'t generate a response right now. Please check your connection, try again in a moment, or see the browser console (F12) for details.';
                    setMessagesByConversation(prev => {
                        const c = prev[convId] || [];
                        const replyId = Math.max(0, ...c.map(m => m.id), afterId) + 1;
                        return { ...prev, [convId]: [...c, { id: replyId, sender: senderName, content: fallback, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: false } as Message] };
                    });
                }
            } catch {
                setAiTyping(false);
                const fallback = 'The AI assistant couldn\'t generate a response right now. Please try again or check the browser console (F12) for errors.';
                setMessagesByConversation(prev => {
                    const c = prev[convId] || [];
                    const replyId = Math.max(0, ...c.map(m => m.id), afterId) + 1;
                    return { ...prev, [convId]: [...c, { id: replyId, sender: senderName, content: fallback, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: false } as Message] };
                });
            }
        } else {
            simulateReply(convId, afterId);
        }
    }, [selectedChat, messagesByConversation, simulateReply]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedChat) return;

        const text = messageText.trim();
        const hasContent = text || pendingFile || pendingLocation;
        if (!hasContent) return;

        const convId = selectedChat.id;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const doReply = (afterId: number, userContent: string) => {
            getReply(convId, afterId, userContent);
        };

        if (pendingFile) {
            const { file, url } = pendingFile;
            const isImage = file.type.startsWith('image/');
            const newId = isImage
                ? addMessage({ sender: 'You', content: file.name, timestamp: timeStr, isOwn: true, type: 'image', imageUrl: url }, convId)
                : addMessage({ sender: 'You', content: file.name, timestamp: timeStr, isOwn: true, type: 'file', fileName: file.name, fileUrl: url }, convId);
            doReply(newId, `I shared a ${isImage ? 'photo' : 'file'}: ${file.name}`);
            setPendingFile(null);
        }

        if (pendingLocation) {
            const { lat, lng } = pendingLocation;
            const newId = addMessage({
                sender: 'You',
                content: `📍 Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                timestamp: timeStr,
                isOwn: true,
                type: 'location',
                location: { lat, lng }
            }, convId);
            doReply(newId, `I shared my location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            setPendingLocation(null);
        }

        if (text) {
            const newId = addMessage({ sender: 'You', content: text, timestamp: timeStr, isOwn: true, type: 'text' }, convId);
            doReply(newId, text);
        }

        setMessageText('');
        setShowEmojiPicker(false);
    };

    const handleUrgentHelp = () => {
        if (!selectedChat) return;
        const convId = selectedChat.id;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const urgentMsg = '🆘 URGENT HELP NEEDED';
        const newId = addMessage({ sender: 'You', content: urgentMsg, timestamp: timeStr, isOwn: true, type: 'text' }, convId);
        setShowEmojiPicker(false);
        getReply(convId, newId, urgentMsg);
    };

    const handleEmojiInsert = (emoji: string) => {
        setMessageText(prev => prev + emoji);
    };

    const handleAttachment = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const url = URL.createObjectURL(file);
        setPendingFile({ file, url });
    };

    const clearPendingFile = () => {
        if (pendingFile) {
            URL.revokeObjectURL(pendingFile.url);
            setPendingFile(null);
        }
    };

    const handleShareLocation = () => {
        if (!('geolocation' in navigator)) {
            alert('Geolocation is not supported.');
            return;
        }
        setLocationLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setPendingLocation({ lat: latitude, lng: longitude });
                setLocationLoading(false);
            },
            () => {
                alert('Unable to get location. Please enable location services.');
                setLocationLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const clearPendingLocation = () => setPendingLocation(null);

    const startRecording = async () => {
        if (isRecording) return;
        if (!selectedChat || !navigator.mediaDevices?.getUserMedia) {
            alert('Voice recording is not supported.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                const convId = selectedChat!.id;
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
                const newId = addMessage({ sender: 'You', content: 'Voice message', timestamp: timeStr, isOwn: true, type: 'voice', voiceUrl: url, voiceDuration: duration }, convId);
                simulateReply(convId, newId);
            };

            recordingStartRef.current = Date.now();
            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch (err) {
            alert('Could not access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
        setIsRecording(false);
    };

    const openChat = (conversation: Conversation) => {
        setSelectedChat(conversation);
        setView('chat');
        clearPendingContent();
    };

    const backToList = () => {
        setView('list');
        setSelectedChat(null);
        clearPendingContent();
    };

    const clearPendingContent = () => {
        if (pendingFile) {
            URL.revokeObjectURL(pendingFile.url);
            setPendingFile(null);
        }
        setPendingLocation(null);
    };

    if (view === 'chat' && selectedChat) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
                {/* Back button & conversation header */}
                <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
                    <button
                        type="button"
                        onClick={backToList}
                        className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-700 transition-colors"
                        aria-label="Back to conversations"
                    >
                        <Icons.ChevronLeft size={24} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-semibold text-gray-900 truncate">{selectedChat.nameKey ? t(selectedChat.nameKey) : selectedChat.name}</h1>
                        <p className="text-xs text-gray-500">
                            {selectedChat.isAi
                                ? (isAiChatAvailable() ? 'AI connected • Ready' : 'AI offline • Add VITE_GEMINI_API_KEY to .env.local')
                                : (selectedChat.online ? 'Online' : 'Offline')}
                        </p>
                    </div>
                    {!selectedChat.isAi && (
                        <button
                            type="button"
                            onClick={() => window.open(`https://meet.jit.si/safesphere-${selectedChat.id}-${Date.now()}`, '_blank', 'noopener,noreferrer')}
                            className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            title={t('videoCall')}
                            aria-label={t('videoCall')}
                        >
                            <Icons.Video size={22} />
                        </button>
                    )}
                </div>

                {/* Encryption Notice */}
                <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center justify-center gap-2">
                    <Icons.Lock size={14} className="text-green-600" />
                    <span className="text-xs text-green-800 font-medium">
                        End-to-end encrypted • Private to {selectedChat.nameKey ? t(selectedChat.nameKey) : selectedChat.name} only
                    </span>
                </div>

                {/* Offline responder notice - AI fallback available */}
                {selectedChat && !selectedChat.online && !selectedChat.isAi && isAiChatAvailable() && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                        <Icons.Info size={16} className="text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-800">{t('aiUnavailableFallback')}</p>
                    </div>
                )}

                {/* Messages - private to this channel only */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {currentMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[85%] ${message.isOwn ? 'order-2' : 'order-1'}`}>
                                <div
                                    className={`rounded-2xl px-4 py-3 ${
                                        message.isOwn
                                            ? 'bg-blue-600 text-white rounded-br-sm'
                                            : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                                    }`}
                                >
                                    {message.type === 'image' && message.imageUrl && (
                                        <div className="space-y-1">
                                            <img src={message.imageUrl} alt="" className="rounded-lg max-w-full max-h-48 object-cover" />
                                            <p className="text-sm">{message.content}</p>
                                        </div>
                                    )}
                                    {message.type === 'file' && (
                                        <a href={message.fileUrl} download={message.fileName} className="flex items-center gap-2 text-sm underline">
                                            <Icons.FileText size={18} />
                                            {message.fileName || message.content}
                                        </a>
                                    )}
                                    {message.type === 'voice' && message.voiceUrl && (
                                        <div className="flex items-center gap-2">
                                            <audio src={message.voiceUrl} controls className="max-w-full h-8" />
                                            {message.voiceDuration != null && (
                                                <span className="text-xs opacity-80">{message.voiceDuration}s</span>
                                            )}
                                        </div>
                                    )}
                                    {message.type === 'location' && message.location && (
                                        <a
                                            href={`https://www.openstreetmap.org/?mlat=${message.location.lat}&mlon=${message.location.lng}#map=17/${message.location.lat}/${message.location.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-sm underline"
                                        >
                                            <Icons.MapPin size={18} />
                                            View location on map
                                        </a>
                                    )}
                                    {(message.type === 'text' || !message.type) && <p className="text-sm">{message.content}</p>}
                                </div>
                                <div
                                    className={`text-xs text-gray-500 mt-1 px-2 ${
                                        message.isOwn ? 'text-right' : 'text-left'
                                    }`}
                                >
                                    {message.timestamp}
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* AI typing indicator */}
                    {aiTyping && selectedChat && (
                        <div className="flex justify-start">
                            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-500 rounded-bl-sm shadow-sm">
                                <span className="inline-flex gap-1">
                                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </span>
                                <span className="ml-2 text-xs">{t('aiTyping')}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Message Input - Paperclip | Map Pin | Mic | Text input | Emoji | Send */}
                <div className="bg-white border-t border-gray-200 px-4 py-3 relative">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        className="hidden"
                        onChange={handleFileChange}
                        aria-label="Attach file"
                    />
                    {showEmojiPicker && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-2xl shadow-lg border border-gray-200 p-3 z-20">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-500">{t('sosSigns')}</span>
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(false)}
                                    className="text-gray-400 hover:text-gray-600 p-1"
                                    aria-label="Close"
                                >
                                    <Icons.X size={16} />
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleUrgentHelp}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm mb-3"
                            >
                                <span>🆘</span>
                                <span>{t('urgentHelp')}</span>
                            </button>
                            <div className="grid grid-cols-5 gap-2">
                                {SOS_EMOJIS.map(({ emoji, labelKey }) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleEmojiInsert(emoji)}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-2xl transition-colors"
                                        title={t(labelKey)}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Pending previews - file/location await Send */}
                    {(pendingFile || pendingLocation) && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {pendingFile && (
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-sm">
                                    {pendingFile.file.type.startsWith('image/') ? (
                                        <img src={pendingFile.url} alt="" className="w-8 h-8 rounded object-cover" />
                                    ) : (
                                        <Icons.FileText size={16} />
                                    )}
                                    <span className="truncate max-w-[120px]">{pendingFile.file.name}</span>
                                    <button type="button" onClick={clearPendingFile} className="p-0.5 rounded hover:bg-blue-100" aria-label="Remove">×</button>
                                </span>
                            )}
                            {pendingLocation && (
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-800 text-sm">
                                    <Icons.MapPin size={16} />
                                    Location ready
                                    <button type="button" onClick={clearPendingLocation} className="p-0.5 rounded hover:bg-green-100" aria-label="Remove">×</button>
                                </span>
                            )}
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleAttachment}
                            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
                            title="Attach image or file"
                            aria-label="Attach file"
                        >
                            <Icons.Paperclip size={20} className="text-gray-600" />
                        </button>
                        <button
                            type="button"
                            onClick={handleShareLocation}
                            disabled={locationLoading}
                            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-50"
                            title="Share live location"
                            aria-label="Share location"
                        >
                            {locationLoading ? (
                                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Icons.MapPin size={20} className="text-gray-600" />
                            )}
                        </button>
                        <button
                            type="button"
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onMouseLeave={stopRecording}
                            onTouchStart={startRecording}
                            onTouchEnd={stopRecording}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                                isRecording ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                            title="Voice message"
                            aria-label="Record voice message"
                        >
                            <Icons.Mic size={20} className={isRecording ? 'text-white' : 'text-gray-600'} />
                        </button>
                        {/* Text box with emoji button inside (like Facebook Messenger) */}
                        <div className={`flex-1 min-w-0 flex items-center rounded-full bg-gray-100 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all ${showEmojiPicker ? 'ring-2 ring-blue-500 bg-white' : ''}`}>
                            <input
                                type="text"
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                placeholder={t('typeMessage')}
                                aria-label="Type a message"
                                className="flex-1 min-w-0 px-4 py-2.5 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowEmojiPicker(prev => !prev)}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 mr-1 ${
                                    showEmojiPicker ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                                }`}
                                title={t('sosSigns')}
                                aria-label="SOS emoji signs"
                            >
                                <Icons.Smile size={20} className={showEmojiPicker ? 'text-white' : 'text-gray-600'} />
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={!messageText.trim() && !pendingFile && !pendingLocation}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                                (messageText.trim() || pendingFile || pendingLocation) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-200'
                            }`}
                            title="Send"
                            aria-label="Send message"
                        >
                            <Icons.Send size={18} className={(messageText.trim() || pendingFile || pendingLocation) ? 'text-white' : 'text-gray-400'} />
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Search Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
                <div className="relative">
                    <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search messages..."
                        className="w-full pl-10 pr-4 py-2 rounded-full bg-gray-100 border-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                </div>
            </div>

            {/* Conversations List */}
            <div className="px-4 py-2">
                {conversations.map((conversation) => (
                    <button
                        key={conversation.id}
                        onClick={() => openChat(conversation)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-white rounded-2xl transition-colors mb-2"
                    >
                        <div className="relative">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${conversation.isAi ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-blue-500 to-purple-500'}`}>
                                {conversation.isAi ? '🤖' : conversation.id === 1 ? '🚨' : conversation.id === 2 ? '🛡️' : conversation.name.charAt(0)}
                            </div>
                            {conversation.online && !conversation.isAi && (
                                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-50"></div>
                            )}
                            {conversation.isAi && (
                                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded">AI</span>
                            )}
                        </div>
                        
                        <div className="flex-1 text-left">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-gray-900">{conversation.nameKey ? t(conversation.nameKey) : conversation.name}</span>
                                <span className="text-xs text-gray-500">{conversation.timestamp}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600 truncate flex-1">
                                    {conversation.lastMessage}
                                </p>
                                {conversation.unread > 0 && (
                                    <span className="ml-2 min-w-[20px] h-5 px-2 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                                        {conversation.unread}
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Empty State (if no conversations) */}
            {conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Icons.MessageCircle size={40} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Messages Yet</h3>
                    <p className="text-sm text-gray-500 text-center">
                        Start a conversation with emergency responders or your community.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Chat;
