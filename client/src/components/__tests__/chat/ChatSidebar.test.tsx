import ChatSidebar from '@/components/chat/ChatSidebar';
import type { ChatRoomSchemaType } from '@/schemas/chat';
import type { RootState } from '@/store';
import { createMockStore } from '@/utils/test-utils/mockStore';
import { renderWithProviders } from '@/utils/test-utils/renderWithProviders';
import { useQuery } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, type Mock } from 'vitest';

// Mock the API service
vi.mock('@/services/axios', () => ({
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
    defaults: {
      headers: { common: {} }
    }
  }
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: [
        {
          id: 'room-1',
          name: 'General',
          createdAt: new Date().toISOString(),
        },
        { id: 'room-2', name: 'Dev', createdAt: new Date().toISOString() },
      ],
      isLoading: false,
    }),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

const mockRoom: ChatRoomSchemaType = {
  id: 'room-1',
  name: 'General',
  createdAt: new Date().toISOString(),
};
const mockRooms: ChatRoomSchemaType[] = [
  {
    id: 'room-1',
    name: 'General',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'room-2',
    name: 'Dev',
    createdAt: new Date().toISOString(),
  },
];

type CustomOverrrides = {
  room?: Partial<RootState>;
  auth?: Partial<RootState>;
};

const setup = (customOverrrides: CustomOverrrides) => {
  const store = createMockStore({
    room: {
      activeRoom: null,
      isMember: false,
      ...customOverrrides.room,
    },
    auth: {
      user: {
        id: 'user-1',
        username: 'hal',
        email: 'email@email.com',
        avatarUrl: 'my-avater-url',
      },
      isAuthenticated: true,
      status: 'authenticated',
      ...customOverrrides.auth,
    },
    sidebar: {
      mode: 'chat',
    },
    conversation: {
      activeConversation: null,
    },
  });
  const result = renderWithProviders(<ChatSidebar />, store);
  return { store, ...result };
};

describe('Chat Sidebar: ', () => {
  test('renders sidebar title and join button', () => {
    setup({});
    expect(screen.getByText(/rooms/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/create a room/i)).toBeInTheDocument();
  });
  test('renders list of chat rooms from query', async () => {
    setup({});
    (useQuery as unknown as Mock).mockReturnValue({
      data: mockRooms,
      isLoading: false,
    });
    expect(await screen.findByText(/# general/i)).toBeInTheDocument();
    expect(screen.getByText(/# dev/i)).toBeInTheDocument();
  });
  test('toggles room expansion state on click', async () => {
    setup({});
    (useQuery as unknown as Mock).mockReturnValue({
      data: mockRooms,
      isLoading: false,
    });
    const room = await screen.findByText(/# general/i);
    fireEvent.click(room);
  });
  test('restores active and expanded room from localStorage', async () => {
    localStorage.setItem('activeRoom', JSON.stringify({ id: '2' }));
    localStorage.setItem('expandedRoomId', JSON.stringify('2'));
    (useQuery as unknown as Mock).mockReturnValue({
      data: mockRooms,
      isLoading: false,
    });

    const store = createMockStore({
      room: { activeRoom: null, isMember: false },
      auth: {
        user: {
          id: 'user-1',
          username: 'hal',
          email: 'email@email.com',
          avatarUrl: 'my-avatar-url',
        },
        isAuthenticated: true,
        status: 'authenticated',
      },
      sidebar: {
        mode: 'chat',
      },
      conversation: {
        activeConversation: null,
      },
    });

    const dispatchSpy = vi.spyOn(store, 'dispatch');

    renderWithProviders(<ChatSidebar />, store);

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'chatRoom/setActiveRoom',
        payload: mockRoom,
      });
    });
  });
  test('stores expandedRoomId in localStorage when toggled', async () => {
    setup({});
    (useQuery as unknown as Mock).mockReturnValue({
      data: mockRooms,
      isLoading: false,
    });
    const room = await screen.findByText(/general/i);
    fireEvent.click(room);

    expect(localStorage.getItem('expandedRoomId')).toBe(
      JSON.stringify('room-1')
    );
  });
});
