/* Offline queue for write operations that fail while the device is offline.
   Goal: persist changes locally and replay them once the browser is back online. */

import type { ChecklistItem, DrillSession, IncidentReport } from '../types';

export type OfflineQueueActionType =
    | 'submitReport'
    | 'updateReportStatus'
    | 'submitChecklist'
    | 'submitDrill';

export type OfflineQueueActionPayload =
    | IncidentReport
    | Partial<IncidentReport>
    | { id: string; status: IncidentReport['status']; notes?: string }
    | ChecklistItem
    | Partial<ChecklistItem>
    | DrillSession
    | Partial<DrillSession>;

export interface OfflineQueueAction {
    id: string;
    type: OfflineQueueActionType;
    payload: OfflineQueueActionPayload;
    createdAt: number;
    attempts: number;
    lastError?: string;
}

const DB_NAME = 'safesphere_offline_queue_db';
const STORE_NAME = 'actions';
const DB_VERSION = 1;

let suppressEnqueue = false;

export function setOfflineQueueSuppressed(value: boolean): void {
    suppressEnqueue = value;
}

export function isOfflineQueueSuppressed(): boolean {
    return suppressEnqueue;
}

function genId(): string {
    // Avoid relying on `crypto` so SSR/build-time environments do not fail.
    return `oq_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not available'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function putAction(action: OfflineQueueAction): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(action);
    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function getAllActions(): Promise<OfflineQueueAction[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    const result = await new Promise<OfflineQueueAction[]>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result as OfflineQueueAction[]);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return result || [];
}

async function deleteAction(id: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

export async function enqueueOfflineAction(type: OfflineQueueActionType, payload: OfflineQueueActionPayload): Promise<void> {
    if (suppressEnqueue) return;
    if (typeof window === 'undefined') return;

    try {
        const action: OfflineQueueAction = {
            id: genId(),
            type,
            payload,
            createdAt: Date.now(),
            attempts: 0,
        };
        await putAction(action);
    } catch (e) {
        // If queue persistence fails, we still keep the optimistic local cache updates.
        console.error('[offlineQueue] enqueue failed:', e);
    }
}

export async function getOfflineQueueSummary(): Promise<{ pendingCount: number; failedCount: number }> {
    try {
        const actions = await getAllActions();
        const failedCount = actions.filter(a => a.attempts >= 3).length;
        return { pendingCount: actions.length, failedCount };
    } catch {
        return { pendingCount: 0, failedCount: 0 };
    }
}

async function updateAttemptsAndError(id: string, attempts: number, lastError?: string): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const stored = await new Promise<OfflineQueueAction | undefined>((resolve) => {
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result as OfflineQueueAction | undefined);
            req.onerror = () => resolve(undefined);
        });
        if (stored) {
            stored.attempts = attempts;
            stored.lastError = lastError;
            tx.objectStore(STORE_NAME).put(stored);
        }
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (e) {
        console.error('[offlineQueue] updateAttemptsAndError failed:', e);
    }
}

export async function syncOfflineQueue(): Promise<{ syncedCount: number; pendingCount: number }> {
    // Only attempt replay when we think we are online.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const { pendingCount } = await getOfflineQueueSummary();
        return { syncedCount: 0, pendingCount };
    }

    setOfflineQueueSuppressed(true);
    try {
        const actions = await getAllActions();
        let syncedCount = 0;

        // Import once to avoid repeated module resolution inside the loop.
        const api = await import('./api');

        // Process sequentially to keep Supabase load predictable and data deterministic.
        for (const a of actions) {
            try {
                switch (a.type) {
                    case 'submitReport':
                        await api.submitReport(a.payload as Partial<IncidentReport>);
                        break;
                    case 'updateReportStatus':
                        await api.updateReportStatus(
                            (a.payload as any).id,
                            (a.payload as any).status,
                            (a.payload as any).notes
                        );
                        break;
                    case 'submitChecklist':
                        await api.submitChecklist(a.payload as Partial<ChecklistItem>);
                        break;
                    case 'submitDrill':
                        await api.submitDrill(a.payload as Partial<DrillSession>);
                        break;
                    default:
                        break;
                }

                await deleteAction(a.id);
                syncedCount += 1;
            } catch (err) {
                const attempts = a.attempts + 1;
                await updateAttemptsAndError(a.id, attempts, err instanceof Error ? err.message : String(err));
            }
        }

        const { pendingCount } = await getOfflineQueueSummary();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('safesphere-offline-queue-synced', { detail: { syncedCount, pendingCount } })
            );
        }
        return { syncedCount, pendingCount };
    } finally {
        setOfflineQueueSuppressed(false);
    }
}

