import { redis } from './redis';
import { paginatedRedis } from './utils/paginateRedis';
import { PrismaClient } from './generated/prisma';

export interface ChatMessage {
    userId: string;
    content: string;
    timestamp: number;
    fileUrl?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
}

const MAX_MESSAGES = 50;

const prisma = new PrismaClient();

/**
 * Saves a mesage to the Redis list for the chat room.
 */

export async function saveMessage(msg: ChatMessage, roomId: string): Promise<void> { 
    const redisKey = `chat:room:${roomId}:messages`;
    const serialized = JSON.stringify(msg);
    await redis.lpush(redisKey, serialized);
    await redis.ltrim(redisKey, 0, MAX_MESSAGES - 1);
}

/**
 * Retrives the latest N messages from the chat room.
 */
export async function getRecentMessages(roomId: string, cursor = 0, take = 20) { 
    const redisKey = `chat:room:${roomId}:messages`;
    try {
        const result = await paginatedRedis({
            redisKey,
            take,
            cursor,
        }, JSON.parse);
  
        if (result.data.length === 0 && cursor === 0) { 
            const dbMessages = await prisma.message.findMany({
                where: { roomId },
                orderBy: { timestamp: 'desc' },
                take: take,
                include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
            });

            const chatMessages = dbMessages.map((msg) => ({
                userId: msg.sender.id,
                content: msg.content,
                timestamp: msg.timestamp.getTime(),
                fileUrl: msg.fileUrl ?? null,
                fileName: msg.fileName ?? null,
                mimeType: msg.mimeType ?? null,
                sender: {
                    id: msg.sender.id,
                    username: msg.sender.username,
                    avatarUrl: msg.sender.avatarUrl,
                }
            }));

            // Hydrate Redis for next time
            if (chatMessages.length > 0) {
                const pipeline = redis.multi();
                chatMessages.slice().reverse().forEach((msg) => {
                    pipeline.rpush(redisKey, JSON.stringify({
                        userId: msg.sender.id,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        fileUrl: msg.fileUrl,
                        fileName: msg.fileName,
                        mimeType: msg.mimeType
                    }))
                });
                pipeline.expire(redisKey, 60);
                await pipeline.exec();
            }
            return {
                data: chatMessages,
                meta: {
                    nextCursor: chatMessages.length === take ? cursor + take : null,
                    hasNextPage: chatMessages.length === take,
                    count: chatMessages.length,
                },
            };
        }

        const userIds = [...new Set(result.data.map((msg) => msg.userId))];
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, avatarUrl: true },
        });
        const userMap = new Map(users.map((u) => [u.id, {id: u.id, username: u.username, avatarUrl: u.avatarUrl}]));

        return {
            data: result.data.map((msg) => ({
                ...msg,
                sender: userMap.get(msg.userId) ?? {
                    id: msg.userId,
                    username: "Unknown",
                    avatarUrl: null,
                },
            })),
            meta: result.meta,
        };
    } catch (error) { 
        console.error('Fallback to DB failed', error);
        return {
            data: [],
            meta: {
                nextCursor: null,
                hasNextPage: false,
                count: 0,
            },
        };;
    }
}

