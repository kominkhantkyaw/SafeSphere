/**
 * Matches Supabase Dashboard → Authentication → Attack Protection (Turnstile or hCaptcha).
 * If both site keys are set, hCaptcha is used so local setups that only configure hCaptcha
 * are not overridden by a stray Turnstile key.
 */

export type AuthCaptchaProvider = 'turnstile' | 'hcaptcha';

export type AuthCaptchaConfig = {
    provider: AuthCaptchaProvider;
    siteKey: string;
};

function trimKey(v: unknown): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
}

/** Non-null when the app should render a challenge and send tokens to Supabase Auth. */
export function getAuthCaptchaConfig(): AuthCaptchaConfig | null {
    const turnstile = trimKey(import.meta.env.VITE_TURNSTILE_SITE_KEY);
    const hcaptcha = trimKey(import.meta.env.VITE_HCAPTCHA_SITE_KEY);
    if (import.meta.env.DEV && turnstile && hcaptcha) {
        console.warn(
            '[SafeSphere] Both VITE_HCAPTCHA_SITE_KEY and VITE_TURNSTILE_SITE_KEY are set; using hCaptcha. Remove the unused key so it matches Supabase Attack Protection.'
        );
    }
    if (hcaptcha) return { provider: 'hcaptcha', siteKey: hcaptcha };
    if (turnstile) return { provider: 'turnstile', siteKey: turnstile };
    return null;
}
