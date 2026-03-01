import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { APPLICATION_STATUSES } from "@/lib/utils";

/**
 * GET /api/applications/[id] — get a single application with full details
 */
export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const application = await prisma.application.findFirst({
            where: { id: params.id, userId: user.id },
            include: { job: true },
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        return NextResponse.json({ application });
    } catch (error) {
        console.error("GET /api/applications/[id] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * PATCH /api/applications/[id] — update application status (and optionally notes)
 * Body: { status: string, notes?: string }
 */
export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify ownership
        const existing = await prisma.application.findFirst({
            where: { id: params.id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        const body = await req.json();
        const { status, notes } = body;

        if (status && !APPLICATION_STATUSES.includes(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${APPLICATION_STATUSES.join(", ")}` },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (status) {
            updateData.status = status;
            if (status === "applied" && !existing.appliedAt) {
                updateData.appliedAt = new Date();
            }
        }
        if (notes !== undefined) {
            updateData.notes = notes;
        }

        const application = await prisma.application.update({
            where: { id: params.id },
            data: updateData,
            include: { job: true },
        });

        return NextResponse.json({ application });
    } catch (error) {
        console.error("PATCH /api/applications/[id] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
