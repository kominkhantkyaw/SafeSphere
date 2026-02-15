/**
 * AI Chat service - uses Google Gemini API for disaster preparedness and safety assistance.
 * Provides automatic replies when human responders are unavailable.
 *
 * Strategy: try the SDK first; if every model hits a NetworkError (common in
 * Firefox or when the SDK's internal fetch is blocked), fall back to a plain
 * fetch() call to the REST API which gives us full control over headers.
 */

import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from '@google/generative-ai';

// Try models in order — newer/stable first, then fallbacks
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

const SYSTEM_PROMPT = `You are an AI Safety Assistant for SafeSphere, a disaster preparedness and response app. Your role is to help users with:
- Disaster preparedness (earthquake, flood, storm, fire)
- Emergency response guidance when responders may be unavailable
- Safety tips and practical advice (evacuation, first aid basics, emergency kits)
- Calm, clear, concise responses in a supportive tone

Keep responses brief (2-4 sentences) unless the user asks for detail. Prioritise actionable advice. If someone reports an urgent emergency (fire, injury, trapped), remind them to call local emergency services (112, 911, etc.) immediately. Respond in the same language the user writes in when possible.`;

/** User-friendly message when quota is exceeded - shown instead of generic fallback */
export const QUOTA_EXCEEDED_MESSAGE = 'AI is temporarily busy (quota limit). Please try again in a minute, or contact a human responder.';

export interface AiChatOptions {
    userMessage: string;
    conversationHistory?: { role: 'user' | 'model'; text: string }[];
}

function isFetchError(e: unknown): e is GoogleGenerativeAIFetchError {
    return e instanceof Error && 'status' in e;
}

/* ---------- Raw REST fallback (bypasses SDK fetch quirks) ---------- */
async function rawGeminiFetch(
    apiKey: string,
    modelName: string,
    contents: { role: string; parts: { text: string }[] }[]
): Promise<string | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (res.status === 429) return QUOTA_EXCEEDED_MESSAGE;
    if (!res.ok) return null;

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
}

/**
 * Call Gemini API to generate a safety-focused reply.
 * Returns the AI response text, QUOTA_EXCEEDED_MESSAGE on 429, or null if API key missing or request fails.
 */
export async function getAiSafetyReply(options: AiChatOptions): Promise<string | null> {
    const apiKey = String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
    if (!apiKey || apiKey === 'undefined') {
        if (typeof window !== 'undefined') {
            console.warn('[AI Chat] VITE_GEMINI_API_KEY is missing. Add VITE_GEMINI_API_KEY=your_key to .env.local and restart dev server.');
        }
        return null;
    }

    const { userMessage, conversationHistory = [] } = options;
    const history = conversationHistory.slice(-10).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
    }));
    history.push({ role: 'user' as const, parts: [{ text: userMessage }] });

    let lastError: unknown = null;
    let allNetworkErrors = true;

    // ── Attempt 1: SDK approach ──────────────────────────────────────
    for (let i = 0; i < MODELS.length; i++) {
        const modelName = MODELS[i];
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: SYSTEM_PROMPT,
                generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
            });

            const result = await model.generateContent({ contents: history });
            const text = result.response.text?.()?.trim();
            if (text) return text;
        } catch (e) {
            lastError = e;
            if (isFetchError(e) && e.status === 429) return QUOTA_EXCEEDED_MESSAGE;

            const isNetwork = e instanceof Error &&
                (e.message.includes('NetworkError') || e.message.includes('Failed to fetch') || e.message.includes('net::ERR'));
            if (!isNetwork) allNetworkErrors = false;

            const status = isFetchError(e) ? ` (${e.status})` : '';
            const isLast = i === MODELS.length - 1;
            console.warn(
                `[AI Chat SDK] ${modelName}${status} failed${isLast ? '' : ', trying next...'}:`,
                e instanceof Error ? e.message : e
            );
            continue;
        }
    }

    // ── Attempt 2: Raw fetch fallback (if SDK had network errors) ────
    if (allNetworkErrors) {
        console.log('[AI Chat] SDK blocked by browser — falling back to direct REST call...');
        for (let i = 0; i < MODELS.length; i++) {
            const modelName = MODELS[i];
            try {
                const text = await rawGeminiFetch(apiKey, modelName, history);
                if (text === QUOTA_EXCEEDED_MESSAGE) return text;
                if (text) return text;
            } catch (e) {
                const isLast = i === MODELS.length - 1;
                console.warn(
                    `[AI Chat REST] ${modelName} failed${isLast ? '' : ', trying next...'}:`,
                    e instanceof Error ? e.message : e
                );
                lastError = e;
                continue;
            }
        }
    }

    // ── All attempts exhausted ───────────────────────────────────────
    if (typeof window !== 'undefined' && lastError) {
        const msg = lastError instanceof Error ? lastError.message : String(lastError);
        if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('net::ERR')) {
            console.error(
                '[AI Chat] All attempts failed with a network error. Possible causes:\n' +
                '  1. API key has HTTP-referrer restrictions — remove them at console.cloud.google.com/apis/credentials\n' +
                '  2. Browser extension or tracking protection is blocking generativelanguage.googleapis.com\n' +
                '  3. Firewall or ISP is blocking the Google API domain\n' +
                '  4. Try a different browser (Chrome) or disable Enhanced Tracking Protection in Firefox'
            );
        }
    }

    return null;
}

/** Check if AI chat is available (API key configured). */
export function isAiChatAvailable(): boolean {
    const key = import.meta.env.VITE_GEMINI_API_KEY || '';
    return !!(key && key !== 'undefined' && key !== '');
}
