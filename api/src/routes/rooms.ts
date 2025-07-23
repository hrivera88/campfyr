import express, { Response } from 'express';
import { Prisma, PrismaClient } from '../generated/prisma';
import authenticate from '../middleware/auth';
import { RequestWithUser } from '../types/express';
import { paginate } from '../utils/paginate';

const router = express.Router();
router.use(authenticate);
const prisma = new PrismaClient();

router.get('/', async (req: RequestWithUser, res) => { 
    const { cursor, take, search } = req.query as {
        cursor?: string;
        take?: string;
        search?: string;
    };
    try { 
        const result = await paginate<Prisma.RoomGetPayload<true>, Prisma.RoomWhereInput, Prisma.RoomSelect, Prisma.RoomOrderByWithRelationInput>(prisma, {
            model: "room",
            take: take ? parseInt(take) : 20,
            cursor,
            where: {
                organizationId: req.user?.organizationId,
                deletedAt: null,
            },
            select: {
                id: true,
                name: true,
                createdAt: true,
                _count: { select: { users: true } }
            },
            orderBy: [
                { createdAt: "desc" },
                { id: "desc" }
            ],
            searchField: "name",
            searchQuery: search
        });
        res.status(200).json({data:result.data, meta: result.meta});
    } catch (error) { 
        res.status(500).json({error: 'Failed to fetch rooms'});
    }
});

router.get('/:id', async (req: RequestWithUser, res) => {
    const { id: roomId } = req.params;
    try {
        const room = await prisma.room.findFirst({
            where: { id: roomId, organizationId: req.user?.organizationId },
            select: {
                id: true,
                name: true,
                users: true,
                messages: true,
                createdAt: true,
            }
        });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch the room' });
    }
});

router.get('/:id/users', async (req: RequestWithUser, res) => { 
    const { id: roomId } = req.params;
    const { cursor, take } = req.query as {
        cursor?: string;
        take?: string;
      };
    try { 
        const room = await prisma.room.findFirst({
            where: { id: roomId, organizationId: req.user?.organizationId, deletedAt: null, },
            select: {
                id: true,
            }
        });
        if (!room) { 
            return res.status(404).json({success: false, error: "Room for user was not found."});
        }
        const result = await paginate<
            { user: { id: string; username: string; isOnline: boolean; lastSeenAt: Date | null } },
            Prisma.RoomUserWhereInput,
            Prisma.RoomUserSelect,
            Prisma.RoomUserOrderByWithRelationInput
        >(prisma, {
            model: "roomUser",
            take: take ? parseInt(take) : 20,
            cursor,
            where: {
                roomId,
                user: {
                    organizationId: req.user?.organizationId,
                    deletedAt: null,
                },
            },
            orderBy: { userId: "asc" }, // Or `createdAt` if you had that field
            select: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        isOnline: true,
                        lastSeenAt: true,
                    },
                },
            },
        });
      
        const users = result.data.map((ru) => ru.user);
        res.json(users);
    } catch (error) { 
        console.error('Failed to fetch users in room: ', error);
        res.status(500).json({ message: 'Internal Server Error'});
    }
});

router.post('/', async (req: RequestWithUser, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Room name is required' });
    
    try { 
        const room = await prisma.room.create({
            data: { name, organizationId: req.user?.organizationId }
        });
        res.status(201).json(room);
    } catch (error: any) { 
        if (error.code === 'P2002') { 
            return res.status(409).json({ error: 'Room name already exists' });
        }
        console.log('hall error, ', error, ' ', req.user);
        res.status(500).json({error: 'Failed to create room'})
    }
 });

router.post('/:id/join', authenticate, async (req: RequestWithUser, res: Response) => { 
    const {userId, organizationId} = req.user!;
    const { id: roomId } = req.params;

    try { 
        const room = await prisma.room.findFirst({
            where: { id: roomId, organizationId, deletedAt: null, }
        });

        if (!room) return res.status(404).json({ error: 'Room not found in your organization' });

        // Check if user is already in the room
        const existingMembership = await prisma.roomUser.findUnique({
            where: {
                userId_roomId: { userId, roomId }
            }
        });

        if (existingMembership) {
            return res.status(409).json({ error: 'User is already a member of this room' });
        }

        await prisma.roomUser.create({
            data: { roomId, userId }
        });
        res.status(200).json({message: 'Joined room successfully'});
    } catch (error: any) { 
        // Handle unique constraint error as fallback
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'User is already a member of this room' });
        }
        console.error('Join room error, ', error);
        res.status(500).json({error: 'Failed to join room'});
    }

});

router.post('/:id/leave', authenticate, async (req: RequestWithUser, res: Response) => { 
    const { userId, organizationId } = req.user!;
    const { id: roomId } = req.params;

    if (!userId || !roomId) { 
        return res.status(400).json({error: 'Missing userId or roomId'});
    }

    try { 
        const room = await prisma.room.findFirst({
            where: {id: roomId, organizationId: organizationId, deletedAt: null,}
        });
        if (!room) return res.status(404).json({ error: 'Room not found in your organization' });
        await prisma.roomUser.delete({
            where: {
                userId_roomId: {
                    userId,
                    roomId
                }
            }
        });
        res.json({ message: 'Left the chat room successfully' });
    } catch (error: any) {
        if (error.code === 'P2025') { 
            return res.status(404).json({error: 'User was not in the chat room'});
        }
        res.status(500).json({error: 'Failed to leave the chat room'})
    }
});

export default router;