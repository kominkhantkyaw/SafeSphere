
import { MOCK_ALERTS, MOCK_CHECKLIST, MOCK_DRILLS, MOCK_INJURIES, MOCK_INVENTORY, MOCK_LEARN_ITEMS, MOCK_REPORTS, MOCK_RESOURCES, MOCK_TUTORIALS, MOCK_USER } from '../constants';
import type { Alert, ChecklistItem, DrillComment, DrillReaction, DrillSession, IncidentReport, InjuryCase, InventoryItem, LearnItem, Resource, Tutorial, User, EarthquakeEvent, SafetyAsset } from '../types';
import { supabase, isSupabaseReady } from './supabase';
import {
    isDemoUser,
    signInWithSupabase,
    signUpWithSupabase,
    verifyEmailOtp,
    resendSignUpConfirmation,
    sendPasswordResetEmail,
} from './auth';
import { enqueueOfflineAction, isOfflineQueueSuppressed } from './offlineQueue';
import { getAuthCaptchaConfig } from '../config/authCaptcha';

const USE_MOCK_DATA = true; // Set to false to use PHP Backend
const API_URL = 'https://safesphere.app/api/api.php';

/** True when online and Supabase is configured - use Supabase for storage */
const useSupabase = (): boolean => typeof navigator !== 'undefined' && navigator.onLine && isSupabaseReady();

/** True when current user is a demo user (Admin/Responder/Reporter) - use localStorage only for shared data */
const isUsingDemoUser = (): boolean => {
    try {
        const saved = localStorage.getItem('safesphere_user');
        if (!saved) return false;
        const user = JSON.parse(saved);
        return user?.email && isDemoUser(user.email);
    } catch { return false; }
};

// Offline storage helper
const getCached = <T>(key: string): T | null => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error("Error reading from localStorage", e);
        return null;
    }
};

const setCached = <T>(key: string, data: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Error writing to localStorage", e);
    }
};

// Demo-only deterministic report IDs for predictable local submissions (string ids match IncidentReport).
const DEMO_REPORT_SEQ_KEY = 'safesphere_demo_report_seq';
function nextDemoReportId(): string {
    const raw = localStorage.getItem(DEMO_REPORT_SEQ_KEY);
    const parsed = raw ? Number(raw) : 0;
    const current = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    localStorage.setItem(DEMO_REPORT_SEQ_KEY, String(current + 1));
    return String(current);
}

function newLocalUserId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- USER MANAGEMENT ---

export const fetchUser = async (): Promise<User> => {
    const saved = localStorage.getItem('safesphere_user');
    if (saved) {
        try {
            const user = JSON.parse(saved);
            if (user?.id) return Promise.resolve(user);
        } catch { /* ignore */ }
    }
    return Promise.resolve({ ...MOCK_USER });
};

const USERS_CACHE_KEY = 'safesphere_users_list_v3';
const RESOURCES_CACHE_KEY = 'safesphere_resources_v6_global_demo'; // Bumped when mock list changes; legacy US rows also stripped in fetchResources
/** Older builds / Supabase seeds that cached US demo facilities */
const LEGACY_RESOURCE_CACHE_KEYS = ['safesphere_resources_v3_peoples_park', 'safesphere_resources_v4_yangon_mmr'] as const;

/**
 * Detect stale US demo resources (old app seeds or Supabase fixtures). SafeSphere targets Yangon — replace with MOCK_RESOURCES.
 */
function shouldReplaceResourcesWithYangonMock(resources: Resource[]): boolean {
    if (!resources?.length) return false;
    for (const r of resources) {
        const addr = (r.address || '').toLowerCase();
        const name = (r.name || '').toLowerCase();
        const phone = r.phone || '';
        if (addr.includes('123 health') || addr.includes('safety blvd') || addr.includes('rescue road')) return true;
        if (addr.includes('medical district') || addr.includes('fire district') || addr.includes('government quarter')) return true;
        if (name.includes('fire station #4')) return true;
        if (name.includes('city general hospital') && (addr.includes('health st') || /555-0\d{3}/.test(phone))) return true;
        if (phone.includes('(555)') || /\b555-0\d{3}\b/.test(phone)) {
            if (r.lat >= 20 && r.lat <= 55 && r.lng <= -50 && r.lng >= -130) return true;
        }
        if (phone.includes('911 /') && r.lng < 0) return true;
    }
    const usLike = resources.filter(
        (r) => r.lat >= 24 && r.lat <= 50 && r.lng <= -65 && r.lng >= -125
    );
    return usLike.length === resources.length && resources.length >= 2;
}

/** Demo login credentials — three roles only: Admin, Responder, Reporter. Passwords for test use only (see README). */
export const DEMO_CREDENTIALS: Array<{ email: string; password: string; user: User }> = [
    { email: 'admin@safesphere.app', password: '20Admin#26!', user: { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Admin', role: 'Admin', safetyScore: 85, xp: 450, email: 'admin@safesphere.app', phone: '+1 555 0123', skills: ['Leadership', 'First Aid'], bloodType: 'O+', volunteerPoints: 120, permissions: ['approve_reports', 'manage_users', 'edit_resources'] } },
    { email: 'responder@safesphere.app', password: '20Responder#26!', user: { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Responder', role: 'Responder', safetyScore: 90, xp: 1200, email: 'responder@safesphere.app', phone: '555-0101', skills: ['CPR', 'Search & Rescue'], bloodType: 'O-', volunteerPoints: 340, permissions: ['approve_reports'] } },
    { email: 'reporter@safesphere.app', password: '20Reporter#26!', user: { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Reporter', role: 'Reporter', safetyScore: 75, xp: 300, email: 'reporter@safesphere.app', skills: ['Driving'], bloodType: 'B+', volunteerPoints: 85, permissions: [] } },
];

/** Authenticate by email and password. Demo users: mock auth. Real users: Supabase Auth (may return requiresMfa). */
export const authenticate = async (
    email: string,
    password: string
): Promise<{ success: boolean; user?: User; message?: string; requiresMfa?: boolean }> => {
    const emailNorm = email.trim().toLowerCase();
    if (isDemoUser(emailNorm)) {
        const cred = DEMO_CREDENTIALS.find(c => c.email.toLowerCase() === emailNorm);
        if (!cred || cred.password !== password) return { success: false, message: 'Invalid email or password.' };
        return { success: true, user: cred.user };
    }
    if (isSupabaseReady()) {
        const result = await signInWithSupabase(email, password);
        if (result.success === false) {
            return { success: false, message: result.message };
        }
        if ('requiresMfa' in result && result.requiresMfa) {
            return { success: true, user: result.user, requiresMfa: true };
        }
        return { success: true, user: result.user };
    }
    return { success: false, message: 'Invalid email or password.' };
};

export const fetchAllUsers = async (): Promise<User[]> => {
    const cached = getCached<User[]>(USERS_CACHE_KEY);
    if (cached) return Promise.resolve(cached);

    const mockUsers: User[] = [
        ...DEMO_CREDENTIALS.map(c => ({ ...c.user, password: c.password })),
        { id: '550e8400-e29b-41d4-a716-446655440005', name: 'Christina Chen', role: 'Responder', safetyScore: 90, xp: 1200, email: 'christina.chen@safesphere.app', phone: '555-0101', skills: ['CPR', 'Search & Rescue'], bloodType: 'O-', volunteerPoints: 340, password: 'Christina123!', permissions: ['approve_reports'] },
        { id: '550e8400-e29b-41d4-a716-446655440006', name: 'Christina', role: 'Reporter', safetyScore: 60, xp: 150, email: 'christina@safesphere.app', phone: '555-0102', bloodType: 'AB+', volunteerPoints: 45, password: 'Christina123!', permissions: [] }
    ];
    setCached(USERS_CACHE_KEY, mockUsers);
    return Promise.resolve(mockUsers);
};

export const saveUser = async (user: Partial<User>): Promise<boolean> => {
    const users = await fetchAllUsers();
    let updatedUsers;
    if (user.id) {
        updatedUsers = users.map(u => u.id === user.id ? { ...u, ...user } : u);
    } else {
        const newUser: User = {
            id: newLocalUserId(),
            name: user.name || 'New User',
            role: user.role || 'Reporter',
            safetyScore: 0,
            xp: 0,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            password: user.password,
            skills: user.skills || [],
            bloodType: user.bloodType,
            volunteerPoints: user.volunteerPoints || 0,
            permissions: user.permissions || [],
            emergencyContactName: user.emergencyContactName,
            emergencyContactPhone: user.emergencyContactPhone
        };
        updatedUsers = [...users, newUser];
    }
    setCached(USERS_CACHE_KEY, updatedUsers);
    return Promise.resolve(true);
};

export const deleteUser = async (id: string): Promise<boolean> => {
    const users = await fetchAllUsers();
    setCached(USERS_CACHE_KEY, users.filter(u => u.id !== id));
    return Promise.resolve(true);
};

// --- PASSWORD RESET ---

const RESET_CODE_KEY = 'safesphere_reset_code';
const RESET_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes

/** Request password reset - Supabase users get a magic link email; demo/local users get a cached 6-digit code. */
export const requestPasswordReset = async (
    method: 'email' | 'sms',
    value: string,
    captchaToken?: string | null
): Promise<{ success: boolean; message: string; linkSent?: boolean }> => {
    const trimmedEmail = value.trim();
    if (method === 'email' && isSupabaseReady() && !isDemoUser(trimmedEmail)) {
        const supa = await sendPasswordResetEmail(trimmedEmail, captchaToken);
        if (supa.success) {
            return {
                success: true,
                message:
                    `If an account exists for ${trimmedEmail}, we have sent a password reset link. Open that email and follow the link to set a new password. Check your spam folder.`,
                linkSent: true,
            };
        }
        const resetFail =
            supa.message || 'Could not send reset email. Check Supabase Auth email (SMTP) settings.';
        const resetHint =
            typeof window !== 'undefined'
                ? ` Ensure "${window.location.origin}/" is in Authentication → URL Configuration → Redirect URLs.`
                : '';
        return { success: false, message: `${resetFail}${resetHint}` };
    }

    const users = await fetchAllUsers();
    const normalizedValue = value.trim().toLowerCase();

    let user: User | undefined;
    if (method === 'email') {
        user = users.find(u => u.email?.toLowerCase() === normalizedValue);
        if (!user) return { success: false, message: 'No account found with this email address.' };
    } else {
        const phoneNorm = value.replace(/\D/g, '');
        user = users.find(u => u.phone && u.phone.replace(/\D/g, '') === phoneNorm);
        if (!user) return { success: false, message: 'No account found with this phone number.' };
    }

    // Generate 6-digit code (for demo: 123456 for admin; random for others - log to console for testing)
    const code = user.email?.toLowerCase() === 'admin@safesphere.app' ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
    if (process.env.NODE_ENV === 'development' && code !== '123456') {
        console.log('[Demo] Password reset code:', code);
    }
    setCached(RESET_CODE_KEY, {
        code,
        userId: user.id,
        expiresAt: Date.now() + RESET_CODE_EXPIRY,
        method,
        value: method === 'email' ? user.email : user.phone,
    });

    return {
        success: true,
        message: method === 'email'
            ? `A 6-digit code has been sent to ${user.email}. Check your inbox.`
            : `A 6-digit code has been sent to ${user.phone}. Check your messages.`,
        linkSent: false,
    };
};

/** Verify code and reset password */
export const resetPasswordWithCode = async (code: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const stored = getCached<{ code: string; userId: string; expiresAt: number }>(RESET_CODE_KEY);
    if (!stored) return { success: false, message: 'No reset request found. Please request a new code.' };
    if (Date.now() > stored.expiresAt) return { success: false, message: 'Code has expired. Please request a new code.' };
    if (stored.code !== code.trim()) return { success: false, message: 'Invalid code. Please try again.' };
    if (newPassword.length < 6) return { success: false, message: 'Password must be at least 6 characters.' };

    const users = await fetchAllUsers();
    const user = users.find(u => u.id === stored.userId);
    if (!user) return { success: false, message: 'Account not found.' };

    await saveUser({ id: user.id, password: newPassword });
    try { localStorage.removeItem(RESET_CODE_KEY); } catch { /* ignore */ }
    return { success: true, message: 'Password has been reset successfully. You can now sign in.' };
};

// --- REQUEST ACCOUNT / REGISTRATION ---

export interface PendingRegistration {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    token: string;
    expiresAt: number;
}

const PENDING_REG_KEY = 'safesphere_pending_registrations';

function isCaptchaRelatedAuthMessage(msg: string | null | undefined): boolean {
    if (!msg) return false;
    return /captcha|hcaptcha|turnstile|bot protection|challenge|sitekey|secret.?mismatch|request disallowed/i.test(
        msg
    );
}

function isCaptchaSiteSecretMismatchMessage(msg: string | null | undefined): boolean {
    if (!msg) return false;
    return /sitekey[\s_-]*secret[\s_-]*mismatch/i.test(msg);
}

export type SignUpEmailIssueKind = 'captcha' | 'captcha_mismatch' | 'smtp' | 'config';

/** Request a new account — creates user in Supabase Auth (email confirmation) + optional SMS. */
export const requestAccount = async (data: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    captchaToken?: string | null;
}): Promise<{
    success: boolean;
    message: string;
    emailDeliveryHint?: string | null;
    /** Why the confirmation email path failed — drives accurate UI copy (captcha ≠ SMTP). */
    signUpEmailIssueKind?: SignUpEmailIssueKind | null;
    registrationComplete?: boolean;
    registeredUser?: User;
}> => {
    const users = await fetchAllUsers();
    const emailNorm = data.email.trim().toLowerCase();
    if (users.some(u => u.email?.toLowerCase() === emailNorm)) {
        return { success: false, message: 'An account with this email already exists.' };
    }
    const usernameNorm = data.username.trim().toLowerCase();
    if (users.some(u => u.username?.toLowerCase() === usernameNorm)) {
        return { success: false, message: 'This username is already taken.' };
    }
    if (data.password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters.' };
    }
    const phoneTrim = data.phone.trim();
    if (!phoneTrim) {
        return { success: false, message: 'Please enter your phone number (with country code).' };
    }

    // Local fallback code only when Supabase sign-up fails (must match Resend Edge Function body)
    const fallbackToken = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // ── PRIMARY: Supabase Auth signUp (sends confirmation email with *its* OTP when enabled) ──
    let supabaseSignupOk = false;
    let signUpErrorMessage: string | null = null;
    if (isSupabaseReady()) {
        const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();
        const signUpResult = await signUpWithSupabase(
            data.email.trim(),
            data.password,
            {
                name: fullName,
                role: 'Reporter',
                phone: phoneTrim,
            },
            data.captchaToken
        );
        if (signUpResult.success === false) {
            const failMsg = signUpResult.message;
            signUpErrorMessage = failMsg;
            if (import.meta.env.DEV) {
                console.warn('[Auth] Supabase signUp error:', failMsg);
            }
            if (failMsg.includes('already registered') || failMsg.includes('already been registered')) {
                await resendSignUpConfirmation(data.email.trim(), data.captchaToken).catch(() => {});
                supabaseSignupOk = true;
                signUpErrorMessage = null;
            }
        } else {
            if (!signUpResult.needsEmailConfirmation) {
                const users = await fetchAllUsers();
                const sb = signUpResult.user;
                const displayName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim() || sb.name;
                const newUser: User = {
                    ...sb,
                    id: sb.id,
                    name: displayName,
                    username: data.username.trim(),
                    phone: data.phone.trim() || sb.phone,
                    email: data.email.trim(),
                    password: undefined,
                };
                if (!users.some(u => u.id === newUser.id)) {
                    setCached(USERS_CACHE_KEY, [...users, newUser]);
                }
                const allPending = getCached<PendingRegistration[]>(PENDING_REG_KEY) || [];
                setCached(
                    PENDING_REG_KEY,
                    allPending.filter((p) => p.email.toLowerCase() !== emailNorm)
                );
                return {
                    success: true,
                    message:
                        'Your account is ready. You are signed in on this device — you can use the app now, or sign out and sign in again anytime.',
                    emailDeliveryHint: null,
                    registrationComplete: true,
                    registeredUser: newUser,
                };
            }
            supabaseSignupOk = true;
            signUpErrorMessage = null;
            if (import.meta.env.DEV) {
                console.log('[Auth] Supabase user created. Email confirmation required:',
                    signUpResult.needsEmailConfirmation);
            }
        }
    }

    // When Supabase succeeded, do not store a fake local code — it does not match the email OTP.
    const tokenForPending = supabaseSignupOk ? '' : fallbackToken;
    const pending: PendingRegistration = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        username: data.username.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        password: data.password,
        token: tokenForPending,
        expiresAt,
    };

    const all = getCached<PendingRegistration[]>(PENDING_REG_KEY) || [];
    const filtered = all.filter(p => p.email.toLowerCase() !== emailNorm);
    setCached(PENDING_REG_KEY, [...filtered, pending]);

    // Branded 6-digit email via Resend only for *fallback* flow (Supabase sign-up failed)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    const skipEdgeFallback =
        !supabaseSignupOk && isCaptchaRelatedAuthMessage(signUpErrorMessage);

    if (supabaseUrl && anonKey && !supabaseSignupOk && !skipEdgeFallback) {
        try {
            const res = await fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${anonKey}`,
                },
                body: JSON.stringify({ email: data.email.trim(), code: fallbackToken }),
            });
            const result = await res.json().catch(() => ({})) as { success?: boolean; message?: string };
            if (import.meta.env.DEV && !result.success) {
                console.info('[Registration] Resend Edge Function:', result.message || res.status);
            }
        } catch {
            /* Edge Function missing — dev may rely on console code */
        }
    }

    if (import.meta.env.DEV) {
        if (tokenForPending) {
            console.log('[Dev] Fallback 6-digit code (only valid if Supabase sign-up failed):', tokenForPending, '|', data.email);
        } else {
            console.log('[Dev] Use the 6-digit code from the Supabase confirmation email:', data.email);
        }
    }

    const redirectUrlHint =
        typeof window !== 'undefined'
            ? ` Add "${window.location.origin}/" under Authentication → URL Configuration → Redirect URLs (and matching Site URL) so confirmation and reset emails link back to this app.`
            : '';

    const captchaBlocked = !supabaseSignupOk && isCaptchaRelatedAuthMessage(signUpErrorMessage);
    const signupCaptchaCfg = getAuthCaptchaConfig();
    const signupHasCaptchaSiteKey = !!signupCaptchaCfg;
    const signupCaptchaSecretMismatch =
        captchaBlocked && signupHasCaptchaSiteKey && isCaptchaSiteSecretMismatchMessage(signUpErrorMessage);

    let emailDeliveryHint: string | null = null;
    let signUpEmailIssueKind: SignUpEmailIssueKind | null = null;

    if (!isSupabaseReady()) {
        emailDeliveryHint =
            'Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY so confirmation emails can be sent from your project.';
        signUpEmailIssueKind = 'config';
    } else if (!supabaseSignupOk) {
        signUpEmailIssueKind = captchaBlocked
            ? signupCaptchaSecretMismatch
                ? 'captcha_mismatch'
                : 'captcha'
            : 'smtp';
        if (captchaBlocked) {
            if (signupHasCaptchaSiteKey) {
                if (signupCaptchaSecretMismatch) {
                    const prov = signupCaptchaCfg!.provider === 'turnstile' ? 'Turnstile' : 'hCaptcha';
                    const envKey =
                        signupCaptchaCfg!.provider === 'turnstile'
                            ? 'VITE_TURNSTILE_SITE_KEY'
                            : 'VITE_HCAPTCHA_SITE_KEY';
                    emailDeliveryHint =
                        `Supabase rejected the captcha (${signUpErrorMessage || 'sitekey-secret-mismatch'}): the ${prov} secret stored under Authentication → Attack Protection does not belong to the same ${prov} site as ${envKey} in your environment. Open your ${prov} dashboard, find the site that owns this site key, copy its secret into Supabase, and ensure Attack Protection is set to ${prov} (not the other provider). Restart the dev server after changing .env.local.`;
                } else {
                    emailDeliveryHint =
                        `Supabase refused sign-up (${signUpErrorMessage || 'captcha verification failed'}). No confirmation email is sent until sign-up succeeds. Complete the captcha widget again (tokens expire quickly), then tap Request Account once more. If this persists, confirm the same provider (Turnstile vs hCaptcha) is selected in Supabase as in your .env.local.`;
                }
            } else {
                emailDeliveryHint = `Supabase Bot Protection is on, but this app has no captcha site key. Add VITE_HCAPTCHA_SITE_KEY or VITE_TURNSTILE_SITE_KEY to .env.local (match the provider in Authentication → Attack Protection), restart the dev server, complete the challenge on the form, and register again. Alternatively turn off Bot Protection in Supabase. Until sign-up succeeds, nothing is sent to ${data.email.trim()}.`;
            }
        } else {
            emailDeliveryHint =
                `Sign-up could not be completed: ${signUpErrorMessage || 'Unknown error.'} If you deployed send-confirmation-email with Resend, check RESEND_API_KEY, RESEND_FROM (verified domain), and Supabase function logs. Confirm Authentication → Emails uses working SMTP (built-in or Custom SMTP to Resend).${redirectUrlHint}`;
        }
    }

    const failureMessage = captchaBlocked
        ? !signupHasCaptchaSiteKey
            ? `Registration did not complete, so nothing was sent to ${data.email.trim()} yet. With Bot Protection enabled, add the matching captcha site key to .env.local (see .env.example), restart the dev server, complete the challenge, and try again — or turn protection off in Supabase while testing.`
            : signupCaptchaSecretMismatch
              ? `Registration did not complete, so nothing was sent to ${data.email.trim()} yet. Your app’s captcha site key and the secret in Supabase are not a pair — fix Authentication → Attack Protection (details below), then try again.`
              : `Registration did not complete, so nothing was sent to ${data.email.trim()} yet. Complete the captcha on the form and tap Request Account again, or turn Bot Protection off in Supabase while testing.`
        : `We could not create your account in the hosted sign-up service. A 6-digit code was sent only if the Resend email function is working — otherwise check the browser console in development.`;

    return {
        success: true,
        message: supabaseSignupOk
            ? `We have sent a confirmation email to ${data.email.trim()}. Open it and enter the 6-digit code here (or use the confirmation link). Check your spam folder.`
            : failureMessage,
        emailDeliveryHint,
        signUpEmailIssueKind,
    };
};

/** Confirm account — verifies with Supabase Auth OTP first, then falls back to local token. */
export const confirmAccount = async (email: string, token: string): Promise<{ success: boolean; message: string; user?: User }> => {
    const emailNorm = email.trim().toLowerCase();
    const all = getCached<PendingRegistration[]>(PENDING_REG_KEY) || [];
    const pending = all.find(p => p.email.toLowerCase() === emailNorm);

    if (!pending) {
        return { success: false, message: 'No pending registration found. Please request a new account.' };
    }
    if (Date.now() > pending.expiresAt) {
        setCached(PENDING_REG_KEY, all.filter(p => p.email.toLowerCase() !== emailNorm));
        return { success: false, message: 'Your code has expired. Please request a new account.' };
    }

    // ── Try Supabase Auth OTP verification first (email type) ──
    if (isSupabaseReady()) {
        const otpResult = await verifyEmailOtp(email, token);
        if (otpResult.success === false) {
            if (import.meta.env.DEV) {
                console.warn('[Auth] Supabase OTP verification failed, trying local token:', otpResult.message);
            }
        } else {
            const users = await fetchAllUsers();
            const sb = otpResult.user;
            const displayName = `${pending.firstName} ${pending.lastName}`.trim() || sb.name;
            const newUser: User = {
                ...sb,
                id: sb.id,
                name: displayName,
                username: pending.username,
                phone: pending.phone || sb.phone,
                email: pending.email,
                password: undefined,
            };
            setCached(USERS_CACHE_KEY, [...users, newUser]);
            setCached(PENDING_REG_KEY, all.filter(p => p.email.toLowerCase() !== emailNorm));
            return {
                success: true,
                message: 'Your account has been confirmed. You can now sign in with your email and password.',
                user: newUser,
            };
        }
    }

    // ── Fallback: local 6-digit token (only when Supabase sign-up failed at registration) ──
    if (!pending.token) {
        return {
            success: false,
            message:
                'Invalid or expired code. Use the 6-digit code from your confirmation email, or tap “Resend confirmation code” to get a new email from the sign-up service.',
        };
    }
    if (pending.token !== token) {
        return { success: false, message: 'Invalid or expired code. Please check the 6-digit code or request a new one.' };
    }

    const users = await fetchAllUsers();
    const newUser: User = {
        id: newLocalUserId(),
        name: `${pending.firstName} ${pending.lastName}`.trim(),
        role: 'Reporter',
        safetyScore: 0,
        xp: 0,
        email: pending.email,
        username: pending.username,
        phone: pending.phone || undefined,
        password: pending.password,
        skills: [],
        volunteerPoints: 0,
        permissions: [],
    };
    const updatedUsers = [...users, newUser];
    setCached(USERS_CACHE_KEY, updatedUsers);
    setCached(PENDING_REG_KEY, all.filter(p => p.email.toLowerCase() !== emailNorm));

    return {
        success: true,
        message: 'Your account has been confirmed. You can now sign in.',
        user: newUser,
    };
};

/** Get pending registration by email (for "Confirm & Sign In" flow when token in URL or stored). */
export const getPendingRegistration = (email: string): PendingRegistration | null => {
    const emailNorm = email.trim().toLowerCase();
    const all = getCached<PendingRegistration[]>(PENDING_REG_KEY) || [];
    return all.find(p => p.email.toLowerCase() === emailNorm) || null;
};

/**
 * Resend sign-up confirmation: Supabase Auth email first (correct OTP), then Resend Edge Function if a local fallback token exists.
 */
export const resendSixDigitConfirmationEmail = async (
    email: string,
    captchaToken?: string | null
): Promise<{ success: boolean; message: string }> => {
    const pending = getPendingRegistration(email);
    if (!pending) {
        return {
            success: false,
            message: 'No pending registration found. Please start registration again.',
        };
    }
    if (Date.now() > pending.expiresAt) {
        return {
            success: false,
            message: 'Your code has expired. Please request a new account.',
        };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    const errors: string[] = [];

    if (isSupabaseReady()) {
        const supa = await resendSignUpConfirmation(email.trim(), captchaToken);
        if (supa.success) {
            return {
                success: true,
                message: 'Another confirmation email was sent. Use the 6-digit code from that message (or the link inside it).',
            };
        }
        const supaMsg = supa.message || 'Sign-up service could not resend email.';
        if (isCaptchaRelatedAuthMessage(supaMsg)) {
            return {
                success: false,
                message: `${supaMsg} Complete the security check on this page, then tap Resend again.`,
            };
        }
        errors.push(supaMsg);
    }

    if (pending.token && supabaseUrl && anonKey) {
        try {
            const res = await fetch(`${supabaseUrl}/functions/v1/send-confirmation-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${anonKey}`,
                },
                body: JSON.stringify({ email: pending.email.trim(), code: pending.token }),
            });
            const result = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
            if (res.ok && result.success) {
                return {
                    success: true,
                    message: 'A 6-digit code was sent via your Resend integration. Enter that code below.',
                };
            }
            errors.push(result.message || `Resend function returned ${res.status}.`);
        } catch {
            errors.push('Could not reach the send-confirmation-email Edge Function.');
        }
    } else if (!pending.token && errors.length > 0) {
        return {
            success: false,
            message: errors.join(' '),
        };
    }

    return {
        success: false,
        message:
            errors.join(' ') ||
            'Could not resend email. In Supabase: Authentication → Emails — enable Custom SMTP (Resend) or fix built-in mail; deploy send-confirmation-email with RESEND_API_KEY if you use the branded code path.',
    };
};

// --- ALERTS ---

const ALERTS_CACHE_KEY = 'safesphere_alerts_v2'; // Bumped: added tsunami, volcano, hurricane, storm types

function mergeFetchedAlertsWithCache(server: Alert[], cached: Alert[] | null | undefined): Alert[] {
    if (!cached?.length) return server;
    const serverById = new Set(server.map((a) => a.id));
    // Preserve any locally-created alerts that aren't present on the server response yet.
    const missingFromServer = cached.filter((a) => !serverById.has(a.id));
    const merged = [...missingFromServer, ...server];
    return merged.sort((a, b) => b.id - a.id);
}

export const fetchAlerts = async (): Promise<Alert[]> => {
    // For demo accounts, keep alerts purely local so new broadcasts don't vanish on refresh.
    // (Admin/Responder/Reporter demo roles must see the same active alerts list.)
    if (isUsingDemoUser()) {
        const cached = getCached<Alert[]>(ALERTS_CACHE_KEY);
        if (cached?.length) return cached;
        setCached(ALERTS_CACHE_KEY, MOCK_ALERTS);
        return MOCK_ALERTS;
    }

    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('alerts').select('*').order('id', { ascending: false });
            if (!error && data && data.length > 0) {
                const serverAlerts = data as Alert[];
                const cached = getCached<Alert[]>(ALERTS_CACHE_KEY);
                const merged = mergeFetchedAlertsWithCache(serverAlerts, cached);
                setCached(ALERTS_CACHE_KEY, merged);
                return merged;
            }
        } catch { /* fallback */ }
    }
    if (!USE_MOCK_DATA) {
        try {
            const res = await fetch(`${API_URL}?action=getAlerts`);
            const data = await res.json();
            const cached = getCached<Alert[]>(ALERTS_CACHE_KEY);
            const merged = mergeFetchedAlertsWithCache(data as Alert[], cached);
            setCached(ALERTS_CACHE_KEY, merged);
            return merged;
        } catch { /* fallback */ }
    }
    const cached = getCached<Alert[]>(ALERTS_CACHE_KEY);
    if (cached?.length) return cached;
    setCached(ALERTS_CACHE_KEY, MOCK_ALERTS);
    return MOCK_ALERTS;
};

export const submitAlert = async (data: Partial<Alert>): Promise<boolean> => {
    const id = data.id ?? Math.floor(Date.now());
    // Always include a full, parseable date-time so Home’s sorter can rank it correctly.
    const timestamp =
        data.timestamp ??
        new Date().toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });

    const newAlert: Alert = {
        id,
        title: data.title ?? '',
        description: data.description ?? '',
        severity: data.severity ?? 'low',
        timestamp,
        type: data.type ?? 'general',
        archived: Boolean(data.archived),
        resolved: Boolean(data.resolved),
    };

    // Demo: persist locally only (mirrors fetchAlerts() demo behaviour).
    if (isUsingDemoUser()) {
        const current = getCached<Alert[]>(ALERTS_CACHE_KEY) ?? MOCK_ALERTS;
        const updated = [newAlert, ...current.filter((a) => a.id !== newAlert.id)].sort((a, b) => b.id - a.id);
        setCached(ALERTS_CACHE_KEY, updated);
        return true;
    }

    // Optimistic update so the sender sees the alert immediately.
    const current = await fetchAlerts();
    const updated = [newAlert, ...current.filter((a) => a.id !== newAlert.id)].sort((a, b) => b.id - a.id);
    setCached(ALERTS_CACHE_KEY, updated);

    if (useSupabase() && supabase) {
        try {
            await supabase.from('alerts').upsert({
                id: newAlert.id,
                title: newAlert.title,
                description: newAlert.description,
                severity: newAlert.severity,
                timestamp: newAlert.timestamp,
                type: newAlert.type,
            });
        } catch {
            // Saved locally via cache; the alert will still show until the next reload.
        }
    }

    return true;
};

export const updateAlert = async (id: number, updates: Partial<Alert>): Promise<boolean> => {
    const current = await fetchAlerts();
    const existing = current.find((a) => a.id === id);

    const updatedAlert: Alert = {
        ...(existing ?? {
            id,
            title: '',
            description: '',
            severity: 'low',
            timestamp: new Date().toLocaleString('en-GB'),
            type: 'general',
        }),
        ...updates,
        id,
        archived: updates.archived ?? existing?.archived ?? false,
        resolved: updates.resolved ?? existing?.resolved ?? false,
    };

    const updated = current.map((a) => (a.id === id ? updatedAlert : a)).sort((a, b) => b.id - a.id);
    setCached(ALERTS_CACHE_KEY, updated);

    if (isUsingDemoUser()) return true;

    if (useSupabase() && supabase) {
        try {
            await supabase.from('alerts').upsert({
                id: updatedAlert.id,
                title: updatedAlert.title,
                description: updatedAlert.description,
                severity: updatedAlert.severity,
                timestamp: updatedAlert.timestamp,
                type: updatedAlert.type,
            });
        } catch {
            // If backend update fails (e.g., column mismatch), keep local edits visible.
        }
    }
    return true;
};

export const archiveAlert = async (id: number, archived = true): Promise<boolean> => {
    const current = await fetchAlerts();
    const updated = current
        .map((a) => (a.id === id ? { ...a, archived: Boolean(archived) } : a))
        .sort((a, b) => b.id - a.id);
    setCached(ALERTS_CACHE_KEY, updated);

    if (isUsingDemoUser()) return true;

    if (useSupabase() && supabase) {
        try {
            // Best-effort: only works if alerts table has an "archived" column.
            await supabase.from('alerts').update({ archived: Boolean(archived) }).eq('id', id);
        } catch {
            // Column might not exist in the DB yet; local archive still works for this browser.
        }
    }
    return true;
};

export const deleteAlert = async (id: number): Promise<boolean> => {
    // Demo users: keep deletes purely local to avoid “gone after refresh” issues.
    if (isUsingDemoUser()) {
        const cached = getCached<Alert[]>(ALERTS_CACHE_KEY) ?? MOCK_ALERTS;
        const updated = cached.filter((a) => a.id !== id);
        setCached(ALERTS_CACHE_KEY, updated);
        return true;
    }

    const current = await fetchAlerts();
    const updated = current.filter((a) => a.id !== id);
    setCached(ALERTS_CACHE_KEY, updated);

    if (useSupabase() && supabase) {
        try {
            await supabase.from('alerts').delete().eq('id', id);
        } catch {
            // If backend delete fails, local cache still updates; the next fetch will reconcile.
        }
    }

    return true;
};

export const setAlertResolved = async (id: number, resolved = true): Promise<boolean> => {
    const current = await fetchAlerts();
    const updated = current
        .map((a) => (a.id === id ? { ...a, resolved: Boolean(resolved) } : a))
        .sort((a, b) => b.id - a.id);
    setCached(ALERTS_CACHE_KEY, updated);

    if (isUsingDemoUser()) return true;

    if (useSupabase() && supabase) {
        try {
            // Best-effort if DB column exists.
            await supabase.from('alerts').update({ resolved: Boolean(resolved) }).eq('id', id);
        } catch {
            // Local-only update.
        }
    }
    return true;
};

// --- RESOURCES ---

// safesphere_postgres uses camelCase: operatingHours, contactPerson, contactPhone, inFloodZone
const toResource = (row: Record<string, unknown>): Resource => ({
    id: row.id as number,
    name: row.name as string,
    type: row.type as Resource['type'],
    address: row.address as string,
    description: row.description as string | undefined,
    phone: row.phone as string,
    lat: row.lat as number,
    lng: row.lng as number,
    capacity: row.capacity as number | undefined,
    occupancy: row.occupancy as number | undefined,
    operatingHours: (row.operatingHours ?? row.operating_hours) as string | undefined,
    notes: row.notes as string | undefined,
    contactPerson: (row.contactPerson ?? row.contact_person) as string | undefined,
    contactPhone: (row.contactPhone ?? row.contact_phone) as string | undefined,
    urgency: (row.urgency as Resource['urgency']) || 'Low',
    inFloodZone: (row.inFloodZone ?? row.in_flood_zone) as boolean | undefined,
});

export const fetchResources = async (): Promise<Resource[]> => {
    try {
        for (const k of LEGACY_RESOURCE_CACHE_KEYS) {
            localStorage.removeItem(k);
        }
    } catch { /* ignore */ }

    const useYangonMock = (): Resource[] => {
        setCached(RESOURCES_CACHE_KEY, MOCK_RESOURCES);
        return MOCK_RESOURCES;
    };

    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('resources').select('*').order('id');
            if (!error && data && data.length > 0) {
                const items = data.map(toResource);
                if (shouldReplaceResourcesWithYangonMock(items)) {
                    return useYangonMock();
                }
                setCached(RESOURCES_CACHE_KEY, items);
                return items;
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<Resource[]>(RESOURCES_CACHE_KEY);
    if (cached?.length) {
        if (shouldReplaceResourcesWithYangonMock(cached)) {
            return useYangonMock();
        }
        return cached;
    }
    if (USE_MOCK_DATA) {
        return useYangonMock();
    }
    try {
        const res = await fetch(`${API_URL}?action=getResources`);
        const data = await res.json();
        setCached(RESOURCES_CACHE_KEY, data);
        return data;
    } catch {
        return getCached<Resource[]>(RESOURCES_CACHE_KEY) || [];
    }
};

export const submitResource = async (data: Partial<Resource>): Promise<boolean> => {
    const resourceId = data.id || Math.floor(Math.random() * 1000000);
    const newResource: Resource = {
        id: resourceId,
        name: data.name || 'New Resource',
        type: data.type || 'shelter',
        address: data.address || '',
        description: data.description,
        phone: data.phone || '',
        lat: data.lat || 0,
        lng: data.lng || 0,
        capacity: data.capacity,
        occupancy: data.occupancy || 0,
        operatingHours: data.operatingHours,
        notes: data.notes,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        urgency: data.urgency || 'Low',
        inFloodZone: data.inFloodZone
    };
    const current = await fetchResources();
    const updated = data.id ? current.map(r => r.id === resourceId ? newResource : r) : [newResource, ...current];
    setCached(RESOURCES_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('resources').upsert({
                id: newResource.id, name: newResource.name, type: newResource.type, address: newResource.address,
                description: newResource.description, phone: newResource.phone, lat: newResource.lat, lng: newResource.lng,
                capacity: newResource.capacity, occupancy: newResource.occupancy, operatingHours: newResource.operatingHours,
                notes: newResource.notes, contactPerson: newResource.contactPerson, contactPhone: newResource.contactPhone,
                urgency: newResource.urgency, inFloodZone: newResource.inFloodZone
            });
        } catch { /* saved locally */ }
    }
    return true;
};

export const deleteResource = async (id: number): Promise<boolean> => {
    const current = await fetchResources();
    const updated = current.filter(r => r.id !== id);
    setCached(RESOURCES_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('resources').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

// --- INCIDENT REPORTS ---

const REPORTS_CACHE_KEY = 'safesphere_reports_v6_myanmar';

// safesphere_postgres uses camelCase columns for incident_reports
const REPORT_STATUSES: IncidentReport['status'][] = [
    'pending',
    'active',
    'resolved',
    'approved',
    'info_requested',
    'delayed',
    'rejected',
    'en_route',
    'on_scene',
];

/** DB / sync may use different casing or legacy labels — map into app statuses. */
const STATUS_ALIASES: Record<string, IncidentReport['status']> = {
    new: 'pending',
    completed: 'resolved',
    closed: 'resolved',
    done: 'resolved',
    archived: 'resolved',
    archive: 'resolved',
    accepted: 'active',
};

const normaliseReportStatus = (raw: unknown): IncidentReport['status'] => {
    if (raw == null) return 'pending';
    const s0 = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
    if (STATUS_ALIASES[s0]) return STATUS_ALIASES[s0];
    if ((REPORT_STATUSES as string[]).includes(s0)) return s0 as IncidentReport['status'];
    return 'pending';
};

/** Monotonic response workflow — merge prefers local row when it is ahead of stale server data. */
const STATUS_PROGRESS: Record<string, number> = {
    pending: 1,
    info_requested: 2,
    delayed: 3,
    active: 4,
    approved: 4,
    en_route: 5,
    on_scene: 6,
    resolved: 10,
    rejected: 10,
};

function incidentStatusProgress(status: string | undefined): number {
    const s = (status || 'pending').toLowerCase();
    return STATUS_PROGRESS[s] ?? 0;
}

/** After status updates, Supabase may lag; avoid replacing cache with older server rows (e.g. missing “resolved”). */
function mergeFetchedReportsWithCache(
    server: IncidentReport[],
    cached: IncidentReport[] | null | undefined
): IncidentReport[] {
    if (!cached?.length) return server;
    const serverById = new Map(server.map((r) => [r.id, r]));
    const merged = new Map<string, IncidentReport>();
    for (const r of server) merged.set(r.id, { ...r });
    for (const c of cached) {
        const s = serverById.get(c.id);
        if (!s) {
            merged.set(c.id, { ...c });
            continue;
        }
        const ps = incidentStatusProgress(s.status);
        const pc = incidentStatusProgress(c.status);
        if (pc > ps) {
            merged.set(c.id, {
                ...s,
                status: c.status,
                adminNotes: c.adminNotes ?? s.adminNotes,
                // Server rows often omit reporter_id; keep identity from cache so reporters still see History.
                reporterId: s.reporterId != null ? s.reporterId : c.reporterId,
                contactPerson: s.contactPerson ?? c.contactPerson,
                contactPhone: s.contactPhone ?? c.contactPhone,
                contactEmail: s.contactEmail ?? c.contactEmail,
            });
        }
    }
    let result = Array.from(merged.values()).sort((a, b) =>
        (b.timestamp || '').localeCompare(a.timestamp || '')
    );
    if (!cached?.length) return result;
    const cacheById = new Map(cached.map((c) => [c.id, c]));
    result = result.map((r) => {
        const c = cacheById.get(r.id);
        if (!c) return r;
        // Preserve reporter identity from cache when server data is incomplete or stale.
        // This ensures "My submissions / History" shows rejected/resolved items correctly.
        if (c.reporterId == null) return r;
        return {
            ...r,
            reporterId: c.reporterId,
            contactPerson: r.contactPerson ?? c.contactPerson,
            contactPhone: r.contactPhone ?? c.contactPhone,
            contactEmail: r.contactEmail ?? c.contactEmail,
        };
    });
    return result;
}

const toReport = (row: Record<string, unknown>): IncidentReport => ({
    id: row.id != null ? String(row.id) : '',
    type: row.type as string,
    description: row.description as string,
    lat: row.lat as number,
    lng: row.lng as number,
    status: normaliseReportStatus(row.status),
    timestamp: row.timestamp as string,
    urgency: row.urgency as IncidentReport['urgency'],
    department: row.department as string | undefined,
    structuralDamage: (row.structuralDamage ?? row.structural_damage) as string | undefined,
    estRepairDays: (row.estRepairDays ?? row.est_repair_days) as number | undefined,
    estCost: (row.estCost ?? row.est_cost) as number | undefined,
    repeatable: row.repeatable as boolean | undefined,
    situationDiscussed: (row.situationDiscussed ?? row.situation_discussed) as boolean | undefined,
    mitigationPlan: (row.mitigationPlan ?? row.mitigation_plan) as string | undefined,
    contactPerson: (row.contactPerson ?? row.contact_person) as string | undefined,
    contactPhone: (row.contactPhone ?? row.contact_phone) as string | undefined,
    contactEmail: (row.contactEmail ?? row.contact_email) as string | undefined,
    image: row.image as string | undefined,
    video: row.video as string | undefined,
    audio: row.audio as string | undefined,
    adminNotes: (row.adminNotes ?? row.admin_notes) as string | undefined,
    comments: row.comments as IncidentReport['comments'],
    reporterId: (row.reporterId ?? row.reporter_id) as string | undefined,
    locationSource: (row.locationSource ?? row.location_source) as IncidentReport['locationSource'],
});

const toReportRow = (r: IncidentReport): Record<string, unknown> => ({
    id: r.id, type: r.type, description: r.description, lat: r.lat, lng: r.lng, status: r.status, timestamp: r.timestamp,
    urgency: r.urgency, department: r.department, structuralDamage: r.structuralDamage, estRepairDays: r.estRepairDays,
    estCost: r.estCost, repeatable: r.repeatable, situationDiscussed: r.situationDiscussed, mitigationPlan: r.mitigationPlan,
    contactPerson: r.contactPerson, contactPhone: r.contactPhone, contactEmail: r.contactEmail, image: r.image, video: r.video, audio: r.audio,
    adminNotes: r.adminNotes,
    /** Persisted so History → “My submissions” can filter after responder updates (was missing before). */
    reporterId: r.reporterId,
});

const toReportRowForInsert = (r: IncidentReport): Record<string, unknown> => {
    const row = toReportRow(r);
    delete row.id;  // Omit id to allow PostgreSQL SERIAL auto-generation
    return row;
};

export const fetchReports = async (): Promise<IncidentReport[]> => {
    // Demo accounts should not overwrite their locally submitted reports
    // with whatever is currently stored in Supabase.
    if (!isUsingDemoUser() && useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('incident_reports').select('*').order('id', { ascending: false });
            if (!error && data != null) {
                const serverItems = (data as Record<string, unknown>[]).map(toReport);
                const cached = getCached<IncidentReport[]>(REPORTS_CACHE_KEY);
                const merged = mergeFetchedReportsWithCache(serverItems, cached);
                setCached(REPORTS_CACHE_KEY, merged);
                return merged;
            }
        } catch { /* fallback */ }
    }

    // Demo mode: do not overwrite local cache with MOCK_REPORTS once the key exists.
    // This prevents "report disappears" issues when switching between screens.
    if (isUsingDemoUser()) {
        const raw = localStorage.getItem(REPORTS_CACHE_KEY);
        const cached = getCached<IncidentReport[]>(REPORTS_CACHE_KEY);

        // First run: initialise with mock baseline.
        if (raw == null) {
            setCached(REPORTS_CACHE_KEY, MOCK_REPORTS);
            return MOCK_REPORTS;
        }

        // Key exists already: return whatever we can parse (or empty if parse fails).
        return cached ?? [];
    }

    const cached = getCached<IncidentReport[]>(REPORTS_CACHE_KEY);
    if (cached?.length) return cached;
    if (USE_MOCK_DATA) {
        setCached(REPORTS_CACHE_KEY, MOCK_REPORTS);
        return MOCK_REPORTS;
    }
    try {
        const res = await fetch(`${API_URL}?action=getReports`);
        const data = await res.json();
        setCached(REPORTS_CACHE_KEY, data);
        return data;
    } catch {
        return cached || [];
    }
};

export const submitReport = async (data: Partial<IncidentReport>): Promise<boolean> => {
    const reportId = isUsingDemoUser()
        ? nextDemoReportId()
        : (data.id != null && data.id !== '' ? String(data.id) : String(Math.floor(Math.random() * 1_000_000)));
    // Ensure reporterId exists so History → "My Submissions" can filter correctly.
    let resolvedReporterId = data.reporterId;
    if (resolvedReporterId == null) {
        try {
            const saved = localStorage.getItem('safesphere_user');
            const parsed = saved ? JSON.parse(saved) : null;
            if (parsed?.id != null) resolvedReporterId = parsed.id as string;
        } catch { /* ignore */ }
    }
    const newReport: IncidentReport = {
        id: reportId,
        type: data.type || 'General',
        description: data.description || '',
        // Use nullish coalescing so valid coordinates like 0 are preserved.
        lat: data.lat ?? 0,
        lng: data.lng ?? 0,
        locationSource: data.locationSource,
        status: data.status || 'pending',
        timestamp: data.timestamp || new Date().toISOString(),
        urgency: data.urgency,
        department: data.department,
        structuralDamage: data.structuralDamage,
        estRepairDays: data.estRepairDays,
        estCost: data.estCost,
        repeatable: data.repeatable,
        situationDiscussed: data.situationDiscussed,
        mitigationPlan: data.mitigationPlan,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        image: data.image,
        video: data.video,
        audio: data.audio,
        adminNotes: data.adminNotes,
        comments: data.comments,
        reporterId: resolvedReporterId
    };
    // Demo mode: read directly from local cache so we never accidentally overwrite
    // the user’s existing submissions with mock fallback.
    const current = isUsingDemoUser()
        ? (getCached<IncidentReport[]>(REPORTS_CACHE_KEY) ?? (localStorage.getItem(REPORTS_CACHE_KEY) == null ? [...MOCK_REPORTS] : []))
        : await fetchReports();

    const existing = current.length > 0 ? current : [...MOCK_REPORTS];
    // If this id does not exist in the cached list, treat it as a new submission.
    // For offline-synced reports: always treat as INSERT (not UPDATE) because they're new to the server.
    // The server will auto-generate a new SERIAL id, different from the client-side id.
    const isOfflineSync = isOfflineQueueSuppressed();
    const isUpdate = !isOfflineSync && existing.some(r => r.id === reportId);
    
    const updated = isUpdate ? existing.map(r => r.id === reportId ? newReport : r) : [newReport, ...existing];
    setCached(REPORTS_CACHE_KEY, updated);
    if (!isUsingDemoUser()) {
        if (useSupabase() && supabase) {
            try {
                if (isUpdate) {
                    // Existing report (direct edit, not offline sync): use UPDATE with id
                    await supabase.from('incident_reports').update(toReportRow(newReport)).eq('id', reportId);
                } else {
                    // New report or offline-synced: use INSERT without id for server auto-generation
                    await supabase.from('incident_reports').insert(toReportRowForInsert(newReport));
                }
            } catch (err) {
                // Network failures: persist the write and replay later.
                void enqueueOfflineAction('submitReport', newReport);
                console.warn('[submitReport] sync failed, queued for sync:', err);
                if (isOfflineQueueSuppressed()) throw err;
            }
        } else {
            void enqueueOfflineAction('submitReport', newReport);
            if (isOfflineQueueSuppressed()) throw new Error('Supabase is not available for sync yet');
        }
    }
    return true;
};

export const updateReportStatus = async (id: string, status: IncidentReport['status'], notes?: string): Promise<boolean> => {
    const reports = await fetchReports();
    const updated = reports.map(r => r.id === id ? { ...r, status, adminNotes: notes || r.adminNotes } : r);
    setCached(REPORTS_CACHE_KEY, updated);
    if (!isUsingDemoUser()) {
        const payload = { id, status, notes };
        if (useSupabase() && supabase) {
            try {
                await supabase.from('incident_reports').update({ status, adminNotes: notes }).eq('id', id);
            } catch (err) {
                void enqueueOfflineAction('updateReportStatus', payload);
                console.warn('[updateReportStatus] update failed, queued for sync:', err);
                if (isOfflineQueueSuppressed()) throw err;
            }
        } else {
            void enqueueOfflineAction('updateReportStatus', payload);
            if (isOfflineQueueSuppressed()) throw new Error('Supabase is not available for sync yet');
        }
    }
    return true;
};

export const deleteReport = async (id: string): Promise<boolean> => {
    const current = await fetchReports();
    const updated = current.filter(r => r.id !== id);
    setCached(REPORTS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('incident_reports').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

const digitsOnly = (s: string | undefined | null): string => String(s ?? '').replace(/\D/g, '');

const sameReporterId = (a: unknown, b: unknown): boolean =>
    a != null && b != null && String(a) === String(b);

/** Legacy rows with no reporter_id: match by contact email, phone, or contact name vs profile name. */
const reportLikelyFromUser = (
    r: IncidentReport,
    userEmail?: string | null,
    userPhone?: string | null,
    userName?: string | null
): boolean => {
    const email = userEmail?.trim().toLowerCase();
    const reportEmail = r.contactEmail?.trim().toLowerCase();
    if (email && reportEmail && email === reportEmail) return true;
    const pu = digitsOnly(userPhone ?? undefined);
    const pr = digitsOnly(r.contactPhone);
    if (pu.length >= 7 && pr.length >= 7) {
        if (pu === pr) return true;
        if (pu.slice(-10) === pr.slice(-10) && pu.slice(-10).length >= 7) return true;
    }
    const un = userName?.trim().toLowerCase();
    const cp = r.contactPerson?.trim().toLowerCase();
    if (un && cp && un === cp && un.length >= 2) return true;
    return false;
};

/** Whether this incident should appear as “mine” for the reporter (queue, History, edit eligibility helpers). */
export function incidentBelongsToReporter(
    r: IncidentReport,
    user: { id?: string; email?: string; phone?: string; name?: string } | null | undefined
): boolean {
    if (!user) return false;
    const uid = user.id;
    if (uid != null) {
        if (sameReporterId(r.reporterId, uid)) return true;
        if (r.reporterId != null) return false;
        return reportLikelyFromUser(r, user.email, user.phone, user.name);
    }
    return reportLikelyFromUser(r, user.email, user.phone, user.name);
}

/** Fetch reports submitted by the current user. Derived from main reports list. */
export const fetchMyReports = async (reporterId?: string): Promise<IncidentReport[]> => {
    const reports = await fetchReports();
    let uid: string | undefined = reporterId;
    let userEmail: string | undefined;
    let userPhone: string | undefined;
    let userName: string | undefined;

    const readStoredUser = () => {
        try {
            const saved = localStorage.getItem('safesphere_user');
            if (!saved) return;
            const user = JSON.parse(saved) as { id?: string; email?: string; phone?: string; name?: string };
            if (uid == null && user?.id != null) uid = String(user.id);
            userEmail = typeof user?.email === 'string' ? user.email : userEmail;
            userPhone = typeof user?.phone === 'string' ? user.phone : userPhone;
            userName = typeof user?.name === 'string' ? user.name : userName;
        } catch { /* ignore */ }
    };

    if (reporterId == null) {
        readStoredUser();
        if (uid == null) return reports;
    } else {
        uid = reporterId;
        readStoredUser();
    }

    return reports.filter((r) => {
        if (sameReporterId(r.reporterId, uid)) return true;
        if (r.reporterId != null) return false;
        return reportLikelyFromUser(r, userEmail, userPhone, userName);
    });
};

// --- CHECKLIST & DRILLS ---

const CHECKLIST_CACHE_KEY = 'safesphere_checklist_v3_15items';
const DRILLS_CACHE_KEY = 'safesphere_drills_v2';

/** Merge two lists: use base as primary, overwrite with updates by id. Ensures no items are lost. */
const mergeChecklist = (base: ChecklistItem[], updates: ChecklistItem[]): ChecklistItem[] => {
    const byId = new Map(base.map(i => [i.id, i]));
    updates.forEach(u => byId.set(u.id, u));
    return Array.from(byId.values()).sort((a, b) => (a.id as number) - (b.id as number));
};

export const fetchChecklist = async (): Promise<ChecklistItem[]> => {
    const cached = getCached<ChecklistItem[]>(CHECKLIST_CACHE_KEY);
    if (!isUsingDemoUser() && useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('checklist').select('*').order('id');
            if (!error && data) {
                const items = (data as ChecklistItem[]).length > 0 ? (data as ChecklistItem[]) : [];
                const merged = cached && cached.length > 0
                    ? mergeChecklist(cached, items)
                    : items.length > 0 ? items : (cached || []);
                let result = merged.length > 0 ? merged : (cached && cached.length > 0 ? cached : MOCK_CHECKLIST);
                if (cached && cached.length > result.length) result = cached;
                setCached(CHECKLIST_CACHE_KEY, result);
                return result;
            }
        } catch { /* fallback to cache */ }
    }
    if (cached && cached.length > 0) return cached;
    setCached(CHECKLIST_CACHE_KEY, MOCK_CHECKLIST);
    return MOCK_CHECKLIST;
};

export const submitChecklist = async (data: Partial<ChecklistItem>): Promise<ChecklistItem[]> => {
    const items = await fetchChecklist();
    const newItem: ChecklistItem = data.id
        ? { ...items.find(i => i.id === data.id)!, ...data } as ChecklistItem
        : { ...data, id: Date.now(), completed: false } as ChecklistItem;
    const updated = data.id ? items.map(i => i.id === data.id ? newItem : i) : [...items, newItem];
    setCached(CHECKLIST_CACHE_KEY, updated);
    if (!isUsingDemoUser()) {
        if (useSupabase() && supabase) {
            try {
                await supabase.from('checklist').upsert({
                    id: newItem.id,
                    title: newItem.title,
                    description: newItem.description ?? null,
                    xp: newItem.xp,
                    completed: newItem.completed
                });
            } catch (err) {
                void enqueueOfflineAction('submitChecklist', newItem);
                console.warn('[submitChecklist] upsert failed, queued for sync:', err);
                if (isOfflineQueueSuppressed()) throw err;
            }
        } else {
            void enqueueOfflineAction('submitChecklist', newItem);
            if (isOfflineQueueSuppressed()) throw new Error('Supabase is not available for sync yet');
        }
    }
    return updated;
};

export const deleteChecklist = async (id: number): Promise<boolean> => {
    const items = await fetchChecklist();
    const updated = items.filter(i => i.id !== id);
    setCached(CHECKLIST_CACHE_KEY, updated);
    if (!isUsingDemoUser() && useSupabase() && supabase) {
        try {
            await supabase.from('checklist').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

const toDrillSession = (row: Record<string, unknown>): DrillSession => ({
    id: row.id as number,
    title: row.title as string,
    date: row.date as string,
    time: (row.time as string) || undefined,
    type: row.type as DrillSession['type'],
    status: row.status as DrillSession['status'],
    eventType: (row.eventType ?? row.event_type) as DrillSession['eventType'],
    slots: (row.slots ?? row.slots_json) as DrillSession['slots'],
    participants: row.participants as number | undefined,
    notes: row.notes as string | undefined,
});

/** Merge two lists: use base as primary, overwrite with updates by id. Ensures no items are lost. */
const mergeDrills = (base: DrillSession[], updates: DrillSession[]): DrillSession[] => {
    const byId = new Map(base.map(i => [i.id, i]));
    updates.forEach(u => byId.set(u.id, u));
    return Array.from(byId.values()).sort((a, b) => (a.id as number) - (b.id as number));
};

export const fetchDrills = async (): Promise<DrillSession[]> => {
    const cached = getCached<DrillSession[]>(DRILLS_CACHE_KEY);
    if (!isUsingDemoUser() && useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('drills').select('*').order('id');
            if (!error && data) {
                const items = (data as unknown[]).length > 0 ? (data as unknown[]).map((r: Record<string, unknown>) => toDrillSession(r)) : [];
                const merged = cached && cached.length > 0
                    ? mergeDrills(cached, items)
                    : items.length > 0 ? items : (cached || []);
                let result = merged.length > 0 ? merged : (cached && cached.length > 0 ? cached : MOCK_DRILLS);
                if (cached && cached.length > result.length) result = cached;
                setCached(DRILLS_CACHE_KEY, result);
                return result;
            }
        } catch { /* fallback */ }
    }
    if (cached && cached.length > 0) return cached;
    setCached(DRILLS_CACHE_KEY, MOCK_DRILLS);
    return MOCK_DRILLS;
};

export const submitDrill = async (data: Partial<DrillSession>): Promise<DrillSession[]> => {
    const items = await fetchDrills();
    const newItem: DrillSession = data.id
        ? { ...items.find(i => i.id === data.id)!, ...data } as DrillSession
        : { ...data, id: Date.now() } as DrillSession;
    const updated = data.id ? items.map(i => i.id === data.id ? newItem : i) : [...items, newItem];
    setCached(DRILLS_CACHE_KEY, updated);
    if (!isUsingDemoUser()) {
        if (useSupabase() && supabase) {
            try {
                await supabase.from('drills').upsert({
                    id: newItem.id,
                    title: newItem.title,
                    date: newItem.date,
                    time: newItem.time,
                    type: newItem.type,
                    status: newItem.status,
                    event_type: newItem.eventType,
                    slots: newItem.slots ? JSON.stringify(newItem.slots) : null,
                    participants: newItem.participants,
                    notes: newItem.notes
                });
            } catch (err) {
                void enqueueOfflineAction('submitDrill', newItem);
                console.warn('[submitDrill] upsert failed, queued for sync:', err);
                if (isOfflineQueueSuppressed()) throw err;
            }
        } else {
            void enqueueOfflineAction('submitDrill', newItem);
            if (isOfflineQueueSuppressed()) throw new Error('Supabase is not available for sync yet');
        }
    }
    return updated;
};

const DRILL_REGISTRATIONS_KEY = 'safesphere_drill_registrations_v2';

/** Set after first failed REST call so we do not spam 404s when the table is not deployed. */
let drillRegistrationsTableUnavailable = false;

function isDrillRegistrationsMissingError(err: { code?: string; message?: string } | null): boolean {
    if (!err) return false;
    const code = err.code ?? '';
    const msg = typeof err.message === 'string' ? err.message : '';
    return (
        code === 'PGRST205' ||
        code === '42P01' ||
        /relation ["'].*drill_registrations["'] does not exist/i.test(msg) ||
        /could not find the table.*drill_registrations/i.test(msg)
    );
}

export interface DrillRegistration {
    drillId: number;
    slotDate?: string;
    slotTime?: string;
}

/** Coalesce parallel reads (e.g. Prepare mount) into one network request. */
let drillRegistrationsSlotsReadInFlight: Promise<DrillRegistration[]> | null = null;

export const getUserId = (): string => {
    try {
        const saved = localStorage.getItem('safesphere_user');
        if (saved) {
            const user = JSON.parse(saved);
            if (user?.id) return user.id;
        }
    } catch { /* ignore */ }
    return '550e8400-e29b-41d4-a716-446655440000';  // Default demo UUID
};

const getUserEmail = (): string | undefined => {
    try {
        const saved = localStorage.getItem('safesphere_user');
        if (saved) {
            const user = JSON.parse(saved);
            return user?.email;
        }
    } catch { /* ignore */ }
    return undefined;
};

export const getUserDrillRegistrations = async (): Promise<number[]> => {
    const regs = await getUserDrillRegistrationsWithSlots();
    return regs.map(r => r.drillId);
};

export const getUserDrillRegistrationsWithSlots = async (): Promise<DrillRegistration[]> => {
    if (drillRegistrationsSlotsReadInFlight) {
        return drillRegistrationsSlotsReadInFlight;
    }
    const run = async (): Promise<DrillRegistration[]> => {
        const userId = getUserId();
        if (useSupabase() && supabase && !drillRegistrationsTableUnavailable) {
            try {
                const { data, error } = await supabase
                    .from('drill_registrations')
                    .select('drill_id, slot_date, slot_time')
                    .eq('user_id', userId);
                if (error) {
                    if (isDrillRegistrationsMissingError(error)) {
                        drillRegistrationsTableUnavailable = true;
                    }
                } else if (data && data.length > 0) {
                    return data.map((r: { drill_id: number; slot_date?: string; slot_time?: string }) => ({
                        drillId: r.drill_id,
                        slotDate: r.slot_date,
                        slotTime: r.slot_time,
                    }));
                }
            } catch { /* fallback */ }
        }
        const key = `${DRILL_REGISTRATIONS_KEY}_${userId}`;
        const cached = getCached<DrillRegistration[]>(key);
        return cached || [];
    };
    drillRegistrationsSlotsReadInFlight = run().finally(() => {
        drillRegistrationsSlotsReadInFlight = null;
    });
    return drillRegistrationsSlotsReadInFlight;
};

export const registerForDrill = async (drillId: number, slot?: { date: string; time: string }): Promise<boolean> => {
    const userId = getUserId();
    const regs = await getUserDrillRegistrationsWithSlots();
    if (regs.some(r => r.drillId === drillId)) return true;
    const newReg: DrillRegistration = { drillId, slotDate: slot?.date, slotTime: slot?.time };
    const updated = [...regs, newReg];
    const key = `${DRILL_REGISTRATIONS_KEY}_${userId}`;
    setCached(key, updated);
    if (useSupabase() && supabase && !drillRegistrationsTableUnavailable) {
        try {
            const { error } = await supabase.from('drill_registrations').upsert(
                {
                    user_id: userId,
                    drill_id: drillId,
                    slot_date: slot?.date ?? null,
                    slot_time: slot?.time ?? null,
                },
                { onConflict: 'user_id,drill_id' }
            );
            if (error && isDrillRegistrationsMissingError(error)) {
                drillRegistrationsTableUnavailable = true;
            }
        } catch { /* saved locally */ }
    }
    return true;
};

export const unregisterFromDrill = async (drillId: number): Promise<boolean> => {
    const userId = getUserId();
    const regs = await getUserDrillRegistrationsWithSlots();
    if (!regs.some(r => r.drillId === drillId)) return true;
    const updated = regs.filter(r => r.drillId !== drillId);
    const key = `${DRILL_REGISTRATIONS_KEY}_${userId}`;
    setCached(key, updated);
    if (useSupabase() && supabase && !drillRegistrationsTableUnavailable) {
        try {
            const { error } = await supabase
                .from('drill_registrations')
                .delete()
                .eq('user_id', userId)
                .eq('drill_id', drillId);
            if (error && isDrillRegistrationsMissingError(error)) {
                drillRegistrationsTableUnavailable = true;
            }
        } catch { /* saved locally */ }
    }
    return true;
};

// --- Drill Social (Comments, Like/Dislike, Share) ---

const DRILL_COMMENTS_KEY = 'safesphere_drill_comments_v1';
const DRILL_REACTIONS_KEY = 'safesphere_drill_reactions_v1';

const getUserName = (): string => {
    try {
        const saved = localStorage.getItem('safesphere_user');
        if (saved) {
            const user = JSON.parse(saved);
            if (user?.name) return user.name;
            if (user?.email) return user.email.split('@')[0];
        }
    } catch { /* ignore */ }
    return 'Anonymous';
};

export const fetchDrillComments = async (drillId: number): Promise<DrillComment[]> => {
    const cached = getCached<Record<string, DrillComment[]>>(DRILL_COMMENTS_KEY);
    const key = String(drillId);
    const list = cached?.[key] ?? [];
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addDrillComment = async (drillId: number, content: string): Promise<DrillComment[]> => {
    const cached = getCached<Record<string, DrillComment[]>>(DRILL_COMMENTS_KEY) ?? {};
    const key = String(drillId);
    const list = cached[key] ?? [];
    const newComment: DrillComment = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        drillId,
        userId: getUserId(),
        userName: getUserName(),
        content: content.trim(),
        createdAt: new Date().toISOString(),
    };
    const updated = [newComment, ...list];
    cached[key] = updated;
    setCached(DRILL_COMMENTS_KEY, cached);
    return updated;
};

export const updateDrillComment = async (drillId: number, commentId: string, content: string): Promise<DrillComment[]> => {
    const cached = getCached<Record<string, DrillComment[]>>(DRILL_COMMENTS_KEY) ?? {};
    const key = String(drillId);
    const list = cached[key] ?? [];
    const idx = list.findIndex(c => c.id === commentId);
    if (idx < 0) return list;
    const comment = list[idx];
    if (comment.userId !== getUserId()) return list; // Only author can edit
    const updated = [...list];
    updated[idx] = { ...comment, content: content.trim(), updatedAt: new Date().toISOString() };
    cached[key] = updated;
    setCached(DRILL_COMMENTS_KEY, cached);
    return updated;
};

export const deleteDrillComment = async (drillId: number, commentId: string): Promise<DrillComment[]> => {
    const cached = getCached<Record<string, DrillComment[]>>(DRILL_COMMENTS_KEY) ?? {};
    const key = String(drillId);
    const list = cached[key] ?? [];
    const comment = list.find(c => c.id === commentId);
    if (!comment || comment.userId !== getUserId()) return list; // Only author can delete
    const updated = list.filter(c => c.id !== commentId);
    cached[key] = updated;
    setCached(DRILL_COMMENTS_KEY, cached);
    return updated;
};

export const fetchDrillReactions = async (drillId: number): Promise<{ counts: Record<DrillReaction, number>; total: number; userReaction: DrillReaction | null }> => {
    const cached = getCached<Record<string, Record<number, DrillReaction>>>(DRILL_REACTIONS_KEY) ?? {};
    const byDrill = cached[String(drillId)] ?? cached[drillId] ?? {};
    const reactions = Object.values(byDrill) as DrillReaction[];
    const counts: Record<DrillReaction, number> = {
        like: 0, love: 0, smile: 0, laugh: 0, sad: 0, cry: 0,
    };
    reactions.forEach(r => { if (r && counts[r] !== undefined) counts[r]++; });
    const total = reactions.length;
    const userReaction = (byDrill[getUserId()] ?? null) as DrillReaction | null;
    return { counts, total, userReaction };
};

export const setDrillReaction = async (drillId: number, reaction: DrillReaction | null): Promise<{ counts: Record<DrillReaction, number>; total: number; userReaction: DrillReaction | null }> => {
    const cached = getCached<Record<string, Record<number, DrillReaction>>>(DRILL_REACTIONS_KEY) ?? {};
    const key = String(drillId);
    if (!cached[key]) cached[key] = {};
    const userId = getUserId();
    if (reaction) {
        cached[key][userId] = reaction;
    } else {
        delete cached[key][userId];
    }
    setCached(DRILL_REACTIONS_KEY, cached);
    return fetchDrillReactions(drillId);
};

/** Get shareable URL for a drill (opens Prepare tab with drill detail) */
export const getDrillShareUrl = (drillId: number): string => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/?tab=prepare&drill=${drillId}`;
};

/** Notify user after cancelling drill registration */
export const notifyCancelRegistration = async (
    drillTitle: string,
    t: (key: string) => string
): Promise<void> => {
    const { addNotification } = await import('./notificationService');
    const title = t('cancellationConfirmed') || 'Cancellation confirmed';
    const message = (t('cancelSuccessMessage') || 'You have cancelled {title} successfully.').replace('{title}', drillTitle);
    addNotification({ type: 'info', title, message, linkTab: 'prepare' });
};

/** Notify user and optionally send email after drill registration */
export const notifyDrillRegistration = async (
    drillTitle: string,
    slotDate: string,
    slotTime: string,
    t: (key: string) => string
): Promise<void> => {
    const { addNotification } = await import('./notificationService');
    const title = t('bookingConfirmed') || 'Booking confirmed';
    const message = (t('bookingSuccessMessage') || 'You have {title} booked successfully.').replace('{title}', drillTitle);
    addNotification({ type: 'success', title, message, linkTab: 'prepare' });
    const email = getUserEmail();
    if (email && !isDemoUser(email)) {
        try {
            const { supabase } = await import('./supabase');
            if (supabase) {
                await supabase.functions.invoke('send-drill-confirmation', {
                    body: { email, drillTitle, slotDate, slotTime },
                });
            }
        } catch { /* Email optional - in-app notification is primary */ }
    }
};

export const deleteDrill = async (id: number): Promise<boolean> => {
    const items = await fetchDrills();
    const updated = items.filter(i => i.id !== id);
    setCached(DRILLS_CACHE_KEY, updated);
    if (!isUsingDemoUser() && useSupabase() && supabase) {
        try {
            await supabase.from('drills').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

// --- LEARN ITEMS ---

const LEARN_ITEMS_CACHE_KEY = 'safesphere_learn_items';

export const fetchLearnItems = async (): Promise<LearnItem[]> => {
    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('learn_items').select('*').order('id');
            if (!error && data && data.length > 0) {
                setCached(LEARN_ITEMS_CACHE_KEY, data as LearnItem[]);
                return data as LearnItem[];
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<LearnItem[]>(LEARN_ITEMS_CACHE_KEY);
    if (cached && cached.length > 0) return cached;
    setCached(LEARN_ITEMS_CACHE_KEY, [...MOCK_LEARN_ITEMS]);
    return [...MOCK_LEARN_ITEMS];
};

export const submitLearnItem = async (data: Partial<LearnItem>): Promise<boolean> => {
    const current = await fetchLearnItems();
    const newItem: LearnItem = data.id
        ? { ...current.find(l => l.id === data.id)!, ...data } as LearnItem
        : { id: Date.now(), title: data.title || 'New Learn Item', description: data.description || '', url: data.url || '', type: data.type || 'guide' };
    const updated = data.id ? current.map(l => l.id === data.id ? newItem : l) : [...current, newItem];
    setCached(LEARN_ITEMS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('learn_items').upsert({ id: newItem.id, title: newItem.title, description: newItem.description, url: newItem.url, type: newItem.type });
        } catch { /* saved locally */ }
    }
    return true;
};

export const deleteLearnItem = async (id: number): Promise<boolean> => {
    const current = await fetchLearnItems();
    const updated = current.filter(l => l.id !== id);
    setCached(LEARN_ITEMS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('learn_items').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

// --- TUTORIALS ---

const TUTORIALS_CACHE_KEY = 'safesphere_tutorials_v3';
const TUTORIAL_PROGRESS_KEY = 'safesphere_tutorial_progress';

/** Supabase may only seed a subset of tutorials; fill missing standard ids from MOCK_TUTORIALS. */
function mergeTutorialsWithDefaults(dbTutorials: Tutorial[]): Tutorial[] {
    const byId = new Map<number, Tutorial>();
    for (const t of dbTutorials) {
        byId.set(t.id, { ...t });
    }
    for (const t of MOCK_TUTORIALS) {
        if (!byId.has(t.id)) {
            byId.set(t.id, { ...t });
        }
    }
    const mockChoking = MOCK_TUTORIALS.find((m) => m.id === 6);
    const sorted = Array.from(byId.values()).sort((a, b) => a.id - b.id);
    return sorted.map((t) => {
        if (t.id === 6 && mockChoking && /Nl0_D75MhzI/.test(t.url)) {
            return { ...t, url: mockChoking.url, description: mockChoking.description };
        }
        return t;
    });
}

const toTutorial = (row: { xp_reward?: number; [k: string]: unknown }): Tutorial => ({
    id: row.id as number,
    title: row.title as string,
    description: row.description as string,
    source: row.source as 'YouTube' | 'External',
    url: row.url as string,
    xpReward: Number(row.xp_reward ?? row.xpReward ?? 25) || 25,
});

export const fetchTutorials = async (): Promise<Tutorial[]> => {
    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('tutorials').select('*').order('id');
            if (!error && data && data.length > 0) {
                const items = mergeTutorialsWithDefaults(data.map(toTutorial));
                setCached(TUTORIALS_CACHE_KEY, items);
                return items;
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<Tutorial[]>(TUTORIALS_CACHE_KEY);
    if (cached && cached.length > 0) return cached;
    setCached(TUTORIALS_CACHE_KEY, [...MOCK_TUTORIALS]);
    return [...MOCK_TUTORIALS];
};

export const submitTutorial = async (data: Partial<Tutorial>): Promise<boolean> => {
    const current = await fetchTutorials();
    const newTutorial: Tutorial = data.id
        ? { ...current.find(t => t.id === data.id)!, ...data } as Tutorial
        : { id: Date.now(), title: data.title || 'New Tutorial', description: data.description || '', source: data.source || 'External', url: data.url || '', xpReward: data.xpReward ?? 25 };
    const updated = data.id ? current.map(t => t.id === data.id ? newTutorial : t) : [...current, newTutorial];
    setCached(TUTORIALS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('tutorials').upsert({ id: newTutorial.id, title: newTutorial.title, description: newTutorial.description, source: newTutorial.source, url: newTutorial.url, xp_reward: newTutorial.xpReward });
        } catch { /* saved locally */ }
    }
    return true;
};

export const deleteTutorial = async (id: number): Promise<boolean> => {
    const current = await fetchTutorials();
    const updated = current.filter(t => t.id !== id);
    setCached(TUTORIALS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('tutorials').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

export const fetchTutorialProgress = async (): Promise<number[]> => {
    const saved = localStorage.getItem('safesphere_user');
    let userId = 1;
    try {
        if (saved) {
            const user = JSON.parse(saved);
            if (user?.id) userId = user.id;
        }
    } catch { /* ignore */ }
    if (useSupabase() && supabase) {
        try {
            const { data } = await supabase.from('tutorial_progress').select('completed_ids').eq('user_id', userId).single();
            if (data?.completed_ids && Array.isArray(data.completed_ids)) {
                setCached(TUTORIAL_PROGRESS_KEY, data.completed_ids);
                return data.completed_ids;
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<number[]>(TUTORIAL_PROGRESS_KEY);
    return cached || [];
};

export const completeTutorial = async (id: number): Promise<boolean> => {
    const completed = await fetchTutorialProgress();
    if (completed.includes(id)) return true;
    const updated = [...completed, id];
    setCached(TUTORIAL_PROGRESS_KEY, updated);
    const saved = localStorage.getItem('safesphere_user');
    const userId = saved ? (JSON.parse(saved)?.id ?? 1) : 1;
    if (useSupabase() && supabase) {
        try {
            await supabase.from('tutorial_progress').upsert({ user_id: userId, completed_ids: updated, updated_at: new Date().toISOString() });
        } catch { /* saved locally */ }
    }
    return true;
};

/** Undo tutorial completion - allows users to redo preparation and earn XP again */
export const uncompleteTutorial = async (id: number): Promise<boolean> => {
    const completed = await fetchTutorialProgress();
    if (!completed.includes(id)) return true;
    const updated = completed.filter(c => c !== id);
    setCached(TUTORIAL_PROGRESS_KEY, updated);
    const saved = localStorage.getItem('safesphere_user');
    const userId = saved ? (JSON.parse(saved)?.id ?? 1) : 1;
    if (useSupabase() && supabase) {
        try {
            await supabase.from('tutorial_progress').upsert({ user_id: userId, completed_ids: updated, updated_at: new Date().toISOString() });
        } catch { /* saved locally */ }
    }
    return true;
};

// --- INVENTORY ---

export const fetchInventory = async (): Promise<InventoryItem[]> => {
    const CACHE_KEY = 'safesphere_inventory';
    const cached = getCached<InventoryItem[]>(CACHE_KEY);
    if (cached) return Promise.resolve(cached);
    setCached(CACHE_KEY, MOCK_INVENTORY);
    return Promise.resolve(MOCK_INVENTORY);
};

export const submitInventory = async (item: Partial<InventoryItem>): Promise<boolean> => {
    const items = await fetchInventory();
    let updated;
    if (item.id) {
        updated = items.map(i => i.id === item.id ? { ...i, ...item } : i);
    } else {
        updated = [...items, { ...item, id: Date.now() } as InventoryItem];
    }
    setCached('safesphere_inventory', updated);
    return Promise.resolve(true);
};

export const deleteInventoryItem = async (id: number): Promise<boolean> => {
    const current = getCached<InventoryItem[]>('safesphere_inventory') || MOCK_INVENTORY;
    const updated = current.filter(i => i.id !== id);
    setCached('safesphere_inventory', updated);
    return Promise.resolve(true);
};

// --- INJURIES ---

export const fetchInjuries = async (): Promise<InjuryCase[]> => {
     const CACHE_KEY = 'safesphere_injuries';
     const cached = getCached<InjuryCase[]>(CACHE_KEY);
     if (cached) return Promise.resolve(cached);
     setCached(CACHE_KEY, MOCK_INJURIES);
     return Promise.resolve(MOCK_INJURIES);
};

export const submitInjury = async (injury: Partial<InjuryCase>): Promise<boolean> => {
    const injuries = await fetchInjuries();
    let updated;
    if (injury.id) {
        updated = injuries.map(i => i.id === injury.id ? { ...i, ...injury } : i);
    } else {
        updated = [...injuries, { ...injury, id: Date.now() } as InjuryCase];
    }
    setCached('safesphere_injuries', updated);
    return Promise.resolve(true);
};

export const deleteInjuryCase = async (id: number): Promise<boolean> => {
    const current = getCached<InjuryCase[]>('safesphere_injuries') || MOCK_INJURIES;
    const updated = current.filter(i => i.id !== id);
    setCached('safesphere_injuries', updated);
    return Promise.resolve(true);
};

// --- MAP DATA (Earthquake & Safety Assets) ---

/** USGS feed URLs by time range – live earthquake data */
const USGS_FEED_URLS: Record<string, string> = {
    '24h': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    '7d': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
    '1M': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson',
    '1Y': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_year.geojson'
};

/** Cache TTL in ms – refresh live data every 2 minutes */
const EARTHQUAKE_CACHE_TTL_MS = 2 * 60 * 1000;

const getCachedWithTTL = <T>(key: string, ttlMs: number): { data: T; fresh: boolean } | null => {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const parsed = JSON.parse(item) as { data: T; ts: number };
        if (!parsed.data || typeof parsed.ts !== 'number') return null;
        const age = Date.now() - parsed.ts;
        return { data: parsed.data, fresh: age < ttlMs };
    } catch {
        return null;
    }
};

const setCachedWithTTL = <T>(key: string, data: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) {
        console.error("Error writing to localStorage", e);
    }
};

/**
 * Fetch live earthquake data from USGS for the given time range.
 * Used by Home for Active Alerts and Incident Frequency chart.
 */
export const fetchEarthquakesByRange = async (range: '24h' | '7d' | '1M' | '1Y'): Promise<EarthquakeEvent[]> => {
    const CACHE_KEY = `safesphere_earthquakes_${range}`;

    if (navigator.onLine) {
        try {
            if (range === '1Y') {
                const end = new Date();
                const start = new Date();
                start.setFullYear(start.getFullYear() - 1);
                const startTime = start.toISOString().split('T')[0];
                const endTime = end.toISOString().split('T')[0];
                const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&endtime=${endTime}&minmagnitude=2.5`;
                const res = await fetch(url);
                const data = await res.json();
                const events = (data.features || []) as EarthquakeEvent[];
                setCachedWithTTL(CACHE_KEY, events);
                return events;
            }
            const url = USGS_FEED_URLS[range];
            if (url) {
                const res = await fetch(url);
                const data = await res.json();
                const events = (data.features || []) as EarthquakeEvent[];
                setCachedWithTTL(CACHE_KEY, events);
                return events;
            }
        } catch (e) {
            console.error("Failed to fetch USGS earthquake data", e);
        }
    }

    const cached = getCachedWithTTL<EarthquakeEvent[]>(CACHE_KEY, 24 * 60 * 60 * 1000);
    return cached?.data ?? [];
};

export const fetchEarthquakes = async (): Promise<EarthquakeEvent[]> => {
    return fetchEarthquakesByRange('24h');
};

export const fetchSafetyAssets = async (): Promise<SafetyAsset[]> => {
    const CACHE_KEY = 'safesphere_safety_assets_peoples_park'; // Bumped: relocated to People's Park
    const cached = getCached<SafetyAsset[]>(CACHE_KEY);
    if (cached) return Promise.resolve(cached);

    // Safety assets at People's Park, Yangon (near Shwedagon; Pyay Rd, U Wisara Rd, Dhammazedi Rd, Ahlone Rd)
    const mockAssets: SafetyAsset[] = [
        { id: 1, type: 'meeting_point', lat: 16.7940, lng: 96.1410, label: 'Assembly Area A', building: "People's Park", floor: 'G' },
        { id: 2, type: 'exit', lat: 16.7955, lng: 96.1405, label: 'North Exit', building: "People's Park", floor: '1' },
        { id: 3, type: 'extinguisher', lat: 16.7935, lng: 96.1390, label: 'Hallway 1', building: "People's Park", floor: '2' },
        { id: 4, type: 'extinguisher', lat: 16.7925, lng: 96.1400, label: 'Lobby', building: "People's Park", floor: 'G' },
        { id: 5, type: 'extinguisher', lat: 16.7920, lng: 96.1415, label: 'Cafeteria', building: "People's Park", floor: '1' },
        { id: 6, type: 'exit', lat: 16.7910, lng: 96.1395, label: 'South Exit', building: "People's Park", floor: '1' },
        { 
            id: 7, 
            type: 'route', 
            lat: 0, 
            lng: 0, 
            building: "People's Park",
            floor: '1',
            label: 'Evacuation Path A',
            routePoints: [
                [16.7915, 96.1390], 
                [16.7930, 96.1395], 
                [16.7945, 96.1405]
            ]
        },
        {
            id: 8,
            type: 'road',
            lat: 0,
            lng: 0,
            label: 'Emergency Access Rd',
            routePoints: [
                [16.7905, 96.1390],
                [16.7920, 96.1400],
                [16.7940, 96.1410]
            ]
        }
    ];

    setCached(CACHE_KEY, mockAssets);
    return Promise.resolve(mockAssets);
};

export const submitSafetyAsset = async (asset: Partial<SafetyAsset>): Promise<boolean> => {
    const assets = await fetchSafetyAssets();
    let updated;
    if (asset.id && asset.id !== 0) {
        updated = assets.map(a => a.id === asset.id ? { ...a, ...asset } : a);
    } else {
        updated = [...assets, { ...asset, id: Date.now() } as SafetyAsset];
    }
    setCached('safesphere_safety_assets', updated);
    return Promise.resolve(true);
};

export const deleteSafetyAsset = async (id: number): Promise<boolean> => {
    const assets = await fetchSafetyAssets();
    const updated = assets.filter(a => a.id !== id);
    setCached('safesphere_safety_assets', updated);
    return Promise.resolve(true);
};
