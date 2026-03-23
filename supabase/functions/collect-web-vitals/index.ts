// Supabase Edge Function: receive Core Web Vitals JSON from the browser.
// Deploy: supabase functions deploy collect-web-vitals --no-verify-jwt
// (Public POST from your SPA; no user JWT required. Rate-limit in production if needed.)
//
// Env (Vite): VITE_WEB_VITALS_ENDPOINT=https://<ref>.supabase.co/functions/v1/collect-web-vitals

import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

const NAMES = new Set(['CLS', 'INP', 'LCP', 'FCP', 'TTFB']);

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body !== 'object') {
            return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const name = body.name;
        if (typeof name !== 'string' || !NAMES.has(name)) {
            return new Response(JSON.stringify({ error: 'Invalid metric name' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        // Structured log (Log Explorer / dashboard). No PII in default client payload.
        console.log('[web-vitals]', JSON.stringify(body));
        return new Response(null, { status: 204, headers: corsHeaders });
    } catch (e) {
        console.error('[collect-web-vitals]', e);
        return new Response(JSON.stringify({ error: 'Server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
