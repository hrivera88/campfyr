import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from "path";
import { Server } from 'socket.io';
import authRoute from './routes/auth';
import directRoutes from './routes/direct';
import messagesRoute from './routes/messages';
import roomsRoute from './routes/rooms';
import uploadRoute from './routes/upload';
import usersRoute from './routes/user';
import videoRoute from './routes/video';
import { registerSocketEvents } from './socket';

dotenv.config({
    path: process.env.NODE_ENV === "test" ? ".env.test" : process.env.NODE_ENV === "development" ? ".env.development" : ".env"
});

const app = express();
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use('/api/messages', messagesRoute);
app.use('/api/auth', authRoute);
app.use('/api/rooms', roomsRoute);
app.use('/api/direct', directRoutes);
app.use('/api/users', usersRoute);
app.use('/api/video', videoRoute);
app.use('/api/upload', uploadRoute);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
    },
    transports: ['websocket', 'polling']
});

registerSocketEvents(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
