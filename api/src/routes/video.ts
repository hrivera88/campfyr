import express, { Response } from "express";
import { PrismaClient } from "../generated/prisma";
import authenticate from "../middleware/auth";
import { redis } from "../redis";
import { RequestWithUser } from "../types/express";

const router = express.Router();
const prisma = new PrismaClient();

router.post('/call/initiate', authenticate, async (req: RequestWithUser, res: Response) => {
    const { conversationId, participantId } = req.body;
    const userId = req.user?.userId;

    if (!conversationId || !participantId || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Verify conversation exists and user has access
        const conversation = await prisma.directConversation.findFirst({
            where: {
                id: conversationId,
                organizationId: req.user?.organizationId,
                OR: [
                    { user1Id: userId },
                    { user2Id: userId }
                ]
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found or access denied' });
        }

        // Verify participant is part of the conversation
        if (conversation.user1Id !== participantId && conversation.user2Id !== participantId) {
            return res.status(400).json({ error: 'Participant not part of conversation' });
        }

        // Check if users are already in a call
        const initiatorCallStatus = await redis.get(`user:call:${userId}`);
        const participantCallStatus = await redis.get(`user:call:${participantId}`);

        if (initiatorCallStatus || participantCallStatus) {
            return res.status(409).json({ error: 'One or both users are already in a call' });
        }

        // Create video call record
        const videoCall = await prisma.videoCall.create({
            data: {
                conversationId,
                initiatorId: userId,
                participantId,
                status: 'pending',
            },
            include: {
                initiator: {
                    select: { id: true, username: true, avatarUrl: true }
                },
                participant: {
                    select: { id: true, username: true, avatarUrl: true }
                },
                conversation: {
                    select: { id: true }
                }
            }
        });

        res.status(201).json({
            success: true,
            data: videoCall
        });

    } catch (error) {
        console.error('Failed to initiate video call:', error);
        res.status(500).json({ error: 'Failed to initiate video call' });
    }
});

// GET /api/video/call/history/:conversationId - Get call history for a conversation
router.get('/call/history/:conversationId', authenticate, async (req: RequestWithUser, res: Response) => {
    const { conversationId } = req.params;
    const userId = req.user?.userId;
    const { limit = '20', offset = '0' } = req.query;

    if (!conversationId || !userId) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // Verify user has access to conversation
        const conversation = await prisma.directConversation.findFirst({
            where: {
                id: conversationId,
                organizationId: req.user?.organizationId,
                OR: [
                    { user1Id: userId },
                    { user2Id: userId }
                ]
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found or access denied' });
        }

        // Get call history
        const calls = await prisma.videoCall.findMany({
            where: {
                conversationId
            },
            include: {
                initiator: {
                    select: { id: true, username: true, avatarUrl: true }
                },
                participant: {
                    select: { id: true, username: true, avatarUrl: true }
                }
            },
            orderBy: {
                startedAt: 'desc'
            },
            take: parseInt(limit as string),
            skip: parseInt(offset as string)
        });

        // Get total count
        const totalCount = await prisma.videoCall.count({
            where: {
                conversationId
            }
        });

        res.json({
            success: true,
            data: {
                calls,
                totalCount,
                hasMore: (parseInt(offset as string) + calls.length) < totalCount
            }
        });

    } catch (error) {
        console.error('Failed to get call history:', error);
        res.status(500).json({ error: 'Failed to get call history' });
    }
});

// PUT /api/video/call/:callId/status - Update call status
router.put('/call/:callId/status', authenticate, async (req: RequestWithUser, res: Response) => {
    const { callId } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;

    if (!callId || !status || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate status
    const validStatuses = ['pending', 'active', 'ended', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    try {
        // Get current call
        const call = await prisma.videoCall.findUnique({
            where: { id: callId },
            include: {
                conversation: {
                    select: { organizationId: true }
                }
            }
        });

        if (!call) {
            return res.status(404).json({ error: 'Call not found' });
        }

        // Verify user has access (is part of call and same organization)
        if (call.conversation.organizationId !== req.user?.organizationId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (call.initiatorId !== userId && call.participantId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Prepare update data
        const updateData: any = { status };

        // If ending the call, calculate duration
        if (status === 'ended' && call.status === 'active') {
            const duration = Math.floor((new Date().getTime() - call.startedAt.getTime()) / 1000);
            updateData.duration = duration;
            updateData.endedAt = new Date();
        }

        // If rejecting or cancelling, set end time
        if (status === 'rejected' || status === 'cancelled') {
            updateData.endedAt = new Date();
        }

        // Update call
        const updatedCall = await prisma.videoCall.update({
            where: { id: callId },
            data: updateData,
            include: {
                initiator: {
                    select: { id: true, username: true, avatarUrl: true }
                },
                participant: {
                    select: { id: true, username: true, avatarUrl: true }
                }
            }
        });

        // Clean up Redis if call is ending
        if (['ended', 'rejected', 'cancelled'].includes(status)) {
            await redis.del(`video:call:${callId}`);
            await redis.del(`user:call:${call.initiatorId}`);
            await redis.del(`user:call:${call.participantId}`);
        }

        res.json({
            success: true,
            data: updatedCall
        });

    } catch (error) {
        console.error('Failed to update call status:', error);
        res.status(500).json({ error: 'Failed to update call status' });
    }
});

// DELETE /api/video/call/:callId - End call and cleanup
router.delete('/call/:callId', authenticate, async (req: RequestWithUser, res: Response) => {
    const { callId } = req.params;
    const userId = req.user?.userId;

    if (!callId || !userId) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // Get current call
        const call = await prisma.videoCall.findUnique({
            where: { id: callId },
            include: {
                conversation: {
                    select: { organizationId: true }
                }
            }
        });

        if (!call) {
            return res.status(404).json({ error: 'Call not found' });
        }

        // Verify user has access
        if (call.conversation.organizationId !== req.user?.organizationId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (call.initiatorId !== userId && call.participantId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Calculate duration if call was active
        let duration = call.duration;
        if (call.status === 'active' && !duration) {
            duration = Math.floor((new Date().getTime() - call.startedAt.getTime()) / 1000);
        }

        // Update call to ended status
        const updatedCall = await prisma.videoCall.update({
            where: { id: callId },
            data: {
                status: 'ended',
                endedAt: new Date(),
                duration
            },
            include: {
                initiator: {
                    select: { id: true, username: true, avatarUrl: true }
                },
                participant: {
                    select: { id: true, username: true, avatarUrl: true }
                }
            }
        });

        // Clean up Redis
        await redis.del(`video:call:${callId}`);
        await redis.del(`user:call:${call.initiatorId}`);
        await redis.del(`user:call:${call.participantId}`);

        res.json({
            success: true,
            data: updatedCall
        });

    } catch (error) {
        console.error('Failed to end call:', error);
        res.status(500).json({ error: 'Failed to end call' });
    }
});

export default router;