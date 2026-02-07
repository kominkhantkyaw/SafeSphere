
import { MOCK_ALERTS, MOCK_CHECKLIST, MOCK_DRILLS, MOCK_INJURIES, MOCK_INVENTORY, MOCK_LEARN_ITEMS, MOCK_REPORTS, MOCK_RESOURCES, MOCK_TUTORIALS, MOCK_USER } from '../constants';
import type { Alert, ChecklistItem, DrillSession, IncidentReport, InjuryCase, InventoryItem, LearnItem, Resource, Tutorial, User, EarthquakeEvent, SafetyAsset } from '../types';
import { supabase, isSupabaseReady } from './supabase';

const USE_MOCK_DATA = true; // Set to false to use PHP Backend
const API_URL = 'https://safesphere.app/api/api.php';

/** True when online and Supabase is configured - use Supabase for storage */
const useSupabase = (): boolean => typeof navigator !== 'undefined' && navigator.onLine && isSupabaseReady();

// Offline storage helper
const getCached = <T>(key: string): T | null => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error("Error reading from localStorage", e);
        return null;
    }
};

const setCached = <T>(key: string, data: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Error writing to localStorage", e);
    }
};

// --- USER MANAGEMENT ---

export const fetchUser = async (): Promise<User> => {
    const saved = localStorage.getItem('safesphere_user');
    if (saved) {
        try {
            const user = JSON.parse(saved);
            if (user?.id) return Promise.resolve(user);
        } catch { /* ignore */ }
    }
    return Promise.resolve({ ...MOCK_USER });
};

const USERS_CACHE_KEY = 'safesphere_users_list_v3';
const RESOURCES_CACHE_KEY = 'safesphere_resources_v3_peoples_park'; // Bumped: Community Relief/Center at People's Park

/** Demo login credentials for role-based access */
export const DEMO_CREDENTIALS: Array<{ email: string; password: string; user: User }> = [
    { email: 'admin@safesphere.app', password: 'admin123', user: { id: 1, name: 'Admin', role: 'Admin', safetyScore: 85, xp: 450, email: 'admin@safesphere.app', phone: '+1 555 0123', skills: ['Leadership', 'First Aid'], bloodType: 'O+', volunteerPoints: 120, permissions: ['approve_reports', 'manage_users', 'edit_resources'] } },
    { email: 'responder@safesphere.app', password: 'responder123', user: { id: 2, name: 'Responder', role: 'Responder', safetyScore: 90, xp: 1200, email: 'responder@safesphere.app', phone: '555-0101', skills: ['CPR', 'Search & Rescue'], bloodType: 'O-', volunteerPoints: 340, permissions: ['approve_reports'] } },
    { email: 'reporter@safesphere.app', password: 'reporter123', user: { id: 3, name: 'Reporter', role: 'Reporter', safetyScore: 75, xp: 300, email: 'reporter@safesphere.app', skills: ['Driving'], bloodType: 'B+', volunteerPoints: 85, permissions: [] } },
    { email: 'viewer@safesphere.app', password: 'viewer123', user: { id: 4, name: 'Viewer', role: 'Viewer', safetyScore: 50, xp: 100, email: 'viewer@safesphere.app', bloodType: 'A+', volunteerPoints: 20, permissions: [] } }
];

/** Authenticate by email and password. Returns user if valid, null otherwise. */
export const authenticate = async (email: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
    const emailNorm = email.trim().toLowerCase();
    const cred = DEMO_CREDENTIALS.find(c => c.email.toLowerCase() === emailNorm);
    if (!cred) return { success: false, message: 'Invalid email or password.' };
    if (cred.password !== password) return { success: false, message: 'Invalid email or password.' };
    return { success: true, user: cred.user };
};

export const fetchAllUsers = async (): Promise<User[]> => {
    const cached = getCached<User[]>(USERS_CACHE_KEY);
    if (cached) return Promise.resolve(cached);

    const mockUsers: User[] = [
        ...DEMO_CREDENTIALS.map(c => ({ ...c.user, password: c.password })),
        { id: 5, name: 'Sarah Connor', role: 'Responder', safetyScore: 90, xp: 1200, email: 'sarah@safesphere.app', phone: '555-0101', skills: ['CPR', 'Search & Rescue'], bloodType: 'O-', volunteerPoints: 340, password: 'Sarah123!', permissions: ['approve_reports'] },
        { id: 6, name: 'Christina', role: 'Viewer', safetyScore: 60, xp: 150, email: 'christina@safesphere.app', phone: '555-0102', bloodType: 'AB+', volunteerPoints: 45, password: 'Christina123!', permissions: [] }
    ];
    setCached(USERS_CACHE_KEY, mockUsers);
    return Promise.resolve(mockUsers);
};

export const saveUser = async (user: Partial<User>): Promise<boolean> => {
    const users = await fetchAllUsers();
    let updatedUsers;
    if (user.id) {
        updatedUsers = users.map(u => u.id === user.id ? { ...u, ...user } : u);
    } else {
        const newUser: User = {
            id: Date.now(),
            name: user.name || 'New User',
            role: user.role || 'Viewer',
            safetyScore: 0,
            xp: 0,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            password: user.password,
            skills: user.skills || [],
            bloodType: user.bloodType,
            volunteerPoints: user.volunteerPoints || 0,
            permissions: user.permissions || [],
            emergencyContactName: user.emergencyContactName,
            emergencyContactPhone: user.emergencyContactPhone
        };
        updatedUsers = [...users, newUser];
    }
    setCached(USERS_CACHE_KEY, updatedUsers);
    return Promise.resolve(true);
};

export const deleteUser = async (id: number): Promise<boolean> => {
    const users = await fetchAllUsers();
    setCached(USERS_CACHE_KEY, users.filter(u => u.id !== id));
    return Promise.resolve(true);
};

// --- PASSWORD RESET ---

const RESET_CODE_KEY = 'safesphere_reset_code';
const RESET_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes

/** Request password reset - sends code to email or phone. Returns success message. */
export const requestPasswordReset = async (method: 'email' | 'sms', value: string): Promise<{ success: boolean; message: string }> => {
    const users = await fetchAllUsers();
    const normalizedValue = value.trim().toLowerCase();

    let user: User | undefined;
    if (method === 'email') {
        user = users.find(u => u.email?.toLowerCase() === normalizedValue);
        if (!user) return { success: false, message: 'No account found with this email address.' };
    } else {
        const phoneNorm = value.replace(/\D/g, '');
        user = users.find(u => u.phone && u.phone.replace(/\D/g, '') === phoneNorm);
        if (!user) return { success: false, message: 'No account found with this phone number.' };
    }

    // Generate 6-digit code (for demo: 123456 for admin; random for others - log to console for testing)
    const code = user.email?.toLowerCase() === 'admin@safesphere.app' ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
    if (process.env.NODE_ENV === 'development' && code !== '123456') {
        console.log('[Demo] Password reset code:', code);
    }
    setCached(RESET_CODE_KEY, {
        code,
        userId: user.id,
        expiresAt: Date.now() + RESET_CODE_EXPIRY,
        method,
        value: method === 'email' ? user.email : user.phone,
    });

    return {
        success: true,
        message: method === 'email'
            ? `A 6-digit code has been sent to ${user.email}. Check your inbox.`
            : `A 6-digit code has been sent to ${user.phone}. Check your messages.`,
    };
};

/** Verify code and reset password */
export const resetPasswordWithCode = async (code: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const stored = getCached<{ code: string; userId: number; expiresAt: number }>(RESET_CODE_KEY);
    if (!stored) return { success: false, message: 'No reset request found. Please request a new code.' };
    if (Date.now() > stored.expiresAt) return { success: false, message: 'Code has expired. Please request a new code.' };
    if (stored.code !== code.trim()) return { success: false, message: 'Invalid code. Please try again.' };
    if (newPassword.length < 6) return { success: false, message: 'Password must be at least 6 characters.' };

    const users = await fetchAllUsers();
    const user = users.find(u => u.id === stored.userId);
    if (!user) return { success: false, message: 'Account not found.' };

    await saveUser({ id: user.id, password: newPassword });
    try { localStorage.removeItem(RESET_CODE_KEY); } catch { /* ignore */ }
    return { success: true, message: 'Password has been reset successfully. You can now sign in.' };
};

// --- REQUEST ACCOUNT / REGISTRATION ---

export interface PendingRegistration {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    token: string;
    expiresAt: number;
}

const PENDING_REG_KEY = 'safesphere_pending_registrations';

/** Request a new account - stores pending registration and "sends" confirmation email. */
export const requestAccount = async (data: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
}): Promise<{ success: boolean; message: string }> => {
    const users = await fetchAllUsers();
    const emailNorm = data.email.trim().toLowerCase();
    if (users.some(u => u.email?.toLowerCase() === emailNorm)) {
        return { success: false, message: 'An account with this email already exists.' };
    }
    const usernameNorm = data.username.trim().toLowerCase();
    if (users.some(u => u.username?.toLowerCase() === usernameNorm)) {
        return { success: false, message: 'This username is already taken.' };
    }
    if (data.password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters.' };
    }

    const token = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const pending: PendingRegistration = {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        username: data.username.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        password: data.password,
        token,
        expiresAt,
    };

    const all = getCached<PendingRegistration[]>(PENDING_REG_KEY) || [];
    const filtered = all.filter(p => p.email.toLowerCase() !== emailNorm);
    setCached(PENDING_REG_KEY, [...filtered, pending]);

    if (process.env.NODE_ENV === 'development') {
        console.log('[Demo] Confirmation email would be sent to:', data.email);
        console.log('[Demo] Confirm token:', token);
    }

    return {
        success: true,
        message: `A confirmation email has been sent to ${data.email}. Please check your inbox and click the link to activate your account.`,
    };
};

/** Confirm account via email token - creates user and returns user for sign-in. */
export const confirmAccount = async (email: string, token: string): Promise<{ success: boolean; message: string; user?: User }> => {
    const emailNorm = email.trim().toLowerCase();
    const all = getCached<PendingRegistration[]>(PENDING_REG_KEY) || [];
    const pending = all.find(p => p.email.toLowerCase() === emailNorm && p.token === token);
    if (!pending) {
        return { success: false, message: 'Invalid or expired confirmation link. Please request a new account.' };
    }
    if (Date.now() > pending.expiresAt) {
        setCached(PENDING_REG_KEY, all.filter(p => p.email.toLowerCase() !== emailNorm));
        return { success: false, message: 'Confirmation link has expired. Please request a new account.' };
    }

    const users = await fetchAllUsers();
    const newUser: User = {
        id: Math.max(...users.map(u => u.id), 0) + 1,
        name: `${pending.firstName} ${pending.lastName}`.trim(),
        role: 'Viewer',
        safetyScore: 0,
        xp: 0,
        email: pending.email,
        username: pending.username,
        phone: pending.phone || undefined,
        password: pending.password,
        skills: [],
        volunteerPoints: 0,
        permissions: [],
    };
    const updatedUsers = [...users, newUser];
    setCached(USERS_CACHE_KEY, updatedUsers);
    setCached(PENDING_REG_KEY, all.filter(p => p.email.toLowerCase() !== emailNorm));

    return {
        success: true,
        message: 'Your account has been confirmed. You can now sign in.',
        user: newUser,
    };
};

/** Get pending registration by email (for "Confirm & Sign In" flow when token in URL or stored). */
export const getPendingRegistration = (email: string): PendingRegistration | null => {
    const emailNorm = email.trim().toLowerCase();
    const all = getCached<PendingRegistration[]>(PENDING_REG_KEY) || [];
    return all.find(p => p.email.toLowerCase() === emailNorm) || null;
};

// --- ALERTS ---

const ALERTS_CACHE_KEY = 'safesphere_alerts';

export const fetchAlerts = async (): Promise<Alert[]> => {
    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('alerts').select('*').order('id', { ascending: false });
            if (!error && data && data.length > 0) {
                setCached(ALERTS_CACHE_KEY, data as Alert[]);
                return data as Alert[];
            }
        } catch { /* fallback */ }
    }
    if (!USE_MOCK_DATA) {
        try {
            const res = await fetch(`${API_URL}?action=getAlerts`);
            const data = await res.json();
            setCached(ALERTS_CACHE_KEY, data);
            return data;
        } catch { /* fallback */ }
    }
    const cached = getCached<Alert[]>(ALERTS_CACHE_KEY);
    if (cached?.length) return cached;
    setCached(ALERTS_CACHE_KEY, MOCK_ALERTS);
    return MOCK_ALERTS;
};

// --- RESOURCES ---

// safesphere_postgres uses camelCase: operatingHours, contactPerson, contactPhone, inFloodZone
const toResource = (row: Record<string, unknown>): Resource => ({
    id: row.id as number,
    name: row.name as string,
    type: row.type as Resource['type'],
    address: row.address as string,
    description: row.description as string | undefined,
    phone: row.phone as string,
    lat: row.lat as number,
    lng: row.lng as number,
    capacity: row.capacity as number | undefined,
    occupancy: row.occupancy as number | undefined,
    operatingHours: (row.operatingHours ?? row.operating_hours) as string | undefined,
    notes: row.notes as string | undefined,
    contactPerson: (row.contactPerson ?? row.contact_person) as string | undefined,
    contactPhone: (row.contactPhone ?? row.contact_phone) as string | undefined,
    urgency: (row.urgency as Resource['urgency']) || 'Low',
    inFloodZone: (row.inFloodZone ?? row.in_flood_zone) as boolean | undefined,
});

export const fetchResources = async (): Promise<Resource[]> => {
    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('resources').select('*').order('id');
            if (!error && data && data.length > 0) {
                const items = data.map(toResource);
                setCached(RESOURCES_CACHE_KEY, items);
                return items;
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<Resource[]>(RESOURCES_CACHE_KEY);
    if (cached?.length) return cached;
    if (USE_MOCK_DATA) {
        setCached(RESOURCES_CACHE_KEY, MOCK_RESOURCES);
        return MOCK_RESOURCES;
    }
    try {
        const res = await fetch(`${API_URL}?action=getResources`);
        const data = await res.json();
        setCached(RESOURCES_CACHE_KEY, data);
        return data;
    } catch {
        return getCached<Resource[]>(RESOURCES_CACHE_KEY) || [];
    }
};

export const submitResource = async (data: Partial<Resource>): Promise<boolean> => {
    const resourceId = data.id || Math.floor(Math.random() * 1000000);
    const newResource: Resource = {
        id: resourceId,
        name: data.name || 'New Resource',
        type: data.type || 'shelter',
        address: data.address || '',
        description: data.description,
        phone: data.phone || '',
        lat: data.lat || 0,
        lng: data.lng || 0,
        capacity: data.capacity,
        occupancy: data.occupancy || 0,
        operatingHours: data.operatingHours,
        notes: data.notes,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        urgency: data.urgency || 'Low',
        inFloodZone: data.inFloodZone
    };
    const current = await fetchResources();
    const updated = data.id ? current.map(r => r.id === resourceId ? newResource : r) : [newResource, ...current];
    setCached(RESOURCES_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('resources').upsert({
                id: newResource.id, name: newResource.name, type: newResource.type, address: newResource.address,
                description: newResource.description, phone: newResource.phone, lat: newResource.lat, lng: newResource.lng,
                capacity: newResource.capacity, occupancy: newResource.occupancy, operatingHours: newResource.operatingHours,
                notes: newResource.notes, contactPerson: newResource.contactPerson, contactPhone: newResource.contactPhone,
                urgency: newResource.urgency, inFloodZone: newResource.inFloodZone
            });
        } catch { /* saved locally */ }
    }
    return true;
};

export const deleteResource = async (id: number): Promise<boolean> => {
    const current = await fetchResources();
    const updated = current.filter(r => r.id !== id);
    setCached(RESOURCES_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('resources').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

// --- INCIDENT REPORTS ---

const REPORTS_CACHE_KEY = 'safesphere_reports_v6_myanmar';

// safesphere_postgres uses camelCase columns for incident_reports
const toReport = (row: Record<string, unknown>): IncidentReport => ({
    id: row.id as number,
    type: row.type as string,
    description: row.description as string,
    lat: row.lat as number,
    lng: row.lng as number,
    status: row.status as IncidentReport['status'],
    timestamp: row.timestamp as string,
    urgency: row.urgency as IncidentReport['urgency'],
    department: row.department as string | undefined,
    structuralDamage: (row.structuralDamage ?? row.structural_damage) as string | undefined,
    estRepairDays: (row.estRepairDays ?? row.est_repair_days) as number | undefined,
    estCost: (row.estCost ?? row.est_cost) as number | undefined,
    repeatable: row.repeatable as boolean | undefined,
    situationDiscussed: (row.situationDiscussed ?? row.situation_discussed) as boolean | undefined,
    mitigationPlan: (row.mitigationPlan ?? row.mitigation_plan) as string | undefined,
    contactPerson: (row.contactPerson ?? row.contact_person) as string | undefined,
    contactPhone: (row.contactPhone ?? row.contact_phone) as string | undefined,
    image: row.image as string | undefined,
    video: row.video as string | undefined,
    audio: row.audio as string | undefined,
    adminNotes: (row.adminNotes ?? row.admin_notes) as string | undefined,
    comments: row.comments as IncidentReport['comments'],
    reporterId: (row.reporterId ?? row.reporter_id) as number | undefined,
});

const toReportRow = (r: IncidentReport): Record<string, unknown> => ({
    id: r.id, type: r.type, description: r.description, lat: r.lat, lng: r.lng, status: r.status, timestamp: r.timestamp,
    urgency: r.urgency, department: r.department, structuralDamage: r.structuralDamage, estRepairDays: r.estRepairDays,
    estCost: r.estCost, repeatable: r.repeatable, situationDiscussed: r.situationDiscussed, mitigationPlan: r.mitigationPlan,
    contactPerson: r.contactPerson, contactPhone: r.contactPhone, image: r.image, video: r.video, audio: r.audio,
    adminNotes: r.adminNotes,
});

export const fetchReports = async (): Promise<IncidentReport[]> => {
    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('incident_reports').select('*').order('id', { ascending: false });
            if (!error && data && data.length > 0) {
                const items = data.map(toReport);
                setCached(REPORTS_CACHE_KEY, items);
                return items;
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<IncidentReport[]>(REPORTS_CACHE_KEY);
    if (cached?.length) return cached;
    if (USE_MOCK_DATA) {
        setCached(REPORTS_CACHE_KEY, MOCK_REPORTS);
        return MOCK_REPORTS;
    }
    try {
        const res = await fetch(`${API_URL}?action=getReports`);
        const data = await res.json();
        setCached(REPORTS_CACHE_KEY, data);
        return data;
    } catch {
        return cached || [];
    }
};

export const submitReport = async (data: Partial<IncidentReport>): Promise<boolean> => {
    const reportId = data.id || Math.floor(Math.random() * 1000000);
    const newReport: IncidentReport = {
        id: reportId,
        type: data.type || 'General',
        description: data.description || '',
        lat: data.lat || 0,
        lng: data.lng || 0,
        status: data.status || 'pending',
        timestamp: data.timestamp || new Date().toLocaleTimeString(),
        urgency: data.urgency,
        department: data.department,
        structuralDamage: data.structuralDamage,
        estRepairDays: data.estRepairDays,
        estCost: data.estCost,
        repeatable: data.repeatable,
        situationDiscussed: data.situationDiscussed,
        mitigationPlan: data.mitigationPlan,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        image: data.image,
        video: data.video,
        audio: data.audio,
        adminNotes: data.adminNotes,
        comments: data.comments,
        reporterId: data.reporterId
    };
    const current = await fetchReports();
    const existing = current.length > 0 ? current : [...MOCK_REPORTS];
    const updated = data.id ? existing.map(r => r.id === reportId ? newReport : r) : [newReport, ...existing];
    setCached(REPORTS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('incident_reports').upsert(toReportRow(newReport));
        } catch { /* saved locally */ }
    }
    return true;
};

export const updateReportStatus = async (id: number, status: IncidentReport['status'], notes?: string): Promise<boolean> => {
    const reports = await fetchReports();
    const updated = reports.map(r => r.id === id ? { ...r, status, adminNotes: notes || r.adminNotes } : r);
    setCached(REPORTS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('incident_reports').update({ status, adminNotes: notes }).eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

export const deleteReport = async (id: number): Promise<boolean> => {
    const current = await fetchReports();
    const updated = current.filter(r => r.id !== id);
    setCached(REPORTS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('incident_reports').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

/** Fetch reports submitted by the current user. Derived from main reports list. */
export const fetchMyReports = async (reporterId?: number): Promise<IncidentReport[]> => {
    const reports = await fetchReports();
    if (reporterId == null) {
        const saved = localStorage.getItem('safesphere_user');
        let userId: number | undefined;
        try {
            if (saved) {
                const user = JSON.parse(saved);
                userId = user?.id;
            }
        } catch { /* ignore */ }
        if (userId == null) return reports;
        return reports.filter(r => r.reporterId === userId);
    }
    return reports.filter(r => r.reporterId === reporterId);
};

// --- CHECKLIST & DRILLS ---

const CHECKLIST_CACHE_KEY = 'safesphere_checklist_v3_15items';
const DRILLS_CACHE_KEY = 'safesphere_drills';

export const fetchChecklist = async (): Promise<ChecklistItem[]> => {
    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('checklist').select('*').order('id');
            if (!error && data && data.length > 0) {
                const items = data as ChecklistItem[];
                setCached(CHECKLIST_CACHE_KEY, items);
                return items;
            }
        } catch { /* fallback to cache */ }
    }
    const cached = getCached<ChecklistItem[]>(CHECKLIST_CACHE_KEY);
    if (cached && cached.length > 0) return cached;
    setCached(CHECKLIST_CACHE_KEY, MOCK_CHECKLIST);
    return MOCK_CHECKLIST;
};

export const submitChecklist = async (data: Partial<ChecklistItem>): Promise<boolean> => {
    const items = await fetchChecklist();
    const newItem: ChecklistItem = data.id
        ? { ...items.find(i => i.id === data.id)!, ...data } as ChecklistItem
        : { ...data, id: Date.now(), completed: false } as ChecklistItem;
    const updated = data.id ? items.map(i => i.id === data.id ? newItem : i) : [...items, newItem];
    setCached(CHECKLIST_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('checklist').upsert({ id: newItem.id, title: newItem.title, xp: newItem.xp, completed: newItem.completed });
        } catch { /* saved locally */ }
    }
    return true;
};

export const deleteChecklist = async (id: number): Promise<boolean> => {
    const items = await fetchChecklist();
    const updated = items.filter(i => i.id !== id);
    setCached(CHECKLIST_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('checklist').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

export const fetchDrills = async (): Promise<DrillSession[]> => {
    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('drills').select('*').order('id');
            if (!error && data && data.length > 0) {
                setCached(DRILLS_CACHE_KEY, data as DrillSession[]);
                return data as DrillSession[];
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<DrillSession[]>(DRILLS_CACHE_KEY);
    if (cached && cached.length > 0) return cached;
    setCached(DRILLS_CACHE_KEY, MOCK_DRILLS);
    return MOCK_DRILLS;
};

export const submitDrill = async (data: Partial<DrillSession>): Promise<boolean> => {
    const items = await fetchDrills();
    const newItem: DrillSession = data.id
        ? { ...items.find(i => i.id === data.id)!, ...data } as DrillSession
        : { ...data, id: Date.now() } as DrillSession;
    const updated = data.id ? items.map(i => i.id === data.id ? newItem : i) : [...items, newItem];
    setCached(DRILLS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('drills').upsert({
                id: newItem.id, title: newItem.title, date: newItem.date, type: newItem.type,
                status: newItem.status, participants: newItem.participants, notes: newItem.notes
            });
        } catch { /* saved locally */ }
    }
    return true;
};

export const deleteDrill = async (id: number): Promise<boolean> => {
    const items = await fetchDrills();
    const updated = items.filter(i => i.id !== id);
    setCached(DRILLS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('drills').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

// --- LEARN ITEMS ---

const LEARN_ITEMS_CACHE_KEY = 'safesphere_learn_items';

export const fetchLearnItems = async (): Promise<LearnItem[]> => {
    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('learn_items').select('*').order('id');
            if (!error && data && data.length > 0) {
                setCached(LEARN_ITEMS_CACHE_KEY, data as LearnItem[]);
                return data as LearnItem[];
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<LearnItem[]>(LEARN_ITEMS_CACHE_KEY);
    if (cached && cached.length > 0) return cached;
    setCached(LEARN_ITEMS_CACHE_KEY, [...MOCK_LEARN_ITEMS]);
    return [...MOCK_LEARN_ITEMS];
};

export const submitLearnItem = async (data: Partial<LearnItem>): Promise<boolean> => {
    const current = await fetchLearnItems();
    const newItem: LearnItem = data.id
        ? { ...current.find(l => l.id === data.id)!, ...data } as LearnItem
        : { id: Date.now(), title: data.title || 'New Learn Item', description: data.description || '', url: data.url || '', type: data.type || 'guide' };
    const updated = data.id ? current.map(l => l.id === data.id ? newItem : l) : [...current, newItem];
    setCached(LEARN_ITEMS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('learn_items').upsert({ id: newItem.id, title: newItem.title, description: newItem.description, url: newItem.url, type: newItem.type });
        } catch { /* saved locally */ }
    }
    return true;
};

export const deleteLearnItem = async (id: number): Promise<boolean> => {
    const current = await fetchLearnItems();
    const updated = current.filter(l => l.id !== id);
    setCached(LEARN_ITEMS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('learn_items').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

// --- TUTORIALS ---

const TUTORIALS_CACHE_KEY = 'safesphere_tutorials';
const TUTORIAL_PROGRESS_KEY = 'safesphere_tutorial_progress';

const toTutorial = (row: { xp_reward?: number; [k: string]: unknown }): Tutorial => ({
    id: row.id as number,
    title: row.title as string,
    description: row.description as string,
    source: row.source as 'YouTube' | 'External',
    url: row.url as string,
    xpReward: Number(row.xp_reward ?? row.xpReward ?? 25) || 25,
});

export const fetchTutorials = async (): Promise<Tutorial[]> => {
    if (useSupabase() && supabase) {
        try {
            const { data, error } = await supabase.from('tutorials').select('*').order('id');
            if (!error && data && data.length > 0) {
                const items = data.map(toTutorial);
                setCached(TUTORIALS_CACHE_KEY, items);
                return items;
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<Tutorial[]>(TUTORIALS_CACHE_KEY);
    if (cached && cached.length > 0) return cached;
    setCached(TUTORIALS_CACHE_KEY, [...MOCK_TUTORIALS]);
    return [...MOCK_TUTORIALS];
};

export const submitTutorial = async (data: Partial<Tutorial>): Promise<boolean> => {
    const current = await fetchTutorials();
    const newTutorial: Tutorial = data.id
        ? { ...current.find(t => t.id === data.id)!, ...data } as Tutorial
        : { id: Date.now(), title: data.title || 'New Tutorial', description: data.description || '', source: data.source || 'External', url: data.url || '', xpReward: data.xpReward ?? 25 };
    const updated = data.id ? current.map(t => t.id === data.id ? newTutorial : t) : [...current, newTutorial];
    setCached(TUTORIALS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('tutorials').upsert({ id: newTutorial.id, title: newTutorial.title, description: newTutorial.description, source: newTutorial.source, url: newTutorial.url, xp_reward: newTutorial.xpReward });
        } catch { /* saved locally */ }
    }
    return true;
};

export const deleteTutorial = async (id: number): Promise<boolean> => {
    const current = await fetchTutorials();
    const updated = current.filter(t => t.id !== id);
    setCached(TUTORIALS_CACHE_KEY, updated);
    if (useSupabase() && supabase) {
        try {
            await supabase.from('tutorials').delete().eq('id', id);
        } catch { /* saved locally */ }
    }
    return true;
};

export const fetchTutorialProgress = async (): Promise<number[]> => {
    const saved = localStorage.getItem('safesphere_user');
    let userId = 1;
    try {
        if (saved) {
            const user = JSON.parse(saved);
            if (user?.id) userId = user.id;
        }
    } catch { /* ignore */ }
    if (useSupabase() && supabase) {
        try {
            const { data } = await supabase.from('tutorial_progress').select('completed_ids').eq('user_id', userId).single();
            if (data?.completed_ids && Array.isArray(data.completed_ids)) {
                setCached(TUTORIAL_PROGRESS_KEY, data.completed_ids);
                return data.completed_ids;
            }
        } catch { /* fallback */ }
    }
    const cached = getCached<number[]>(TUTORIAL_PROGRESS_KEY);
    return cached || [];
};

export const completeTutorial = async (id: number): Promise<boolean> => {
    const completed = await fetchTutorialProgress();
    if (completed.includes(id)) return true;
    const updated = [...completed, id];
    setCached(TUTORIAL_PROGRESS_KEY, updated);
    const saved = localStorage.getItem('safesphere_user');
    const userId = saved ? (JSON.parse(saved)?.id ?? 1) : 1;
    if (useSupabase() && supabase) {
        try {
            await supabase.from('tutorial_progress').upsert({ user_id: userId, completed_ids: updated, updated_at: new Date().toISOString() });
        } catch { /* saved locally */ }
    }
    return true;
};

// --- INVENTORY ---

export const fetchInventory = async (): Promise<InventoryItem[]> => {
    const CACHE_KEY = 'safesphere_inventory';
    const cached = getCached<InventoryItem[]>(CACHE_KEY);
    if (cached) return Promise.resolve(cached);
    setCached(CACHE_KEY, MOCK_INVENTORY);
    return Promise.resolve(MOCK_INVENTORY);
};

export const submitInventory = async (item: Partial<InventoryItem>): Promise<boolean> => {
    const items = await fetchInventory();
    let updated;
    if (item.id) {
        updated = items.map(i => i.id === item.id ? { ...i, ...item } : i);
    } else {
        updated = [...items, { ...item, id: Date.now() } as InventoryItem];
    }
    setCached('safesphere_inventory', updated);
    return Promise.resolve(true);
};

export const deleteInventoryItem = async (id: number): Promise<boolean> => {
    const current = getCached<InventoryItem[]>('safesphere_inventory') || MOCK_INVENTORY;
    const updated = current.filter(i => i.id !== id);
    setCached('safesphere_inventory', updated);
    return Promise.resolve(true);
};

// --- INJURIES ---

export const fetchInjuries = async (): Promise<InjuryCase[]> => {
     const CACHE_KEY = 'safesphere_injuries';
     const cached = getCached<InjuryCase[]>(CACHE_KEY);
     if (cached) return Promise.resolve(cached);
     setCached(CACHE_KEY, MOCK_INJURIES);
     return Promise.resolve(MOCK_INJURIES);
};

export const submitInjury = async (injury: Partial<InjuryCase>): Promise<boolean> => {
    const injuries = await fetchInjuries();
    let updated;
    if (injury.id) {
        updated = injuries.map(i => i.id === injury.id ? { ...i, ...injury } : i);
    } else {
        updated = [...injuries, { ...injury, id: Date.now() } as InjuryCase];
    }
    setCached('safesphere_injuries', updated);
    return Promise.resolve(true);
};

export const deleteInjuryCase = async (id: number): Promise<boolean> => {
    const current = getCached<InjuryCase[]>('safesphere_injuries') || MOCK_INJURIES;
    const updated = current.filter(i => i.id !== id);
    setCached('safesphere_injuries', updated);
    return Promise.resolve(true);
};

// --- MAP DATA (Earthquake & Safety Assets) ---

/** USGS feed URLs by time range – live earthquake data */
const USGS_FEED_URLS: Record<string, string> = {
    '24h': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    '7d': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
    '1M': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson'
};

/** Cache TTL in ms – refresh live data every 2 minutes */
const EARTHQUAKE_CACHE_TTL_MS = 2 * 60 * 1000;

const getCachedWithTTL = <T>(key: string, ttlMs: number): { data: T; fresh: boolean } | null => {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const parsed = JSON.parse(item) as { data: T; ts: number };
        if (!parsed.data || typeof parsed.ts !== 'number') return null;
        const age = Date.now() - parsed.ts;
        return { data: parsed.data, fresh: age < ttlMs };
    } catch {
        return null;
    }
};

const setCachedWithTTL = <T>(key: string, data: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) {
        console.error("Error writing to localStorage", e);
    }
};

/**
 * Fetch live earthquake data from USGS for the given time range.
 * Used by Home for Active Alerts and Incident Frequency chart.
 */
export const fetchEarthquakesByRange = async (range: '24h' | '7d' | '1M' | '1Y'): Promise<EarthquakeEvent[]> => {
    const CACHE_KEY = `safesphere_earthquakes_${range}`;

    if (navigator.onLine) {
        try {
            if (range === '1Y') {
                const end = new Date();
                const start = new Date();
                start.setFullYear(start.getFullYear() - 1);
                const startTime = start.toISOString().split('T')[0];
                const endTime = end.toISOString().split('T')[0];
                const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&endtime=${endTime}&minmagnitude=2.5`;
                const res = await fetch(url);
                const data = await res.json();
                const events = (data.features || []) as EarthquakeEvent[];
                setCachedWithTTL(CACHE_KEY, events);
                return events;
            }
            const url = USGS_FEED_URLS[range];
            if (url) {
                const res = await fetch(url);
                const data = await res.json();
                const events = (data.features || []) as EarthquakeEvent[];
                setCachedWithTTL(CACHE_KEY, events);
                return events;
            }
        } catch (e) {
            console.error("Failed to fetch USGS earthquake data", e);
        }
    }

    const cached = getCachedWithTTL<EarthquakeEvent[]>(CACHE_KEY, 24 * 60 * 60 * 1000);
    return cached?.data ?? [];
};

export const fetchEarthquakes = async (): Promise<EarthquakeEvent[]> => {
    return fetchEarthquakesByRange('24h');
};

export const fetchSafetyAssets = async (): Promise<SafetyAsset[]> => {
    const CACHE_KEY = 'safesphere_safety_assets_peoples_park'; // Bumped: relocated to People's Park
    const cached = getCached<SafetyAsset[]>(CACHE_KEY);
    if (cached) return Promise.resolve(cached);

    // Safety assets at People's Park, Yangon (near Shwedagon; Pyay Rd, U Wisara Rd, Dhammazedi Rd, Ahlone Rd)
    const mockAssets: SafetyAsset[] = [
        { id: 1, type: 'meeting_point', lat: 16.7940, lng: 96.1410, label: 'Assembly Area A', building: "People's Park", floor: 'G' },
        { id: 2, type: 'exit', lat: 16.7955, lng: 96.1405, label: 'North Exit', building: "People's Park", floor: '1' },
        { id: 3, type: 'extinguisher', lat: 16.7935, lng: 96.1390, label: 'Hallway 1', building: "People's Park", floor: '2' },
        { id: 4, type: 'extinguisher', lat: 16.7925, lng: 96.1400, label: 'Lobby', building: "People's Park", floor: 'G' },
        { id: 5, type: 'extinguisher', lat: 16.7920, lng: 96.1415, label: 'Cafeteria', building: "People's Park", floor: '1' },
        { id: 6, type: 'exit', lat: 16.7910, lng: 96.1395, label: 'South Exit', building: "People's Park", floor: '1' },
        { 
            id: 7, 
            type: 'route', 
            lat: 0, 
            lng: 0, 
            building: "People's Park",
            floor: '1',
            label: 'Evacuation Path A',
            routePoints: [
                [16.7915, 96.1390], 
                [16.7930, 96.1395], 
                [16.7945, 96.1405]
            ]
        },
        {
            id: 8,
            type: 'road',
            lat: 0,
            lng: 0,
            label: 'Emergency Access Rd',
            routePoints: [
                [16.7905, 96.1390],
                [16.7920, 96.1400],
                [16.7940, 96.1410]
            ]
        }
    ];

    setCached(CACHE_KEY, mockAssets);
    return Promise.resolve(mockAssets);
};

export const submitSafetyAsset = async (asset: Partial<SafetyAsset>): Promise<boolean> => {
    const assets = await fetchSafetyAssets();
    let updated;
    if (asset.id && asset.id !== 0) {
        updated = assets.map(a => a.id === asset.id ? { ...a, ...asset } : a);
    } else {
        updated = [...assets, { ...asset, id: Date.now() } as SafetyAsset];
    }
    setCached('safesphere_safety_assets', updated);
    return Promise.resolve(true);
};

export const deleteSafetyAsset = async (id: number): Promise<boolean> => {
    const assets = await fetchSafetyAssets();
    const updated = assets.filter(a => a.id !== id);
    setCached('safesphere_safety_assets', updated);
    return Promise.resolve(true);
};
