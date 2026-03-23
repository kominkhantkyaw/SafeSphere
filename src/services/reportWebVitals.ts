import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

/** Stable JSON body for your collector (Edge Function, Vercel route, etc.). */
export function metricToReportBody(metric: Metric): Record<string, unknown> {
    return {
        schema: 'safesphere-web-vitals/v1',
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType ?? null,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
    };
}

function sendToEndpoint(endpoint: string, body: Record<string, unknown>): void {
    try {
        const json = JSON.stringify(body);
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const blob = new Blob([json], { type: 'application/json' });
            if (navigator.sendBeacon(endpoint, blob)) return;
        }
        void fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: json,
            keepalive: true,
            mode: 'cors',
        });
    } catch {
        /* non-fatal */
    }
}

/**
 * Registers Core Web Vitals (CLS, INP, LCP, FCP, TTFB).
 * - Development: logs to console.
 * - Production: if `VITE_WEB_VITALS_ENDPOINT` is set, POSTs JSON (sendBeacon / fetch keepalive).
 * Your endpoint must allow CORS from your site and accept `application/json`.
 */
export function initWebVitalsReporting(): void {
    if (typeof window === 'undefined') return;

    const endpoint = import.meta.env.VITE_WEB_VITALS_ENDPOINT?.trim();
    const debugInProd = import.meta.env.VITE_WEB_VITALS_DEBUG === '1';

    const onReport = (metric: Metric) => {
        const body = metricToReportBody(metric);
        if (import.meta.env.DEV || debugInProd) {
            // eslint-disable-next-line no-console -- intentional UX diagnostics
            console.debug('[Web Vitals]', body.name, body.value, body.rating, body);
        }
        if (endpoint) {
            sendToEndpoint(endpoint, body);
        }
    };

    onCLS(onReport);
    onINP(onReport);
    onLCP(onReport);
    onFCP(onReport);
    onTTFB(onReport);
}
