import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/user — get current user info (subscription, credits, automation status)
 */
export async function GET(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                automationEnabled: user.automationEnabled,
                subscriptionStatus: user.subscriptionStatus,
                creditsRemaining: user.creditsRemaining,
            },
        });
    } catch (error) {
        console.error("GET /api/user error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * PATCH /api/user — update user settings (automation toggle)
 * Body: { automationEnabled: boolean }
 */
export async function PATCH(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { automationEnabled } = body;

        // Only pro/unlimited users can enable automation
        if (automationEnabled && user.subscriptionStatus === "free") {
            return NextResponse.json(
                { error: "Automation requires a Pro or Unlimited subscription" },
                { status: 403 }
            );
        }

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { automationEnabled: !!automationEnabled },
        });

        return NextResponse.json({
            user: {
                id: updated.id,
                automationEnabled: updated.automationEnabled,
                subscriptionStatus: updated.subscriptionStatus,
            },
        });
    } catch (error) {
        console.error("PATCH /api/user error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
