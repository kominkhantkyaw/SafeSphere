/**
 * SafeSphere Auth — Demo users vs Supabase (real) users.
 * Demo: existing DEMO_CREDENTIALS (no Supabase).
 * Real users: Supabase Auth with optional 2FA (TOTP) and Face ID preference in user_metadata.
 */

import { supabase, isSupabaseReady } from './supabase';
import type { User } from '../types';

// Must match api.ts DEMO_CREDENTIALS emails (no import from api to avoid circular dependency)
const DEMO_EMAILS = new Set([
    'admin@safesphere.app', 'responder@safesphere.app', 'reporter@safesphere.app'
]);

/** True if email is a demo account (mock auth only). */
export function isDemoUser(email: string): boolean {
    return DEMO_EMAILS.has(email.trim().toLowerCase());
}

/** Convert Supabase auth user + metadata to our User type. */
function supabaseUserToAppUser(sbUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
    const meta = sbUser.user_metadata || {};
    const name = (meta.name as string) || sbUser.email?.split('@')[0] || 'User';
    const role = (meta.role as User['role']) || 'Reporter';
    const id = hashUuidToNumber(sbUser.id);
    return {
        id,
        name,
        role,
        safetyScore: (meta.safetyScore as number) ?? 0,
        xp: (meta.xp as number) ?? 0,
        email: sbUser.email,
        phone: (meta.phone as string) ?? undefined,
        bloodType: (meta.bloodType as User['bloodType']) ?? undefined,
        volunteerPoints: (meta.volunteerPoints as number) ?? 0,
        permissions: (meta.permissions as string[]) ?? [],
        skills: (meta.skills as string[]) ?? [],
        emergencyContactName: (meta.emergencyContactName as string) ?? undefined,
        emergencyContactPhone: (meta.emergencyContactPhone as string) ?? undefined,
    };
}

function hashUuidToNumber(uuid: string): number {
    const hex = uuid.replace(/-/g, '');
    let n = 0;
    for (let i = 0; i < Math.min(8, hex.length); i++) {
        n = ((n << 5) - n) + hex.charCodeAt(i) | 0;
    }
    return Math.abs(n) || 1;
}

export type AuthResult =
    | { success: true; user: User }
    | { success: true; user: User; requiresMfa: true }
    | { success: false; message: string };

/**
 * Sign up a new real user with Supabase Auth.
 * Creates the user in Supabase — email confirmation is controlled by the Supabase dashboard
 * (Auth → Settings → "Confirm email"). When enabled, session will be null until confirmed.
 * Phone number is stored in user_metadata for SMS OTP verification.
 */
export async function signUpWithSupabase(
    email: string,
    password: string,
    metadata?: { name?: string; role?: User['role']; phone?: string }
): Promise<
    | { success: true; user: User; needsEmailConfirmation: boolean }
    | { success: false; message: string }
> {
    if (!supabase || !isSupabaseReady()) {
        return { success: false, message: 'Supabase is not configured.' };
    }
    const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
            data: {
                name: metadata?.name ?? email.trim().split('@')[0],
                role: metadata?.role ?? 'Reporter',
                phone: metadata?.phone ?? undefined,
            },
        },
    });
    if (error) return { success: false, message: error.message };
    if (!data.user) return { success: false, message: 'Sign up failed.' };

    // If session is null the user must confirm their email first
    const needsEmailConfirmation = data.session === null;
    return { success: true, user: supabaseUserToAppUser(data.user), needsEmailConfirmation };
}

/**
 * Verify the OTP code (6-digit) that Supabase sent during sign-up.
 * Uses type 'signup' — this matches the confirmation email Supabase sends
 * when signUp() is called with "Confirm email" enabled in the dashboard.
 */
export async function verifyEmailOtp(
    email: string,
    token: string
): Promise<{ success: true; user: User } | { success: false; message: string }> {
    if (!supabase || !isSupabaseReady()) {
        return { success: false, message: 'Supabase is not configured.' };
    }
    // Try 'signup' type first — this is the correct type for sign-up confirmation
    const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'signup',
    });
    if (error) {
        // Fallback: try 'email' type in case the OTP was sent via magiclink/email change
        const { data: d2, error: e2 } = await supabase.auth.verifyOtp({
            email: email.trim(),
            token: token.trim(),
            type: 'email',
        });
        if (e2) return { success: false, message: error.message };
        if (!d2.user) return { success: false, message: 'Verification failed.' };
        return { success: true, user: supabaseUserToAppUser(d2.user) };
    }
    if (!data.user) return { success: false, message: 'Verification failed.' };
    return { success: true, user: supabaseUserToAppUser(data.user) };
}

/**
 * Resend the sign-up confirmation email for a user who hasn't confirmed yet.
 */
export async function resendSignUpConfirmation(
    email: string
): Promise<{ success: boolean; message?: string }> {
    if (!supabase || !isSupabaseReady()) {
        return { success: false, message: 'Supabase is not configured.' };
    }
    const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
}

/**
 * Send a phone OTP (SMS) for verification via a Supabase Edge Function.
 * The Edge Function sends the SMS through Twilio / any SMS provider.
 * This is optional — if the Edge Function is not deployed or Twilio is not configured,
 * it fails gracefully and confirmation can still proceed via email.
 */
export async function sendPhoneOtp(
    phone: string,
    code: string
): Promise<{ success: boolean; message?: string }> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!supabaseUrl || !anonKey) {
        return { success: false, message: 'Supabase is not configured.' };
    }
    try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-confirmation-sms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ phone: phone.trim(), code }),
        });
        const result = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
        if (!result.success) {
            return { success: false, message: result.message || 'Failed to send SMS.' };
        }
        return { success: true };
    } catch (err) {
        console.error('sendPhoneOtp error:', err);
        return { success: false, message: 'Failed to send SMS.' };
    }
}

/**
 * Sign in with Supabase (real users only). Returns user and optionally requiresMfa.
 * Call completeMfaChallenge() if requiresMfa is true, then getSession() again to get full session.
 */
export async function signInWithSupabase(email: string, password: string): Promise<AuthResult> {
    if (!supabase || !isSupabaseReady()) {
        return { success: false, message: 'Supabase is not configured.' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
    });
    if (error) {
        return { success: false, message: error.message || 'Invalid email or password.' };
    }
    if (!data.user) {
        return { success: false, message: 'Invalid email or password.' };
    }
    const user = supabaseUserToAppUser(data.user);
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa = aal.data?.nextLevel === 'aal2' && aal.data?.currentLevel !== 'aal2';
    if (needsMfa) {
        return { success: true, user, requiresMfa: true };
    }
    return { success: true, user };
}

/**
 * Complete MFA challenge (TOTP code). Call after signInWithSupabase when requiresMfa is true.
 * On success, session is refreshed; then getSupabaseSessionUser() will return the full user.
 */
export async function completeMfaChallenge(code: string): Promise<{ success: boolean; message?: string }> {
    if (!supabase) return { success: false, message: 'Supabase is not configured.' };
    const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr || !factors?.totp?.length) {
        return { success: false, message: listErr?.message || 'No MFA factor found.' };
    }
    const factorId = factors.totp[0].id;
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr || !challenge?.id) {
        return { success: false, message: challengeErr?.message || 'Failed to create challenge.' };
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
    });
    if (verifyErr) {
        return { success: false, message: verifyErr.message || 'Invalid code.' };
    }
    return { success: true };
}

/**
 * Get current Supabase user as App User if session exists and AAL is sufficient (aal2 or aal1 with no MFA required).
 */
export async function getSupabaseSessionUser(): Promise<User | null> {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return supabaseUserToAppUser(session.user);
}

/** Sign out from Supabase (call on app logout for real users). */
export async function signOutSupabase(): Promise<void> {
    if (supabase) await supabase.auth.signOut();
}

export type OAuthResult = { success: true; redirectUrl: string } | { success: false; message: string };

/** Sign in with Google (Gmail). Redirects to Google OAuth; on return, use getSupabaseSessionUser() and then onLogin(). */
export async function signInWithGoogle(): Promise<OAuthResult> {
    if (!supabase || !isSupabaseReady()) {
        return { success: false, message: 'Supabase is not configured. Enable Google sign-in in your Supabase project.' };
    }
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}` : undefined;
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
    });
    if (error) return { success: false, message: error.message };
    if (data?.url) return { success: true, redirectUrl: data.url };
    return { success: false, message: 'Could not get sign-in URL.' };
}

/** Sign in with Facebook. Redirects to Facebook OAuth; on return, use getSupabaseSessionUser() and then onLogin(). */
export async function signInWithFacebook(): Promise<OAuthResult> {
    if (!supabase || !isSupabaseReady()) {
        return { success: false, message: 'Supabase is not configured. Enable Facebook sign-in in your Supabase project.' };
    }
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}` : undefined;
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo },
    });
    if (error) return { success: false, message: error.message };
    if (data?.url) return { success: true, redirectUrl: data.url };
    return { success: false, message: 'Could not get sign-in URL.' };
}

/**
 * Enroll TOTP 2FA for the current Supabase user.
 * Returns { factorId, qrCodeSvg } to show in UI; then call verifyMfaEnrollment(factorId, code) with user's code.
 */
export async function enrollMfa(): Promise<
    { success: true; factorId: string; qrCodeSvg: string } | { success: false; message: string }
> {
    if (!supabase) return { success: false, message: 'Supabase is not configured.' };
    const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'SafeSphere',
    });
    if (error || !data?.id || !data?.totp?.qr_code) {
        return { success: false, message: error?.message || 'Failed to enroll MFA.' };
    }
    return { success: true, factorId: data.id, qrCodeSvg: data.totp.qr_code };
}

/**
 * Verify the TOTP code during enrollment. Call after user scans QR and enters a code.
 */
export async function verifyMfaEnrollment(factorId: string, code: string): Promise<{ success: boolean; message?: string }> {
    if (!supabase) return { success: false, message: 'Supabase is not configured.' };
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !challenge?.id) {
        return { success: false, message: chErr?.message || 'Failed to create challenge.' };
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
    });
    if (verifyErr) return { success: false, message: verifyErr.message || 'Invalid code.' };
    return { success: true };
}

/** List MFA factors for current user (to show enrolled 2FA and allow unenroll). */
export async function listMfaFactors(): Promise<
    { success: true; totp: { id: string; friendly_name?: string }[] } | { success: false; message: string }
> {
    if (!supabase) return { success: false, message: 'Supabase is not configured.' };
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return { success: false, message: error.message };
    const totp = (data?.totp ?? []) as { id: string; friendly_name?: string }[];
    return { success: true, totp };
}

/** Unenroll a TOTP factor. */
export async function unenrollMfa(factorId: string): Promise<{ success: boolean; message?: string }> {
    if (!supabase) return { success: false, message: 'Supabase is not configured.' };
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return { success: false, message: error.message };
    return { success: true };
}

/**
 * Set Face ID enabled in Supabase user_metadata (online storage for real users).
 */
export async function setFaceIdEnabled(enabled: boolean): Promise<{ success: boolean; message?: string }> {
    if (!supabase) return { success: false, message: 'Supabase is not configured.' };
    const { error } = await supabase.auth.updateUser({
        data: { face_id_enabled: enabled },
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
}

/** Get Face ID enabled from current Supabase user metadata. */
export async function getFaceIdEnabled(): Promise<boolean> {
    if (!supabase) return false;
    const { data: { user } } = await supabase.auth.getUser();
    return !!(user?.user_metadata?.face_id_enabled);
}
