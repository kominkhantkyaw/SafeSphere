import React, { useState } from 'react';
import { Icons } from '../components/Icon';
import { useLanguage } from '../contexts/LanguageContext';

interface Contact {
    id: string;
    name: string;
    role: string;
    callSign: string;
    email: string;
    phone: string;
    type: 'admin' | 'emergency' | 'responder' | 'user';
    avatar?: string;
}

interface DirectoryProps {
    onBack?: () => void;
}

const Directory: React.FC<DirectoryProps> = ({ onBack }) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'admin' | 'emergency'>('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [newContact, setNewContact] = useState<Contact>({
        id: '',
        name: '',
        role: '',
        callSign: '',
        email: '',
        phone: '',
        type: 'user',
        avatar: ''
    });

    // Emergency Services
    const emergencyContacts: Contact[] = [
        {
            id: 'e1',
            name: 'Police',
            role: 'Emergency Service',
            callSign: '911',
            email: 'police@emergency.gov',
            phone: '911',
            type: 'emergency'
        },
        {
            id: 'e2',
            name: 'Fire Department',
            role: 'Emergency Service',
            callSign: '911',
            email: 'fire@emergency.gov',
            phone: '911',
            type: 'emergency'
        },
        {
            id: 'e3',
            name: 'Ambulance',
            role: 'Emergency Service',
            callSign: '911',
            email: 'ambulance@emergency.gov',
            phone: '911',
            type: 'emergency'
        },
        {
            id: 'e4',
            name: 'Coast Guard',
            role: 'Emergency Service',
            callSign: '*CG',
            email: 'rescue@coastguard.gov',
            phone: '*CG',
            type: 'emergency'
        },
        {
            id: 'e5',
            name: 'Poison Control',
            role: 'Emergency Service',
            callSign: '1-800-222-1222',
            email: 'info@poison.org',
            phone: '1-800-222-1222',
            type: 'emergency'
        }
    ];

    // Team Members
    const teamContacts: Contact[] = [
        {
            id: 't1',
            name: 'Alex',
            role: 'Admin',
            callSign: 'Alpha-1',
            email: 'alex@safesphere.app',
            phone: '+1-555-0101',
            type: 'admin'
        },
        {
            id: 't2',
            name: 'Christina Chen',
            role: 'First Responder',
            callSign: 'Bravo-2',
            email: 'sarah.chen@safesphere.app',
            phone: '+1-555-0102',
            type: 'responder'
        },
        {
            id: 't3',
            name: 'Mike Johnson',
            role: 'Coordinator',
            callSign: 'Charlie-3',
            email: 'mike.j@safesphere.app',
            phone: '+1-555-0103',
            type: 'responder'
        },
        {
            id: 't4',
            name: 'Emma Davis',
            role: 'Admin',
            callSign: 'Delta-4',
            email: 'emma.d@safesphere.app',
            phone: '+1-555-0104',
            type: 'admin'
        }
    ];

    const allContacts = [...emergencyContacts, ...teamContacts, ...contacts];

    const handleAddContact = () => {
        if (!newContact.name || !newContact.email || !newContact.phone) {
            alert(t('fillRequiredFieldsDirectory'));
            return;
        }

        const contact: Contact = {
            ...newContact,
            id: `u${Date.now()}`,
        };

        setContacts([...contacts, contact]);
        setShowAddModal(false);
        setNewContact({
            id: '',
            name: '',
            role: '',
            callSign: '',
            email: '',
            phone: '',
            type: 'user',
            avatar: ''
        });
    };

    // Filter and sort contacts
    const filteredContacts = allContacts
        .filter(contact => {
            const matchesSearch = 
                contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                contact.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                contact.callSign.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesFilter = 
                filterType === 'all' || 
                (filterType === 'emergency' && contact.type === 'emergency') ||
                (filterType === 'admin' && contact.type === 'admin');
            
            return matchesSearch && matchesFilter;
        })
        .sort((a, b) => {
            const comparison = a.name.localeCompare(b.name);
            return sortOrder === 'asc' ? comparison : -comparison;
        });

    const handleShare = (contact: Contact) => {
        const text = `${contact.name}\n${contact.role}\n${t('callSignLabel')}: ${contact.callSign}\nEmail: ${contact.email}\nPhone: ${contact.phone}`;
        if (navigator.share) {
            navigator.share({ title: contact.name, text });
        } else {
            navigator.clipboard.writeText(text);
            alert(t('contactCopied'));
        }
    };

    const handleDownload = (contact: Contact) => {
        const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${contact.name}
TITLE:${contact.role}
EMAIL:${contact.email}
TEL:${contact.phone}
NOTE:Call Sign: ${contact.callSign}
END:VCARD`;
        
        const blob = new Blob([vcard], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${contact.name.replace(/\s/g, '_')}.vcf`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = (contact: Contact) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>${contact.name} - Contact Information</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; }
                        h1 { color: #333; }
                        .info { margin: 20px 0; }
                        .label { font-weight: bold; color: #666; }
                    </style>
                </head>
                <body>
                    <h1>${contact.name}</h1>
                    <div class="info"><span class="label">Role:</span> ${contact.role}</div>
                    <div class="info"><span class="label">Call Sign:</span> ${contact.callSign}</div>
                    <div class="info"><span class="label">Email:</span> ${contact.email}</div>
                    <div class="info"><span class="label">Phone:</span> ${contact.phone}</div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handleEdit = (contact: Contact) => {
        setSelectedContact(contact);
        // Open edit modal (implement full edit functionality)
        alert(t('editComingSoon'));
    };

    const handleDelete = (contact: Contact) => {
        if (contact.type === 'emergency') {
            alert(t('cannotDeleteEmergency'));
            return;
        }
        if (confirm(t('areYouSure'))) {
            alert(t('deletedSuccessfully'));
        }
    };

    const generateQRCode = (contact: Contact) => {
        setShowQRScanner(true);
        // In real app, generate QR code with contact vCard
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Icons.Users size={24} className="text-blue-600" />
                        <h1 className="text-2xl font-bold text-gray-900">{t('directory')}</h1>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Icons.Plus size={18} />
                        {t('addContact')}
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Icons.Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('searchContacts')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                            filterType === 'all'
                                ? 'bg-black text-white'
                                : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                    >
                        {t('all')}
                    </button>
                    <button
                        onClick={() => setFilterType('admin')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                            filterType === 'admin'
                                ? 'bg-black text-white'
                                : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                    >
                        {t('admin')}
                    </button>
                    <button
                        onClick={() => setFilterType('emergency')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                            filterType === 'emergency'
                                ? 'bg-black text-white'
                                : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                    >
                        {t('emergency')}
                    </button>
                </div>

                <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                    <Icons.ArrowDownAZ size={20} className={`text-gray-600 transition-transform ${
                        sortOrder === 'desc' ? 'rotate-180' : ''
                    }`} />
                </button>
            </div>

            {/* Contacts List */}
            <div className="px-6 space-y-4">
                {filteredContacts.map((contact) => (
                    <div
                        key={contact.id}
                        className="bg-white rounded-2xl shadow-md p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4"
                    >
                        {/* Contact Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
                                    contact.type === 'emergency' ? 'bg-red-500' :
                                    contact.type === 'admin' ? 'bg-purple-500' :
                                    'bg-blue-500'
                                }`}>
                                    {contact.avatar ? (
                                        <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        contact.name.charAt(0).toUpperCase()
                                    )}
                                </div>

                                {/* Contact Info */}
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{contact.name}</h3>
                                    <p className="text-sm text-gray-500">{contact.role}</p>
                                    <p className="text-sm text-gray-600 mt-1">{t('callSignLabel')}: {contact.callSign}</p>
                                </div>
                            </div>

                            {/* Role Badge */}
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                contact.type === 'emergency' ? 'bg-red-100 text-red-700' :
                                contact.type === 'admin' ? 'bg-purple-100 text-purple-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                                {contact.type === 'emergency' ? t('emergencyBadge') :
                                 contact.type === 'admin' ? t('adminBadge') : t('responderBadge')}
                            </span>
                        </div>

                        {/* Contact Details */}
                        <div className="bg-blue-50 rounded-xl p-4">
                            <a
                                href={`mailto:${contact.email}`}
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                            >
                                <Icons.Mail size={18} />
                                {contact.email}
                            </a>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            {/* Left Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleShare(contact)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={t('shareTitle')}
                                >
                                    <Icons.Share size={20} className="text-gray-600" />
                                </button>
                                <button
                                    onClick={() => handleDownload(contact)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={t('downloadVCard')}
                                >
                                    <Icons.Download size={20} className="text-gray-600" />
                                </button>
                                <button
                                    onClick={() => handlePrint(contact)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={t('printTitle')}
                                >
                                    <Icons.Printer size={20} className="text-gray-600" />
                                </button>
                                <button
                                    onClick={() => generateQRCode(contact)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={t('generateQrCode')}
                                >
                                    <Icons.QrCode size={20} className="text-gray-600" />
                                </button>
                            </div>

                            {/* Right Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleEdit(contact)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                >
                                    {t('editButton')}
                                </button>
                                {contact.type !== 'emergency' && (
                                    <button
                                        onClick={() => handleDelete(contact)}
                                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                        title={t('deleteTitle')}
                                    >
                                        <Icons.Trash size={20} className="text-red-600" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredContacts.length === 0 && (
                    <div className="text-center py-12">
                        <Icons.Users size={48} className="text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">{t('noContactsFound')}</p>
                        <p className="text-sm text-gray-400 mt-1">{t('tryAdjustingSearch')}</p>
                    </div>
                )}
            </div>

            {/* QR Scanner Modal */}
            {showQRScanner && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                        <div className="text-center">
                            <div className="w-48 h-48 mx-auto bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                                <Icons.QrCode size={64} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('qrCodeGenerated')}</h3>
                            <p className="text-sm text-gray-500 mb-4">{t('scanToSaveContact')}</p>
                            <button
                                onClick={() => setShowQRScanner(false)}
                                className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800"
                            >
                                {t('closeButton')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Contact Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900">{t('addNewContact')}</h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <Icons.X size={20} className="text-gray-600" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('nameLabel')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newContact.name}
                                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                                    placeholder={t('enterFullName')}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('roleLabel')}
                                </label>
                                <input
                                    type="text"
                                    value={newContact.role}
                                    onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                                    placeholder={t('rolePlaceholder')}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Call Sign */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('callSignLabel')}
                                </label>
                                <input
                                    type="text"
                                    value={newContact.callSign}
                                    onChange={(e) => setNewContact({ ...newContact, callSign: e.target.value })}
                                    placeholder={t('callSignPlaceholder')}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('emailLabel')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={newContact.email}
                                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                    placeholder={t('emailExample')}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('phone')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={newContact.phone}
                                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                                    placeholder={t('phonePlaceholder')}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('typeLabel')}
                                </label>
                                <select
                                    value={newContact.type}
                                    onChange={(e) => setNewContact({ ...newContact, type: e.target.value as Contact['type'] })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="user">{t('userOption')}</option>
                                    <option value="responder">{t('responderType')}</option>
                                    <option value="admin">{t('adminType')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                            >
                                {t('cancelButton')}
                            </button>
                            <button
                                onClick={handleAddContact}
                                className="flex-1 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                            >
                                <Icons.Plus size={18} />
                                {t('addContactButton')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Directory;
