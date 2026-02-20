
import React, { useEffect, useState } from 'react';
import { Icons } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';
import { Resource } from '../types';
import { fetchResources, deleteResource } from '../services/api';
import IncidentMap from '../components/IncidentMap';
import ResourceForm from '../components/ResourceForm';

const Resources: React.FC = () => {
    const { t } = useLanguage();
    const [resources, setResources] = useState<Resource[]>([]);
    const [filters, setFilters] = useState<string[]>(['all']); // Multi-filter
    const [urgencyFilter, setUrgencyFilter] = useState<string>('all'); // Urgency
    const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance'); // Sorting
    const [search, setSearch] = useState('');
    const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);

    // States for Actions
    const [showForm, setShowForm] = useState(false);
    const [editingResource, setEditingResource] = useState<Resource | null>(null);
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null); // For Details Modal
    const [showQR, setShowQR] = useState<Resource | null>(null);

    // Default "Nearby" location (Fallbacks) - Myanmar (Yangon)
    const DEFAULT_LAT = 16.866;
    const DEFAULT_LNG = 96.195;

    const loadData = () => {
        fetchResources().then(setResources);
    };

    useEffect(() => {
        loadData();
        
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => setUserLoc({ lat: DEFAULT_LAT, lng: DEFAULT_LNG }) // Fallback
            );
        } else {
            setUserLoc({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
        }
    }, []);

    const deg2rad = (deg: number) => {
        return deg * (Math.PI/180);
    }

    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; 
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const d = R * c; 
        return d;
    };

    // Toggle filter logic
    const toggleFilter = (id: string) => {
        if (id === 'all') {
            setFilters(['all']);
        } else {
            // If selecting a specific type, remove 'all' if present
            let newFilters = filters.filter(f => f !== 'all');
            
            if (newFilters.includes(id)) {
                newFilters = newFilters.filter(f => f !== id);
            } else {
                newFilters.push(id);
            }

            // If nothing selected, revert to 'all'
            if (newFilters.length === 0) newFilters = ['all'];
            setFilters(newFilters);
        }
    };

    const filteredResources = resources.map(r => {
        // Calculate distance if user location is known, else use -1 to signify unknown
        const dist = userLoc ? getDistance(userLoc.lat, userLoc.lng, r.lat, r.lng) : -1;
        return { ...r, distanceNum: dist };
    }).filter(r => {
        const matchesType = filters.includes('all') || filters.includes(r.type) || (filters.includes('nearby') && r.distanceNum >= 0 && r.distanceNum < 5);
        const matchesUrgency = urgencyFilter === 'all' || r.urgency === urgencyFilter;
        const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
        return matchesType && matchesUrgency && matchesSearch;
    }).sort((a, b) => {
        if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
        }
        // Distance sort: push unknown distances (-1) to bottom
        const distA = a.distanceNum >= 0 ? a.distanceNum : 999999;
        const distB = b.distanceNum >= 0 ? b.distanceNum : 999999;
        return distA - distB;
    });

    const filterOptions = [
        { id: 'all', label: t('allTypes'), icon: Icons.Layers },
        { id: 'nearby', label: t('nearbyFilter'), icon: Icons.Navigation },
        { id: 'medical', label: t('medicalFilter'), icon: Icons.Medical },
        { id: 'fire', label: t('fireFilter'), icon: Icons.Flame },
        { id: 'police', label: t('policeFilter'), icon: Icons.ShieldCheck },
        { id: 'shelter', label: t('shelterFilter'), icon: Icons.Tent },
    ];

    const urgencyOptions = [
        { id: 'Low', label: t('lowUrgency'), icon: Icons.CheckCircle, color: 'text-green-500' },
        { id: 'Medium', label: t('mediumUrgency'), icon: Icons.AlertTriangle, color: 'text-yellow-500' },
        { id: 'High', label: t('highUrgency'), icon: Icons.AlertTriangle, color: 'text-orange-500' },
        { id: 'Critical', label: t('criticalUrgency'), icon: Icons.Zap, color: 'text-red-600' }
    ];

    // --- Actions ---

    const handleAdd = () => {
        setEditingResource(null);
        setShowForm(true);
    };

    const handleEdit = (r: Resource, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingResource(r);
        setShowForm(true);
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(t('deleteItemConfirm'))) {
            await deleteResource(id);
            alert(t('deletedSuccessfully'));
            loadData();
            if (selectedResource?.id === id) setSelectedResource(null);
        }
    };

    const handleShare = async (r: Resource, e: React.MouseEvent) => {
        e.stopPropagation();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: r.name,
                    text: `${r.name} - ${r.address} (${r.phone})`,
                    url: window.location.href
                });
            } catch (err) { console.log('Share error', err); }
        } else {
            alert(t('shareNotSupported'));
        }
    };

    const handlePrint = (r: Resource, e: React.MouseEvent) => {
        e.stopPropagation();
        const win = window.open('', '', 'width=600,height=600');
        if (win) {
            win.document.write(`<html><head><title>${r.name}</title></head><body><h1>${r.name}</h1><p>${r.address}</p><p>Phone: ${r.phone}</p><p>${r.description}</p></body></html>`);
            win.document.close();
            win.print();
        }
    };

    const handleQR = (r: Resource, e: React.MouseEvent) => {
        e.stopPropagation();
        setShowQR(r);
    };

    // --- Modals ---

    if (showForm) {
        return (
            <div className="p-4 pt-8 h-screen bg-gray-50 absolute inset-0 z-50">
                <ResourceForm 
                    initialData={editingResource}
                    onCancel={() => setShowForm(false)}
                    onSuccess={() => { setShowForm(false); loadData(); }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col pb-24 p-4 min-h-screen relative">
            <h1 className="text-2xl font-bold mb-4 flex justify-between items-center">
                {t('resourceHub')}
                <button onClick={handleAdd} className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shadow-lg">
                    <Icons.Plus size={18} />
                </button>
            </h1>

            {/* Search & Sort */}
            <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                    <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder={t('searchResourcesPlaceholder')} 
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:border-black"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => setSortBy(sortBy === 'distance' ? 'name' : 'distance')}
                    className="px-4 bg-white border border-gray-300 rounded-xl flex items-center justify-center gap-2 font-medium text-sm text-gray-700 whitespace-nowrap min-w-[110px] shadow-sm active:scale-95 transition-all"
                >
                    {sortBy === 'distance' ? <Icons.MapPin size={16} className="text-blue-600"/> : <Icons.FileText size={16} className="text-gray-500"/>}
                    <span>Sort: {sortBy === 'distance' ? 'Dist' : 'Name'}</span>
                </button>
            </div>

            {/* Type Filters (Icons) */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar mb-4 pb-2 px-1">
                {filterOptions.map(f => {
                    const isActive = filters.includes(f.id);
                    const Icon = f.icon;
                    return (
                        <button
                            key={f.id}
                            onClick={() => toggleFilter(f.id)}
                            title={f.label}
                            className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center flex-shrink-0 transition-all ${
                                isActive 
                                ? 'bg-black text-white border-black shadow-lg scale-105' 
                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <Icon size={20} />
                        </button>
                    );
                })}
            </div>

            {/* Urgency Filter (Icons) */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar mb-6 pb-2 px-1 items-center">
                <button
                     onClick={() => setUrgencyFilter('all')}
                     title={t('anyUrgency')}
                     className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${
                         urgencyFilter === 'all' ? 'bg-gray-800 text-white border-gray-800 shadow-md' : 'bg-white text-gray-400 border-gray-200'
                     }`}
                >
                    <Icons.Filter size={18} />
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                {urgencyOptions.map(u => {
                    const Icon = u.icon;
                    const isActive = urgencyFilter === u.id;
                    return (
                        <button
                            key={u.id}
                            onClick={() => setUrgencyFilter(u.id)}
                            title={u.label}
                            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${
                                isActive 
                                ? `bg-gray-100 border-gray-300 ${u.color} shadow-md scale-110 ring-2 ring-gray-100`
                                : 'bg-white text-gray-400 border-gray-200'
                            }`}
                        >
                            <Icon size={18} />
                        </button>
                    );
                })}
            </div>

            {/* List */}
            <div className="space-y-4">
                {filteredResources.map(resource => {
                    const occupancyPct = (resource.capacity && resource.occupancy) 
                        ? (resource.occupancy / resource.capacity) * 100 
                        : 0;
                    const isFull = occupancyPct >= 90;

                    return (
                        <div 
                            key={resource.id} 
                            onClick={() => setSelectedResource(resource)}
                            className={`bg-white p-5 rounded-2xl border shadow-sm cursor-pointer hover:border-blue-300 transition-colors relative ${
                                resource.urgency === 'Critical' ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'
                            }`}
                        >
                            {/* Urgency Tag (Top Right) */}
                            {resource.urgency && resource.urgency !== 'Low' && (
                                <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl rounded-tr-xl text-[10px] font-bold uppercase ${
                                    resource.urgency === 'Critical' ? 'bg-red-100 text-red-600' :
                                    resource.urgency === 'High' ? 'bg-orange-100 text-orange-600' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                    {resource.urgency}
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-2 mt-1">
                                <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                                    {resource.type}
                                </span>
                                {userLoc && resource.distanceNum !== undefined && resource.distanceNum >= 0 && (
                                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100">
                                        {resource.distanceNum < 1 
                                            ? `${Math.round(resource.distanceNum * 1000)}m` 
                                            : `${resource.distanceNum.toFixed(1)} km`}
                                    </span>
                                )}
                            </div>
                            
                            {/* Name & Flood Indicator */}
                            <div className="flex items-center gap-2 mb-1 pr-12 flex-wrap">
                                <h3 className="font-bold text-lg leading-tight">{resource.name}</h3>
                                {resource.inFloodZone && resource.type === 'shelter' && (
                                    <div className="text-blue-500 bg-blue-50 p-1 rounded-full border border-blue-100 shrink-0 shadow-sm" title={t('locatedInFloodZone')}>
                                        <Icons.CloudRain size={14} strokeWidth={2.5} />
                                    </div>
                                )}
                            </div>

                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{resource.description || 'No description available.'}</p>

                            {/* Capacity Bar */}
                            {(resource.type === 'shelter' || resource.type === 'medical') && resource.capacity && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium text-gray-500">Occupancy</span>
                                        <span className={`font-bold ${isFull ? 'text-red-500' : 'text-green-600'}`}>
                                            {resource.occupancy} / {resource.capacity}
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-green-500'}`}
                                            style={{ width: `${occupancyPct}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-2 text-sm text-gray-600 mb-3">
                                <div className="flex items-center gap-3">
                                    <Icons.MapPin size={16} className="shrink-0" />
                                    <span className="truncate">{resource.address}</span>
                                </div>
                                {resource.operatingHours && (
                                    <div className="flex items-center gap-3">
                                        <Icons.Calendar size={16} className="shrink-0" />
                                        <span className="truncate">{resource.operatingHours}</span>
                                    </div>
                                )}
                            </div>

                            {/* Contact Info Indicator */}
                            {(resource.contactPerson || resource.contactPhone) && (
                                <div className="absolute bottom-4 right-4 text-blue-600 bg-blue-50 p-1.5 rounded-lg" title={t('contactInfoAvailable')}>
                                    <Icons.User size={14} />
                                </div>
                            )}

                            {/* Action Bar */}
                            <div className="flex items-center gap-1 border-t border-gray-100 pt-3 mt-3">
                                <button onClick={(e) => handleEdit(resource, e)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Icons.Edit size={16}/></button>
                                <button onClick={(e) => handleDelete(resource.id, e)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Icons.Trash size={16}/></button>
                                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                <button onClick={(e) => handlePrint(resource, e)} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg"><Icons.Printer size={16}/></button>
                                <button onClick={(e) => handleQR(resource, e)} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg"><Icons.QrCode size={16}/></button>
                                <button onClick={(e) => handleShare(resource, e)} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg"><Icons.Share size={16}/></button>
                            </div>
                        </div>
                    );
                })}
                {filteredResources.length === 0 && <div className="text-center text-gray-400 py-12">No resources found matching filters.</div>}
            </div>

            {/* --- DETAILS MODAL --- */}
            {selectedResource && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full h-[90vh] sm:h-auto sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
                        {/* Map Header */}
                        <div className="h-48 relative bg-gray-100">
                             <IncidentMap 
                                reports={[selectedResource]} 
                                centerLat={selectedResource.lat} 
                                centerLng={selectedResource.lng} 
                             />
                             <button 
                                onClick={() => setSelectedResource(null)}
                                className="absolute top-4 right-4 bg-white/90 p-2 rounded-full shadow-md z-[400]"
                             >
                                <Icons.X size={20} />
                             </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex gap-2">
                                    <span className="text-xs font-bold uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                        {selectedResource.type}
                                    </span>
                                    {selectedResource.urgency && selectedResource.urgency !== 'Low' && (
                                        <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                                            selectedResource.urgency === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                        }`}>
                                            {selectedResource.urgency}
                                        </span>
                                    )}
                                </div>
                                {selectedResource.distanceNum !== undefined && selectedResource.distanceNum >= 0 && (
                                    <span className="text-xs font-bold text-gray-500">
                                        {selectedResource.distanceNum < 1 
                                            ? `${Math.round(selectedResource.distanceNum * 1000)}m` 
                                            : `${selectedResource.distanceNum.toFixed(1)} km`} away
                                    </span>
                                )}
                            </div>
                            <h2 className="text-2xl font-bold mb-1">{selectedResource.name}</h2>
                            
                            {selectedResource.inFloodZone && (
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 border border-blue-200 text-blue-700 rounded-full text-xs font-bold mb-4 shadow-sm">
                                    <Icons.CloudRain size={12} />
                                    {t('locatedInFloodZone')}
                                </div>
                            )}

                            <div className="space-y-4 mb-6 mt-2">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                        <Icons.MapPin size={16} />
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-900 font-medium">{selectedResource.address}</div>
                                        <div className="text-xs text-gray-500">Lat: {selectedResource.lat.toFixed(4)}, Lng: {selectedResource.lng.toFixed(4)}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                        <Icons.Phone size={16} />
                                    </div>
                                    <div className="text-sm text-gray-900 font-medium">{selectedResource.phone}</div>
                                </div>
                                {selectedResource.operatingHours && (
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                            <Icons.Calendar size={16} />
                                        </div>
                                        <div className="text-sm text-gray-900 font-medium">{selectedResource.operatingHours}</div>
                                    </div>
                                )}
                                
                                <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700">
                                    <h4 className="font-bold text-xs text-gray-400 uppercase mb-1">Details</h4>
                                    {selectedResource.description || 'No additional details provided.'}
                                </div>

                                {selectedResource.notes && (
                                    <div className="p-4 bg-yellow-50 rounded-xl text-sm text-gray-700 border border-yellow-100">
                                        <h4 className="font-bold text-xs text-yellow-600 uppercase mb-1">Admin Notes</h4>
                                        {selectedResource.notes}
                                    </div>
                                )}

                                {(selectedResource.contactPerson || selectedResource.contactPhone) && (
                                    <div className="p-4 bg-blue-50 rounded-xl text-sm border border-blue-100">
                                        <h4 className="font-bold text-xs text-blue-600 uppercase mb-2">Point of Contact</h4>
                                        <div className="flex flex-col gap-1">
                                            {selectedResource.contactPerson && <span className="font-medium text-gray-900">Name: {selectedResource.contactPerson}</span>}
                                            {selectedResource.contactPhone && <span className="font-mono text-gray-700">Tel: {selectedResource.contactPhone}</span>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <a 
                                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedResource.lat},${selectedResource.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-4 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
                            >
                                <Icons.MapPin size={20} /> Get Directions
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* --- QR MODAL --- */}
            {showQR && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl relative">
                        <button onClick={() => setShowQR(null)} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full"><Icons.X size={20} /></button>
                        <h3 className="font-bold text-lg mb-4">Resource QR Code</h3>
                        
                        <div className="bg-white border-2 border-gray-100 p-4 rounded-xl inline-block mb-4 shadow-inner">
                             <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify({id: showQR.id, type: 'resource'}))}`} 
                                alt="QR" 
                                className="w-48 h-48 mix-blend-multiply" 
                            />
                        </div>
                        <p className="text-sm font-bold">{showQR.name}</p>
                        <p className="text-xs text-gray-500 mb-6">{showQR.address}</p>
                        
                        <button className="w-full py-3 bg-gray-100 text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200">
                            <Icons.Download size={18} /> Download
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Resources;
