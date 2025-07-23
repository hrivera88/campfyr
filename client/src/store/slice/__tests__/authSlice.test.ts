import { describe, test, expect } from 'vitest';
import authReducer, { setUser, clearUser, setAuthStatus } from '../authSlice';

// Define the AuthState interface for testing (matching the slice)
interface TestAuthState {
  user: {
    id: string;
    email: string;
    username: string;
    avatarUrl: string;
  } | null;
  isAuthenticated: boolean;
  status: 'idle' | 'loading' | 'authenticated' | 'unathenticated';
}

describe('authSlice', () => {
  const initialState: TestAuthState = {
    user: null,
    isAuthenticated: false,
    status: 'idle'
  };

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    username: 'testuser',
    avatarUrl: 'https://example.com/avatar.jpg'
  };

  describe('initial state', () => {
    test('should return the initial state', () => {
      expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    test('should have correct initial values', () => {
      const state = authReducer(undefined, { type: 'unknown' });
      
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.status).toBe('idle');
    });
  });

  describe('setUser action', () => {
    test('should set user data and update authentication status', () => {
      const action = setUser(mockUser);
      const newState = authReducer(initialState, action);

      expect(newState.user).toEqual(mockUser);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.status).toBe('authenticated');
    });

    test('should handle user with different data structure', () => {
      const differentUser = {
        id: '456',
        email: 'different@example.com',
        username: 'differentuser',
        avatarUrl: 'https://example.com/different-avatar.jpg'
      };

      const action = setUser(differentUser);
      const newState = authReducer(initialState, action);

      expect(newState.user).toEqual(differentUser);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.status).toBe('authenticated');
    });

    test('should handle user with empty avatar URL', () => {
      const userWithoutAvatar = {
        ...mockUser,
        avatarUrl: ''
      };

      const action = setUser(userWithoutAvatar);
      const newState = authReducer(initialState, action);

      expect(newState.user).toEqual(userWithoutAvatar);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.status).toBe('authenticated');
    });

    test('should update existing user data', () => {
      const initialStateWithUser: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      const updatedUser = {
        ...mockUser,
        username: 'updatedusername',
        avatarUrl: 'https://example.com/new-avatar.jpg'
      };

      const action = setUser(updatedUser);
      const newState = authReducer(initialStateWithUser, action);

      expect(newState.user).toEqual(updatedUser);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.status).toBe('authenticated');
    });

    test('should handle setting null user (logout scenario)', () => {
      const initialStateWithUser: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      const action = setUser(null);
      const newState = authReducer(initialStateWithUser, action);

      expect(newState.user).toBeNull();
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.status).toBe('unathenticated');
    });

    test('should handle setting undefined user', () => {
      const initialStateWithUser: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      const action = setUser(undefined as any);
      const newState = authReducer(initialStateWithUser, action);

      expect(newState.user).toBeUndefined();
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.status).toBe('unathenticated');
    });

    test('should handle user with minimal required fields', () => {
      const minimalUser = {
        id: '789',
        email: 'minimal@example.com',
        username: 'minimal',
        avatarUrl: ''
      };

      const action = setUser(minimalUser);
      const newState = authReducer(initialState, action);

      expect(newState.user).toEqual(minimalUser);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.status).toBe('authenticated');
    });

    test('should handle user with special characters in data', () => {
      const userWithSpecialChars = {
        id: 'user-123-abc',
        email: 'user+test@example-domain.com',
        username: 'user_name-123',
        avatarUrl: 'https://example.com/avatars/user%20name.jpg'
      };

      const action = setUser(userWithSpecialChars);
      const newState = authReducer(initialState, action);

      expect(newState.user).toEqual(userWithSpecialChars);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.status).toBe('authenticated');
    });

    test('should preserve other state properties when setting user', () => {
      const customInitialState: TestAuthState = {
        user: null,
        isAuthenticated: false,
        status: 'loading' // Different from default initial state
      };

      const action = setUser(mockUser);
      const newState = authReducer(customInitialState, action);

      expect(newState.user).toEqual(mockUser);
      expect(newState.isAuthenticated).toBe(true);
      expect(newState.status).toBe('authenticated'); // Should be updated
    });
  });

  describe('clearUser action', () => {
    test('should clear user data and reset authentication status', () => {
      const initialStateWithUser: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      const action = clearUser();
      const newState = authReducer(initialStateWithUser, action);

      expect(newState.user).toBeNull();
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.status).toBe('unathenticated');
    });

    test('should work when user is already null', () => {
      const action = clearUser();
      const newState = authReducer(initialState, action);

      expect(newState.user).toBeNull();
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.status).toBe('unathenticated');
    });

    test('should reset from loading status', () => {
      const loadingState: TestAuthState = {
        user: null,
        isAuthenticated: false,
        status: 'loading'
      };

      const action = clearUser();
      const newState = authReducer(loadingState, action);

      expect(newState.user).toBeNull();
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.status).toBe('unathenticated');
    });

    test('should reset from idle status', () => {
      const idleState: TestAuthState = {
        user: null,
        isAuthenticated: false,
        status: 'idle'
      };

      const action = clearUser();
      const newState = authReducer(idleState, action);

      expect(newState.user).toBeNull();
      expect(newState.isAuthenticated).toBe(false);
      expect(newState.status).toBe('unathenticated');
    });

    test('should be idempotent (multiple calls have same effect)', () => {
      const initialStateWithUser: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      const action = clearUser();
      const firstClear = authReducer(initialStateWithUser, action);
      const secondClear = authReducer(firstClear, action);

      expect(firstClear).toEqual(secondClear);
      expect(secondClear.user).toBeNull();
      expect(secondClear.isAuthenticated).toBe(false);
      expect(secondClear.status).toBe('unathenticated');
    });
  });

  describe('setAuthStatus action', () => {
    test('should set status to loading', () => {
      const action = setAuthStatus('loading');
      const newState = authReducer(initialState, action);

      expect(newState.status).toBe('loading');
      expect(newState.user).toBeNull(); // Should not affect user
      expect(newState.isAuthenticated).toBe(false); // Should not affect isAuthenticated
    });

    test('should set status to authenticated', () => {
      const action = setAuthStatus('authenticated');
      const newState = authReducer(initialState, action);

      expect(newState.status).toBe('authenticated');
      expect(newState.user).toBeNull(); // Should not affect user
      expect(newState.isAuthenticated).toBe(false); // Should not affect isAuthenticated
    });

    test('should set status to unathenticated', () => {
      const stateWithUser: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      const action = setAuthStatus('unathenticated');
      const newState = authReducer(stateWithUser, action);

      expect(newState.status).toBe('unathenticated');
      expect(newState.user).toEqual(mockUser); // Should not affect user
      expect(newState.isAuthenticated).toBe(true); // Should not affect isAuthenticated
    });

    test('should set status to idle', () => {
      const loadingState: TestAuthState = {
        user: null,
        isAuthenticated: false,
        status: 'loading'
      };

      const action = setAuthStatus('idle');
      const newState = authReducer(loadingState, action);

      expect(newState.status).toBe('idle');
      expect(newState.user).toBeNull();
      expect(newState.isAuthenticated).toBe(false);
    });

    test('should handle status transitions from authenticated to loading', () => {
      const authenticatedState: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      const action = setAuthStatus('loading');
      const newState = authReducer(authenticatedState, action);

      expect(newState.status).toBe('loading');
      expect(newState.user).toEqual(mockUser); // User data preserved
      expect(newState.isAuthenticated).toBe(true); // Auth status preserved
    });

    test('should handle rapid status changes', () => {
      let state = initialState;
      
      // Simulate authentication flow: idle -> loading -> authenticated
      state = authReducer(state, setAuthStatus('loading'));
      expect(state.status).toBe('loading');

      state = authReducer(state, setAuthStatus('authenticated'));
      expect(state.status).toBe('authenticated');

      state = authReducer(state, setAuthStatus('unathenticated'));
      expect(state.status).toBe('unathenticated');

      state = authReducer(state, setAuthStatus('idle'));
      expect(state.status).toBe('idle');
    });

    test('should preserve user data during status changes', () => {
      const stateWithUser: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      // Change status multiple times
      let newState = authReducer(stateWithUser, setAuthStatus('loading'));
      expect(newState.user).toEqual(mockUser);

      newState = authReducer(newState, setAuthStatus('idle'));
      expect(newState.user).toEqual(mockUser);

      newState = authReducer(newState, setAuthStatus('unathenticated'));
      expect(newState.user).toEqual(mockUser);
    });
  });

  describe('action creators', () => {
    test('setUser action creator should create correct action', () => {
      const action = setUser(mockUser);
      
      expect(action.type).toBe('auth/setUser');
      expect(action.payload).toEqual(mockUser);
    });

    test('setUser action creator should handle null payload', () => {
      const action = setUser(null);
      
      expect(action.type).toBe('auth/setUser');
      expect(action.payload).toBeNull();
    });

    test('clearUser action creator should create correct action', () => {
      const action = clearUser();
      
      expect(action.type).toBe('auth/clearUser');
      expect(action.payload).toBeUndefined();
    });

    test('setAuthStatus action creator should create correct action', () => {
      const action = setAuthStatus('loading');
      
      expect(action.type).toBe('auth/setAuthStatus');
      expect(action.payload).toBe('loading');
    });

    test('setAuthStatus action creator should handle all valid status values', () => {
      const statuses = ['idle', 'loading', 'authenticated', 'unathenticated'] as const;
      
      statuses.forEach(status => {
        const action = setAuthStatus(status);
        expect(action.type).toBe('auth/setAuthStatus');
        expect(action.payload).toBe(status);
      });
    });
  });

  describe('complex authentication flows', () => {
    test('should handle complete login flow', () => {
      let state = initialState;

      // Start login process
      state = authReducer(state, setAuthStatus('loading'));
      expect(state.status).toBe('loading');
      expect(state.isAuthenticated).toBe(false);

      // Successful login
      state = authReducer(state, setUser(mockUser));
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.status).toBe('authenticated');
    });

    test('should handle failed login flow', () => {
      let state = initialState;

      // Start login process
      state = authReducer(state, setAuthStatus('loading'));
      expect(state.status).toBe('loading');

      // Failed login
      state = authReducer(state, setAuthStatus('unathenticated'));
      expect(state.status).toBe('unathenticated');
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    test('should handle logout flow', () => {
      let state: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      // Logout
      state = authReducer(state, clearUser());
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.status).toBe('unathenticated');
    });

    test('should handle token refresh flow', () => {
      let state: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      // Token refresh in progress
      state = authReducer(state, setAuthStatus('loading'));
      expect(state.status).toBe('loading');
      expect(state.user).toEqual(mockUser); // User data preserved
      expect(state.isAuthenticated).toBe(true); // Auth status preserved

      // Successful token refresh (user data might be updated)
      const updatedUser = { ...mockUser, username: 'updateduser' };
      state = authReducer(state, setUser(updatedUser));
      expect(state.user).toEqual(updatedUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.status).toBe('authenticated');
    });

    test('should handle session timeout flow', () => {
      let state: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      // Session expired
      state = authReducer(state, clearUser());
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.status).toBe('unathenticated');

      // Redirect to login
      state = authReducer(state, setAuthStatus('idle'));
      expect(state.status).toBe('idle');
    });

    test('should handle user profile update flow', () => {
      let state: TestAuthState = {
        user: mockUser,
        isAuthenticated: true,
        status: 'authenticated'
      };

      // Update user profile
      const updatedUser = {
        ...mockUser,
        username: 'newusername',
        avatarUrl: 'https://example.com/new-avatar.jpg'
      };

      state = authReducer(state, setUser(updatedUser));
      expect(state.user).toEqual(updatedUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.status).toBe('authenticated');
    });
  });

  describe('edge cases and error scenarios', () => {
    test('should handle malformed user object gracefully', () => {
      const malformedUser = {
        id: null,
        email: undefined,
        username: '',
        avatarUrl: null
      } as any;

      const action = setUser(malformedUser);
      const newState = authReducer(initialState, action);

      expect(newState.user).toEqual(malformedUser);
      expect(newState.isAuthenticated).toBe(true); // Still truthy object
      expect(newState.status).toBe('authenticated');
    });

    test('should handle empty object as user', () => {
      const emptyUser = {} as any;

      const action = setUser(emptyUser);
      const newState = authReducer(initialState, action);

      expect(newState.user).toEqual(emptyUser);
      expect(newState.isAuthenticated).toBe(true); // Empty object is truthy
      expect(newState.status).toBe('authenticated');
    });

    test('should maintain immutability', () => {
      const stateWithUser: TestAuthState = {
        user: { ...mockUser },
        isAuthenticated: true,
        status: 'authenticated'
      };

      const originalState = JSON.parse(JSON.stringify(stateWithUser));
      
      // Perform action
      const newState = authReducer(stateWithUser, clearUser());
      
      // Original state should not be modified
      expect(stateWithUser).toEqual(originalState);
      expect(newState).not.toBe(stateWithUser);
    });

    test('should handle consecutive actions correctly', () => {
      let state = initialState;

      // Multiple rapid actions
      state = authReducer(state, setAuthStatus('loading'));
      state = authReducer(state, setUser(mockUser));
      state = authReducer(state, setAuthStatus('loading'));
      state = authReducer(state, clearUser());
      state = authReducer(state, setAuthStatus('idle'));

      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.status).toBe('idle');
    });

    test('should handle unknown actions gracefully', () => {
      const unknownAction = { type: 'UNKNOWN_ACTION', payload: 'test' };
      const newState = authReducer(initialState, unknownAction);

      expect(newState).toEqual(initialState);
    });
  });

  describe('state shape validation', () => {
    test('should always maintain correct state shape', () => {
      const actions = [
        setUser(mockUser),
        clearUser(),
        setAuthStatus('loading'),
        setAuthStatus('authenticated'),
        setAuthStatus('unathenticated'),
        setAuthStatus('idle')
      ];

      actions.forEach(action => {
        const state = authReducer(initialState, action);
        
        expect(state).toHaveProperty('user');
        expect(state).toHaveProperty('isAuthenticated');
        expect(state).toHaveProperty('status');
        expect(typeof state.isAuthenticated).toBe('boolean');
        expect(['idle', 'loading', 'authenticated', 'unathenticated']).toContain(state.status);
      });
    });

    test('should have consistent boolean values for isAuthenticated', () => {
      // With user
      let state = authReducer(initialState, setUser(mockUser));
      expect(state.isAuthenticated).toBe(true);

      // Without user
      state = authReducer(state, clearUser());
      expect(state.isAuthenticated).toBe(false);

      // With null user
      state = authReducer(initialState, setUser(null));
      expect(state.isAuthenticated).toBe(false);
    });
  });
});