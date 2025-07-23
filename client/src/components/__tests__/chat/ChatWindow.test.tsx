import { screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, describe, beforeEach } from "vitest";
import { useInfiniteQuery } from "@tanstack/react-query";
import ChatWindow from "../../chat/ChatWindow";
import { createMockStore } from "@/utils/test-utils/mockStore";
import { renderWithProviders } from "@/utils/test-utils/renderWithProviders";

// Mock all external dependencies first
vi.mock("../../../services/axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} } }
  }
}));


// Mock socket.io to prevent real connections
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
    disconnect: vi.fn()
  }))
}));


const mockEmitTyping = vi.fn();
const mockSendMessage = vi.fn();

vi.mock("../../hooks/useChatSocket", () => ({
  useChatSocket: vi.fn(() => ({
    typingUsers: [],
    emitTyping: mockEmitTyping,
    sendMessage: mockSendMessage,
  })),
}));

vi.mock("@/hooks/useRoomMembershipCheck", () => ({
  useRoomMembershipCheck: vi.fn(),
}));

// Mock MessageList and MessageInput components
vi.mock("../../chat/MessageList", () => ({
  default: ({ messages }: { messages: Array<{ content: string }> }) => (
    <div data-testid="message-list">
      {messages.map((msg, index) => (
        <div key={index}>{msg.content}</div>
      ))}
    </div>
  ),
}));

vi.mock("../../chat/MessageInput", () => ({
  default: (props: {
    onTyping?: (content: string) => void;
    input?: any;
    setInput?: any;
    onSend?: any;
    theme?: any;
  }) => (
    <div>
      <input
        placeholder="Type your message..."
        onChange={(e) => {
          props.onTyping?.(e.target.value);
        }}
        data-testid="message-input"
      />
      <button>Send</button>
    </div>
  ),
}));
vi.mock("../../utils/auth-tokens", () => ({
  isTokenExpired: vi.fn().mockReturnValue(false),
  refreshAccessToken: vi.fn().mockResolvedValue("mocked-token"),
  getAccessToken: vi.fn().mockReturnValue("mock-token"),
}));

vi.mock("../../lib/socket", () => ({
  connectSocket: vi.fn().mockResolvedValue(null),
  getSocket: vi.fn().mockReturnValue(null),
  disconnectSocket: vi.fn(),
}));

// Mock the entire useSocket hook to prevent any socket connections
vi.mock("../../hooks/useSocket", () => ({
  useSocket: vi.fn().mockReturnValue(null),
}));

// Mock global fetch to prevent any network requests
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({}),
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useInfiniteQuery: vi.fn().mockReturnValue({
      data: { pages: [{ data: [] }] },
      isLoading: false,
      isError: false,
      error: null,
      isPending: false,
      isLoadingError: false,
      isRefetchError: false,
      status: 'success' as const,
      fetchStatus: 'idle' as const,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      hasNextPage: false,
      hasPreviousPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      isPlaceholderData: false,
      isRefetching: false,
      isStale: false,
      refetch: vi.fn(),
      remove: vi.fn(),
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isInitialLoading: false,
      isPaused: false,
      isSuccess: true,
    }),
  };
});

afterEach(() => { 
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('Chat Window: ', () => { 
  beforeEach(() => {
    // Only clear specific mocks, not all mocks
    mockEmitTyping.mockClear();
    mockSendMessage.mockClear();
    // Reset the mock to default state for each test
    vi.mocked(useInfiniteQuery).mockReturnValue({
      data: { pages: [{ data: [] }] },
      isLoading: false,
      isError: false,
      error: null,
      isPending: false,
      isLoadingError: false,
      isRefetchError: false,
      status: 'success' as const,
      fetchStatus: 'idle' as const,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      hasNextPage: false,
      hasPreviousPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      isPlaceholderData: false,
      isRefetching: false,
      isStale: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isInitialLoading: false,
      isPaused: false,
      isSuccess: true,
      isFetchNextPageError: false,
      isFetchPreviousPageError: false,
      promise: Promise.resolve(),
    } as any);
  });

  test("renders input that responds to typing", async () => {
    const store = createMockStore({
      room: {
        activeRoom: {
          id: "room-1",
          name: "General",
          createdAt: "1751469587284",
        },
        isMember: true,
      },
    });

    renderWithProviders(<ChatWindow />, store);

    const input = screen.getByPlaceholderText(/type your message/i);
    
    // Just verify the input accepts text input
    fireEvent.change(input, { target: { value: "Hello" } });
    expect(input).toHaveValue("Hello");
  });

  test("renders input and send button", () => {
    const store = createMockStore({
      room: {
        activeRoom: {
          id: "room-1",
          name: "General",
          createdAt: "1751469587284",
        },
        isMember: true,
      },
    });
    renderWithProviders(<ChatWindow />, store);
    expect(
      screen.getByPlaceholderText(/type your message/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/send/i)).toBeInTheDocument();
  });

  test("loads and displays initial chat messages from fetch", async () => {
    const mockMessages = [
      { username: "Alice", content: "Hello from Alice", timestamp: Date.now() },
    ];

    // Update the mock to return messages
    vi.mocked(useInfiniteQuery).mockReturnValue({
      data: { pages: [{ data: mockMessages }] },
      isLoading: false,
      isError: false,
      error: null,
      isPending: false,
      isLoadingError: false,
      isRefetchError: false,
      status: 'success' as const,
      fetchStatus: 'idle' as const,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
      hasNextPage: false,
      hasPreviousPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
      isPlaceholderData: false,
      isRefetching: false,
      isStale: false,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isInitialLoading: false,
      isPaused: false,
      isSuccess: true,
      isFetchNextPageError: false,
      isFetchPreviousPageError: false,
      promise: Promise.resolve(),
    } as any);

    const store = createMockStore({
      room: {
        activeRoom: {
          id: "room-1",
          name: "General",
          createdAt: "1751469587284",
        },
        isMember: true,
      },
    });

    renderWithProviders(<ChatWindow />, store);

    await waitFor(() => {
      expect(screen.getByText("Hello from Alice")).toBeInTheDocument();
    });
  });

  test("shows empty state when no messages", () => {
    const store = createMockStore({
      room: {
        activeRoom: {
          id: "room-1",
          name: "General",
          createdAt: "1751469587284",
        },
        isMember: true,
      },
    });

    renderWithProviders(<ChatWindow />, store);

    expect(screen.getByText(/awfully quiet here/i)).toBeInTheDocument();
  });
});
