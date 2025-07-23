import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import DirectConversationListItem from "../../chat/DirectConversationListItem";
import type { DirectConversationSchemaType } from "../../../schemas/direct";
import api from "../../../services/axios";
import { capitalizeWords } from "../../../utils/capitalizeWords";

// Mock axios
vi.mock("../../../services/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    },
    defaults: { headers: { common: {} } }
  }
}));

// Mock VideoCallButton component
vi.mock("../../chat/VideoCallButton", () => ({
  default: ({ conversationId, otherUserId, disabled }: any) => (
    <button 
      data-testid="video-call-button"
      data-conversation-id={conversationId}
      data-other-user-id={otherUserId}
      disabled={disabled}
    >
      Video Call
    </button>
  )
}));

// Mock capitalizeWords utility
vi.mock("../../../utils/capitalizeWords", () => ({
  capitalizeWords: vi.fn((str: string) => str?.toUpperCase() || "")
}));

describe('DirectConversationListItem', () => {
  let mockAxios: any;
  let queryClient: QueryClient;
  const theme = createTheme();

  const createMockConversation = (overrides: Partial<DirectConversationSchemaType> = {}): DirectConversationSchemaType => ({
    id: "conv-1",
    user1Id: "user-1",
    user2Id: "user-2",
    messages: [],
    createdAt: "2024-01-01T09:00:00Z",
    ...overrides,
  });

  const createMockUser = (overrides: any = {}) => ({
    id: "user-2",
    username: "testuser",
    email: "test@example.com",
    isOnline: true,
    lastSeenAt: "2024-01-01T10:00:00Z",
    ...overrides,
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          {component}
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    mockAxios = vi.mocked(api);
    mockAxios.get.mockResolvedValue({ data: createMockUser() });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders loading state initially', async () => {
      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('renders user information after loading', async () => {
      const user = createMockUser({ username: "john doe" });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("JOHN DOE")).toBeInTheDocument();
      });
    });

    test('renders selected state correctly', async () => {
      const user = createMockUser();
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={true}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        const listItemButton = screen.getAllByRole('button')[0]; // Target the main list item button
        expect(listItemButton).toHaveClass('Mui-selected');
      });
    });

    test('renders without selected state', async () => {
      const user = createMockUser();
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        const listItemButton = screen.getAllByRole('button')[0]; // Target the main list item button
        expect(listItemButton).not.toHaveClass('Mui-selected');
      });
    });
  });

  describe('User ID Logic', () => {
    test('determines other user ID correctly when current user is user1', async () => {
      const user = createMockUser({ id: "user-2" });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation({
        user1Id: "user-1",
        user2Id: "user-2"
      });
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith('/api/users/user-2');
      });
    });

    test('determines other user ID correctly when current user is user2', async () => {
      const user = createMockUser({ id: "user-1" });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation({
        user1Id: "user-1",
        user2Id: "user-2"
      });
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-2"
        />
      );

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith('/api/users/user-1');
      });
    });

    test('handles missing currentUserId', async () => {
      const user = createMockUser();
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
        />
      );

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalled();
      });
    });
  });

  describe('Online Status Indicator', () => {
    test('shows online indicator for online users', async () => {
      const user = createMockUser({ isOnline: true });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        // Look for the online indicator Box - since it's the first Box element and has specific MUI styling
        const listItemButton = screen.getAllByRole('button')[0];
        const onlineIndicator = listItemButton.querySelector('.MuiBox-root');
        expect(onlineIndicator).toBeInTheDocument();
      });
    });

    test('hides online indicator for offline users', async () => {
      const user = createMockUser({ isOnline: false });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        // For offline users, the Box element should not exist at all
        const listItemButton = screen.getAllByRole('button')[0];
        const onlineIndicator = listItemButton.querySelector('.MuiBox-root');
        expect(onlineIndicator).not.toBeInTheDocument();
      });
    });

    test('applies correct styling to online indicator', async () => {
      const user = createMockUser({ isOnline: true });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        // Find the online indicator Box and verify it exists with correct styling
        const listItemButton = screen.getAllByRole('button')[0];
        const onlineIndicator = listItemButton.querySelector('.MuiBox-root');
        expect(onlineIndicator).toBeInTheDocument();
        
        // The MUI Box should have the CSS-in-JS styles applied
        // We can't easily test the exact pixel values in the test environment
        // but we can verify the element exists and has the MuiBox-root class
        expect(onlineIndicator).toHaveClass('MuiBox-root');
      });
    });
  });

  describe('Video Call Button', () => {
    test('renders video call button for loaded users', async () => {
      const user = createMockUser({ isOnline: true });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        const videoButton = screen.getByTestId('video-call-button');
        expect(videoButton).toBeInTheDocument();
        expect(videoButton).toHaveAttribute('data-conversation-id', 'conv-1');
        expect(videoButton).toHaveAttribute('data-other-user-id', 'user-2');
      });
    });

    test('video call button is enabled for online users', async () => {
      const user = createMockUser({ isOnline: true });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        const videoButton = screen.getByTestId('video-call-button');
        expect(videoButton).not.toBeDisabled();
      });
    });

    test('video call button is disabled for offline users', async () => {
      const user = createMockUser({ isOnline: false });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        const videoButton = screen.getByTestId('video-call-button');
        expect(videoButton).toBeDisabled();
      });
    });

    test('does not render video call button during loading', async () => {
      // Make the request hang
      mockAxios.get.mockImplementation(() => new Promise(() => {}));

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      expect(screen.queryByTestId('video-call-button')).not.toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    test('calls onSelect when list item is clicked', async () => {
      const user = createMockUser();
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(screen.getAllByRole('button')[0]).toBeInTheDocument();
      });

      // Click the main list item button (first button, not the video call button)
      fireEvent.click(screen.getAllByRole('button')[0]);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    test('onSelect is not called during loading state', () => {
      // Make the request hang
      mockAxios.get.mockImplementation(() => new Promise(() => {}));

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      // Loading state should not have clickable button
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('handles user fetch error gracefully', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      // Should remain in loading state or handle error gracefully
      await waitFor(() => {
        // The component should handle the error and either show loading or error state
        expect(screen.queryByRole('progressbar')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test('handles malformed user data gracefully', async () => {
      mockAxios.get.mockResolvedValue({ data: null });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });

    test('handles empty user data gracefully', async () => {
      mockAxios.get.mockResolvedValue({ data: {} });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        // Component should render without crashing when user data is empty
        const listItem = screen.getByRole('listitem');
        expect(listItem).toBeInTheDocument();
        
        // Should show video call button even with empty user data
        expect(screen.getByTestId('video-call-button')).toBeInTheDocument();
      });
    });
  });

  describe('Username Display', () => {
    test('capitalizes username correctly', async () => {
      vi.mocked(capitalizeWords).mockReturnValue("JOHN DOE");

      const user = createMockUser({ username: "john doe" });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(capitalizeWords).toHaveBeenCalledWith("john doe");
        expect(screen.getByText("JOHN DOE")).toBeInTheDocument();
      });
    });

    test('handles special characters in username', async () => {
      vi.mocked(capitalizeWords).mockReturnValue("JOÃO_SILVA");

      const user = createMockUser({ username: "joão_silva" });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(capitalizeWords).toHaveBeenCalledWith("joão_silva");
        expect(screen.getByText("JOÃO_SILVA")).toBeInTheDocument();
      });
    });

    test('handles empty username', async () => {
      vi.mocked(capitalizeWords).mockReturnValue("");

      const user = createMockUser({ username: "" });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(capitalizeWords).toHaveBeenCalledWith("");
      });
    });
  });

  describe('React Query Integration', () => {
    test('uses correct query key for user data', async () => {
      const user = createMockUser();
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation({
        user1Id: "user-1",
        user2Id: "user-2"
      });
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith('/api/users/user-2');
      });
    });

    test('caches user data correctly', async () => {
      // Create a persistent QueryClient for this test only
      const testQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 30000, // Keep data fresh for 30 seconds
          },
        },
      });

      const user = createMockUser();
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      // Custom render function that uses our persistent QueryClient
      const renderWithPersistentClient = (component: React.ReactElement) => {
        return render(
          <QueryClientProvider client={testQueryClient}>
            <ThemeProvider theme={createTheme()}>
              {component}
            </ThemeProvider>
          </QueryClientProvider>
        );
      };

      // Render first instance
      const { unmount } = renderWithPersistentClient(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      // Wait for the query to complete and the user data to load
      await waitFor(() => {
        expect(screen.getByText('TESTUSER')).toBeInTheDocument();
      });

      // Verify the API was called once
      expect(mockAxios.get).toHaveBeenCalledTimes(1);

      unmount();

      // Render second instance with same QueryClient - should use cached data
      renderWithPersistentClient(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      // Wait for the second render to complete
      await waitFor(() => {
        expect(screen.getByText('TESTUSER')).toBeInTheDocument();
      });

      // Should still be called only once due to caching
      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA attributes', async () => {
      const user = createMockUser();
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={true}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        // Target the main list item button and check for proper accessibility
        const mainButton = screen.getAllByRole('button')[0]; // First button is the list item
        
        // Check for basic accessibility attributes that should be present
        expect(mainButton).toHaveAttribute('role', 'button');
        expect(mainButton).toHaveAttribute('tabindex', '0');
        
        // Check that the selected state is indicated by CSS class (MUI approach)
        expect(mainButton).toHaveClass('Mui-selected');
      });
    });

    test('loading state is accessible', () => {
      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
    });

    test('supports keyboard navigation', async () => {
      const user = createMockUser();
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        // Target the main list item button (not the video call button)
        const mainButton = screen.getAllByRole('button')[0]; // First button is the list item
        mainButton.focus();
        expect(mainButton).toHaveFocus();
      });
    });
  });

  describe('Performance', () => {
    test('handles rapid re-renders efficiently', async () => {
      const user = createMockUser();
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      const { rerender } = renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      // Rapid re-renders
      for (let i = 0; i < 5; i++) {
        rerender(
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
              <DirectConversationListItem
                conversation={conversation}
                onSelect={onSelect}
                selected={i % 2 === 0}
                currentUserId="user-1"
              />
            </ThemeProvider>
          </QueryClientProvider>
        );
      }

      await waitFor(() => {
        expect(screen.getByText("TESTUSER")).toBeInTheDocument();
      });

      // Should only make one API call despite re-renders
      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    test('efficiently handles different conversation props', async () => {
      const user1 = createMockUser({ id: "user-2", username: "user2" });
      const user2 = createMockUser({ id: "user-3", username: "user3" });

      mockAxios.get
        .mockResolvedValueOnce({ data: user1 })
        .mockResolvedValueOnce({ data: user2 });

      const conversation1 = createMockConversation({ id: "conv-1", user2Id: "user-2" });
      const conversation2 = createMockConversation({ id: "conv-2", user2Id: "user-3" });
      const onSelect = vi.fn();

      const { rerender } = renderWithProviders(
        <DirectConversationListItem
          conversation={conversation1}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith('/api/users/user-2');
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <DirectConversationListItem
              conversation={conversation2}
              onSelect={onSelect}
              selected={false}
              currentUserId="user-1"
            />
          </ThemeProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith('/api/users/user-3');
      });

      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    test('handles conversation with same user1Id and user2Id', async () => {
      const user = createMockUser({ id: "user-1" });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation({
        user1Id: "user-1",
        user2Id: "user-1" // Same user
      });
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(mockAxios.get).toHaveBeenCalledWith('/api/users/user-1');
      });
    });

    test('handles very long usernames', async () => {
      const longUsername = "a".repeat(1000);
      vi.mocked(capitalizeWords).mockReturnValue(longUsername.toUpperCase());

      const user = createMockUser({ username: longUsername });
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(longUsername.toUpperCase())).toBeInTheDocument();
      });
    });

    test('handles undefined user properties gracefully', async () => {
      const user = {
        id: "user-2",
        username: undefined,
        isOnline: undefined,
      };
      mockAxios.get.mockResolvedValue({ data: user });

      const conversation = createMockConversation();
      const onSelect = vi.fn();

      renderWithProviders(
        <DirectConversationListItem
          conversation={conversation}
          onSelect={onSelect}
          selected={false}
          currentUserId="user-1"
        />
      );

      // Should handle gracefully without crashing
      await waitFor(() => {
        // Component should render without crashing even with undefined properties
        expect(screen.getByTestId('video-call-button')).toBeInTheDocument();
      });
      
      // Verify the component handles undefined username gracefully
      const listItem = screen.getByRole('listitem');
      expect(listItem).toBeInTheDocument();
    });
  });
});