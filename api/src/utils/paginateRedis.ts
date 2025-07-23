import { redis } from "../redis";

type RedisPaginatedOptions = {
    redisKey: string;
    take?: number;
    cursor?: number;
};

type PaginatedResult<T> = {
    data: T[],
    meta: {
        nextCursor: number | null;
        hasNextPage: boolean;
        count: number;
    };
};

export async function paginatedRedis<T>(options: RedisPaginatedOptions, mapFn: (json: string) => T): Promise<PaginatedResult<T>> { 
    const { redisKey, take = 20, cursor = 0 } = options;

    const end = cursor + take;

    const results = await redis.lrange(redisKey, cursor, end);

    const hasNextPage = results.length > take;
    const paginated = hasNextPage ? results.slice(0, take) : results;

    const data = paginated.map(mapFn);

    return {
        data: data.reverse(),
        meta: {
            nextCursor: hasNextPage ? cursor + take : null,
            hasNextPage,
            count: data.length
        }
    };

};