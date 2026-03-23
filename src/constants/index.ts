import { Alert, ChecklistItem, DrillSession, IncidentReport, InjuryCase, InventoryItem, LearnItem, Resource, Tutorial, User } from '../types';

/** International phone country codes for registration and forms */
export const COUNTRY_CODES: ReadonlyArray<{ code: string; label: string }> = [
    { code: '+43', label: '🇦🇹 +43 (Austria)' },
    { code: '+44', label: '🇬🇧 +44 (UK)' },
    { code: '+49', label: '🇩🇪 +49 (Germany)' },
    { code: '+95', label: '🇲🇲 +95 (Myanmar)' },
    { code: '+1', label: '🇺🇸 +1 (US/Canada)' },
    { code: '+33', label: '🇫🇷 +33 (France)' },
    { code: '+39', label: '🇮🇹 +39 (Italy)' },
    { code: '+41', label: '🇨🇭 +41 (Switzerland)' },
    { code: '+34', label: '🇪🇸 +34 (Spain)' },
    { code: '+31', label: '🇳🇱 +31 (Netherlands)' },
    { code: '+46', label: '🇸🇪 +46 (Sweden)' },
    { code: '+47', label: '🇳🇴 +47 (Norway)' },
    { code: '+48', label: '🇵🇱 +48 (Poland)' },
    { code: '+81', label: '🇯🇵 +81 (Japan)' },
    { code: '+82', label: '🇰🇷 +82 (South Korea)' },
    { code: '+86', label: '🇨🇳 +86 (China)' },
    { code: '+91', label: '🇮🇳 +91 (India)' },
    { code: '+61', label: '🇦🇺 +61 (Australia)' },
    { code: '+65', label: '🇸🇬 +65 (Singapore)' },
    { code: '+66', label: '🇹🇭 +66 (Thailand)' },
    { code: '+60', label: '🇲🇾 +60 (Malaysia)' },
    { code: '+63', label: '🇵🇭 +63 (Philippines)' },
    { code: '+84', label: '🇻🇳 +84 (Vietnam)' },
    { code: '+62', label: '🇮🇩 +62 (Indonesia)' },
    { code: '+7', label: '🇷🇺 +7 (Russia)' },
    { code: '+90', label: '🇹🇷 +90 (Turkey)' },
    { code: '+971', label: '🇦🇪 +971 (UAE)' },
    { code: '+966', label: '🇸🇦 +966 (Saudi Arabia)' },
    { code: '+20', label: '🇪🇬 +20 (Egypt)' },
    { code: '+27', label: '🇿🇦 +27 (South Africa)' },
];

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
    id: '550e8400-e29b-41d4-a716-446655440001',
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
        id: 7,
        title: 'Earthquake – Myanmar',
        description: 'A magnitude ~5.9–6.0 earthquake struck Myanmar recently (reported Tuesday, 03. Feb 2026).',
        severity: 'high',
        timestamp: '03 Feb 2026',
        type: 'earthquake'
    },
    {
        id: 6,
        title: 'Tsunami Warning – Coastal Regions',
        description: 'Tsunami advisory issued for coastal areas following undersea seismic activity. Move to higher ground immediately.',
        severity: 'high',
        timestamp: '01 Feb 2026',
        type: 'tsunami'
    },
    {
        id: 5,
        title: 'Volcanic Activity – Mount Popa',
        description: 'Increased volcanic activity detected at Mount Popa. Exclusion zone extended to 10 km radius.',
        severity: 'high',
        timestamp: '30 Jan 2026',
        type: 'volcano'
    },
    {
        id: 4,
        title: 'Hurricane Alert – Bay of Bengal',
        description: 'Category 2 hurricane approaching Bay of Bengal. Expected landfall within 48 hours. Prepare emergency kits.',
        severity: 'high',
        timestamp: '28 Jan 2026',
        type: 'hurricane'
    },
    {
        id: 3,
        title: 'Storm Warning – Yangon Region',
        description: 'Severe thunderstorm warning issued for Yangon Region. Strong winds and heavy rainfall expected.',
        severity: 'moderate',
        timestamp: '27 Jan 2026',
        type: 'storm'
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

/**
 * Emergency facilities for demo / offline mode — all coordinates in Yangon Region, Myanmar
 * (earthquake, flood, cyclone, tsunami awareness for Lower Myanmar / Bay of Bengal context).
 */
export const MOCK_RESOURCES: Resource[] = [
    {
        id: 1,
        name: 'Yangon General Hospital (YGH)',
        type: 'medical',
        address: 'Lanmadaw Street, Bahan Township, Yangon 11201',
        description: 'Major public hospital — 24/7 emergency & trauma (illustrative demo data).',
        phone: '+95 1 538 055',
        lat: 16.8053,
        lng: 96.1457,
        capacity: 500,
        occupancy: 420,
        operatingHours: '24/7',
        contactPerson: 'Emergency desk',
        contactPhone: '192 (Ambulance, national)',
        urgency: 'Critical',
        inFloodZone: false,
    },
    {
        id: 2,
        name: 'Yangon Region Fire Services (Lanmadaw station area)',
        type: 'fire',
        address: 'Lanmadaw Township, Yangon (near downtown corridor)',
        description: 'Fire & rescue — national emergency 191.',
        phone: '191',
        lat: 16.7825,
        lng: 96.1495,
        operatingHours: '24/7',
        urgency: 'High',
        inFloodZone: false,
    },
    {
        id: 3,
        name: 'Kyauktada Township Police Station',
        type: 'police',
        address: 'Strand Road / downtown Kyauktada, Yangon',
        description: 'Local police office — national police emergency 199.',
        phone: '199',
        lat: 16.7719,
        lng: 96.1564,
        operatingHours: '24/7',
        urgency: 'High',
        inFloodZone: true,
    },
    {
        id: 4,
        name: 'Insein General Hospital',
        type: 'medical',
        address: 'Insein Township, Yangon',
        description: 'General & emergency care for northern Yangon.',
        phone: '+95 1 640 446',
        lat: 16.8921,
        lng: 96.0978,
        capacity: 350,
        occupancy: 280,
        operatingHours: '24/7',
        contactPerson: 'Emergency unit',
        urgency: 'High',
        inFloodZone: false,
    },
    {
        id: 5,
        name: 'North Okkalapa General Hospital',
        type: 'medical',
        address: 'North Okkalapa Township, Yangon',
        description: 'Public hospital serving eastern Yangon.',
        phone: '+95 1 695 026',
        lat: 16.8778,
        lng: 96.1836,
        capacity: 280,
        occupancy: 190,
        operatingHours: '24/7',
        urgency: 'High',
        inFloodZone: false,
    },
    {
        id: 6,
        name: 'People\'s Park community relief point',
        type: 'shelter',
        address: 'People\'s Park, Dhammazedi Road, Bahan Township, Yangon',
        description: 'Assembly & relief coordination point during floods / storms.',
        phone: '+95 9 450 123456',
        lat: 16.7935,
        lng: 96.1405,
        capacity: 200,
        occupancy: 45,
        operatingHours: 'Activated during disasters',
        contactPerson: 'Relief desk',
        urgency: 'Medium',
        inFloodZone: false,
    },
    {
        id: 7,
        name: 'Thuwunna disaster evacuation site',
        type: 'shelter',
        address: 'Thuwunna, Thingangyun Township, Yangon',
        description: 'Large indoor venue — used as evacuation / staging in exercises.',
        phone: '+95 9 790 123456',
        lat: 16.8254,
        lng: 96.1842,
        capacity: 800,
        occupancy: 0,
        operatingHours: 'When activated by TDMC / region',
        urgency: 'Medium',
        inFloodZone: false,
    },
    {
        id: 8,
        name: 'Dala Township river-crossing aid point',
        type: 'shelter',
        address: 'Near Dala ferry / Yangon River (south bank), Yangon Region',
        description: 'Flood-prone area — coordination for river communities (demo scenario).',
        phone: '+95 9 260 123456',
        lat: 16.768,
        lng: 96.119,
        capacity: 120,
        occupancy: 30,
        operatingHours: 'High water / cyclone activation',
        urgency: 'High',
        inFloodZone: true,
    },
    {
        id: 9,
        name: 'Universitätsklinikum Klagenfurt (UKH)',
        type: 'medical',
        address: 'Fritsch am Berg 11, 9020 Klagenfurt am Wörthersee, Austria',
        description:
            'University hospital — 24/7 emergency (demo row: commonly referred to as UKH / LKH Klagenfurt).',
        phone: '+43 50 536',
        lat: 46.6172,
        lng: 14.2654,
        capacity: 600,
        occupancy: 480,
        operatingHours: '24/7',
        contactPerson: 'Emergency admission',
        urgency: 'High',
        inFloodZone: false,
    },
];

/** Demo Reporter user id (see DEMO_CREDENTIALS reporter@safesphere.app) — mock incidents show under Reporter History / My submissions. */
const DEMO_REPORTER_USER_ID = '550e8400-e29b-41d4-a716-446655440003';

export const MOCK_REPORTS: IncidentReport[] = [
    {
        id: '101',
        type: 'FLOOD',
        description: 'FLOOD (high) – Yangon River between Dala and Yangon Fire Station (west part)',
        lat: FLOOD_ZONES_YANGON[0].lat,
        lng: FLOOD_ZONES_YANGON[0].lng,
        status: 'active',
        timestamp: '22:15:00',
        urgency: 'High',
        comments: [],
        reporterId: DEMO_REPORTER_USER_ID,
    },
    {
        id: '102',
        type: 'FIRE',
        description: 'FIRE (Critical) – Downtown Yangon, commercial building near Sule Pagoda / Kyauktada',
        lat: DOWNTOWN_YANGON.lat,
        lng: DOWNTOWN_YANGON.lng,
        status: 'active',
        timestamp: '23:05:00',
        urgency: 'Critical',
        comments: [],
        reporterId: DEMO_REPORTER_USER_ID,
    },
    {
        id: '103',
        type: 'FLOOD',
        description: 'FLOOD (high) – Yangon River between Dala and Yangon Fire Station',
        lat: 16.776,
        lng: 96.122,
        status: 'active',
        timestamp: '23:27:06',
        urgency: 'High',
        comments: [],
        reporterId: DEMO_REPORTER_USER_ID,
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
    { id: 1, title: 'Annual Fire Drill', date: '2024-12-15', time: '10:00', type: 'Fire', status: 'Completed', eventType: 'session', participants: 120, notes: 'Evacuation time: 4 mins' },
    { id: 2, title: 'Earthquake Simulation', date: '2025-04-20', time: '14:00', type: 'Evacuation', status: 'Upcoming', eventType: 'session', slots: [
        { date: '2025-04-20', time: '14:00' },
        { date: '2025-04-22', time: '10:00' },
        { date: '2025-04-25', time: '09:00' },
    ]},
    { id: 3, title: 'Active Shooter Drill', date: '2025-05-10', time: '09:00', type: 'Lockdown', status: 'Upcoming', eventType: 'session', slots: [
        { date: '2025-05-10', time: '09:00' },
        { date: '2025-05-12', time: '14:00' },
    ]},
    { id: 4, title: 'First Aid Certification', date: '2025-04-25', time: '13:00', type: 'Evacuation', status: 'Upcoming', eventType: 'appointment', slots: [
        { date: '2025-04-25', time: '13:00' },
        { date: '2025-04-27', time: '10:00' },
        { date: '2025-04-30', time: '15:00' },
    ]},
    { id: 5, title: 'Emergency Kit Deadline', date: '2025-04-30', type: 'Fire', status: 'Upcoming', eventType: 'deadline' },
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
    {
        id: 6,
        title: 'Choking first aid (adult)',
        description:
            'American Red Cross: how to help when an adult is choking and becomes unresponsive—chest compressions, airway checks, and rescue breaths.',
        source: 'YouTube',
        url: 'https://www.youtube.com/watch?v=9pTnepZd5as',
        xpReward: 20,
    },
];
