import { PrismaClient, Prisma } from '../generated/prisma'

type DelegateWithFindMany<T> = {
    findMany(args: any): Promise<any>;
};

type PaginateOptions<TModel, TWhereInput, TSelect, TOrderBy> = {
    model: keyof PrismaClient;
    where?: TWhereInput;
    select?: TSelect;
    orderBy?: TOrderBy;
    cursor?: string;
    take?: number;
    searchField?: keyof TWhereInput;
    searchQuery?: string;
    additionalWhere?: TWhereInput;
};

export async function paginate<TModel, TWhereInput, TSelect, TOrderBy>(prisma: PrismaClient, options: PaginateOptions<DelegateWithFindMany<TModel>, TWhereInput, TSelect, TOrderBy>): Promise<{ data: TModel[]; meta: { nextCursor: string | null; hasMore: boolean; count: number } }> {
    const { model, where = {} as TWhereInput, select, orderBy = { createdAt: "desc" } as TOrderBy, cursor, take = 20, searchField, searchQuery, additionalWhere = {} as TWhereInput, } = options;
    const queryOptions: any = {
        where: {
            ...where, ...additionalWhere, ...(searchField && searchQuery ? { [searchField]: { contains: searchQuery, mode: "insensitive" } } : {}),
        },
        orderBy,
        take: take + 1,
        ...(select ? { select } : {}),
    };

    if (cursor) {
        queryOptions.cursor = { id: cursor };
    }

    const modelDelegate = prisma[model] as DelegateWithFindMany<TModel>;

    const records = await modelDelegate.findMany(queryOptions);

    const hasMore = records.length > take;
    const data = hasMore ? records.slice(0, take) : records;

    return {
        data, meta: {
            nextCursor: hasMore ? records[take].id : null,
            hasMore,
            count: data.length,
        }
    }
}