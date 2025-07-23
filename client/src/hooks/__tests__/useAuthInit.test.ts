import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useAuthInit } from '../useAuthInit';
import authReducer, { setUser, clearUser, setAuthStatus } from '../../store/slice/authSlice';
import api from '../../services/axios';
import type { ReactNode } from 'react';

// Mock the axios service
vi.mock('../../services/axios', () => ({
  default: {
    get: vi.fn()
  }
}));

// Create a test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer
    }
  });
};

// Wrapper component for Redux provider
const createWrapper = (store: ReturnType<typeof createTestStore>) => {
  return ({ children }: { children: ReactNode }) => 
    React.createElement(Provider, { store, children });
};

describe('useAuthInit', () => {
  let store: ReturnType<typeof createTestStore>;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    store = createTestStore();
    
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
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        })
      },
      writable: true,
      configurable: true
    });

    // Mock console.warn to avoid noise in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorageMock = {};
  });

  test('should set status to unathenticated when no token exists', async () => {
    // No token in localStorage
    const wrapper = createWrapper(store);
    
    renderHook(() => useAuthInit(), { wrapper });

    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('unathenticated');
      expect(state.auth.isAuthenticated).toBe(false);
      expect(state.auth.user).toBeNull();
    });

    expect(api.get).not.toHaveBeenCalled();
  });

  test('should fetch user data when valid token exists', async () => {
    const mockToken = 'valid-jwt-token';
    const mockUserData = {
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      avatarUrl: 'https://example.com/avatar.jpg'
    };

    localStorageMock.token = mockToken;
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockUserData });

    const wrapper = createWrapper(store);
    renderHook(() => useAuthInit(), { wrapper });

    // Should set loading status first
    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('loading');
    });

    // Should call API with correct parameters
    expect(api.get).toHaveBeenCalledWith('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${mockToken}`
      }
    });

    // Should set user data after successful fetch
    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('authenticated');
      expect(state.auth.isAuthenticated).toBe(true);
      expect(state.auth.user).toEqual(mockUserData);
    });
  });

  test('should handle API error and clear token', async () => {
    const mockToken = 'invalid-jwt-token';
    localStorageMock.token = mockToken;

    const mockError = new Error('Unauthorized');
    vi.mocked(api.get).mockRejectedValueOnce(mockError);

    const wrapper = createWrapper(store);
    renderHook(() => useAuthInit(), { wrapper });

    // Should set loading status first
    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('loading');
    });

    // Should handle error and clear user
    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('unathenticated');
      expect(state.auth.isAuthenticated).toBe(false);
      expect(state.auth.user).toBeNull();
    });

    // Should remove token from localStorage
    expect(globalThis.localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(console.warn).toHaveBeenCalledWith('Auto-login failed, clearing token ', mockError);
  });

  test('should handle network errors gracefully', async () => {
    const mockToken = 'valid-token';
    localStorageMock.token = mockToken;

    const networkError = new Error('Network Error');
    vi.mocked(api.get).mockRejectedValueOnce(networkError);

    const wrapper = createWrapper(store);
    renderHook(() => useAuthInit(), { wrapper });

    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('unathenticated');
      expect(state.auth.isAuthenticated).toBe(false);
      expect(state.auth.user).toBeNull();
    });

    expect(globalThis.localStorage.removeItem).toHaveBeenCalledWith('token');
  });

  test('should handle malformed user data from API', async () => {
    const mockToken = 'valid-token';
    localStorageMock.token = mockToken;

    // API returns incomplete user data
    const incompleteUserData = {
      id: '1',
      email: 'test@example.com'
      // missing username and avatarUrl
    };

    vi.mocked(api.get).mockResolvedValueOnce({ data: incompleteUserData });

    const wrapper = createWrapper(store);
    renderHook(() => useAuthInit(), { wrapper });

    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('authenticated');
      expect(state.auth.isAuthenticated).toBe(true);
      expect(state.auth.user).toEqual({
        id: '1',
        email: 'test@example.com',
        username: undefined,
        avatarUrl: undefined
      });
    });
  });

  test('should handle empty response from API', async () => {
    const mockToken = 'valid-token';
    localStorageMock.token = mockToken;

    vi.mocked(api.get).mockResolvedValueOnce({ data: null });

    const wrapper = createWrapper(store);
    renderHook(() => useAuthInit(), { wrapper });

    // Should handle null response as an error and clear user
    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('unathenticated');
      expect(state.auth.isAuthenticated).toBe(false);
      expect(state.auth.user).toBeNull();
    });

    // Should remove token from localStorage
    expect(globalThis.localStorage.removeItem).toHaveBeenCalledWith('token');
  });

  test('should only run once on mount', async () => {
    const mockToken = 'valid-token';
    localStorageMock.token = mockToken;
    vi.mocked(api.get).mockResolvedValue({ data: { id: '1', email: 'test@example.com', username: 'test', avatarUrl: '' } });

    const wrapper = createWrapper(store);
    const { rerender } = renderHook(() => useAuthInit(), { wrapper });

    // Wait for initial call
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(1);
    });

    // Rerender should not trigger another API call
    rerender();
    
    // Should still only have been called once
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  test('should handle 401 Unauthorized specifically', async () => {
    const mockToken = 'expired-token';
    localStorageMock.token = mockToken;

    const unauthorizedError = {
      response: {
        status: 401,
        data: { message: 'Token expired' }
      }
    };
    vi.mocked(api.get).mockRejectedValueOnce(unauthorizedError);

    const wrapper = createWrapper(store);
    renderHook(() => useAuthInit(), { wrapper });

    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('unathenticated');
      expect(state.auth.isAuthenticated).toBe(false);
    });

    expect(globalThis.localStorage.removeItem).toHaveBeenCalledWith('token');
  });

  test('should handle 403 Forbidden gracefully', async () => {
    const mockToken = 'forbidden-token';
    localStorageMock.token = mockToken;

    const forbiddenError = {
      response: {
        status: 403,
        data: { message: 'Access denied' }
      }
    };
    vi.mocked(api.get).mockRejectedValueOnce(forbiddenError);

    const wrapper = createWrapper(store);
    renderHook(() => useAuthInit(), { wrapper });

    await waitFor(() => {
      const state = store.getState();
      expect(state.auth.status).toBe('unathenticated');
    });

    expect(globalThis.localStorage.removeItem).toHaveBeenCalledWith('token');
  });
});