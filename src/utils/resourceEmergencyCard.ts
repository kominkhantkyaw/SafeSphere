import QRCode from 'qrcode';
import type { Resource } from '../types';
import { getPrintableOsmMapTiles } from './printMapTiles';

export function resourceQrPayload(resource: Resource): string {
    return JSON.stringify({ id: resource.id, type: 'resource' });
}

export async function resourceQrDataUrl(resource: Resource, width: number): Promise<string> {
    return QRCode.toDataURL(resourceQrPayload(resource), {
        width,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
    });
}

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function googleMapsDirectionsUrl(r: Resource): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
}

export function openStreetMapUrl(r: Resource): string {
    return `https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=16/${r.lat}/${r.lng}`;
}

/**
 * Static map preview (OpenStreetMap data). Best-effort — some networks block third-party images.
 * @deprecated Prefer tile-based maps in print HTML for consistency with incident reports.
 */
export function osmStaticMapImageUrl(r: Resource, w = 640, h = 320): string {
    const { lat, lng } = r;
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=${w}x${h}&maptype=mapnik&markers=${lat},${lng},red-pushpin`;
}

function buildTileMapBlockHtml(lat: number, lng: number, sectionTitleEscaped: string): string {
    const res = getPrintableOsmMapTiles(lat, lng);
    const srcSize = 512;
    const pw = 567;
    const ph = 424;
    const scaleX = pw / srcSize;
    const scaleY = ph / srcSize;
    const markerSize = 18;
    const imgs = res.tiles
        .map(
            (tile) =>
                `<img src="${tile.url}" alt="" style="position:absolute;left:${tile.left}px;top:${tile.top}px;width:600px;height:500px;margin-left:${-tile.left}px;margin-top:${-tile.top}px"/>`
        )
        .join('');
    const markerLeft = res.markerLeft * scaleX - markerSize / 2;
    const markerTop = res.markerTop * scaleY - markerSize / 2;
    return `<div class="print-map-wrap" style="width:100%;margin-bottom:6px">
    <p style="margin:0 0 4px;font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase">${sectionTitleEscaped}</p>
    <div style="position:relative;width:100%;aspect-ratio:4/3;overflow:hidden;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb">
      <div style="position:absolute;left:0;top:0;width:${srcSize}px;height:${srcSize}px;transform:scale(${scaleX},${scaleY});transform-origin:top left">
        ${imgs}
      </div>
      <div style="position:absolute;left:${markerLeft}px;top:${markerTop}px;width:${markerSize}px;height:${markerSize}px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>
    </div>
  </div>`;
}

/** Localisable strings for the printable emergency card (defaults UK English). */
export interface ResourcePrintCopy {
    documentMainTitle: string;
    documentTitleSuffix: string;
    resourceIdLabel: string;
    facilityRowLabel: string;
    typeRowLabel: string;
    typeDisplayValue: string;
    addressSectionTitle: string;
    mapSectionTitle: string;
    coordinatesLabel: string;
    phoneLabel: string;
    hoursLabel: string;
    urgencyLabel: string;
    detailsSectionTitle: string;
    directionsSectionTitle: string;
    directionsIntro: string;
    googleDirectionsText: string;
    openStreetMapText: string;
    mapPrintHint: string;
    omitMapNote: string;
    pointOfContactTitle: string;
    nameLabel: string;
    contactPhoneLabel: string;
    scanFooterLine: string;
    attachmentsSectionTitle: string;
    attachmentsNone: string;
    qrAlt: string;
}

const DEFAULT_PRINT_COPY: ResourcePrintCopy = {
    documentMainTitle: 'SafeSphere Emergency Resource',
    documentTitleSuffix: 'Emergency resource',
    resourceIdLabel: 'Resource ID',
    facilityRowLabel: 'Facility',
    typeRowLabel: 'Service type',
    typeDisplayValue: '',
    addressSectionTitle: 'Address',
    mapSectionTitle: 'Location map',
    coordinatesLabel: 'Location (coordinates)',
    phoneLabel: 'Phone',
    hoursLabel: 'Hours',
    urgencyLabel: 'Urgency',
    detailsSectionTitle: 'Description',
    directionsSectionTitle: 'Navigation',
    directionsIntro: 'Open on your phone for live GPS routing (same as Get directions in the app).',
    googleDirectionsText: 'Google Maps — get directions',
    openStreetMapText: 'OpenStreetMap — view on map',
    mapPrintHint:
        'If map tiles do not appear in print preview, use the navigation links below — they open the same live maps.',
    omitMapNote:
        'Location map omitted for a lighter printout. Use GPS coordinates and the navigation links below.',
    pointOfContactTitle: 'Point of contact',
    nameLabel: 'Name',
    contactPhoneLabel: 'Phone',
    scanFooterLine: 'Scan QR to open in SafeSphere • SafeSphere',
    attachmentsSectionTitle: 'Attachments',
    attachmentsNone: 'None',
    qrAlt: 'QR Code',
};

export function resourceEmergencyPlainText(r: Resource): string {
    const parts = [
        r.name,
        r.address,
        '',
        `Phone: ${r.phone}`,
        r.description ? `\n${r.description}` : '',
        '',
        `GPS: ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`,
        '',
        `Google Maps (directions): ${googleMapsDirectionsUrl(r)}`,
        `OpenStreetMap: ${openStreetMapUrl(r)}`,
        '',
        '— SafeSphere —',
    ];
    return parts.join('\n');
}

export interface BuildResourcePrintHtmlOptions {
    /** When false, skips embedded map tiles (smaller print job). Default true. */
    includeMap?: boolean;
}

export async function buildResourcePrintHtml(
    r: Resource,
    copy: Partial<ResourcePrintCopy> = {},
    options: BuildResourcePrintHtmlOptions = {}
): Promise<string> {
    const c = { ...DEFAULT_PRINT_COPY, ...copy };
    const includeMap = options.includeMap !== false;
    const qrDataUrl = await resourceQrDataUrl(r, 48);
    const title = escapeHtml(r.name);
    const addr = escapeHtml(r.address);
    const phone = escapeHtml(r.phone);
    const desc = r.description ? escapeHtml(r.description) : '';
    const hours = r.operatingHours ? escapeHtml(r.operatingHours) : '';
    const gUrl = googleMapsDirectionsUrl(r);
    const oUrl = openStreetMapUrl(r);
    const typeVal = escapeHtml(c.typeDisplayValue || r.type);
    const esc = (s: string) => escapeHtml(s);

    const pocBlock =
        r.contactPerson || r.contactPhone
            ? `<div style="margin-bottom:8px;padding:8px;background:#eff6ff;border-radius:4px;border:1px solid #bfdbfe">
    <p style="margin:0 0 4px;font-size:9px;font-weight:700;color:#1d4ed8;text-transform:uppercase">${esc(c.pointOfContactTitle)}</p>
    ${r.contactPerson ? `<p style="margin:0 0 2px;font-size:9px"><strong>${esc(c.nameLabel)}:</strong> ${escapeHtml(r.contactPerson)}</p>` : ''}
    ${r.contactPhone ? `<p style="margin:0;font-size:9px"><strong>${esc(c.contactPhoneLabel)}:</strong> ${escapeHtml(r.contactPhone)}</p>` : ''}
  </div>`
            : '';

    const urgencyRow = r.urgency
        ? `<tr><td style="padding:3px 0;color:#6b7280;width:28%;font-size:9">${esc(c.urgencyLabel)}</td><td style="padding:3px 0;font-weight:600;font-size:9">${escapeHtml(r.urgency)}</td></tr>`
        : '';

    const mapSection = includeMap
        ? `${buildTileMapBlockHtml(r.lat, r.lng, esc(c.mapSectionTitle))}
    <p style="margin:0 0 8px;font-size:8px;color:#6b7280;line-height:1.35">${esc(c.mapPrintHint)}</p>`
        : `<p style="margin:0 0 8px;padding:8px;background:#f9fafb;border-radius:4px;border:1px solid #e5e7eb;font-size:9px;color:#4b5563">${esc(c.omitMapNote)}</p>`;

    const descBlock = desc
        ? `<div style="margin-bottom:8px">
    <p style="margin:0 0 4px;font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase">${esc(c.detailsSectionTitle)}</p>
    <p style="margin:0;padding:8px;background:#f9fafb;border-radius:4px;white-space:pre-wrap;font-size:9px;border:1px solid #e5e7eb">${desc}</p>
  </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — ${esc(c.documentTitleSuffix)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, system-ui, -apple-system, sans-serif; margin: 0; padding: 10mm; color: #111; background: #fff; }
  a { color: #1d4ed8; }
  @media print {
    body { padding: 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
<div style="font-family:Inter,sans-serif;display:flex;flex-direction:column;gap:8px;max-width:186mm">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:8px">
    <div>
      <h1 style="margin:0;font-size:14px;font-weight:700;color:#1e40af">${esc(c.documentMainTitle)}</h1>
      <p style="margin:2px 0 0;font-size:12px;font-weight:600;color:#374151">${esc(c.resourceIdLabel)}: #${r.id}</p>
    </div>
    <img src="${qrDataUrl}" alt="${esc(c.qrAlt)}" width="48" height="48" style="width:48px;height:48px"/>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
    <tbody>
      <tr><td style="padding:3px 0;color:#6b7280;width:28%;font-size:9">${esc(c.facilityRowLabel)}</td><td style="padding:3px 0;font-weight:600;font-size:9">${title}</td></tr>
      <tr><td style="padding:3px 0;color:#6b7280;font-size:9">${esc(c.typeRowLabel)}</td><td style="padding:3px 0;font-weight:600;font-size:9">${typeVal}</td></tr>
      ${urgencyRow}
      <tr><td style="padding:3px 0;color:#6b7280;font-size:9">${esc(c.addressSectionTitle)}</td><td style="padding:3px 0;font-weight:600;font-size:9">${addr}</td></tr>
      <tr><td style="padding:3px 0;color:#6b7280;font-size:9">${esc(c.coordinatesLabel)}</td><td style="padding:3px 0;font-family:monospace;font-size:8">${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</td></tr>
      <tr><td style="padding:3px 0;color:#6b7280;font-size:9">${esc(c.phoneLabel)}</td><td style="padding:3px 0;font-weight:600;font-size:9">${phone}</td></tr>
      ${hours ? `<tr><td style="padding:3px 0;color:#6b7280;font-size:9">${esc(c.hoursLabel)}</td><td style="padding:3px 0;font-weight:600;font-size:9">${hours}</td></tr>` : ''}
    </tbody>
  </table>
  ${mapSection}
  ${pocBlock}
  ${descBlock}
  <div style="margin-bottom:8px">
    <p style="margin:0 0 4px;font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase">${esc(c.directionsSectionTitle)}</p>
    <p style="margin:0 0 6px;font-size:9px;color:#4b5563">${esc(c.directionsIntro)}</p>
    <p style="margin:0 0 4px;font-size:9px"><a href="${gUrl}">${esc(c.googleDirectionsText)}</a></p>
    <p style="margin:0;font-size:9px"><a href="${oUrl}">${esc(c.openStreetMapText)}</a></p>
  </div>
  <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb">
    <p style="margin:0 0 4px;font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase">${esc(c.attachmentsSectionTitle)}</p>
    <span style="font-size:9px;color:#9ca3af">${esc(c.attachmentsNone)}</span>
  </div>
  <p style="margin-top:8px;font-size:8px;color:#9ca3af">${esc(c.scanFooterLine)}</p>
</div>
</body></html>`;
}
