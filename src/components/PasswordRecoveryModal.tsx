import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { getSupabaseSessionUser, updateSupabaseUserPassword } from '../services/auth';
import { supabase, isSupabaseReady } from '../services/supabase';
import { Icons } from './Icon';

/**
 * When a user opens the Supabase password-reset email link, Auth emits PASSWORD_RECOVERY.
 * They must set a new password here; reset links do not use the 6-digit demo flow.
 */
export const PasswordRecoveryModal: React.FC = () => {
    const { login } = useUser();
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isSupabaseReady() || !supabase) return;
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setOpen(true);
                setPassword('');
                setConfirm('');
                setError(null);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        const result = await updateSupabaseUserPassword(password);
        setLoading(false);
        if (!result.success) {
            setError(result.message || 'Could not update password.');
            return;
        }
        setOpen(false);
        const u = await getSupabaseSessionUser();
        if (u) login(u);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Set a new password</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            You opened a password reset link. Choose a new password to finish.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="p-2 rounded-full hover:bg-gray-100 shrink-0"
                        aria-label="Close"
                    >
                        <Icons.X size={20} className="text-gray-500" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">New password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                            autoComplete="new-password"
                            placeholder="At least 6 characters"
                            minLength={6}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirm password</label>
                        <input
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                            autoComplete="new-password"
                            placeholder="Repeat password"
                            minLength={6}
                            required
                        />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                    >
                        {loading ? 'Saving…' : 'Save password and continue'}
                    </button>
                </form>
            </div>
        </div>
    );
};
