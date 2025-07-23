import { screen } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import TypingIndicator from "../../chat/TypingIndicator";
import type { TypingUser } from "../../../hooks/useChatSocket";
import { renderWithProviders } from "../../../utils/test-utils/renderWithProviders";

expect.extend(toHaveNoViolations);

// Mock utility functions
vi.mock("../../../utils/capitalizeWords", () => ({
  capitalizeWords: vi.fn((str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div data-testid="motion-div" {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span data-testid="motion-span" {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
  easeInOut: "easeInOut",
}));

describe('TypingIndicator', () => {
  const mockTheme = {
    palette: {
      primary: { 
        main: '#1976d2',
        light: '#42a5f5'
      },
    },
  };

  const createMockTypingUser = (overrides: Partial<TypingUser> = {}): TypingUser => ({
    username: "testuser",
    userId: "user-1",
    avatarUrl: "https://example.com/avatar.jpg",
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  const renderComponent = (typingUsers: TypingUser[] = []) => {
    return renderWithProviders(
      <TypingIndicator typingUsers={typingUsers} theme={mockTheme} />
    );
  };

  describe('Rendering', () => {
    test('renders nothing when no users are typing', () => {
      const { container } = renderComponent([]);
      
      expect(container.firstChild).toBeNull();
    });

    test('renders single typing user', () => {
      const typingUsers = [createMockTypingUser({ username: "alice" })];
      
      renderComponent(typingUsers);
      
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByAltText("User avatar")).toBeInTheDocument();
    });

    test('renders multiple typing users', () => {
      const typingUsers = [
        createMockTypingUser({ username: "alice", userId: "user-1" }),
        createMockTypingUser({ username: "bob", userId: "user-2" }),
        createMockTypingUser({ username: "charlie", userId: "user-3" }),
      ];
      
      renderComponent(typingUsers);
      
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
      
      // Should render three avatars
      const avatars = screen.getAllByAltText("User avatar");
      expect(avatars).toHaveLength(3);
    });

    test('capitalizes usernames correctly', () => {
      const typingUsers = [
        createMockTypingUser({ username: "john_doe" }),
        createMockTypingUser({ username: "JANE_SMITH", userId: "user-2" }),
        createMockTypingUser({ username: "mike.wilson", userId: "user-3" }),
      ];
      
      renderComponent(typingUsers);
      
      expect(screen.getByText("John_doe")).toBeInTheDocument();
      expect(screen.getByText("Jane_smith")).toBeInTheDocument();
      expect(screen.getByText("Mike.wilson")).toBeInTheDocument();
    });
  });

  describe('Avatar Handling', () => {
    test('displays custom avatar when provided', () => {
      const typingUsers = [
        createMockTypingUser({ 
          username: "alice",
          avatarUrl: "https://example.com/alice-avatar.jpg"
        }),
      ];
      
      renderComponent(typingUsers);
      
      const avatar = screen.getByAltText("User avatar");
      expect(avatar).toHaveAttribute("src", "https://example.com/alice-avatar.jpg");
    });

    test('uses default avatar when avatarUrl is null', () => {
      const typingUsers = [
        createMockTypingUser({ 
          username: "alice",
          avatarUrl: undefined
        }),
      ];
      
      renderComponent(typingUsers);
      
      const avatar = screen.getByAltText("User avatar");
      expect(avatar).toHaveAttribute("src", "/default-avatar.png");
    });

    test('uses default avatar when avatarUrl is empty string', () => {
      const typingUsers = [
        createMockTypingUser({ 
          username: "alice",
          avatarUrl: ""
        }),
      ];
      
      renderComponent(typingUsers);
      
      const avatar = screen.getByAltText("User avatar");
      expect(avatar).toHaveAttribute("src", "/default-avatar.png");
    });
  });

  describe('Animation Elements', () => {
    test('renders typing dots for each user', () => {
      const typingUsers = [createMockTypingUser()];
      
      renderComponent(typingUsers);
      
      // Should render 3 animated dots (motion spans)
      const dots = screen.getAllByTestId("motion-span");
      expect(dots).toHaveLength(3);
    });

    test('renders motion components for animation', () => {
      const typingUsers = [createMockTypingUser()];
      
      renderComponent(typingUsers);
      
      expect(screen.getByTestId("animate-presence")).toBeInTheDocument();
      expect(screen.getByTestId("motion-div")).toBeInTheDocument();
    });

    test('renders correct number of dots for multiple users', () => {
      const typingUsers = [
        createMockTypingUser({ userId: "user-1" }),
        createMockTypingUser({ userId: "user-2" }),
      ];
      
      renderComponent(typingUsers);
      
      // Should render 6 dots total (3 per user)
      const dots = screen.getAllByTestId("motion-span");
      expect(dots).toHaveLength(6);
    });
  });

  describe('Theme Integration', () => {
    test('applies theme colors correctly', () => {
      const customTheme = {
        palette: {
          primary: {
            main: '#ff5722',
            light: '#ff8a65'
          },
        },
      };
      
      const typingUsers = [createMockTypingUser()];
      
      renderWithProviders(
        <TypingIndicator typingUsers={typingUsers} theme={customTheme} />
      );
      
      // Component should render without theme-related errors
      expect(screen.getByText("Testuser")).toBeInTheDocument();
    });

    test('handles missing theme properties gracefully', () => {
      const incompleteTheme = {
        palette: {
          primary: {
            main: '#1976d2'
            // missing light property
          },
        },
      };
      
      const typingUsers = [createMockTypingUser()];
      
      expect(() => {
        renderWithProviders(
          <TypingIndicator typingUsers={typingUsers} theme={incompleteTheme} />
        );
      }).not.toThrow();
    });
  });

  describe('User Identification', () => {
    test('uses unique keys for each typing user', () => {
      const typingUsers = [
        createMockTypingUser({ username: "alice", userId: "user-alice" }),
        createMockTypingUser({ username: "bob", userId: "user-bob" }),
      ];
      
      const { container } = renderComponent(typingUsers);
      
      // Should render multiple motion divs with unique keys
      const motionDivs = container.querySelectorAll('[data-testid="motion-div"]');
      expect(motionDivs).toHaveLength(2);
    });

    test('handles duplicate usernames with different IDs', () => {
      const typingUsers = [
        createMockTypingUser({ username: "john", userId: "user-1" }),
        createMockTypingUser({ username: "john", userId: "user-2" }),
      ];
      
      renderComponent(typingUsers);
      
      // Should render both users even with same username
      const johnElements = screen.getAllByText("John");
      expect(johnElements).toHaveLength(2);
    });

    test('handles users with special characters in usernames', () => {
      const typingUsers = [
        createMockTypingUser({ username: "user@domain.com" }),
        createMockTypingUser({ username: "user-name_123", userId: "user-2" }),
        createMockTypingUser({ username: "user.with.dots", userId: "user-3" }),
      ];
      
      renderComponent(typingUsers);
      
      expect(screen.getByText("User@domain.com")).toBeInTheDocument();
      expect(screen.getByText("User-name_123")).toBeInTheDocument();
      expect(screen.getByText("User.with.dots")).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string username', () => {
      const typingUsers = [
        createMockTypingUser({ username: "" }),
      ];
      
      expect(() => renderComponent(typingUsers)).not.toThrow();
      
      // Should still render the indicator structure
      expect(screen.getByAltText("User avatar")).toBeInTheDocument();
    });

    test('handles null/undefined username gracefully', () => {
      const typingUsers = [
        createMockTypingUser({ username: null as any }),
      ];
      
      expect(() => renderComponent(typingUsers)).not.toThrow();
    });

    test('handles very long usernames', () => {
      const longUsername = "a".repeat(100);
      const typingUsers = [
        createMockTypingUser({ username: longUsername }),
      ];
      
      renderComponent(typingUsers);
      
      // Should render and handle long username
      expect(screen.getByText("A" + "a".repeat(99))).toBeInTheDocument();
    });

    test('handles special Unicode characters in usernames', () => {
      const typingUsers = [
        createMockTypingUser({ username: "用户名", userId: "user-1" }),
        createMockTypingUser({ username: "🚀rocket", userId: "user-2" }),
        createMockTypingUser({ username: "тест", userId: "user-3" }),
      ];
      
      renderComponent(typingUsers);
      
      expect(screen.getByText("用户名")).toBeInTheDocument();
      expect(screen.getByText("🚀rocket")).toBeInTheDocument();
      expect(screen.getByText("Тест")).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('handles rapid changes in typing users', () => {
      const { rerender } = renderComponent([]);
      
      // Add users
      const typingUsers1 = [createMockTypingUser({ userId: "user-1" })];
      rerender(<TypingIndicator typingUsers={typingUsers1} theme={mockTheme} />);
      expect(screen.getByText("Testuser")).toBeInTheDocument();
      
      // Add more users
      const typingUsers2 = [
        ...typingUsers1,
        createMockTypingUser({ username: "alice", userId: "user-2" }),
      ];
      rerender(<TypingIndicator typingUsers={typingUsers2} theme={mockTheme} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      
      // Remove all users
      rerender(<TypingIndicator typingUsers={[]} theme={mockTheme} />);
      expect(screen.queryByText("Testuser")).not.toBeInTheDocument();
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });

    test('handles large number of typing users', () => {
      const typingUsers = Array.from({ length: 20 }, (_, i) =>
        createMockTypingUser({ 
          username: `user${i}`, 
          userId: `user-${i}` 
        })
      );
      
      expect(() => renderComponent(typingUsers)).not.toThrow();
      
      // Should render all users
      expect(screen.getByText("User0")).toBeInTheDocument();
      expect(screen.getByText("User19")).toBeInTheDocument();
      
      // Should render correct number of avatars
      const avatars = screen.getAllByAltText("User avatar");
      expect(avatars).toHaveLength(20);
    });
  });

  describe('State Transitions', () => {
    test('transitions from no users to users typing', () => {
      const { container, rerender } = renderComponent([]);
      
      // Initially empty
      expect(container.firstChild).toBeNull();
      
      // Add typing user
      const typingUsers = [createMockTypingUser()];
      rerender(<TypingIndicator typingUsers={typingUsers} theme={mockTheme} />);
      
      expect(screen.getByText("Testuser")).toBeInTheDocument();
    });

    test('transitions from users typing to no users', () => {
      const typingUsers = [createMockTypingUser()];
      const { container, rerender } = renderComponent(typingUsers);
      
      // Initially has user
      expect(screen.getByText("Testuser")).toBeInTheDocument();
      
      // Remove all users
      rerender(<TypingIndicator typingUsers={[]} theme={mockTheme} />);
      
      expect(container.firstChild).toBeNull();
    });

    test('handles user replacement smoothly', () => {
      const user1 = createMockTypingUser({ username: "alice", userId: "user-1" });
      const user2 = createMockTypingUser({ username: "bob", userId: "user-2" });
      
      const { rerender } = renderComponent([user1]);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      
      // Replace user1 with user2
      rerender(<TypingIndicator typingUsers={[user2]} theme={mockTheme} />);
      
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has no accessibility violations', async () => {
      const typingUsers = [
        createMockTypingUser({ username: "alice" }),
        createMockTypingUser({ username: "bob", userId: "user-2" }),
      ];
      
      const { container } = renderComponent(typingUsers);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('avatars have proper alt text', () => {
      const typingUsers = [createMockTypingUser()];
      
      renderComponent(typingUsers);
      
      const avatar = screen.getByAltText("User avatar");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAccessibleName();
    });

    test('provides semantic structure', () => {
      const typingUsers = [createMockTypingUser()];
      
      renderComponent(typingUsers);
      
      // Should have proper text content for screen readers
      expect(screen.getByText("Testuser")).toBeInTheDocument();
    });

    test('handles missing accessibility attributes gracefully', () => {
      const typingUsers = [
        createMockTypingUser({ avatarUrl: "invalid-url" }),
      ];
      
      expect(() => renderComponent(typingUsers)).not.toThrow();
      
      const avatar = screen.getByAltText("User avatar");
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Integration Scenarios', () => {
    test('works with real-world typing scenarios', () => {
      // Simulate a typical chat typing scenario
      const { rerender } = renderComponent([]);
      
      // User starts typing
      const alice = createMockTypingUser({ username: "alice", userId: "alice-1" });
      rerender(<TypingIndicator typingUsers={[alice]} theme={mockTheme} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      
      // Another user starts typing
      const bob = createMockTypingUser({ username: "bob", userId: "bob-1" });
      rerender(<TypingIndicator typingUsers={[alice, bob]} theme={mockTheme} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      
      // First user stops typing
      rerender(<TypingIndicator typingUsers={[bob]} theme={mockTheme} />);
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      
      // All users stop typing
      rerender(<TypingIndicator typingUsers={[]} theme={mockTheme} />);
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });

    test('handles concurrent user updates', () => {
      // Test rapid updates that might happen in real-time chat
      const users = [
        createMockTypingUser({ username: "user1", userId: "1" }),
        createMockTypingUser({ username: "user2", userId: "2" }),
        createMockTypingUser({ username: "user3", userId: "3" }),
      ];
      
      const { rerender } = renderComponent([]);
      
      // Rapidly add and remove users
      for (let i = 0; i < users.length; i++) {
        rerender(<TypingIndicator typingUsers={users.slice(0, i + 1)} theme={mockTheme} />);
      }
      
      // All users should be visible
      expect(screen.getByText("User1")).toBeInTheDocument();
      expect(screen.getByText("User2")).toBeInTheDocument();
      expect(screen.getByText("User3")).toBeInTheDocument();
      
      // Rapidly remove users
      for (let i = users.length - 1; i >= 0; i--) {
        rerender(<TypingIndicator typingUsers={users.slice(0, i)} theme={mockTheme} />);
      }
    });
  });
});