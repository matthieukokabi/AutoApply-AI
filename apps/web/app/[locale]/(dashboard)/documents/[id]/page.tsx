import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DocumentViewer } from "@/components/document-viewer";

export const metadata: Metadata = {
    title: "Document Viewer — AutoApply AI",
    description: "Compare your original CV with the AI-tailored version",
};

async function getApplication(clerkId: string, applicationId: string) {
    const user = await prisma.user.findFirst({
        where: { clerkId },
    });

    if (!user) return null;

    const application = await prisma.application.findFirst({
        where: { id: applicationId, userId: user.id },
        include: { job: true },
    });

    if (!application) return null;

    const masterProfile = await prisma.masterProfile.findFirst({
        where: { userId: user.id },
    });

    return { application, masterProfile };
}

export default async function DocumentViewerPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");
    const { id } = await params;

    const data = await getApplication(userId, id);

    if (!data) {
        notFound();
    }

    const { application, masterProfile } = data;
    const structured = masterProfile?.structuredJson as Record<string, unknown> | null;

    return (
        <DocumentViewer
            application={{
                id: application.id,
                tailoredCvMarkdown: application.tailoredCvMarkdown,
                coverLetterMarkdown: application.coverLetterMarkdown,
                compatibilityScore: application.compatibilityScore,
                atsKeywords: application.atsKeywords,
                matchingStrengths: application.matchingStrengths,
                gaps: application.gaps,
                recommendation: application.recommendation || "stretch",
                status: application.status,
            }}
            jobId={application.jobId}
            job={{
                title: application.job.title,
                company: application.job.company,
                location: application.job.location,
            }}
            jobDescription={application.job.description || undefined}
            photoBase64={(structured?.photoBase64 as string) || undefined}
            originalCvText={masterProfile?.rawText || undefined}
        />
    );
}
