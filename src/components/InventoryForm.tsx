
import React, { useState, useEffect } from 'react';
import { Icons } from './Icon';
import { InventoryItem } from '../types';
import { submitInventory } from '../services/api';

interface InventoryFormProps {
    initialData?: InventoryItem | null;
    onCancel: () => void;
    onSuccess: () => void;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ initialData, onCancel, onSuccess }) => {
    const [item, setItem] = useState('');
    const [category, setCategory] = useState<'Medical' | 'Food' | 'Equipment' | 'Water'>('Equipment');
    const [quantity, setQuantity] = useState(0);
    const [unit, setUnit] = useState('Units');
    const [status, setStatus] = useState<'Good' | 'Low' | 'Critical'>('Good');
    const [location, setLocation] = useState('');

    useEffect(() => {
        if (initialData) {
            setItem(initialData.item);
            setCategory(initialData.category);
            setQuantity(initialData.quantity);
            setUnit(initialData.unit);
            setStatus(initialData.status);
            setLocation(initialData.location);
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitInventory({
            id: initialData?.id,
            item, category, quantity, unit, status, location
        });
        onSuccess();
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Icons.Box className="text-blue-600" size={24} />
                    {initialData ? 'Edit Inventory' : 'Add Stock'}
                </h2>
                <button onClick={onCancel} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                    <Icons.X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Name</label>
                    <input type="text" value={item} onChange={e => setItem(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm" required />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full p-3 rounded-xl border border-gray-300 text-sm bg-white">
                            <option>Medical</option>
                            <option>Food</option>
                            <option>Equipment</option>
                            <option>Water</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                        <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm" placeholder="e.g. Warehouse A" required />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity</label>
                        <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full p-3 rounded-xl border border-gray-300 text-sm" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unit</label>
                        <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm" placeholder="e.g. Packs" required />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full p-3 rounded-xl border border-gray-300 text-sm bg-white">
                        <option value="Good">Good</option>
                        <option value="Low">Low</option>
                        <option value="Critical">Critical</option>
                    </select>
                </div>

                <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-lg mt-4">
                    Save Inventory
                </button>
            </form>
        </div>
    );
};

export default InventoryForm;
