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

        return NextResponse.json({
            preferences: preferences || null,
        });
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

        const preferences = await prisma.jobPreferences.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                targetTitles,
                locations,
                remotePreference,
                salaryMin: salaryMin ? parseInt(salaryMin, 10) : null,
                salaryCurrency: currency,
                industries,
            },
            update: {
                targetTitles,
                locations,
                remotePreference,
                salaryMin: salaryMin ? parseInt(salaryMin, 10) : null,
                salaryCurrency: currency,
                industries,
            },
        });

        return NextResponse.json({ preferences });
    } catch (error) {
        console.error("PUT /api/preferences error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
