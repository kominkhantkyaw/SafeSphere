/**
 * WebAuthn (Face ID / Touch ID) — client-side.
 * Calls Supabase Edge Function for options and verification.
 */

import { supabase, isSupabaseReady } from './supabase';

const EDGE_URL = (): string => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    return url ? `${url}/functions/v1/webauthn` : '';
};

function getAuthHeaders(): Record<string, string> {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!anonKey) return {};
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
    };
}

/** Check if WebAuthn is available (secure context + PublicKeyCredential). */
export function isWebAuthnAvailable(): boolean {
    return typeof window !== 'undefined' &&
        window.isSecureContext === true &&
        typeof PublicKeyCredential !== 'undefined';
}

/** Get auth options (challenge + allowCredentials) for the given email. */
export async function getWebAuthnAuthOptions(email: string): Promise<
    { success: true; options: PublicKeyCredentialRequestOptions } | { success: false; message: string }
> {
    const base = EDGE_URL();
    if (!base || !isSupabaseReady()) return { success: false, message: 'Supabase not configured.' };
    const res = await fetch(base, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'auth-options', email: email.trim().toLowerCase() }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: (err as { message?: string }).message || 'Failed to get options.' };
    }
    const data = await res.json() as { challenge: string; allowCredentials?: { type: string; id: string }[]; rpId?: string };
    if (!data.challenge) return { success: false, message: 'Invalid options.' };
    const options: PublicKeyCredentialRequestOptions = {
        challenge: Uint8Array.from(atob(data.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        rpId: data.rpId ?? (typeof window !== 'undefined' ? window.location.hostname : undefined),
        userVerification: 'required',
    };
    if (data.allowCredentials?.length) {
        options.allowCredentials = data.allowCredentials.map((c: { type: string; id: string }) => ({
            type: 'public-key' as const,
            id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), x => x.charCodeAt(0)),
        }));
    }
    return { success: true, options };
}

/** Sign in with WebAuthn assertion (Face ID / Touch ID). Returns magic link or error. */
export async function verifyWebAuthnAssertion(
    email: string,
    credential: PublicKeyCredential
): Promise<{ success: true; magicLink: string } | { success: false; message: string }> {
    const base = EDGE_URL();
    if (!base) return { success: false, message: 'Supabase not configured.' };
    const response = credential.response as AuthenticatorAssertionResponse;
    const body = {
        email: email.trim().toLowerCase(),
        credentialId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
        authenticatorData: btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))),
        signature: btoa(String.fromCharCode(...new Uint8Array(response.signature))),
        userHandle: response.userHandle
            ? btoa(String.fromCharCode(...new Uint8Array(response.userHandle)))
            : null,
    };
    const res = await fetch(base, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'auth-verify', ...body }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: (err as { message?: string }).message || 'Verification failed.' };
    }
    const data = await res.json();
    const link = (data as { magicLink?: string }).magicLink;
    if (!link) return { success: false, message: 'No magic link returned.' };
    return { success: true, magicLink: link };
}

/** Get registration options for the current user (must be signed in). */
export async function getWebAuthnRegisterOptions(): Promise<
    { success: true; options: CredentialCreationOptions } | { success: false; message: string }
> {
    const base = EDGE_URL();
    if (!base || !supabase) return { success: false, message: 'Supabase not configured.' };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { success: false, message: 'Not signed in.' };
    const res = await fetch(base, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(),
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'register-options' }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: (err as { message?: string }).message || 'Failed to get options.' };
    }
    const data = await res.json();
    const options = data as { publicKey: PublicKeyCredentialCreationOptions };
    if (!options?.publicKey?.challenge) return { success: false, message: 'Invalid options.' };
    options.publicKey.challenge = Uint8Array.from(atob(options.publicKey.challenge as unknown as string), c => c.charCodeAt(0));
    if (options.publicKey.user?.id) {
        options.publicKey.user.id = Uint8Array.from(atob(options.publicKey.user.id as unknown as string), c => c.charCodeAt(0));
    }
    return { success: true, options: options as CredentialCreationOptions };
}

/** Register the WebAuthn credential (after create()). */
export async function verifyWebAuthnRegistration(credential: PublicKeyCredential): Promise<{ success: boolean; message?: string }> {
    const base = EDGE_URL();
    if (!base || !supabase) return { success: false, message: 'Supabase not configured.' };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { success: false, message: 'Not signed in.' };
    const response = credential.response as AuthenticatorAttestationResponse;
    const body = {
        credentialId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
        attestationObject: btoa(String.fromCharCode(...new Uint8Array(response.attestationObject))),
    };
    const res = await fetch(base, {
        method: 'POST',
        headers: {
            ...getAuthHeaders(),
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'register-verify', ...body }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: (err as { message?: string }).message || 'Registration failed.' };
    }
    return { success: true };
}
