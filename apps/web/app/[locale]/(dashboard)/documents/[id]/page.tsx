import { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DocumentViewer } from "@/components/document-viewer";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({
        locale,
        namespace: "documentViewer.metadata",
    });

    return {
        title: t("title"),
        description: t("description"),
    };
}

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
    params: Promise<{ locale: string; id: string }>;
}) {
    const { userId } = await auth();
    const { id, locale } = await params;
    if (!userId) redirect(`/${locale}/sign-in`);

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
