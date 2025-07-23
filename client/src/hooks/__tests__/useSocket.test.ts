import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { useSocket } from "../useSocket";
import { connectSocket } from "../../lib/socket";

// Mock the socket connection library
vi.mock("../../lib/socket", () => ({
  connectSocket: vi.fn(),
}));

// Mock console.warn to avoid noise in test output
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('useSocket', () => {
  let mockSocket: any;
  let mockConnectSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleWarn.mockClear();

    // Create mock socket
    mockSocket = {
      disconnect: vi.fn(),
      connect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connected: false,
      id: 'mock-socket-id',
    };

    // Get the mocked connectSocket function
    mockConnectSocket = connectSocket as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Don't reset/restore all mocks as this breaks our module mocks
  });

  describe('Socket Initialization', () => {
    test('initializes with null socket', () => {
      mockConnectSocket.mockResolvedValue(null);
      
      const { result } = renderHook(() => useSocket());
      
      expect(result.current).toBeNull();
    });

    test('calls connectSocket on mount', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      let unmount: () => void;
      await act(async () => {
        const result = renderHook(() => useSocket());
        unmount = result.unmount;
      });
      
      expect(mockConnectSocket).toHaveBeenCalledTimes(1);
      
      // Clean up
      unmount!();
    });

    test('sets socket when connectSocket resolves successfully', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      const { result } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result.current).toBe(mockSocket);
      });
    });

    test('keeps socket as null when connectSocket returns null', async () => {
      mockConnectSocket.mockResolvedValue(null);
      
      const { result } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result.current).toBeNull();
      });
    });

    test('keeps socket as null when connectSocket rejects', async () => {
      mockConnectSocket.mockRejectedValue(new Error('Connection failed'));
      
      const { result } = renderHook(() => useSocket());
      
      // Wait a bit to ensure promise rejection is handled
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(result.current).toBeNull();
    });
  });

  describe('Socket Connection States', () => {
    test('handles successful socket connection', async () => {
      const connectedSocket = {
        ...mockSocket,
        connected: true,
      };
      
      mockConnectSocket.mockResolvedValue(connectedSocket);
      
      const { result } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result.current).toBe(connectedSocket);
        expect(result.current?.connected).toBe(true);
      });
    });

    test('handles socket connection with properties', async () => {
      const socketWithProps = {
        ...mockSocket,
        id: 'test-socket-123',
        connected: true,
        custom: 'property',
      };
      
      mockConnectSocket.mockResolvedValue(socketWithProps);
      
      const { result } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result.current?.id).toBe('test-socket-123');
        expect(result.current?.custom).toBe('property');
      });
    });
  });

  describe('Connection Timing and Race Conditions', () => {
    test('handles slow socket connection', async () => {
      // Simulate slow connection
      mockConnectSocket.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockSocket), 1000))
      );
      
      const { result } = renderHook(() => useSocket());
      
      // Initially should be null
      expect(result.current).toBeNull();
      
      // After connection resolves
      await waitFor(() => {
        expect(result.current).toBe(mockSocket);
      }, { timeout: 2000 });
    });

    test('handles component unmount before connection completes', async () => {
      let resolveConnection: (socket: any) => void;
      
      // Create a promise that we control
      mockConnectSocket.mockReturnValue(
        new Promise(resolve => {
          resolveConnection = resolve;
        })
      );
      
      const { result, unmount } = renderHook(() => useSocket());
      
      // Unmount before connection completes
      unmount();
      
      // Now resolve the connection
      resolveConnection!(mockSocket);
      
      // Socket should not be set because component was unmounted
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(result.current).toBeNull();
    });

    test('handles multiple rapid re-renders during connection', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      const { result, rerender } = renderHook(() => useSocket());
      
      // Trigger multiple re-renders quickly
      rerender();
      rerender();
      rerender();
      
      await waitFor(() => {
        expect(result.current).toBe(mockSocket);
      });
      
      // connectSocket should only be called once despite re-renders
      expect(mockConnectSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup and Disconnection', () => {
    test('disconnects socket on unmount', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      const { unmount } = renderHook(() => useSocket());
      
      // Wait for socket to be connected
      await waitFor(() => {
        expect(mockConnectSocket).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    });

    test('handles unmount when socket is null', () => {
      mockConnectSocket.mockResolvedValue(null);
      
      const { unmount } = renderHook(() => useSocket());
      
      // Should not throw when unmounting with null socket
      expect(() => unmount()).not.toThrow();
    });

    test('handles unmount during connection process', async () => {
      let resolveConnection: (socket: any) => void;
      
      mockConnectSocket.mockReturnValue(
        new Promise(resolve => {
          resolveConnection = resolve;
        })
      );
      
      const { unmount } = renderHook(() => useSocket());
      
      // Unmount while connection is in progress
      unmount();
      
      // Complete the connection after unmount
      resolveConnection!(mockSocket);
      
      // Should not call disconnect since socket was never set
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    test('prevents socket update after unmount', async () => {
      let resolveConnection: (socket: any) => void;
      
      mockConnectSocket.mockReturnValue(
        new Promise(resolve => {
          resolveConnection = resolve;
        })
      );
      
      const { result, unmount } = renderHook(() => useSocket());
      
      unmount();
      
      // Try to resolve connection after unmount
      resolveConnection!(mockSocket);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Socket should remain null
      expect(result.current).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('handles connectSocket throwing synchronous error', () => {
      mockConnectSocket.mockImplementation(() => {
        throw new Error('Synchronous connection error');
      });
      
      expect(() => renderHook(() => useSocket())).not.toThrow();
    });

    test('handles connectSocket rejecting with error', async () => {
      const connectionError = new Error('Async connection error');
      mockConnectSocket.mockRejectedValue(connectionError);
      
      const { result } = renderHook(() => useSocket());
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(result.current).toBeNull();
    });

    test('handles connectSocket rejecting with non-error value', async () => {
      mockConnectSocket.mockRejectedValue('String error');
      
      const { result } = renderHook(() => useSocket());
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(result.current).toBeNull();
    });

    test('handles connectSocket returning undefined', async () => {
      mockConnectSocket.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result.current).toBeNull();
      });
    });

    test('handles socket disconnect method throwing error', async () => {
      const errorSocket = {
        ...mockSocket,
        disconnect: vi.fn().mockImplementation(() => {
          throw new Error('Disconnect error');
        }),
      };
      
      mockConnectSocket.mockResolvedValue(errorSocket);
      
      const { unmount } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(mockConnectSocket).toHaveBeenCalled();
      });
      
      // Should not throw when disconnect throws error
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Socket State Management', () => {
    test('maintains socket reference across re-renders', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      const { result, rerender } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result.current).toBe(mockSocket);
      });
      
      const firstSocketRef = result.current;
      
      // Re-render multiple times
      rerender();
      rerender();
      rerender();
      
      // Socket reference should remain the same
      expect(result.current).toBe(firstSocketRef);
      expect(result.current).toBe(mockSocket);
    });

    test('socket state persists across re-renders', async () => {
      const persistentSocket = {
        ...mockSocket,
        connected: true,
        customProperty: 'test-value',
      };
      
      mockConnectSocket.mockResolvedValue(persistentSocket);
      
      const { result, rerender } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result.current?.connected).toBe(true);
        expect(result.current?.customProperty).toBe('test-value');
      });
      
      rerender();
      
      expect(result.current?.connected).toBe(true);
      expect(result.current?.customProperty).toBe('test-value');
    });
  });

  describe('Integration Scenarios', () => {
    test('handles successful connection followed by forced disconnection', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      const { result, unmount } = renderHook(() => useSocket());
      
      // Wait for connection
      await waitFor(() => {
        expect(result.current).toBe(mockSocket);
      });
      
      // Simulate external disconnection
      if (result.current) {
        result.current.connected = false;
      }
      
      // Unmount should still call disconnect
      unmount();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    test('handles connection retry scenario', async () => {
      // First connection fails, then succeeds on second hook instance
      mockConnectSocket
        .mockRejectedValueOnce(new Error('First connection failed'))
        .mockResolvedValueOnce(mockSocket);
      
      // First hook instance - connection fails
      const { result: result1 } = renderHook(() => useSocket());
      
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(result1.current).toBeNull();
      
      // Second hook instance - connection succeeds (simulating retry in app)
      const { result: result2 } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result2.current).toBeTruthy();
        expect(result2.current?.id).toBe('mock-socket-id');
      });
      
      // First instance should still be null
      expect(result1.current).toBeNull();
    });

    test('handles multiple hook instances', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      const { result: result1 } = renderHook(() => useSocket());
      const { result: result2 } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result1.current).toBeTruthy();
        expect(result2.current).toBeTruthy();
        // Both should have the same properties, but may be different instances
        expect(result1.current?.id).toBe('mock-socket-id');
        expect(result2.current?.id).toBe('mock-socket-id');
      });
      
      // Both hooks should have called connectSocket
      expect(mockConnectSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('Memory Leaks Prevention', () => {
    test('prevents memory leaks with rapid mount/unmount cycles', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      // Simulate rapid mount/unmount cycles
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderHook(() => useSocket());
        unmount();
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have tried to connect 10 times
      expect(mockConnectSocket).toHaveBeenCalledTimes(10);
    });

    test('handles concurrent connection attempts', async () => {
      let connectionCount = 0;
      mockConnectSocket.mockImplementation(() => {
        connectionCount++;
        return Promise.resolve({
          ...mockSocket,
          id: `socket-${connectionCount}`,
        });
      });
      
      // Start multiple hooks simultaneously
      const hooks = Array.from({ length: 5 }, () => renderHook(() => useSocket()));
      
      await waitFor(() => {
        hooks.forEach(({ result }) => {
          expect(result.current).toBeTruthy();
        });
      });
      
      // Clean up all hooks
      hooks.forEach(({ unmount }) => unmount());
      
      expect(mockConnectSocket).toHaveBeenCalledTimes(5);
    });
  });

  describe('Edge Cases', () => {
    test('handles connectSocket returning falsy values', async () => {
      const falsyValues = [null, undefined, false, 0, '', NaN];
      
      for (const falsyValue of falsyValues) {
        mockConnectSocket.mockResolvedValueOnce(falsyValue);
        
        const { result } = renderHook(() => useSocket());
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(result.current).toBeNull();
      }
    });

    test('handles socket with minimal interface', async () => {
      const minimalSocket = {
        disconnect: vi.fn(),
      };
      
      mockConnectSocket.mockResolvedValue(minimalSocket);
      
      const { result, unmount } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result.current).toBe(minimalSocket);
      });
      
      unmount();
      expect(minimalSocket.disconnect).toHaveBeenCalled();
    });

    test('handles socket without disconnect method', async () => {
      const socketWithoutDisconnect = {
        id: 'socket-without-disconnect',
        connected: true,
      };
      
      mockConnectSocket.mockResolvedValue(socketWithoutDisconnect);
      
      const { result, unmount } = renderHook(() => useSocket());
      
      await waitFor(() => {
        expect(result.current).toBe(socketWithoutDisconnect);
      });
      
      // Should not throw even if disconnect method is missing
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('does not create new connections on re-renders', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      const { rerender } = renderHook(() => useSocket());
      
      // Multiple re-renders
      for (let i = 0; i < 5; i++) {
        rerender();
      }
      
      await waitFor(() => {
        expect(mockConnectSocket).toHaveBeenCalledTimes(1);
      });
    });

    test('efficiently handles rapid state changes', async () => {
      mockConnectSocket.mockResolvedValue(mockSocket);
      
      const { result } = renderHook(() => useSocket());
      
      // Simulate rapid state checks
      for (let i = 0; i < 100; i++) {
        expect(typeof result.current).toBe('object');
      }
      
      await waitFor(() => {
        expect(result.current).toBe(mockSocket);
      });
    });
  });
});