import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import api from "../services/axios";
import { setRoomMembership } from "@/store/slice/chatRoomSlice";
import type { RootState } from "@/store";

export function useRoomMembershipCheck(roomId: string | undefined) {
    const dispatch = useDispatch();
    const user = useSelector((state: RootState) => state.auth.user);

    const { data: users, isLoading } = useQuery({
        queryKey: ["roomUsers", roomId],
        queryFn: async () => { 
            const response = await api.get(`/api/rooms/${roomId}/users`);
            return response.data;
        },
        enabled: !!roomId,
    });

    useEffect(() => { 
        if (!isLoading && users && roomId) {
            const isUserInRoom = users.some((u: any) => u.id === user?.id);
            dispatch(setRoomMembership(isUserInRoom));
        }
    }, [users, isLoading, roomId, user?.id, dispatch]);
}