import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import {
  isTokenExpired,
  getTokenExpirationTime,
  getTimeUntilExpiry,
  refreshAccessToken
} from '../auth-tokens';

// Mock jwt-decode
vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn()
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

describe('auth-tokens', () => {
  let localStorageMock: Record<string, string>;
  let mockDate: number;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        })
      },
      writable: true,
      configurable: true
    });

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock window.dispatchEvent
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);

    // Set up consistent time for testing
    mockDate = 1640995200000; // Jan 1, 2022 00:00:00 UTC
    vi.spyOn(Date, 'now').mockReturnValue(mockDate);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorageMock = {};
  });

  describe('isTokenExpired', () => {
    test('should return true for null token', () => {
      expect(isTokenExpired(null)).toBe(true);
    });

    test('should return true for empty string token', () => {
      expect(isTokenExpired('')).toBe(true);
    });

    test('should return true for undefined token', () => {
      expect(isTokenExpired(undefined as any)).toBe(true);
    });

    test('should return false for valid non-expired token', () => {
      const futureExp = Math.floor(mockDate / 1000) + 3600; // 1 hour from now
      vi.mocked(jwtDecode).mockReturnValue({ exp: futureExp });

      expect(isTokenExpired('valid-jwt-token')).toBe(false);
      expect(jwtDecode).toHaveBeenCalledWith('valid-jwt-token');
    });

    test('should return true for expired token', () => {
      const pastExp = Math.floor(mockDate / 1000) - 3600; // 1 hour ago
      vi.mocked(jwtDecode).mockReturnValue({ exp: pastExp });

      expect(isTokenExpired('expired-jwt-token')).toBe(true);
    });

    test('should return true for token expiring within 30-second buffer', () => {
      // Token expires in 15 seconds (within 30-second buffer)
      const nearExp = Math.floor((mockDate + 15000) / 1000);
      vi.mocked(jwtDecode).mockReturnValue({ exp: nearExp });

      expect(isTokenExpired('near-expired-token')).toBe(true);
    });

    test('should return false for token expiring outside 30-second buffer', () => {
      // Token expires in 45 seconds (outside 30-second buffer)
      const safeExp = Math.floor((mockDate + 45000) / 1000);
      vi.mocked(jwtDecode).mockReturnValue({ exp: safeExp });

      expect(isTokenExpired('safe-token')).toBe(false);
    });

    test('should return true for malformed JWT token', () => {
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(isTokenExpired('malformed-token')).toBe(true);
      expect(jwtDecode).toHaveBeenCalledWith('malformed-token');
    });

    test('should return true for JWT token without exp claim', () => {
      vi.mocked(jwtDecode).mockReturnValue({} as any);

      expect(isTokenExpired('token-without-exp')).toBe(false);
    });

    test('should return true for JWT token with invalid exp type', () => {
      vi.mocked(jwtDecode).mockReturnValue({ exp: 'invalid' } as any);

      expect(isTokenExpired('token-invalid-exp')).toBe(false);
    });

    test('should handle edge case of exactly 30-second buffer', () => {
      // Token expires in exactly 30 seconds
      const exactBufferExp = Math.floor((mockDate + 30000) / 1000);
      vi.mocked(jwtDecode).mockReturnValue({ exp: exactBufferExp });

      expect(isTokenExpired('exact-buffer-token')).toBe(true);
    });
  });

  describe('getTokenExpirationTime', () => {
    test('should return null for null token', () => {
      expect(getTokenExpirationTime(null)).toBeNull();
    });

    test('should return null for empty string token', () => {
      expect(getTokenExpirationTime('')).toBeNull();
    });

    test('should return expiration time in milliseconds for valid token', () => {
      const expSeconds = Math.floor(mockDate / 1000) + 3600;
      const expectedMs = expSeconds * 1000;
      
      vi.mocked(jwtDecode).mockReturnValue({ exp: expSeconds });

      expect(getTokenExpirationTime('valid-token')).toBe(expectedMs);
      expect(jwtDecode).toHaveBeenCalledWith('valid-token');
    });

    test('should return null for malformed JWT token', () => {
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(getTokenExpirationTime('malformed-token')).toBeNull();
    });

    test('should return null for token without exp claim', () => {
      vi.mocked(jwtDecode).mockReturnValue({} as any);

      expect(getTokenExpirationTime('no-exp-token')).toBeNaN();
    });

    test('should handle zero expiration time', () => {
      vi.mocked(jwtDecode).mockReturnValue({ exp: 0 });

      expect(getTokenExpirationTime('zero-exp-token')).toBe(0);
    });

    test('should handle very large expiration times', () => {
      const largeExp = 2147483647; // Max 32-bit signed integer
      vi.mocked(jwtDecode).mockReturnValue({ exp: largeExp });

      expect(getTokenExpirationTime('large-exp-token')).toBe(largeExp * 1000);
    });
  });

  describe('getTimeUntilExpiry', () => {
    test('should return null for null token', () => {
      expect(getTimeUntilExpiry(null)).toBeNull();
    });

    test('should return null for malformed token', () => {
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(getTimeUntilExpiry('malformed-token')).toBeNull();
    });

    test('should return time until expiry in milliseconds', () => {
      const expSeconds = Math.floor(mockDate / 1000) + 3600; // 1 hour from now
      const expectedMs = 3600 * 1000; // 1 hour in milliseconds
      
      vi.mocked(jwtDecode).mockReturnValue({ exp: expSeconds });

      expect(getTimeUntilExpiry('valid-token')).toBe(expectedMs);
    });

    test('should return 0 for expired token (not negative)', () => {
      const expSeconds = Math.floor(mockDate / 1000) - 3600; // 1 hour ago
      
      vi.mocked(jwtDecode).mockReturnValue({ exp: expSeconds });

      expect(getTimeUntilExpiry('expired-token')).toBe(0);
    });

    test('should return 0 for token expiring exactly now', () => {
      const expSeconds = Math.floor(mockDate / 1000);
      
      vi.mocked(jwtDecode).mockReturnValue({ exp: expSeconds });

      expect(getTimeUntilExpiry('expiring-now-token')).toBe(0);
    });

    test('should handle small time differences correctly', () => {
      const expSeconds = Math.floor(mockDate / 1000) + 1; // 1 second from now
      
      vi.mocked(jwtDecode).mockReturnValue({ exp: expSeconds });

      expect(getTimeUntilExpiry('one-second-token')).toBe(1000);
    });
  });

  describe('refreshAccessToken', () => {
    beforeEach(() => {
      // Mock environment variable
      Object.defineProperty(import.meta, 'env', {
        value: { VITE_API_URL: 'http://localhost:3001' },
        configurable: true
      });
    });

    test('should successfully refresh token and store it', async () => {
      const newToken = 'new-jwt-token';
      const mockResponse = {
        data: { token: newToken }
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      const result = await refreshAccessToken();

      expect(result).toBe(newToken);
      expect(axios.post).toHaveBeenCalledWith('/api/auth/refresh', {}, expect.objectContaining({
        withCredentials: true
      }));
      expect(localStorage.setItem).toHaveBeenCalledWith('token', newToken);
      expect(console.log).toHaveBeenCalledWith('Token refreshed successfully');
    });

    test('should dispatch token-refreshed event on success', async () => {
      const newToken = 'new-jwt-token';
      const mockResponse = {
        data: { token: newToken }
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      await refreshAccessToken();

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('auth:token-refreshed', { detail: { token: newToken } })
      );
    });

    test('should return null and clear storage on API error', async () => {
      const apiError = new Error('Unauthorized');
      vi.mocked(axios.post).mockRejectedValue(apiError);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(console.warn).toHaveBeenCalledWith('Failed to refresh token:', apiError);
    });

    test('should dispatch logout event on API error', async () => {
      const apiError = new Error('Unauthorized');
      vi.mocked(axios.post).mockRejectedValue(apiError);

      await refreshAccessToken();

      expect(window.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('auth:logout')
      );
    });

    test('should handle response without token gracefully', async () => {
      const mockResponse = {
        data: {} // No token in response
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(window.dispatchEvent).not.toHaveBeenCalled();
    });

    test('should handle null token in response', async () => {
      const mockResponse = {
        data: { token: null }
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(window.dispatchEvent).not.toHaveBeenCalled();
    });

    test('should handle empty string token in response', async () => {
      const mockResponse = {
        data: { token: '' }
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      const result = await refreshAccessToken();

      expect(result).toBe('');
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(window.dispatchEvent).not.toHaveBeenCalled();
    });

    test('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'ETIMEDOUT';
      vi.mocked(axios.post).mockRejectedValue(timeoutError);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(console.warn).toHaveBeenCalledWith('Failed to refresh token:', timeoutError);
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('auth:logout')
      );
    });

    test('should handle 401 authentication errors specifically', async () => {
      const authError = {
        response: {
          status: 401,
          data: { message: 'Token expired' }
        }
      };
      vi.mocked(axios.post).mockRejectedValue(authError);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('auth:logout')
      );
    });

    test('should handle 403 forbidden errors', async () => {
      const forbiddenError = {
        response: {
          status: 403,
          data: { message: 'Access denied' }
        }
      };
      vi.mocked(axios.post).mockRejectedValue(forbiddenError);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    });

    test('should handle malformed response data', async () => {
      const mockResponse = {
        data: 'invalid-response-format'
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    test('should use correct API configuration', async () => {
      const mockResponse = {
        data: { token: 'test-token' }
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      await refreshAccessToken();

      expect(axios.post).toHaveBeenCalledWith('/api/auth/refresh', {}, expect.objectContaining({
        withCredentials: true
      }));
    });

    test('should use default configuration when environment is available', async () => {
      const mockResponse = {
        data: { token: 'test-token' }
      };

      vi.mocked(axios.post).mockResolvedValue(mockResponse);

      await refreshAccessToken();

      expect(axios.post).toHaveBeenCalledWith('/api/auth/refresh', {}, expect.objectContaining({
        withCredentials: true
      }));
    });
  });

  describe('Integration scenarios', () => {
    test('should handle complete token lifecycle', () => {
      const expSeconds = Math.floor(mockDate / 1000) + 1800; // 30 minutes from now
      vi.mocked(jwtDecode).mockReturnValue({ exp: expSeconds });

      const token = 'complete-lifecycle-token';

      // Check token is not expired
      expect(isTokenExpired(token)).toBe(false);

      // Get expiration time
      expect(getTokenExpirationTime(token)).toBe(expSeconds * 1000);

      // Get time until expiry
      expect(getTimeUntilExpiry(token)).toBe(1800 * 1000);
    });

    test('should handle edge case near expiration boundary', () => {
      // Token expires in exactly 30 seconds (boundary case)
      const boundaryExp = Math.floor((mockDate + 30000) / 1000);
      vi.mocked(jwtDecode).mockReturnValue({ exp: boundaryExp });

      const token = 'boundary-token';

      expect(isTokenExpired(token)).toBe(true); // Should be expired due to 30s buffer
      expect(getTokenExpirationTime(token)).toBe(boundaryExp * 1000);
      expect(getTimeUntilExpiry(token)).toBe(30000); // Still 30 seconds left
    });

    test('should handle JWT decode errors consistently across all functions', () => {
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid JWT');
      });

      const malformedToken = 'malformed.jwt.token';

      expect(isTokenExpired(malformedToken)).toBe(true);
      expect(getTokenExpirationTime(malformedToken)).toBeNull();
      expect(getTimeUntilExpiry(malformedToken)).toBeNull();
    });
  });
});