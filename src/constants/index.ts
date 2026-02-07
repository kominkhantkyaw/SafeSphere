import { Alert, ChecklistItem, DrillSession, IncidentReport, InjuryCase, InventoryItem, LearnItem, Resource, Tutorial, User } from '../types';

/** FLOOD zones: Yangon River (west) + Ywar Thit / Zhanlyin (east) */
export const FLOOD_ZONES_YANGON: ReadonlyArray<{ lat: number; lng: number; label?: string }> = [
    { lat: 16.776, lng: 96.122, label: 'Yangon River – between Dala and Yangon Fire Station (west part)' },
    { lat: 16.835, lng: 96.188, label: 'Ywar Thit / Zhanlyin – flood-prone area' },
    { lat: 16.778, lng: 96.128, label: 'Yangon River – west of downtown' },
];

/** Primary flood zone – Yangon River between Dala and Yangon Fire Station, west part of Yangon */
export const FLOOD_ZONE_YANGON = FLOOD_ZONES_YANGON[0];

/** Downtown Yangon – Sule Pagoda / Kyauktada / Pabedan area (for urban fire scenarios) */
export const DOWNTOWN_YANGON = { lat: 16.776, lng: 96.157, label: 'Downtown Yangon – Kyauktada, near Sule Pagoda' };

/** Pick a flood zone point along Yangon River (for incident placement when GPS unavailable) */
export function getRandomFloodZoneYangon(): { lat: number; lng: number } {
    const z = FLOOD_ZONES_YANGON[Math.floor(Math.random() * FLOOD_ZONES_YANGON.length)];
    return { lat: z.lat, lng: z.lng };
}

export const MOCK_USER: User = {
    id: 1,
    name: 'Admin',
    role: 'Admin', 
    safetyScore: 85,
    xp: 450,
    skills: ['Leadership', 'First Aid'],
    bloodType: 'O+',
    volunteerPoints: 120,
    email: 'admin@safesphere.app',
    permissions: ['approve_reports', 'manage_users', 'edit_resources']
};

export const MOCK_ALERTS: Alert[] = [
    {
        id: 3,
        title: 'Earthquake – Myanmar',
        description: 'A magnitude ~5.9–6.0 earthquake struck Myanmar recently (reported Tuesday, 03. Feb 2026).',
        severity: 'high',
        timestamp: '03 Feb 2026',
        type: 'general'
    },
    {
        id: 2,
        title: 'Heatwave Advisory',
        description: 'Stay hydrated and avoid direct sun.',
        severity: 'moderate',
        timestamp: '21:35:26',
        type: 'heat'
    }
];

export const MOCK_RESOURCES: Resource[] = [
    {
        id: 1,
        name: 'Yangon General Hospital',
        type: 'medical',
        address: 'Bahan Township, Yangon',
        description: '24/7 Trauma Center',
        phone: '555-0123',
        lat: 16.8052,
        lng: 96.1457,
        capacity: 500,
        occupancy: 420,
        operatingHours: '24/7',
        contactPerson: 'Dr. Smith',
        contactPhone: '555-9999',
        urgency: 'Critical',
        inFloodZone: false
    },
    {
        id: 2,
        name: 'Yangon Fire Station',
        type: 'fire',
        address: 'Downtown Yangon',
        description: 'Fire & Rescue',
        phone: '555-0124',
        lat: 16.7822,
        lng: 96.1558,
        operatingHours: '24/7',
        urgency: 'High',
        inFloodZone: false
    },
    {
        id: 3,
        name: 'Community Relief Center',
        type: 'shelter',
        address: "People's Park, Bahan Township, Yangon",
        description: 'Emergency shelter capacity: 200',
        phone: '555-0199',
        lat: 16.7935,
        lng: 96.1405,
        capacity: 200,
        occupancy: 145,
        operatingHours: '08:00 - 22:00',
        contactPerson: 'Jane Doe',
        notes: 'Back entrance reserved for staff.',
        urgency: 'Medium',
        inFloodZone: false
    },
    {
        id: 4,
        name: 'City General Hospital',
        type: 'medical',
        address: 'Insein Township, Yangon',
        description: '24/7 Emergency & General Care',
        phone: '555-0150',
        lat: 16.8920,
        lng: 96.1120,
        capacity: 350,
        occupancy: 280,
        operatingHours: '24/7',
        contactPerson: 'Dr. Aung',
        urgency: 'High',
        inFloodZone: false
    },
    {
        id: 5,
        name: 'Community Center',
        type: 'shelter',
        address: "People's Park, Bahan Township, Yangon",
        description: 'Community assembly & relief hub',
        phone: '555-0160',
        lat: 16.7928,
        lng: 96.1398,
        capacity: 150,
        occupancy: 80,
        operatingHours: '06:00 - 22:00',
        contactPerson: 'Ko Min',
        urgency: 'Medium',
        inFloodZone: false
    },
    {
        id: 6,
        name: 'Mandalay Shelter',
        type: 'shelter',
        address: 'Mandalay Hill Rd',
        description: 'Overflow Resettlement Area',
        phone: '555-0200',
        lat: 21.9550,
        lng: 96.0900,
        capacity: 300,
        occupancy: 20,
        operatingHours: 'Emergency Activation Only',
        urgency: 'Low',
        inFloodZone: false
    }
];

export const MOCK_REPORTS: IncidentReport[] = [
    {
        id: 101,
        type: 'FLOOD',
        description: 'FLOOD (high) – Yangon River between Dala and Yangon Fire Station (west part)',
        lat: FLOOD_ZONES_YANGON[0].lat,
        lng: FLOOD_ZONES_YANGON[0].lng,
        status: 'active',
        timestamp: '22:15:00',
        urgency: 'High',
        comments: []
    },
    {
        id: 102,
        type: 'FIRE',
        description: 'FIRE (Critical) – Downtown Yangon, commercial building near Sule Pagoda / Kyauktada',
        lat: DOWNTOWN_YANGON.lat,
        lng: DOWNTOWN_YANGON.lng,
        status: 'active',
        timestamp: '23:05:00',
        urgency: 'Critical',
        comments: []
    },
    {
        id: 103,
        type: 'FLOOD',
        description: 'FLOOD (high) – Yangon River between Dala and Yangon Fire Station',
        lat: 16.776,
        lng: 96.122,
        status: 'active',
        timestamp: '23:27:06',
        urgency: 'High',
        comments: []
    }
];

export const MOCK_CHECKLIST: ChecklistItem[] = [
    { id: 1, title: 'Build a basic emergency kit', xp: 10, completed: false },
    { id: 2, title: 'Save local emergency numbers', xp: 8, completed: false },
    { id: 3, title: 'Store 3 days of water (1 gal/person/day)', xp: 20, completed: false },
    { id: 4, title: 'Stock non-perishable food for 3 days', xp: 20, completed: false },
    { id: 5, title: 'Battery-powered or hand-crank radio', xp: 15, completed: false },
    { id: 6, title: 'Flashlight + extra batteries', xp: 10, completed: false },
    { id: 7, title: 'Wrench/pliers to turn off utilities', xp: 10, completed: false },
    { id: 8, title: 'Prescription medications (7 day supply)', xp: 25, completed: false },
    { id: 9, title: 'Cash for emergencies', xp: 10, completed: false },
    { id: 10, title: 'Secure heavy furniture (bookshelves, cabinets) to walls', xp: 15, completed: false },
    { id: 11, title: 'Practise Drop-Cover-Hold On drill with household', xp: 15, completed: false },
    { id: 12, title: 'Know evacuation route to high ground', xp: 20, completed: false },
    { id: 13, title: 'Have a go-bag ready for rapid evacuation', xp: 15, completed: false },
    { id: 14, title: 'Fire extinguisher in kitchen and near exits', xp: 20, completed: false },
    { id: 15, title: 'Designate outdoor meeting point for household', xp: 10, completed: false },
];

// --- New Module Data ---

export const MOCK_INVENTORY: InventoryItem[] = [
    { id: 1, item: 'Bottled Water', category: 'Water', quantity: 1500, unit: 'Liters', status: 'Good', location: 'Warehouse A' },
    { id: 2, item: 'MRE Rations', category: 'Food', quantity: 200, unit: 'Packs', status: 'Low', location: 'Warehouse A' },
    { id: 3, item: 'First Aid Kits', category: 'Medical', quantity: 50, unit: 'Kits', status: 'Good', location: 'Station 4' },
    { id: 4, item: 'Generators', category: 'Equipment', quantity: 2, unit: 'Units', status: 'Critical', location: 'Main Office' },
];

export const MOCK_INJURIES: InjuryCase[] = [
    { id: 1, name: 'Male, 40s', triageLevel: 'Red', condition: 'Severe Burn', location: 'Sector 4', timestamp: '10:30 AM' },
    { id: 2, name: 'Female, 20s', triageLevel: 'Green', condition: 'Sprained Ankle', location: 'Shelter B', timestamp: '11:15 AM' },
    { id: 3, name: 'Child, 10', triageLevel: 'Yellow', condition: 'Asthma Attack', location: 'Sector 1', timestamp: '09:45 AM' },
];

export const MOCK_DRILLS: DrillSession[] = [
    { id: 1, title: 'Annual Fire Drill', date: '2023-11-15', type: 'Fire', status: 'Completed', participants: 120, notes: 'Evacuation time: 4 mins' },
    { id: 2, title: 'Earthquake Simulation', date: '2024-06-20', type: 'Evacuation', status: 'Upcoming' },
    { id: 3, title: 'Active Shooter Drill', date: '2024-08-10', type: 'Lockdown', status: 'Upcoming' },
];

export const MOCK_LEARN_ITEMS: LearnItem[] = [
    { id: 1, title: 'Community Emergency Guide', description: 'Local procedures for neighbourhood emergencies.', url: 'https://www.ready.gov', type: 'guide' },
];

export const MOCK_TUTORIALS: Tutorial[] = [
    { id: 1, title: 'Earthquake Safety Video Series', description: 'How to prepare for and stay safe during earthquakes.', source: 'YouTube', url: 'https://www.youtube.com/playlist?list=PLs1gMujRSBY2t7JB4VS-AymFwN-6Lvg20', xpReward: 25 },
    { id: 2, title: 'First Aid Basics', description: 'Learn essential first aid skills for emergencies.', source: 'YouTube', url: 'https://www.youtube.com/watch?v=gDmy0of0XAk', xpReward: 25 },
    { id: 3, title: 'Counsellor for Trauma', description: 'Helping someone hyperventilating during a panic attack.', source: 'YouTube', url: 'https://www.youtube.com/watch?v=1UWa124NfCc', xpReward: 25 },
    { id: 4, title: 'CPR & Defibrillator', description: 'How to perform CPR and use an AED.', source: 'YouTube', url: 'https://www.youtube.com/watch?v=WeY4KJUnfMc', xpReward: 30 },
    { id: 5, title: 'Emergency Evacuation', description: 'Be Red Cross Ready: 3 steps to preparedness.', source: 'YouTube', url: 'https://www.youtube.com/watch?v=MzaGbHkndts&t=15s', xpReward: 20 },
];
