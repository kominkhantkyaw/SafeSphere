
import React, { useState, useEffect } from 'react';
import { Icons } from './Icon';
import { User } from '../types';
import { saveUser } from '../services/api';

interface UserFormProps {
    initialData?: User | null;
    onCancel: () => void;
    onSuccess: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ initialData, onCancel, onSuccess }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<'Admin' | 'Responder' | 'Viewer' | 'Reporter'>('Viewer');
    
    // New Fields
    const [avatar, setAvatar] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [bloodType, setBloodType] = useState('Unknown');
    const [skills, setSkills] = useState('');
    const [volunteerPoints, setVolunteerPoints] = useState(0);
    const [permissions, setPermissions] = useState<string[]>([]);
    
    // Emergency Contact
    const [emergencyContactName, setEmergencyContactName] = useState('');
    const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setRole(initialData.role);
            setEmail(initialData.email || '');
            setPhone(initialData.phone || '');
            setAvatar(initialData.avatar || null);
            setBloodType(initialData.bloodType || 'Unknown');
            setSkills(initialData.skills ? initialData.skills.join(', ') : '');
            setVolunteerPoints(initialData.volunteerPoints || 0);
            setPermissions(initialData.permissions || []);
            setEmergencyContactName(initialData.emergencyContactName || '');
            setEmergencyContactPhone(initialData.emergencyContactPhone || '');
        }
    }, [initialData]);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setAvatar(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const togglePermission = (perm: string) => {
        if (permissions.includes(perm)) {
            setPermissions(permissions.filter(p => p !== perm));
        } else {
            setPermissions([...permissions, perm]);
        }
    };

    const handleRemovePassword = () => {
        setPassword('');
        alert("Password field cleared. Save to update.");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveUser({
            id: initialData?.id,
            name, 
            role, 
            email, 
            phone,
            avatar: avatar || undefined,
            password: password || (initialData?.password), 
            skills: skills.split(',').map(s => s.trim()).filter(s => s),
            bloodType: bloodType as any,
            volunteerPoints,
            permissions,
            emergencyContactName,
            emergencyContactPhone
        });
        onSuccess();
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 h-full overflow-y-auto">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Icons.User className="text-purple-600" size={24} />
                    {initialData ? 'Edit Profile' : 'New Profile'}
                </h2>
                <button onClick={onCancel} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                    <Icons.X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pb-4">
                
                {/* Avatar Section */}
                <div className="flex flex-col items-center mb-6">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden mb-2">
                            {avatar ? (
                                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <Icons.User className="text-gray-300" size={40} />
                            )}
                        </div>
                        <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" id="avatar-upload" />
                        <label htmlFor="avatar-upload" className="absolute bottom-2 right-0 p-1 bg-purple-600 text-white rounded-full cursor-pointer hover:bg-purple-700 shadow-md">
                            <Icons.Edit size={14} />
                        </label>
                    </div>
                    <span className="text-xs text-gray-400">Tap pen to upload photo</span>
                </div>

                {/* Core Info */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                        <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full p-3 rounded-xl border border-gray-300 text-sm bg-white">
                            <option value="Admin">Admin</option>
                            <option value="Responder">Responder</option>
                            <option value="Reporter">Reporter</option>
                            <option value="Viewer">Viewer</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Blood Type</label>
                        <select value={bloodType} onChange={e => setBloodType(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 text-sm bg-white">
                            <option value="Unknown">Unknown</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                        </select>
                    </div>
                </div>

                {/* Emergency Contact */}
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <h3 className="text-xs font-bold text-red-600 uppercase mb-3 flex items-center gap-2">
                        <Icons.Phone size={14}/> Emergency Contact
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Contact Name</label>
                            <input 
                                type="text" 
                                value={emergencyContactName} 
                                onChange={e => setEmergencyContactName(e.target.value)} 
                                className="w-full p-2 rounded-lg border text-sm"
                                placeholder="Next of Kin"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Contact Phone</label>
                            <input 
                                type="tel" 
                                value={emergencyContactPhone} 
                                onChange={e => setEmergencyContactPhone(e.target.value)} 
                                className="w-full p-2 rounded-lg border text-sm"
                                placeholder="+1 555..."
                            />
                        </div>
                    </div>
                </div>

                {/* Granular Permissions */}
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                    <h3 className="text-xs font-bold text-orange-700 uppercase mb-3 flex items-center gap-2">
                        <Icons.Key size={14}/>
                        Special Permissions
                    </h3>
                    <div className="space-y-2">
                        <label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-orange-100 cursor-pointer hover:border-orange-300 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={permissions.includes('approve_reports')}
                                onChange={() => togglePermission('approve_reports')}
                                className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                            />
                            <div className="flex items-center gap-2">
                                <Icons.CheckCircle size={16} className="text-green-500"/>
                                <span className="text-sm font-medium text-gray-800">Approve Reports</span>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-orange-100 cursor-pointer hover:border-orange-300 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={permissions.includes('request_info')}
                                onChange={() => togglePermission('request_info')}
                                className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                            />
                            <div className="flex items-center gap-2">
                                <Icons.HelpCircle size={16} className="text-blue-500"/>
                                <span className="text-sm font-medium text-gray-800">Request Information</span>
                            </div>
                        </label>
                         <label className="flex items-center gap-3 p-2 bg-white rounded-lg border border-orange-100 cursor-pointer hover:border-orange-300 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={permissions.includes('edit_resources')}
                                onChange={() => togglePermission('edit_resources')}
                                className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                            />
                            <div className="flex items-center gap-2">
                                <Icons.Edit size={16} className="text-gray-500"/>
                                <span className="text-sm font-medium text-gray-800">Edit Resources</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Skills</label>
                    <input 
                        type="text" 
                        value={skills} 
                        onChange={e => setSkills(e.target.value)} 
                        className="w-full p-3 rounded-xl border border-gray-300 text-sm" 
                        placeholder="CPR, Driving, First Aid (comma separated)"
                    />
                </div>

                {/* Account Details */}
                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                    <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Icons.Settings size={12}/> Account Settings
                    </h3>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 rounded-lg border text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Phone</label>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 rounded-lg border text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                            {initialData ? 'Change Password' : 'Password'}
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="w-full p-2 rounded-lg border text-sm" 
                                placeholder={initialData ? 'Leave blank to keep current' : 'Enter password'}
                                required={!initialData}
                            />
                            {initialData && (
                                <button 
                                    type="button" 
                                    onClick={handleRemovePassword}
                                    className="p-2 bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
                                    title="Clear Password"
                                >
                                    <Icons.Unlock size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Volunteer Points</label>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setVolunteerPoints(Math.max(0, volunteerPoints - 10))} className="p-3 bg-gray-100 rounded-lg font-bold">-</button>
                        <input type="number" value={volunteerPoints} onChange={e => setVolunteerPoints(Number(e.target.value))} className="flex-1 p-3 rounded-xl border border-gray-300 text-center font-bold" />
                        <button type="button" onClick={() => setVolunteerPoints(volunteerPoints + 10)} className="p-3 bg-gray-100 rounded-lg font-bold">+</button>
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                    <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm">
                        Cancel
                    </button>
                    <button type="submit" className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 shadow-lg">
                        Save Profile
                    </button>
                </div>
            </form>
        </div>
    );
};

export default UserForm;
