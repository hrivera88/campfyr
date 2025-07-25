import { renderHook, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { useChatSocket, type TypingUser } from "../useChatSocket";
import type { UserMessageSchemaType } from "../../schemas/chat";

// Mock dependencies
vi.mock("socket.io-client");
vi.mock("../utils/capitalizeWords");
// Create a mock that can be updated in beforeEach
let mockQueryClient: any;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => mockQueryClient),
}));

// Mock console methods
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('useChatSocket', () => {
  let mockSocket: any;
  
  const createMockMessage = (overrides: Partial<UserMessageSchemaType> = {}): UserMessageSchemaType => ({
    username: "testuser",
    content: "Test message",
    timestamp: "2024-01-01T10:00:00Z",
    roomId: "room-1",
    conversationId: null,
    caption: null,
    fileUrl: null,
    fileName: null,
    mimeType: null,
    audioDuration: null,
    audioFileSize: null,
    audioFormat: null,
    sender: {
      id: "user-1",
      username: "testuser",
      avatarUrl: "https://example.com/avatar.jpg",
    },
    ...overrides,
  });

  const createMockTypingUser = (overrides: Partial<TypingUser> = {}): TypingUser => ({
    username: "typinguser",
    userId: "typing-user-1",
    avatarUrl: "https://example.com/typing-avatar.jpg",
    ...overrides,
  });

  // Define defaultProps that gets updated in beforeEach
  let defaultProps: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Don't reset all mocks as this breaks our console spies
    
    // Reset console mocks to ensure they're working
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    
    // Mock socket
    mockSocket = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      offAny: vi.fn(),
      connected: true,
    };
    
    // Mock window.socket as a fallback
    (global as any).window = {
      socket: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        offAny: vi.fn(),
        connected: true,
      }
    };
    
    // Mock query client - useQueryClient is already mocked at module level
    mockQueryClient = {
      refetchQueries: vi.fn(),
      invalidateQueries: vi.fn(),
    };
    
    // Update defaultProps with current mockSocket
    defaultProps = {
      socket: mockSocket,
      activeRoomId: undefined,
      userId: "user-1",
      username: "testuser",
      avatarUrl: "https://example.com/avatar.jpg",
      activeConversationId: undefined,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Don't reset/restore all mocks as this breaks our console spies
  });

  describe('Initialization', () => {
    test('initializes with empty state', () => {
      const { result } = renderHook(() => useChatSocket(defaultProps));
      
      expect(result.current.messages).toEqual([]);
      expect(result.current.typingUsers).toEqual([]);
      expect(typeof result.current.emitTyping).toBe('function');
      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.setMessages).toBe('function');
    });

    test('does not setup socket listeners when socket is null', () => {
      renderHook(() => useChatSocket({ ...defaultProps, socket: null }));
      
      expect(mockSocket.on).not.toHaveBeenCalled();
    });

    test('does not setup socket listeners when userId is missing', () => {
      renderHook(() => useChatSocket({ ...defaultProps, userId: undefined }));
      
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('Room Management', () => {
    test('joins room when activeRoomId is provided', () => {
      renderHook(() => useChatSocket({ 
        ...defaultProps, 
        activeRoomId: "room-1" 
      }));
      
      expect(mockSocket.emit).toHaveBeenCalledWith("joinRoom", {
        roomId: "room-1",
        userId: "user-1",
      });
    });

    test('joins direct conversation when activeConversationId is provided', () => {
      renderHook(() => useChatSocket({ 
        ...defaultProps, 
        activeConversationId: "conv-1" 
      }));
      
      expect(mockSocket.emit).toHaveBeenCalledWith("direct:join", {
        conversationId: "conv-1",
      });
    });

    test('leaves previous room when switching rooms', () => {
      const { rerender } = renderHook(
        (props) => useChatSocket(props),
        { 
          initialProps: { ...defaultProps, activeRoomId: "room-1" } 
        }
      );

      // Clear previous calls
      mockSocket.emit.mockClear();

      // Switch to different room
      rerender({ ...defaultProps, activeRoomId: "room-2" });

      expect(mockSocket.emit).toHaveBeenCalledWith("leaveRoom", {
        roomId: "room-1",
        userId: "user-1",
      });
      expect(mockSocket.emit).toHaveBeenCalledWith("joinRoom", {
        roomId: "room-2",
        userId: "user-1",
      });
    });

    test('leaves previous conversation when switching conversations', () => {
      const { rerender } = renderHook(
        (props) => useChatSocket(props),
        { 
          initialProps: { ...defaultProps, activeConversationId: "conv-1" } 
        }
      );

      mockSocket.emit.mockClear();

      // Switch to different conversation
      rerender({ ...defaultProps, activeConversationId: "conv-2" });

      expect(mockSocket.emit).toHaveBeenCalledWith("direct:leave", {
        conversationId: "conv-1",
      });
      expect(mockSocket.emit).toHaveBeenCalledWith("direct:join", {
        conversationId: "conv-2",
      });
    });

    test('clears messages and typing users when switching contexts', () => {
      const { result, rerender } = renderHook(
        (props) => useChatSocket(props),
        { 
          initialProps: { ...defaultProps, activeRoomId: "room-1" } 
        }
      );

      // Simulate having some state
      act(() => {
        result.current.setMessages([createMockMessage()]);
      });

      // Switch room
      rerender({ ...defaultProps, activeRoomId: "room-2" });

      expect(result.current.messages).toEqual([]);
      expect(result.current.typingUsers).toEqual([]);
    });
  });

  describe('Socket Event Listeners', () => {
    test('sets up all required event listeners', () => {
      renderHook(() => useChatSocket(defaultProps));
      
      expect(mockSocket.on).toHaveBeenCalledWith("chat:message", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("direct:message", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("chat:typing", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("chat:stopTyping", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("userJoined", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("userLeft", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("roomUsers", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("connect_error", expect.any(Function));
    });

    test('removes event listeners on cleanup', () => {
      const { unmount } = renderHook(() => useChatSocket(defaultProps));
      
      unmount();
      
      expect(mockSocket.off).toHaveBeenCalledWith("chat:message", expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith("direct:message", expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith("chat:typing", expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith("chat:stopTyping", expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith("userJoined", expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith("userLeft", expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith("roomUsers", expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith("connect_error", expect.any(Function));
      expect(mockSocket.offAny).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    test('handles chat message and refetches queries for room', () => {
      renderHook(() => useChatSocket({ 
        ...defaultProps, 
        activeRoomId: "room-1" 
      }));
      
      // Get the chat message handler
      const chatMessageHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:message"
      )?.[1];
      
      expect(chatMessageHandler).toBeDefined();
      
      // Simulate receiving a message
      const mockMessage = createMockMessage();
      act(() => {
        chatMessageHandler(mockMessage);
      });
      
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["chatMessages", "room-1"]
      });
    });

    test('handles direct message and refetches queries for conversation', () => {
      renderHook(() => useChatSocket({ 
        ...defaultProps, 
        activeConversationId: "conv-1" 
      }));
      
      // Get the direct message handler
      const directMessageHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "direct:message"
      )?.[1];
      
      expect(directMessageHandler).toBeDefined();
      
      // Simulate receiving a direct message
      const mockMessage = createMockMessage();
      act(() => {
        directMessageHandler(mockMessage);
      });
      
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["dmMessages", "conv-1"]
      });
    });

    test('handles message when no valid query key exists', () => {
      renderHook(() => useChatSocket(defaultProps)); // No active room or conversation
      
      const chatMessageHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:message"
      )?.[1];
      
      const mockMessage = createMockMessage();
      
      // Should not throw error when no valid query key
      expect(() => {
        act(() => {
          chatMessageHandler(mockMessage);
        });
      }).not.toThrow();
      
      // Should not call invalidateQueries when no valid query key
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
    });
  });

  describe('Typing Indicators', () => {
    test('adds typing user when chat:typing event received', () => {
      const { result } = renderHook(() => useChatSocket(defaultProps));
      
      const typingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:typing"
      )?.[1];
      
      const typingUser = createMockTypingUser();
      act(() => {
        typingHandler(typingUser);
      });
      
      expect(result.current.typingUsers).toContainEqual(typingUser);
    });

    test('does not add duplicate typing users', () => {
      const { result } = renderHook(() => useChatSocket(defaultProps));
      
      const typingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:typing"
      )?.[1];
      
      const typingUser = createMockTypingUser();
      
      // Add user twice
      act(() => {
        typingHandler(typingUser);
        typingHandler(typingUser);
      });
      
      expect(result.current.typingUsers).toHaveLength(1);
      expect(result.current.typingUsers[0]).toEqual(typingUser);
    });

    test('removes typing user when chat:stopTyping event received', () => {
      const { result } = renderHook(() => useChatSocket(defaultProps));
      
      const typingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:typing"
      )?.[1];
      const stopTypingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:stopTyping"
      )?.[1];
      
      const typingUser = createMockTypingUser();
      
      // Add user
      act(() => {
        typingHandler(typingUser);
      });
      
      expect(result.current.typingUsers).toContainEqual(typingUser);
      
      // Remove user
      act(() => {
        stopTypingHandler(typingUser);
      });
      
      expect(result.current.typingUsers).not.toContainEqual(typingUser);
    });

    test('handles multiple typing users', () => {
      const { result } = renderHook(() => useChatSocket(defaultProps));
      
      const typingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:typing"
      )?.[1];
      const stopTypingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:stopTyping"
      )?.[1];
      
      const user1 = createMockTypingUser({ userId: "user-1", username: "alice" });
      const user2 = createMockTypingUser({ userId: "user-2", username: "bob" });
      
      // Add both users
      act(() => {
        typingHandler(user1);
        typingHandler(user2);
      });
      
      expect(result.current.typingUsers).toHaveLength(2);
      expect(result.current.typingUsers).toContainEqual(user1);
      expect(result.current.typingUsers).toContainEqual(user2);
      
      // Remove first user
      act(() => {
        stopTypingHandler(user1);
      });
      
      expect(result.current.typingUsers).toHaveLength(1);
      expect(result.current.typingUsers).toContainEqual(user2);
      expect(result.current.typingUsers).not.toContainEqual(user1);
    });
  });

  describe('emitTyping Function', () => {
    test('emits typing event with correct data', () => {
      const { result } = renderHook(() => useChatSocket(defaultProps));
      
      act(() => {
        result.current.emitTyping();
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith("chat:typing", {
        userId: "user-1",
        username: "testuser",
        avatarUrl: "https://example.com/avatar.jpg",
      });
    });

    test('uses default avatar when avatarUrl is not provided', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        avatarUrl: undefined 
      }));
      
      act(() => {
        result.current.emitTyping();
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith("chat:typing", {
        userId: "user-1",
        username: "testuser",
        avatarUrl: "/default-avatar.png",
      });
    });

    test('automatically emits stop typing after 2 seconds', async () => {
      vi.useFakeTimers();
      
      const { result } = renderHook(() => useChatSocket(defaultProps));
      
      act(() => {
        result.current.emitTyping();
      });
      
      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith("chat:stopTyping", {
        userId: "user-1",
        username: "testuser",
        avatarUrl: "https://example.com/avatar.jpg",
      });
      
      vi.useRealTimers();
    });

    test('does not emit when socket is null', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        socket: null 
      }));
      
      act(() => {
        result.current.emitTyping();
      });
      
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('does not emit when userId is missing', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        userId: undefined 
      }));
      
      act(() => {
        result.current.emitTyping();
      });
      
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('does not emit when username is missing', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        username: undefined 
      }));
      
      act(() => {
        result.current.emitTyping();
      });
      
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage Function', () => {
    test('sends room message with text content', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        activeRoomId: "room-1" 
      }));
      
      const messageData = {
        content: "Hello world",
        fileUrl: "",
        fileName: "",
        mimeType: "",
      };
      
      act(() => {
        result.current.sendMessage(messageData);
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith("chat:message", {
        username: "testuser",
        content: "Hello world",
        fileUrl: "",
        fileName: "",
        mimeType: "",
        timestamp: expect.any(String),
        roomId: "room-1",
      });
    });

    test('sends direct message with file content', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        activeConversationId: "conv-1" 
      }));
      
      const messageData = {
        content: "",
        fileUrl: "https://example.com/file.jpg",
        fileName: "file.jpg",
        mimeType: "image/jpeg",
      };
      
      act(() => {
        result.current.sendMessage(messageData);
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith("direct:message", {
        conversationId: "conv-1",
        content: "",
        fileUrl: "https://example.com/file.jpg",
        fileName: "file.jpg",
        mimeType: "image/jpeg",
      });
    });

    test('sends message with audio metadata', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        activeRoomId: "room-1" 
      }));
      
      const messageData = {
        content: "",
        fileUrl: "https://example.com/audio.mp3",
        fileName: "audio.mp3",
        mimeType: "audio/mp3",
        audioDuration: 120,
        audioFileSize: 1024000,
        audioFormat: "mp3",
      };
      
      act(() => {
        result.current.sendMessage(messageData);
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith("chat:message", expect.objectContaining({
        audioDuration: 120,
        audioFileSize: 1024000,
        audioFormat: "mp3",
      }));
    });

    test('uses "Guest" username when username is not provided', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        username: undefined,
        activeRoomId: "room-1" 
      }));
      
      const messageData = {
        content: "Hello",
        fileUrl: "",
        fileName: "",
        mimeType: "",
      };
      
      act(() => {
        result.current.sendMessage(messageData);
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith("chat:message", expect.objectContaining({
        username: "Guest",
      }));
    });

    test('does not send empty messages', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        activeRoomId: "room-1" 
      }));
      
      const messageData = {
        content: "   ", // whitespace only
        fileUrl: "",
        fileName: "",
        mimeType: "",
      };
      
      act(() => {
        result.current.sendMessage(messageData);
      });
      
      expect(mockSocket.emit).not.toHaveBeenCalledWith("chat:message", expect.any(Object));
    });

    test('does not send when socket is null', () => {
      const { result } = renderHook(() => useChatSocket({ 
        ...defaultProps, 
        socket: null,
        activeRoomId: "room-1" 
      }));
      
      const messageData = {
        content: "Hello",
        fileUrl: "",
        fileName: "",
        mimeType: "",
      };
      
      act(() => {
        result.current.sendMessage(messageData);
      });
      
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('warns when no active room or conversation', () => {
      const { result } = renderHook(() => useChatSocket(defaultProps)); // No active context
      
      const messageData = {
        content: "Hello",
        fileUrl: "",
        fileName: "",
        mimeType: "",
      };
      
      act(() => {
        result.current.sendMessage(messageData);
      });
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        "No activeRoomId or activeConversationId, cannot send message"
      );
    });
  });

  describe('Error Handling', () => {
    test('handles connection errors', () => {
      // Clear any previous calls before the test
      mockConsoleError.mockClear();
      
      renderHook(() => useChatSocket(defaultProps));
      
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === "connect_error"
      )?.[1];
      
      expect(errorHandler).toBeDefined();
      
      const error = { message: "Connection failed" };
      errorHandler(error);
      
      // The console.error should be called with the message and error.message as separate args
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Socket connection error:",
        "Connection failed"
      );
    });

    test('handles malformed typing user data', () => {
      renderHook(() => useChatSocket(defaultProps));
      
      const typingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:typing"
      )?.[1];
      
      // Malformed typing user
      const malformedUser = { username: "test" }; // missing userId
      
      expect(() => {
        act(() => {
          typingHandler(malformedUser);
        });
      }).not.toThrow();
    });

    test('handles missing message data gracefully', () => {
      renderHook(() => useChatSocket({ 
        ...defaultProps, 
        activeRoomId: "room-1" 
      }));
      
      const chatMessageHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:message"
      )?.[1];
      
      // The implementation currently has a bug where it tries to access messageData.userId 
      // without null checking. We test that it handles empty message objects gracefully.
      expect(() => {
        act(() => {
          chatMessageHandler({});
        });
      }).not.toThrow();
      
      expect(() => {
        act(() => {
          chatMessageHandler({ userId: "test-user" });
        });
      }).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    test('handles rapid room switching', () => {
      const { rerender } = renderHook(
        (props) => useChatSocket(props),
        { 
          initialProps: { ...defaultProps, activeRoomId: "room-1" } 
        }
      );

      // Rapidly switch rooms
      rerender({ ...defaultProps, activeRoomId: "room-2" });
      rerender({ ...defaultProps, activeRoomId: "room-3" });
      rerender({ ...defaultProps, activeRoomId: "room-4" });

      // Should handle all transitions without errors
      expect(mockSocket.emit).toHaveBeenCalledWith("joinRoom", {
        roomId: "room-4",
        userId: "user-1",
      });
    });

    test('handles switching between rooms and conversations', () => {
      const { rerender } = renderHook(
        (props) => useChatSocket(props),
        { 
          initialProps: { ...defaultProps, activeRoomId: "room-1" } 
        }
      );

      mockSocket.emit.mockClear();

      // Switch to conversation
      rerender({ 
        ...defaultProps, 
        activeRoomId: undefined,
        activeConversationId: "conv-1" 
      });

      expect(mockSocket.emit).toHaveBeenCalledWith("leaveRoom", {
        roomId: "room-1",
        userId: "user-1",
      });
      expect(mockSocket.emit).toHaveBeenCalledWith("direct:join", {
        conversationId: "conv-1",
      });

      mockSocket.emit.mockClear();

      // Switch back to room
      rerender({ 
        ...defaultProps, 
        activeRoomId: "room-2",
        activeConversationId: undefined 
      });

      expect(mockSocket.emit).toHaveBeenCalledWith("direct:leave", {
        conversationId: "conv-1",
      });
      expect(mockSocket.emit).toHaveBeenCalledWith("joinRoom", {
        roomId: "room-2",
        userId: "user-1",
      });
    });

    test('handles complete user session flow', () => {
      const { result, rerender } = renderHook(
        (props) => useChatSocket(props),
        { 
          initialProps: { ...defaultProps, activeRoomId: "room-1" } 
        }
      );

      // User sends a message
      act(() => {
        result.current.sendMessage({
          content: "Hello everyone",
          fileUrl: "",
          fileName: "",
          mimeType: "",
        });
      });

      // User starts typing
      act(() => {
        result.current.emitTyping();
      });

      // Other user starts typing (simulate event)
      const typingHandler = mockSocket.on.mock.calls.find(
        call => call[0] === "chat:typing"
      )?.[1];
      
      act(() => {
        typingHandler(createMockTypingUser({ userId: "other-user" }));
      });

      expect(result.current.typingUsers).toHaveLength(1);

      // Switch rooms
      rerender({ ...defaultProps, activeRoomId: "room-2" });

      // Typing users should be cleared
      expect(result.current.typingUsers).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    test('cleans up timers on unmount', () => {
      vi.useFakeTimers();
      
      const { result, unmount } = renderHook(() => useChatSocket(defaultProps));
      
      // Clear any setup calls
      mockSocket.emit.mockClear();
      
      // Start typing (creates timer)
      act(() => {
        result.current.emitTyping();
      });
      
      // Should have emitted typing
      expect(mockSocket.emit).toHaveBeenCalledWith("chat:typing", {
        userId: "user-1",
        username: "testuser",
        avatarUrl: "https://example.com/avatar.jpg",
      });
      expect(mockSocket.emit).toHaveBeenCalledTimes(1);
      
      // Unmount before timer completes
      unmount();
      
      // Timer should be cleaned up, so advancing time should not cause more emissions
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      
      // No additional socket emissions should occur after unmount
      expect(mockSocket.emit).toHaveBeenCalledTimes(1); // Only the initial typing emit
      
      vi.useRealTimers();
    });

    test('handles multiple rapid emitTyping calls', () => {
      vi.useFakeTimers();
      
      const { result } = renderHook(() => useChatSocket(defaultProps));
      
      // Clear any previous mock calls from setup
      mockSocket.emit.mockClear();
      
      // Emit typing multiple times rapidly
      act(() => {
        result.current.emitTyping();
        result.current.emitTyping();
        result.current.emitTyping();
      });
      
      // Should emit typing 3 times (one for each call)
      expect(mockSocket.emit).toHaveBeenCalledWith("chat:typing", {
        userId: "user-1",
        username: "testuser",
        avatarUrl: "https://example.com/avatar.jpg",
      });
      expect(mockSocket.emit).toHaveBeenCalledTimes(3);
      
      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      
      // Should emit stop typing only ONCE (previous timeouts are cleared by rapid calls)
      // This is correct behavior - prevents spam of stopTyping events
      const stopTypingCalls = mockSocket.emit.mock.calls.filter(
        (call: any) => call[0] === "chat:stopTyping"
      );
      expect(stopTypingCalls).toHaveLength(1);
      
      // Total calls: 3 typing + 1 stopTyping = 4
      expect(mockSocket.emit).toHaveBeenCalledTimes(4);
      
      vi.useRealTimers();
    });
  });
});