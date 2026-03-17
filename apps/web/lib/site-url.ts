const DEFAULT_APP_BASE_URL = "https://autoapply.works";

function normalizePath(path: string): string {
    if (!path) {
        return "/";
    }

    return path.startsWith("/") ? path : `/${path}`;
}

export function getAppBaseUrl(): string {
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!rawUrl) {
        return DEFAULT_APP_BASE_URL;
    }

    try {
        return new URL(rawUrl).origin;
    } catch {
        return DEFAULT_APP_BASE_URL;
    }
}

export function toAbsoluteAppUrl(path = "/"): string {
    return `${getAppBaseUrl()}${normalizePath(path)}`;
}
