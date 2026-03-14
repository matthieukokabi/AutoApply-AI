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

        // Coerce salaryMin to integer or null
        const parsedSalary = salaryMin != null && salaryMin !== ""
            ? parseInt(String(salaryMin), 10)
            : null;
        const safeSalary = parsedSalary != null && !isNaN(parsedSalary) ? parsedSalary : null;

        // Ensure arrays are arrays (not strings)
        const safeTargetTitles = Array.isArray(targetTitles) ? targetTitles : [];
        const safeLocations = Array.isArray(locations) ? locations : [];
        const safeIndustries = Array.isArray(industries) ? industries : [];

        const preferences = await prisma.jobPreferences.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                targetTitles: safeTargetTitles,
                locations: safeLocations,
                remotePreference,
                salaryMin: safeSalary,
                salaryCurrency: currency,
                industries: safeIndustries,
            },
            update: {
                targetTitles: safeTargetTitles,
                locations: safeLocations,
                remotePreference,
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
