import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/preferences — fetch the current user's job preferences
 */
export async function GET(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const preferences = await prisma.jobPreferences.findUnique({
            where: { userId: user.id },
        });

        const response = NextResponse.json({
            preferences: preferences || null,
        });
        response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
        return response;
    } catch (error) {
        console.error("GET /api/preferences error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

const VALID_CURRENCIES = [
    "USD", "EUR", "GBP", "CHF", "CAD", "AUD",
    "SEK", "NOK", "DKK", "PLN", "CZK", "INR", "JPY", "BRL",
];
const VALID_REMOTE_PREFERENCES = ["any", "remote", "hybrid", "onsite"] as const;
const MAX_PREFERENCE_ITEMS = 25;
const MAX_PREFERENCE_ITEM_LENGTH = 120;

function sanitizeStringArray(values: unknown): string[] {
    if (!Array.isArray(values)) {
        return [];
    }

    return values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);
}

/**
 * PUT /api/preferences — create or update job preferences
 * Body: { targetTitles, locations, remotePreference, salaryMin, salaryCurrency, industries }
 */
export async function PUT(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            targetTitles = [],
            locations = [],
            remotePreference = "any",
            salaryMin,
            salaryCurrency = "USD",
            industries = [],
        } = body;

        // Validate currency
        const currency = VALID_CURRENCIES.includes(salaryCurrency) ? salaryCurrency : "USD";

        const normalizedRemotePreference =
            typeof remotePreference === "string" ? remotePreference : "any";
        if (!VALID_REMOTE_PREFERENCES.includes(normalizedRemotePreference as (typeof VALID_REMOTE_PREFERENCES)[number])) {
            return NextResponse.json(
                { error: `Invalid remotePreference. Must be one of: ${VALID_REMOTE_PREFERENCES.join(", ")}` },
                { status: 400 }
            );
        }

        // Coerce salaryMin to integer or null
        const parsedSalary = salaryMin != null && salaryMin !== ""
            ? parseInt(String(salaryMin), 10)
            : null;
        const safeSalary = parsedSalary != null && !isNaN(parsedSalary) ? parsedSalary : null;
        if (safeSalary !== null && safeSalary < 0) {
            return NextResponse.json(
                { error: "salaryMin must be greater than or equal to 0" },
                { status: 400 }
            );
        }

        // Ensure arrays are arrays (not strings)
        const safeTargetTitles = sanitizeStringArray(targetTitles);
        const safeLocations = sanitizeStringArray(locations);
        const safeIndustries = sanitizeStringArray(industries);

        if (
            safeTargetTitles.length > MAX_PREFERENCE_ITEMS ||
            safeLocations.length > MAX_PREFERENCE_ITEMS ||
            safeIndustries.length > MAX_PREFERENCE_ITEMS
        ) {
            return NextResponse.json(
                { error: `Too many items. Each preference list supports up to ${MAX_PREFERENCE_ITEMS} entries.` },
                { status: 400 }
            );
        }

        const hasOversizedItem =
            [...safeTargetTitles, ...safeLocations, ...safeIndustries].some(
                (item) => item.length > MAX_PREFERENCE_ITEM_LENGTH
            );
        if (hasOversizedItem) {
            return NextResponse.json(
                { error: `Preference entries must be ${MAX_PREFERENCE_ITEM_LENGTH} characters or fewer.` },
                { status: 400 }
            );
        }

        const preferences = await prisma.jobPreferences.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                targetTitles: safeTargetTitles,
                locations: safeLocations,
                remotePreference: normalizedRemotePreference,
                salaryMin: safeSalary,
                salaryCurrency: currency,
                industries: safeIndustries,
            },
            update: {
                targetTitles: safeTargetTitles,
                locations: safeLocations,
                remotePreference: normalizedRemotePreference,
                salaryMin: safeSalary,
                salaryCurrency: currency,
                industries: safeIndustries,
            },
        });

        return NextResponse.json({ preferences });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("PUT /api/preferences error:", message, error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
