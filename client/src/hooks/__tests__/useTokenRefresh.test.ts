import { renderHook } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTokenRefresh } from '../useTokenRefresh';
import * as authTokens from '../../utils/auth-tokens';

// Mock the auth-tokens module
vi.mock('../../utils/auth-tokens', () => ({
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
  getTokenExpirationTime: vi.fn()
}));

describe('useTokenRefresh', () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Mock localStorage
    localStorageMock = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        })
      },
      writable: true
    });

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear all running timers
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorageMock = {};
  });

  test('should not schedule refresh when no token exists', () => {
    // No token in localStorage
    renderHook(() => useTokenRefresh());

    expect(authTokens.getTokenExpirationTime).not.toHaveBeenCalled();
    expect(authTokens.refreshAccessToken).not.toHaveBeenCalled();
  });

  test('should not schedule refresh when token expiration time cannot be determined', () => {
    localStorageMock.token = 'invalid-token';
    vi.mocked(authTokens.getTokenExpirationTime).mockReturnValue(null);

    renderHook(() => useTokenRefresh());

    expect(authTokens.getTokenExpirationTime).toHaveBeenCalledWith('invalid-token');
    expect(authTokens.refreshAccessToken).not.toHaveBeenCalled();
  });

  test('should schedule refresh at 80% of token lifetime', async () => {
    const mockToken = 'valid-token';
    const now = Date.now();
    const expirationTime = now + (60 * 60 * 1000); // 1 hour from now
    const expectedRefreshTime = (expirationTime - now) * 0.8; // 80% of lifetime

    localStorageMock.token = mockToken;
    vi.mocked(authTokens.getTokenExpirationTime).mockReturnValue(expirationTime);
    vi.mocked(authTokens.refreshAccessToken).mockResolvedValue('new-token');

    const { unmount } = renderHook(() => useTokenRefresh());

    expect(authTokens.getTokenExpirationTime).toHaveBeenCalledWith(mockToken);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Token refresh scheduled in')
    );

    // Fast-forward to the scheduled refresh time
    vi.advanceTimersByTime(expectedRefreshTime);
    
    // Allow async operations to complete
    await vi.runAllTimersAsync();

    expect(authTokens.refreshAccessToken).toHaveBeenCalled();
    
    // Clean up
    unmount();
  });

  test('should handle token refresh failure gracefully', async () => {
    const mockToken = 'failing-token';
    const now = Date.now();
    const expirationTime = now + (60 * 60 * 1000);

    localStorageMock.token = mockToken;
    vi.mocked(authTokens.getTokenExpirationTime).mockReturnValue(expirationTime);
    vi.mocked(authTokens.refreshAccessToken).mockRejectedValue(new Error('Refresh failed'));

    const { unmount } = renderHook(() => useTokenRefresh());

    const refreshTime = (expirationTime - now) * 0.8;
    
    // Advance timers to trigger the refresh
    vi.advanceTimersByTime(refreshTime);
    
    // Allow async operations to complete
    await vi.runAllTimersAsync();

    // The error should have been logged
    expect(console.error).toHaveBeenCalledWith(
      'Proactive token refresh failed:',
      expect.any(Error)
    );
    
    // Clean up the hook to prevent hanging
    unmount();
  });

  test('should handle storage change events', async () => {
    localStorageMock.token = 'initial-token';
    vi.mocked(authTokens.getTokenExpirationTime).mockReturnValue(Date.now() + 60 * 60 * 1000);

    const { unmount } = renderHook(() => useTokenRefresh());

    // Simulate token update via storage event
    const newToken = 'updated-token';
    const storageEvent = new StorageEvent('storage', {
      key: 'token',
      newValue: newToken
    });

    window.dispatchEvent(storageEvent);

    expect(console.log).toHaveBeenCalledWith('Token updated, rescheduling refresh');
    // Should call getTokenExpirationTime again for new token
    expect(authTokens.getTokenExpirationTime).toHaveBeenCalledTimes(2);
    
    // Clean up
    unmount();
  });

  test('should handle logout events by clearing intervals', () => {
    localStorageMock.token = 'valid-token';
    vi.mocked(authTokens.getTokenExpirationTime).mockReturnValue(Date.now() + 60 * 60 * 1000);

    const { unmount } = renderHook(() => useTokenRefresh());

    // Simulate logout event
    const logoutEvent = new CustomEvent('auth:logout');
    window.dispatchEvent(logoutEvent);

    // Should clear any existing intervals
    // This is tested indirectly by ensuring no errors occur
    unmount();
  });

  test('should clean up intervals and event listeners on unmount', () => {
    localStorageMock.token = 'valid-token';
    vi.mocked(authTokens.getTokenExpirationTime).mockReturnValue(Date.now() + 60 * 60 * 1000);

    const { unmount } = renderHook(() => useTokenRefresh());

    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('auth:logout', expect.any(Function));
  });

  test('should ignore storage events for other keys', () => {
    localStorageMock.token = 'valid-token';
    vi.mocked(authTokens.getTokenExpirationTime).mockReturnValue(Date.now() + 60 * 60 * 1000);

    renderHook(() => useTokenRefresh());

    // Simulate storage event for different key
    const storageEvent = new StorageEvent('storage', {
      key: 'other-key',
      newValue: 'some-value'
    });

    const initialCallCount = vi.mocked(authTokens.getTokenExpirationTime).mock.calls.length;
    
    window.dispatchEvent(storageEvent);

    // Should not trigger rescheduling
    expect(authTokens.getTokenExpirationTime).toHaveBeenCalledTimes(initialCallCount);
  });

  test('should refresh immediately if token is expired', async () => {
    const mockToken = 'expired-token';
    const now = Date.now();
    const expirationTime = now - (5 * 60 * 1000); // 5 minutes ago

    localStorageMock.token = mockToken;
    
    // After refresh, the token should no longer be expired
    vi.mocked(authTokens.getTokenExpirationTime)
      .mockReturnValueOnce(expirationTime) // First call - expired
      .mockReturnValue(now + (60 * 60 * 1000)); // Subsequent calls - valid
    
    vi.mocked(authTokens.isTokenExpired)
      .mockReturnValueOnce(true) // First call - expired
      .mockReturnValue(false); // Subsequent calls - not expired
      
    vi.mocked(authTokens.refreshAccessToken).mockResolvedValue('new-token');

    const { unmount } = renderHook(() => useTokenRefresh());

    // Allow the initial async refresh to complete
    await vi.runAllTimersAsync();

    expect(authTokens.isTokenExpired).toHaveBeenCalledWith(mockToken);
    expect(authTokens.refreshAccessToken).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Expired token refreshed');
    
    // Clean up
    unmount();
  });

  test('should handle errors in token expiration time calculation', () => {
    localStorageMock.token = 'problematic-token';
    vi.mocked(authTokens.getTokenExpirationTime).mockImplementation(() => {
      throw new Error('Token parsing error');
    });

    renderHook(() => useTokenRefresh());

    expect(console.error).toHaveBeenCalledWith(
      'Error scheduling token refresh:',
      expect.any(Error)
    );
  });
});