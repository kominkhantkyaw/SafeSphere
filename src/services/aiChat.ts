/**
 * AI Chat service - uses Google Gemini API for disaster preparedness and safety assistance.
 * Provides automatic replies when human responders are unavailable.
 */

import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from '@google/generative-ai';

// Try models in order - some may return 404 (not found) or 429 (quota exceeded)
const MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

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

    for (const modelName of MODELS) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: SYSTEM_PROMPT,
                generationConfig: {
                    maxOutputTokens: 256,
                    temperature: 0.7,
                },
            });

            const result = await model.generateContent({ contents: history });
            const response = result.response;
            const text = response.text?.()?.trim();
            if (text) return text;
        } catch (e) {
            lastError = e;
            if (isFetchError(e) && e.status === 429) {
                // Quota exceeded - return user-friendly message instead of retrying
                return QUOTA_EXCEEDED_MESSAGE;
            }
            if (isFetchError(e) && e.status === 404) {
                // Model not found - try next model
                if (typeof window !== 'undefined') {
                    console.warn(`[AI Chat] Model ${modelName} not found (404), trying next...`);
                }
                continue;
            }
            if (typeof window !== 'undefined') {
                console.warn('[AI Chat] Gemini request failed:', e);
            }
            break;
        }
    }

    return null;
}

/** Check if AI chat is available (API key configured). */
export function isAiChatAvailable(): boolean {
    const key = import.meta.env.VITE_GEMINI_API_KEY || '';
    return !!(key && key !== 'undefined' && key !== '');
}
