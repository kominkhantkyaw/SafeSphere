import React, { useState, useEffect } from 'react';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';

const ONBOARDING_KEY = 'safesphere_onboarding_done';

interface OnboardingProps {
    onComplete?: () => void;
    onGoToLearn?: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onGoToLearn }) => {
    const { t } = useLanguage();
    const [show, setShow] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        const done = localStorage.getItem(ONBOARDING_KEY);
        if (!done) setShow(true);
    }, []);

    const handleComplete = () => {
        localStorage.setItem(ONBOARDING_KEY, '1');
        setShow(false);
        onComplete?.();
    };

    const steps = [
        {
            icon: Icons.ShieldCheck,
            titleKey: 'onboardingWelcome',
            descKey: 'onboardingWelcomeDesc',
        },
        {
            icon: Icons.Clipboard,
            titleKey: 'onboardingPrepare',
            descKey: 'onboardingPrepareDesc',
        },
        {
            icon: Icons.BookOpen,
            titleKey: 'onboardingLearn',
            descKey: 'onboardingLearnDesc',
        },
        {
            icon: Icons.Crown,
            titleKey: 'onboardingReady',
            descKey: 'onboardingReadyDesc',
        },
    ];

    if (!show) return null;

    const current = steps[step];
    const Icon = current?.icon ?? Icons.ShieldCheck;
    const isLast = step === steps.length - 1;

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
            onClick={handleComplete}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
        >
            <div
                className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Progress dots */}
                <div className="flex justify-center gap-2 pt-6 pb-2 shrink-0">
                    {steps.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setStep(i)}
                            className={`h-2 rounded-full transition-all duration-200 ${i === step ? 'bg-blue-600 w-6' : 'w-2 bg-gray-200'}`}
                            aria-label={`Step ${i + 1}`}
                            aria-current={i === step ? 'step' : undefined}
                        />
                    ))}
                </div>

                {/* Content - scrollable if needed */}
                <div className="px-6 pb-4 pt-2 overflow-y-auto flex-1 min-h-0">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-4 shrink-0">
                        <Icon size={32} className="text-blue-600" />
                    </div>
                    <h2 id="onboarding-title" className="text-xl font-bold text-gray-900 text-center mb-3">{t(current.titleKey)}</h2>
                    <p className="text-sm text-gray-600 text-center leading-relaxed break-words">{t(current.descKey)}</p>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 pt-2 flex flex-col gap-2 shrink-0">
                    {isLast ? (
                        <>
                            <button
                                onClick={handleComplete}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                {t('onboardingGetStarted')}
                            </button>
                            {onGoToLearn && (
                                <button
                                    onClick={() => {
                                        handleComplete();
                                        onGoToLearn();
                                    }}
                                    className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    {(Icons.BookOpen ? <Icons.BookOpen size={18} /> : <Icons.ShieldCheck size={18} />)}
                                    {t('onboardingViewLearn')}
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setStep(s => s + 1)}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                {t('nextButton')}
                            </button>
                            <button
                                onClick={handleComplete}
                                className="text-sm text-gray-500 hover:text-gray-700 py-2"
                            >
                                {t('onboardingSkip')}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
