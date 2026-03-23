/**
 * API integration tests — demo user path + localStorage (no live Supabase).
 * Ensures authenticate, fetchReports, and submitReport behave for production demo accounts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authenticate, fetchReports, submitReport, DEMO_CREDENTIALS } from './api';
import { MOCK_REPORTS } from '../constants';

/** Must match REPORTS_CACHE_KEY in api.ts */
const REPORTS_CACHE_KEY = 'safesphere_reports_v6_myanmar';

vi.mock('./supabase', () => ({
    supabase: null,
    isSupabaseReady: () => false,
}));

describe('api — demo user path (no Supabase)', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe('authenticate', () => {
        it('succeeds for valid demo Reporter credentials', async () => {
            const reporter = DEMO_CREDENTIALS.find((c) => c.user.role === 'Reporter')!;
            const res = await authenticate(reporter.email, reporter.password);
            expect(res.success).toBe(true);
            expect(res.user?.email?.toLowerCase()).toBe(reporter.email.toLowerCase());
            expect(res.user?.role).toBe('Reporter');
        });

        it('fails for demo email with wrong password', async () => {
            const reporter = DEMO_CREDENTIALS.find((c) => c.user.role === 'Reporter')!;
            const res = await authenticate(reporter.email, 'wrong-password');
            expect(res.success).toBe(false);
            expect(res.message).toMatch(/invalid/i);
        });

        it('fails for unknown email when Supabase is not configured', async () => {
            const res = await authenticate('nobody@example.com', 'any');
            expect(res.success).toBe(false);
        });
    });

    describe('fetchReports', () => {
        it('returns MOCK_REPORTS when demo user and cache key is unset', async () => {
            const reporter = DEMO_CREDENTIALS.find((c) => c.user.role === 'Reporter')!;
            localStorage.setItem('safesphere_user', JSON.stringify(reporter.user));
            expect(localStorage.getItem(REPORTS_CACHE_KEY)).toBeNull();

            const list = await fetchReports();
            expect(list.length).toBeGreaterThanOrEqual(MOCK_REPORTS.length);
            expect(list.some((r) => MOCK_REPORTS.some((m) => String(m.id) === String(r.id)))).toBe(true);
        });

        it('returns cached list after submitReport for demo user', async () => {
            const reporter = DEMO_CREDENTIALS.find((c) => c.user.role === 'Reporter')!;
            localStorage.setItem('safesphere_user', JSON.stringify(reporter.user));
            localStorage.removeItem(REPORTS_CACHE_KEY);

            await fetchReports();
            const ok = await submitReport({
                type: 'General',
                description: 'Vitest demo submission',
                lat: 16.8,
                lng: 96.1,
                urgency: 'Medium',
            });
            expect(ok).toBe(true);

            const after = await fetchReports();
            expect(after.some((r) => r.description === 'Vitest demo submission')).toBe(true);
        });
    });

    describe('submitReport', () => {
        it('prepends a new report for demo user and sets reporterId from session', async () => {
            const reporter = DEMO_CREDENTIALS.find((c) => c.user.role === 'Reporter')!;
            localStorage.setItem('safesphere_user', JSON.stringify(reporter.user));
            localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify([...MOCK_REPORTS]));

            await submitReport({
                type: 'FIRE',
                description: 'Unit test fire report',
                lat: 1,
                lng: 2,
            });

            const raw = localStorage.getItem(REPORTS_CACHE_KEY);
            expect(raw).toBeTruthy();
            const parsed = JSON.parse(raw!) as { description: string; reporterId?: string }[];
            const row = parsed.find((r) => r.description === 'Unit test fire report');
            expect(row).toBeDefined();
            expect(String(row!.reporterId)).toBe(String(reporter.user.id));
        });
    });
});
