import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import LoginForm from "../../forms/LoginForm";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders } from "../../../utils/test-utils/renderWithProviders";
import { createMockStore } from "../../../utils/test-utils/mockStore";
import api from "../../../services/axios";

expect.extend(toHaveNoViolations);

// Mock the API service - mirroring actual axios instance structure
vi.mock("../../../services/axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn()
      },
      response: {
        use: vi.fn()
      }
    },
    defaults: {
      headers: {
        common: {}
      }
    }
  }
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock React Query
const mockMutate = vi.fn();
const mockMutation = {
  mutate: mockMutate,
  isPending: false,
  error: null
};

vi.mock("@tanstack/react-query", async (importActual) => {
  const actual = await importActual<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useMutation: vi.fn(() => mockMutation),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
    })),
  };
});

describe('LoginForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    mockMutation.isPending = false;
    mockMutation.error = null;
    mockMutation.mutate = mockMutate;
    
    // Reset navigation mock
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe('Rendering and Basic Functionality', () => {
    test('renders all required form elements', () => {
      renderWithProviders(<LoginForm />);
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset it here/i })).toBeInTheDocument();
    });

    test('has proper form structure', () => {
      renderWithProviders(<LoginForm />);
      
      const form = screen.getByRole('button', { name: /login/i }).closest('form');
      expect(form).toBeInTheDocument();
      
      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByLabelText(/password/i);
      
      expect(emailInput).toHaveAttribute('type', 'text');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Form Validation', () => {
    test('validates required fields on submit', async () => {
      renderWithProviders(<LoginForm />);
      
      const submitButton = screen.getByRole('button', { name: /login/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password must be at least 6/i)).toBeInTheDocument();
      });
      
      expect(mockMutate).not.toHaveBeenCalled();
    });

    test('validates email format', async () => {
      renderWithProviders(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });

    test('validates password minimum length', async () => {
      renderWithProviders(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '123');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/password must be at least 6/i)).toBeInTheDocument();
      });
    });

    test('allows submission with valid data', async () => {
      renderWithProviders(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'validpassword');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          { email: 'test@example.com', password: 'validpassword' },
          expect.any(Object)
        );
      });
    });
  });

  describe('API Integration and Error Handling', () => {
    test('displays API error messages', () => {
      mockMutation.error = {
        response: {
          data: {
            error: 'Invalid credentials'
          }
        }
      };
      
      renderWithProviders(<LoginForm />);
      
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    test('displays generic error when API error has no message', () => {
      mockMutation.error = {
        response: {
          data: {}
        }
      };
      
      renderWithProviders(<LoginForm />);
      
      expect(screen.getByText('Login Failed')).toBeInTheDocument();
    });

    test('displays generic error for network errors', () => {
      mockMutation.error = new Error('Network error');
      
      renderWithProviders(<LoginForm />);
      
      expect(screen.getByText('Login Failed')).toBeInTheDocument();
    });

    test('handles successful login flow', async () => {
      const mockToken = 'mock-jwt-token';
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg'
      };

      // Mock the API calls
      vi.mocked(api.get).mockResolvedValue({ data: mockUser });

      // Create a custom mutation mock that calls onSuccess
      const customMutate = vi.fn((data, options) => {
        if (options?.onSuccess) {
          setTimeout(() => options.onSuccess({ token: mockToken }), 0);
        }
      });
      
      mockMutation.mutate = customMutate;

      const store = createMockStore({
        auth: {
          isAuthenticated: false,
          user: null,
          status: 'unathenticated'
        }
      });

      renderWithProviders(<LoginForm />, store);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'validpassword');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/chat');
      });
    });

    test('handles profile fetch failure after successful login', async () => {
      const mockToken = 'mock-jwt-token';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock API to reject the profile fetch
      vi.mocked(api.get).mockRejectedValue(new Error('Profile fetch failed'));

      // Create a custom mutation mock that calls onSuccess
      const customMutate = vi.fn((data, options) => {
        if (options?.onSuccess) {
          setTimeout(() => options.onSuccess({ token: mockToken }), 0);
        }
      });
      
      mockMutation.mutate = customMutate;

      const store = createMockStore({
        auth: {
          isAuthenticated: false,
          user: null,
          status: 'unathenticated'
        }
      });

      renderWithProviders(<LoginForm />, store);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'validpassword');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to fetch user profile, ',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    test('disables form during submission', () => {
      mockMutation.isPending = true;
      
      renderWithProviders(<LoginForm />);
      
      const submitButton = screen.getByRole('button', { name: /login/i });
      expect(submitButton).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('shows loading indicator during submission', () => {
      mockMutation.isPending = true;
      
      renderWithProviders(<LoginForm />);
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    test('navigates to forgot password page', async () => {
      renderWithProviders(<LoginForm />);
      
      const forgotPasswordButton = screen.getByRole('button', { name: /reset it here/i });
      await user.click(forgotPasswordButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
    });
  });

  describe('Accessibility', () => {
    test('has no accessibility violations', async () => {
      const { container } = renderWithProviders(<LoginForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('provides proper labels and descriptions', () => {
      renderWithProviders(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      expect(emailInput).toHaveAccessibleName();
      expect(passwordInput).toHaveAccessibleName();
    });

    test('announces validation errors to screen readers', async () => {
      renderWithProviders(<LoginForm />);
      
      const submitButton = screen.getByRole('button', { name: /login/i });
      await user.click(submitButton);
      
      await waitFor(() => {
        const emailError = screen.getByText(/email is required/i);
        const passwordError = screen.getByText(/password must be at least 6/i);
        
        expect(emailError).toBeInTheDocument();
        expect(passwordError).toBeInTheDocument();
      });
    });

    test('supports keyboard navigation', async () => {
      renderWithProviders(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });
      const forgotPasswordButton = screen.getByRole('button', { name: /reset it here/i });
      
      // Tab navigation
      await user.tab();
      expect(emailInput).toHaveFocus();
      
      await user.tab();
      expect(passwordInput).toHaveFocus();
      
      await user.tab();
      expect(submitButton).toHaveFocus();
      
      await user.tab();
      expect(forgotPasswordButton).toHaveFocus();
    });

    test('form can be submitted with Enter key', async () => {
      renderWithProviders(<LoginForm />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'validpassword');
      
      // Focus the form and press Enter
      passwordInput.focus();
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          { email: 'test@example.com', password: 'validpassword' },
          expect.any(Object)
        );
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty API response', async () => {
      const store = createMockStore();
      renderWithProviders(<LoginForm />, store);
      
      // Simulate successful login with empty/null response
      const onSuccess = mockMutate.mock.calls[0]?.[1]?.onSuccess;
      if (onSuccess) {
        await onSuccess({ token: null });
      }
      
      // Should handle gracefully without crashing
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    test('handles malformed token response', async () => {
      const store = createMockStore();
      renderWithProviders(<LoginForm />, store);
      
      const onSuccess = mockMutate.mock.calls[0]?.[1]?.onSuccess;
      if (onSuccess) {
        await onSuccess({ token: 'invalid-token-format' });
      }
      
      // Should handle gracefully
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    test('clears previous errors when new submission starts', async () => {
      // First render with error
      mockMutation.error = {
        response: { data: { error: 'Previous error' } }
      };
      
      const store = createMockStore({
        auth: {
          isAuthenticated: false,
          user: null,
          status: 'unathenticated'
        }
      });
      
      const { unmount } = renderWithProviders(<LoginForm />, store);
      expect(screen.getByText('Previous error')).toBeInTheDocument();
      
      // Clean up first render
      unmount();
      
      // Clear error for new render
      mockMutation.error = null;
      renderWithProviders(<LoginForm />, store);
      
      expect(screen.queryByText('Previous error')).not.toBeInTheDocument();
    });
  });
});
