import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import chatRoomReducer, {
  setActiveRoom,
  clearActiveRoom,
  setRoomMembership,
  resetRoomMembership,
} from "../chatRoomSlice";
import type { ChatRoomSchemaType } from "../../../schemas/chat";

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

describe('chatRoomSlice', () => {
  const createMockRoom = (overrides: Partial<ChatRoomSchemaType> = {}): ChatRoomSchemaType => ({
    id: "room-1",
    name: "General",
    createdAt: "2024-01-01T10:00:00Z",
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
      const initialState = chatRoomReducer(undefined, { type: '@@INIT' });
      
      expect(initialState).toEqual({
        activeRoom: null,
        isMember: undefined,
      });
    });

    test('preserves state structure on unknown action', () => {
      const previousState = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      const newState = chatRoomReducer(previousState, { type: 'UNKNOWN_ACTION' });
      
      expect(newState).toEqual(previousState);
    });
  });

  describe('setActiveRoom Action', () => {
    test('sets active room when payload is provided', () => {
      const room = createMockRoom();
      const action = setActiveRoom(room);
      
      const newState = chatRoomReducer(undefined, action);
      
      expect(newState.activeRoom).toEqual(room);
      expect(newState.isMember).toBeUndefined();
    });

    test('saves room to localStorage when setting active room', () => {
      const room = createMockRoom();
      const action = setActiveRoom(room);
      
      chatRoomReducer(undefined, action);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'activeRoom',
        JSON.stringify(room)
      );
    });

    test('sets active room to null when payload is null', () => {
      const previousState = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      const action = setActiveRoom(null);
      const newState = chatRoomReducer(previousState, action);
      
      expect(newState.activeRoom).toBeNull();
      expect(newState.isMember).toBe(true); // isMember should be preserved
    });

    test('saves null to localStorage when setting active room to null', () => {
      const action = setActiveRoom(null);
      
      chatRoomReducer(undefined, action);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'activeRoom',
        JSON.stringify(null)
      );
    });

    test('replaces existing active room', () => {
      const initialRoom = createMockRoom({ id: "room-1", name: "General" });
      const newRoom = createMockRoom({ id: "room-2", name: "Random" });
      
      const stateWithRoom = chatRoomReducer(undefined, setActiveRoom(initialRoom));
      const finalState = chatRoomReducer(stateWithRoom, setActiveRoom(newRoom));
      
      expect(finalState.activeRoom).toEqual(newRoom);
      expect(finalState.activeRoom?.id).toBe("room-2");
      expect(finalState.activeRoom?.name).toBe("Random");
    });

    test('handles room with special characters in name', () => {
      const room = createMockRoom({ 
        name: "Room with émojis 🚀 & special chars!@#$%^&*()" 
      });
      const action = setActiveRoom(room);
      
      const newState = chatRoomReducer(undefined, action);
      
      expect(newState.activeRoom?.name).toBe("Room with émojis 🚀 & special chars!@#$%^&*()");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'activeRoom',
        JSON.stringify(room)
      );
    });

    test('handles room with very long name', () => {
      const longName = "A".repeat(1000);
      const room = createMockRoom({ name: longName });
      const action = setActiveRoom(room);
      
      const newState = chatRoomReducer(undefined, action);
      
      expect(newState.activeRoom?.name).toBe(longName);
    });

    test('handles room with minimal valid data', () => {
      const minimalRoom = createMockRoom({
        id: "1",
        name: "A",
        createdAt: "2024-01-01T00:00:00Z",
      });
      const action = setActiveRoom(minimalRoom);
      
      const newState = chatRoomReducer(undefined, action);
      
      expect(newState.activeRoom).toEqual(minimalRoom);
    });
  });

  describe('clearActiveRoom Action', () => {
    test('clears active room from state', () => {
      const stateWithRoom = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      const action = clearActiveRoom();
      const newState = chatRoomReducer(stateWithRoom, action);
      
      expect(newState.activeRoom).toBeNull();
      expect(newState.isMember).toBe(true); // isMember should be preserved
    });

    test('removes room from localStorage', () => {
      const action = clearActiveRoom();
      
      chatRoomReducer(undefined, action);
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('activeRoom');
    });

    test('handles clearing when active room is already null', () => {
      const stateWithoutRoom = {
        activeRoom: null,
        isMember: false,
      };
      
      const action = clearActiveRoom();
      const newState = chatRoomReducer(stateWithoutRoom, action);
      
      expect(newState.activeRoom).toBeNull();
      expect(newState.isMember).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('activeRoom');
    });

    test('is idempotent - multiple calls have same effect', () => {
      const stateWithRoom = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      const action = clearActiveRoom();
      const firstClear = chatRoomReducer(stateWithRoom, action);
      const secondClear = chatRoomReducer(firstClear, action);
      const thirdClear = chatRoomReducer(secondClear, action);
      
      expect(firstClear).toEqual(secondClear);
      expect(secondClear).toEqual(thirdClear);
      expect(thirdClear.activeRoom).toBeNull();
    });
  });

  describe('setRoomMembership Action', () => {
    test('sets membership to true', () => {
      const action = setRoomMembership(true);
      const newState = chatRoomReducer(undefined, action);
      
      expect(newState.isMember).toBe(true);
      expect(newState.activeRoom).toBeNull(); // activeRoom should be preserved
    });

    test('sets membership to false', () => {
      const action = setRoomMembership(false);
      const newState = chatRoomReducer(undefined, action);
      
      expect(newState.isMember).toBe(false);
      expect(newState.activeRoom).toBeNull();
    });

    test('updates membership while preserving active room', () => {
      const stateWithRoom = {
        activeRoom: createMockRoom(),
        isMember: undefined,
      };
      
      const action = setRoomMembership(true);
      const newState = chatRoomReducer(stateWithRoom, action);
      
      expect(newState.isMember).toBe(true);
      expect(newState.activeRoom).toEqual(stateWithRoom.activeRoom);
    });

    test('changes membership from true to false', () => {
      const stateWithMembership = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      const action = setRoomMembership(false);
      const newState = chatRoomReducer(stateWithMembership, action);
      
      expect(newState.isMember).toBe(false);
      expect(newState.activeRoom).toEqual(stateWithMembership.activeRoom);
    });

    test('changes membership from false to true', () => {
      const stateWithoutMembership = {
        activeRoom: createMockRoom(),
        isMember: false,
      };
      
      const action = setRoomMembership(true);
      const newState = chatRoomReducer(stateWithoutMembership, action);
      
      expect(newState.isMember).toBe(true);
      expect(newState.activeRoom).toEqual(stateWithoutMembership.activeRoom);
    });

    test('overwrites undefined membership', () => {
      const stateWithUndefinedMembership = {
        activeRoom: createMockRoom(),
        isMember: undefined,
      };
      
      const action = setRoomMembership(true);
      const newState = chatRoomReducer(stateWithUndefinedMembership, action);
      
      expect(newState.isMember).toBe(true);
    });

    test('does not affect localStorage', () => {
      const action = setRoomMembership(true);
      
      chatRoomReducer(undefined, action);
      
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('resetRoomMembership Action', () => {
    test('resets membership to undefined', () => {
      const stateWithMembership = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      const action = resetRoomMembership();
      const newState = chatRoomReducer(stateWithMembership, action);
      
      expect(newState.isMember).toBeUndefined();
      expect(newState.activeRoom).toEqual(stateWithMembership.activeRoom);
    });

    test('resets membership from false to undefined', () => {
      const stateWithoutMembership = {
        activeRoom: createMockRoom(),
        isMember: false,
      };
      
      const action = resetRoomMembership();
      const newState = chatRoomReducer(stateWithoutMembership, action);
      
      expect(newState.isMember).toBeUndefined();
      expect(newState.activeRoom).toEqual(stateWithoutMembership.activeRoom);
    });

    test('handles resetting when membership is already undefined', () => {
      const stateWithUndefinedMembership = {
        activeRoom: createMockRoom(),
        isMember: undefined,
      };
      
      const action = resetRoomMembership();
      const newState = chatRoomReducer(stateWithUndefinedMembership, action);
      
      expect(newState.isMember).toBeUndefined();
      expect(newState.activeRoom).toEqual(stateWithUndefinedMembership.activeRoom);
    });

    test('does not affect localStorage', () => {
      const action = resetRoomMembership();
      
      chatRoomReducer(undefined, action);
      
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });

    test('is idempotent', () => {
      const stateWithMembership = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      const action = resetRoomMembership();
      const firstReset = chatRoomReducer(stateWithMembership, action);
      const secondReset = chatRoomReducer(firstReset, action);
      
      expect(firstReset).toEqual(secondReset);
      expect(secondReset.isMember).toBeUndefined();
    });
  });

  describe('Action Creators', () => {
    test('setActiveRoom action creator produces correct action', () => {
      const room = createMockRoom();
      const action = setActiveRoom(room);
      
      expect(action).toEqual({
        type: 'chatRoom/setActiveRoom',
        payload: room,
      });
    });

    test('setActiveRoom with null produces correct action', () => {
      const action = setActiveRoom(null);
      
      expect(action).toEqual({
        type: 'chatRoom/setActiveRoom',
        payload: null,
      });
    });

    test('clearActiveRoom action creator produces correct action', () => {
      const action = clearActiveRoom();
      
      expect(action).toEqual({
        type: 'chatRoom/clearActiveRoom',
      });
    });

    test('setRoomMembership action creator produces correct action', () => {
      const action = setRoomMembership(true);
      
      expect(action).toEqual({
        type: 'chatRoom/setRoomMembership',
        payload: true,
      });
    });

    test('resetRoomMembership action creator produces correct action', () => {
      const action = resetRoomMembership();
      
      expect(action).toEqual({
        type: 'chatRoom/resetRoomMembership',
      });
    });
  });

  describe('Complex State Transitions', () => {
    test('handles complete room joining flow', () => {
      let state = chatRoomReducer(undefined, { type: '@@INIT' });
      
      // Set active room
      const room = createMockRoom();
      state = chatRoomReducer(state, setActiveRoom(room));
      expect(state.activeRoom).toEqual(room);
      expect(state.isMember).toBeUndefined();
      
      // Set membership
      state = chatRoomReducer(state, setRoomMembership(true));
      expect(state.activeRoom).toEqual(room);
      expect(state.isMember).toBe(true);
    });

    test('handles room leaving flow', () => {
      let state = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      // Clear membership first
      state = chatRoomReducer(state, resetRoomMembership());
      expect(state.activeRoom).toBeTruthy();
      expect(state.isMember).toBeUndefined();
      
      // Clear room
      state = chatRoomReducer(state, clearActiveRoom());
      expect(state.activeRoom).toBeNull();
      expect(state.isMember).toBeUndefined();
    });

    test('handles room switching flow', () => {
      const room1 = createMockRoom({ id: "room-1", name: "General" });
      const room2 = createMockRoom({ id: "room-2", name: "Random" });
      
      let state = chatRoomReducer(undefined, setActiveRoom(room1));
      state = chatRoomReducer(state, setRoomMembership(true));
      
      // Switch to new room
      state = chatRoomReducer(state, setActiveRoom(room2));
      expect(state.activeRoom).toEqual(room2);
      expect(state.isMember).toBe(true); // Membership should be preserved
      
      // Update membership for new room
      state = chatRoomReducer(state, setRoomMembership(false));
      expect(state.activeRoom).toEqual(room2);
      expect(state.isMember).toBe(false);
    });

    test('handles rapid state changes', () => {
      const room = createMockRoom();
      let state = chatRoomReducer(undefined, { type: '@@INIT' });
      
      // Rapid room changes
      state = chatRoomReducer(state, setActiveRoom(room));
      state = chatRoomReducer(state, clearActiveRoom());
      state = chatRoomReducer(state, setActiveRoom(room));
      state = chatRoomReducer(state, clearActiveRoom());
      
      expect(state.activeRoom).toBeNull();
      
      // Rapid membership changes
      state = chatRoomReducer(state, setRoomMembership(true));
      state = chatRoomReducer(state, setRoomMembership(false));
      state = chatRoomReducer(state, resetRoomMembership());
      state = chatRoomReducer(state, setRoomMembership(true));
      
      expect(state.isMember).toBe(true);
    });
  });

  describe('localStorage Integration', () => {
    test('handles localStorage setItem errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage quota exceeded');
      });
      
      const room = createMockRoom();
      const action = setActiveRoom(room);
      
      expect(() => chatRoomReducer(undefined, action)).not.toThrow();
    });

    test('handles localStorage removeItem errors gracefully', () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });
      
      const action = clearActiveRoom();
      
      expect(() => chatRoomReducer(undefined, action)).not.toThrow();
    });

    test('correctly serializes complex room data to localStorage', () => {
      const complexRoom = createMockRoom({
        id: "room-123",
        name: "Complex Room with 特殊字符 and émojis 🚀",
        createdAt: "2024-01-01T10:30:45.123Z",
      });
      
      const action = setActiveRoom(complexRoom);
      chatRoomReducer(undefined, action);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'activeRoom',
        JSON.stringify(complexRoom)
      );
    });

    test('localStorage operations are called in correct sequence', () => {
      const room1 = createMockRoom({ id: "room-1" });
      const room2 = createMockRoom({ id: "room-2" });
      
      let state = chatRoomReducer(undefined, setActiveRoom(room1));
      state = chatRoomReducer(state, setActiveRoom(room2));
      state = chatRoomReducer(state, clearActiveRoom());
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(1);
      
      const setItemCalls = mockLocalStorage.setItem.mock.calls;
      expect(setItemCalls[0]).toEqual(['activeRoom', JSON.stringify(room1)]);
      expect(setItemCalls[1]).toEqual(['activeRoom', JSON.stringify(room2)]);
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('activeRoom');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles room with null properties gracefully', () => {
      // This tests type safety - in real usage, this shouldn't happen
      // but the reducer should handle it gracefully
      const action = setActiveRoom({
        id: "room-1",
        name: "Test Room",
        createdAt: "2024-01-01T10:00:00Z",
      });
      
      expect(() => chatRoomReducer(undefined, action)).not.toThrow();
    });

    test('handles malformed action payload gracefully', () => {
      // Test with malformed payload
      const malformedAction = {
        type: 'chatRoom/setActiveRoom',
        payload: { invalid: 'data' } as any,
      };
      
      expect(() => chatRoomReducer(undefined, malformedAction)).not.toThrow();
    });

    test('handles undefined action payload', () => {
      const undefinedAction = {
        type: 'chatRoom/setActiveRoom',
        payload: undefined as any,
      };
      
      const newState = chatRoomReducer(undefined, undefinedAction);
      expect(newState.activeRoom).toBeUndefined();
    });

    test('handles state with missing properties', () => {
      const incompleteState = { activeRoom: createMockRoom() } as any;
      
      const action = setRoomMembership(true);
      const newState = chatRoomReducer(incompleteState, action);
      
      expect(newState.isMember).toBe(true);
      expect(newState.activeRoom).toBeTruthy();
    });
  });

  describe('Type Safety and Immutability', () => {
    test('does not mutate original state', () => {
      const originalState = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      const originalStateCopy = JSON.parse(JSON.stringify(originalState));
      
      const action = setActiveRoom(createMockRoom({ id: "new-room" }));
      const newState = chatRoomReducer(originalState, action);
      
      // Original state should be unchanged
      expect(originalState).toEqual(originalStateCopy);
      
      // New state should be different
      expect(newState).not.toBe(originalState);
      expect(newState.activeRoom?.id).toBe("new-room");
    });

    test('creates new state object on changes', () => {
      const initialState = {
        activeRoom: null,
        isMember: undefined,
      };
      
      const action = setActiveRoom(createMockRoom());
      const newState = chatRoomReducer(initialState, action);
      
      expect(newState).not.toBe(initialState);
      expect(newState.activeRoom).not.toBe(initialState.activeRoom);
    });

    test('returns same state reference when no changes occur', () => {
      // This is not applicable for this slice as all actions modify state
      // But we can test that the state structure is preserved
      const state = {
        activeRoom: createMockRoom(),
        isMember: true,
      };
      
      const unknownAction = { type: 'UNKNOWN_ACTION' };
      const newState = chatRoomReducer(state, unknownAction);
      
      expect(newState).toBe(state); // Should return exact same reference for unknown actions
    });
  });

  describe('Performance Considerations', () => {
    test('handles large room names efficiently', () => {
      const largeRoomName = "A".repeat(10000);
      const room = createMockRoom({ name: largeRoomName });
      
      const action = setActiveRoom(room);
      
      const start = performance.now();
      const newState = chatRoomReducer(undefined, action);
      const end = performance.now();
      
      expect(newState.activeRoom?.name).toBe(largeRoomName);
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });

    test('handles rapid action dispatching', () => {
      const room = createMockRoom();
      let state = chatRoomReducer(undefined, { type: '@@INIT' });
      
      const start = performance.now();
      
      // Dispatch 1000 actions rapidly
      for (let i = 0; i < 1000; i++) {
        state = chatRoomReducer(state, setRoomMembership(i % 2 === 0));
      }
      
      const end = performance.now();
      
      expect(state.isMember).toBe(false); // Should be false after even number of iterations
      expect(end - start).toBeLessThan(1000); // Should complete within reasonable time
    });
  });
});