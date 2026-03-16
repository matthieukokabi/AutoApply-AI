export type RateLimitStore = Map<string, number[]>;

export function getClientIp(req: Request): string | null {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() || null;
    }

    return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

type IsRateLimitedOptions = {
    store: RateLimitStore;
    key: string;
    maxRequests: number;
    windowMs: number;
    now?: number;
};

export function isRateLimited({
    store,
    key,
    maxRequests,
    windowMs,
    now = Date.now(),
}: IsRateLimitedOptions): boolean {
    const windowStart = now - windowMs;
    const recentRequests = (store.get(key) || []).filter((timestamp) => timestamp > windowStart);

    if (recentRequests.length >= maxRequests) {
        if (recentRequests.length > 0) {
            store.set(key, recentRequests);
        } else {
            store.delete(key);
        }
        return true;
    }

    recentRequests.push(now);
    store.set(key, recentRequests);
    return false;
}
