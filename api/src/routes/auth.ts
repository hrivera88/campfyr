import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '../generated/prisma';
import authenticate from '../middleware/auth';
import { RequestWithUser } from '../types/express';
import { redis } from '../redis';
import { sendPasswordResetEmail } from '../utils/sendEmail';
import multer from "multer";


const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET enviroment variable is not set');
}
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const IS_PROD = process.env.NODE_ENV === 'production';

// Avatar upload setup (local storage - consider Amazon S3 for production)
const storage = multer.diskStorage({
    destination: "uploads/avatars",
    filename: (req, file, cb) => { 
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({storage});

router.post('/register', async (req, res) => {
    const { email, username, password, organizationName } = req.body;

    try { 
        const organization = await prisma.organization.upsert({
            where: { name: organizationName },
            update: {},
            create: {
                name: organizationName,
                rooms: {
                    create: {name: "General"},
                },
            },
        });

        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, username, passwordHash: hashed, organization: { connect: { id: organization.id } } },
        });
        const generalRoom = await prisma.room.findFirst({
            where: { name: 'General', organizationId: organization.id }
        });
        if (generalRoom) {
            await prisma.roomUser.create({
                data: {
                    userId: user.id,
                    roomId: generalRoom.id,
                }
            });
            await prisma.user.update({
                where: { id: user.id },
                data: { isOnline: true },
            });
        }

        const token = jwt.sign({ userId: user.id, organizationId: user.organizationId }, JWT_SECRET!, { expiresIn: '1h' });
        const refreshToken = jwt.sign({ userId: user.id, organizationId: user.organizationId, jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

        await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'strict',
            path: '/auth/refresh',
            maxAge: 7 * 24 * 60 * 60 * 1000
        }).json({ token });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Registration Failed" });
    }

});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update user online status on login
    await prisma.user.update({
        where: { id: user.id },
        data: {
            isOnline: true,
        },
    });

    // JSON Web Token Handling
    const token = jwt.sign(
        { userId: user.id, organizationId: user.organizationId },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    const refreshToken = jwt.sign({ userId: user.id, organizationId: user.organizationId, jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, { 'expiresIn': '7d' });
    await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }).json({ token });
});

router.get('/me', authenticate, async (req: RequestWithUser, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(400).json({ error: 'Missing user ID in token' });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                createdAt: true,
                avatarUrl: true,
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

router.put('/me', authenticate, upload.single("avatar"), async (req: RequestWithUser, res: Response) => { 
    const { username } = req.body;
    const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : undefined;

    const updatedUser = await prisma.user.update({
        where: { id: req.user?.userId },
        data: {
            ...(username && { username }),
            ...(avatarUrl && {avatarUrl}),
        },
    });
    res.json(updatedUser);
});

router.delete("/me", authenticate, async (req: RequestWithUser, res: Response) => { 
    await prisma.user.delete({
        where: { id: req.user?.userId },
    });
    res.status(204).send();
})

router.post('/refresh', async (req, res) => {
    const oldToken = req.cookies?.refreshToken;

    if (!oldToken) {
        return res.status(401).json({ error: 'Missing refresh token' });
    }

    try {
        const payload = jwt.verify(oldToken, JWT_REFRESH_SECRET);

        if (typeof payload !== 'object' || payload === null || !('userId' in payload)) {
            return res.status(401).json({ error: 'Invalid token structure' });
        }
        // Ensure token exists in Redis and matches
        const stored = await redis.get(`refresh:${payload.userId}`);
        if (oldToken !== stored) return res.status(401).json({ error: 'Token mismatch or reused' });

        // Invalidate old token
        await redis.del(`refresh:${payload.userId}`);

        // Update user online status on token refresh (user is actively using the app)
        await prisma.user.update({
            where: { id: payload.userId },
            data: {
                isOnline: true,
            },
        });

        // Generate new tokens
        const newAccessToken = jwt.sign({ userId: payload.userId, organizationId: payload.organizationId }, JWT_SECRET, { expiresIn: '1h' });
        const newRefreshToken = jwt.sign({ userId: payload.userId, organizationId: payload.organizationId, jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

        // Store new refresh token in Redis
        await redis.set(`refresh:${payload.userId}`, newRefreshToken, 'EX', 7 * 24 * 60 * 60);

        // Set new refresh token in http only cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            sameSite: 'strict',
            secure: IS_PROD,
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ token: newAccessToken });
    } catch (error) {
        return res.status(403).json({ error: 'Token expired or invalid' });
    }
});

router.post('/logout', async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (token) {
        try {
            const payload = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
            if (typeof payload === 'object' && payload?.userId) {
                await prisma.user.update({
                    where: { id: payload.userId },
                    data: {
                        isOnline: false,
                        lastSeenAt: new Date(),
                    },
                });
                await redis.del(`refresh:${payload.userId}`);
            }
        } catch (error) {
            // Token is expired which is fine in this case.
        }
    }
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'strict',
        path: '/'
    });

    return res.json({ message: 'Logged out successfully' });
});

router.post('/accept-invite', async (req, res) => { 
    const { token, username, password } = req.body;

    const invitation = await prisma.invitation.findFirst({
        where: {
            token,
            expiresAt: { gt: new Date() },
            status: "pending",
        },
    });
    if (!invitation) { 
        return res.status(400).json({error: "Invalid or expired invite"});
    }
    const hashed = await bcrypt.hash(password, 10);
    let generalRoom = await prisma.room.findFirst({
        where: {
            name: "General",
            organizationId: invitation.organizationId,
        },
    });
    if (!generalRoom) {
        generalRoom = await prisma.room.create({
            data: {
                name: "General",
                organizationId: invitation.organizationId,
            },
        });
    }
    const user = await prisma.user.create({
        data: {
            email: invitation.email,
            passwordHash: hashed,
            username,
            organizationId: invitation.organizationId,
        },
    });
    await prisma.roomUser.create({
        data: {
            userId: user.id,
            roomId: generalRoom.id
        },
    });

    await prisma.invitation.update({
        where: { id: invitation.id },
        data: {status: "accepted"},
    });
    res.json({success: true});
});

// Forgot Password Route
router.post('/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        // Always return success for security (don't reveal if email exists)
        if (!user) {
            return res.json({ 
                success: true, 
                message: 'If an account with that email exists, a password reset link has been sent.' 
            });
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        // Save reset token to database
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry
            }
        });

        // Send password reset email
        await sendPasswordResetEmail(user.email, resetToken, user.username);

        res.json({ 
            success: true, 
            message: 'If an account with that email exists, a password reset link has been sent.' 
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

// Reset Password Route
router.post('/reset-password', async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    try {
        // Find user with valid reset token
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: {
                    gt: new Date() // Token not expired
                }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear reset token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
                updatedAt: new Date()
            }
        });

        // Clear any existing refresh tokens for security
        await redis.del(`refresh:${user.id}`);

        res.json({ 
            success: true, 
            message: 'Password has been reset successfully' 
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

export default router;