/// <reference types="vite/client" />

declare module 'virtual:pwa-register' {
    export function registerSW(options?: { immediate?: boolean }): void;
}

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY?: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    /** HTTPS URL that accepts POST JSON (Core Web Vitals). Empty = no network send. */
    readonly VITE_WEB_VITALS_ENDPOINT?: string;
    /** Set to "1" to log Web Vitals to the console in production builds. */
    readonly VITE_WEB_VITALS_DEBUG?: string;
    readonly VITE_TURNSTILE_SITE_KEY?: string;
    readonly VITE_HCAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
