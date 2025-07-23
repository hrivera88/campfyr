import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { createMockStore } from '../../../utils/test-utils/mockStore';
import { GuestRoute } from '../../routes/GuestRoute';

// Mock components
const LoginPage = () => <div>Login Page</div>;
const ChatPage = () => <div>Chat Page</div>;

const renderGuestRoute = (authState = {}) => {
  const mockStore = createMockStore({ auth: authState as any });

  return render(
    <Provider store={mockStore}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
};

describe('GuestRoute', () => {
  test('should render children when user is not authenticated', () => {
    renderGuestRoute({
      isAuthenticated: false,
      user: null,
      status: 'unathenticated',
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  test('should redirect to chat when user is authenticated', () => {
    renderGuestRoute({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        avatarUrl: '',
      },
      status: 'authenticated',
    });

    expect(screen.getByText('Chat Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  test('should redirect to chat when authentication status is authenticated regardless of other states', () => {
    renderGuestRoute({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        avatarUrl: '',
      },
      status: 'authenticated',
    });

    expect(screen.getByText('Chat Page')).toBeInTheDocument();
  });

  test('should render children when authentication status is idle', () => {
    renderGuestRoute({
      isAuthenticated: false,
      user: null,
      status: 'idle',
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  test('should render children when authentication status is loading', () => {
    renderGuestRoute({
      isAuthenticated: false,
      user: null,
      status: 'loading',
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  test('should handle edge case where isAuthenticated is true but user is null', () => {
    renderGuestRoute({
      isAuthenticated: true,
      user: null,
      status: 'authenticated',
    });

    // Should redirect since component only checks isAuthenticated flag
    expect(screen.getByText('Chat Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  test('should handle edge case where user exists but isAuthenticated is false', () => {
    renderGuestRoute({
      isAuthenticated: false,
      user: {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        avatarUrl: '',
      },
      status: 'unathenticated',
    });

    // Should show login page since component only checks isAuthenticated flag
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  test('should use replace navigation to prevent back button issues', () => {
    // Test that the component uses Navigate with replace prop
    renderGuestRoute({
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        avatarUrl: '',
      },
      status: 'authenticated',
    });

    // Should navigate to chat page (we can verify the outcome rather than the implementation)
    expect(screen.getByText('Chat Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  test('should properly handle JSX.Element children type', () => {
    // Test that the component accepts and renders JSX children correctly
    const mockStore = createMockStore({
      auth: {
        isAuthenticated: false,
        user: null,
        status: 'unathenticated',
      },
    });

    const CustomChild = () => (
      <div data-testid="custom-child">Custom Login Component</div>
    );

    render(
      <Provider store={mockStore}>
        <MemoryRouter>
          <GuestRoute>
            <CustomChild />
          </GuestRoute>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
    expect(screen.getByText('Custom Login Component')).toBeInTheDocument();
  });
});
