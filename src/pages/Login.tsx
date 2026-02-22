


import React, { useState, useCallback } from 'react';
import { Icons } from '../components/Icon';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { FaceScanModal } from '../components/FaceScanModal';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeSettings } from '../types';
import { requestAccount, confirmAccount, getPendingRegistration, authenticate, resendConfirmationEmail } from '../services/api';
import { completeMfaChallenge, getSupabaseSessionUser, isDemoUser } from '../services/auth';
import { isWebAuthnAvailable, getWebAuthnAuthOptions, verifyWebAuthnAssertion } from '../services/webauthn';
import { User } from '../types';
import { COUNTRY_CODES } from '../constants';

interface LoginProps {
    onLogin: (role: 'Admin' | 'Responder' | 'Viewer' | 'Reporter', user?: User) => void;
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
    const [confirmationCode, setConfirmationCode] = useState('');
    
    // Defaults for demo — use Reporter (limited privileges) for safety
    const [email, setEmail] = useState('reporter@safesphere.app');
    const [password, setPassword] = useState('Reporter123!');
    
    // Registration form
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [phoneCountryCode, setPhoneCountryCode] = useState('+43');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // MFA challenge step for real (Supabase) users with 2FA enabled
    const [showMfaChallenge, setShowMfaChallenge] = useState(false);
    const [mfaCode, setMfaCode] = useState('');
    const [mfaError, setMfaError] = useState<string | null>(null);

    // Face ID: camera-based face scan (like QR Scanner)
    const [showFaceScan, setShowFaceScan] = useState(false);
    // Show 6-digit code on screen when email could not be sent (so user can still activate)
    const [showFallbackCode, setShowFallbackCode] = useState(false);
    // Reason email failed (from Edge Function / Resend) so user can fix setup
    const [emailSendError, setEmailSendError] = useState<string | null>(null);

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoginError(null);
        setLoading(true);
        const res = await authenticate(email, password);
        setLoading(false);
        if (res.success && res.user) {
            if (res.requiresMfa) {
                setShowMfaChallenge(true);
                setMfaError(null);
                setMfaCode('');
                return;
            }
            alert(t('signInSuccess'));
            onLogin(res.user.role, res.user);
        } else {
            setLoginError(res.message || t('invalidCredentials'));
        }
    };

    const handleMfaSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setMfaError(null);
        if (!mfaCode.trim()) {
            setMfaError(t('mfaCodeRequired') || 'Enter the code from your authenticator app.');
            return;
        }
        setLoading(true);
        const result = await completeMfaChallenge(mfaCode);
        setLoading(false);
        if (result.success) {
            const user = await getSupabaseSessionUser();
            if (user) {
                alert(t('signInSuccess'));
                onLogin(user.role, user);
            } else {
                setMfaError(t('invalidCredentials') || 'Session error. Please sign in again.');
            }
        } else {
            setMfaError(result.message || t('invalidCredentials'));
        }
    };

    // Face ID: open camera, detect face, then sign in with form credentials
    const handleFaceIdClick = () => {
        const twoFaOn = localStorage.getItem('safesphere_2fa_enabled') === '1';
        const faceIdOn = localStorage.getItem('safesphere_faceid_enabled') === '1';
        if (!twoFaOn || !faceIdOn) {
            setLoginError(t('faceIdRequirementError'));
            return;
        }
        setLoginError(null);
        setShowFaceScan(true);
    };

    const handleFaceScanSuccess = useCallback(() => {
        setShowFaceScan(false);
        setAuthMethod('biometric');
        setLoading(true);
        (async () => {
            const res = await authenticate(email, password);
            setLoading(false);
            if (res.success && res.user) {
                if (res.requiresMfa) {
                    setShowMfaChallenge(true);
                    setMfaError(null);
                    setMfaCode('');
                    return;
                }
                alert(t('signInSuccess'));
                onLogin(res.user.role, res.user);
            } else {
                setLoginError(t('biometricFailed'));
            }
        })();
    }, [email, password, onLogin, t]);

    // Touch ID / fingerprint: use system biometric (WebAuthn on MacBook) or password fallback
    const handleBiometric = async (type: 'face' | 'fingerprint') => {
        if (type === 'face') {
            handleFaceIdClick();
            return;
        }
        const twoFaOn = localStorage.getItem('safesphere_2fa_enabled') === '1';
        const faceIdOn = localStorage.getItem('safesphere_faceid_enabled') === '1';
        if (type === 'fingerprint' && (!twoFaOn || !faceIdOn)) {
            setLoginError(t('faceIdRequirementError'));
            return;
        }
        setAuthMethod('biometric');
        setLoginError(null);
        setLoading(true);

        // Real users: try WebAuthn so the device prompts for fingerprint (Touch ID on MacBook)
        if (!isDemoUser(email) && isWebAuthnAvailable()) {
            const opts = await getWebAuthnAuthOptions(email);
            if (opts.success) {
                try {
                    const credential = await navigator.credentials.get({ publicKey: opts.options }) as PublicKeyCredential | null;
                    if (credential) {
                        const verify = await verifyWebAuthnAssertion(email, credential);
                        setLoading(false);
                        if (verify.success && verify.magicLink) {
                            window.location.href = verify.magicLink;
                            return;
                        }
                        setLoginError(verify.success ? t('biometricFailed') : (verify as { message?: string }).message || t('biometricFailed'));
                        return;
                    }
                } catch (err) {
                    setLoading(false);
                    setLoginError(t('biometricFailed'));
                    return;
                }
            }
        }

        // Demo users or WebAuthn unavailable: use password (form credentials)
        const res = await authenticate(email, password);
        setLoading(false);
        if (res.success && res.user) {
            if (res.requiresMfa) {
                setShowMfaChallenge(true);
                setMfaError(null);
                setMfaCode('');
                return;
            }
            alert(t('signInSuccess'));
            onLogin(res.user.role, res.user);
        } else {
            setLoginError(t('biometricFailed'));
        }
    };

    const handleRequestAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegisterError(null);
        if (regPassword !== confirmPassword) {
            setRegisterError(t('passwordsDoNotMatch'));
            return;
        }
        if (regPassword.length < 6) {
            setRegisterError(t('passwordMinLength'));
            return;
        }
        const fullPhone = `${phoneCountryCode} ${phoneNumber.trim()}`.trim();
        if (!phoneNumber.trim()) {
            setRegisterError(t('phoneRequired') || 'Please enter your phone number.');
            return;
        }
        setLoading(true);
        const res = await requestAccount({
            firstName,
            lastName,
            username,
            email: regEmail,
            phone: fullPhone,
            password: regPassword,
        });
        setLoading(false);
        if (res.success) {
            setPendingEmail(regEmail);
            setConfirmationCode('');
            setShowFallbackCode(res.emailSent === false);
            setEmailSendError(res.emailError ?? null);
            setView('check-email');
        } else {
            setRegisterError(res.message);
        }
    };

    const handleConfirmAndSignIn = async () => {
        const code = confirmationCode.replace(/\D/g, '');
        if (code.length !== 6) {
            setRegisterError(t('enter6DigitCode') || 'Please enter the 6-digit code we sent to your email and phone.');
            return;
        }
        const pending = getPendingRegistration(pendingEmail);
        if (!pending) {
            setRegisterError(t('noPendingRegistration'));
            return;
        }
        setLoading(true);
        const res = await confirmAccount(pendingEmail, code);
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
                    <p className="text-gray-500 text-sm mt-1">{t('loginTitle')}</p>
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
                        <p className="text-sm font-bold text-gray-500 mt-4">{t('verifyingCredentials')}</p>
                    </div>
                ) : (
                    <>
                        {view === 'login' && showMfaChallenge ? (
                            <div className="space-y-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowMfaChallenge(false); setMfaCode(''); setMfaError(null); }}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                                >
                                    <Icons.ChevronLeft size={18} />
                                    {t('backToSignIn')}
                                </button>
                                <div className="flex justify-center">
                                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}>
                                        <Icons.ShieldCheck size={28} />
                                    </div>
                                </div>
                                <h2 className="text-lg font-bold text-gray-900 text-center">{t('twoFactorAuthentication')}</h2>
                                <p className="text-sm text-gray-500 text-center">{t('mfaEnterCode')}</p>
                                <form onSubmit={handleMfaSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('mfaCodeLabel')}</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            value={mfaCode}
                                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-center text-lg tracking-widest font-mono"
                                            placeholder="000000"
                                            maxLength={6}
                                        />
                                    </div>
                                    {mfaError && <p className="text-sm text-red-600">{mfaError}</p>}
                                    <button
                                        type="submit"
                                        className="w-full py-3 text-white rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98]"
                                        style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}
                                    >
                                        {t('verify')}
                                    </button>
                                </form>
                            </div>
                        ) : view === 'login' ? (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('emailLabel')}</label>
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
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('passwordLabel')}</label>
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
                                    <span className="text-gray-400">{t('demoCredentialsHint')}</span>
                                    <button type="button" onClick={() => setShowForgotPassword(true)} className="font-bold text-blue-600 hover:text-blue-700">{t('forgotPassword')}</button>
                                </div>
                                {loginError && <p className="text-sm text-red-600">{loginError}</p>}

                                <button 
                                    type="submit" 
                                    className="w-full py-3 text-white rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98]"
                                    style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}
                                >
                                    {t('signInButton')}
                                </button>

                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                                    <div className="relative flex justify-center text-xs font-bold text-gray-400 uppercase tracking-wide"><span className="bg-white px-2">{t('orLoginWith')}</span></div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button type="button" onClick={() => handleBiometric('face')} className="flex flex-col items-center justify-center py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors group">
                                        <Icons.ScanFace size={24} className="text-gray-600 group-hover:text-black mb-1" />
                                        <span className="text-[10px] font-bold text-gray-500">{t('faceIdButton')}</span>
                                    </button>
                                    <button type="button" onClick={() => handleBiometric('fingerprint')} className="flex flex-col items-center justify-center py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors group">
                                        <Icons.Fingerprint size={24} className="text-gray-600 group-hover:text-black mb-1" />
                                        <span className="text-[10px] font-bold text-gray-500">{t('touchIdButton')}</span>
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
                                    {t('backToSignIn')}
                                </button>
                                <div className="flex justify-center">
                                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}>
                                        <Icons.Mail size={28} />
                                    </div>
                                </div>
                                <h2 className="text-lg font-bold text-gray-900 text-center">{t('checkYourEmail')}</h2>
                                <p className="text-sm text-gray-500 text-center">
                                    {t('confirmationCodeSentEmailAndSms')}
                                </p>
                                <p className="text-xs text-gray-400 text-center">
                                    {t('didNotReceiveCode')}
                                </p>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setRegisterError(null);
                                        setShowFallbackCode(false);
                                        setLoading(true);
                                        const result = await resendConfirmationEmail(pendingEmail);
                                        setLoading(false);
                                        if (result.success) {
                                            setRegisterError(null);
                                            setEmailSendError(null);
                                            alert(t('confirmationResent') || 'Confirmation code resent! Check your inbox and spam folder.');
                                        } else {
                                            setRegisterError(result.message || 'Could not resend. Please try again.');
                                            setShowFallbackCode(true);
                                        }
                                    }}
                                    disabled={loading}
                                    className="w-full py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 underline disabled:opacity-50"
                                >
                                    {t('resendCode') || 'Resend confirmation code'}
                                </button>
                                {emailSendError && (
                                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5 text-center" role="alert">
                                        {emailSendError}
                                    </p>
                                )}
                                {(() => {
                                    const pending = getPendingRegistration(pendingEmail);
                                    const showCode = pending?.token && (import.meta.env.DEV || showFallbackCode);
                                    if (!showCode) return null;
                                    return (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center font-mono" role="status">
                                            {showFallbackCode
                                                ? (t('emailNotSentUseCode') || 'Email could not be sent. Use this code to activate:') + ' '
                                                : 'Development: Your code is '}
                                            <strong>{pending.token}</strong>
                                        </p>
                                    );
                                })()}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('enter6DigitCode')}</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={confirmationCode}
                                        onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder={t('activationCodePlaceholder')}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-center text-lg tracking-[0.4em] font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                    />
                                </div>
                                {registerError && <p className="text-sm text-red-600 text-center">{registerError}</p>}
                                <button
                                    type="button"
                                    onClick={handleConfirmAndSignIn}
                                    disabled={loading}
                                    className="w-full py-3 text-white rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70"
                                    style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}
                                >
                                    {loading ? t('confirming') : t('activateAccount')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setView('register'); setRegisterError(null); setConfirmationCode(''); setShowFallbackCode(false); setEmailSendError(null); }}
                                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                                >
                                    {t('useDifferentEmail')}
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
                                    {t('backToSignIn')}
                                </button>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('firstName')}</label>
                                        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="Mini" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('lastName')}</label>
                                        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="Max" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('username')}</label>
                                    <div className="relative">
                                        <Icons.User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder={t('usernamePlaceholder')} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('emailLabel')}</label>
                                    <div className="relative">
                                        <Icons.Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder={t('registrationEmailPlaceholder')} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('phone')}</label>
                                    <div className="flex gap-0 rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-colors">
                                        <select
                                            value={phoneCountryCode}
                                            onChange={(e) => setPhoneCountryCode(e.target.value)}
                                            className="shrink-0 pl-2 pr-1 py-3 bg-gray-50 border-r border-gray-200 text-gray-700 font-medium outline-none cursor-pointer appearance-none text-sm"
                                            title={t('countryCodeLabel')}
                                        >
                                            {COUNTRY_CODES.map(({ code, label }) => (
                                                <option key={code} value={code}>{label}</option>
                                            ))}
                                        </select>
                                        <div className="relative flex-1 flex items-center">
                                            <Icons.Phone className="absolute left-3 text-gray-400" size={18} />
                                            <input
                                                type="tel"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                required
                                                className="w-full pl-10 pr-4 py-3 outline-none"
                                                placeholder={t('phoneNumberPlaceholder')}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('passwordLabel')}</label>
                                    <div className="relative">
                                        <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="••••••••" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('confirmPassword')}</label>
                                    <div className="relative">
                                        <Icons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder="••••••••" />
                                    </div>
                                </div>
                                {registerError && <p className="text-sm text-red-600">{registerError}</p>}
                                <button type="submit" disabled={loading} className="w-full py-3 text-white rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-70" style={{ backgroundColor: isDefaultBlue ? '#2563eb' : primaryColor }}>
                                    {loading ? t('sending') : t('requestAccount')}
                                </button>
                            </form>
                        )}

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-500">
                                {view === 'login' && t('dontHaveAccount')}
                                {view === 'login' && (
                                    <button 
                                        onClick={() => { setView('register'); setRegisterError(null); }}
                                        className="font-bold ml-1 text-blue-600 hover:text-blue-700 underline"
                                        style={!isDefaultBlue ? { color: primaryColor } : undefined}
                                    >
                                        {t('requestAccess')}
                                    </button>
                                )}
                                {(view === 'register' || view === 'check-email') && t('alreadyHaveAccount')}
                                {(view === 'register' || view === 'check-email') && (
                                    <button 
                                        onClick={() => { setView('login'); setRegisterError(null); }}
                                        className="font-bold ml-1 text-blue-600 hover:text-blue-700 underline"
                                        style={!isDefaultBlue ? { color: primaryColor } : undefined}
                                    >
                                        {t('signInButton')}
                                    </button>
                                )}
                            </p>
                        </div>
                    </>
                )}

                {/* Footer inside white card */}
                <div className="mt-8 pt-6 border-t border-gray-100 text-center text-gray-400 text-xs">
                    &copy; 2025 {theme.appName}. {t('secureConnection')}
                </div>
            </div>

            <ForgotPasswordModal
                isOpen={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
                onSuccess={() => setShowForgotPassword(false)}
                primaryColor={isDefaultBlue ? '#2563eb' : primaryColor}
            />

            <FaceScanModal
                isOpen={showFaceScan}
                onClose={() => setShowFaceScan(false)}
                onSuccess={handleFaceScanSuccess}
            />
        </div>
    );
};

export default Login;