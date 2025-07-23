type Timestamped = { [key: string]: any };

export function normalizeTimestamps<T extends Timestamped>(
    input: T | T[],
    timestampKey: keyof T = "timestamp"
): T | T[] {
    if (Array.isArray(input)) {
        
        return input.map(item => {
            return ({
            ...item,
            [timestampKey]: new Date(item[timestampKey]).getTime(),
        })});
    }

    return {
        ...input,
        [timestampKey]: new Date(input[timestampKey]).getTime(),
    };
}
