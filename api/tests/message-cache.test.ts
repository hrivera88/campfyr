import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { redis } from '../src/redis';
import { saveMessage, getRecentMessages, ChatMessage } from "../src/message-cache";

const testRoomId = "test-room-1";
const testRedisKey = `chat:room:${testRoomId}:messages`;

beforeAll(async () => { 
    await redis.del(testRedisKey);
});


afterAll(async () => { 
    await redis.quit();
});

describe('message-cache.ts', () => { 
    it('saves and retrieves a message', async () => {
        const msg: ChatMessage = {
            userId: 'user-123',
            content: 'Hello world',
            timestamp: Date.now(),
        };
        
        await saveMessage(msg, testRoomId);
        
        const result = await getRecentMessages(testRoomId);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].content).toBe('Hello world');
        expect(result.data[0].userId).toBe('user-123');
    });

    it('limits messages to 50', async () => {
        // Clear any existing messages first
        await redis.del(testRedisKey);
        
        for (let i = 0; i < 60; i++) { 
            await saveMessage({
                userId: 'user-' + i,
                content: 'Message ' + i,
                timestamp: Date.now() + i, // Ensure different timestamps
            }, testRoomId);
        }

        const result = await getRecentMessages(testRoomId, 0, 50);
        expect(result.data.length).toBe(50);
        // After reverse(), oldest message (Message 10) should be first
        expect(result.data[0].content).toContain('10');
        // Most recent message (Message 59) should be last
        expect(result.data[result.data.length - 1]?.content).toContain('59');
    });
});