import { z } from 'zod';
import { DirectMessageSchema, SenderSchema } from './direct';

export const ChatMessageSchema = z.object({
    id: z.string(),
    content: z.string(),
    timestamp: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'Invalid ISO timestamp'
    }),
    senderId: z.string(),
});

export type ChatMessageSchemaType = z.infer<typeof ChatMessageSchema>;

export const UserMessageSchema = z.object({
    username: z.string(),
    content: z.string(),
    timestamp: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'Invalid ISO timestamp'
    }),
    roomId: z.string().nullable(),
    conversationId: z.string().nullable(),
    caption: z.string().nullable(),
    fileUrl: z.string().nullable(),
    fileName: z.string().nullable(),
    mimeType: z.string().nullable(),
    audioDuration: z.number().nullable().optional(),
    audioFileSize: z.number().nullable().optional(),
    audioFormat: z.string().nullable().optional(),
    sender: SenderSchema,
});

export type UserMessageSchemaType = z.infer<typeof UserMessageSchema>;


export const ChatRoomSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    createdAt: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'Invalid ISO timestamp'
    }),
});

export type ChatRoomSchemaType = z.infer<typeof ChatRoomSchema>;

export const ChatRoomWithMessagesSchema = ChatRoomSchema.extend({
    messages: z.array(ChatMessageSchema),
});

export type ChatRoomWithMessagesSchemaType = z.infer<typeof ChatRoomWithMessagesSchema>;

export const ChatRoomWithUsersSchema = ChatRoomSchema.extend({
    users: z.array(z.object({
        id: z.string(),
        username: z.string(),
        joinedAt: z.string().refine(val => !isNaN(Date.parse(val)), {
            message: 'Invalid ISO timestamp'
        }),
    })),
});

export type ChatRoomWithUsersSchemaType = z.infer<typeof ChatRoomWithUsersSchema>;

export const FullChatRoomSchema = ChatRoomSchema.extend({
    messages: z.array(ChatMessageSchema),
    users: z.array(z.object({
        id: z.string(),
        username: z.string(),
        joinedAt: z.string().refine(val => !isNaN(Date.parse(val)), {
            message: 'Invalid ISO timestamp'
        }),
    })),
});

export type FullChatRoomSchemaType = z.infer<typeof FullChatRoomSchema>;

export const RoomUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    joinedAt: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'Invalid ISO timestamp',
    }),
    isOnline: z.boolean(),
    lastSeenAt: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'Invalid ISO timestamp',
    }),
});

export const RoomUsersSchema = z.array(RoomUserSchema);

export type RoomUserSchemaType = z.infer<typeof RoomUserSchema>;

export const UnifiedMessageSchema = z.union([
    UserMessageSchema,
    DirectMessageSchema
]);

export type UnifiedMessageSchemaType = z.infer<typeof UnifiedMessageSchema>;