
import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { SafetyAsset } from '../types';
import { fetchSafetyAssets, submitSafetyAsset, deleteSafetyAsset } from '../services/api';

declare global {
    interface Window {
        L: any;
    }
}

const SafetyMapEditor: React.FC = () => {
    const { t } = useLanguage();
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    
    const [assets, setAssets] = useState<SafetyAsset[]>([]);
    const [mode, setMode] = useState<'view' | 'point' | 'route'>('view');
    
    // Point Creation State
    const [selectedPointType, setSelectedPointType] = useState<'exit'|'meeting_point'|'extinguisher'|'hydrant'>('exit');
    
    // Route Drawing State
    const [routeType, setRouteType] = useState<'route'|'road'>('route');
    const [tempRoutePoints, setTempRoutePoints] = useState<[number, number][]>([]);
    
    // Asset Editing State
    const [selectedAsset, setSelectedAsset] = useState<SafetyAsset | null>(null);
    const [label, setLabel] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        loadAssets();
    }, []);

    const loadAssets = async () => {
        const data = await fetchSafetyAssets();
        setAssets(data);
    };

    // Initial Map Setup
    useEffect(() => {
        if (!mapContainer.current || !window.L) return;
        if (!mapInstance.current) {
            mapInstance.current = window.L.map(mapContainer.current).setView([16.8661, 96.1951], 16);
            window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: 'OpenStreetMap',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(mapInstance.current);

            // Map Click Handler
            mapInstance.current.on('click', (e: any) => {
                const { lat, lng } = e.latlng;
                handleMapClick(lat, lng);
            });
        }
    }, []);

    // Mode Handler for Map Clicks is tied to React state via ref or direct func calls?
    // React State inside Leaflet event listener is stale. Use Ref for mode or re-bind.
    // We will use a Ref for current mode and data to ensure event listener has latest.
    const modeRef = useRef(mode);
    const pointTypeRef = useRef(selectedPointType);
    const routeTypeRef = useRef(routeType);
    const tempRouteRef = useRef(tempRoutePoints);

    useEffect(() => {
        modeRef.current = mode;
        pointTypeRef.current = selectedPointType;
        routeTypeRef.current = routeType;
        tempRouteRef.current = tempRoutePoints;
    }, [mode, selectedPointType, routeType, tempRoutePoints]);

    const handleMapClick = (lat: number, lng: number) => {
        const currentMode = modeRef.current;

        if (currentMode === 'point') {
            // Create a temporary asset and open modal
            setSelectedAsset({
                id: 0, // 0 indicates new
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

            // Render markers for points
            tempRoutePoints.forEach(pt => {
                const m = window.L.circleMarker(pt, { radius: 4, color: color, fillColor: '#fff', fillOpacity: 1 });
                m.addTo(mapInstance.current);
                markersRef.current.push(m);
            });
        }

    }, [assets, tempRoutePoints, routeType]);

    const renderAssetOnMap = (asset: SafetyAsset) => {
        if (asset.type === 'route' || asset.type === 'road') {
            if (!asset.routePoints) return null;
            const color = asset.type === 'road' ? '#6b7280' : '#22c55e'; // Gray for road, Green for evac
            return window.L.polyline(asset.routePoints, { color, weight: 5, opacity: 0.8 });
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
                className: 'editor-icon',
                html: `<div class="w-8 h-8 ${bgClass} border-2 rounded-full flex items-center justify-center shadow-md text-lg">${iconHtml}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });
            return window.L.marker([asset.lat, asset.lng], { icon });
        }
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

    const finishRoute = async () => {
        if (tempRoutePoints.length < 2) {
            setTempRoutePoints([]);
            return;
        }
        // Prompt for route name
        const name = prompt("Enter name for this route/road:", routeType === 'road' ? "Main Road" : "Evac Route A");
        if (!name) return;

        const newRoute: Partial<SafetyAsset> = {
            type: routeType,
            label: name,
            routePoints: tempRoutePoints,
            lat: tempRoutePoints[0][0], // just for ref
            lng: tempRoutePoints[0][1]
        };
        
        await submitSafetyAsset(newRoute);
        setTempRoutePoints([]);
        setMode('view');
        loadAssets();
    };

    return (
        <div className="relative h-full w-full flex flex-col bg-white">
            
            {/* Toolbar */}
            <div className="p-2 border-b flex items-center gap-2 bg-gray-50 overflow-x-auto">
                <div className="flex bg-white rounded-lg border p-1 shadow-sm">
                    <button onClick={() => setMode('view')} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 ${mode === 'view' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Icons.Eye size={14}/> {t('view')}
                    </button>
                    <button onClick={() => setMode('point')} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 ${mode === 'point' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Icons.MapPin size={14}/> {t('addPoint')}
                    </button>
                    <button onClick={() => setMode('route')} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 ${mode === 'route' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Icons.Navigation size={14}/> {t('drawPath')}
                    </button>
                </div>

                {mode === 'point' && (
                    <div className="flex bg-white rounded-lg border p-1 shadow-sm animate-in slide-in-from-left-2">
                        {(['exit', 'meeting_point', 'extinguisher', 'hydrant'] as const).map(t => (
                            <button 
                                key={t}
                                onClick={() => setSelectedPointType(t)}
                                className={`p-1.5 rounded hover:bg-gray-100 ${selectedPointType === t ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
                                title={t}
                            >
                                {t === 'exit' && <div className="text-lg">🚪</div>}
                                {t === 'meeting_point' && <div className="text-lg">👥</div>}
                                {t === 'extinguisher' && <div className="text-lg">🧯</div>}
                                {t === 'hydrant' && <div className="text-lg">💧</div>}
                            </button>
                        ))}
                    </div>
                )}

                {mode === 'route' && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                        <div className="flex bg-white rounded-lg border p-1 shadow-sm">
                            <button onClick={() => setRouteType('route')} className={`px-2 py-1.5 rounded text-[10px] font-bold ${routeType === 'route' ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}>{t('evacRoute')}</button>
                            <button onClick={() => setRouteType('road')} className={`px-2 py-1.5 rounded text-[10px] font-bold ${routeType === 'road' ? 'bg-gray-200 text-gray-800' : 'text-gray-500'}`}>{t('transportRoad')}</button>
                        </div>
                        {tempRoutePoints.length > 0 && (
                            <div className="flex gap-1">
                                <button onClick={finishRoute} className="px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg shadow-md hover:bg-gray-800">{t('finish')}</button>
                                <button onClick={() => setTempRoutePoints([])} className="px-3 py-1.5 bg-white border text-red-500 text-xs font-bold rounded-lg hover:bg-gray-50">{t('clear')}</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Map */}
            <div ref={mapContainer} className="flex-1 w-full bg-gray-100 relative cursor-crosshair">
{mode === 'point' && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg pointer-events-none z-[400]">{t('tapMapToPlace')} {selectedPointType === 'exit' ? t('exit') : selectedPointType === 'meeting_point' ? t('meetingPoint') : selectedPointType === 'extinguisher' ? t('extinguisher') : t('hydrant')}</div>}
                                {mode === 'route' && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg pointer-events-none z-[400]">{t('tapMapToDraw')} {routeType === 'route' ? t('evacRoute') : t('transportRoad')} {t('pathLabel')}</div>}
            </div>

            {/* Edit Modal */}
            {selectedAsset && (
                <div className="absolute bottom-0 left-0 right-0 bg-white p-4 rounded-t-2xl shadow-2xl z-[1000] animate-in slide-in-from-bottom-10 border-t border-gray-200">
                    <h3 className="font-bold text-lg mb-3 flex justify-between">
                        {selectedAsset.id === 0 ? t('newAssetDetails') : t('editAsset')}
                        <span className="text-xs font-normal text-gray-400 uppercase bg-gray-100 px-2 py-1 rounded">{selectedAsset.type}</span>
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
