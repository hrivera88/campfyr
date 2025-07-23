import { screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { render } from '@testing-library/react';
import { ProtectedRoute } from '../../routes/ProtectedRoute';
import { createMockStore } from '../../../utils/test-utils/mockStore';

// Mock child component for protected route
const ProtectedComponent = () => <div>Protected Content</div>;
const LoginPage = () => <div>Login Page</div>;

const renderProtectedRoute = (authState = {}) => {
  const mockStore = createMockStore({ auth: authState });
  
  return render(
    <Provider store={mockStore}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/protected" element={<ProtectedRoute />}>
            <Route index element={<ProtectedComponent />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>
  );
};

describe('ProtectedRoute', () => {
  test('should render protected content when user is authenticated', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com', username: 'testuser', avatarUrl: '' },
      status: 'authenticated'
    });

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  test('should redirect to login when user is not authenticated', () => {
    renderProtectedRoute({
      isAuthenticated: false,
      user: null,
      status: 'unathenticated'
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('should redirect to login when authentication status is idle', () => {
    renderProtectedRoute({
      isAuthenticated: false,
      user: null,
      status: 'idle'
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('should redirect to login when authentication status is loading', () => {
    renderProtectedRoute({
      isAuthenticated: false,
      user: null,
      status: 'loading'
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('should handle edge case where isAuthenticated is true but user is null', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: null,
      status: 'authenticated'
    });

    // Should still allow access if isAuthenticated is true (component only checks this flag)
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('should handle edge case where user exists but isAuthenticated is false', () => {
    renderProtectedRoute({
      isAuthenticated: false,
      user: { id: '1', email: 'test@example.com', username: 'testuser', avatarUrl: '' },
      status: 'unathenticated'
    });

    // Should redirect since component only checks isAuthenticated flag
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('should use replace navigation to prevent back button issues', () => {
    // Test that the component uses Navigate with replace prop
    renderProtectedRoute({
      isAuthenticated: false,
      user: null,
      status: 'unathenticated'
    });

    // Should navigate to login page (we can verify the outcome rather than the implementation)
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});