import type { UserMessageSchemaType } from "@/schemas/chat";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

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
        
        // Wait for socket to be connected before sending events
        if (!socket.connected) {
            // Check global socket as fallback
            const globalSocket = (window as any).socket;
            if (globalSocket && globalSocket.connected) {
                performRoomActionsWithSocket(globalSocket);
                return;
            }
            
            // Use a different approach - check connection status in an interval
            const checkConnection = () => {
                const currentGlobalSocket = (window as any).socket;
                if (socket.connected) {
                    performRoomActions();
                } else if (currentGlobalSocket && currentGlobalSocket.connected) {
                    performRoomActionsWithSocket(currentGlobalSocket);
                } else {
                    // Check again in 100ms
                    setTimeout(checkConnection, 100);
                }
            };
            checkConnection();
            return;
        }
        performRoomActions();
        
        function performRoomActions() {
            performRoomActionsWithSocket(socket);
        }
        
        function performRoomActionsWithSocket(socketToUse: any) {
            if (roomRef.current && roomRef.current !== activeRoomId) {
                socketToUse.emit("leaveRoom", { roomId: roomRef.current, userId });
                roomRef.current = null;
            }
            if (convoRef.current && convoRef.current !== activeConversationId) {
                socketToUse.emit("direct:leave", { conversationId: convoRef.current });
                convoRef.current = null;
            }
            if (activeRoomId) {
                socketToUse.emit("joinRoom", { roomId: activeRoomId, userId });
                roomRef.current = activeRoomId;
            } else if (activeConversationId) {
                socketToUse.emit("direct:join", { conversationId: activeConversationId });
                convoRef.current = activeConversationId;
            }
            setMessages([]);
            setTypingUsers([]);
        }
    }, [socket, activeRoomId, activeConversationId, userId, username]);

    useEffect(() => {
        if (!socket) return;

        const handleChatMessage = (messageData: any) => {
            // Immediately remove typing indicator for the user who sent this message
            if (messageData.userId) {
                setTypingUsers((prev) => prev.filter((u) => u.userId !== messageData.userId));
            }
            
            const queryKey =
                roomRef.current && activeRoomId
                    ? ["chatMessages", activeRoomId]
                    : convoRef.current && activeConversationId
                        ? ["dmMessages", activeConversationId]
                        : null;

            if (queryKey) {
                queryClient.invalidateQueries({ queryKey: queryKey });
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
            if (queryKey) {
                queryClient.invalidateQueries({ queryKey: queryKey });
            }
        };

        // Handle room user presence updates
        const handleUserJoined = () => {
            if (roomRef.current) {
                queryClient.invalidateQueries({ queryKey: ['roomUsers', roomRef.current] });
            }
        };

        const handleUserLeft = () => {
            if (roomRef.current) {
                queryClient.invalidateQueries({ queryKey: ['roomUsers', roomRef.current] });
            }
        };

        const handleRoomUsers = () => {
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
            socket.offAny();
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

    const stopTyping = () => {
        const globalSocket = (window as any).socket;
        const socketToUse = (socket && socket.connected) ? socket : (globalSocket && globalSocket.connected) ? globalSocket : null;
        
        // Clear any existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        // Emit stop typing event
        if (socketToUse && userId && username) {
            socketToUse.emit("chat:stopTyping", {
                userId,
                username,
                avatarUrl: avatarUrl ?? "/default-avatar.png",
            });
        }
    };

    const emitTyping = () => {
        const globalSocket = (window as any).socket;
        const socketToUse = (socket && socket.connected) ? socket : (globalSocket && globalSocket.connected) ? globalSocket : null;
        
        if (socketToUse && userId && username) {
            // Clear any existing timeout to prevent multiple overlapping timers
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            socketToUse.emit("chat:typing", {
                userId,
                username,
                avatarUrl: avatarUrl ?? "/default-avatar.png",
            });

            // Store the timeout reference for cleanup
            typingTimeoutRef.current = setTimeout(() => {
                stopTyping();
            }, 2000);
        }
    };

    const sendMessage = ({ content, fileUrl, fileName, mimeType, audioFormat, audioFileSize, audioDuration }: { content: string; fileUrl: string; fileName: string; mimeType: string; audioFormat?: string; audioFileSize?: number; audioDuration?: number; }) => {
        const globalSocket = (window as any).socket;
        const socketToUse = (socket && socket.connected) ? socket : (globalSocket && globalSocket.connected) ? globalSocket : null;
        
        if ((!content.trim() && !fileUrl) || !socketToUse) {
            return;
        }

        // Immediately stop typing when sending a message
        stopTyping();

        const timestamp = new Date().toISOString();
        const usernameOrGuest = username || "Guest";
        if (activeRoomId) {
            socketToUse.emit("chat:message", {
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
            socketToUse.emit("direct:message", {
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
        stopTyping,
        sendMessage,
    };
};
