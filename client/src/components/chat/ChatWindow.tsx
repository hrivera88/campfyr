import { useEffect, useRef, useState, useMemo } from "react";
import { io } from "socket.io-client";
import api from "../../services/axios";
import { Box, Typography, CircularProgress } from "@mui/material";
import { useSocket } from "../../hooks/useSocket";
import { useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRoomMembershipCheck } from "@/hooks/useRoomMembershipCheck";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { useChatSocket } from "@/hooks/useChatSocket";

export type MessageInputState = {
  content: string;
  files: File[];
  voiceMetadata?: { [fileName: string]: { duration: number; blob: Blob } };
};

const ChatWindow = ({
  socketOverride,
}: {
  socketOverride?: ReturnType<typeof io>;
}) => {
  /**
   * Local State
   */
  const [input, setInput] = useState<MessageInputState>({
    content: "",
    files: [],
    voiceMetadata: {},
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  /**
   * WebSockets
   */
  const fallbackSocket = useSocket();
  // Use global socket as emergency fallback
  const globalSocket = (window as any).socket;
  const socket = socketOverride ?? fallbackSocket ?? globalSocket;
  

  /**
   * Theme
   */
  const theme = useTheme();

  /**
   * Global State Selectors
   */
  const activeRoom = useSelector((state: RootState) => state?.room.activeRoom);
  const mode = useSelector((state: RootState) => state.sidebar.mode);
  const activeConversation = useSelector(
    (state: RootState) => state.conversation.activeConversation
  );
  const user = useSelector((state: RootState) => state?.auth.user);
  const isMember = useSelector((state: RootState) => state?.room.isMember);
  
  const isDM = mode === "dm";
  const chatId = isDM ? activeConversation?.id : activeRoom?.id;
  const queryKey =
    isDM && activeConversation?.id
      ? ["dmMessages", activeConversation.id]
      : !isDM && activeRoom?.id
      ? ["chatMessages", activeRoom.id]
      : null;
  useRoomMembershipCheck(activeRoom?.id);

  // Chat Socket Hook
  const { typingUsers, emitTyping, sendMessage } = useChatSocket({
    socket,
    activeRoomId: isDM ? undefined : activeRoom?.id,
    activeConversationId: isDM ? activeConversation?.id : undefined,
    userId: user?.id,
    avatarUrl: user?.avatarUrl,
    username: user?.username,
  });

  const {
    data: paginatedMessages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKey!,
    enabled: !!chatId,
    initialPageParam: null,
    refetchOnMount: true,
    queryFn: async ({ pageParam = null }) => {
      const endpoint = isDM
        ? `/api/direct/conversations/${chatId}/messages?cursor=${
            pageParam ?? ""
          }`
        : `/api/messages/${activeRoom?.id}?cursor=${pageParam ?? ""}`;

      const response = await api.get(endpoint);
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.meta) return undefined;
      return lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined;
    },
  });

  // Flat out pages
  const allMessages = useMemo(() => {
    return paginatedMessages?.pages.flatMap((page) => page.data) ?? [];
  }, [paginatedMessages]);

  useEffect(() => {
    if (!allMessages.length) return;
    const hasMedia = allMessages.some(
      (msg) =>
        msg.fileUrl &&
        (msg.mimeType?.startsWith("image/") ||
          msg.mimeType?.startsWith("video/"))
    );
    if (!hasMedia && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages, typingUsers]);

  useEffect(() => {
    const el = topRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "0px",
        threshold: 0.1,
      }
    );
    observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSend = async () => {
    const hasText = input.content.trim() !== "";
    const hasFiles = input.files.length > 0;

    if (!hasText && !hasFiles) {
      return;
    }

    for (const file of input.files) {
      const formData = new FormData();
      formData.append("file", file);
      
      // Add audio duration for voice messages
      if (file.type.startsWith('audio/') && input.voiceMetadata?.[file.name]) {
        const voiceData = input.voiceMetadata[file.name];
        formData.append("audioDuration", voiceData.duration.toString());
      }

      const res = await api.post("/api/upload", formData);
      const responseData = res.data.data;
      
      sendMessage({
        content: input.content.trim(),
        fileUrl: responseData.fileUrl,
        fileName: responseData.fileName,
        mimeType: responseData.mimeType,
        // Include audio metadata if present
        ...(responseData.audioDuration && { audioDuration: responseData.audioDuration }),
        ...(responseData.audioFileSize && { audioFileSize: responseData.audioFileSize }),
        ...(responseData.audioFormat && { audioFormat: responseData.audioFormat }),
      });
    }

    if (hasText && !hasFiles) {
      sendMessage({
        content: input.content.trim(),
        fileName: "",
        fileUrl: "",
        mimeType: "",
      });
    }
    setInput({ content: "", files: [], voiceMetadata: {} });
  };

  const EmptyState = ({ icon, text }: {icon: string, text: string}) => (
    <Box
              mb={1}
              sx={{
                borderRadius: 2,
                py: 1,
                px: 2,
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                component={"img"}
                src={icon}
                alt="yodeler"
                sx={{ width: 150, height: "auto", mb: 2 }}
              />
              <Typography sx={{ fontSize: "1.05rem", fontWeight: 400 }}>
                {text}
              </Typography>
            </Box>);

  const LoadingState = () => (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress color="primary" size={28} />
            </Box>
  );

  const LockedState = () => ( 
        <Box
            sx={{
              p: 2,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              textAlign: "center",
            }}
          >
            <Box
              component="img"
              src="/locked.svg"
              alt="locked"
              sx={{ width: 150, height: "auto", mb: 2 }}
            />
            <Typography variant="h6">
              You are not a member of this room.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please join the room to see and send messages.
            </Typography>
        </Box>
  );

  return (
    <Box
      sx={{
        p: 1,
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        height: "100%",
        rowGap: 1,
      }}
    >
      <Box
        ref={scrollContainerRef}
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          overflowX: "hidden",
          minHeight: 0,
          borderRadius: 1,
          backgroundColor: `${theme.palette.background.paper}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isDM ? (
          !activeConversation ? (
            <EmptyState
              icon="/hello-start.svg"
              text="Start your conversation"
            />
          ) : isLoading ? (
            <LoadingState />
          ) : allMessages.length > 0 ? (
            <MessageList
              messages={allMessages}
              currentUsername={user?.username}
              theme={theme}
              messagesEndRef={messagesEndRef}
              typingUsers={typingUsers}
              topRef={topRef}
            />
          ) : (
            <EmptyState
              icon="/hello-start.svg"
              text="Start your conversation"
            />
          )
        ) : isMember === undefined ? (
          <LoadingState />
        ) : isMember && allMessages.length > 0 ? (
          <>
            <MessageList
              messages={allMessages}
              currentUsername={user?.username}
              theme={theme}
              messagesEndRef={messagesEndRef}
              typingUsers={typingUsers}
              topRef={topRef}
            />
          </>
        ) : isMember && !isLoading ? (
          <EmptyState
            icon="/yodeler.svg"
            text="Awfully quiet here, try yodeling."
          />
        ) : !isMember ? (
          <LockedState />
        ) : null}
      </Box>
      {/* Input Section */}
      {activeRoom || activeConversation ? (
        <MessageInput
          input={input}
          setInput={setInput}
          onSend={handleSend}
          onTyping={emitTyping}
          theme={theme}
        />
      ) : (
        ""
      )}
    </Box>
  );
};

export default ChatWindow;
