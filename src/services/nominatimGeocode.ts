/**
 * OpenStreetMap Nominatim search (free, usage policy: https://operations.osmfoundation.org/policies/nominatim/).
 * Identify the app; do not hammer the API — debounce client-side and cache mentally per session.
 */

export interface NominatimHit {
    lat: number;
    lng: number;
    displayName: string;
}

export interface GeocodeOptions {
    signal?: AbortSignal;
    /** Prefer results near this point (viewbox hint, not strict). */
    biasLat?: number;
    biasLon?: number;
}

function buildViewbox(lat: number, lon: number, delta = 0.35): string {
    const left = lon - delta;
    const right = lon + delta;
    const top = lat + delta;
    const bottom = lat - delta;
    return `${left},${top},${right},${bottom}`;
}

export async function geocodePlaceQuery(query: string, options: GeocodeOptions = {}): Promise<NominatimHit | null> {
    const q = query.trim();
    if (q.length < 3) return null;

    const params = new URLSearchParams({
        q,
        format: 'json',
        limit: '1',
        addressdetails: '0',
    });
    params.set('accept-language', typeof navigator !== 'undefined' ? navigator.language : 'en');

    if (
        typeof options.biasLat === 'number' &&
        typeof options.biasLon === 'number' &&
        Number.isFinite(options.biasLat) &&
        Number.isFinite(options.biasLon)
    ) {
        params.set('viewbox', buildViewbox(options.biasLat, options.biasLon));
        params.set('bounded', '0');
    }

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    const res = await fetch(url, {
        signal: options.signal,
        headers: {
            Accept: 'application/json',
        },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;

    const row = data[0];
    const lat = Number.parseFloat(row.lat);
    const lng = Number.parseFloat(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
        lat,
        lng,
        displayName: row.display_name || q,
    };
}
