// Supabase Edge Function: secure Gemini proxy for the SafeSphere AI assistant.
// Deploy: supabase functions deploy ai-chat
// Set secret: supabase secrets set GEMINI_API_KEY=your_gemini_key

import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
const LIVE_INFO_PATTERN = /\b(latest|today|now|currently|current|news|report|update|flood|flooding|weather|storm|earthquake|tsunami|wildfire|emergency|warning|alert)\b/i;
const SYSTEM_PROMPT = `You are an AI Safety Assistant for SafeSphere, a disaster preparedness and response app. Your role is to help users with:
- Disaster preparedness (earthquake, flood, storm, fire)
- Emergency response guidance when responders may be unavailable
- Safety tips and practical advice (evacuation, first aid basics, emergency kits)
- Calm, clear, concise responses in a supportive tone

Keep responses brief (2-4 sentences) unless the user asks for detail. Prioritise actionable advice. If someone reports an urgent emergency (fire, injury, trapped), remind them to call local emergency services immediately. Respond in the same language the user writes in when possible.`;

type ChatMessage = { role: 'user' | 'model'; text: string };
type RequestBody = { userMessage?: string; conversationHistory?: ChatMessage[] };
type SearchResult = { title: string; url: string; content: string; publishedDate?: string };

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

async function searchCurrentInformation(query: string): Promise<SearchResult[]> {
    const searchKey = Deno.env.get('TAVILY_API_KEY')?.trim();
    if (!searchKey || !LIVE_INFO_PATTERN.test(query)) return [];

    try {
        const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: searchKey,
                query,
                topic: 'news',
                search_depth: 'advanced',
                max_results: 5,
                include_answer: false,
                include_raw_content: false,
            }),
        });
        if (!res.ok) {
            console.warn('[ai-chat] Live search failed:', res.status);
            return [];
        }
        const data = await res.json().catch(() => ({})) as { results?: SearchResult[] };
        return (data.results ?? []).filter((item) => item?.title && item?.url && item?.content).slice(0, 5);
    } catch (error) {
        console.warn('[ai-chat] Live search unavailable:', error);
        return [];
    }
}

function buildSearchContext(results: SearchResult[]): string {
    if (!results.length) return '';
    return `\n\nCURRENT WEB SOURCES (use only as supporting evidence; mention uncertainty and cite sources as [1], [2], etc.):\n${results
        .map((item, index) => `[${index + 1}] ${item.title}${item.publishedDate ? ` (${item.publishedDate})` : ''}\nURL: ${item.url}\n${item.content.slice(0, 1200)}`)
        .join('\n\n')}`;
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

        const searchResults = await searchCurrentInformation(userMessage);
        const enrichedMessage = `${userMessage}${buildSearchContext(searchResults)}`;
        const contents = [
            ...history.map((item) => ({ role: item.role, parts: [{ text: item.text.slice(0, 4000) }] })),
            { role: 'user', parts: [{ text: enrichedMessage }] },
        ];
        for (const model of MODELS) {
            const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
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
            if (upstream.status === 401 || upstream.status === 403) {
                console.error('[ai-chat] Gemini credentials rejected:', data.error?.message || 'Invalid API key');
                return response({ error: 'AI service credentials are invalid.' }, 503);
            }
            if (!upstream.ok) {
                console.warn('[ai-chat] Gemini model failed:', model, upstream.status, data.error?.message || 'Unknown error');
                continue;
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) return response({ text });
        }
        return response({ error: 'AI provider unavailable.' }, 502);
    } catch (error) {
        console.error('[ai-chat] Request failed:', error);
        return response({ error: 'AI service temporarily unavailable.' }, 500);
    }
});
