
import React, { useState, useEffect } from 'react';
import { Icons } from './Icon';
import { ThemeSettings as ThemeSettingsType } from '../types';

interface ThemeSettingsProps {
    settings: ThemeSettingsType;
    onUpdate: (settings: ThemeSettingsType) => void;
    onClose: () => void;
}

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ settings, onUpdate, onClose }) => {
    const [draft, setDraft] = useState<ThemeSettingsType>(settings);

    useEffect(() => {
        setDraft(settings);
    }, [settings]);

    const handleChange = (key: keyof ThemeSettingsType, value: unknown) => {
        setDraft(prev => ({ ...prev, [key]: value }));
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleChange('logoUrl', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        onUpdate(draft);
        onClose();
    };

    const colors = [
        { id: '#000000', label: 'Black' },
        { id: '#2563eb', label: 'Blue' }, // blue-600
        { id: '#16a34a', label: 'Green' }, // green-600
        { id: '#9333ea', label: 'Purple' }, // purple-600
        { id: '#dc2626', label: 'Red' }, // red-600
    ];

    const bgColors = [
        { id: '#f8f9fa', label: 'Default Gray' },
        { id: '#ffffff', label: 'White' },
        { id: '#fdf2f8', label: 'Soft Pink' },
        { id: '#f0f9ff', label: 'Soft Blue' },
        { id: '#fffbeb', label: 'Soft Yellow' },
        { id: '#f3e8ff', label: 'Soft Purple' },
    ];

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full sm:max-w-md h-[85vh] sm:h-auto sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Icons.Palette size={20} className="text-purple-600" />
                        App Customization
                    </h2>
                    <button onClick={onClose} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300" aria-label="Cancel and close">
                        <Icons.X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    
                    {/* Branding */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">App Name & Logo</label>
                        <input 
                            type="text" 
                            value={draft.appName} 
                            onChange={(e) => handleChange('appName', e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-300 mb-3 text-sm font-bold"
                            placeholder="App Name"
                        />
                         <div className="relative flex items-center gap-3 p-3 border border-dashed border-gray-300 rounded-xl bg-gray-50 cursor-pointer hover:bg-gray-100">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                {draft.logoUrl ? (
                                    <img src={draft.logoUrl} alt="Logo" className="w-full h-full object-cover"/>
                                ) : (
                                    <Icons.Image size={20} className="text-gray-500" />
                                )}
                            </div>
                            <span className="text-sm text-gray-500">{draft.logoUrl ? 'Change Logo' : 'Upload Custom Logo'}</span>
                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                    </div>

                    {/* Theme Mode: Light / Dark / System */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Theme Mode</label>
                        <p className="text-xs text-gray-500 mb-3">Choose light, dark, or follow your device</p>
                        <div className="grid grid-cols-3 gap-2">
                            <button 
                                type="button"
                                onClick={() => handleChange('themeMode', 'light')}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                    (draft.themeMode ?? (draft.darkMode ? 'dark' : 'light')) === 'light' 
                                        ? 'border-yellow-500 bg-yellow-50' 
                                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                }`}
                            >
                                <Icons.Sun size={24} className="text-yellow-600" />
                                <span className="text-xs font-medium text-gray-900">Light</span>
                            </button>
                            <button 
                                type="button"
                                onClick={() => handleChange('themeMode', 'dark')}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                    (draft.themeMode ?? (draft.darkMode ? 'dark' : 'light')) === 'dark' 
                                        ? 'border-blue-600 bg-blue-50' 
                                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                }`}
                            >
                                <Icons.Moon size={24} className="text-blue-600" />
                                <span className="text-xs font-medium text-gray-900">Dark</span>
                            </button>
                            <button 
                                type="button"
                                onClick={() => handleChange('themeMode', 'system')}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                    (draft.themeMode ?? 'system') === 'system' 
                                        ? 'border-purple-600 bg-purple-50' 
                                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                }`}
                            >
                                <Icons.Settings size={24} className="text-purple-600" />
                                <span className="text-xs font-medium text-gray-900">System</span>
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">System follows your device light/dark preference</p>
                    </div>

                    {/* Primary Color */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Primary Color</label>
                        <div className="flex gap-3 justify-between">
                            {colors.map(c => (
                                <button 
                                    key={c.id}
                                    onClick={() => handleChange('primaryColor', c.id)}
                                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-transform active:scale-95 ${draft.primaryColor === c.id ? 'border-gray-400 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c.id }}
                                >
                                    {draft.primaryColor === c.id && <Icons.Check color="white" size={16} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Background Color */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Background Color (Light Mode)</label>
                        <div className="grid grid-cols-6 gap-2">
                            {bgColors.map(c => (
                                <button 
                                    key={c.id}
                                    onClick={() => handleChange('backgroundColor', c.id)}
                                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-transform active:scale-95 ${draft.backgroundColor === c.id ? 'border-gray-800 scale-110' : 'border-gray-200'}`}
                                    style={{ backgroundColor: c.id }}
                                    title={c.label}
                                >
                                    {draft.backgroundColor === c.id && <Icons.Check className="text-black" size={16} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Typography */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Typography</label>
                        <div className="space-y-2">
                            <button 
                                onClick={() => handleChange('fontFamily', 'inter')}
                                className={`w-full p-3 rounded-xl border text-left text-sm font-sans flex justify-between items-center ${draft.fontFamily === 'inter' ? 'border-black bg-gray-50' : 'border-gray-200'}`}
                            >
                                <span>Modern Sans (Inter)</span>
                                {draft.fontFamily === 'inter' && <Icons.Check size={16} />}
                            </button>
                            <button 
                                onClick={() => handleChange('fontFamily', 'roboto')}
                                className={`w-full p-3 rounded-xl border text-left text-sm font-roboto flex justify-between items-center ${draft.fontFamily === 'roboto' ? 'border-black bg-gray-50' : 'border-gray-200'}`}
                            >
                                <span>Geometric (Roboto)</span>
                                {draft.fontFamily === 'roboto' && <Icons.Check size={16} />}
                            </button>
                            <button 
                                onClick={() => handleChange('fontFamily', 'serif')}
                                className={`w-full p-3 rounded-xl border text-left text-sm font-serif flex justify-between items-center ${draft.fontFamily === 'serif' ? 'border-black bg-gray-50' : 'border-gray-200'}`}
                            >
                                <span>Classic Serif (Playfair)</span>
                                {draft.fontFamily === 'serif' && <Icons.Check size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* SEO */}
                    <div className="flex items-center justify-between p-4 border rounded-xl bg-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                                <Icons.Globe size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm">SEO Optimization</h4>
                                <p className="text-xs text-gray-500">Enhance discoverability</p>
                            </div>
                        </div>
                        <div 
                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${draft.enableSeo ? 'bg-green-500' : 'bg-gray-300'}`}
                            onClick={() => handleChange('enableSeo', !draft.enableSeo)}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${draft.enableSeo ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>

                </div>
                
                <div className="p-4 border-t bg-gray-50 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="flex-1 py-3 text-white rounded-xl font-bold shadow-lg" style={{ backgroundColor: draft.primaryColor }}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ThemeSettings;
