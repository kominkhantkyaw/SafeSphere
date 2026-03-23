import React, { useEffect, useMemo, useRef } from 'react';
import { getAuthCaptchaConfig } from '../config/authCaptcha';
import { loadExternalScript } from '../utils/loadExternalScript';

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement | string,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                    'expired-callback'?: () => void;
                    'error-callback'?: () => void;
                }
            ) => string;
            remove?: (widgetId: string) => void;
        };
        hcaptcha?: {
            render: (
                container: HTMLElement,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                    'expired-callback'?: () => void;
                    'error-callback'?: () => void;
                }
            ) => string;
            remove?: (widgetId: string) => void;
        };
    }
}

export interface AuthCaptchaProps {
    onToken: (token: string | null) => void;
    className?: string;
}

/**
 * Renders hCaptcha or Turnstile when the corresponding VITE_* site key is set (hCaptcha wins if both are set).
 * Required when Supabase Bot Protection is enabled.
 */
export const AuthCaptcha: React.FC<AuthCaptchaProps> = ({ onToken, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;
    const cfg = useMemo(() => getAuthCaptchaConfig(), []);

    useEffect(() => {
        if (!cfg || !containerRef.current) return;
        let cancelled = false;
        const el = containerRef.current;

        const run = async () => {
            try {
                if (cfg.provider === 'turnstile') {
                    await loadExternalScript('https://challenges.cloudflare.com/turnstile/v0/api.js');
                } else {
                    await loadExternalScript('https://js.hcaptcha.com/1/api.js');
                }
                if (cancelled || !el) return;

                if (cfg.provider === 'turnstile' && window.turnstile) {
                    widgetIdRef.current = window.turnstile.render(el, {
                        sitekey: cfg.siteKey,
                        callback: (token) => onTokenRef.current(token),
                        'expired-callback': () => onTokenRef.current(null),
                        'error-callback': () => onTokenRef.current(null),
                    });
                } else if (cfg.provider === 'hcaptcha' && window.hcaptcha) {
                    widgetIdRef.current = window.hcaptcha.render(el, {
                        sitekey: cfg.siteKey,
                        callback: (token) => onTokenRef.current(token),
                        'expired-callback': () => onTokenRef.current(null),
                        'error-callback': () => onTokenRef.current(null),
                    });
                }
            } catch {
                if (!cancelled) onTokenRef.current(null);
            }
        };

        void run();

        return () => {
            cancelled = true;
            const id = widgetIdRef.current;
            widgetIdRef.current = null;
            if (!id) return;
            try {
                if (cfg.provider === 'turnstile') window.turnstile?.remove?.(id);
                else window.hcaptcha?.remove?.(id);
            } catch {
                /* ignore */
            }
        };
    }, [cfg]);

    if (!cfg) return null;

    return <div className={className} ref={containerRef} data-auth-captcha={cfg.provider} />;
};
