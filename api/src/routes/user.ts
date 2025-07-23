import express, { Request, Response } from "express";
import { PrismaClient, Prisma } from "../generated/prisma";
import authenticate from "../middleware/auth";
import { dmmfToRuntimeDataModel } from "@prisma/client/runtime/library";
import { RequestWithUser } from "../types/express";
import { paginate } from "../utils/paginate";
import { sendInvitationalEmail } from "../utils/sendEmail";
import crypto from "crypto";


const router = express.Router();
const prisma = new PrismaClient();


router.get('/', authenticate, async (req: RequestWithUser, res: Response) => { 
    const { cursor, take, search, isOnline } = req.query as {
        cursor?: string;
        take?: string;
        search?: string;
        isOnline?: string;
    };
    try { 
        // Validate query parameters
        const searchValue = typeof search === 'string' ? search : undefined;
        const cursorValue = typeof cursor === 'string' ? cursor : undefined;
        const isOnlineValue = typeof isOnline === 'string' ? isOnline : undefined;

        // Parse and validate take parameter
        let takeValue = 20; // default
        if (take && typeof take === 'string') {
            const parsedTake = parseInt(take);
            if (!isNaN(parsedTake) && parsedTake > 0) {
                takeValue = parsedTake;
            }
        }

        const result = await paginate<
            Prisma.UserGetPayload<true>,
            Prisma.UserWhereInput,
            Prisma.UserSelect,
            Prisma.UserOrderByWithRelationInput
      >(prisma, {
            model: "user",
            take: takeValue,
            cursor: cursorValue,
            orderBy: { id: "asc" }, // Use consistent ordering by id
            select: {
                id: true,
                username: true,
                email: true,
                isOnline: true,
                createdAt: true,
                avatarUrl: true,
            },
            where: {
                organizationId: req.user?.organizationId,
                deletedAt: null,
                ...(isOnlineValue !== undefined ? { isOnline: isOnlineValue === "true" } : {}),
            },
            searchField: "username",
            searchQuery: searchValue,
        });
        res.status(200).json({data: result.data, meta: result.meta, success: true});
    } catch (error) { 
        console.error('Error fetching users:', error);
        res.status(500).json({error: "Failed to fetch the users"});
    }
});

router.get("/organization", authenticate, async (req: RequestWithUser, res: Response) => {
    try {
        const org = await prisma.organization.findFirst({
            where: { id: req.user?.organizationId },
            select: {
                id: true,
                name: true,
                createdAt: true,
                _count: {
                    select: {
                        users: true,
                        rooms: true,
                        directConversations: true,
                        invitations: true,
                    }
                }
            }
        });
        if (!org) {
            return res.status(404).json({ error: "Organization not found" });
        }
        res.json(org);
    } catch {
        res.status(500).json({ error: "Failed to fetch organization" });
    }
});
router.post("/invite", authenticate, async (req: RequestWithUser, res) => {
    try {
        const { email } = req.body;
        console.log('hal req body, ', req.user);
        const user = req.user!;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

        // Try to send email first
        await sendInvitationalEmail(email, token);

        // Only create invitation if email sending succeeds
        const invitation = await prisma.invitation.create({
            data: {
                email,
                invitedById: user.userId,
                organizationId: user.organizationId,
                token,
                expiresAt,
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Invitation error:', error);
        res.status(500).json({ error: "Failed to send invitation" });
    }
});

router.get("/invitations", authenticate, async (req: RequestWithUser, res) => {
    const { cursor, take, search } = req.query as { cursor?: string; take?: string; search?: string };
    console.log('hal invatios');
    try {
        const result = await paginate<Prisma.InvitationGetPayload<true>, Prisma.InvitationWhereInput, Prisma.InvitationSelect, Prisma.InvitationOrderByWithRelationInput>(prisma, {
            model: "invitation",
            take: take ? parseInt(take) : 20,
            select: {
                id: true,
                email: true,
                status: true,
                token: true,
                createdAt: true,
                expiresAt: true,
                invitedBy: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                    }
                }
            },
            where: {
                organizationId: req.user!.organizationId,
            },
            searchField: "email",
            searchQuery: search,
        });
        res.status(200).json({ data: result.data, meta: result.meta, success: true });
    } catch (error) { return res.status(500).json({ error: "Failed to fetch user invitations." }) }
});

router.post("/invitations/:id/resend", authenticate, async (req: RequestWithUser, res) => {
    const { id } = req.params;
    const user = req.user!;

    try {
        // Find the invitation
        const invitation = await prisma.invitation.findFirst({
            where: {
                id,
                organizationId: user.organizationId,
            }
        });

        if (!invitation) {
            return res.status(404).json({ error: "Invitation not found" });
        }

        // Check if invitation is still pending
        if (invitation.status !== "pending") {
            return res.status(400).json({ error: "Can only resend pending invitations" });
        }

        // Generate new token and expiration
        const newToken = crypto.randomUUID();
        const newExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

        // Send new invitation email first
        await sendInvitationalEmail(invitation.email, newToken);

        // Only update invitation if email sending succeeds
        await prisma.invitation.update({
            where: { id },
            data: {
                token: newToken,
                expiresAt: newExpiresAt,
            }
        });

        res.json({ success: true, message: "Invitation resent successfully" });
    } catch (error) {
        console.error("Error resending invitation:", error);
        res.status(500).json({ error: "Failed to resend invitation" });
    }
});
router.get("/:id", authenticate, async (req: RequestWithUser, res: Response) => { 
    const { id } = req.params;
    try { 
        const user = await prisma.user.findFirst({
            where: { id, organizationId: req.user?.organizationId, deletedAt: null },
            select: {
                id: true,
                username: true,
                email: true,
                createdAt: true,
                avatarUrl: true,
            }
        });
        if (!user) { 
            return res.status(404).json({ error: "User not found" });
        }
        res.json(user);
    } catch { 
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

router.post("/test-invite", async (req, res) => {
    const { email } = req.body;
    if (!email) { 
        return res.status(404).json({error: "Missing email"});
    }
    const fakeToken = "test-token-123";
    await sendInvitationalEmail(email, fakeToken);
    res.json({ message: "Test email sent" });
});
  

export default router;