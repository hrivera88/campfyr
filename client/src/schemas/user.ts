import { z } from "zod";

export const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    username: z.string().min(1),
    passwordHash: z.string().min(1),
    isOnline: z.boolean().default(false),
    lastSeenAt: z.date().nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    createdAt: z.date(),
    updatedAt: z.date()
});

export type UserSchemaType = z.infer<typeof UserSchema>

export const EditUserSchema = z.object({
    email: z.string().email(),
    username: z.string().min(1),
    avatarUrl: z.string().url().nullable().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal("")),
    confirmPassword: z.string().optional().or(z.literal("")),
}).refine((data) => { 
    if (data.password || data.confirmPassword) { 
        return data.password === data.confirmPassword;
    }
    return true;
}, {message: "Password must match", path: ["confirmPassword"]});

export type EditUserSchemaType = z.infer<typeof EditUserSchema>