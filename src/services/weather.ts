/**
 * Weather API service using Open-Meteo (free, no API key required)
 * https://open-meteo.com/
 */

export interface WeatherData {
    temperature: number;
    windSpeed: number;
    windDirection: string;
    displayText: string;
    fetchedAt: number;
}

const CACHE_KEY = 'safesphere_weather_v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const WIND_DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function degreesToCompass(degrees: number): string {
    const idx = Math.round(((degrees % 360) / 22.5)) % 16;
    return WIND_DIRECTIONS[idx];
}

function getCached(lat: number, lng: number): WeatherData | null {
    try {
        const key = `${CACHE_KEY}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
        const item = localStorage.getItem(key);
        if (!item) return null;
        const data: WeatherData = JSON.parse(item);
        if (Date.now() - data.fetchedAt > CACHE_TTL_MS) return null;
        return data;
    } catch {
        return null;
    }
}

function setCached(lat: number, lng: number, data: WeatherData): void {
    try {
        const key = `${CACHE_KEY}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
        localStorage.setItem(key, JSON.stringify(data));
    } catch {
        // ignore
    }
}

/**
 * Fetch current weather for the given coordinates.
 * Uses Open-Meteo API (free, no API key).
 * Caches result for 10 minutes. Falls back to cache when offline.
 * @param forceRefresh - If true, bypasses cache and always fetches fresh data.
 */
export async function fetchWeather(lat: number, lng: number, forceRefresh = false): Promise<WeatherData | null> {
    const cached = forceRefresh ? null : getCached(lat, lng);
    if (cached && !navigator.onLine) return cached;

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather API ${res.status}`);
        const json = await res.json();
        const c = json.current;
        if (!c) throw new Error('Invalid weather response');

        const temperature = Math.round(c.temperature_2m ?? 0);
        const windSpeed = Math.round(c.wind_speed_10m ?? 0);
        const windDir = degreesToCompass(c.wind_direction_10m ?? 0);
        const displayText = `${temperature}°C - ${windSpeed}km/h ${windDir}`;
        const data: WeatherData = {
            temperature,
            windSpeed,
            windDirection: windDir,
            displayText,
            fetchedAt: Date.now()
        };
        setCached(lat, lng, data);
        return data;
    } catch (err) {
        if (cached) return cached;
        return null;
    }
}
