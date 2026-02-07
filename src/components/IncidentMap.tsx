
import React, { useEffect, useRef, useState } from 'react';
import { IncidentReport, Resource } from '../types';

declare global {
  interface Window {
    L: any;
  }
}

interface IncidentMapProps {
  reports: (IncidentReport | Resource)[];
  centerLat?: number;
  centerLng?: number;
  showUserLocation?: boolean;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

const IncidentMap: React.FC<IncidentMapProps> = ({ reports, centerLat = 17.866, centerLng = 98.195, showUserLocation = false, onLocationUpdate }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const userMarkerRef = useRef<any>(null);
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!mapContainer.current || !window.L) return;

        // Initialize map if not already done
        if (!mapInstance.current) {
            mapInstance.current = window.L.map(mapContainer.current).setView([centerLat, centerLng], 12);
            
            window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(mapInstance.current);
        } else {
             mapInstance.current.setView([centerLat, centerLng], 12);
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

        // Force a resize calculation after render to ensure map tiles load correctly
        setTimeout(() => {
            mapInstance.current.invalidateSize();
        }, 100);

    }, [reports, centerLat, centerLng]);

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
        // Center on user when no reports (e.g. waiting for incident location)
        if (reports.length === 0) {
            mapInstance.current.setView([userLoc.lat, userLoc.lng], 14);
        }
    }, [userLoc, reports.length]);

    return <div ref={mapContainer} className="w-full h-full rounded-2xl z-0" />;
};

export default IncidentMap;
