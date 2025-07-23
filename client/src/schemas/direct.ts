import { z } from "zod";

export const SenderSchema = z.object({
    id: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable().optional(),
});

export const DirectMessageSchema = z.object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    senderId: z.string().uuid(),
    content: z.string(),
    sender: SenderSchema,
    timestamp: z.string().datetime(),
    caption: z.string().nullable(),
    fileUrl: z.string().nullable(),
    fileName: z.string().nullable(),
    mimeType: z.string().nullable(),
    audioDuration: z.number().nullable().optional(),
    audioFileSize: z.number().nullable().optional(),
    audioFormat: z.string().nullable().optional(),
});

export type DirectMessageSchemaType = z.infer<typeof DirectMessageSchema>;

export const DirectConversationSchema = z.object({
    id: z.string().uuid(),
    user1Id: z.string().uuid(),
    user2Id: z.string().uuid(),
    messages: z.array(DirectMessageSchema),
    createdAt: z.string().datetime(),
});

export type DirectConversationSchemaType = z.infer<typeof DirectConversationSchema>;