import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

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

const readStoredUser = (): User | null => {
    try {
        const saved = localStorage.getItem('safesphere_user');
        if (!saved) return null;
        const parsed = JSON.parse(saved) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        const u = parsed as Record<string, unknown>;
        const id = u.id;
        if (id === undefined || id === null) return null;
        if (typeof u.name !== 'string') return null;
        return parsed as User;
    } catch {
        localStorage.removeItem('safesphere_user');
        return null;
    }
};

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => readStoredUser());

    const isAuthenticated = user !== null;

    useEffect(() => {
        if (user) {
            localStorage.setItem('safesphere_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('safesphere_user');
        }
    }, [user]);

    const login = (userData: User) => {
        setUser(userData);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('safesphere_user');
        localStorage.removeItem('safesphere_token');
    };

    const updateUser = (updates: Partial<User>) => {
        if (user) {
            const updatedUser = { ...user, ...updates };
            setUser(updatedUser);
        }
    };

    return (
        <UserContext.Provider value={{ user, isAuthenticated, login, logout, updateUser }}>
            {children}
        </UserContext.Provider>
    );
};
