// Supabase Edge Function: secure Gemini proxy for the SafeSphere AI assistant.
// Deploy: supabase functions deploy ai-chat
// Set secret: supabase secrets set GEMINI_API_KEY=your_gemini_key

import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

const MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const SYSTEM_PROMPT = `You are an AI Safety Assistant for SafeSphere, a disaster preparedness and response app. Your role is to help users with:
- Disaster preparedness (earthquake, flood, storm, fire)
- Emergency response guidance when responders may be unavailable
- Safety tips and practical advice (evacuation, first aid basics, emergency kits)
- Calm, clear, concise responses in a supportive tone

Keep responses brief (2-4 sentences) unless the user asks for detail. Prioritise actionable advice. If someone reports an urgent emergency (fire, injury, trapped), remind them to call local emergency services immediately. Respond in the same language the user writes in when possible.`;

type ChatMessage = { role: 'user' | 'model'; text: string };
type RequestBody = { userMessage?: string; conversationHistory?: ChatMessage[] };

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function response(body: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function isValidHistory(value: unknown): value is ChatMessage[] {
    return Array.isArray(value) && value.slice(-10).every((item) => (
        item && typeof item === 'object' &&
        (item as ChatMessage).role && ['user', 'model'].includes((item as ChatMessage).role) &&
        typeof (item as ChatMessage).text === 'string'
    ));
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

    const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
    if (!apiKey) return response({ error: 'AI service is not configured.' }, 503);

    try {
        const body = await req.json().catch(() => ({})) as RequestBody;
        const userMessage = typeof body.userMessage === 'string' ? body.userMessage.trim() : '';
        const history = isValidHistory(body.conversationHistory) ? body.conversationHistory.slice(-10) : [];

        if (!userMessage) return response({ error: 'A message is required.' }, 400);
        if (userMessage.length > 4000) return response({ error: 'Message is too long.' }, 413);

        const contents = [
            ...history.map((item) => ({ role: item.role, parts: [{ text: item.text.slice(0, 4000) }] })),
            { role: 'user', parts: [{ text: userMessage }] },
        ];
        const upstream = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents,
                generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
            }),
        });

        const data = await upstream.json().catch(() => ({})) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
            error?: { message?: string };
        };
        if (upstream.status === 429) return response({ error: 'AI quota exceeded.' }, 429);
        if (!upstream.ok) {
            console.error('[ai-chat] Gemini error:', upstream.status, data.error?.message || 'Unknown upstream error');
            return response({ error: 'AI provider unavailable.' }, 502);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) return response({ error: 'AI returned no response.' }, 502);
        return response({ text });
    } catch (error) {
        console.error('[ai-chat] Request failed:', error);
        return response({ error: 'AI service temporarily unavailable.' }, 500);
    }
});
