

export interface User {
    id: number;
    name: string;
    role: 'Admin' | 'Responder' | 'Reporter';
    safetyScore: number;
    xp: number;
    email?: string;
    username?: string;
    phone?: string;
    avatar?: string;
    password?: string;
    skills?: string[];
    bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';
    volunteerPoints?: number;
    permissions?: string[]; // Granular permissions e.g., 'approve_reports', 'request_info'
    emergencyContactName?: string;
    emergencyContactPhone?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeSettings {
    primaryColor: string;
    backgroundColor: string;
    fontFamily: 'inter' | 'roboto' | 'serif';
    /** @deprecated Use themeMode instead */
    darkMode?: boolean;
    /** Light, dark, or follow device preference */
    themeMode?: ThemeMode;
    appName: string;
    logoUrl?: string;
    enableSeo: boolean;
}

export interface Alert {
    id: number;
    title: string;
    description: string;
    severity: 'high' | 'moderate' | 'low';
    timestamp: string;
    type: 'flood' | 'heat' | 'fire' | 'earthquake' | 'general' | 'tsunami' | 'volcano' | 'hurricane' | 'storm';
}

export interface Resource {
    id: number;
    name: string;
    type: 'medical' | 'fire' | 'police' | 'shelter';
    address: string;
    description?: string;
    phone: string;
    lat: number;
    lng: number;
    capacity?: number;
    occupancy?: number;
    operatingHours?: string;
    notes?: string;
    contactPerson?: string;
    contactPhone?: string;
    urgency?: 'Low' | 'Medium' | 'High' | 'Critical';
    inFloodZone?: boolean;
    distance?: string;
    distanceNum?: number;
}

export interface Comment {
    id: number;
    author: string;
    text: string;
    timestamp: string;
    role: string;
}

export interface IncidentReport {
    id: number;
    // Core Info
    type: string; // Hazard Type
    urgency?: 'Low' | 'Medium' | 'High' | 'Critical';
    department?: string;
    description: string;
    
    // Advanced Details
    structuralDamage?: string;
    estRepairDays?: number;
    estCost?: number;
    repeatable?: boolean;
    situationDiscussed?: boolean;
    mitigationPlan?: string;

    // Contact Info (Optional)
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;

    // Location & Status
    lat: number;
    lng: number;
    status: 'pending' | 'active' | 'resolved' | 'approved' | 'info_requested';
    timestamp: string;
    reporterId?: number;
    
    // Admin Feedback
    adminNotes?: string;
    comments?: Comment[];

    // Media (Base64 or URL strings for demo)
    image?: string;
    video?: string;
    audio?: string;
}

export interface ChecklistItem {
    id: number;
    title: string;
    xp: number;
    completed: boolean;
}

// --- New Modules ---

export interface InventoryItem {
    id: number;
    item: string;
    category: 'Medical' | 'Food' | 'Equipment' | 'Water';
    quantity: number;
    unit: string;
    status: 'Good' | 'Low' | 'Critical';
    location: string;
}

export interface InjuryCase {
    id: number;
    name: string; // Anonymous or Code name
    triageLevel: 'Black' | 'Red' | 'Yellow' | 'Green';
    condition: string;
    location: string;
    timestamp: string;
}

export interface DrillSession {
    id: number;
    title: string;
    date: string;
    type: 'Fire' | 'Evacuation' | 'Lockdown';
    status: 'Upcoming' | 'Completed';
    participants?: number;
    notes?: string;
}

export interface Tutorial {
    id: number;
    title: string;
    description: string;
    source: 'YouTube' | 'External';
    url: string;
    xpReward: number;
}

export interface LearnItem {
    id: number;
    title: string;
    description: string;
    url: string;
    type: 'guide' | 'video' | 'resource';
}

// --- Maps Module ---

export interface EarthquakeEvent {
    id: string;
    properties: {
        mag: number;
        place: string;
        time: number;
        url: string;
        title: string;
    };
    geometry: {
        coordinates: number[]; // [lng, lat, depth]
    };
}

export interface SafetyAsset {
    id: number;
    type: 'extinguisher' | 'exit' | 'meeting_point' | 'route' | 'road' | 'hydrant' | 'connector';
    lat: number;
    lng: number;
    label?: string;
    description?: string;
    floor?: string;
    building?: string;
    routePoints?: [number, number][]; // For polylines
    color?: string;
}
