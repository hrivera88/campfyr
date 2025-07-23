import { useQuery } from "@tanstack/react-query";
import api from "@/services/axios";

type PaginatedResponse<T> = {
    data: T[];
    meta: {
        nextCursor: string | null;
        hasNextPage: boolean;
        count: number;
    };
    success: boolean;
};

export function usePaginatedQuery<T>(key: string, endpoint: string, params: Record<string, any>) { 
    return useQuery<PaginatedResponse<T>>({
        queryKey: [key, params],
        queryFn: async () => {
            const res = await api.get(endpoint, { params });
            return res.data;
        }
    });
}