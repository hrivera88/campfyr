import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { PrismaClient } from './generated/prisma';
import { redis } from './redis';
import { saveMessage } from './message-cache';

const prisma = new PrismaClient();
export function registerSocketEvents(io: Server) {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Authentication token missing"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!);
            socket.data.user = decoded;
            next();
        } catch (error) {
            console.error('Socket auth failed: ', error);
            return next(new Error('Invalid or expired token'));
        }
    });
    io.on('connection', async (socket: Socket) => {
        console.log('New client');
        // socket.onAny((event, ...args) => {
        //     console.log(`[Socket ${socket.id}] received event: ${event}`, args);
        // });


        /**
         * User events
         */
        const userId = socket.data.user?.userId;

        if (userId) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    isOnline: true,
                }
            });
        }
        socket.on('disconnect', async (reason) => {
            const { roomId } = socket.data;

            if (userId) {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        isOnline: false,
                        lastSeenAt: new Date(),
                    }
                });
            }
            if (roomId && userId) {
                await redis.srem(`room:${roomId}:users`, userId);
                socket.to(roomId).emit('userLeft', { userId });

                const activeUsers = await redis.smembers(`room:${roomId}:users`);
                io.to(roomId).emit('roomUsers', activeUsers);
            }
            console.log(`Client disconnected: ${socket.id} - Reason ${reason}`);
        })
        /**
         * Chat Room - Socket Events
         */
        socket.on('joinRoom', async (payload) => {
            if (!payload || !payload.roomId || !payload.userId) {
                console.warn(`Invalid joinRoom payload: `, payload);
                return;
            }

            const { roomId, userId } = payload;

            socket.join(roomId);
            socket.data.roomId = roomId;

            await redis.sadd(`room:${roomId}:users`, userId);
            socket.to(roomId).emit('userJoined', { userId });

            const activeUsers = await redis.smembers(`room:${roomId}:users`);
            io.to(roomId).emit('roomUsers', activeUsers);
        });
        socket.on('leaveRoom', async (payload) => {
            if (!payload || !payload.roomId || !payload.userId) {
                console.warn(`Invalid leaveRoom payload: `, payload);
                return;
            }
            const { roomId, userId } = payload;
            socket.leave(roomId);
            await redis.srem(`room:${roomId}:users`, userId);
            socket.to(roomId).emit('userLeft', { userId });

            const activeUsers = await redis.smembers(`room:${roomId}:users`);
            io.to(roomId).emit('roomUsers', activeUsers);
        });


        /**
         * Chat Messages - Socket Events
         */
        socket.on('chat:message', async (data) => {
            const user = socket.data.user;
            const roomId = data.roomId || socket.data.roomId;
            if (!roomId) {
                console.warn('Missing Room ID in chat:message payload');
            }
            const roomExists = await prisma.room.findUnique({
                where: { id: roomId },
                select: { id: true },
            });
            if (!roomExists) {
                console.warn(`Room not found for ID: ${roomId}`);
            }
            const dbUser = await prisma.user.findUnique({
                where: { id: user.userId },
                select: { username: true }
            });
            if (!dbUser) {
                console.warn(`User not found for ID: ${user.userID}`);
                return;
            }
            const message = {
                userId: user.userId,
                content: data.content,
                timestamp: Date.now(),
            };
            try {
                const redisMessage = {
                    userId: user.userId,
                    content: data.content,
                    timestamp: Date.now(),
                    fileUrl: data.fileUrl ?? null,
                    fileName: data.fileName ?? null,
                    mimeType: data.mimeType ?? null,
                };
                await saveMessage(redisMessage, roomId);
                await prisma.message.create({
                    data: {
                        content: redisMessage.content,
                        timestamp: new Date(redisMessage.timestamp),
                        fileName: redisMessage.fileName,
                        fileUrl: redisMessage.fileUrl,
                        mimeType: redisMessage.mimeType,
                        sender: { connect: { id: redisMessage.userId } },
                        room: { connect: { id: roomId } },
                    },
                });
                const chatPayload = {
                    ...redisMessage,
                    username: dbUser.username,
                    roomId,
                };
                io.to(roomId).emit('chat:message', chatPayload);
            } catch (error) {
                console.error('Failed to persist message: ', error)
            }

        });
        socket.on('chat:typing', (user) => {
            socket.to(socket.data.roomId).emit('chat:typing', user);
        });
        socket.on('chat:stopTyping', (user) => {
            socket.to(socket.data.roomId).emit('chat:stopTyping', user);
        });

        /**
         * Direct Messaging - Socket Events
         */
        socket.on('direct:join', async ({ conversationId }) => {
            socket.join(conversationId);
            socket.data.conversationId = conversationId;
            console.log(`User ${userId} joined direct conversation ${conversationId}`);
        });
        socket.on('direct:leave', async ({ conversationId }) => {
            socket.leave(conversationId);
            delete socket.data.conversationId;
            console.log(`User ${userId} left direct conversation ${conversationId}`);
        });
        socket.on('direct:message', async ({ conversationId, content, fileName, fileUrl, mimeType }) => {
            if (!conversationId || (!content && !fileUrl) || !userId) {
                return;
            }
            try {
                const message = await prisma.directMessage.create({
                    data: {
                        content: content ?? null,
                        fileName: fileName ?? null,
                        fileUrl: fileUrl ?? null,
                        mimeType: mimeType ?? null,
                        senderId: userId,
                        conversationId,
                    },
                    include: {
                        sender: {
                            select: { username: true }
                        },
                    },
                });

                const payload = {
                    id: message.id,
                    content: message.content,
                    senderId: message.senderId,
                    username: message.sender.username,
                    timestamp: message.timestamp,
                    conversationId: message.conversationId,
                    fileName: message.fileName,
                    fileUrl: message.fileUrl,
                    mimeType: message.mimeType
                };
                console.log('hal socket serverm ', conversationId);
                io.to(conversationId).emit('direct:message', payload);
            } catch (error) {
                console.error('Failed to send direct message:', error);
            }
        });
        socket.on('direct:typing', ({ conversationId }) => {
            socket.to(conversationId).emit('direct:typing', { userId });
        });
        socket.on('direct:stopTyping', ({ conversationId }) => {
            socket.to(conversationId).emit('direct:stopTyping', { userId });
        });

        /**
         * Video Call Events
         */
        socket.on('video:call:initiate', async ({ conversationId, participantId }) => {
            if (!conversationId || !participantId || !userId) {
                return;
            }

            try {
                // Create video call record
                const videoCall = await prisma.videoCall.create({
                    data: {
                        conversationId,
                        initiatorId: userId,
                        participantId,
                        status: 'pending',
                    },
                    include: {
                        initiator: { select: { username: true } },
                        participant: { select: { username: true } },
                    },
                });

                // Store active call in Redis
                await redis.set(`video:call:${videoCall.id}`, JSON.stringify({
                    id: videoCall.id,
                    conversationId,
                    initiatorId: userId,
                    participantId,
                    status: 'pending',
                    startedAt: new Date().toISOString(),
                }), 'EX', 300); // 5 minute expiry

                // Set user call status
                await redis.set(`user:call:${userId}`, 'calling', 'EX', 300);
                await redis.set(`user:call:${participantId}`, 'ringing', 'EX', 300);

                // Join conversation room
                socket.join(conversationId);

                // Notify participant about incoming call
                io.to(conversationId).emit('video:call:incoming', {
                    videoCallId: videoCall.id,
                    conversationId,
                    initiator: videoCall.initiator,
                    participant: videoCall.participant,
                });

                console.log(`Video call initiated: ${videoCall.id} in conversation ${conversationId}`);
            } catch (error) {
                console.error('Failed to initiate video call:', error);
                socket.emit('video:call:error', { message: 'Failed to initiate call' });
            }
        });

        socket.on('video:call:accept', async ({ videoCallId }) => {
            if (!videoCallId || !userId) {
                return;
            }

            try {
                // Get call from Redis
                const callData = await redis.get(`video:call:${videoCallId}`);
                if (!callData) {
                    socket.emit('video:call:error', { message: 'Call not found or expired' });
                    return;
                }

                const call = JSON.parse(callData);

                // Verify user is the participant
                if (call.participantId !== userId) {
                    socket.emit('video:call:error', { message: 'Unauthorized' });
                    return;
                }

                // Update call status
                await prisma.videoCall.update({
                    where: { id: videoCallId },
                    data: { status: 'active' },
                });

                // Update Redis
                call.status = 'active';
                await redis.set(`video:call:${videoCallId}`, JSON.stringify(call), 'EX', 3600); // 1 hour for active calls

                // Update user call status
                await redis.set(`user:call:${call.initiatorId}`, 'in-call', 'EX', 3600);
                await redis.set(`user:call:${call.participantId}`, 'in-call', 'EX', 3600);

                // Join conversation room
                socket.join(call.conversationId);

                // Notify both users
                io.to(call.conversationId).emit('video:call:accepted', {
                    videoCallId,
                    conversationId: call.conversationId,
                });

                console.log(`Video call accepted: ${videoCallId}`);
            } catch (error) {
                console.error('Failed to accept video call:', error);
                socket.emit('video:call:error', { message: 'Failed to accept call' });
            }
        });

        socket.on('video:call:reject', async ({ videoCallId }) => {
            if (!videoCallId || !userId) {
                return;
            }

            try {
                // Get call from Redis
                const callData = await redis.get(`video:call:${videoCallId}`);
                if (!callData) {
                    return;
                }

                const call = JSON.parse(callData);

                // Verify user is the participant
                if (call.participantId !== userId) {
                    return;
                }

                // Update call status
                await prisma.videoCall.update({
                    where: { id: videoCallId },
                    data: { 
                        status: 'rejected',
                        endedAt: new Date(),
                    },
                });

                // Clean up Redis
                await redis.del(`video:call:${videoCallId}`);
                await redis.del(`user:call:${call.initiatorId}`);
                await redis.del(`user:call:${call.participantId}`);

                // Notify both users
                io.to(call.conversationId).emit('video:call:rejected', {
                    videoCallId,
                    conversationId: call.conversationId,
                });

                console.log(`Video call rejected: ${videoCallId}`);
            } catch (error) {
                console.error('Failed to reject video call:', error);
            }
        });

        socket.on('video:call:end', async ({ videoCallId }) => {
            if (!videoCallId || !userId) {
                return;
            }

            try {
                // Get call from Redis
                const callData = await redis.get(`video:call:${videoCallId}`);
                if (!callData) {
                    return;
                }

                const call = JSON.parse(callData);

                // Verify user is part of the call
                if (call.initiatorId !== userId && call.participantId !== userId) {
                    return;
                }

                // Calculate duration
                const startedAt = new Date(call.startedAt);
                const endedAt = new Date();
                const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

                // Update call status
                await prisma.videoCall.update({
                    where: { id: videoCallId },
                    data: { 
                        status: 'ended',
                        endedAt,
                        duration,
                    },
                });

                // Clean up Redis
                await redis.del(`video:call:${videoCallId}`);
                await redis.del(`user:call:${call.initiatorId}`);
                await redis.del(`user:call:${call.participantId}`);

                // Notify both users
                io.to(call.conversationId).emit('video:call:ended', {
                    videoCallId,
                    conversationId: call.conversationId,
                    duration,
                });

                console.log(`Video call ended: ${videoCallId}, duration: ${duration}s`);
            } catch (error) {
                console.error('Failed to end video call:', error);
            }
        });

        socket.on('video:call:offer', async ({ videoCallId, offer }) => {
            if (!videoCallId || !offer || !userId) {
                return;
            }

            try {
                // Get call from Redis
                const callData = await redis.get(`video:call:${videoCallId}`);
                if (!callData) {
                    return;
                }

                const call = JSON.parse(callData);

                // Verify user is the initiator
                if (call.initiatorId !== userId) {
                    return;
                }

                // Forward offer to participant
                socket.to(call.conversationId).emit('video:call:offer', {
                    videoCallId,
                    offer,
                    from: userId,
                });

                console.log(`WebRTC offer sent for call: ${videoCallId}`);
            } catch (error) {
                console.error('Failed to send WebRTC offer:', error);
            }
        });

        socket.on('video:call:answer', async ({ videoCallId, answer }) => {
            if (!videoCallId || !answer || !userId) {
                return;
            }

            try {
                // Get call from Redis
                const callData = await redis.get(`video:call:${videoCallId}`);
                if (!callData) {
                    return;
                }

                const call = JSON.parse(callData);

                // Verify user is the participant
                if (call.participantId !== userId) {
                    return;
                }

                // Forward answer to initiator
                socket.to(call.conversationId).emit('video:call:answer', {
                    videoCallId,
                    answer,
                    from: userId,
                });

                console.log(`WebRTC answer sent for call: ${videoCallId}`);
            } catch (error) {
                console.error('Failed to send WebRTC answer:', error);
            }
        });

        socket.on('video:call:ice-candidate', async ({ videoCallId, candidate }) => {
            if (!videoCallId || !candidate || !userId) {
                return;
            }

            try {
                // Get call from Redis
                const callData = await redis.get(`video:call:${videoCallId}`);
                if (!callData) {
                    return;
                }

                const call = JSON.parse(callData);

                // Verify user is part of the call
                if (call.initiatorId !== userId && call.participantId !== userId) {
                    return;
                }

                // Forward ICE candidate to the other participant
                socket.to(call.conversationId).emit('video:call:ice-candidate', {
                    videoCallId,
                    candidate,
                    from: userId,
                });

                console.log(`ICE candidate sent for call: ${videoCallId}`);
            } catch (error) {
                console.error('Failed to send ICE candidate:', error);
            }
        });

        socket.on('video:call:status', async ({ videoCallId, status }) => {
            if (!videoCallId || !status || !userId) {
                return;
            }

            try {
                // Get call from Redis
                const callData = await redis.get(`video:call:${videoCallId}`);
                if (!callData) {
                    return;
                }

                const call = JSON.parse(callData);

                // Verify user is part of the call
                if (call.initiatorId !== userId && call.participantId !== userId) {
                    return;
                }

                // Forward status update to the other participant
                socket.to(call.conversationId).emit('video:call:status', {
                    videoCallId,
                    status,
                    from: userId,
                });

                console.log(`Call status update: ${videoCallId} - ${status}`);
            } catch (error) {
                console.error('Failed to send call status:', error);
            }
        });
    });
}