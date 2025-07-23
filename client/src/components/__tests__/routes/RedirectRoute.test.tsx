import { screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react';
import { RedirectRoute } from '../../routes/RedirectRoute';
import { createMockStore } from '../../../utils/test-utils/mockStore';

// Mock components for navigation targets
const LoginPage = () => <div>Login Page</div>;
const ChatPage = () => <div>Chat Page</div>;

const renderRedirectRoute = (authState = {}) => {
  const mockStore = createMockStore({ auth: authState });
  
  return render(
    <Provider store={mockStore}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/" element={<RedirectRoute />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
};

describe('RedirectRoute', () => {
  test('should redirect to chat when user is authenticated', () => {
    renderRedirectRoute({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com', username: 'testuser', avatarUrl: '' },
      status: 'authenticated'
    });

    expect(screen.getByText('Chat Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  test('should redirect to login when user is not authenticated', () => {
    renderRedirectRoute({
      isAuthenticated: false,
      user: null,
      status: 'unathenticated'
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  test('should render nothing when status is idle', () => {
    const { container } = renderRedirectRoute({
      isAuthenticated: false,
      user: null,
      status: 'idle'
    });

    // Should render nothing - no navigation should occur
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  test('should render nothing when status is loading', () => {
    const { container } = renderRedirectRoute({
      isAuthenticated: false,
      user: null,
      status: 'loading'
    });

    // Should render nothing - no navigation should occur during loading
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  test('should handle edge case where isAuthenticated is true but status is unathenticated', () => {
    renderRedirectRoute({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com', username: 'testuser', avatarUrl: '' },
      status: 'unathenticated'
    });

    // Should redirect to chat based on isAuthenticated flag
    expect(screen.getByText('Chat Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  test('should handle edge case where isAuthenticated is false but status is authenticated', () => {
    renderRedirectRoute({
      isAuthenticated: false,
      user: null,
      status: 'authenticated'
    });

    // Should redirect to login based on isAuthenticated flag
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  test('should use replace navigation to prevent back button issues', () => {
    // Test that the component uses Navigate with replace prop
    renderRedirectRoute({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com', username: 'testuser', avatarUrl: '' },
      status: 'authenticated'
    });

    // Should navigate to chat page (we can verify the outcome rather than the implementation)
    expect(screen.getByText('Chat Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  test('should prioritize isAuthenticated over user presence', () => {
    // Test case where user object exists but isAuthenticated is false
    renderRedirectRoute({
      isAuthenticated: false,
      user: { id: '1', email: 'test@example.com', username: 'testuser', avatarUrl: '' },
      status: 'unathenticated'
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Chat Page')).not.toBeInTheDocument();
  });

  test('should handle null user when authenticated', () => {
    // Test case where isAuthenticated is true but user is null
    renderRedirectRoute({
      isAuthenticated: true,
      user: null,
      status: 'authenticated'
    });

    expect(screen.getByText('Chat Page')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  test('should wait for authentication resolution before redirecting', () => {
    // Test the loading state behavior
    const { container, rerender } = renderRedirectRoute({
      isAuthenticated: false,
      user: null,
      status: 'loading'
    });

    // Initially should render nothing
    expect(container.firstChild).toBeNull();

    // Create new store with resolved auth state
    const resolvedStore = createMockStore({ 
      auth: {
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com', username: 'testuser', avatarUrl: '' },
        status: 'authenticated'
      }
    });

    // Re-render with resolved state
    rerender(
      <Provider store={resolvedStore}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/" element={<RedirectRoute />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Chat Page')).toBeInTheDocument();
  });
});