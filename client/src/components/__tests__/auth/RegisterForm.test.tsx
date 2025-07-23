import { screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterForm from "../../forms/RegisterForm";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/utils/test-utils/renderWithProviders";

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

// Mock mutations from React Query
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
  

describe('Register Form: ', () => { 
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetAllMocks();
        mockMutation.isPending = false;
        mockMutation.error = null;
        mockMutation.mutate = mockMutate;
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.resetAllMocks();
        vi.restoreAllMocks();
    });

    test('renders all fields and register button', () => { 
        renderWithProviders(<RegisterForm />);
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    });
    test('shows validation errors on submit with empty fields', async () => { 
        renderWithProviders(<RegisterForm />);
        fireEvent.click(screen.getByRole('button', { name: /register/i }));
        await waitFor(() => { 
            expect(screen.getByText(/email is required/i)).toBeInTheDocument();
            expect(screen.getByText(/username must be at least 3/i)).toBeInTheDocument();
            expect(screen.getByText(/password must be at least 6/i)).toBeInTheDocument();
        });
    });
    test('shows validation error for invalidd email format', async () => {
        renderWithProviders(<RegisterForm />);

        //Fill in with invalid email options, but valid username and password
        fireEvent.change(screen.getByLabelText(/email/i), {
            target: { value: 'not an email' },
        });
        fireEvent.change(screen.getByLabelText(/username/i), {
            target: { value: 'validuser' },
        });
        fireEvent.change(screen.getByLabelText(/password/i), {
            target: {value: 'validpass123'}
        });

        fireEvent.click(screen.getByRole('button', { name: /register/i }));
        
        await waitFor(() => { 
            expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
        });
    });
});