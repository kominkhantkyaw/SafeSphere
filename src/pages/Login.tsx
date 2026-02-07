


import React, { useState } from 'react';
import { Icons } from '../components/Icon';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeSettings } from '../types';
import { requestAccount, confirmAccount, getPendingRegistration, authenticate } from '../services/api';
import { User } from '../types';

interface LoginProps {
    onLogin: (role: 'Admin' | 'Responder' | 'Viewer', user?: User) => void;
    theme: ThemeSettings;
}

const Login: React.FC<LoginProps> = ({ onLogin, theme }) => {
    const { t } = useLanguage();
    const [view, setView] = useState<'login' | 'register' | 'check-email'>('login');
    const [loading, setLoading] = useState(false);
    const [authMethod, setAuthMethod] = useState<'password' | 'biometric'>('password');
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [registerError, setRegisterError] = useState<string | null>(null);
    const [pendingEmail, setPendingEmail] = useState('');
    
    // Defaults for demo
    const [email, setEmail] = useState('admin@safesphere.app');
    const [password, setPassword] = useState('admin123');
    
    // Registration form
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoginError(null);
        setLoading(true);
        const res = await authenticate(email, password);
        setLoading(false);
        if (res.success && res.user) {
            alert(t('signInSuccess'));
            onLogin(res.user.role, res.user);
        } else {
            setLoginError(res.message || 'Invalid credentials. Please try again.');
        }
    };

    const handleBiometric = async (type: 'face' | 'fingerprint') => {
        if (type === 'face') {
            const twoFaOn = localStorage.getItem('safesphere_2fa_enabled') === '1';
            const faceIdOn = localStorage.getItem('safesphere_faceid_enabled') === '1';
            if (!twoFaOn || !faceIdOn) {
                setLoginError(t('faceIdRequirementError'));
                return;
            }
        }
        setAuthMethod('biometric');
        setLoading(true);
        // Biometric uses stored credentials - try current email/password first
        const res = await authenticate(email, password);
        setLoading(false);
        if (res.success && res.user) {
            alert(t('signInSuccess'));
            onLogin(res.user.role, res.user);
        } else {
            setLoginError('Biometric failed. Please sign in with password.');
        }
    };

    const handleRequestAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegisterError(null);
        if (regPassword !== confirmPassword) {
            setRegisterError('Passwords do not match.');
            return;
        }
        if (regPassword.length < 6) {
            setRegisterError('Password must be at least 6 characters.');
            return;
        }
        setLoading(true);
        const res = await requestAccount({
            firstName,
            lastName,
            username,
            email: regEmail,
            phone,
            password: regPassword,
        });
        setLoading(false);
        if (res.success) {
            setPendingEmail(regEmail);
            setView('check-email');
        } else {
            setRegisterError(res.message);
        }
    };

    const handleConfirmAndSignIn = async () => {
        const pending = getPendingRegistration(pendingEmail);
        if (!pending) {
            setRegisterError('No pending registration found. Please request an account again.');
            return;
        }
        setLoading(true);
        const res = await confirmAccount(pendingEmail, pending.token);
        setLoading(false);
        if (res.success && res.user) {
            alert(t('signInSuccess'));
            onLogin(res.user.role, res.user);
        } else {
            setRegisterError(res.message);
        }
    };

    const primaryColor = theme.primaryColor || '#1d4ed8';
    const isDefaultBlue = primaryColor === '#1d4ed8';

    return (
        <div 
            className="login-page-outer fixed inset-0 min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 overflow-auto"
            style={{ backgroundColor: '#1e40af' }}
        >
            {/* Login card */}
            <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-xl p-8 relative z-10 my-auto">
                
                {/* Close / Return button - shown on Request Account and Check Email */}
                {(view === 'register' || view === 'check-email') && (
                    <div className="absolute top-4 right-4">
                        <button
                            type="button"
                            onClick={() => { setView('login'); setRegisterError(null); }}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            aria-label="Close and return to sign in"
                        >
                            <Icons.X size={24} />
                        </button>
                    </div>
                )}

                <div className="text-center mb-8">
                    <div 
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white"
                        style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}
                    >
                        <Icons.ShieldCheck size={32} strokeWidth={2} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{theme.appName}</h1>
                    <p className="text-gray-500 text-sm mt-1">Emergency Response System</p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center py-10">
                        {authMethod === 'biometric' ? (
                             <div className="relative w-20 h-20">
                                <Icons.ScanFace size={80} className="text-gray-200 absolute inset-0" />
                                <Icons.ScanFace size={80} className="text-green-500 absolute inset-0 animate-pulse" style={{ clipPath: 'inset(0 0 50% 0)' }} />
                                <div className="absolute inset-0 border-t-4 border-green-500 animate-scan" style={{ animation: 'scan 2s infinite linear' }}></div>
                             </div>
                        ) : (
                             <div className="w-12 h-12 border-4 border-gray-200 rounded-full animate-spin mb-4" style={{ borderTopColor: isDefaultBlue ? '#2563eb' : primaryColor }}></div>
                        )}
                        <p className="text-sm font-bold text-gray-500 mt-4">Verifying credentials...</p>
                    </div>
                ) : (
                    <>
                        {view === 'login' ? (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                    <div className="relative">
                                        <Icons.User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input 
                                            type="email" 
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors bg-white" 
                                            placeholder="user@safesphere.app" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                                    <div className="relative">
                                        <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input 
                                            type="password" 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors bg-white" 
                                            placeholder="••••••••" 
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Demo: admin@safesphere.app / admin123</span>
                                    <button type="button" onClick={() => setShowForgotPassword(true)} className="font-bold text-blue-600 hover:text-blue-700">Forgot?</button>
                                </div>
                                {loginError && <p className="text-sm text-red-600">{loginError}</p>}

                                <button 
                                    type="submit" 
                                    className="w-full py-3 text-white rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98]"
                                    style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}
                                >
                                    Sign In
                                </button>

                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                                    <div className="relative flex justify-center text-xs font-bold text-gray-400 uppercase tracking-wide"><span className="bg-white px-2">Or login with</span></div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button type="button" onClick={() => handleBiometric('face')} className="flex flex-col items-center justify-center py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors group">
                                        <Icons.ScanFace size={24} className="text-gray-600 group-hover:text-black mb-1" />
                                        <span className="text-[10px] font-bold text-gray-500">Face ID</span>
                                    </button>
                                    <button type="button" onClick={() => handleBiometric('fingerprint')} className="flex flex-col items-center justify-center py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors group">
                                        <Icons.Fingerprint size={24} className="text-gray-600 group-hover:text-black mb-1" />
                                        <span className="text-[10px] font-bold text-gray-500">Touch ID</span>
                                    </button>
                                </div>
                            </form>
                        ) : view === 'check-email' ? (
                            <div className="space-y-4">
                                <button
                                    type="button"
                                    onClick={() => { setView('login'); setRegisterError(null); }}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
                                >
                                    <Icons.ChevronLeft size={18} />
                                    Back to Sign In
                                </button>
                                <div className="flex justify-center">
                                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}>
                                        <Icons.Mail size={28} />
                                    </div>
                                </div>
                                <h2 className="text-lg font-bold text-gray-900 text-center">Check your email</h2>
                                <p className="text-sm text-gray-500 text-center">
                                    We&apos;ve sent a confirmation email to <strong className="text-gray-700">{pendingEmail}</strong>. Click the link in the email to activate your account, or confirm below to sign in now.
                                </p>
                                {registerError && <p className="text-sm text-red-600 text-center">{registerError}</p>}
                                <button
                                    type="button"
                                    onClick={handleConfirmAndSignIn}
                                    disabled={loading}
                                    className="w-full py-3 text-white rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70"
                                    style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}
                                >
                                    {loading ? 'Confirming...' : 'Confirm & Sign In'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setView('register'); setRegisterError(null); }}
                                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Use a different email
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleRequestAccount} className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => { setView('login'); setRegisterError(null); }}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2 -mt-1"
                                >
                                    <Icons.ChevronLeft size={18} />
                                    Back to Sign In
                                </button>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">First name</label>
                                        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="John" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Last name</label>
                                        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="Doe" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Username</label>
                                    <div className="relative">
                                        <Icons.User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="johndoe" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                    <div className="relative">
                                        <Icons.Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="john@safesphere.app" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
                                    <div className="relative">
                                        <Icons.Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="+1 555 0123" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                                    <div className="relative">
                                        <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="••••••••" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirm password</label>
                                    <div className="relative">
                                        <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="••••••••" />
                                    </div>
                                </div>
                                {registerError && <p className="text-sm text-red-600">{registerError}</p>}
                                <button type="submit" disabled={loading} className="w-full py-3 text-white rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70" style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}>
                                    {loading ? 'Sending...' : 'Request Account'}
                                </button>
                            </form>
                        )}

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-500">
                                {view === 'login' && "Don't have an account?"}
                                {view === 'login' && (
                                    <button 
                                        onClick={() => { setView('register'); setRegisterError(null); }}
                                        className="font-bold ml-1 text-blue-600 hover:text-blue-700 underline"
                                        style={!isDefaultBlue ? { color: primaryColor } : undefined}
                                    >
                                        Request Access
                                    </button>
                                )}
                                {(view === 'register' || view === 'check-email') && "Already have an account?"}
                                {(view === 'register' || view === 'check-email') && (
                                    <button 
                                        onClick={() => { setView('login'); setRegisterError(null); }}
                                        className="font-bold ml-1 text-blue-600 hover:text-blue-700 underline"
                                        style={!isDefaultBlue ? { color: primaryColor } : undefined}
                                    >
                                        Sign In
                                    </button>
                                )}
                            </p>
                        </div>
                    </>
                )}

                {/* Footer inside white card */}
                <div className="mt-8 pt-6 border-t border-gray-100 text-center text-gray-400 text-xs">
                    &copy; 2025 {theme.appName}. Secure Connection.
                </div>
            </div>

            <ForgotPasswordModal
                isOpen={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
                onSuccess={() => setShowForgotPassword(false)}
                primaryColor={isDefaultBlue ? '#2563eb' : primaryColor}
            />
        </div>
    );
};

export default Login;