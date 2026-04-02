import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { APPLICATION_STATUSES } from "@/lib/utils";

const MAX_APPLICATION_NOTES_LENGTH = 5000;
const MAX_TAILORED_CV_MARKDOWN_LENGTH = 200000;
const MAX_COVER_LETTER_MARKDOWN_LENGTH = 80000;
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
 * PATCH /api/applications/[id] — update status, notes, and/or generated docs
 * Body: { status?: string, notes?: string | null, tailoredCvMarkdown?: string | null, coverLetterMarkdown?: string | null }
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
        const { status, notes, tailoredCvMarkdown, coverLetterMarkdown } = body;

        if (
            status === undefined &&
            notes === undefined &&
            tailoredCvMarkdown === undefined &&
            coverLetterMarkdown === undefined
        ) {
            return NextResponse.json(
                {
                    error:
                        "At least one of status, notes, tailoredCvMarkdown, or coverLetterMarkdown must be provided",
                },
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

        if (
            tailoredCvMarkdown !== undefined &&
            tailoredCvMarkdown !== null &&
            typeof tailoredCvMarkdown !== "string"
        ) {
            return NextResponse.json(
                { error: "tailoredCvMarkdown must be a string or null" },
                { status: 400 }
            );
        }

        if (
            coverLetterMarkdown !== undefined &&
            coverLetterMarkdown !== null &&
            typeof coverLetterMarkdown !== "string"
        ) {
            return NextResponse.json(
                { error: "coverLetterMarkdown must be a string or null" },
                { status: 400 }
            );
        }

        if (
            typeof tailoredCvMarkdown === "string" &&
            tailoredCvMarkdown.length > MAX_TAILORED_CV_MARKDOWN_LENGTH
        ) {
            return NextResponse.json(
                {
                    error: `tailoredCvMarkdown exceeds maximum length of ${MAX_TAILORED_CV_MARKDOWN_LENGTH} characters`,
                },
                { status: 400 }
            );
        }

        if (
            typeof coverLetterMarkdown === "string" &&
            coverLetterMarkdown.length > MAX_COVER_LETTER_MARKDOWN_LENGTH
        ) {
            return NextResponse.json(
                {
                    error: `coverLetterMarkdown exceeds maximum length of ${MAX_COVER_LETTER_MARKDOWN_LENGTH} characters`,
                },
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
        if (tailoredCvMarkdown !== undefined) {
            updateData.tailoredCvMarkdown = tailoredCvMarkdown;
        }
        if (coverLetterMarkdown !== undefined) {
            updateData.coverLetterMarkdown = coverLetterMarkdown;
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
