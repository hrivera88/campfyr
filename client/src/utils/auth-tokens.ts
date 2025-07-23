import { jwtDecode } from 'jwt-decode';
import axios from 'axios';

export function isTokenExpired(token: string | null): boolean { 
    if (!token) return true;
    try {
        const decoded = jwtDecode<{ exp: number }>(token);
        // Add 30-second buffer to account for network latency
        return Date.now() >= (decoded.exp * 1000) - 30000;
    } catch { 
        return true;
    }
}

export function getTokenExpirationTime(token: string | null): number | null {
    if (!token) return null;
    try {
        const decoded = jwtDecode<{ exp: number }>(token);
        return decoded.exp * 1000;
    } catch {
        return null;
    }
}

export function getTimeUntilExpiry(token: string | null): number | null {
    const expirationTime = getTokenExpirationTime(token);
    if (!expirationTime) return null;
    
    return Math.max(0, expirationTime - Date.now());
}

export async function refreshAccessToken(): Promise<string | null> {
    try { 
        // Use axios directly to avoid circular dependency with interceptors
        const response = await axios.post('/api/auth/refresh', {}, {
            baseURL: import.meta.env.VITE_API_URL,
            withCredentials: true
        });

        const { token } = response.data;

        if (token) {
            localStorage.setItem('token', token);
            console.log('Token refreshed successfully');
            
            // Dispatch event for other parts of app to know token was refreshed
            window.dispatchEvent(new CustomEvent('auth:token-refreshed', { detail: { token } }));
        }

        return token;
    } catch (error) { 
        console.warn('Failed to refresh token:', error);
        
        // Clear invalid token
        localStorage.removeItem('token');
        
        // Emit logout event
        window.dispatchEvent(new CustomEvent('auth:logout'));
        
        return null;
    }
}