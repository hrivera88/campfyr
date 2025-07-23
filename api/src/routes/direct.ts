import express, { Response } from 'express'
import { Prisma, PrismaClient } from '../generated/prisma'
import authenticate from '../middleware/auth'
import { RequestWithUser } from '../types/express'
import { normalizeTimestamps } from '../utils/normalizeTimestamps';
import { paginate } from '../utils/paginate';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/messages', authenticate, async (req: RequestWithUser, res) => {
    const { cursor, take, search } = req.query as { cursor?: string, take?: string; search?: string };
    try {
        const result = await paginate<Prisma.DirectMessageGetPayload<true>, Prisma.DirectMessageWhereInput, Prisma.DirectMessageSelect, Prisma.DirectMessageOrderByWithRelationInput>(prisma, {
            model: "directMessage",
            take: take ? parseInt(take) : 20,
            cursor,
            where: {
                conversation: {
                    organizationId: req.user?.organizationId,
                },
            },
            orderBy: { timestamp: "asc" },
            select: {
                id: true,
                conversationId: true,
                senderId: true,
                content: true,
                timestamp: true,
            }
        });
        res.json({ success: true, data: normalizeTimestamps(result.data), meta: result.meta });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch direct messages, ' })
    }
});
router.get('/messages/:id', authenticate, async (req: RequestWithUser, res) => {
    const { id: msgId } = req.params;
    try {
        const message = await prisma.directMessage.findFirst({
            where: { id: msgId, conversation: {organizationId: req.user?.organizationId} },
            select: {
                id: true,
                conversationId: true,
                senderId: true,
                content: true,
                timestamp: true,
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                    },
                },
            },
        });
        if (!message) {
            return res.status(404).json({ success: false, error: "Message not found" });
        }
        res.status(200).json({ success: true, data: normalizeTimestamps(message) });
    } catch (error) {
        res.json(500).json({ error: "Failed to fetch direct message" })
    }
});
router.get('/conversations', authenticate, async (req: RequestWithUser, res) => {
    const { cursor, take, search } = req.query as { cursor?: string, take?: string; search?: string };
    try {
        const result = await paginate<Prisma.DirectConversationGetPayload<true>, Prisma.DirectConversationWhereInput, Prisma.DirectConversationSelect, Prisma.DirectConversationOrderByWithRelationInput>(prisma, {
            model: "directConversation",
            take: take ? parseInt(take) : 20,
            cursor,
            where: {
                organizationId: req.user?.organizationId,
                deletedAt: null,
                OR: [
                    { user1Id: req.user?.userId },
                    { user2Id: req.user?.userId }
                ],
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                user1Id: true,
                user2Id: true,
                messages: {
                    orderBy: { timestamp: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        content: true,
                        timestamp: true,
                        senderId: true,
                    },
                },
                createdAt: true,
            }
        });
        res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch direct conversations' })
    }
});
router.get('/conversations/:id/messages', authenticate, async (req: RequestWithUser, res) => {
    const { id: convoId } = req.params;
    const { cursor, take = "20", search } = req.query as { cursor?: string, take?: string, search?: string };

    try {
        const conversation = await prisma.directConversation.findFirst({
            where: {
                id: convoId,
                organizationId: req.user?.organizationId,
                OR: [
                    { user1Id: req.user?.userId },
                    { user2Id: req.user?.userId }
                ]
            }
        });

        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        const result = await paginate<
            Prisma.DirectMessageGetPayload<true>,
            Prisma.DirectMessageWhereInput,
            Prisma.DirectMessageSelect,
            Prisma.DirectMessageOrderByWithRelationInput
        >(prisma, {
            model: "directMessage",
            take: parseInt(take),
            cursor,
            where: {
                conversationId: convoId,
                ...(search ? { content: { contains: search, mode: "insensitive" } } : {})
            },
            orderBy: { timestamp: "asc" },
            select: {
                id: true,
                senderId: true,
                content: true,
                timestamp: true,
                fileName: true,
                fileUrl: true,
                mimeType: true,
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatarUrl: true,
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: normalizeTimestamps(result.data),
            meta: result.meta
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch conversation messages' });
    }
});

router.post('/conversations', authenticate, async (req: RequestWithUser, res: Response) => {
    const {userId, organizationId} = req.user!;
    const { recipientId } = req.body;

    if (!recipientId || recipientId === userId) {
        return res.status(400).json({ error: "Invalid Recipient" });
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    
    if (!recipient || recipient.organizationId !== organizationId) { 
        return res.status(403).json({error: "Recipient not in your organization"});
    }

    const [user1, user2] = [userId, recipientId].sort();
    try {
        let conversation = await prisma.directConversation.findFirst({
            where: {
                user1Id: user1,
                user2Id: user2,
                deletedAt: null,
                organizationId,
            },
        });

        if (!conversation) {
            conversation = await prisma.directConversation.create({
                data: {
                    user1Id: user1,
                    user2Id: user2,
                    organizationId,
                },
            });
        }
        res.status(201).json(normalizeTimestamps(conversation));
    } catch (error) {
        res.status(500).json({
            error: "Failed to create or fetch conversation"
        });
    }
});
router.post('/conversations/:id/messages', authenticate, async (req: RequestWithUser, res: Response) => {
    const userId = req.user?.userId;
    const orgId = req.user?.organizationId;
    const { id: convoId } = req.params;
    const { content, fileUrl, fileName, mimeType } = req.body;

    if (!content?.trim() && !fileUrl) {
        return res.status(400).json({ error: "Message must include text or a file" });
    }
    try {
        const conversation = await prisma.directConversation.findFirst({
            where: { id: convoId, organizationId: orgId, OR: [{user1Id: userId}, {user2Id: userId}] },
        });
        if (!conversation || (conversation.user1Id !== userId && conversation.user2Id !== userId)) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        const message = await prisma.directMessage.create({
            data: {
                content: content ?? "",
                conversationId: convoId,
                senderId: userId!,
                fileName,
                fileUrl,
                mimeType,
            },
        });

        res.status(201).json({ success: true, data: normalizeTimestamps(message) });
    } catch (error) {
        res.status(500).json({ error: "Failed to send message" });
    }
});
router.delete('/conversations/:id', authenticate, async (req: RequestWithUser, res: Response) => {
    const { id: convoId } = req.params;
    const {userId, organizationId} = req.user!;
    try {
        const conversation = await prisma.directConversation.findFirst({
            where: { id: convoId, organizationId: organizationId, OR: [{ user1Id: userId }, { user2Id: userId }] },
        });
        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }
        if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
            return res.status(403).json({ error: "Not authorized to delete this conversation" });
        }
        await prisma.directConversation.update({
            where: { id: convoId },
            data: {
                deletedAt: new Date(),
            },
        });
        res.status(200).json({ message: "Conversation soft deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete conversation" });
    }
});

export default router;