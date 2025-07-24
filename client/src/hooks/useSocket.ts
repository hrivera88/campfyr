import { useEffect, useState, useRef } from 'react';
import { connectSocket } from '../lib/socket';
import { Socket } from 'socket.io-client';

export function useSocket() { 
    const [socket, setSocket] = useState<Socket | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => { 
        let isMounted = true;

        const init = async () => {
            try {
                const sock = await connectSocket();
                if (isMounted && sock) {
                    socketRef.current = sock;
                    setSocket(sock);
                }
            } catch (error) {
                // Handle connection errors gracefully - socket remains null
                console.warn('Socket connection failed:', error);
            }
        }
        init();
        return () => { 
            isMounted = false;
            try {
                if (socketRef.current && typeof socketRef.current.disconnect === 'function') {
                    socketRef.current.disconnect();
                }
            } catch (error) {
                console.warn('Socket disconnect error:', error);
            }
        }
    }, []);
    
    return socket;
}