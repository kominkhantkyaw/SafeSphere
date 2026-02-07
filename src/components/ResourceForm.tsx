
import React, { useState, useEffect } from 'react';
import { Icons } from './Icon';
import { submitResource } from '../services/api';
import { Resource } from '../types';

interface ResourceFormProps {
    onCancel: () => void;
    onSuccess: () => void;
    initialData?: Resource | null;
}

const ResourceForm: React.FC<ResourceFormProps> = ({ onCancel, onSuccess, initialData }) => {
    const [loading, setLoading] = useState(false);
    
    // Form Fields
    const [name, setName] = useState('');
    const [type, setType] = useState<'medical' | 'fire' | 'police' | 'shelter'>('shelter');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [description, setDescription] = useState('');
    const [capacity, setCapacity] = useState<number>(0);
    const [occupancy, setOccupancy] = useState<number>(0);
    const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
    const [locating, setLocating] = useState(false);
    
    // New Fields
    const [operatingHours, setOperatingHours] = useState('');
    const [notes, setNotes] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [urgency, setUrgency] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Low');
    const [inFloodZone, setInFloodZone] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setType(initialData.type);
            setAddress(initialData.address);
            setPhone(initialData.phone);
            setDescription(initialData.description || '');
            setCapacity(initialData.capacity || 0);
            setOccupancy(initialData.occupancy || 0);
            setLocation({ lat: initialData.lat, lng: initialData.lng });
            
            setOperatingHours(initialData.operatingHours || '');
            setNotes(initialData.notes || '');
            setContactPerson(initialData.contactPerson || '');
            setContactPhone(initialData.contactPhone || '');
            setUrgency(initialData.urgency || 'Low');
            setInFloodZone(initialData.inFloodZone || false);
        }
    }, [initialData]);

    const handleGetLocation = () => {
        setLocating(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setLocating(false);
            }, (error) => {
                console.error("Error getting location", error);
                setLocating(false);
                // Mock location (Yangon, Myanmar)
                setLocation({ lat: 16.8661, lng: 96.1951 }); 
            });
        } else {
            setLocating(false);
            setLocation({ lat: 16.8661, lng: 96.1951 });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!location) {
            alert("Please set a location.");
            return;
        }

        setLoading(true);
        const resourceData: Partial<Resource> = {
            id: initialData?.id,
            name,
            type,
            address,
            phone,
            description,
            lat: location.lat,
            lng: location.lng,
            capacity: (type === 'shelter' || type === 'medical') ? capacity : undefined,
            occupancy: (type === 'shelter' || type === 'medical') ? occupancy : undefined,
            operatingHours,
            notes,
            contactPerson,
            contactPhone,
            urgency,
            inFloodZone
        };

        const success = await submitResource(resourceData);
        setLoading(false);
        if (success) {
            onSuccess();
        } else {
            alert("Failed to save resource.");
        }
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Icons.Resources className="text-blue-600" size={24} />
                    {initialData ? 'Edit Resource' : 'Add Resource'}
                </h2>
                <button onClick={onCancel} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                    <Icons.X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pb-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Resource Name</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                        placeholder="e.g. Central Hospital"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                        <select 
                            value={type} 
                            onChange={e => setType(e.target.value as any)} 
                            className="w-full p-3 rounded-xl border border-gray-300 text-sm bg-white"
                        >
                            <option value="medical">Medical</option>
                            <option value="fire">Fire</option>
                            <option value="police">Police</option>
                            <option value="shelter">Shelter</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Public Phone</label>
                        <input 
                            type="tel" 
                            value={phone} 
                            onChange={e => setPhone(e.target.value)} 
                            className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                            placeholder="555-0123"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address</label>
                    <input 
                        type="text" 
                        value={address} 
                        onChange={e => setAddress(e.target.value)} 
                        className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                        placeholder="123 Safety Blvd"
                        required
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                    <button 
                        type="button" 
                        onClick={handleGetLocation}
                        className={`w-full p-3 rounded-xl border border-dashed flex items-center justify-between transition-colors ${
                            location ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            {location ? <Icons.Check size={16} /> : <Icons.MapPin size={16} />}
                            <span className="text-sm font-medium">{location ? 'Location Set' : 'Get GPS Location'}</span>
                        </div>
                        {location && <span className="text-xs font-mono">{location.lat.toFixed(5)}, {location?.lng.toFixed(5)}</span>}
                    </button>
                </div>

                {/* Urgency Selection */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Operational Urgency</label>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {['Low', 'Medium', 'High', 'Critical'].map((level) => (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setUrgency(level as any)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                    urgency === level 
                                    ? level === 'Critical' ? 'bg-red-600 text-white shadow'
                                      : level === 'High' ? 'bg-orange-500 text-white shadow'
                                      : 'bg-white text-black shadow'
                                    : 'text-gray-500'
                                }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Flood Zone Checkbox */}
                {type === 'shelter' && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <input 
                            type="checkbox" 
                            id="floodZone" 
                            checked={inFloodZone} 
                            onChange={(e) => setInFloodZone(e.target.checked)} 
                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="floodZone" className="text-sm font-bold text-blue-800">
                            Located in Flood Zone?
                        </label>
                    </div>
                )}

                {/* Operating Hours */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Operating Hours</label>
                    <input 
                        type="text" 
                        value={operatingHours} 
                        onChange={e => setOperatingHours(e.target.value)} 
                        className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                        placeholder="e.g. 24/7 or Mon-Fri 08:00-18:00"
                    />
                </div>

                {/* Contact Person */}
                <div className="bg-blue-50 p-4 rounded-xl space-y-3">
                     <h3 className="text-xs font-bold text-blue-600 uppercase">Point of Contact (Optional)</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Contact Name</label>
                            <input 
                                type="text" 
                                value={contactPerson} 
                                onChange={e => setContactPerson(e.target.value)} 
                                className="w-full p-2 rounded-lg border text-sm"
                                placeholder="Manager Name"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Contact Phone</label>
                            <input 
                                type="tel" 
                                value={contactPhone} 
                                onChange={e => setContactPhone(e.target.value)} 
                                className="w-full p-2 rounded-lg border text-sm"
                                placeholder="Direct Line"
                            />
                        </div>
                     </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                    <textarea 
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        className="w-full p-3 rounded-xl border border-gray-300 text-sm h-20 resize-none"
                        placeholder="Public facing details..."
                    />
                </div>

                {/* Admin Notes */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Admin Notes (Private)</label>
                    <textarea 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        className="w-full p-3 rounded-xl border border-gray-300 text-sm h-16 resize-none bg-yellow-50"
                        placeholder="Internal remarks, special instructions..."
                    />
                </div>

                {(type === 'shelter' || type === 'medical') && (
                    <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase">Capacity Management</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Capacity</label>
                                <input 
                                    type="number" 
                                    value={capacity} 
                                    onChange={e => setCapacity(Number(e.target.value))} 
                                    className="w-full p-2 rounded-lg border text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Occupancy</label>
                                <input 
                                    type="number" 
                                    value={occupancy} 
                                    onChange={e => setOccupancy(Number(e.target.value))} 
                                    className="w-full p-2 rounded-lg border text-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-4">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-black text-white font-bold text-sm hover:bg-gray-800 shadow-lg"
                    >
                        {loading ? 'Saving...' : 'Save Resource'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ResourceForm;
