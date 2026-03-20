function toBoolean(value: string | undefined): boolean {
    if (!value) {
        return false;
    }

    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on", "enabled"].includes(normalized);
}

function parseAllowedUserIds(rawAllowlist: string | undefined): string[] {
    if (!rawAllowlist) {
        return [];
    }

    return rawAllowlist
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
}

export function isRecruiterBetaEnabled(): boolean {
    return toBoolean(process.env.RECRUITER_BETA_ENABLED);
}

export function canAccessRecruiterBeta(
    userId: string | null | undefined
): boolean {
    if (!userId || !isRecruiterBetaEnabled()) {
        return false;
    }

    const allowlist = parseAllowedUserIds(
        process.env.RECRUITER_BETA_ALLOWED_USER_IDS
    );

    if (allowlist.length === 0) {
        return true;
    }

    return allowlist.includes(userId);
}
