/**
 * authenticate() when Supabase is "ready" — uses mocked client auth (no network).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const authMocks = vi.hoisted(() => {
    const signInWithPassword = vi.fn();
    const getAuthenticatorAssuranceLevel = vi.fn();
    return { signInWithPassword, getAuthenticatorAssuranceLevel };
});

vi.mock('./supabase', () => ({
    supabase: {
        auth: {
            signInWithPassword: authMocks.signInWithPassword,
            mfa: {
                getAuthenticatorAssuranceLevel: authMocks.getAuthenticatorAssuranceLevel,
            },
        },
    },
    isSupabaseReady: () => true,
}));

import { authenticate } from './api';

describe('api — authenticate with Supabase client (mocked)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
            data: { currentLevel: 'aal1', nextLevel: 'aal1' },
        });
    });

    it('still uses demo branch for reporter@safesphere.app (no signInWithPassword)', async () => {
        authMocks.signInWithPassword.mockResolvedValue({ data: { user: null }, error: null });
        const res = await authenticate('reporter@safesphere.app', '20Reporter#26!');
        expect(res.success).toBe(true);
        expect(authMocks.signInWithPassword).not.toHaveBeenCalled();
    });

    it('calls signInWithPassword for non-demo email', async () => {
        authMocks.signInWithPassword.mockResolvedValue({
            data: {
                user: {
                    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                    email: 'realuser@example.com',
                    user_metadata: { name: 'Real User', role: 'Reporter' },
                },
            },
            error: null,
        });

        const res = await authenticate('realuser@example.com', 'secret-pass');
        expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
            email: 'realuser@example.com',
            password: 'secret-pass',
        });
        expect(res.success).toBe(true);
        expect(res.user?.id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
        expect(res.user?.email).toBe('realuser@example.com');
    });

    it('returns failure message when Supabase returns error', async () => {
        authMocks.signInWithPassword.mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid login credentials' },
        });

        const res = await authenticate('x@y.com', 'bad');
        expect(res.success).toBe(false);
        expect(res.message).toContain('Invalid');
    });
});
