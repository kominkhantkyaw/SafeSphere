

export interface User {
    id: string;  // UUID string format (e.g., '550e8400-e29b-41d4-a716-446655440000')
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
    /** Alert type can be preset values or fully custom (e.g. "Building Collapse"). */
    type: string;
    /** When true, the alert is hidden from "Active Alerts" but kept in history/management. */
    archived?: boolean;
    /** When true, the alert is marked as completed/resolved (moved to history/management). */
    resolved?: boolean;
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
    /** Optional access or delivery notes shown on map detail */
    specialInstructions?: string;
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
    /** Client-generated UUID for online sync; demo mode uses numeric strings (e.g. "0", "101"). */
    id: string;
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
    /** gps = coordinates from map / device; site_only = submitted without GPS (saves data / offline-friendly). */
    locationSource?: 'gps' | 'site_only';
    /** delayed = triage “wait”; rejected = invalid/duplicate (see Report_UI_Layout.md) */
    status:
        | 'pending'
        | 'active'
        | 'resolved'
        | 'approved'
        | 'info_requested'
        | 'delayed'
        | 'rejected'
        | 'en_route'
        | 'on_scene';
    timestamp: string;
    reporterId?: string;  // UUID string format (references users.id)
    
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
    description?: string;
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

/** Event type for calendar display: Session (drill/course), Appointment, Deadline */
export type DrillEventType = 'session' | 'appointment' | 'deadline' | (string & {});

/** A selectable session slot (date + time) for drills with multiple options */
export interface DrillSlot {
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
}

export interface DrillSession {
    id: number;
    title: string;
    date: string;
    time?: string; // e.g. "14:00" or "2:00 PM"
    type: 'Fire' | 'Evacuation' | 'Lockdown' | (string & {});
    status: 'Upcoming' | 'Progress' | 'Completed' | 'Cancel' | 'Happening' | 'Cancelled' | (string & {});
    eventType?: DrillEventType; // session, appointment, deadline (or custom)
    /** Multiple session slots - user picks one when registering */
    slots?: DrillSlot[];
    participants?: number;
    notes?: string;
}

/** Comment on a drill session/course (social feature) */
export interface DrillComment {
    id: string;
    drillId: number;
    userId: string;
    userName: string;
    content: string;
    createdAt: string; // ISO string
    updatedAt?: string; // ISO string, when edited
}

/** Facebook-style reaction types */
export type DrillReaction = 'like' | 'love' | 'smile' | 'laugh' | 'sad' | 'cry';

/** Reaction config for UI */
export const DRILL_REACTIONS: { type: DrillReaction; emoji: string; label: string }[] = [
    { type: 'like', emoji: '👍', label: 'Like' },
    { type: 'love', emoji: '❤️', label: 'Love' },
    { type: 'smile', emoji: '😊', label: 'Smile' },
    { type: 'laugh', emoji: '😂', label: 'Haha' },
    { type: 'sad', emoji: '😢', label: 'Sad' },
    { type: 'cry', emoji: '😭', label: 'Care' },
];

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
