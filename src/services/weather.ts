/**
 * Weather API service using Open-Meteo (free, no API key required)
 * https://open-meteo.com/
 *
 * Also provides reverse-geocoding via Nominatim (OpenStreetMap).
 */

export interface WeatherData {
    temperature: number;
    windSpeed: number;
    windDirection: string;
    /** e.g. "6°C - 12km/h NW" */
    displayText: string;
    /** WMO weather code (0 = clear, 1-3 = partly cloudy, 61-65 = rain, …) */
    weatherCode: number;
    /** Human-readable condition, e.g. "Sunny", "Partly Cloudy", "Rain" */
    condition: string;
    /** Emoji icon matching the condition */
    conditionIcon: string;
    fetchedAt: number;
}

export interface LocationInfo {
    /** City or town name */
    city: string;
    /** Country name */
    country: string;
    /** Combined display string, e.g. "Klagenfurt, Austria" */
    display: string;
    fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Weather cache
// ---------------------------------------------------------------------------

const CACHE_KEY = 'safesphere_weather_v2';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Location name cache
// ---------------------------------------------------------------------------

const LOCATION_CACHE_KEY = 'safesphere_location_v1';
const LOCATION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (place names don't change)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WIND_DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function degreesToCompass(degrees: number): string {
    const idx = Math.round(((degrees % 360) / 22.5)) % 16;
    return WIND_DIRECTIONS[idx];
}

/**
 * Map WMO weather interpretation codes to a human-readable condition + emoji.
 * Reference: https://open-meteo.com/en/docs#weathervariables
 */
function interpretWeatherCode(code: number): { condition: string; icon: string } {
    switch (code) {
        case 0:
            return { condition: 'Clear Sky', icon: '☀️' };
        case 1:
            return { condition: 'Mainly Clear', icon: '🌤️' };
        case 2:
            return { condition: 'Partly Cloudy', icon: '⛅' };
        case 3:
            return { condition: 'Overcast', icon: '☁️' };
        case 45:
        case 48:
            return { condition: 'Fog', icon: '🌫️' };
        case 51:
            return { condition: 'Light Drizzle', icon: '🌦️' };
        case 53:
            return { condition: 'Drizzle', icon: '🌦️' };
        case 55:
            return { condition: 'Heavy Drizzle', icon: '🌧️' };
        case 56:
        case 57:
            return { condition: 'Freezing Drizzle', icon: '🌧️' };
        case 61:
            return { condition: 'Light Rain', icon: '🌦️' };
        case 63:
            return { condition: 'Rain', icon: '🌧️' };
        case 65:
            return { condition: 'Heavy Rain', icon: '🌧️' };
        case 66:
        case 67:
            return { condition: 'Freezing Rain', icon: '🌧️' };
        case 71:
            return { condition: 'Light Snow', icon: '🌨️' };
        case 73:
            return { condition: 'Snow', icon: '❄️' };
        case 75:
            return { condition: 'Heavy Snow', icon: '❄️' };
        case 77:
            return { condition: 'Snow Grains', icon: '❄️' };
        case 80:
            return { condition: 'Light Showers', icon: '🌦️' };
        case 81:
            return { condition: 'Showers', icon: '🌧️' };
        case 82:
            return { condition: 'Heavy Showers', icon: '🌧️' };
        case 85:
        case 86:
            return { condition: 'Snow Showers', icon: '🌨️' };
        case 95:
            return { condition: 'Thunderstorm', icon: '⛈️' };
        case 96:
        case 99:
            return { condition: 'Thunderstorm with Hail', icon: '⛈️' };
        default:
            return { condition: 'Unknown', icon: '🌡️' };
    }
}

// ---------------------------------------------------------------------------
// Weather cache helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Location cache helpers
// ---------------------------------------------------------------------------

function getLocationCached(lat: number, lng: number): LocationInfo | null {
    try {
        // Cache at ~1 km resolution so slight GPS drift doesn't invalidate
        const key = `${LOCATION_CACHE_KEY}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
        const item = localStorage.getItem(key);
        if (!item) return null;
        const data: LocationInfo = JSON.parse(item);
        if (Date.now() - data.fetchedAt > LOCATION_CACHE_TTL_MS) return null;
        return data;
    } catch {
        return null;
    }
}

function setLocationCached(lat: number, lng: number, data: LocationInfo): void {
    try {
        const key = `${LOCATION_CACHE_KEY}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
        localStorage.setItem(key, JSON.stringify(data));
    } catch {
        // ignore
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather API ${res.status}`);
        const json = await res.json();
        const c = json.current;
        if (!c) throw new Error('Invalid weather response');

        const temperature = Math.round(c.temperature_2m ?? 0);
        const windSpeed = Math.round(c.wind_speed_10m ?? 0);
        const windDir = degreesToCompass(c.wind_direction_10m ?? 0);
        const weatherCode = c.weather_code ?? -1;
        const { condition, icon } = interpretWeatherCode(weatherCode);
        const displayText = `${icon} ${condition}, ${temperature}°C`;
        const data: WeatherData = {
            temperature,
            windSpeed,
            windDirection: windDir,
            displayText,
            weatherCode,
            condition,
            conditionIcon: icon,
            fetchedAt: Date.now()
        };
        setCached(lat, lng, data);
        return data;
    } catch (err) {
        if (cached) return cached;
        return null;
    }
}

/**
 * Reverse-geocode coordinates to a human-readable place name.
 * Uses Nominatim / OpenStreetMap (free, no API key, 1 req/s policy — cached aggressively).
 */
export async function fetchLocationName(lat: number, lng: number): Promise<LocationInfo | null> {
    const cached = getLocationCached(lat, lng);
    if (cached) return cached;

    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'SafeSphere/1.0' }
        });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const json = await res.json();
        const addr = json.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        const country = addr.country || '';
        const display = [city, country].filter(Boolean).join(', ') || 'Unknown Location';
        const data: LocationInfo = { city, country, display, fetchedAt: Date.now() };
        setLocationCached(lat, lng, data);
        return data;
    } catch {
        return null;
    }
}
