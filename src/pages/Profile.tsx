import React, { useState } from 'react';
import { Icons } from '../components/Icon';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileProps {
    onBack?: () => void;
}

const Profile: React.FC<ProfileProps> = ({ onBack }) => {
    const { user, updateUser } = useUser();
    const { t } = useLanguage();
    const [isEditing, setIsEditing] = useState(false);
    const [editedUser, setEditedUser] = useState(user || {});
    const [activeSection, setActiveSection] = useState<'profile' | 'stats' | 'skills'>('profile');
    const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
    const [showAvatarConfirm, setShowAvatarConfirm] = useState(false);

    if (!user) return null;

    const handleSave = () => {
        if (confirm(t('areYouSure'))) {
            updateUser(editedUser);
            setIsEditing(false);
            alert(t('savedSuccessfully'));
        }
    };

    const handleCancel = () => {
        setEditedUser(user);
        setIsEditing(false);
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPendingAvatar(reader.result as string);
                setShowAvatarConfirm(true);
            };
            reader.readAsDataURL(file);
        }
        // Reset file input
        e.target.value = '';
    };

    const handleSaveAvatar = () => {
        if (pendingAvatar) {
            setEditedUser({ ...editedUser, avatar: pendingAvatar });
            updateUser({ ...user, avatar: pendingAvatar });
            setPendingAvatar(null);
            setShowAvatarConfirm(false);
        }
    };

    const handleCancelAvatar = () => {
        setPendingAvatar(null);
        setShowAvatarConfirm(false);
    };

    const addSkill = () => {
        const newSkill = prompt('Enter new skill:');
        if (newSkill) {
            const skills = editedUser.skills || [];
            setEditedUser({ ...editedUser, skills: [...skills, newSkill] });
        }
    };

    const removeSkill = (skillToRemove: string) => {
        const skills = (editedUser.skills || []).filter(s => s !== skillToRemove);
        setEditedUser({ ...editedUser, skills });
    };

    const handleDeleteAvatar = () => {
        if (confirm(t('areYouSure'))) {
            setEditedUser({ ...editedUser, avatar: undefined });
            if (!isEditing) {
                updateUser({ ...user, avatar: undefined });
            }
        }
    };

    const triggerFileInput = () => {
        document.getElementById('avatar-upload')?.click();
    };

    return (
        <div className="bg-gradient-to-b from-gray-50 to-white pb-24 sm:pb-28">
            {/* Header with Avatar */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 pt-6 pb-24 px-4 sm:px-6 safe-top">
                <div className="flex flex-col items-center">
                    <div className="relative group">
                        <div className="w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-white">
                            {editedUser.avatar ? (
                                <img src={editedUser.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 text-white text-4xl font-bold">
                                    {(user?.name ?? '?').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        
                        {/* Image Edit Buttons - Always Visible */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                            <button
                                onClick={triggerFileInput}
                                className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all active:scale-95 border-2 border-gray-200"
                                title="Upload/Change Image"
                            >
                                <Icons.Camera size={18} className="text-blue-600" />
                            </button>
                            {editedUser.avatar && (
                                <button
                                    onClick={handleDeleteAvatar}
                                    className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-red-50 transition-all active:scale-95 border-2 border-red-200"
                                    title="Delete Image"
                                >
                                    <Icons.Trash size={18} className="text-red-600" />
                                </button>
                            )}
                        </div>
                        <input 
                            id="avatar-upload"
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleAvatarChange} 
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-white mt-4">{user.name}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            user.role === 'Admin' ? 'bg-red-500 text-white' :
                            user.role === 'Responder' ? 'bg-green-500 text-white' :
                            'bg-blue-500 text-white'
                        }`}>
                            {user.role}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="px-4 sm:px-6 -mt-16 mb-6 max-w-2xl mx-auto">
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-2xl shadow-lg p-4 text-center">
                        <div className="text-3xl font-bold text-blue-600">{user.safetyScore || 0}</div>
                        <div className="text-xs text-gray-500 mt-1">Safety Score</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-4 text-center">
                        <div className="text-3xl font-bold text-purple-600">{user.xp || 0}</div>
                        <div className="text-xs text-gray-500 mt-1">XP Points</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-4 text-center">
                        <div className="text-3xl font-bold text-green-600">{user.volunteerPoints || 0}</div>
                        <div className="text-xs text-gray-500 mt-1">Volunteer</div>
                    </div>
                </div>
            </div>

            {/* Section Tabs */}
            <div className="px-4 sm:px-6 mb-6 max-w-2xl mx-auto">
                <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
                    <button
                        onClick={() => setActiveSection('profile')}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all touch-manipulation min-h-[44px] ${
                            activeSection === 'profile'
                                ? 'bg-white text-gray-900 shadow-md'
                                : 'text-gray-500'
                        }`}
                    >
                        {t('profile')}
                    </button>
                    <button
                        onClick={() => setActiveSection('stats')}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all touch-manipulation min-h-[44px] ${
                            activeSection === 'stats'
                                ? 'bg-white text-gray-900 shadow-md'
                                : 'text-gray-500'
                        }`}
                    >
                        {t('stats')}
                    </button>
                    <button
                        onClick={() => setActiveSection('skills')}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all touch-manipulation min-h-[44px] ${
                            activeSection === 'skills'
                                ? 'bg-white text-gray-900 shadow-md'
                                : 'text-gray-500'
                        }`}
                    >
                        {t('skills')}
                    </button>
                </div>
            </div>

            {/* Content Sections */}
            <div className="px-4 sm:px-6 space-y-4 max-w-2xl mx-auto">
                {activeSection === 'profile' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Personal Information */}
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">{t('personalInfo')}</h2>
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold"
                                    >
                                        <Icons.Edit size={16} />
                                        {t('edit')}
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCancel}
                                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-semibold"
                                        >
                                            {t('cancel')}
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-semibold"
                                        >
                                            <Icons.Check size={16} />
                                            {t('save')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('fullName')}</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedUser.name || ''}
                                            onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                        />
                                    ) : (
                                        <div className="text-gray-900 font-medium">{user.name}</div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('email')}</label>
                                    {isEditing ? (
                                        <input
                                            type="email"
                                            value={editedUser.email || ''}
                                            onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                        />
                                    ) : (
                                        <div className="text-gray-900 font-medium">{user.email || t('notSet')}</div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('phone')}</label>
                                    {isEditing ? (
                                        <input
                                            type="tel"
                                            value={editedUser.phone || ''}
                                            onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                        />
                                    ) : (
                                        <div className="text-gray-900 font-medium">{user.phone || 'Not set'}</div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Blood Type</label>
                                    {isEditing ? (
                                        <select
                                            value={editedUser.bloodType || 'Unknown'}
                                            onChange={(e) => setEditedUser({ ...editedUser, bloodType: e.target.value as any })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                        >
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
                                    ) : (
                                        <div className="text-gray-900 font-medium">{user.bloodType || 'Unknown'}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contact */}
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Icons.Phone size={20} className="text-red-500" />
                                Emergency Contact
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contact Name</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedUser.emergencyContactName || ''}
                                            onChange={(e) => setEditedUser({ ...editedUser, emergencyContactName: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                        />
                                    ) : (
                                        <div className="text-gray-900 font-medium">{user.emergencyContactName || 'Not set'}</div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contact Phone</label>
                                    {isEditing ? (
                                        <input
                                            type="tel"
                                            value={editedUser.emergencyContactPhone || ''}
                                            onChange={(e) => setEditedUser({ ...editedUser, emergencyContactPhone: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                        />
                                    ) : (
                                        <div className="text-gray-900 font-medium">{user.emergencyContactPhone || 'Not set'}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'stats' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('activityStatistics')}</h2>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                                            <Icons.ShieldCheck size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">{t('safetyScore')}</div>
                                            <div className="text-2xl font-bold text-gray-900">{user.safetyScore || 0}</div>
                                        </div>
                                    </div>
                                    <div className="text-green-600 text-sm font-semibold">+5 this week</div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                                            <Icons.Star size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">{t('experiencePoints')}</div>
                                            <div className="text-2xl font-bold text-gray-900">{user.xp || 0} XP</div>
                                        </div>
                                    </div>
                                    <div className="text-green-600 text-sm font-semibold">+120 this week</div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                                            <Icons.Heart size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">{t('volunteerPoints')}</div>
                                            <div className="text-2xl font-bold text-gray-900">{user.volunteerPoints || 0}</div>
                                        </div>
                                    </div>
                                    <div className="text-green-600 text-sm font-semibold">+8 this month</div>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bars */}
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('levelProgress')}</h2>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-gray-600">{t('nextLevel')}</span>
                                        <span className="font-semibold text-gray-900">{user.xp || 0} / 1000 XP</span>
                                    </div>
                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                                            style={{ width: `${((user.xp || 0) / 1000) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Disaster Preparedness Achievements */}
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Icons.Award size={20} className="text-yellow-500" />
                                Disaster Preparedness Achievements
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border-2 border-yellow-300">
                                    <div className="text-center">
                                        <Icons.Trophy size={32} className="text-yellow-600 mx-auto mb-2" />
                                        <div className="font-bold text-gray-900 text-sm">{t('emergencyKitAchievement')}</div>
                                        <div className="text-xs text-gray-600 mt-1">{t('complete')}</div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300">
                                    <div className="text-center">
                                        <Icons.ShieldCheck size={32} className="text-blue-600 mx-auto mb-2" />
                                        <div className="font-bold text-gray-900 text-sm">{t('firstAidTrained')}</div>
                                        <div className="text-xs text-gray-600 mt-1">{t('certified')}</div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-300">
                                    <div className="text-center">
                                        <Icons.Home size={32} className="text-green-600 mx-auto mb-2" />
                                        <div className="font-bold text-gray-900 text-sm">{t('homeSafety')}</div>
                                        <div className="text-xs text-gray-600 mt-1">Level 5</div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-300">
                                    <div className="text-center">
                                        <Icons.Users size={32} className="text-purple-600 mx-auto mb-2" />
                                        <div className="font-bold text-gray-900 text-sm">Team Leader</div>
                                        <div className="text-xs text-gray-600 mt-1">10+ Drills</div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border-2 border-red-300">
                                    <div className="text-center">
                                        <Icons.Flame size={32} className="text-red-600 mx-auto mb-2" />
                                        <div className="font-bold text-gray-900 text-sm">Fire Safety</div>
                                        <div className="text-xs text-gray-600 mt-1">Expert</div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-300">
                                    <div className="text-center">
                                        <Icons.Navigation size={32} className="text-orange-600 mx-auto mb-2" />
                                        <div className="font-bold text-gray-900 text-sm">Emergency Response</div>
                                        <div className="text-xs text-gray-600 mt-1">Quick Responder</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Activity Timeline */}
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activities</h2>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Icons.CheckCircle size={18} className="text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-sm text-gray-900">Completed Emergency Drill</div>
                                        <div className="text-xs text-gray-500 mt-1">2 days ago • +50 XP</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Icons.Heart size={18} className="text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-sm text-gray-900">Volunteered at Community Event</div>
                                        <div className="text-xs text-gray-500 mt-1">1 week ago • +5 Volunteer Points</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Icons.Star size={18} className="text-purple-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-sm text-gray-900">Updated Emergency Kit</div>
                                        <div className="text-xs text-gray-500 mt-1">2 weeks ago • +20 XP</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'skills' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white rounded-2xl shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900">{t('skillsAndCertifications')}</h2>
                                {isEditing && (
                                    <button
                                        onClick={addSkill}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold"
                                    >
                                        <Icons.Plus size={16} />
                                        {t('add')}
                                    </button>
                                )}
                            </div>

                            {(editedUser.skills && editedUser.skills.length > 0) ? (
                                <div className="flex flex-wrap gap-2">
                                    {editedUser.skills.map((skill, index) => (
                                        <div 
                                            key={index}
                                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-sm font-semibold"
                                        >
                                            <span>{skill}</span>
                                            {isEditing && (
                                                <button
                                                    onClick={() => removeSkill(skill)}
                                                    className="hover:bg-white/20 rounded-full p-1 transition-colors"
                                                >
                                                    <Icons.X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Icons.Award size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>{t('noSkillsAdded')}</p>
                                    {isEditing && (
                                        <button
                                            onClick={addSkill}
                                            className="mt-4 text-blue-600 font-semibold hover:underline"
                                        >
                                            {t('addFirstSkill')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Suggested Skills */}
                        {!isEditing && (
                            <div className="bg-white rounded-2xl shadow-md p-6">
                                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">{t('suggestedSkills')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {[t('firstAid'), t('cprCertified'), t('fireSafety'), t('emergencyResponseSkill'), t('searchAndRescue')].map((skill, index) => (
                                        <div 
                                            key={index}
                                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                                        >
                                            {skill}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Avatar Upload Confirmation Modal */}
            {showAvatarConfirm && pendingAvatar && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">{t('confirmProfilePicture')}</h2>
                            <button onClick={handleCancelAvatar} className="text-gray-400 hover:text-black">
                                <Icons.X size={24} />
                            </button>
                        </div>
                        
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-40 h-40 rounded-full border-4 border-gray-200 overflow-hidden bg-gray-100 shadow-lg mb-4">
                                <img src={pendingAvatar} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <p className="text-sm text-gray-600 text-center">{t('saveProfilePictureQuestion')}</p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCancelAvatar}
                                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleSaveAvatar}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-colors shadow-lg"
                            >
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
