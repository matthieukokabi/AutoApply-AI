interface DiagnosticsAppUrl {
    valid?: boolean;
    matchesRequestHost?: boolean | null;
}

interface DiagnosticsPayload {
    auth?: {
        status?: "signed_in" | "signed_out" | "error" | string;
    };
    configuration?: {
        appUrl?: DiagnosticsAppUrl;
    };
}

interface ProfilePayload {
    profile?: {
        rawText?: string | null;
    } | null;
}

interface PreferencesPayload {
    preferences?: {
        targetTitles?: string[] | null;
    } | null;
}

export interface OnboardingHealthSnapshot {
    authReady: boolean;
    profileReady: boolean;
    preferencesReady: boolean;
    checkoutReady: boolean;
    checkoutDetail: string | null;
}

function hasProfileRawText(profilePayload: ProfilePayload | null) {
    const rawText = profilePayload?.profile?.rawText;
    return typeof rawText === "string" && rawText.trim().length > 0;
}

function hasTargetTitles(preferencesPayload: PreferencesPayload | null) {
    const titles = preferencesPayload?.preferences?.targetTitles;
    return Array.isArray(titles) && titles.length > 0;
}

function resolveCheckoutHealth(
    diagnosticsPayload: DiagnosticsPayload | null
): { ready: boolean; detail: string | null } {
    const appUrl = diagnosticsPayload?.configuration?.appUrl;
    const appUrlValid = appUrl?.valid === true;
    const hostMatches = appUrl?.matchesRequestHost;

    if (!appUrlValid) {
        return {
            ready: false,
            detail: "Checkout configuration is incomplete on the server.",
        };
    }

    if (hostMatches === false) {
        return {
            ready: false,
            detail: "Checkout domain configuration does not match this website host.",
        };
    }

    return { ready: true, detail: null };
}

export function buildOnboardingHealthSnapshot(input: {
    isSignedIn: boolean;
    diagnosticsPayload: DiagnosticsPayload | null;
    profilePayload: ProfilePayload | null;
    preferencesPayload: PreferencesPayload | null;
}): OnboardingHealthSnapshot {
    const diagnosticsAuthReady = input.diagnosticsPayload?.auth?.status === "signed_in";
    const authReady = input.isSignedIn || diagnosticsAuthReady;
    const { ready: checkoutReady, detail: checkoutDetail } = resolveCheckoutHealth(
        input.diagnosticsPayload
    );

    return {
        authReady,
        profileReady: hasProfileRawText(input.profilePayload),
        preferencesReady: hasTargetTitles(input.preferencesPayload),
        checkoutReady,
        checkoutDetail,
    };
}
