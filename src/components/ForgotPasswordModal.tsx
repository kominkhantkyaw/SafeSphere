import React, { useState } from 'react';
import { Icons } from './Icon';
import { requestPasswordReset, resetPasswordWithCode } from '../services/api';

type Step = 'method' | 'request' | 'verify' | 'success';

interface ForgotPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    primaryColor?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    primaryColor = '#2563eb',
}) => {
    const [step, setStep] = useState<Step>('method');
    const [method, setMethod] = useState<'email' | 'sms'>('email');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const resetForm = () => {
        setStep('method');
        setMethod('email');
        setEmail('');
        setPhone('');
        setCode('');
        setNewPassword('');
        setConfirmPassword('');
        setMessage(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleRequestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        const value = method === 'email' ? email : phone;
        if (!value.trim()) {
            setMessage({ type: 'error', text: method === 'email' ? 'Please enter your email.' : 'Please enter your phone number.' });
            return;
        }
        setLoading(true);
        try {
            const result = await requestPasswordReset(method, value);
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setStep('verify');
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch {
            setMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        setLoading(true);
        try {
            const result = await resetPasswordWithCode(code, newPassword);
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setStep('success');
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch {
            setMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-900">Reset Password</h2>
                        <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
                            <Icons.X size={20} className="text-gray-500" />
                        </button>
                    </div>

                    {step === 'method' && (
                        <>
                            <p className="text-sm text-gray-500 mb-4">Choose how you'd like to reset your password:</p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => { setMethod('email'); setStep('request'); setMessage(null); }}
                                    className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-colors text-left"
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Icons.Mail size={20} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">Reset via Email</p>
                                        <p className="text-xs text-gray-500">Receive a code at your email address</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setMethod('sms'); setStep('request'); setMessage(null); }}
                                    className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-colors text-left"
                                >
                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                        <Icons.Phone size={20} className="text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">Reset via SMS</p>
                                        <p className="text-xs text-gray-500">Receive a code via text message</p>
                                    </div>
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'request' && (
                        <form onSubmit={handleRequestCode} className="space-y-4">
                            <button type="button" onClick={() => setStep('method')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                <Icons.ArrowLeft size={14} /> Back
                            </button>
                            {method === 'email' ? (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                                    <div className="relative">
                                        <Icons.Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                                            placeholder="you@example.com"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                                    <div className="relative">
                                        <Icons.Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                                            placeholder="+1 234 567 8900"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            )}
                            {message && (
                                <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {message.text}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-70"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {loading ? 'Sending...' : 'Send Verification Code'}
                            </button>
                        </form>
                    )}

                    {step === 'verify' && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            {message?.type === 'success' && (
                                <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{message.text}</p>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">6-Digit Code</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white text-center text-lg tracking-[0.5em] font-mono"
                                    placeholder="000000"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">New Password</label>
                                <div className="relative">
                                    <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                                        placeholder="At least 6 characters"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirm Password</label>
                                <div className="relative">
                                    <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
                                        placeholder="Re-enter password"
                                    />
                                </div>
                            </div>
                            {message?.type === 'error' && (
                                <p className="text-sm text-red-600">{message.text}</p>
                            )}
                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="w-full py-3 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-70"
                                style={{ backgroundColor: primaryColor }}
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('request')}
                                className="w-full text-sm text-gray-500 hover:text-blue-600"
                            >
                                Didn't receive the code? Request again
                            </button>
                        </form>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                <Icons.CheckCircle size={32} className="text-green-600" />
                            </div>
                            <p className="text-green-600 font-medium mb-2">Password Reset Successful</p>
                            <p className="text-sm text-gray-500 mb-6">{message?.text}</p>
                            <button
                                onClick={() => { handleClose(); onSuccess?.(); }}
                                className="w-full py-3 text-white rounded-xl font-bold"
                                style={{ backgroundColor: primaryColor }}
                            >
                                Sign In
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
