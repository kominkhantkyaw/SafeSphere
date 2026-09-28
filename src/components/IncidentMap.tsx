
import React, { useEffect, useRef, useState } from 'react';
import { DOWNTOWN_YANGON } from '../constants';
import { IncidentReport, Resource } from '../types';
import { attachCartoTileFallback, getCartoBaseMapConfig, getOpenStreetMapConfig, hasCartoBasemapKey } from '../config/maps';

declare global {
  interface Window {
    L: any;
  }
}

export interface IncidentMapPin {
  lat: number;
  lng: number;
  label: string;
  /** Shown under the title in the pin popup (e.g. localised “Search area”). */
  subtitle?: string;
}

interface IncidentMapProps {
  reports: (IncidentReport | Resource)[];
  centerLat?: number;
  centerLng?: number;
  showUserLocation?: boolean;
  onLocationUpdate?: (lat: number, lng: number) => void;
  /** Extra markers (e.g. geocoded search location) — shown with a distinct pin. */
  mapPins?: IncidentMapPin[];
}

const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const IncidentMap: React.FC<IncidentMapProps> = ({
    reports,
    centerLat = DOWNTOWN_YANGON.lat,
    centerLng = DOWNTOWN_YANGON.lng,
    showUserLocation = false,
    onLocationUpdate,
    mapPins = [],
}) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const userMarkerRef = useRef<any>(null);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!mapContainer.current || !window.L) return;

        // Initialize map if not already done
        if (!mapInstance.current) {
            mapInstance.current = window.L.map(mapContainer.current).setView([centerLat, centerLng], 12);
            
            const baseMap = getCartoBaseMapConfig('light');
            const tileLayer = window.L.tileLayer(baseMap.url, {
                attribution: baseMap.attribution,
                maxZoom: 20
            }).addTo(mapInstance.current);
            if (hasCartoBasemapKey) {
                attachCartoTileFallback(
                    tileLayer,
                    mapInstance.current,
                    () => window.L.tileLayer(getOpenStreetMapConfig().url, {
                        attribution: getOpenStreetMapConfig().attribution,
                        maxZoom: 20,
                    }),
                );
            }
        } else {
             mapInstance.current.setView([centerLat, centerLng], 12);
        }

        // Let reporter/responder pin the incident location by clicking on the map.
        const handleMapClick = (e: any) => {
            const lat = e?.latlng?.lat;
            const lng = e?.latlng?.lng;
            if (typeof lat !== 'number' || typeof lng !== 'number') return;
            onLocationUpdate?.(lat, lng);
        };

        if (typeof onLocationUpdate === 'function') {
            mapInstance.current.on('click', handleMapClick);
        }

        // Clear existing markers
        mapInstance.current.eachLayer((layer: any) => {
            if (layer instanceof window.L.Marker) {
                mapInstance.current.removeLayer(layer);
            }
        });

        // Alert icon: pulsing rings + centre dot (same style for all incident types)
        const createAlertIcon = (color: string) =>
            window.L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div style='position: relative; width: 120px; height: 120px;'>
                        <div style='position: absolute; top: 50%; left: 50%; width: 24px; height: 24px; margin-left: -12px; margin-top: -12px; border-radius: 50%; border: 3px solid ${color}; box-sizing: border-box; animation: fireWave 2s ease-out infinite; animation-delay: 0s;'></div>
                        <div style='position: absolute; top: 50%; left: 50%; width: 24px; height: 24px; margin-left: -12px; margin-top: -12px; border-radius: 50%; border: 3px solid ${color}; box-sizing: border-box; animation: fireWave 2s ease-out infinite; animation-delay: 0.4s;'></div>
                        <div style='position: absolute; top: 50%; left: 50%; width: 24px; height: 24px; margin-left: -12px; margin-top: -12px; border-radius: 50%; border: 3px solid ${color}; box-sizing: border-box; animation: fireWave 2s ease-out infinite; animation-delay: 0.8s;'></div>
                        <div style='position: absolute; top: 50%; left: 50%; width: 24px; height: 24px; margin-left: -12px; margin-top: -12px; border-radius: 50%; border: 3px solid ${color}; box-sizing: border-box; animation: fireWave 2s ease-out infinite; animation-delay: 1.2s;'></div>
                        <div style='position: absolute; top: 50%; left: 50%; width: 24px; height: 24px; margin-left: -12px; margin-top: -12px; border-radius: 50%; border: 3px solid ${color}; box-sizing: border-box; animation: fireWave 2s ease-out infinite; animation-delay: 1.6s;'></div>
                        <div style='position: absolute; top: 50%; left: 50%; margin-left: -12px; margin-top: -12px; background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; animation: firePulse 1.2s ease-in-out infinite, fireGlow 1.2s ease-in-out infinite;'></div>
                    </div>
                `,
                iconSize: [120, 120],
                iconAnchor: [60, 60]
            });

        const createDotIcon = (color: string) =>
            window.L.divIcon({
                className: 'custom-div-icon',
                html: `<div style='background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);'></div>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });

        // Incident alert colours (matches Report form hazard types)
        const incidentAlertColors: Record<string, string> = {
            FIRE: '#ef4444',           // Structural Fire – red
            FLOOD: '#3b82f6',          // Flash Flood – blue
            MEDICAL: '#dc2626',        // Medical Emergency – red
            POWER: '#f59e0b',          // Power Outage – amber
            OUTAGE: '#f59e0b',
            HAZARDOUS: '#ea580c',      // Hazardous Spill – orange
            SPILL: '#ea580c',
            OTHER: '#6b7280',          // Other – gray
            DEFAULT: '#6b7280'
        };

        const getIncidentColor = (typeKey: string): string => {
            if (typeKey.includes('FIRE') && !typeKey.includes('FLOOD')) return incidentAlertColors.FIRE;
            if (typeKey.includes('FLOOD')) return incidentAlertColors.FLOOD;
            if (typeKey.includes('MEDICAL')) return incidentAlertColors.MEDICAL;
            if (typeKey.includes('POWER') || typeKey.includes('OUTAGE')) return incidentAlertColors.POWER;
            if (typeKey.includes('HAZARDOUS') || typeKey.includes('SPILL')) return incidentAlertColors.HAZARDOUS;
            return incidentAlertColors.OTHER;
        };

        // Add markers
        reports.forEach(item => {
            const typeKey = item.type.toUpperCase();
            const isResource = 'name' in item;
            const color = getIncidentColor(typeKey);
            const icon = isResource
                ? createDotIcon(color)
                : createAlertIcon(color);

            // Determine popup content based on item type
            let popupContent = '';
            if ('name' in item) {
                // Resource
                const r = item as Resource;
                popupContent = `
                    <div style="min-width: 150px; font-family: 'Inter', sans-serif;">
                        <b style="font-size: 14px;">${r.name}</b><br>
                        <span style="text-transform:capitalize; font-size:12px; color: #666;">${r.type}</span><br>
                        <span style="font-size:12px;">${r.address}</span><br>
                        <div style="display:flex; gap:6px; margin-top:8px;">
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}" target="_blank" style="flex:1; display:block; text-align:center; background:#000; color:#fff; padding:4px; text-decoration:none; border-radius:4px; font-size:11px; font-weight:600;">Directions</a>
                            ${window.handleMapAction ? `<button onclick="window.handleMapAction('resource', ${r.id})" style="flex:1; background:#f3f4f6; color:#1f2937; border:1px solid #e5e7eb; padding:4px; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer;">Details</button>` : ''}
                        </div>
                    </div>`;
            } else {
                // Incident Report
                const r = item as IncidentReport;
                popupContent = `
                    <div style="min-width: 150px; font-family: 'Inter', sans-serif;">
                        <b style="font-size: 14px;">${r.type}</b><br>
                        <span style="font-size:12px; color: #374151;">${r.description}</span><br>
                        <span style="color:#9ca3af;font-size:10px">${r.timestamp}</span><br>
                         <div style="display:flex; gap:6px; margin-top:8px;">
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}" target="_blank" style="flex:1; display:block; text-align:center; background:#000; color:#fff; padding:4px; text-decoration:none; border-radius:4px; font-size:11px; font-weight:600;">Directions</a>
                            ${window.handleMapAction ? `<button onclick="window.handleMapAction('report', ${r.id})" style="flex:1; background:#f3f4f6; color:#1f2937; border:1px solid #e5e7eb; padding:4px; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer;">Details</button>` : ''}
                        </div>
                    </div>`;
            }

            window.L.marker([item.lat, item.lng], { icon })
                .addTo(mapInstance.current)
                .bindPopup(popupContent);
        });

        mapPins.forEach((pin) => {
            const pinIcon = window.L.divIcon({
                className: 'safesphere-search-pin',
                html: `<div style="width:20px;height:20px;border-radius:50%;background:#7c3aed;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
            });
            window.L.marker([pin.lat, pin.lng], { icon: pinIcon, zIndexOffset: 800 })
                .addTo(mapInstance.current)
                .bindPopup(
                    `<div style="font-family:Inter,sans-serif;min-width:140px"><b style="font-size:13px">${esc(pin.label)}</b>${
                        pin.subtitle
                            ? `<br/><span style="font-size:11px;color:#6b7280">${esc(pin.subtitle)}</span>`
                            : ''
                    }</div>`
                );
        });

        // Force a resize calculation after render to ensure map tiles load correctly
        setTimeout(() => {
            mapInstance.current.invalidateSize();
        }, 100);

        return () => {
            if (typeof onLocationUpdate === 'function') {
                mapInstance.current?.off('click', handleMapClick);
            }
        };
    }, [reports, centerLat, centerLng, onLocationUpdate, mapPins]);

    // Live GPS: show present user location when showUserLocation is true
    useEffect(() => {
        if (!showUserLocation || !('geolocation' in navigator)) {
            if (userMarkerRef.current && mapInstance.current) {
                mapInstance.current.removeLayer(userMarkerRef.current);
                userMarkerRef.current = null;
            }
            setUserLoc(null);
            return;
        }
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserLoc(coords);
                onLocationUpdate?.(coords.lat, coords.lng);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [showUserLocation, onLocationUpdate]);

    // Add/update "You are here" marker and center map when we have user location
    useEffect(() => {
        if (!mapInstance.current || !window.L || !userLoc) return;
        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([userLoc.lat, userLoc.lng]);
        } else {
            const icon = window.L.divIcon({
                className: 'user-loc-icon',
                html: `<div style="position:relative;width:20px;height:20px"><div style="position:absolute;inset:0;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div><div style="position:absolute;inset:-6px;background:#2563eb;border-radius:50%;opacity:0.3;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            userMarkerRef.current = window.L.marker([userLoc.lat, userLoc.lng], { icon, zIndexOffset: 1000 }).addTo(mapInstance.current).bindTooltip('You are here', { direction: 'top' });
        }
        // Do not force-centre to GPS when the caller supports pinning (report form).
        // If there are no incident reports and the caller did not provide pinning, centre on the user.
        if (reports.length === 0 && !onLocationUpdate) {
            mapInstance.current.setView([userLoc.lat, userLoc.lng], 14);
        }
    }, [userLoc, reports.length, onLocationUpdate]);

    return <div ref={mapContainer} className="w-full h-full rounded-2xl z-0" />;
};

export default IncidentMap;
