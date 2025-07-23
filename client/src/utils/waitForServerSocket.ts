import type { Server, Socket as ServerSocket } from "socket.io";

export const waitForServerSocket = (io: Server): Promise<ServerSocket> => {
    return new Promise<ServerSocket>((resolve) => { 
        io.once('connection', (socket) => { 
            resolve(socket);
        });
    })
}