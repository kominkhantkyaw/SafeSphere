import React from 'react';
import { Icons } from './Icon';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Variant = 'default' | 'minimal';

interface SafeSphereLogoProps {
    size?: Size;
    showText?: boolean;
    darkMode?: boolean;
    variant?: Variant;
    className?: string;
}

const sizeConfig = {
    sm: { icon: 24, box: 'w-8 h-8', text: 'text-sm' },
    md: { icon: 22, box: 'w-11 h-11', text: 'text-base' },
    lg: { icon: 28, box: 'w-14 h-14', text: 'text-xl' },
    xl: { icon: 20, box: 'w-10 h-10', text: 'text-[11.5px]' },
};

const SafeSphereLogo: React.FC<SafeSphereLogoProps> = ({ size = 'md', showText = true, darkMode = false, variant = 'default', className = '' }) => {
    const config = sizeConfig[size];
    const Icon = Icons.ShieldCheck;
    const isMinimal = variant === 'minimal';

    const iconClasses = isMinimal
        ? (darkMode ? 'text-gray-400' : 'text-gray-600')
        : 'text-white drop-shadow-sm';

    const textClasses = isMinimal
        ? `font-extrabold uppercase tracking-wider ${config.text} min-w-0 truncate ${darkMode ? 'text-gray-200' : 'text-gray-800'}`
        : darkMode
            ? `font-extrabold tracking-tight ${config.text} bg-gradient-to-r from-blue-300 via-blue-400 to-indigo-400 bg-clip-text text-transparent`
            : `font-extrabold tracking-tight ${config.text} bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 bg-clip-text text-transparent`;

    return (
        <div className={`flex items-center gap-1.5 min-w-0 ${className}`}>
            {isMinimal ? (
                <Icon size={config.icon} className={`shrink-0 ${iconClasses}`} strokeWidth={2.5} />
            ) : (
                <div
                    className={`${config.box} rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 shadow-lg shadow-blue-600/25 ring-2 ring-white/20`}
                >
                    <Icon size={config.icon} className={iconClasses} strokeWidth={2.5} />
                </div>
            )}
            {showText && (
                <span className={textClasses}>
                    SafeSphere
                </span>
            )}
        </div>
    );
};

export default SafeSphereLogo;
