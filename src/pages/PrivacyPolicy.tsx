import React from 'react';
import { Icons } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';

interface PrivacyPolicyProps {
    onBack?: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
    const { t } = useLanguage();
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24 sm:pb-28">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white border-b border-gray-200 safe-top">
                <div className="flex items-center gap-3 sm:gap-4 p-4 sm:px-6">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors touch-manipulation shrink-0"
                            aria-label={t('back')}
                        >
                            <Icons.ChevronLeft size={20} />
                        </button>
                    )}
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{t('privacyPolicy')}</h1>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 sm:px-6 py-6 space-y-6 max-w-2xl mx-auto">
                {/* Header Section */}
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                            <Icons.Shield size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{t('yourPrivacyMatters')}</h2>
                            <p className="text-sm text-white/80">{t('euDataProtection')}</p>
                        </div>
                    </div>
                    <p className="text-sm text-white/90">
                        {t('privacyIntro')}
                    </p>
                </div>

                {/* Last Updated */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Icons.Calendar size={18} className="text-blue-600" />
                        <span className="text-sm text-blue-900 font-medium">{t('lastUpdated')}</span>
                    </div>
                    <span className="text-sm text-blue-700">December 8, 2025</span>
                </div>

                {/* 1. Data Collection */}
                <div className="bg-white rounded-2xl shadow-md p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Icons.MapPin size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('dataCollection')}</h3>
                        </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                        {t('dataCollectionDesc')}
                    </p>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                        <p className="text-sm text-blue-900">
                            <Icons.Shield size={16} className="inline mr-2" />
                            {t('locationNeverSold')}
                        </p>
                    </div>
                </div>

                {/* 2. End-to-End Encryption */}
                <div className="bg-white rounded-2xl shadow-md p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Icons.Lock size={20} className="text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('endToEndEncryption')}</h3>
                        </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed mb-3">
                        {t('endToEndEncryptionDesc')}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                            <div className="text-2xl font-bold text-green-600">256-bit</div>
                            <div className="text-xs text-green-700 mt-1">{t('aesEncryption')}</div>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                            <div className="text-2xl font-bold text-green-600">Zero</div>
                            <div className="text-xs text-green-700 mt-1">{t('zeroAccessPolicy')}</div>
                        </div>
                    </div>
                </div>

                {/* 3. User Rights */}
                <div className="bg-white rounded-2xl shadow-md p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Icons.User size={20} className="text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('userRights')}</h3>
                        </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed mb-4">
                        {t('userRightsDesc')}
                    </p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                            <Icons.Check size={16} className="text-purple-600" />
                            <span className="text-sm text-gray-700">{t('rightToAccess')}</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                            <Icons.Check size={16} className="text-purple-600" />
                            <span className="text-sm text-gray-700">{t('rightToRectification')}</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                            <Icons.Check size={16} className="text-purple-600" />
                            <span className="text-sm text-gray-700">{t('rightToErasure')}</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                            <Icons.Check size={16} className="text-purple-600" />
                            <span className="text-sm text-gray-700">{t('rightToPortability')}</span>
                        </div>
                    </div>
                </div>

                {/* 4. Emergency Disclosure */}
                <div className="bg-white rounded-2xl shadow-md p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Icons.AlertTriangle size={20} className="text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('emergencyDisclosure')}</h3>
                        </div>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                        {t('emergencyDisclosureDesc')}
                    </p>
                    <div className="mt-4 p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                        <div className="flex items-start gap-2">
                            <Icons.AlertTriangle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-900 mb-1">{t('whenWeShareData')}</p>
                                <ul className="text-sm text-red-800 space-y-1 ml-4 list-disc">
                                    <li>{t('triggerSos')}</li>
                                    <li>{t('emergencyRequest')}</li>
                                    <li>{t('legalObligation')}</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact & Support */}
                <div className="bg-white rounded-2xl shadow-md p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Icons.HelpCircle size={24} className="text-gray-500" />
                        <h3 className="text-lg font-bold text-gray-900">{t('questionsOrConcerns')}</h3>
                    </div>
                    <p className="text-gray-700 mb-4">
                        {t('privacyContact')}
                    </p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <Icons.Mail size={16} className="text-gray-500" />
                            <a href="mailto:privacy@safesphere.app" className="text-blue-600 hover:underline">
                                privacy@safesphere.app
                            </a>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Icons.Globe size={16} className="text-gray-500" />
                            <a href="https://www.safesphere.app/privacy" className="text-blue-600 hover:underline">
                                www.safesphere.app/privacy
                            </a>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="text-center py-6 border-t border-gray-200">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Icons.ShieldCheck size={20} className="text-gray-600" />
                        <span className="font-bold text-gray-900">SafeSphere</span>
                    </div>
                    <p className="text-sm text-gray-600">
                        © 2025 SafeSphere. {t('allRightsReserved')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {t('euGdprCompliant')} & {t('isoCertified')}.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
