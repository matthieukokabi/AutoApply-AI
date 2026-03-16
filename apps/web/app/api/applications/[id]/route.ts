import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { APPLICATION_STATUSES } from "@/lib/utils";

const MAX_APPLICATION_NOTES_LENGTH = 5000;
type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

function isApplicationStatus(value: string): value is ApplicationStatus {
    return APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

/**
 * GET /api/applications/[id] — get a single application with full details
 */
export async function GET(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { id } = await context.params;

        const application = await prisma.application.findFirst({
            where: { id, userId: user.id },
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
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { id } = await context.params;

        // Verify ownership
        const existing = await prisma.application.findFirst({
            where: { id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        const body = await req.json();
        const { status, notes } = body;

        if (status === undefined && notes === undefined) {
            return NextResponse.json(
                { error: "At least one of status or notes must be provided" },
                { status: 400 }
            );
        }

        if (status !== undefined && typeof status !== "string") {
            return NextResponse.json(
                { error: "status must be a string" },
                { status: 400 }
            );
        }

        if (typeof status === "string" && !isApplicationStatus(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${APPLICATION_STATUSES.join(", ")}` },
                { status: 400 }
            );
        }

        if (notes !== undefined && notes !== null && typeof notes !== "string") {
            return NextResponse.json(
                { error: "notes must be a string or null" },
                { status: 400 }
            );
        }

        if (typeof notes === "string" && notes.length > MAX_APPLICATION_NOTES_LENGTH) {
            return NextResponse.json(
                { error: `notes exceeds maximum length of ${MAX_APPLICATION_NOTES_LENGTH} characters` },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (status !== undefined) {
            updateData.status = status;
            if (status === "applied" && !existing.appliedAt) {
                updateData.appliedAt = new Date();
            }
        }
        if (notes !== undefined) {
            updateData.notes = notes;
        }

        const application = await prisma.application.update({
            where: { id },
            data: updateData,
            include: { job: true },
        });

        return NextResponse.json({ application });
    } catch (error) {
        console.error("PATCH /api/applications/[id] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
