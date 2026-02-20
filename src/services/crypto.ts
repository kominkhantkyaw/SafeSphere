/**
 * Lightweight encryption utilities for localStorage data using AES-GCM (Web Crypto API).
 * Provides defence-in-depth: even if an attacker reads localStorage, the data is encrypted.
 *
 * The encryption key is derived from a device-bound salt stored separately.
 * This is NOT a substitute for server-side security — it raises the bar against
 * casual snooping via browser DevTools or XSS exfiltration of raw localStorage.
 */

const SALT_KEY = 'safesphere_device_salt';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

function getDeviceSalt(): Uint8Array {
    let b64 = localStorage.getItem(SALT_KEY);
    if (b64) {
        return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...salt)));
    return salt;
}

async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
    const passphrase = `safesphere-v1-${navigator.userAgent.slice(0, 32)}`;
    const raw = new TextEncoder().encode(passphrase);
    const baseKey = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
        baseKey,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encryptData(data: unknown): Promise<string> {
    const salt = getDeviceSalt();
    const key = await deriveKey(salt);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, plaintext);
    const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), IV_LENGTH);
    return btoa(String.fromCharCode(...combined));
}

export async function decryptData<T = unknown>(encrypted: string): Promise<T | null> {
    try {
        const salt = getDeviceSalt();
        const key = await deriveKey(salt);
        const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
        const iv = combined.slice(0, IV_LENGTH);
        const ciphertext = combined.slice(IV_LENGTH);
        const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
        return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    } catch {
        return null;
    }
}

export function escapeHtml(str: string | undefined | null): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/** Strip password and other sensitive fields before storing a user object. */
export function sanitiseUserForStorage<T extends Record<string, unknown>>(user: T): Omit<T, 'password'> {
    const { password: _, ...safe } = user;
    return safe as Omit<T, 'password'>;
}
