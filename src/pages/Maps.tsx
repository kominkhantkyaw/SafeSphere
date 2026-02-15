import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../components/Icon';
import { EarthquakeEvent, SafetyAsset, IncidentReport, Resource, User } from '../types';
import { fetchEarthquakes, fetchSafetyAssets, fetchReports, fetchResources, fetchAllUsers, saveUser } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

declare global {
  interface Window {
    L: any;
    handleMapAction: (type: string, id: number) => void;
    updateCallSign: (userId: number, value: string) => void;
  }
}

// Tactical simulation types
interface SimGroundUnit {
  id: string;
  name: string;
  role: 'MEDIC' | 'RESCUE' | 'SHUTTLE' | 'SECURITY';
  lat: number;
  lng: number;
  status: 'Available' | 'En Route' | 'Busy';
  callSign: string;
}
interface SimAirNode {
  id: string;
  callSign: string;
  type: 'HELO' | 'UAV' | 'UNKNOWN';
  affiliation: 'FRIENDLY' | 'THREAT' | 'NEUTRAL';
  altitude: number;
  speed: number;
  heading: number;
  lat: number;
  lng: number;
}
interface SimObjective {
  id: string;
  type: 'RENDEZVOUS' | 'EXTRACTION' | 'POI';
  title: string;
  lat: number;
  lng: number;
  details: string;
  color: string;
}
interface SimShelter {
  id: string;
  name: string;
  type: 'SHELTER' | 'HOSPITAL';
  lat: number;
  lng: number;
}

// Myanmar centre – country faces significant natural disasters (earthquakes, floods, cyclones)
const MYANMAR_CENTER: [number, number] = [21.0, 96.0];
// Yangon ops area – ground units, air nodes, shelters (kept for local zooming if needed)
const YANGON_OPS: [number, number] = [16.855, 96.195];

const Maps: React.FC = () => {
    const { t } = useLanguage();
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    
    // User Location
    const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
    const userMarkerRef = useRef<any>(null);

    // Data State
    const [earthquakes, setEarthquakes] = useState<EarthquakeEvent[]>([]);
    const [safetyAssets, setSafetyAssets] = useState<SafetyAsset[]>([]);
    const [reports, setReports] = useState<IncidentReport[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [responders, setResponders] = useState<User[]>([]);
    
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // Filter State
    const [buildingFilter, setBuildingFilter] = useState<string>('All');
    const [nearbyFilter, setNearbyFilter] = useState(false);

    // Earthquake List State
    const [showQuakeList, setShowQuakeList] = useState(false);
    const [quakeSearch, setQuakeSearch] = useState('');
    const [quakeSort, setQuakeSort] = useState<'mag' | 'time'>('mag');

    // Base Map State – default to light for clearer incidents on Myanmar view
    const [baseMap, setBaseMap] = useState<'light' | 'dark' | 'satellite'>('light');
    const tileLayerRef = useRef<any>(null);

    // Layer State
    const [activeLayers, setActiveLayers] = useState({
        incidents: true, 
        resources: true, 
        safety: true,    
        weather: false,  
        traffic: false,  
        earthquakes: true, // Always on – kept outside layer toggles for easy visibility
        seismicZones: true, // Important for reality – Seismic Hazard Zones
        responders: true,
        heatmap: true, // Important for reality – Heatmap Density
        simGroundUnits: true,
        simAirNodes: true,
        simObjectives: true,
        simShelters: true
    });
    
    const [showLayerControl, setShowLayerControl] = useState(false);
    const [showSearchPanel, setShowSearchPanel] = useState(false);
    
    // Tactical simulation state – positions spaced across Myanmar for national-scale view
    const [groundUnits, setGroundUnits] = useState<SimGroundUnit[]>([
        // Yangon – primary disaster impact zone
        { id: 'MT-01', name: 'Medi Team Yangon', role: 'MEDIC', lat: 16.878, lng: 96.168, status: 'Available', callSign: 'ANGEL-1' },
        { id: 'AMB-02', name: 'EMS Ambulance Bravo', role: 'SHUTTLE', lat: 16.848, lng: 96.212, status: 'En Route', callSign: 'AMB-2' },
        // Nay Pyi Taw – central government / coordination hub
        { id: 'RT-03', name: 'Rescue Team Nay Pyi Taw', role: 'RESCUE', lat: 19.763, lng: 96.078, status: 'En Route', callSign: 'SHIELD-4' },
        // Mandalay – northern relief & medical support
        { id: 'SEC-04', name: 'Rapid Security Mandalay', role: 'SECURITY', lat: 21.9588, lng: 96.0891, status: 'Available', callSign: 'GUARDIAN-9' },
    ]);
    const [airNodes] = useState<SimAirNode[]>([
        // Mandalay air support
        { id: 'AN-1', callSign: 'RAPTOR-01', type: 'HELO', affiliation: 'FRIENDLY', altitude: 4500, speed: 120, heading: 45, lat: 21.94, lng: 96.06 },
        // Nay Pyi Taw medevac corridor
        { id: 'AN-2', callSign: 'MEDEVAC-01', type: 'HELO', affiliation: 'FRIENDLY', altitude: 2200, speed: 90, heading: 120, lat: 19.763, lng: 96.078 },
        // Commercial / military flight staging from Yangon International
        { id: 'AN-3', callSign: 'FLIGHT-RGN', type: 'UNKNOWN', affiliation: 'FRIENDLY', altitude: 32000, speed: 750, heading: 180, lat: 16.907, lng: 96.133 },
        // Surveillance / security drone over central Myanmar
        { id: 'AN-4', callSign: 'DRONE-SEC', type: 'UAV', affiliation: 'NEUTRAL', altitude: 800, speed: 45, heading: 270, lat: 20.2, lng: 95.6 },
    ]);
    const [objectives] = useState<SimObjective[]>([
        { id: 'OBJ-1', type: 'RENDEZVOUS', title: 'RP Blue', lat: 16.858, lng: 96.195, details: 'Field team staging.', color: '#3b82f6' },
        { id: 'OBJ-2', type: 'EXTRACTION', title: 'LZ Landing', lat: 16.840, lng: 96.220, details: 'Air-lift evacuation node.', color: '#f59e0b' },
    ]);
    const [shelters] = useState<SimShelter[]>([
        { id: 'S-01', name: 'Yangon Relief Shelter', type: 'SHELTER', lat: 16.855, lng: 96.168 },
        { id: 'H-02', name: 'Field Medical', type: 'HOSPITAL', lat: 16.838, lng: 96.202 },
    ]);
    const [altitudeFilter, setAltitudeFilter] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSimEntity, setSelectedSimEntity] = useState<any>(null);
    const [simPopupPos, setSimPopupPos] = useState<{ x: number; y: number } | null>(null);
    const simMarkersRef = useRef<any[]>([]);
    
    // Detail Modal State
    const [selectedItem, setSelectedItem] = useState<IncidentReport | Resource | null>(null);

    // Ref to track responder markers separately to avoid full re-render flickering
    const responderMarkersMap = useRef<Map<number, any>>(new Map());

    // Initial Data Fetch
    useEffect(() => {
        const initData = async () => {
            const [eqData, safData, repData, resData, userData] = await Promise.all([
                fetchEarthquakes(),
                fetchSafetyAssets(),
                fetchReports(),
                fetchResources(),
                fetchAllUsers()
            ]);
            setEarthquakes(eqData);
            setSafetyAssets(safData);
            setReports(repData);
            setResources(resData);
            setResponders(userData.filter(u => u.role === 'Responder' && (u as any).lat && (u as any).lng));
        };
        initData();

        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => setIsOffline(false);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        // Global handler for popup buttons
        window.handleMapAction = (type, id) => {
            if (type === 'report') {
                const item = reports.find(r => r.id === id);
                if (item) setSelectedItem(item);
            } else if (type === 'resource') {
                const item = resources.find(r => r.id === id);
                if (item) setSelectedItem(item);
            }
        };

        // Handler for call sign update
        window.updateCallSign = (userId: number, value: string) => {
             // Optimistic Update
             setResponders(prev => prev.map(u => u.id === userId ? { ...u, callSign: value } : u));
             saveUser({ id: userId, callSign: value });
        };

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            // @ts-ignore
            delete window.handleMapAction;
            // @ts-ignore
            delete window.updateCallSign;
        };
    }, [reports, resources]); 

    // Map Initialization
    useEffect(() => {
        if (!mapContainer.current || !window.L) return;

        if (!mapInstance.current) {
            mapInstance.current = window.L.map(mapContainer.current, {
                zoomControl: false,
                attributionControl: false
            }).setView(MYANMAR_CENTER, 6);

            window.L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
        }

        // Handle Base Map Switching
        if (tileLayerRef.current) {
            mapInstance.current.removeLayer(tileLayerRef.current);
        }

        let tileUrl = '';
        if (baseMap === 'light') {
            tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        } else if (baseMap === 'dark') {
            tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        } else {
            tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        }

        tileLayerRef.current = window.L.tileLayer(tileUrl, {
            maxZoom: 20,
            subdomains: 'abcd'
        }).addTo(mapInstance.current);

        // Focus on location when navigated from Home (chart point click)
        try {
            const stored = sessionStorage.getItem('safesphere_map_focus');
            if (stored) {
                sessionStorage.removeItem('safesphere_map_focus');
                const { lat, lng } = JSON.parse(stored);
                if (typeof lat === 'number' && typeof lng === 'number') {
                    mapInstance.current.flyTo([lat, lng], 10, { animate: true });
                }
            }
        } catch (_) {}

    }, [baseMap]);

    // Start GPS tracking immediately (independent of map)
    useEffect(() => {
        if (!('geolocation' in navigator)) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn('Geolocation error:', err.code, err.message),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Add user marker to map when both map and location are available
    useEffect(() => {
        if (!mapInstance.current || !userLoc || !window.L) return;
        if (!userMarkerRef.current) {
            const userIcon = window.L.divIcon({
                className: 'user-loc-icon',
                html: `<div class="relative w-4 h-4">
                        <div class="absolute inset-0 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
                        <div class="absolute -inset-2 bg-blue-500 rounded-full opacity-30 animate-ping"></div>
                       </div>`,
                iconSize: [16, 16]
            });
            userMarkerRef.current = window.L.marker([userLoc.lat, userLoc.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(mapInstance.current);
        } else {
            userMarkerRef.current.setLatLng([userLoc.lat, userLoc.lng]);
        }
    }, [userLoc]);

    // Ground unit movement simulation
    useEffect(() => {
        const timer = setInterval(() => {
            setGroundUnits(prev => prev.map(u => ({
                ...u,
                lat: u.lat + (Math.random() - 0.5) * 0.003,
                lng: u.lng + (Math.random() - 0.5) * 0.003
            })));
        }, 4500);
        return () => clearInterval(timer);
    }, []);

    // Helper: Calculate Distance
    const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; 
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Search: match query against text fields (case-insensitive)
    const matchesSearch = (text: string | undefined): boolean => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (text || '').toLowerCase().includes(q);
    };

    // Filter reports by search (type, description)
    const filteredReportsForMap = (nearbyFilter && userLoc 
        ? reports.filter(r => getDistanceKm(userLoc!.lat, userLoc!.lng, r.lat, r.lng) <= 5)
        : reports
    ).filter(r => matchesSearch(r.type) || matchesSearch(r.description));

    // Filter resources by search (name, address, description, type)
    const filteredResourcesForMap = (nearbyFilter && userLoc
        ? resources.filter(r => getDistanceKm(userLoc!.lat, userLoc!.lng, r.lat, r.lng) <= 5)
        : resources
    ).filter(r => matchesSearch(r.name) || matchesSearch(r.address) || matchesSearch(r.description) || matchesSearch(r.type));

    // Filter simulation nodes by search
    const filteredGroundUnits = groundUnits.filter(u => 
        matchesSearch(u.name) || matchesSearch(u.callSign) || matchesSearch(u.role)
    );
    const filteredAirNodes = airNodes.filter(n => 
        matchesSearch(n.callSign) || matchesSearch(n.type) || matchesSearch(String(n.affiliation))
    );
    const filteredObjectives = objectives.filter(o => 
        matchesSearch(o.title) || matchesSearch(o.type) || matchesSearch(o.details)
    );
    const filteredShelters = shelters.filter(s => 
        matchesSearch(s.name) || matchesSearch(s.type)
    );

    // Search results for fly-to: collect all matches with lat/lng
    const searchResults = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        const results: { label: string; lat: number; lng: number }[] = [];
        reports.forEach(r => {
            if (matchesSearch(r.type) || matchesSearch(r.description)) {
                results.push({ label: `${r.type}: ${r.description?.slice(0, 40)}...`, lat: r.lat, lng: r.lng });
            }
        });
        resources.forEach(r => {
            if (matchesSearch(r.name) || matchesSearch(r.address) || matchesSearch(r.description)) {
                results.push({ label: r.name, lat: r.lat, lng: r.lng });
            }
        });
        groundUnits.forEach(u => {
            if (matchesSearch(u.name) || matchesSearch(u.callSign)) {
                results.push({ label: `${u.name} (${u.callSign})`, lat: u.lat, lng: u.lng });
            }
        });
        airNodes.forEach(n => {
            if (matchesSearch(n.callSign) || matchesSearch(n.type)) {
                results.push({ label: n.callSign, lat: n.lat, lng: n.lng });
            }
        });
        objectives.forEach(o => {
            if (matchesSearch(o.title) || matchesSearch(o.type)) {
                results.push({ label: o.title, lat: o.lat, lng: o.lng });
            }
        });
        shelters.forEach(s => {
            if (matchesSearch(s.name) || matchesSearch(s.type)) {
                results.push({ label: s.name, lat: s.lat, lng: s.lng });
            }
        });
        earthquakes.forEach(eq => {
            const place = eq.properties?.place || '';
            if (place.toLowerCase().includes(q)) {
                const lat = eq.geometry?.coordinates?.[1];
                const lng = eq.geometry?.coordinates?.[0];
                if (lat != null && lng != null) {
                    results.push({ label: `${place} (${eq.properties?.mag} Mag)`, lat, lng });
                }
            }
        });
        return results;
    }, [searchQuery, reports, resources, groundUnits, airNodes, objectives, shelters, earthquakes]);

    const handleSearchFlyTo = (lat: number, lng: number) => {
        mapInstance.current?.flyTo([lat, lng], 14, { animate: true });
    };

    // Render Overlays
    useEffect(() => {
        if (!mapInstance.current) return;

        // Clear general markers
        markersRef.current.forEach(layer => mapInstance.current.removeLayer(layer));
        markersRef.current = [];

        // --- 0. INCIDENTS ---
        if (activeLayers.incidents) {
            const currentZoom = mapInstance.current.getZoom ? mapInstance.current.getZoom() : 12;
            const wideAreaView = currentZoom <= 7; // national / regional view – make incidents larger for clarity

            filteredReportsForMap.forEach(r => {
                const typeUpper = (r.type || '').toUpperCase();
                let color = '#6b7280';
                if (typeUpper.includes('FIRE') && !typeUpper.includes('FLOOD')) color = '#ef4444';
                else if (typeUpper.includes('FLOOD')) color = '#3b82f6';
                else if (typeUpper.includes('MEDICAL')) color = '#ef4444';

                const isFireCritical = typeUpper.includes('FIRE') && !typeUpper.includes('FLOOD') && r.urgency === 'Critical';
                let iconHtml: string;
                let iconSize: [number, number];
                let iconAnchor: [number, number];

                if (isFireCritical) {
                    // Fire alert: rings expand tiny→bigger simultaneously (like earthquake/incident alert)
                    iconHtml = `
                        <div style='position: relative; width: 56px; height: 56px;'>
                            <div style='position: absolute; top: 50%; left: 50%; width: 12px; height: 12px; margin-left: -6px; margin-top: -6px; border-radius: 50%; border: 2px solid #ef4444; animation: fireAlertSimultaneous 1.2s ease-out infinite;'></div>
                            <div style='position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; margin-left: -10px; margin-top: -10px; border-radius: 50%; border: 2px solid #ef4444; animation: fireAlertSimultaneous 1.2s ease-out infinite;'></div>
                            <div style='position: absolute; top: 50%; left: 50%; width: 28px; height: 28px; margin-left: -14px; margin-top: -14px; border-radius: 50%; border: 2px solid #ef4444; animation: fireAlertSimultaneous 1.2s ease-out infinite;'></div>
                            <div style='position: absolute; top: 50%; left: 50%; margin-left: -8px; margin-top: -8px; background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; animation: firePulse 1.2s ease-in-out infinite, fireGlow 1.2s ease-in-out infinite;'></div>
                        </div>
                    `;
                    iconSize = [56, 56];
                    iconAnchor = [28, 28];
                } else {
                    const baseDot = wideAreaView ? 20 : 16;
                    const badgeFont = wideAreaView ? 9 : 8;
                    const wrapperHeight = wideAreaView ? 40 : 32;

                    iconHtml = `
                        <div class="flex flex-col items-center">
                            <div style="position: relative;">
                                <div style='background-color: ${color}; width: ${baseDot}px; height: ${baseDot}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.35);'></div>
                                ${r.urgency === 'Critical' ? `<div style="position:absolute; inset:-4px; border: 2px solid ${color}; border-radius:50%; opacity:0.6; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
                                <div style="position:absolute; top:-7px; right:-7px; background:white; color:${color}; border:1px solid ${color}; font-size:${badgeFont}px; font-weight:800; border-radius:999px; padding:0 4px; box-shadow:0 1px 3px rgba(0,0,0,0.25); text-transform:uppercase;">
                                    ${r.type === 'FIRE' ? 'FIRE' : r.type === 'FLOOD' ? 'FLOOD' : r.type[0]}
                                </div>
                            </div>
                            <div style="background: rgba(255,255,255,0.95); padding: 1px 6px; border-radius: 999px; font-size: 9px; font-weight: 700; margin-top: 3px; border: 1px solid #e5e7eb; white-space: nowrap; color: ${color}; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
                                ${r.urgency === 'Critical' ? 'CRITICAL' : r.urgency || 'ACTIVE'}
                            </div>
                        </div>
                        <style>@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }</style>
                    `;
                    iconSize = wideAreaView ? [32, wrapperHeight] : [26, wrapperHeight];
                    iconAnchor = wideAreaView ? [16, 14] : [13, 12];
                }

                const icon = window.L.divIcon({
                    className: 'custom-div-icon',
                    html: iconHtml,
                    iconSize,
                    iconAnchor
                });

                // Rich Popup Content
                const popupContent = `
                    <div style="min-width: 160px; max-width: 90vw; font-family: 'Inter', sans-serif;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; margin-bottom: 8px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <div style="width:10px; height:10px; border-radius:50%; background-color:${color};"></div>
                                <span style="font-weight: 800; font-size: 13px; text-transform: uppercase; color:#111;">${r.type}</span>
                            </div>
                            <span style="font-size: 9px; font-weight: 700; background: ${r.urgency === 'Critical' ? '#fee2e2' : '#f3f4f6'}; color: ${r.urgency === 'Critical' ? '#991b1b' : '#374151'}; padding: 2px 6px; border-radius: 99px; text-transform:uppercase;">${r.urgency}</span>
                        </div>
                        
                        <div style="font-size: 10px; font-weight:600; color: #9ca3af; margin-bottom: 4px; text-transform:uppercase;">Status: ${r.status}</div>
                        <div style="font-size: 12px; color: #374151; margin-bottom: 12px; line-height: 1.4; max-height: 60px; overflow:hidden; text-overflow:ellipsis;">${r.description}</div>
                        
                        ${r.contactPhone ? `<div style="font-size:11px; margin-bottom:8px; display:flex; gap:4px; color:#4b5563;"><span style="font-weight:700;">Tel:</span> <a href="tel:${r.contactPhone}" style="color:#2563eb; text-decoration:none;">${r.contactPhone}</a></div>` : ''}

                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                             <button onclick="window.handleMapAction('report', ${r.id})" style="flex: 1; background-color: #000; color: #fff; border: none; font-size: 11px; padding: 8px 0; border-radius: 6px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">Full Details</button>
                             <a href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}" target="_blank" style="flex: 1; text-align: center; background-color: #f3f4f6; color: #1f2937; border: 1px solid #e5e7eb; font-size: 11px; padding: 8px 0; border-radius: 6px; text-decoration: none; font-weight: 600;">Directions</a>
                        </div>
                    </div>
                `;

                const marker = window.L.marker([r.lat, r.lng], { icon })
                    .bindTooltip(`${r.type} (${r.urgency})`, { direction: 'top', offset: [0, -12], opacity: 0.9, className: 'font-bold text-xs' })
                    .bindPopup(popupContent);
                marker.addTo(mapInstance.current);
                markersRef.current.push(marker);
            });
        }

        // --- 0.5 RESOURCES ---
        if (activeLayers.resources) {
            filteredResourcesForMap.forEach(r => {
                let color = '#10b981'; // Default Green
                if (r.type === 'police') color = '#1f2937';
                if (r.type === 'medical') color = '#ef4444';
                if (r.type === 'fire') color = '#f97316';

                // Label truncated
                const label = r.name.length > 15 ? r.name.substring(0, 12) + '...' : r.name;

                const iconHtml = `
                    <div style="position: relative; width:20px; height:20px;">
                        <div style='background-color: ${color}; width: 14px; height: 14px; transform: rotate(45deg); border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); margin: 3px auto;'></div>
                        <div style="position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: white; color: #374151; font-size: 9px; padding: 1px 4px; border-radius: 4px; white-space: nowrap; font-weight: 700; border: 1px solid #e5e7eb; box-shadow: 0 2px 2px rgba(0,0,0,0.1); z-index:10;">
                            ${label}
                        </div>
                    </div>
                `;

                const icon = window.L.divIcon({
                    className: 'custom-div-icon',
                    html: iconHtml,
                    iconSize: [20, 30],
                    iconAnchor: [10, 10]
                });

                // Capacity Logic
                const capPct = (r.occupancy && r.capacity) ? (r.occupancy/r.capacity)*100 : 0;
                const capColor = capPct > 90 ? '#ef4444' : '#10b981';
                const capBar = r.capacity ? `
                    <div style="margin-bottom:10px; background:#f9fafb; padding:6px; border-radius:6px; border:1px solid #f3f4f6;">
                        <div style="display:flex; justify-content:space-between; font-size:9px; color:#6b7280; margin-bottom:4px;">
                            <span style="font-weight:600; text-transform:uppercase;">Occupancy</span>
                            <span style="font-weight:700; color:${capColor}">${r.occupancy}/${r.capacity}</span>
                        </div>
                        <div style="width:100%; height:4px; background:#e5e7eb; border-radius:2px; overflow:hidden;">
                            <div style="width:${capPct}%; height:100%; background:${capColor}; border-radius:2px;"></div>
                        </div>
                    </div>
                ` : '';

                const popupContent = `
                    <div style="min-width: 160px; max-width: 90vw; font-family: 'Inter', sans-serif;">
                        <div style="border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; margin-bottom: 8px;">
                             <div style="font-weight: 800; font-size: 14px; margin-bottom: 2px; color:#111;">${r.name}</div>
                             <div style="font-size: 10px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">${r.type} Resource</div>
                        </div>
                        
                        <div style="font-size: 11px; color: #4b5563; margin-bottom: 8px; display:flex; gap:4px; align-items:center;">
                            <span style="opacity:0.6;">📍</span> ${r.address}
                        </div>
                        ${r.phone ? `<div style="font-size: 11px; color: #4b5563; margin-bottom: 8px; display:flex; gap:4px; align-items:center;"><span style="opacity:0.6;">📞</span> ${r.phone}</div>` : ''}
                        
                        ${capBar}

                        <div style="font-size: 11px; color: #6b7280; margin-bottom: 12px; line-height:1.4;">${r.description || 'No description available.'}</div>

                        <div style="display: flex; gap: 8px;">
                             <button onclick="window.handleMapAction('resource', ${r.id})" style="flex: 1; background-color: #000; color: #fff; border: none; font-size: 11px; padding: 8px 0; border-radius: 6px; font-weight: 600; cursor: pointer;">Full Profile</button>
                             <a href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}" target="_blank" style="flex: 1; text-align: center; background-color: #f3f4f6; color: #1f2937; border: 1px solid #e5e7eb; font-size: 11px; padding: 8px 0; border-radius: 6px; text-decoration: none; font-weight: 600;">Nav</a>
                        </div>
                    </div>
                `;

                const marker = window.L.marker([r.lat, r.lng], { icon })
                    .bindPopup(popupContent);
                marker.addTo(mapInstance.current);
                markersRef.current.push(marker);
            });
        }

        // --- 1. EARTHQUAKES ---
        if (activeLayers.earthquakes) {
            earthquakes.forEach(eq => {
                const lat = eq.geometry.coordinates[1];
                const lng = eq.geometry.coordinates[0];
                const mag = eq.properties.mag;
                const color = mag > 5 ? '#ef4444' : mag > 3 ? '#f97316' : '#eab308';
                
                const circle = window.L.circleMarker([lat, lng], {
                    radius: Math.max(mag * 3, 6),
                    fillColor: color,
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.7
                }).bindTooltip(`${mag.toFixed(1)} Mag - ${eq.properties.place}`, { direction: 'top' })
                .bindPopup(`
                    <div style="min-width: 120px; max-width: 90vw; font-family:'Inter',sans-serif;">
                        <div style="border-bottom:1px solid #eee; padding-bottom:4px; margin-bottom:4px;">
                            <b style="font-size:16px; color:${color};">${mag.toFixed(1)}</b> <span style="font-size:10px; text-transform:uppercase; color:#888;">Magnitude</span>
                        </div>
                        <div style="font-size:12px; font-weight:600; margin-bottom:2px;">${eq.properties.place}</div>
                        <div style="font-size:10px; color:#666;">${new Date(eq.properties.time).toLocaleString()}</div>
                    </div>
                `);
                
                circle.addTo(mapInstance.current);
                markersRef.current.push(circle);
            });
        }

        // --- 2. SAFETY ASSETS ---
        if (activeLayers.safety) {
            const filteredAssets = buildingFilter === 'All' 
                ? safetyAssets 
                : safetyAssets.filter(a => a.building === buildingFilter);

            filteredAssets.forEach(asset => {
                if ((asset.type === 'route' || asset.type === 'road') && asset.routePoints) {
                    const color = asset.type === 'road' ? '#9ca3af' : '#22c55e'; // Gray vs Green
                    const dashArray = asset.type === 'road' ? undefined : '10, 10';
                    const weight = asset.type === 'road' ? 6 : 4;
                    
                    const line = window.L.polyline(asset.routePoints, {
                        color: color,
                        weight: weight,
                        dashArray: dashArray,
                        opacity: 0.8
                    }).bindTooltip(asset.label, { sticky: true })
                    .bindPopup(`<b>${asset.label}</b><br>${asset.type === 'road' ? 'Transport Road' : 'Evacuation Route'}`)
                    .addTo(mapInstance.current);
                    markersRef.current.push(line);
                } else {
                    let iconHtml = '';
                    let bgClass = '';
                    switch(asset.type) {
                        case 'extinguisher': iconHtml = '🧯'; bgClass = 'bg-red-100 border-red-500 text-red-600'; break;
                        case 'hydrant': iconHtml = '💧'; bgClass = 'bg-blue-100 border-blue-500 text-blue-600'; break;
                        case 'exit': iconHtml = '🚪'; bgClass = 'bg-green-100 border-green-500 text-green-600'; break;
                        case 'meeting_point': iconHtml = '👥'; bgClass = 'bg-yellow-100 border-yellow-500 text-yellow-600'; break;
                    }

                    const icon = window.L.divIcon({
                        className: 'safety-icon',
                        html: `<div class="w-6 h-6 ${bgClass} border rounded-full flex items-center justify-center text-sm shadow-md">${iconHtml}</div>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });

                    const marker = window.L.marker([asset.lat, asset.lng], { icon })
                        .bindTooltip(asset.label, { direction: 'bottom', offset: [0, 10] })
                        .bindPopup(`<b>${asset.label}</b><br><span style="font-size:10px;">${asset.description || ''}</span>`)
                        .addTo(mapInstance.current);
                    markersRef.current.push(marker);
                }
            });
        }

        // --- 3. WEATHER OVERLAY (Live WMS) ---
        if (activeLayers.weather) {
            const weatherLayer = window.L.tileLayer.wms('https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi', {
                layers: 'nexrad-n0r-900913',
                format: 'image/png',
                transparent: true,
                attribution: 'Weather data © IEM Nexrad',
                opacity: 0.6
            }).addTo(mapInstance.current);
            markersRef.current.push(weatherLayer);
        }

        // --- 4. TRAFFIC OVERLAY (Simulation) - Myanmar (Yangon area) ---
        if (activeLayers.traffic) {
            const heavyTraffic = window.L.polyline([
                [[16.8661, 96.1951], [16.8761, 96.2051], [16.8861, 96.2151]],
                [[16.8500, 96.2000], [16.8550, 96.2100]]
            ], { color: '#ef4444', weight: 5, opacity: 0.7 }).bindPopup("High Traffic Congestion").addTo(mapInstance.current);
            
            const moderateTraffic = window.L.polyline([
                [[16.8622, 96.1837], [16.8522, 96.1737]]
            ], { color: '#eab308', weight: 5, opacity: 0.7 }).bindPopup("Moderate Traffic").addTo(mapInstance.current);

            markersRef.current.push(heavyTraffic);
            markersRef.current.push(moderateTraffic);
        }

        // --- 5. SEISMIC HAZARD ZONES (Myanmar) ---
        if (activeLayers.seismicZones) {
             const hazardZones = [
                [[21.0600, 96.2600], [21.0700, 96.2800], [21.0500, 96.2900], [21.0400, 96.2700]], 
                [[20.0300, 96.2200], [20.0200, 96.2400], [20.0100, 96.2100]] 
             ];
             
             hazardZones.forEach((zone: any) => {
                 const poly = window.L.polygon(zone, {
                     color: '#c2410c', // Dark orange/red
                     weight: 2,
                     fillColor: '#fb923c',
                     fillOpacity: 0.3,
                     dashArray: '5, 5'
                 }).bindPopup(`
                    <div style="font-family: 'Inter', sans-serif;">
                        <div style="font-weight: 700; color: #c2410c; margin-bottom: 2px;">Seismic Hazard Zone</div>
                        <div style="font-size: 11px; color: #4b5563;">High Liquefaction Risk Area</div>
                    </div>
                 `);
                 poly.addTo(mapInstance.current);
                 markersRef.current.push(poly);
             });
        }
        
        // --- 6. HEATMAP (Simulated with Circles) ---
        if (activeLayers.heatmap) {
             filteredReportsForMap.forEach(r => {
                 const heatCircle = window.L.circleMarker([r.lat, r.lng], {
                     radius: 40,
                     fillColor: r.type === 'FIRE' ? '#ef4444' : r.type === 'FLOOD' ? '#3b82f6' : '#fbbf24',
                     color: 'transparent',
                     weight: 0,
                     opacity: 0,
                     fillOpacity: 0.3,
                     className: 'heat-blur'
                 }).bindPopup(`High Incident Density Area`);
                 heatCircle.addTo(mapInstance.current);
                 markersRef.current.push(heatCircle);
             });
        }

    }, [activeLayers, buildingFilter, earthquakes, safetyAssets, filteredReportsForMap, filteredResourcesForMap, nearbyFilter, userLoc]);

    // --- TACTICAL SIMULATION LAYERS ---
    useEffect(() => {
        if (!mapInstance.current || !window.L) return;

        simMarkersRef.current.forEach(m => mapInstance.current.removeLayer(m));
        simMarkersRef.current = [];

        const onSimEntityClick = (entity: any, lat: number, lng: number) => {
            mapInstance.current?.flyTo([lat, lng], 14, { animate: true });
            const p = mapInstance.current?.latLngToContainerPoint([lat, lng]);
            if (p) {
                setSelectedSimEntity(entity);
                setSimPopupPos({ x: p.x, y: p.y });
            }
        };

        // Ground units (moving simulation)
        if (activeLayers.simGroundUnits) {
            filteredGroundUnits.forEach(u => {
                const color = u.role === 'MEDIC' ? '#f43f5e' : u.role === 'SECURITY' ? '#1e293b' : u.role === 'SHUTTLE' ? '#dc2626' : '#2563eb';
                const emoji = u.role === 'MEDIC' ? '❤' : u.role === 'SECURITY' ? '🛡' : u.role === 'SHUTTLE' ? '🚑' : '🚒';
                const iconHtml = `<div style="position:relative;width:40px;height:40px;transition:transform 4.5s linear">
                    <div style="width:40px;height:40px;background:white;border:2px solid ${color};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px rgba(0,0,0,0.2)">
                        <span style="font-size:18px">${emoji}</span>
                    </div>
                </div>`;
                const m = window.L.marker([u.lat, u.lng], {
                    icon: window.L.divIcon({ html: iconHtml, iconSize: [40, 40], className: 'sim-unit-marker' })
                }).on('click', () => onSimEntityClick({ ...u, category: 'Unit' }, u.lat, u.lng)).addTo(mapInstance.current);
                simMarkersRef.current.push(m);
            });
        }

        // Air nodes
        if (activeLayers.simAirNodes) {
            const visibleAir = filteredAirNodes.filter(n => n.altitude >= altitudeFilter);
            const zoom = mapInstance.current.getZoom?.() ?? 13;
            // Only cluster when very far out; at the default Myanmar view
            // we want to see individual flights and helicopters near Yangon.
            if (zoom < 6 && visibleAir.length > 0) {
                const avgLat = visibleAir.reduce((s, n) => s + n.lat, 0) / visibleAir.length;
                const avgLng = visibleAir.reduce((s, n) => s + n.lng, 0) / visibleAir.length;
                // Smaller, cleaner cluster bubble so it does not dominate the Myanmar map
                const iconHtml = `<div style="width:40px;height:40px;background:#2563eb;color:white;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;border:3px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35)"><span style="font-size:9px">✈</span><span style="font-size:9px">${visibleAir.length}</span></div>`;
                const m = window.L.marker([avgLat, avgLng], { icon: window.L.divIcon({ html: iconHtml, iconSize: [40, 40] }) })
                    .on('click', () => mapInstance.current?.setZoom(10)).addTo(mapInstance.current);
                simMarkersRef.current.push(m);
            } else {
                visibleAir.forEach(n => {
                    const color = n.affiliation === 'THREAT' ? '#e11d48' : n.affiliation === 'FRIENDLY' ? '#2563eb' : '#64748b';
                    const airIcon = n.type === 'HELO' ? '🚁' : '✈';
                    // Slightly smaller node icons so aircraft / helicopter markers feel proportionate to the Myanmar map
                    const iconHtml = `<div style="width:32px;height:32px;background:#1e293b;border:2px solid ${color};border-radius:50%;display:flex;align-items:center;justify-content:center;color:${color};box-shadow:0 3px 6px rgba(0,0,0,0.3);transform:rotate(${n.heading}deg)"><span style="font-size:16px">${airIcon}</span></div>`;
                    const m = window.L.marker([n.lat, n.lng], {
                        icon: window.L.divIcon({ html: iconHtml, iconSize: [32, 32], className: 'sim-air-marker' })
                    }).on('click', () => onSimEntityClick({ ...n, category: 'AirNode' }, n.lat, n.lng)).addTo(mapInstance.current);
                    simMarkersRef.current.push(m);
                });
            }
        }

        // Objectives
        if (activeLayers.simObjectives) {
            filteredObjectives.forEach(o => {
                const iconHtml = `<div style="width:40px;height:40px;background:white;border:2px solid ${o.color};border-radius:12px;display:flex;align-items:center;justify-content:center;color:${o.color};box-shadow:0 2px 8px rgba(0,0,0,0.15)"><span style="font-size:18px">${o.type === 'RENDEZVOUS' ? '📍' : o.type === 'EXTRACTION' ? '🚁' : '🏁'}</span></div>`;
                const m = window.L.marker([o.lat, o.lng], {
                    icon: window.L.divIcon({ html: iconHtml, iconSize: [40, 40] })
                }).bindPopup(`<div style="min-width:140px;max-width:90vw;padding:8px"><span style="font-size:9px;font-weight:700;background:${o.color}20;color:${o.color};padding:2px 6px;border-radius:4px">${o.type}</span><h4 style="margin:8px 0 4px;font-size:14px;font-weight:800">${o.title}</h4><p style="font-size:11px;color:#64748b">${o.details}</p></div>`)
                    .on('click', () => onSimEntityClick({ ...o, category: 'Objective' }, o.lat, o.lng)).addTo(mapInstance.current);
                simMarkersRef.current.push(m);
            });
        }

        // Shelters
        if (activeLayers.simShelters) {
            filteredShelters.forEach(s => {
                const color = s.type === 'HOSPITAL' ? '#f43f5e' : '#3b82f6';
                const iconHtml = `<div style="width:40px;height:40px;background:white;border:2px solid ${color};border-radius:12px;display:flex;align-items:center;justify-content:center;color:${color};box-shadow:0 2px 8px rgba(0,0,0,0.15)"><span style="font-size:18px">${s.type === 'HOSPITAL' ? '🏥' : '🏕️'}</span></div>`;
                const m = window.L.marker([s.lat, s.lng], {
                    icon: window.L.divIcon({ html: iconHtml, iconSize: [40, 40] })
                }).bindPopup(`<div style="min-width:140px;max-width:90vw;padding:8px"><span style="font-size:9px;font-weight:700;color:${color}">${s.type} Node</span><h4 style="margin:8px 0 0;font-size:14px;font-weight:800">${s.name}</h4></div>`)
                    .on('click', () => onSimEntityClick({ ...s, category: 'Shelter' }, s.lat, s.lng)).addTo(mapInstance.current);
                simMarkersRef.current.push(m);
            });
        }

        // Update popup position on map zoom/move when entity selected
        const updatePopupPos = () => {
            if (selectedSimEntity?.lat != null && selectedSimEntity?.lng != null && mapInstance.current) {
                const p = mapInstance.current.latLngToContainerPoint([selectedSimEntity.lat, selectedSimEntity.lng]);
                setSimPopupPos({ x: p.x, y: p.y });
            }
        };
        const map = mapInstance.current;
        if (selectedSimEntity?.lat != null) {
            map.on('zoom move', updatePopupPos);
        }
        return () => { map?.off('zoom move', updatePopupPos); };
    }, [activeLayers.simGroundUnits, activeLayers.simAirNodes, activeLayers.simObjectives, activeLayers.simShelters, filteredGroundUnits, filteredAirNodes, filteredObjectives, filteredShelters, altitudeFilter, selectedSimEntity]);

    // --- RESPONDERS LAYER WITH CALL SIGN EDITING ---
    useEffect(() => {
        if (!mapInstance.current) return;

        if (!activeLayers.responders) {
            responderMarkersMap.current.forEach(marker => mapInstance.current.removeLayer(marker));
            responderMarkersMap.current.clear();
            return;
        }

        responders.forEach(u => {
            const lat = (u as any).lat;
            const lng = (u as any).lng;
            if (!lat || !lng) return;
            
            // Check if marker exists
            if (responderMarkersMap.current.has(u.id)) {
                const existingMarker = responderMarkersMap.current.get(u.id);
                existingMarker.setLatLng([lat, lng]);
            } else {
                // Create new marker
                const heading = (u as any).heading || 0;
                const callSign = (u as any).callSign || u.name;
                const icon = window.L.divIcon({
                    className: 'responder-icon',
                    html: `
                        <div style="position: relative;">
                            <div style="background-color: #2563eb; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transform: rotate(${heading}deg);">
                                <img src="${u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; transform: rotate(-${heading}deg);" alt="" />
                                <div style="position: absolute; top: -5px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid #2563eb;"></div>
                            </div>
                            <div style="position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); background: black; color: white; font-size: 8px; padding: 1px 4px; border-radius: 4px; white-space: nowrap; font-weight: bold; border: 1px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                                ${callSign}
                            </div>
                        </div>
                    `,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                const popupContent = `
                    <div style="min-width: 160px; max-width: 90vw; font-family: 'Inter', sans-serif;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <div style="font-weight: 800; font-size: 14px;">${u.name}</div>
                            <span style="font-size:9px; font-weight:700; background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:10px;">${u.role}</span>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <label style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #374151; display: block; margin-bottom: 2px;">Call Sign</label>
                            <input 
                                type="text" 
                                value="${callSign}" 
                                onblur="window.updateCallSign(${u.id}, this.value)"
                                placeholder="Set Call Sign"
                                style="width: 100%; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; background:#f9fafb;"
                            />
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:10px; color:#6b7280; background:#f9fafb; padding:4px; border-radius:4px; border:1px solid #f3f4f6;">
                            <span>Lat: ${lat.toFixed(4)}</span>
                            <span>Lng: ${lng.toFixed(4)}</span>
                            <span>Hdg: ${heading}°</span>
                        </div>
                    </div>
                `;

                const marker = window.L.marker([lat, lng], { icon })
                    .addTo(mapInstance.current)
                    .bindTooltip(u.name, { direction: 'top', offset: [0, -20] })
                    .bindPopup(popupContent);
                
                responderMarkersMap.current.set(u.id, marker);
            }
        });

        // Cleanup removed responders
        responderMarkersMap.current.forEach((marker, id) => {
            if (!responders.find(u => u.id === id)) {
                mapInstance.current.removeLayer(marker);
                responderMarkersMap.current.delete(id);
            }
        });

    }, [responders, activeLayers.responders]);

    const handleRecenter = () => {
        if (userLoc && mapInstance.current) {
            mapInstance.current.setView([userLoc.lat, userLoc.lng], 16);
        } else {
            window.alert(t('waitingForGpsSignal'));
        }
    };

    const handleQuakeClick = (q: EarthquakeEvent) => {
        if (mapInstance.current) {
            mapInstance.current.setView([q.geometry.coordinates[1], q.geometry.coordinates[0]], 10);
            setShowQuakeList(false);
        }
    };

    const filteredQuakes = earthquakes
        .filter(q => q.properties.place.toLowerCase().includes(quakeSearch.toLowerCase()))
        .sort((a, b) => {
            if (quakeSort === 'mag') return b.properties.mag - a.properties.mag;
            return b.properties.time - a.properties.time;
        });

    const uniqueBuildings = Array.from(new Set(safetyAssets.map(a => a.building || 'Unknown'))).filter(Boolean);

    return (
        <div className="relative h-screen w-full flex flex-col bg-gray-100 maps-page-container">
            
            {/* Top Bar Overlay */}
            <div className="absolute top-4 left-4 right-4 z-[40] flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-gray-200">
                    <h1 className="font-bold text-lg flex items-center gap-2">
                        <Icons.Globe size={20} className="text-blue-600" />
                        Live Command Map
                    </h1>
                </div>

                <div className="pointer-events-auto flex flex-col gap-2">
                    <button 
                        onClick={() => setShowLayerControl(!showLayerControl)}
                        className={`p-3 rounded-full shadow-lg transition-colors ${showLayerControl ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                        title="Layers"
                    >
                        <Icons.Layers size={20} />
                    </button>
                    
                    <button 
                            onClick={() => setShowQuakeList(!showQuakeList)}
                            className={`p-3 rounded-full shadow-lg transition-colors ${showQuakeList ? 'bg-yellow-500 text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                            title="Seismic Events"
                        >
                            <Icons.Activity size={20} />
                        </button>

                    <button 
                         onClick={() => setNearbyFilter(!nearbyFilter)}
                         className={`p-3 rounded-full shadow-lg transition-colors ${nearbyFilter ? 'bg-blue-600 text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                         title="Filter 5km Radius"
                    >
                        <Icons.Filter size={20} />
                    </button>

                    <button 
                        onClick={handleRecenter}
                        className="p-3 bg-white rounded-full shadow-lg text-black hover:bg-gray-50"
                        title="Locate Me"
                    >
                        <Icons.Navigation size={20} />
                    </button>

                    <button 
                        onClick={() => setShowSearchPanel(!showSearchPanel)}
                        className={`p-3 rounded-full shadow-lg transition-colors ${showSearchPanel ? 'bg-blue-600 text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                        title="Search"
                    >
                        <Icons.Search size={20} />
                    </button>
                </div>
            </div>

            {/* Search Panel - same style as Layer Control */}
            {showSearchPanel && (
                <div className="absolute top-20 right-3 left-3 sm:left-auto sm:right-4 z-[40] bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-gray-100 sm:w-72 animate-in slide-in-from-right-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase">{t('searchButton')}</h3>
                        <button onClick={() => setShowSearchPanel(false)} className="p-1 hover:bg-gray-100 rounded-full" aria-label="Close">
                            <Icons.X size={18} />
                        </button>
                    </div>
                    <div className="relative">
                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                            <Icons.Search size={14} className="text-gray-400 ml-3 shrink-0" aria-hidden="true" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Incidents, resources, shelters..."
                                aria-label="Search map"
                                className="flex-1 py-2.5 px-2 text-sm font-medium bg-transparent focus:outline-none placeholder:text-gray-400"
                            />
                            {searchQuery.trim() && (
                                <button type="button" onClick={() => setSearchQuery('')} className="mr-2 p-1 rounded-lg hover:bg-gray-200 text-gray-400" aria-label="Clear">
                                    <Icons.X size={14} />
                                </button>
                            )}
                        </div>
                        {searchQuery.trim() && searchResults.length > 0 && (
                            <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden max-h-48 overflow-y-auto">
                                <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                                </div>
                                {searchResults.map((r, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => { handleSearchFlyTo(r.lat, r.lng); setShowSearchPanel(false); }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2 text-sm font-medium border-t border-gray-50"
                                    >
                                        <Icons.Navigation size={12} className="text-blue-600 shrink-0" />
                                        <span className="truncate">{r.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {searchQuery.trim() && searchResults.length === 0 && (
                            <p className="mt-2 px-3 py-2.5 text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                                No matches for &quot;{searchQuery}&quot;
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Layer Control Panel */}
            {showLayerControl && (
                <div className="absolute top-20 right-3 left-3 sm:left-auto sm:right-4 z-[40] bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-gray-100 sm:w-72 animate-in slide-in-from-right-4 overflow-y-auto max-h-[70vh]">
                    
                    {/* Base Map Switcher */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Base Map Style</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => setBaseMap('dark')} className={`flex flex-col items-center p-2 rounded-xl border ${baseMap === 'dark' ? 'border-black bg-gray-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                                <Icons.Moon size={16} className="mb-1"/> <span className="text-[10px] font-bold">Dark</span>
                            </button>
                            <button onClick={() => setBaseMap('light')} className={`flex flex-col items-center p-2 rounded-xl border ${baseMap === 'light' ? 'border-black bg-gray-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                                <Icons.Sun size={16} className="mb-1"/> <span className="text-[10px] font-bold">Light</span>
                            </button>
                            <button onClick={() => setBaseMap('satellite')} className={`flex flex-col items-center p-2 rounded-xl border ${baseMap === 'satellite' ? 'border-black bg-gray-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                                <Icons.Satellite size={16} className="mb-1"/> <span className="text-[10px] font-bold">Sat</span>
                            </button>
                        </div>
                    </div>

                    {/* Operational Overlays */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Data Layers</h3>
                        <div className="space-y-2">
                             <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.Emergency size={16} className="text-red-500" /> Incidents</div>
                                <input type="checkbox" checked={activeLayers.incidents} onChange={e => setActiveLayers(p => ({...p, incidents: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.User size={16} className="text-blue-600" /> Responders</div>
                                <input type="checkbox" checked={activeLayers.responders} onChange={e => setActiveLayers(p => ({...p, responders: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.Resources size={16} className="text-green-500" /> Resources</div>
                                <input type="checkbox" checked={activeLayers.resources} onChange={e => setActiveLayers(p => ({...p, resources: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.CloudRain size={16} className="text-blue-500" /> Weather Radar</div>
                                <input type="checkbox" checked={activeLayers.weather} onChange={e => setActiveLayers(p => ({...p, weather: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.Car size={16} className="text-red-500" /> Traffic Conditions</div>
                                <input type="checkbox" checked={activeLayers.traffic} onChange={e => setActiveLayers(p => ({...p, traffic: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                             <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.Flame size={16} className="text-orange-500" /> Heatmap Density</div>
                                <input type="checkbox" checked={activeLayers.heatmap} onChange={e => setActiveLayers(p => ({...p, heatmap: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.Activity size={16} className="text-orange-600" /> Seismic Hazard Zones</div>
                                <input type="checkbox" checked={activeLayers.seismicZones} onChange={e => setActiveLayers(p => ({...p, seismicZones: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                        </div>
                    </div>

                    {/* Tactical Simulation */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Tactical Simulation</h3>
                        <div className="space-y-2">
                            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.User size={16} className="text-emerald-600" /> Ground Units</div>
                                <input type="checkbox" checked={activeLayers.simGroundUnits} onChange={e => setActiveLayers(p => ({...p, simGroundUnits: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.Navigation size={16} className="text-blue-600" /> Air Nodes</div>
                                <input type="checkbox" checked={activeLayers.simAirNodes} onChange={e => setActiveLayers(p => ({...p, simAirNodes: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                            {activeLayers.simAirNodes && (
                                <div className="pl-2 mt-1">
                                    <label className="block text-[10px] font-bold text-gray-400 mb-1">Altitude Filter (FT)</label>
                                    <input type="range" min={0} max={35000} step={1000} value={altitudeFilter} onChange={e => setAltitudeFilter(parseInt(e.target.value))} className="w-full accent-blue-600" />
                                    <span className="text-[10px] font-bold text-gray-600">{altitudeFilter} FT</span>
                                </div>
                            )}
                            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.MapPin size={16} className="text-violet-600" /> Objectives</div>
                                <input type="checkbox" checked={activeLayers.simObjectives} onChange={e => setActiveLayers(p => ({...p, simObjectives: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <div className="flex items-center gap-2 text-sm font-medium"><Icons.Resources size={16} className="text-blue-500" /> Shelters</div>
                                <input type="checkbox" checked={activeLayers.simShelters} onChange={e => setActiveLayers(p => ({...p, simShelters: e.target.checked}))} className="rounded text-black focus:ring-0" />
                            </label>
                        </div>
                    </div>

                    {/* Facility Management */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Facility Safety</h3>
                        <label className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer mb-2">
                            <div className="flex items-center gap-2 text-sm font-medium"><Icons.DoorOpen size={16} className="text-green-600" /> Safety Assets</div>
                            <input type="checkbox" checked={activeLayers.safety} onChange={e => setActiveLayers(p => ({...p, safety: e.target.checked}))} className="rounded text-black focus:ring-0" />
                        </label>
                        
                        {activeLayers.safety && (
                            <div className="pl-2">
                                <label className="block text-[10px] font-bold text-gray-400 mb-1">Building Filter</label>
                                <select 
                                    value={buildingFilter} 
                                    onChange={(e) => setBuildingFilter(e.target.value)} 
                                    className="w-full p-2 rounded-lg border text-sm"
                                >
                                    <option value="All">All Buildings</option>
                                    {uniqueBuildings.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Earthquake List Drawer */}
            {showQuakeList && (
                <div className="absolute top-20 right-3 left-3 sm:left-auto sm:right-4 bottom-24 z-[39] bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-gray-100 sm:w-72 animate-in slide-in-from-right-4 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center gap-2"><Icons.Activity className="text-yellow-600"/> {t('seismicEvents')}</h3>
                        <button onClick={() => setShowQuakeList(false)} className="p-1 hover:bg-gray-100 rounded-full"><Icons.X size={16}/></button>
                    </div>
                    
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            placeholder="Search location..." 
                            className="w-full p-2 rounded-lg border text-xs"
                            value={quakeSearch}
                            onChange={(e) => setQuakeSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-3 shrink-0">
                        <button onClick={() => setQuakeSort('mag')} className={`flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded min-h-[36px] ${quakeSort === 'mag' ? 'bg-white shadow' : 'text-gray-500'}`}>{t('magnitude')}</button>
                        <button onClick={() => setQuakeSort('time')} className={`flex-1 py-1.5 text-[11px] sm:text-xs font-bold rounded min-h-[36px] ${quakeSort === 'time' ? 'bg-white shadow' : 'text-gray-500'}`}>{t('recent')}</button>
                    </div>

                    <div className="overflow-y-auto flex-1 space-y-2 pr-1 custom-scrollbar">
                        {filteredQuakes.map(q => (
                            <div 
                                key={q.id} 
                                onClick={() => handleQuakeClick(q)}
                                className="p-3 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-black transition-colors"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-xs">{q.properties.place}</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${q.properties.mag > 5 ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                        {q.properties.mag.toFixed(1)}
                                    </span>
                                </div>
                                <span className="text-[10px] text-gray-400">{new Date(q.properties.time).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Map Container with overlay layer for simulation UI */}
            <div className="flex-1 w-full relative">
                <div ref={mapContainer} className="absolute inset-0 z-0" />

                {/* Tactical Simulation - Intelligence Card */}
            {selectedSimEntity && simPopupPos && (
                <div
                    className="absolute z-[100] pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-white/20 w-[calc(100vw-2rem)] sm:w-72 max-w-[288px] animate-in zoom-in-95"
                    style={{ left: simPopupPos.x, top: simPopupPos.y - 12, transform: 'translate(-50%, -100%)' }}
                >
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">{selectedSimEntity.category} Intel</div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${(selectedSimEntity.severity === 'Critical' || selectedSimEntity.affiliation === 'THREAT') ? 'bg-red-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                                <span className="text-xs font-bold uppercase tracking-wider">{selectedSimEntity.callSign || selectedSimEntity.id}</span>
                            </div>
                        </div>
                        <button onClick={() => setSelectedSimEntity(null)} className="text-white/40 hover:text-white"><Icons.X size={18} /></button>
                    </div>
                    <p className="text-sm font-bold uppercase leading-tight mb-3">{selectedSimEntity.title || selectedSimEntity.name}</p>
                    {selectedSimEntity.category === 'AirNode' ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 bg-white/5 rounded-lg"><span className="block text-white/50 text-[10px] font-bold uppercase">Altitude</span>{selectedSimEntity.altitude} FT</div>
                            <div className="p-2 bg-white/5 rounded-lg"><span className="block text-white/50 text-[10px] font-bold uppercase">Speed</span>{selectedSimEntity.speed} KTS</div>
                            <div className="p-2 bg-white/5 rounded-lg"><span className="block text-white/50 text-[10px] font-bold uppercase">Heading</span>{selectedSimEntity.heading}°</div>
                            <div className="p-2 bg-white/5 rounded-lg"><span className="block text-white/50 text-[10px] font-bold uppercase">Threat</span><span className={selectedSimEntity.affiliation === 'THREAT' ? 'text-red-500' : 'text-emerald-500'}>{selectedSimEntity.affiliation === 'THREAT' ? 'HIGH' : 'NOMINAL'}</span></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 bg-white/5 rounded-lg text-center"><span className="block text-white/50 text-[10px] font-bold uppercase">Status</span><span className={selectedSimEntity.status === 'Busy' ? 'text-amber-400' : 'text-emerald-400'}>{selectedSimEntity.status || 'ACTIVE'}</span></div>
                            <div className="p-2 bg-white/5 rounded-lg text-center"><span className="block text-white/50 text-[10px] font-bold uppercase">Role</span>{selectedSimEntity.role || selectedSimEntity.type}</div>
                        </div>
                    )}
                    <button
                        onClick={() => { if (selectedSimEntity.lat && selectedSimEntity.lng) mapInstance.current?.flyTo([selectedSimEntity.lat, selectedSimEntity.lng], 14); }}
                        className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                        <Icons.Navigation size={14} /> Track Node
                    </button>
                </div>
            )}

            {/* Item Details Modal (from Map Click) */}
            {selectedItem && (
                 <div className="absolute bottom-0 left-0 right-0 z-[60] bg-white rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.2)] max-h-[70vh] sm:max-h-[60vh] flex flex-col animate-in slide-in-from-bottom-10">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-3xl">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${'name' in selectedItem ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {'name' in selectedItem ? <Icons.Resources size={20}/> : <Icons.Emergency size={20}/>}
                            </div>
                            <div>
                                <h2 className="font-bold text-lg leading-tight">{'name' in selectedItem ? (selectedItem as Resource).name : (selectedItem as IncidentReport).type}</h2>
                                <p className="text-xs text-gray-500">
                                    {'name' in selectedItem ? t('resourceLabel') : t('incidentReportLabel')} • #{selectedItem.id}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-200 rounded-full">
                            <Icons.X size={20} />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                         {'name' in selectedItem ? (
                             // Resource Details
                             <div className="space-y-4">
                                 <p className="text-gray-700">{(selectedItem as Resource).description}</p>
                                 
                                 {/* Capacity Overlay in Modal */}
                                 {(selectedItem as Resource).capacity && (
                                     <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold text-gray-500 uppercase">{t('liveCapacity')}</span>
                                            <span className={`text-sm font-bold ${((selectedItem as Resource).occupancy || 0) / (selectedItem as Resource).capacity! > 0.9 ? 'text-red-600' : 'text-green-600'}`}>
                                                {(selectedItem as Resource).occupancy} / {(selectedItem as Resource).capacity}
                                            </span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${((selectedItem as Resource).occupancy || 0) / (selectedItem as Resource).capacity! > 0.9 ? 'bg-red-500' : 'bg-green-500'}`} 
                                                style={{width: `${Math.min((((selectedItem as Resource).occupancy || 0) / (selectedItem as Resource).capacity!) * 100, 100)}%`}}
                                            ></div>
                                        </div>
                                     </div>
                                 )}

                                 <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                                     <div className="flex items-center gap-2 text-sm text-gray-600"><Icons.MapPin size={16}/> {(selectedItem as Resource).address}</div>
                                     <div className="flex items-center gap-2 text-sm text-gray-600"><Icons.Phone size={16}/> {(selectedItem as Resource).phone}</div>
                                     {(selectedItem as Resource).operatingHours && <div className="flex items-center gap-2 text-sm text-gray-600"><Icons.Clock size={16}/> {(selectedItem as Resource).operatingHours}</div>}
                                 </div>
                                  {(selectedItem as Resource).specialInstructions && (
                                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                         <h4 className="font-bold text-xs text-blue-600 uppercase mb-2">{t('instructions')}</h4>
                                         <p className="text-sm text-gray-700">{(selectedItem as Resource).specialInstructions}</p>
                                     </div>
                                 )}
                                 {(selectedItem as Resource).notes && (
                                     <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                         <h4 className="font-bold text-xs text-yellow-600 uppercase mb-2">{t('adminNotes')}</h4>
                                         <p className="text-sm text-gray-700">{(selectedItem as Resource).notes}</p>
                                     </div>
                                 )}
                             </div>
                         ) : (
                             // Incident Details
                             <div className="space-y-4">
                                 <p className="text-gray-700 text-sm leading-relaxed">{(selectedItem as IncidentReport).description}</p>
                                 <div className="flex gap-2">
                                     <span className={`px-2 py-1 text-xs font-bold rounded uppercase ${(selectedItem as IncidentReport).urgency === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                         {t('urgencyLabel')}: {(selectedItem as IncidentReport).urgency}
                                     </span>
                                     <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase">
                                         {t('statusPrefix')}: {(selectedItem as IncidentReport).status}
                                     </span>
                                 </div>
                                 
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                     <div className="bg-gray-50 p-3 rounded-xl">
                                         <div className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase mb-1">{t('incidentLocation')}</div>
                                         <div className="text-sm font-bold text-gray-800">{(selectedItem as IncidentReport).department || t('notAvailable')}</div>
                                     </div>
                                     <div className="bg-gray-50 p-3 rounded-xl">
                                         <div className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase mb-1">{t('reportedTime')}</div>
                                         <div className="text-sm font-bold text-gray-800">{(selectedItem as IncidentReport).timestamp}</div>
                                     </div>
                                 </div>

                                 {((selectedItem as IncidentReport).contactPerson || (selectedItem as IncidentReport).contactPhone) && (
                                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <h4 className="font-bold text-xs text-blue-600 uppercase mb-2">{t('pointOfContact')}</h4>
                                        {(selectedItem as IncidentReport).contactPerson && <div className="text-sm font-bold mb-1">{(selectedItem as IncidentReport).contactPerson}</div>}
                                        {(selectedItem as IncidentReport).contactPhone && <div className="text-sm text-gray-600">{(selectedItem as IncidentReport).contactPhone}</div>}
                                     </div>
                                 )}

                                 {(selectedItem as IncidentReport).structuralDamage && (selectedItem as IncidentReport).structuralDamage !== 'None' && (
                                     <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                         <h4 className="font-bold text-xs text-red-600 uppercase mb-1">{t('damageAssessment')}</h4>
                                         <div className="text-sm text-gray-800 font-bold mb-1">{(selectedItem as IncidentReport).structuralDamage}</div>
                                         <div className="text-xs text-gray-600">{t('estCostPrefix')}: €{(selectedItem as IncidentReport).estCost} • {t('repairDaysPrefix')}: {(selectedItem as IncidentReport).estRepairDays} {t('daysUnit')}</div>
                                     </div>
                                 )}
                             </div>
                         )}
                         <a 
                             href={`https://www.google.com/maps/dir/?api=1&destination=${selectedItem.lat},${selectedItem.lng}`}
                             target="_blank"
                             rel="noreferrer"
                             className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 shadow-lg"
                         >
                             <Icons.Navigation size={18} /> {t('getDirections')}
                         </a>
                    </div>
                 </div>
            )}
            </div>
        </div>
    );
};

export default Maps;