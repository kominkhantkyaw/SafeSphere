/**
 * OSM tile layout for printable maps (same geometry as the incident report print view).
 */

export interface PrintableOsmMapTiles {
    tiles: readonly { url: string; left: number; top: number }[];
    markerLeft: number;
    markerTop: number;
}

export function getPrintableOsmMapTiles(lat: number, lng: number): PrintableOsmMapTiles {
    const zoom = 15;
    const n = 2 ** zoom;
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    const xtileRaw = ((lng + 180) / 360) * n;
    const ytileRaw =
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const fracX = xtileRaw - Math.floor(xtileRaw);
    const fracY = ytileRaw - Math.floor(ytileRaw);
    const tileSize = 256;
    const base = 'https://tile.openstreetmap.org';
    const tiles = [
        { url: `${base}/${zoom}/${x - 1}/${y - 1}.png`, left: 0, top: 0 },
        { url: `${base}/${zoom}/${x}/${y - 1}.png`, left: tileSize, top: 0 },
        { url: `${base}/${zoom}/${x - 1}/${y}.png`, left: 0, top: tileSize },
        { url: `${base}/${zoom}/${x}/${y}.png`, left: tileSize, top: tileSize },
    ];
    const markerLeft = tileSize + fracX * tileSize - 5;
    const markerTop = tileSize + fracY * tileSize - 5;
    return { tiles, markerLeft, markerTop };
}
