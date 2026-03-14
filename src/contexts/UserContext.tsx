import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types';
import { encryptData, decryptData, sanitiseUserForStorage } from '../services/crypto';
import { signOutSupabase, getSupabaseSessionUser } from '../services/auth';
import { isSupabaseReady } from '../services/supabase';

const STORAGE_KEY = 'safesphere_user_enc';

interface UserContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (userData: User) => void;
    logout: () => void;
    updateUser: (updates: Partial<User>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};

interface UserProviderProps {
    children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) { setLoaded(true); return; }

                const decrypted = await decryptData<User>(raw);
                if (decrypted?.id && typeof decrypted.name === 'string') {
                    setUser(decrypted);
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
            setLoaded(true);
        })();
    }, []);

    // After load: if no user in storage but Supabase has a session (e.g. OAuth return), log that user in
    useEffect(() => {
        if (!loaded || user) return;
        if (!isSupabaseReady()) return;
        getSupabaseSessionUser().then((supabaseUser) => {
            if (supabaseUser) {
                const { password: _, ...safe } = supabaseUser as User & { password?: string };
                setUser(safe as User);
            }
        });
    }, [loaded, user]);

    const persistUser = useCallback(async (u: User | null) => {
        if (u) {
            const safe = sanitiseUserForStorage(u as User & Record<string, unknown>);
            const encrypted = await encryptData(safe);
            localStorage.setItem(STORAGE_KEY, encrypted);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        if (!loaded) return;
        persistUser(user);
    }, [user, loaded, persistUser]);

    const isAuthenticated = user !== null;

    const login = (userData: User) => {
        const { password: _, ...safe } = userData as User & { password?: string };
        setUser(safe as User);
    };

    const logout = () => {
        setUser(null);
        signOutSupabase();
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('safesphere_user');
        localStorage.removeItem('safesphere_token');
    };

    const updateUser = (updates: Partial<User>) => {
        if (user) {
            const { password: _, ...safeUpdates } = updates as Partial<User> & { password?: string };
            setUser({ ...user, ...safeUpdates });
        }
    };

    if (!loaded) return null;

    return (
        <UserContext.Provider value={{ user, isAuthenticated, login, logout, updateUser }}>
            {children}
        </UserContext.Provider>
    );
};
