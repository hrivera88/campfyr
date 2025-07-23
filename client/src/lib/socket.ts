import { io, Socket } from 'socket.io-client';
import { isTokenExpired, refreshAccessToken } from '../utils/auth-tokens';

let socket: Socket | null = null;
let reconnectAttempts = 0;
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
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts
    });

    // Handle authentication errors
    socket.on('connect_error', async (error) => {
        console.warn('Socket connection error:', error.message);
        
        // If authentication failed, try to refresh token and reconnect
        if (error.message.includes('Authentication failed') || error.message.includes('jwt')) {
            if (reconnectAttempts < maxReconnectAttempts) {
                console.log(`Attempting token refresh and reconnection (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
                
                try {
                    const newToken = await refreshAccessToken();
                    if (newToken && socket) {
                        // Update auth and force reconnection
                        socket.auth = { token: newToken };
                        socket.connect();
                        reconnectAttempts++;
                    }
                } catch (refreshError) {
                    console.error('Token refresh failed during reconnection:', refreshError);
                    // Emit logout event if refresh fails
                    window.dispatchEvent(new CustomEvent('auth:logout'));
                }
            } else {
                console.error('Max reconnection attempts reached. Logging out.');
                window.dispatchEvent(new CustomEvent('auth:logout'));
            }
        }
    });

    // Reset reconnection attempts on successful connection
    socket.on('connect', () => {
        console.log('Socket connected successfully');
        reconnectAttempts = 0;
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        
        // If disconnected due to server action or auth issues, try to reconnect with fresh token
        if (reason === 'io server disconnect' || reason.includes('auth')) {
            setTimeout(async () => {
                try {
                    await refreshAccessToken();
                    socket?.connect();
                } catch (error) {
                    console.warn('Could not refresh token for reconnection:', error);
                }
            }, 1000);
        }
    });

    return socket;
}

export function getSocket(): Socket | null {
    return socket;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
        reconnectAttempts = 0;
    }
}