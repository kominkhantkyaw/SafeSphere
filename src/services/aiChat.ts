/**
 * AI Chat service — routes requests through a Supabase Edge Function so the
 * Gemini API key never leaves the server. Falls back to a direct client-side
 * call only when VITE_GEMINI_API_KEY is explicitly set (local dev).
 */

import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from '@google/generative-ai';

const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

const SYSTEM_PROMPT = `You are an AI Safety Assistant for SafeSphere, a disaster preparedness and response app. Your role is to help users with:
- Disaster preparedness (earthquake, flood, storm, fire)
- Emergency response guidance when responders may be unavailable
- Safety tips and practical advice (evacuation, first aid basics, emergency kits)
- Calm, clear, concise responses in a supportive tone

Keep responses brief (2-4 sentences) unless the user asks for detail. Prioritise actionable advice. If someone reports an urgent emergency (fire, injury, trapped), remind them to call local emergency services (112, 911, etc.) immediately. Respond in the same language the user writes in when possible.`;

export const QUOTA_EXCEEDED_MESSAGE = 'AI is temporarily busy (quota limit). Please try again in a minute, or contact a human responder.';

export interface AiChatOptions {
    userMessage: string;
    conversationHistory?: { role: 'user' | 'model'; text: string }[];
}

function isFetchError(e: unknown): e is GoogleGenerativeAIFetchError {
    return e instanceof Error && 'status' in e;
}

/* ------------------------------------------------------------------ */
/*  Primary path: Supabase Edge Function proxy (key stays server-side) */
/* ------------------------------------------------------------------ */
async function callEdgeFunction(options: AiChatOptions): Promise<string | null> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!supabaseUrl || !anonKey) return null;

    const url = `${supabaseUrl}/functions/v1/ai-chat`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
        },
        body: JSON.stringify({
            userMessage: options.userMessage,
            conversationHistory: options.conversationHistory ?? [],
        }),
    });

    if (res.status === 429) return QUOTA_EXCEEDED_MESSAGE;
    if (res.status === 503) return null; // AI not configured on server
    if (!res.ok) return null;

    const json = await res.json();
    if (json?.text) return json.text;
    if (json?.error) { console.warn('[AI Chat Edge] Server error:', json.error); return null; }
    return null;
}

/* ------------------------------------------------------------------ */
/*  Fallback: direct client call (local dev only, when key is set)     */
/* ------------------------------------------------------------------ */
async function directGeminiFetch(
    apiKey: string,
    modelName: string,
    contents: { role: string; parts: { text: string }[] }[]
): Promise<string | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
        }),
    });
    if (res.status === 429) return QUOTA_EXCEEDED_MESSAGE;
    if (!res.ok) return null;
    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function clientSideFallback(options: AiChatOptions): Promise<string | null> {
    const apiKey = String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
    if (!apiKey || apiKey === 'undefined') return null;

    const history = (options.conversationHistory ?? []).slice(-10).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
    }));
    history.push({ role: 'user', parts: [{ text: options.userMessage }] });

    // Try SDK first
    for (let i = 0; i < MODELS.length; i++) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: MODELS[i],
                systemInstruction: SYSTEM_PROMPT,
                generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
            });
            const result = await model.generateContent({ contents: history });
            const text = result.response.text?.()?.trim();
            if (text) return text;
        } catch (e) {
            if (isFetchError(e) && e.status === 429) return QUOTA_EXCEEDED_MESSAGE;
            continue;
        }
    }

    // Try direct REST
    for (const modelName of MODELS) {
        try {
            const text = await directGeminiFetch(apiKey, modelName, history);
            if (text) return text;
        } catch { continue; }
    }

    return null;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Get an AI safety reply. Tries the secure Edge Function first,
 * then falls back to client-side SDK if a local API key is set.
 */
export async function getAiSafetyReply(options: AiChatOptions): Promise<string | null> {
    // 1. Try the secure server-side proxy
    try {
        const edgeResult = await callEdgeFunction(options);
        if (edgeResult) return edgeResult;
    } catch (e) {
        console.warn('[AI Chat] Edge Function unavailable, trying local fallback:', e instanceof Error ? e.message : e);
    }

    // 2. Fall back to direct client call (dev only)
    try {
        return await clientSideFallback(options);
    } catch (e) {
        console.warn('[AI Chat] All attempts failed:', e instanceof Error ? e.message : e);
        return null;
    }
}

/** Check if AI chat is available (either Edge Function or local key). */
export function isAiChatAvailable(): boolean {
    const hasSupabase = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
    const hasLocalKey = (() => {
        const k = import.meta.env.VITE_GEMINI_API_KEY || '';
        return !!(k && k !== 'undefined');
    })();
    return hasSupabase || hasLocalKey;
}
