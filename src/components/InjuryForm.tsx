
import React, { useState, useEffect } from 'react';
import { Icons } from './Icon';
import { InjuryCase } from '../types';
import { submitInjury } from '../services/api';

interface InjuryFormProps {
    initialData?: InjuryCase | null;
    onCancel: () => void;
    onSuccess: () => void;
}

const InjuryForm: React.FC<InjuryFormProps> = ({ initialData, onCancel, onSuccess }) => {
    const [name, setName] = useState('');
    const [triageLevel, setTriageLevel] = useState<'Black' | 'Red' | 'Yellow' | 'Green'>('Green');
    const [condition, setCondition] = useState('');
    const [location, setLocation] = useState('');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setTriageLevel(initialData.triageLevel);
            setCondition(initialData.condition);
            setLocation(initialData.location);
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitInjury({
            id: initialData?.id,
            name, triageLevel, condition, location,
            timestamp: initialData?.timestamp || new Date().toLocaleTimeString()
        });
        onSuccess();
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Icons.Medical className="text-red-500" size={24} />
                    {initialData ? 'Edit Case' : 'New Injury Report'}
                </h2>
                <button onClick={onCancel} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                    <Icons.X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject Name / Code</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm" placeholder="Anonymous or Code-12" required />
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Triage Level</label>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {['Black', 'Red', 'Yellow', 'Green'].map((level) => (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setTriageLevel(level as any)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                    triageLevel === level 
                                    ? level === 'Red' ? 'bg-red-500 text-white' 
                                      : level === 'Yellow' ? 'bg-yellow-400 text-black' 
                                      : level === 'Green' ? 'bg-green-500 text-white' 
                                      : 'bg-black text-white'
                                    : 'text-gray-500 hover:bg-white'
                                }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Condition</label>
                    <input type="text" value={condition} onChange={e => setCondition(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm" placeholder="e.g. Burn, Fracture" required />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location Found</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm" placeholder="e.g. Sector 4" required />
                </div>

                <button type="submit" className="w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-lg mt-4">
                    Save Medical Report
                </button>
            </form>
        </div>
    );
};

export default InjuryForm;
