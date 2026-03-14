


import React, { useState, useCallback } from 'react';
import { Icons } from '../components/Icon';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { FaceScanModal } from '../components/FaceScanModal';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeSettings } from '../types';
import { requestAccount, confirmAccount, getPendingRegistration, authenticate } from '../services/api';
import { completeMfaChallenge, getSupabaseSessionUser, isDemoUser, resendSignUpConfirmation, signInWithGoogle, signInWithFacebook, isSupabaseReady } from '../services/auth';
import { isWebAuthnAvailable, getWebAuthnAuthOptions, verifyWebAuthnAssertion } from '../services/webauthn';
import { User } from '../types';
import { COUNTRY_CODES } from '../constants';

interface LoginProps {
    onLogin: (role: 'Admin' | 'Responder' | 'Reporter', user?: User) => void;
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
    const [password, setPassword] = useState('20Reporter#26!');
    
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
        if (!username || !username.trim()) {
            setRegisterError(t('usernameRequired') || 'Username is required for security (e.g. to prevent duplicate reports).');
            return;
        }
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
                                        setLoading(true);
                                        const result = await resendSignUpConfirmation(pendingEmail);
                                        setLoading(false);
                                        if (result.success) {
                                            setRegisterError(null);
                                            alert(t('confirmationResent') || 'Confirmation email resent! Check your inbox and spam folder.');
                                        } else {
                                            setRegisterError(result.message || 'Could not resend. Please try again.');
                                        }
                                    }}
                                    disabled={loading}
                                    className="w-full py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 underline disabled:opacity-50"
                                >
                                    {t('resendCode') || 'Resend confirmation code'}
                                </button>
                                {import.meta.env.DEV && (() => {
                                    const pending = getPendingRegistration(pendingEmail);
                                    return pending?.token ? (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center font-mono" role="status">
                                            Development: Your code is <strong>{pending.token}</strong>
                                        </p>
                                    ) : null;
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
                                    onClick={() => { setView('register'); setRegisterError(null); setConfirmationCode(''); }}
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
                                        <label htmlFor="register-first-name" className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('firstName')}</label>
                                        <input id="register-first-name" name="firstName" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder={t('firstNamePlaceholder')} />
                                    </div>
                                    <div>
                                        <label htmlFor="register-last-name" className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('lastName')}</label>
                                        <input id="register-last-name" name="lastName" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder={t('lastNamePlaceholder')} />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="register-username" className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('username')} <span className="text-red-500" title={t('requiredForSecurity')}>*</span></label>
                                    <div className="relative">
                                        <Icons.User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input id="register-username" name="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={1} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder={t('usernamePlaceholder')} aria-required="true" />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{t('usernameRequiredHint')}</p>
                                </div>
                                <div>
                                    <label htmlFor="register-email" className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('emailLabel')}</label>
                                    <div className="relative">
                                        <Icons.Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input id="register-email" name="email" type="email" autoComplete="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" placeholder={t('registrationEmailPlaceholder')} />
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
                                        onClick={() => {
                                            setView('register');
                                            setRegisterError(null);
                                            setFirstName('');
                                            setLastName('');
                                            setUsername('');
                                            setRegEmail('');
                                            setPhoneNumber('');
                                            setRegPassword('');
                                            setConfirmPassword('');
                                        }}
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
                            {(view === 'register' || view === 'check-email') && (
                                <div className="mt-3 flex flex-col gap-2">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('orLoginWith')}</p>
                                    <div className="flex gap-3 justify-center">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const result = await signInWithGoogle();
                                                if (result.success) window.location.href = result.redirectUrl;
                                                else setRegisterError(result.message);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
                                        >
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                            {t('loginWithGmail')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const result = await signInWithFacebook();
                                                if (result.success) window.location.href = result.redirectUrl;
                                                else setRegisterError(result.message);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors"
                                        >
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                            {t('loginWithFacebook')}
                                        </button>
                                    </div>
                                </div>
                            )}
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