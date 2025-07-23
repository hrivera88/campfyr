import { useEffect, useState, useRef } from "react";
import type { UserMessageSchemaType } from "@/schemas/chat";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

type UseChatSocketProps = {
    socket: ReturnType<typeof io> | null;
    activeRoomId?: string;
    userId?: string;
    username?: string;
    avatarUrl?: string;
    activeConversationId?: string;
};

export type TypingUser = {
    username: string;
    avatarUrl?: string;
    userId: string;
};

export const useChatSocket = ({
    socket,
    activeRoomId,
    userId,
    username,
    activeConversationId,
    avatarUrl,
}: UseChatSocketProps) => {
    const [messages, setMessages] = useState<UserMessageSchemaType[]>([]);
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const roomRef = useRef<string | null>(null);
    const convoRef = useRef<string | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket || !userId) return;
        console.log("Socket joining room or DM:", { activeRoomId, activeConversationId });
        if (roomRef.current && roomRef.current !== activeRoomId) {
            socket.emit("leaveRoom", { roomId: roomRef.current, userId });
            roomRef.current = null;
        }
        if (convoRef.current && convoRef.current !== activeConversationId) {
            socket.emit("direct:leave", { conversationId: convoRef.current });
            convoRef.current = null;
        }
        if (activeRoomId) {
            socket.emit("joinRoom", { roomId: activeRoomId, userId });
            roomRef.current = activeRoomId;
        } else if (activeConversationId) {
            socket.emit("direct:join", { conversationId: activeConversationId });
            convoRef.current = activeConversationId;
        }
        setMessages([]);
        setTypingUsers([]);
    }, [socket, activeRoomId, activeConversationId, userId]);

    useEffect(() => {
        if (!socket) return;

        const handleChatMessage = () => {
            const queryKey =
                roomRef.current && activeRoomId
                    ? ["chatMessages", activeRoomId]
                    : convoRef.current && activeConversationId
                        ? ["dmMessages", activeConversationId]
                        : null;

            if (queryKey) {
                queryClient.refetchQueries({ queryKey: queryKey });
            } else {
                console.warn("handleChatMessage: No valid query key to invalidate");
            }
        };
        const handleTyping = (user: TypingUser) => {
            setTypingUsers((prev) => {
                const exists = prev.some((u => u.userId === user.userId));
                return exists ? prev : [...prev, user];
            });
        };
        const handleStopTyping = (user: TypingUser) => {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== user.userId));
        };
        const handleConnectError = (error: Error) => {
            console.error("Socket connection error:", error.message);
        };

        const handleDirectMessage = () => {
            const queryKey =
                roomRef.current && activeRoomId
                    ? ["chatMessages", activeRoomId]
                    : convoRef.current && activeConversationId
                        ? ["dmMessages", activeConversationId]
                        : null;
            console.log('direct message, ', convoRef.current, ', ', activeConversationId, ', ', queryKey);
            if (queryKey) {
                queryClient.refetchQueries({ queryKey: queryKey });
            } else {
                console.warn("handleChatMessage: No valid query key to invalidate");
            }
        };

        // Handle room user presence updates
        const handleUserJoined = (data: { userId: string }) => {
            console.log('User joined room:', data.userId);
            if (roomRef.current) {
                queryClient.invalidateQueries({ queryKey: ['roomUsers', roomRef.current] });
            }
        };

        const handleUserLeft = (data: { userId: string }) => {
            console.log('User left room:', data.userId);
            if (roomRef.current) {
                queryClient.invalidateQueries({ queryKey: ['roomUsers', roomRef.current] });
            }
        };

        const handleRoomUsers = (activeUsers: string[]) => {
            console.log('Room users updated:', activeUsers);
            if (roomRef.current) {
                queryClient.invalidateQueries({ queryKey: ['roomUsers', roomRef.current] });
            }
        };

        socket.on("chat:message", handleChatMessage);
        socket.on("direct:message", handleDirectMessage);
        socket.on("chat:typing", handleTyping);
        socket.on("chat:stopTyping", handleStopTyping);
        socket.on("userJoined", handleUserJoined);
        socket.on("userLeft", handleUserLeft);
        socket.on("roomUsers", handleRoomUsers);
        socket.on("connect_error", handleConnectError);

        return () => {
            socket.off("chat:message", handleChatMessage);
            socket.off("chat:typing", handleTyping);
            socket.off("direct:message", handleDirectMessage);
            socket.off("chat:stopTyping", handleStopTyping);
            socket.off("userJoined", handleUserJoined);
            socket.off("userLeft", handleUserLeft);
            socket.off("roomUsers", handleRoomUsers);
            socket.off("connect_error", handleConnectError);
        }
    }, [socket, activeRoomId, activeConversationId, queryClient]);

    // Cleanup typing timeout on unmount or when dependencies change
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        };
    }, []);

    const emitTyping = () => {
        if (socket && userId && username) {
            // Clear any existing timeout to prevent multiple overlapping timers
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            socket.emit("chat:typing", {
                userId,
                username,
                avatarUrl: avatarUrl ?? "/default-avatar.png",
            });

            // Store the timeout reference for cleanup
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit("chat:stopTyping", {
                    userId,
                    username,
                    avatarUrl: avatarUrl ?? "/default-avatar.png",
                });
                typingTimeoutRef.current = null;
            }, 2000);
        }
    };

    const sendMessage = ({ content, fileUrl, fileName, mimeType, audioFormat, audioFileSize, audioDuration }: { content: string; fileUrl: string; fileName: string; mimeType: string; audioFormat?: string; audioFileSize?: number; audioDuration?: number; }) => {
        if ((!content.trim() && !fileUrl) || !socket) return;
        const timestamp = new Date().toISOString();
        const usernameOrGuest = username || "Guest";
        if (activeRoomId) {
            socket.emit("chat:message", {
                username: usernameOrGuest,
                content,
                fileUrl,
                fileName,
                mimeType,
                ...(audioDuration && { audioDuration }),
                ...(audioFileSize && { audioFileSize }),
                ...(audioFormat && { audioFormat }),
                timestamp,
                roomId: activeRoomId,
            });
        } else if (activeConversationId) {
            socket.emit("direct:message", {
                conversationId: activeConversationId,
                content,
                fileUrl,
                fileName,
                mimeType,
                ...(audioDuration && { audioDuration }),
                ...(audioFileSize && { audioFileSize }),
                ...(audioFormat && { audioFormat }),
            });
        } else {
            console.warn("No activeRoomId or activeConversationId, cannot send message");
        }
    };
    return {
        messages,
        setMessages,
        typingUsers,
        emitTyping,
        sendMessage,
    };
};
