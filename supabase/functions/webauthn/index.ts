// Supabase Edge Function: WebAuthn (Face ID / Touch ID)
// Deploy: supabase functions deploy webauthn
// Requires: webauthn_credentials and webauthn_challenges tables (run backend/supabase/webauthn_tables.sql)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function randomBase64(len: number): string {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body = await req.json().catch(() => ({})) as Record<string, unknown>;
        const action = body.action as string;

        if (action === 'auth-options') {
            const email = (body.email as string)?.trim()?.toLowerCase();
            if (!email) return jsonResponse({ message: 'Email required' }, 400);
            const userId = await getUserIdByEmail(email);
            const challenge = randomBase64(32);
            await supabase.from('webauthn_challenges').insert({
                challenge,
                email,
                expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            });
            const { data: credsList } = userId
                ? await supabase.from('webauthn_credentials').select('credential_id').eq('user_id', userId)
                : { data: [] as { credential_id: string }[] };
            const allowCredentials = (credsList || []).map((c: { credential_id: string }) => ({
                type: 'public-key' as const,
                id: c.credential_id,
            }));
            const rpId = Deno.env.get('SITE_URL') ? new URL(Deno.env.get('SITE_URL')!).hostname : undefined;
            return jsonResponse({
                challenge,
                allowCredentials: allowCredentials.length ? allowCredentials : undefined,
                rpId,
            });
        }

        if (action === 'auth-verify') {
            const email = (body.email as string)?.trim()?.toLowerCase();
            const credentialId = body.credentialId as string;
            if (!email || !credentialId) return jsonResponse({ message: 'Missing fields' }, 400);
            const userId = await getUserIdByEmail(email);
            if (!userId) return jsonResponse({ message: 'User not found' }, 404);
            const { data: cred } = await supabase
                .from('webauthn_credentials')
                .select('id, user_id')
                .eq('credential_id', credentialId)
                .single();
            if (!cred) return jsonResponse({ message: 'Credential not found' }, 404);
            const { data: link } = await supabase.auth.admin.generateLink({
                type: 'magiclink',
                email,
            });
            const magicLink = (link as { properties?: { action_link?: string } })?.properties?.action_link;
            if (!magicLink) return jsonResponse({ message: 'Could not generate link' }, 500);
            return jsonResponse({ magicLink });
        }

        if (action === 'register-options') {
            const authHeader = req.headers.get('Authorization');
            if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ message: 'Unauthorized' }, 401);
            const token = authHeader.slice(7);
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error || !user) return jsonResponse({ message: 'Invalid token' }, 401);
            const challenge = randomBase64(32);
            await supabase.from('webauthn_challenges').insert({
                challenge,
                email: user.email!,
                expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            });
            const rpId = Deno.env.get('SITE_URL') ? new URL(Deno.env.get('SITE_URL')!).hostname : new URL(supabaseUrl).hostname;
            const userIdBytes = new TextEncoder().encode(user.id);
            return jsonResponse({
                publicKey: {
                    rp: { name: 'SafeSphere', id: rpId },
                    user: {
                        id: btoa(String.fromCharCode(...userIdBytes)),
                        name: user.email!,
                        displayName: (user.user_metadata?.name as string) || user.email!,
                    },
                    challenge,
                    pubKeyCredParams: [
                        { type: 'public-key', alg: -7 },
                        { type: 'public-key', alg: -257 },
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                        residentKey: 'preferred',
                    },
                },
            });
        }

        if (action === 'register-verify') {
            const authHeader = req.headers.get('Authorization');
            if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ message: 'Unauthorized' }, 401);
            const token = authHeader.slice(7);
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error || !user) return jsonResponse({ message: 'Invalid token' }, 401);
            const credentialId = body.credentialId as string;
            const attestationObject = body.attestationObject as string;
            if (!credentialId || !attestationObject) return jsonResponse({ message: 'Missing credential data' }, 400);
            await supabase.from('webauthn_credentials').upsert({
                user_id: user.id,
                credential_id: credentialId,
                public_key_cose: attestationObject,
            }, { onConflict: 'credential_id' });
            return jsonResponse({ success: true });
        }

        return jsonResponse({ message: 'Unknown action' }, 400);
    } catch (e) {
        console.error(e);
        return jsonResponse({ message: (e as Error).message || 'Server error' }, 500);
    }
});

async function getUserIdByEmail(email: string): Promise<string | null> {
    const { data } = await supabase.auth.admin.listUsers();
    const user = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    return user?.id ?? null;
}
