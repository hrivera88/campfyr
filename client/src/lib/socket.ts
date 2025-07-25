import { io, Socket } from 'socket.io-client';
import { isTokenExpired, refreshAccessToken } from '../utils/auth-tokens';

let socket: Socket | null = null;
const maxReconnectAttempts = 5;

export async function connectSocket(): Promise<Socket | null> {
    // Disconnect existing socket if any
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    let token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
        try { 
            token = await refreshAccessToken();
        } catch (error) {
            console.warn('Token refresh failed during socket connection:', error);
            return null;
        }
    }

    if (!token) {
        console.warn('Socket connection blocked: No valid token.');
        return null;
    }

    socket = io("http://localhost:3001", {
        auth: { token },
        transports: ['websocket', 'polling'], // Restore WebSocket with polling fallback
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts
    });

    // Wait for connection before returning
    return new Promise((resolve, reject) => {
        socket!.on('connect', () => {
            // Make socket available globally for debugging
            (window as any).socket = socket;
            resolve(socket);
        });

        socket!.on('connect_error', (error) => {
            reject(error);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            if (!socket!.connected) {
                reject(new Error('Socket connection timeout'));
            }
        }, 10000);
    });
}

export function getSocket(): Socket | null {
    return socket;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}