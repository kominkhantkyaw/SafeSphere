
import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { SafetyAsset } from '../types';
import { fetchSafetyAssets, submitSafetyAsset, deleteSafetyAsset } from '../services/api';
import { attachCartoTileFallback, getCartoBaseMapConfig, getOpenStreetMapConfig, hasCartoBasemapKey } from '../config/maps';

declare global {
    interface Window {
        L: any;
    }
}

// Default centre (Yangon) used only before first GPS fix
const DEFAULT_CENTER: [number, number] = [16.8661, 96.1951];
const DEFAULT_ZOOM = 16;

// Connector/line colour options for linking exits, meeting points, safety places
const CONNECTOR_COLOURS = [
    { hex: '#3b82f6', name: 'Blue' },
    { hex: '#22c55e', name: 'Green' },
    { hex: '#eab308', name: 'Yellow' },
    { hex: '#ef4444', name: 'Red' },
    { hex: '#8b5cf6', name: 'Purple' },
    { hex: '#0ea5e9', name: 'Sky' },
] as const;

const SafetyMapEditor: React.FC = () => {
    const { t } = useLanguage();
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const tileLayerRef = useRef<any>(null);
    const userMarkerRef = useRef<any>(null);
    const hasCenteredOnUserRef = useRef(false);
    
    const [assets, setAssets] = useState<SafetyAsset[]>([]);
    const [mode, setMode] = useState<'view' | 'point' | 'route' | 'connector'>('view');
    
    // Base map style: light, dark, satellite (live map with real tiles)
    const [baseMap, setBaseMap] = useState<'light' | 'dark' | 'satellite'>('light');
    
    // User GPS location (live map works anywhere)
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
    
    // Point Creation State
    const [selectedPointType, setSelectedPointType] = useState<'exit'|'meeting_point'|'extinguisher'|'hydrant'>('exit');
    
    // Route Drawing State
    const [routeType, setRouteType] = useState<'route'|'road'>('route');
    const [tempRoutePoints, setTempRoutePoints] = useState<[number, number][]>([]);
    
    // Connector/line State (connect exits, meeting points, safety places with coloured lines)
    const [tempConnectorPoints, setTempConnectorPoints] = useState<[number, number][]>([]);
    const [connectorColor, setConnectorColor] = useState<string>(CONNECTOR_COLOURS[0].hex);
    const [showConnectorNameModal, setShowConnectorNameModal] = useState(false);
    const [connectorNameInput, setConnectorNameInput] = useState('');
    
    // Asset Editing State
    const [selectedAsset, setSelectedAsset] = useState<SafetyAsset | null>(null);
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');

    // Route name modal (instead of prompt) for better UX
    const [showRouteNameModal, setShowRouteNameModal] = useState(false);
    const [routeNameInput, setRouteNameInput] = useState('');

    useEffect(() => {
        loadAssets();
    }, []);

    const loadAssets = async () => {
        const data = await fetchSafetyAssets();
        setAssets(data);
    };

    // Map init and base layer in one effect (like Live Command Map): create map if needed, then set/swap tile layer by view mode
    useEffect(() => {
        const container = mapContainer.current;
        if (!container || !window.L) return;

        const applyBaseLayer = () => {
            if (!mapInstance.current) return;

            if (tileLayerRef.current) {
                mapInstance.current.removeLayer(tileLayerRef.current);
                tileLayerRef.current = null;
            }

            let tileUrl: string;
            let tileAttribution: string;
            if (baseMap === 'light') {
                ({ url: tileUrl, attribution: tileAttribution } = getCartoBaseMapConfig('light'));
            } else if (baseMap === 'dark') {
                ({ url: tileUrl, attribution: tileAttribution } = getCartoBaseMapConfig('dark'));
            } else {
                tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
                tileAttribution = 'Tiles &copy; Esri';
            }

            tileLayerRef.current = window.L.tileLayer(tileUrl, {
                attribution: tileAttribution,
                maxZoom: 20
            }).addTo(mapInstance.current);
            if (baseMap !== 'satellite' && hasCartoBasemapKey) {
                attachCartoTileFallback(
                    tileLayerRef.current,
                    mapInstance.current,
                    () => window.L.tileLayer(getOpenStreetMapConfig().url, {
                        attribution: getOpenStreetMapConfig().attribution,
                        maxZoom: 20,
                    }),
                    (fallbackLayer) => { tileLayerRef.current = fallbackLayer; },
                );
            }

            if (typeof mapInstance.current.invalidateSize === 'function') {
                mapInstance.current.invalidateSize();
            }
        };

        if (!mapInstance.current) {
            const initMap = (retry = false) => {
                if (!container || !window.L || mapInstance.current) return;
                if (container.offsetWidth <= 0 || container.offsetHeight <= 0) {
                    if (!retry) setTimeout(() => initMap(true), 150);
                    return;
                }
                mapInstance.current = window.L.map(container).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
                mapInstance.current.on('click', (e: any) => {
                    const { lat, lng } = e.latlng;
                    handleMapClick(lat, lng);
                });
                applyBaseLayer();
            };
            requestAnimationFrame(() => requestAnimationFrame(() => initMap(false)));
        } else {
            applyBaseLayer();
        }
    }, [baseMap]);

    // Keep map visible and editable when switching to Add Point / Draw Path / Connector
    const refreshMapSize = () => {
        const el = mapContainer.current;
        if (!el || el.offsetWidth <= 0 || el.offsetHeight <= 0) return;
        if (mapInstance.current && typeof mapInstance.current.invalidateSize === 'function') {
            mapInstance.current.invalidateSize();
        }
    };

    // Refresh map button: force redraw so the view is restored (works even when map has disappeared)
    const handleRefreshMap = () => {
        if (!mapInstance.current) return;
        const map = mapInstance.current;
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (!mapInstance.current) return;
                if (typeof map.invalidateSize === 'function') map.invalidateSize();
                try {
                    const center = map.getCenter();
                    const zoom = map.getZoom();
                    if (center && typeof map.setView === 'function') {
                        map.setView([center.lat, center.lng], zoom);
                    }
                } catch (_) {}
            }, 100);
        });
    };

    useEffect(() => {
        if (!mapInstance.current) return;
        const run = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    refreshMapSize();
                    setTimeout(refreshMapSize, 80);
                    setTimeout(refreshMapSize, 250);
                    setTimeout(refreshMapSize, 500);
                });
            });
        };
        run();
        return () => {};
    }, [mode]);

    // ResizeObserver: when map container size changes (toolbar expands), redraw map so it stays visible
    useEffect(() => {
        const container = mapContainer.current;
        if (!container) return;
        const ro = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                if (mapInstance.current) refreshMapSize();
            });
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    // GPS: watch position so the live map can be used anywhere
    useEffect(() => {
        if (!('geolocation' in navigator)) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {},
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // First GPS fix: center map on user so they see their location when drawing
    useEffect(() => {
        if (!userLoc || !mapInstance.current || hasCenteredOnUserRef.current) return;
        hasCenteredOnUserRef.current = true;
        mapInstance.current.setView([userLoc.lat, userLoc.lng], DEFAULT_ZOOM);
    }, [userLoc]);

    // User location marker on map
    useEffect(() => {
        if (!mapInstance.current || !window.L) return;
        if (!userLoc) {
            if (userMarkerRef.current) {
                mapInstance.current.removeLayer(userMarkerRef.current);
                userMarkerRef.current = null;
            }
            return;
        }
        if (!userMarkerRef.current) {
            const userIcon = window.L.divIcon({
                className: 'safety-map-user-icon',
                html: `<div class="relative w-4 h-4"><div class="absolute inset-0 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div><div class="absolute -inset-2 bg-blue-500 rounded-full opacity-30 animate-ping"></div></div>`,
                iconSize: [16, 16]
            });
            userMarkerRef.current = window.L.marker([userLoc.lat, userLoc.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(mapInstance.current);
        } else {
            userMarkerRef.current.setLatLng([userLoc.lat, userLoc.lng]);
        }
    }, [userLoc]);

    const centerOnMyLocation = () => {
        if (userLoc && mapInstance.current) {
            mapInstance.current.setView([userLoc.lat, userLoc.lng], DEFAULT_ZOOM);
        } else {
            window.alert(t('waitingForGpsSignal'));
        }
    };

    // Mode Handler for Map Clicks is tied to React state via ref or direct func calls?
    // React State inside Leaflet event listener is stale. Use Ref for mode or re-bind.
    // We will use a Ref for current mode and data to ensure event listener has latest.
    const modeRef = useRef(mode);
    const pointTypeRef = useRef(selectedPointType);
    const routeTypeRef = useRef(routeType);
    const tempRouteRef = useRef(tempRoutePoints);
    const tempConnectorRef = useRef(tempConnectorPoints);
    const connectorColorRef = useRef(connectorColor);

    useEffect(() => {
        modeRef.current = mode;
        pointTypeRef.current = selectedPointType;
        routeTypeRef.current = routeType;
        tempRouteRef.current = tempRoutePoints;
        tempConnectorRef.current = tempConnectorPoints;
        connectorColorRef.current = connectorColor;
    }, [mode, selectedPointType, routeType, tempRoutePoints, tempConnectorPoints, connectorColor]);

    const handleMapClick = (lat: number, lng: number) => {
        const currentMode = modeRef.current;

        if (currentMode === 'point') {
            setSelectedAsset({
                id: 0,
                type: pointTypeRef.current,
                lat,
                lng,
                label: '',
                description: ''
            });
            setLabel('');
            setDescription('');
        } else if (currentMode === 'route') {
            const newPoints = [...tempRouteRef.current, [lat, lng] as [number, number]];
            setTempRoutePoints(newPoints);
        } else if (currentMode === 'connector') {
            const newPoints = [...tempConnectorRef.current, [lat, lng] as [number, number]];
            setTempConnectorPoints(newPoints);
        }
    };

    // Render Assets on Map
    useEffect(() => {
        if (!mapInstance.current) return;

        // Clear existing
        markersRef.current.forEach(m => mapInstance.current.removeLayer(m));
        markersRef.current = [];

        // 1. Render stored assets
        assets.forEach(asset => {
            const layer = renderAssetOnMap(asset);
            if (layer) {
                layer.addTo(mapInstance.current);
                // Add click listener to edit/delete
                layer.on('click', (e: any) => {
                    window.L.DomEvent.stopPropagation(e); // Prevent map click
                    handleAssetClick(asset);
                });
                markersRef.current.push(layer);
            }
        });

        // 2. Render Temp Route being drawn
        if (tempRoutePoints.length > 0) {
            const color = routeType === 'road' ? '#374151' : '#22c55e';
            const poly = window.L.polyline(tempRoutePoints, { color, dashArray: '5, 10', weight: 4 });
            poly.addTo(mapInstance.current);
            markersRef.current.push(poly);
            tempRoutePoints.forEach(pt => {
                const m = window.L.circleMarker(pt, { radius: 4, color, fillColor: '#fff', fillOpacity: 1 });
                m.addTo(mapInstance.current);
                markersRef.current.push(m);
            });
        }

        // 3. Render Temp Connector line being drawn
        if (tempConnectorPoints.length > 0) {
            const poly = window.L.polyline(tempConnectorPoints, { color: connectorColor, weight: 5, opacity: 0.9 });
            poly.addTo(mapInstance.current);
            markersRef.current.push(poly);
            tempConnectorPoints.forEach(pt => {
                const m = window.L.circleMarker(pt, { radius: 5, color: connectorColor, fillColor: '#fff', fillOpacity: 1 });
                m.addTo(mapInstance.current);
                markersRef.current.push(m);
            });
        }
    }, [assets, tempRoutePoints, routeType, tempConnectorPoints, connectorColor]);

    const renderAssetOnMap = (asset: SafetyAsset) => {
        if (asset.type === 'route' || asset.type === 'road') {
            if (!asset.routePoints) return null;
            const color = asset.type === 'road' ? '#6b7280' : '#22c55e';
            return window.L.polyline(asset.routePoints, { color, weight: 5, opacity: 0.8 });
        }
        if (asset.type === 'connector' && asset.routePoints && asset.routePoints.length >= 2) {
            const color = asset.color || '#3b82f6';
            return window.L.polyline(asset.routePoints, { color, weight: 5, opacity: 0.9 });
        }
        if (asset.type === 'extinguisher' || asset.type === 'exit' || asset.type === 'meeting_point' || asset.type === 'hydrant') {
            let iconHtml = '';
            let bgClass = '';
            switch(asset.type) {
                case 'extinguisher': iconHtml = '🧯'; bgClass = 'bg-red-100 border-red-500 text-red-600'; break;
                case 'hydrant': iconHtml = '💧'; bgClass = 'bg-blue-100 border-blue-500 text-blue-600'; break;
                case 'exit': iconHtml = '🚪'; bgClass = 'bg-green-100 border-green-500 text-green-600'; break;
                case 'meeting_point': iconHtml = '👥'; bgClass = 'bg-yellow-100 border-yellow-500 text-yellow-600'; break;
            }
            const icon = window.L.divIcon({
                className: 'editor-icon',
                html: `<div class="w-8 h-8 ${bgClass} border-2 rounded-full flex items-center justify-center shadow-md text-lg">${iconHtml}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });
            return window.L.marker([asset.lat, asset.lng], { icon });
        }
        return null;
    };

    const handleAssetClick = (asset: SafetyAsset) => {
        setSelectedAsset(asset);
        setLabel(asset.label || '');
        setDescription(asset.description || '');
    };

    const saveAsset = async () => {
        if (!selectedAsset) return;
        const toSave = { ...selectedAsset, label, description };
        await submitSafetyAsset(toSave);
        setSelectedAsset(null);
        loadAssets();
    };

    const deleteAsset = async () => {
        if (!selectedAsset || !selectedAsset.id) return;
        if (window.confirm(t('areYouSure'))) {
            await deleteSafetyAsset(selectedAsset.id);
            setSelectedAsset(null);
            loadAssets();
        }
    };

    const openRouteNameModal = () => {
        if (tempRoutePoints.length < 2) {
            setTempRoutePoints([]);
            return;
        }
        setRouteNameInput(routeType === 'road' ? t('transportRoad') : t('evacRoute'));
        setShowRouteNameModal(true);
    };

    const openConnectorNameModal = () => {
        if (tempConnectorPoints.length < 2) {
            setTempConnectorPoints([]);
            return;
        }
        setConnectorNameInput('');
        setShowConnectorNameModal(true);
    };

    const finishConnector = async () => {
        const name = connectorNameInput.trim() || t('connectorLine');
        setShowConnectorNameModal(false);
        setConnectorNameInput('');
        const newConnector: Partial<SafetyAsset> = {
            type: 'connector',
            label: name,
            routePoints: tempConnectorPoints,
            lat: tempConnectorPoints[0][0],
            lng: tempConnectorPoints[0][1],
            color: connectorColor
        };
        await submitSafetyAsset(newConnector);
        setTempConnectorPoints([]);
        setMode('view');
        loadAssets();
    };

    const finishRoute = async () => {
        const name = routeNameInput.trim() || (routeType === 'road' ? t('transportRoad') : t('evacRoute'));
        setShowRouteNameModal(false);
        setRouteNameInput('');

        const newRoute: Partial<SafetyAsset> = {
            type: routeType,
            label: name,
            routePoints: tempRoutePoints,
            lat: tempRoutePoints[0][0],
            lng: tempRoutePoints[0][1]
        };
        await submitSafetyAsset(newRoute);
        setTempRoutePoints([]);
        setMode('view');
        loadAssets();
    };

    return (
        <div className="relative h-full w-full min-h-[540px] flex flex-col flex-1 bg-white rounded-xl overflow-hidden">
            {/* Toolbar — shrink-0 so map area always gets remaining space */}
            <div className="p-3 border-b border-gray-200 flex flex-wrap items-center gap-2 bg-white shrink-0">
                <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5 flex-wrap">
                    <button type="button" onClick={() => setMode('view')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 min-h-[44px] sm:min-h-0 ${mode === 'view' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                        <Icons.Eye size={16}/> {t('view')}
                    </button>
                    <button type="button" onClick={() => setMode('point')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 min-h-[44px] sm:min-h-0 ${mode === 'point' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                        <Icons.MapPin size={16}/> {t('addPoint')}
                    </button>
                    <button type="button" onClick={() => setMode('route')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 min-h-[44px] sm:min-h-0 ${mode === 'route' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                        <Icons.Navigation size={16}/> {t('drawPath')}
                    </button>
                    <button type="button" onClick={() => setMode('connector')} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 min-h-[44px] sm:min-h-0 ${mode === 'connector' ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}>
                        <Icons.Link size={16}/> {t('connectorLine')}
                    </button>
                </div>

                {mode === 'point' && (
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                        {(['exit', 'meeting_point', 'extinguisher', 'hydrant'] as const).map(typ => (
                            <button
                                key={typ}
                                type="button"
                                onClick={() => setSelectedPointType(typ)}
                                className={`p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-200 ${selectedPointType === typ ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500' : 'text-gray-500'}`}
                                title={typ === 'exit' ? t('exit') : typ === 'meeting_point' ? t('meetingPoint') : typ === 'extinguisher' ? t('extinguisher') : t('hydrant')}
                            >
                                {typ === 'exit' && <span className="text-xl">🚪</span>}
                                {typ === 'meeting_point' && <span className="text-xl">👥</span>}
                                {typ === 'extinguisher' && <span className="text-xl">🧯</span>}
                                {typ === 'hydrant' && <span className="text-xl">💧</span>}
                            </button>
                        ))}
                    </div>
                )}

                {mode === 'route' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex bg-gray-100 rounded-xl p-1">
                            <button type="button" onClick={() => setRouteType('route')} className={`px-3 py-2 rounded-lg text-xs font-bold ${routeType === 'route' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-200'}`}>{t('evacRoute')}</button>
                            <button type="button" onClick={() => setRouteType('road')} className={`px-3 py-2 rounded-lg text-xs font-bold ${routeType === 'road' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-200'}`}>{t('transportRoad')}</button>
                        </div>
                        {tempRoutePoints.length >= 2 && (
                            <div className="flex gap-2">
                                <button type="button" onClick={openRouteNameModal} className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl shadow-md hover:bg-gray-800 min-h-[44px]">{t('finish')}</button>
                                <button type="button" onClick={() => setTempRoutePoints([])} className="px-4 py-2 bg-white border-2 border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 min-h-[44px]">{t('clear')}</button>
                            </div>
                        )}
                    </div>
                )}

                {mode === 'connector' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] sm:text-xs text-gray-500 font-medium">{t('lineColour')}:</span>
                        <div className="flex flex-wrap gap-1">
                            {CONNECTOR_COLOURS.map(({ hex }) => (
                                <button key={hex} type="button" onClick={() => setConnectorColor(hex)} className={`w-8 h-8 rounded-full border-2 transition-transform ${connectorColor === hex ? 'border-gray-800 scale-110 ring-2 ring-offset-1 ring-gray-400' : 'border-gray-300 hover:border-gray-500'}`} style={{ backgroundColor: hex }} title={hex} />
                            ))}
                        </div>
                        {tempConnectorPoints.length >= 2 && (
                            <div className="flex gap-2">
                                <button type="button" onClick={openConnectorNameModal} className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-violet-700 min-h-[44px]">{t('finish')}</button>
                                <button type="button" onClick={() => setTempConnectorPoints([])} className="px-4 py-2 bg-white border-2 border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 min-h-[44px]">{t('clear')}</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Map view mode: Dark / Light / Satellite — active style updates the live base layer */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] sm:text-xs text-gray-500 font-medium hidden sm:inline">{t('baseMapStyle')}:</span>
                    <div className="flex bg-gray-200 rounded-xl p-1 gap-0.5" role="group" aria-label={t('baseMapStyle')}>
                        <button type="button" onClick={() => setBaseMap('dark')} className={`p-2 rounded-lg min-w-[44px] min-h-[44px] sm:min-h-0 flex items-center justify-center transition-colors ${baseMap === 'dark' ? 'bg-gray-800 text-white shadow-inner' : 'text-gray-500 hover:bg-gray-300'}`} title={t('darkMap')}><Icons.Moon size={16}/></button>
                        <button type="button" onClick={() => setBaseMap('light')} className={`p-2 rounded-lg min-w-[44px] min-h-[44px] sm:min-h-0 flex items-center justify-center transition-colors ${baseMap === 'light' ? 'bg-amber-400 text-amber-900 shadow-inner' : 'text-gray-500 hover:bg-gray-300'}`} title={t('lightMap')}><Icons.Sun size={16}/></button>
                        <button type="button" onClick={() => setBaseMap('satellite')} className={`p-2 rounded-lg min-w-[44px] min-h-[44px] sm:min-h-0 flex items-center justify-center transition-colors ${baseMap === 'satellite' ? 'bg-blue-500 text-white shadow-inner' : 'text-gray-500 hover:bg-gray-300'}`} title={t('satelliteMap')}><Icons.Satellite size={16}/></button>
                    </div>
                </div>

                {/* My location: center map on GPS */}
                <button type="button" onClick={centerOnMyLocation} className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 min-h-[44px] min-w-[44px] sm:min-h-0 flex items-center justify-center" title={t('myLocation')}>
                    <Icons.MapPin size={18} className="text-blue-500"/>
                </button>

                {/* Refresh map: restore map view if it disappears after switching to Add Point / Draw Path */}
                <button type="button" onClick={handleRefreshMap} className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 min-h-[44px] min-w-[44px] sm:min-h-0 flex items-center justify-center" title={t('refreshMap')}>
                    <Icons.RefreshCw size={18} className="text-gray-600"/>
                </button>

                {/* Legend */}
                <div className="ml-auto flex flex-wrap items-center gap-3 text-[10px] sm:text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-green-100 border border-green-500 flex items-center justify-center text-sm">🚪</span> {t('exit')}</span>
                    <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-yellow-100 border border-yellow-500 flex items-center justify-center text-sm">👥</span> {t('meetingPoint')}</span>
                    <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-red-100 border border-red-500 flex items-center justify-center text-sm">🧯</span> {t('extinguisher')}</span>
                    <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-blue-100 border border-blue-500 flex items-center justify-center text-sm">💧</span> {t('hydrant')}</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-green-500 rounded" /> {t('evacRoute')}</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-gray-500 rounded" /> {t('transportRoad')}</span>
                    <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-violet-500 rounded" /> {t('connectorLine')}</span>
                </div>
            </div>

            {/* Map area: wrapper reserves space so map never disappears when toolbar expands (Add Point / Draw Path) */}
            <div className="flex-1 min-h-[420px] w-full relative flex flex-col">
                <div
                    ref={mapContainer}
                    className={`absolute inset-0 w-full h-full rounded-b-xl ${mode === 'view' ? 'cursor-default' : 'cursor-crosshair'} bg-gray-100`}
                >
                    {mode === 'view' && <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-gray-800/90 text-white px-3 py-1.5 rounded-full text-xs font-medium pointer-events-none z-[400]">{t('safetyMapViewHint')}</div>}
                    {mode === 'point' && <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg pointer-events-none z-[400]">{t('tapMapToPlace')} {selectedPointType === 'exit' ? t('exit') : selectedPointType === 'meeting_point' ? t('meetingPoint') : selectedPointType === 'extinguisher' ? t('extinguisher') : t('hydrant')}</div>}
                    {mode === 'route' && <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg pointer-events-none z-[400]">{t('tapMapToDraw')} {routeType === 'route' ? t('evacRoute') : t('transportRoad')} {t('pathLabel')}</div>}
                    {mode === 'connector' && <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg pointer-events-none z-[400]">{t('tapMapToDraw')} {t('connectorLine')}</div>}
                </div>
            </div>

            {/* Route name modal */}
            {showRouteNameModal && (
                <div className="absolute inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-3">{t('nameThisRoute')}</h3>
                        <input
                            type="text"
                            value={routeNameInput}
                            onChange={e => setRouteNameInput(e.target.value)}
                            placeholder={routeType === 'road' ? t('transportRoad') : t('evacRoute')}
                            className="w-full p-3 rounded-xl border border-gray-300 text-sm mb-4"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setShowRouteNameModal(false); setRouteNameInput(''); }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm">{t('cancel')}</button>
                            <button type="button" onClick={finishRoute} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm">{t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Connector name modal */}
            {showConnectorNameModal && (
                <div className="absolute inset-0 z-[1100] bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-3">{t('nameThisConnector')}</h3>
                        <input
                            type="text"
                            value={connectorNameInput}
                            onChange={e => setConnectorNameInput(e.target.value)}
                            placeholder={t('connectorLine')}
                            className="w-full p-3 rounded-xl border border-gray-300 text-sm mb-4"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setShowConnectorNameModal(false); setConnectorNameInput(''); }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm">{t('cancel')}</button>
                            <button type="button" onClick={finishConnector} className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm">{t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {selectedAsset && (
                <div className="absolute bottom-0 left-0 right-0 bg-white p-4 rounded-t-2xl shadow-2xl z-[1000] animate-in slide-in-from-bottom-10 border-t border-gray-200">
                    <h3 className="font-bold text-lg mb-3 flex justify-between">
                        {selectedAsset.id === 0 ? t('newAssetDetails') : t('editAsset')}
                        <span className="text-xs font-normal text-gray-400 uppercase bg-gray-100 px-2 py-1 rounded">{selectedAsset.type === 'connector' ? t('connectorLine') : selectedAsset.type}</span>
                    </h3>
                    <div className="space-y-3 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('labelName')}</label>
                            <input 
                                type="text" 
                                value={label} 
                                onChange={e => setLabel(e.target.value)} 
                                className="w-full p-2 rounded-lg border text-sm" 
                                placeholder={t('mainExitPlaceholder')}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('description')}</label>
                            <input 
                                type="text" 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                className="w-full p-2 rounded-lg border text-sm" 
                                placeholder={t('optionalDetailsPlaceholder')}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={saveAsset} className="flex-1 py-2 bg-black text-white rounded-lg font-bold text-sm">{t('save')}</button>
                        {selectedAsset.id !== 0 && (
                            <button onClick={deleteAsset} className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-sm">{t('delete')}</button>
                        )}
                        <button onClick={() => setSelectedAsset(null)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold text-sm">{t('cancel')}</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SafetyMapEditor;
