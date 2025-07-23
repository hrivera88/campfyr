import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import conversationReducer, {
  setActiveConversation,
} from "../conversationSlice";
import type { DirectConversationSchemaType, DirectMessageSchemaType } from "../../../schemas/direct";

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('conversationSlice', () => {
  const createMockMessage = (overrides: Partial<DirectMessageSchemaType> = {}): DirectMessageSchemaType => ({
    id: "msg-1",
    conversationId: "conv-1",
    senderId: "user-1",
    content: "Hello world",
    sender: {
      id: "user-1",
      username: "testuser",
      avatarUrl: null,
    },
    timestamp: "2024-01-01T10:00:00Z",
    caption: null,
    fileUrl: null,
    fileName: null,
    mimeType: null,
    audioDuration: null,
    audioFileSize: null,
    audioFormat: null,
    ...overrides,
  });

  const createMockConversation = (overrides: Partial<DirectConversationSchemaType> = {}): DirectConversationSchemaType => ({
    id: "conv-1",
    user1Id: "user-1",
    user2Id: "user-2",
    messages: [createMockMessage()],
    createdAt: "2024-01-01T09:00:00Z",
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    test('has correct initial state', () => {
      const initialState = conversationReducer(undefined, { type: '@@INIT' });
      
      expect(initialState).toEqual({
        activeConversation: null,
      });
    });

    test('preserves state structure on unknown action', () => {
      const previousState = {
        activeConversation: createMockConversation(),
      };
      
      const newState = conversationReducer(previousState, { type: 'UNKNOWN_ACTION' });
      
      expect(newState).toEqual(previousState);
    });
  });

  describe('setActiveConversation Action', () => {
    test('sets active conversation when payload is provided', () => {
      const conversation = createMockConversation();
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation).toEqual(conversation);
    });

    test('saves conversation to localStorage when setting active conversation', () => {
      const conversation = createMockConversation();
      const action = setActiveConversation(conversation);
      
      conversationReducer(undefined, action);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'activeConversation',
        JSON.stringify(conversation)
      );
    });

    test('sets active conversation to null when payload is null', () => {
      const previousState = {
        activeConversation: createMockConversation(),
      };
      
      const action = setActiveConversation(null);
      const newState = conversationReducer(previousState, action);
      
      expect(newState.activeConversation).toBeNull();
    });

    test('saves null to localStorage when setting active conversation to null', () => {
      const action = setActiveConversation(null);
      
      conversationReducer(undefined, action);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'activeConversation',
        JSON.stringify(null)
      );
    });

    test('replaces existing active conversation', () => {
      const initialConversation = createMockConversation({ 
        id: "conv-1", 
        user1Id: "user-1", 
        user2Id: "user-2" 
      });
      const newConversation = createMockConversation({ 
        id: "conv-2", 
        user1Id: "user-1", 
        user2Id: "user-3" 
      });
      
      const stateWithConversation = conversationReducer(undefined, setActiveConversation(initialConversation));
      const finalState = conversationReducer(stateWithConversation, setActiveConversation(newConversation));
      
      expect(finalState.activeConversation).toEqual(newConversation);
      expect(finalState.activeConversation?.id).toBe("conv-2");
      expect(finalState.activeConversation?.user2Id).toBe("user-3");
    });

    test('handles conversation with multiple messages', () => {
      const messages = [
        createMockMessage({ id: "msg-1", content: "First message" }),
        createMockMessage({ id: "msg-2", content: "Second message" }),
        createMockMessage({ id: "msg-3", content: "Third message" }),
      ];
      
      const conversation = createMockConversation({ messages });
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation?.messages).toHaveLength(3);
      expect(newState.activeConversation?.messages[0].content).toBe("First message");
      expect(newState.activeConversation?.messages[1].content).toBe("Second message");
      expect(newState.activeConversation?.messages[2].content).toBe("Third message");
    });

    test('handles conversation with empty messages array', () => {
      const conversation = createMockConversation({ messages: [] });
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation?.messages).toEqual([]);
    });

    test('handles conversation with media messages', () => {
      const mediaMessage = createMockMessage({
        content: "Check out this image!",
        fileUrl: "https://example.com/image.jpg",
        fileName: "image.jpg",
        mimeType: "image/jpeg",
        caption: "A beautiful sunset",
      });
      
      const conversation = createMockConversation({ messages: [mediaMessage] });
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation?.messages[0].fileUrl).toBe("https://example.com/image.jpg");
      expect(newState.activeConversation?.messages[0].fileName).toBe("image.jpg");
      expect(newState.activeConversation?.messages[0].mimeType).toBe("image/jpeg");
      expect(newState.activeConversation?.messages[0].caption).toBe("A beautiful sunset");
    });

    test('handles conversation with audio messages', () => {
      const audioMessage = createMockMessage({
        content: "Voice message",
        fileUrl: "https://example.com/audio.mp3",
        fileName: "voice_note.mp3",
        mimeType: "audio/mpeg",
        audioDuration: 30.5,
        audioFileSize: 512000,
        audioFormat: "mp3",
      });
      
      const conversation = createMockConversation({ messages: [audioMessage] });
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      const storedMessage = newState.activeConversation?.messages[0];
      expect(storedMessage?.audioDuration).toBe(30.5);
      expect(storedMessage?.audioFileSize).toBe(512000);
      expect(storedMessage?.audioFormat).toBe("mp3");
    });

    test('handles conversation with special characters in content', () => {
      const message = createMockMessage({
        content: "Message with émojis 🚀 & special chars!@#$%^&*()"
      });
      
      const conversation = createMockConversation({ messages: [message] });
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation?.messages[0].content).toBe("Message with émojis 🚀 & special chars!@#$%^&*()");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'activeConversation',
        JSON.stringify(conversation)
      );
    });

    test('handles conversation with very long message content', () => {
      const longContent = "A".repeat(10000);
      const message = createMockMessage({ content: longContent });
      const conversation = createMockConversation({ messages: [message] });
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation?.messages[0].content).toBe(longContent);
    });

    test('handles conversation with minimal valid data', () => {
      const minimalConversation = createMockConversation({
        id: "conv-minimal",
        user1Id: "u1",
        user2Id: "u2",
        messages: [],
        createdAt: "2024-01-01T00:00:00Z",
      });
      const action = setActiveConversation(minimalConversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation).toEqual(minimalConversation);
    });
  });

  describe('Action Creators', () => {
    test('setActiveConversation action creator produces correct action', () => {
      const conversation = createMockConversation();
      const action = setActiveConversation(conversation);
      
      expect(action).toEqual({
        type: 'conversation/setActiveConversation',
        payload: conversation,
      });
    });

    test('setActiveConversation with null produces correct action', () => {
      const action = setActiveConversation(null);
      
      expect(action).toEqual({
        type: 'conversation/setActiveConversation',
        payload: null,
      });
    });
  });

  describe('Complex State Transitions', () => {
    test('handles conversation switching flow', () => {
      const conv1 = createMockConversation({ 
        id: "conv-1", 
        user1Id: "user-1", 
        user2Id: "user-2" 
      });
      const conv2 = createMockConversation({ 
        id: "conv-2", 
        user1Id: "user-1", 
        user2Id: "user-3" 
      });
      
      let state = conversationReducer(undefined, setActiveConversation(conv1));
      expect(state.activeConversation?.id).toBe("conv-1");
      
      // Switch to new conversation
      state = conversationReducer(state, setActiveConversation(conv2));
      expect(state.activeConversation?.id).toBe("conv-2");
    });

    test('handles conversation clearing flow', () => {
      const conversation = createMockConversation();
      
      let state = conversationReducer(undefined, setActiveConversation(conversation));
      expect(state.activeConversation).toBeTruthy();
      
      // Clear conversation
      state = conversationReducer(state, setActiveConversation(null));
      expect(state.activeConversation).toBeNull();
    });

    test('handles rapid conversation changes', () => {
      const conv1 = createMockConversation({ id: "conv-1" });
      const conv2 = createMockConversation({ id: "conv-2" });
      let state = conversationReducer(undefined, { type: '@@INIT' });
      
      // Rapid conversation changes
      state = conversationReducer(state, setActiveConversation(conv1));
      state = conversationReducer(state, setActiveConversation(null));
      state = conversationReducer(state, setActiveConversation(conv2));
      state = conversationReducer(state, setActiveConversation(null));
      state = conversationReducer(state, setActiveConversation(conv1));
      
      expect(state.activeConversation?.id).toBe("conv-1");
    });

    test('handles conversation updates while preserving other state', () => {
      // Since this slice only has activeConversation, we test state preservation
      const initialConversation = createMockConversation({ id: "conv-1" });
      let state = conversationReducer(undefined, setActiveConversation(initialConversation));
      
      const updatedConversation = createMockConversation({ 
        id: "conv-1",
        messages: [
          ...initialConversation.messages,
          createMockMessage({ id: "msg-2", content: "New message" })
        ]
      });
      
      state = conversationReducer(state, setActiveConversation(updatedConversation));
      
      expect(state.activeConversation?.messages).toHaveLength(2);
      expect(state.activeConversation?.messages[1].content).toBe("New message");
    });
  });

  describe('localStorage Integration', () => {
    test('handles localStorage setItem errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage quota exceeded');
      });
      
      const conversation = createMockConversation();
      const action = setActiveConversation(conversation);
      
      expect(() => conversationReducer(undefined, action)).not.toThrow();
    });

    test('correctly serializes complex conversation data to localStorage', () => {
      const complexConversation = createMockConversation({
        id: "conv-complex",
        user1Id: "user-1",
        user2Id: "user-2",
        createdAt: "2024-01-01T10:30:45.123Z",
        messages: [
          createMockMessage({
            id: "msg-1",
            content: "Complex message with 特殊字符 and émojis 🚀",
            sender: {
              id: "user-1",
              username: "complex_user",
              avatarUrl: "https://example.com/avatar.jpg",
            },
            fileUrl: "https://example.com/file.pdf",
            fileName: "document.pdf",
            mimeType: "application/pdf",
          }),
        ],
      });
      
      const action = setActiveConversation(complexConversation);
      conversationReducer(undefined, action);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'activeConversation',
        JSON.stringify(complexConversation)
      );
    });

    test('localStorage operations are called in correct sequence', () => {
      const conv1 = createMockConversation({ id: "conv-1" });
      const conv2 = createMockConversation({ id: "conv-2" });
      
      let state = conversationReducer(undefined, setActiveConversation(conv1));
      state = conversationReducer(state, setActiveConversation(conv2));
      state = conversationReducer(state, setActiveConversation(null));
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
      
      const setItemCalls = mockLocalStorage.setItem.mock.calls;
      expect(setItemCalls[0]).toEqual(['activeConversation', JSON.stringify(conv1)]);
      expect(setItemCalls[1]).toEqual(['activeConversation', JSON.stringify(conv2)]);
      expect(setItemCalls[2]).toEqual(['activeConversation', JSON.stringify(null)]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles conversation with null/undefined message properties gracefully', () => {
      const messageWithNulls = createMockMessage({
        caption: null,
        fileUrl: null,
        fileName: null,
        mimeType: null,
        audioDuration: null,
        audioFileSize: null,
        audioFormat: null,
      });
      
      const conversation = createMockConversation({ messages: [messageWithNulls] });
      const action = setActiveConversation(conversation);
      
      expect(() => conversationReducer(undefined, action)).not.toThrow();
      const newState = conversationReducer(undefined, action);
      expect(newState.activeConversation?.messages[0]).toEqual(messageWithNulls);
    });

    test('handles malformed action payload gracefully', () => {
      const malformedAction = {
        type: 'conversation/setActiveConversation',
        payload: { invalid: 'data' } as any,
      };
      
      expect(() => conversationReducer(undefined, malformedAction)).not.toThrow();
    });

    test('handles undefined action payload', () => {
      const undefinedAction = {
        type: 'conversation/setActiveConversation',
        payload: undefined as any,
      };
      
      const newState = conversationReducer(undefined, undefinedAction);
      expect(newState.activeConversation).toBeUndefined();
    });

    test('handles state with missing properties', () => {
      const incompleteState = {} as any;
      
      const action = setActiveConversation(createMockConversation());
      const newState = conversationReducer(incompleteState, action);
      
      expect(newState.activeConversation).toBeTruthy();
    });

    test('handles conversation with invalid timestamp formats', () => {
      // Test with invalid but preserved timestamps
      const conversationWithInvalidTimestamp = {
        id: "conv-1",
        user1Id: "user-1",
        user2Id: "user-2",
        messages: [],
        createdAt: "invalid-timestamp",
      } as any;
      
      const action = setActiveConversation(conversationWithInvalidTimestamp);
      
      expect(() => conversationReducer(undefined, action)).not.toThrow();
    });
  });

  describe('Type Safety and Immutability', () => {
    test('does not mutate original state', () => {
      const originalState = {
        activeConversation: createMockConversation({ id: "original" }),
      };
      
      const originalStateCopy = JSON.parse(JSON.stringify(originalState));
      
      const action = setActiveConversation(createMockConversation({ id: "new" }));
      const newState = conversationReducer(originalState, action);
      
      // Original state should be unchanged
      expect(originalState).toEqual(originalStateCopy);
      
      // New state should be different
      expect(newState).not.toBe(originalState);
      expect(newState.activeConversation?.id).toBe("new");
    });

    test('creates new state object on changes', () => {
      const initialState = {
        activeConversation: null,
      };
      
      const action = setActiveConversation(createMockConversation());
      const newState = conversationReducer(initialState, action);
      
      expect(newState).not.toBe(initialState);
      expect(newState.activeConversation).not.toBe(initialState.activeConversation);
    });

    test('returns same state reference when no changes occur', () => {
      const state = {
        activeConversation: createMockConversation(),
      };
      
      const unknownAction = { type: 'UNKNOWN_ACTION' };
      const newState = conversationReducer(state, unknownAction);
      
      expect(newState).toBe(state); // Should return exact same reference for unknown actions
    });

    test('preserves deep object structure integrity', () => {
      const conversation = createMockConversation({
        messages: [
          createMockMessage({
            sender: {
              id: "user-1",
              username: "testuser",
              avatarUrl: "https://example.com/avatar.jpg",
            },
          }),
        ],
      });
      
      const action = setActiveConversation(conversation);
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation?.messages[0].sender).toEqual({
        id: "user-1",
        username: "testuser",
        avatarUrl: "https://example.com/avatar.jpg",
      });
    });
  });

  describe('Performance Considerations', () => {
    test('handles large conversation with many messages efficiently', () => {
      const largeMessages = Array.from({ length: 1000 }, (_, i) => 
        createMockMessage({
          id: `msg-${i}`,
          content: `Message ${i}`,
        })
      );
      
      const largeConversation = createMockConversation({ messages: largeMessages });
      const action = setActiveConversation(largeConversation);
      
      const start = performance.now();
      const newState = conversationReducer(undefined, action);
      const end = performance.now();
      
      expect(newState.activeConversation?.messages).toHaveLength(1000);
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });

    test('handles conversation with large message content efficiently', () => {
      const largeContent = "A".repeat(100000);
      const conversation = createMockConversation({
        messages: [createMockMessage({ content: largeContent })],
      });
      
      const action = setActiveConversation(conversation);
      
      const start = performance.now();
      const newState = conversationReducer(undefined, action);
      const end = performance.now();
      
      expect(newState.activeConversation?.messages[0].content).toBe(largeContent);
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });

    test('handles rapid action dispatching', () => {
      const conversation = createMockConversation();
      let state = conversationReducer(undefined, { type: '@@INIT' });
      
      const start = performance.now();
      
      // Dispatch 1000 actions rapidly
      for (let i = 0; i < 1000; i++) {
        const conv = i % 2 === 0 ? conversation : null;
        state = conversationReducer(state, setActiveConversation(conv));
      }
      
      const end = performance.now();
      
      expect(state.activeConversation).toBeNull(); // Should be null after even number of iterations
      expect(end - start).toBeLessThan(1000); // Should complete within reasonable time
    });
  });

  describe('Message Handling', () => {
    test('preserves message order in conversation', () => {
      const messages = [
        createMockMessage({ id: "msg-1", timestamp: "2024-01-01T10:00:00Z" }),
        createMockMessage({ id: "msg-2", timestamp: "2024-01-01T10:01:00Z" }),
        createMockMessage({ id: "msg-3", timestamp: "2024-01-01T10:02:00Z" }),
      ];
      
      const conversation = createMockConversation({ messages });
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation?.messages[0].id).toBe("msg-1");
      expect(newState.activeConversation?.messages[1].id).toBe("msg-2");
      expect(newState.activeConversation?.messages[2].id).toBe("msg-3");
    });

    test('handles messages with different senders', () => {
      const messages = [
        createMockMessage({
          id: "msg-1",
          senderId: "user-1",
          sender: { id: "user-1", username: "alice" },
        }),
        createMockMessage({
          id: "msg-2",
          senderId: "user-2",
          sender: { id: "user-2", username: "bob" },
        }),
      ];
      
      const conversation = createMockConversation({ messages });
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation?.messages[0].sender.username).toBe("alice");
      expect(newState.activeConversation?.messages[1].sender.username).toBe("bob");
    });

    test('handles mixed media and text messages', () => {
      const messages = [
        createMockMessage({ id: "msg-1", content: "Text message" }),
        createMockMessage({
          id: "msg-2",
          content: "Image message",
          fileUrl: "https://example.com/image.jpg",
          mimeType: "image/jpeg",
        }),
        createMockMessage({
          id: "msg-3",
          content: "Audio message",
          fileUrl: "https://example.com/audio.mp3",
          mimeType: "audio/mpeg",
          audioDuration: 45.2,
        }),
      ];
      
      const conversation = createMockConversation({ messages });
      const action = setActiveConversation(conversation);
      
      const newState = conversationReducer(undefined, action);
      
      expect(newState.activeConversation?.messages[0].fileUrl).toBeNull();
      expect(newState.activeConversation?.messages[1].mimeType).toBe("image/jpeg");
      expect(newState.activeConversation?.messages[2].audioDuration).toBe(45.2);
    });
  });
});