export type CartoBaseMapStyle = 'light' | 'dark';

export type BaseMapConfig = {
    url: string;
    attribution: string;
};

const CARTO_KEY = String(import.meta.env.VITE_CARTO_BASEMAP_KEY ?? '').trim();

export const hasCartoBasemapKey = CARTO_KEY.length > 0;

export function getOpenStreetMapConfig(): BaseMapConfig {
    return {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    };
}

export function getCartoBaseMapConfig(style: CartoBaseMapStyle): BaseMapConfig {
    if (hasCartoBasemapKey) {
        const cartoStyle = style === 'dark' ? 'dark_all' : 'voyager';
        return {
            url: `https://basemaps.cartocdn.com/rastertiles/${cartoStyle}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        };
    }

    return getOpenStreetMapConfig();
}

/** Replace a rejected CARTO layer with OSM so an expired key cannot blank the map. */
export function attachCartoTileFallback(
    tileLayer: any,
    map: any,
    createFallbackLayer: () => any,
    onFallback?: (fallbackLayer: any) => void,
): void {
    if (!hasCartoBasemapKey || typeof tileLayer?.once !== 'function') return;

    tileLayer.once('tileerror', () => {
        if (!map || typeof map.removeLayer !== 'function') return;
        map.removeLayer(tileLayer);
        const fallbackLayer = createFallbackLayer();
        fallbackLayer.addTo(map);
        onFallback?.(fallbackLayer);
    });
}