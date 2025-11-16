
'use client';

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    name: string;
    role: 'admin' | 'sub-admin' | 'member';
}

interface AuthContextType {
    user: User | null;
    isMounted: boolean;
    login: (user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsMounted(true);
        try {
            const storedUser = sessionStorage.getItem('user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error("Failed to parse user from session storage", error);
            sessionStorage.removeItem('user');
        }
    }, []);

    const login = useCallback((user: User) => {
        sessionStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        if (user.role === 'admin' || user.role === 'sub-admin') {
            router.push('/admin');
        } else {
            router.push('/');
        }
    }, [router]);

    const logout = useCallback(() => {
        sessionStorage.removeItem('user');
        setUser(null);
        router.push('/login');
    }, [router]);

    const value = { user, isMounted, login, logout };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
