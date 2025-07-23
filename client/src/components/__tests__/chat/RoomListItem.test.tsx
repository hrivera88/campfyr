import { screen, fireEvent, waitFor } from "@testing-library/react";
import RoomListItem from "@/components/chat/RoomListItem";
import { test, expect, vi, type Mock, beforeEach, describe } from 'vitest';
import { renderWithProviders } from "@/utils/test-utils/renderWithProviders";
import { createMockStore } from "@/utils/test-utils/mockStore";
import type { ChatRoomSchemaType } from "@/schemas/chat";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { RootState } from "@/store";
import { axe, toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);

vi.mock('@tanstack/react-query', async () => { 
    const actual = await vi.importActual('@tanstack/react-query');
    return {
        ...actual,
        useQuery: vi.fn().mockReturnValue({
            data: [{ id: 'user-1', username: 'Hal', email: 'email@email.com' }],
            isLoading: false,
        }),
        useMutation: vi.fn(() => ({
            mutate: vi.fn(),
            isPending: false,
        })),
        useQueryClient: () => ({
            invalidateQueries: vi.fn(),
        }),
    }
});

//Sample room and user data
const mockRoom: ChatRoomSchemaType = {
    id: 'room-1',
    name: 'General',
    createdAt: new Date().toISOString(),
};

type CustomOverrides = {
    room?: Partial<RootState['room']>;
    auth?: Partial<RootState['auth']>;
};

const setup = (customOverrides: CustomOverrides = {}, isExpanded = false) => {
    const store = createMockStore({
      room: {
        activeRoom: mockRoom,
        isMember: true,
        ...customOverrides?.room,
      },
      auth: {
        user: {
          id: "user-1",
          username: "hal",
          email: "email@email.com",
        },
        isAuthenticated: true,
        status: "authenticated",
        ...customOverrides?.auth,
      },
    });

    const onToggle = vi.fn();

    const result = renderWithProviders(<RoomListItem room={mockRoom} isExpanded={isExpanded} onToggle={onToggle} />, store);

    return { onToggle, store, ...result };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Room List Item: ', () => { 
    test("renders room name correctly", () => {
      setup();
      expect(screen.getByText("# General")).toBeInTheDocument();
    });

    test("calls onToggle when clicked", () => {
      const { onToggle } = setup();
      fireEvent.click(
        screen.getByRole("button", {
          name: /general/i,
        })
      );
      expect(onToggle).toHaveBeenCalled();
    });

    test("shows spinner when loading", () => {
      (useQuery as unknown as Mock).mockReturnValue({
        data: [],
        isLoading: true,
      });
      setup({}, true);
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    test("displays list of users when isMember is true", () => {
      (useQuery as unknown as Mock).mockReturnValue({
        data: [{ id: "user-1", username: "Hal", email: "email@email.com" }],
        isLoading: false,
      });
      setup({ room: { isMember: true } }, true);
      expect(screen.getByText("Hal")).toBeInTheDocument();
    });

    test("shows join prompt when not a member", () => {
      (useQuery as unknown as Mock).mockReturnValue({
        data: [{ id: "user-2", username: "SomeoneElse" }],
        isLoading: false,
      });
      setup({ room: { isMember: false } }, true);
      expect(
        screen.getByText(/you are not part of this room/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /click here to join/i })
      ).toBeInTheDocument();
    });

    test("opens and closes join dialog", async () => {
      setup({ room: { isMember: false } }, true);
      fireEvent.click(screen.getByText(/click here to join/i));
      expect(await screen.getByRole("dialog")).toBeVisible();

      fireEvent.click(screen.getByText(/cancel/i));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    test("triggers joinRoom mutation on confirm", async () => {
      const mockMutate = vi.fn();
      (useMutation as unknown as Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      setup({ room: { isMember: false } }, true);
      fireEvent.click(screen.getByText(/click here to join/i));
      fireEvent.click(screen.getByText(/confirm/i));
      expect(mockMutate).toHaveBeenCalled();
    });

    test("handles joinRoom mutation error gracefully", async () => {
      const errorMutate = vi.fn((_, { onError } = {}) =>
        onError?.(new Error("Join Failed"))
      );
      (useMutation as unknown as Mock).mockReturnValue({
        mutate: errorMutate,
        isPending: false,
      });

      setup({ room: { isMember: false } }, true);
      fireEvent.click(screen.getByText(/click here to join/i));
      fireEvent.click(screen.getByText(/confirm/i));
      expect(errorMutate).toHaveBeenCalled();
    });

    test("sets room membership true if user is int the room", async () => {
      const dispatchSpy = vi.fn();
      const matchingUser = {
        id: "user-1",
        username: "Hal",
        email: "email@email.com",
      };

      (useQuery as unknown as Mock).mockReturnValue({
        data: [matchingUser],
        isLoading: false,
      });

      const store = createMockStore({
        room: {
          activeRoom: mockRoom,
          isMember: false,
        },
        auth: {
          user: matchingUser,
          isAuthenticated: true,
          status: "authenticated",
        },
      });

      vi.spyOn(store, "dispatch").mockImplementation(dispatchSpy);

      renderWithProviders(
        <RoomListItem room={mockRoom} isExpanded={true} onToggle={vi.fn()} />,
        store
      );

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith({
          type: "chatRoom/setRoomMembership",
          payload: true,
        });
      });
    });

    test("dialog should be accessible", async () => {
      (useQuery as unknown as Mock).mockReturnValue({
        data: [{ id: "user-2", username: "SomeoneElse" }],
        isLoading: false,
      });
      const { container } = setup({ room: { isMember: false } }, true);
      fireEvent.click(screen.getByText(/click here to join/i));
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
});