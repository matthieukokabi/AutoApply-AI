import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { getAuthUser } from "@/lib/auth";
import { canAccessRecruiterBeta } from "@/lib/recruiter-beta";
import {
    createRecruiterRequisition,
    ensureRecruiterWorkspaceForOwner,
    getRecruiterWorkspaceForUser,
    importRecruiterCandidate,
    listRecruiterDashboardData,
    matchCandidateToRequisition,
    moveCandidatePipelineStage,
} from "@/lib/recruiter-mvp";
import { toAbsoluteAppUrl } from "@/lib/site-url";

export const metadata: Metadata = {
    title: "Recruiter Labs Beta | AutoApply AI",
    description: "Private recruiter beta workspace for AutoApply AI.",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
            index: false,
            follow: false,
            noarchive: true,
            nosnippet: true,
            noimageindex: true,
        },
    },
};

export default async function RecruiterLabsPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    if (!canAccessRecruiterBeta(userId)) {
        notFound();
    }

    const dbUser = await getAuthUser();
    if (!dbUser) {
        redirect("/sign-in");
    }

    async function initializeWorkspaceAction() {
        "use server";
        const user = await getAuthUser();
        if (!user) {
            redirect("/sign-in");
        }

        await ensureRecruiterWorkspaceForOwner({
            userId: user.id,
            email: user.email,
            displayName: user.name,
        });
        revalidatePath("/labs/recruiter");
    }

    async function createRequisitionAction(formData: FormData) {
        "use server";
        const user = await getAuthUser();
        if (!user) {
            redirect("/sign-in");
        }

        const organizationId = String(formData.get("organizationId") || "").trim();
        const teamId = String(formData.get("teamId") || "").trim();
        const title = String(formData.get("title") || "").trim();
        const description = String(formData.get("description") || "").trim();
        const department = String(formData.get("department") || "").trim();
        const location = String(formData.get("location") || "").trim();
        const employmentType = String(formData.get("employmentType") || "").trim();

        if (!organizationId || !title || !description) {
            return;
        }

        await createRecruiterRequisition({
            userId: user.id,
            organizationId,
            teamId: teamId || undefined,
            title,
            description,
            department: department || undefined,
            location: location || undefined,
            employmentType: employmentType || undefined,
        });
        revalidatePath("/labs/recruiter");
    }

    async function importCandidateAction(formData: FormData) {
        "use server";
        const user = await getAuthUser();
        if (!user) {
            redirect("/sign-in");
        }

        const organizationId = String(formData.get("organizationId") || "").trim();
        const fullName = String(formData.get("fullName") || "").trim();
        const email = String(formData.get("email") || "").trim();
        const phone = String(formData.get("phone") || "").trim();
        const location = String(formData.get("location") || "").trim();
        const headline = String(formData.get("headline") || "").trim();
        const profileText = String(formData.get("profileText") || "").trim();

        if (!organizationId || !fullName) {
            return;
        }

        await importRecruiterCandidate({
            userId: user.id,
            organizationId,
            fullName,
            email: email || undefined,
            phone: phone || undefined,
            location: location || undefined,
            headline: headline || undefined,
            profileText: profileText || undefined,
        });
        revalidatePath("/labs/recruiter");
    }

    async function matchCandidateAction(formData: FormData) {
        "use server";
        const user = await getAuthUser();
        if (!user) {
            redirect("/sign-in");
        }

        const organizationId = String(formData.get("organizationId") || "").trim();
        const candidateId = String(formData.get("candidateId") || "").trim();
        const requisitionId = String(formData.get("requisitionId") || "").trim();

        if (!organizationId || !candidateId || !requisitionId) {
            return;
        }

        await matchCandidateToRequisition({
            userId: user.id,
            organizationId,
            candidateId,
            requisitionId,
        });
        revalidatePath("/labs/recruiter");
    }

    async function moveStageAction(formData: FormData) {
        "use server";
        const user = await getAuthUser();
        if (!user) {
            redirect("/sign-in");
        }

        const organizationId = String(formData.get("organizationId") || "").trim();
        const pipelineId = String(formData.get("pipelineId") || "").trim();
        const stageId = String(formData.get("stageId") || "").trim();

        if (!organizationId || !pipelineId || !stageId) {
            return;
        }

        await moveCandidatePipelineStage({
            userId: user.id,
            organizationId,
            pipelineId,
            stageId,
        });
        revalidatePath("/labs/recruiter");
    }

    const workspace = await getRecruiterWorkspaceForUser(dbUser.id);
    if (!workspace) {
        return (
            <main className="mx-auto max-w-4xl px-6 py-16">
                <Card>
                    <CardHeader>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Recruiter beta
                        </p>
                        <CardTitle>Initialize Recruiter Workspace</CardTitle>
                        <CardDescription>
                            Create your isolated recruiter workspace and seed
                            default team + pipeline stages.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={initializeWorkspaceAction}>
                            <Button type="submit">Initialize Workspace</Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        );
    }

    const dashboard = await listRecruiterDashboardData(workspace.organizationId);
    const adminTrackingUrl = toAbsoluteAppUrl("/labs/recruiter");
    const teamOptions = dashboard.teams;
    const stageOptions = dashboard.stages;

    return (
        <main className="mx-auto max-w-7xl space-y-6 px-6 py-10">
            <Card>
                <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Recruiter beta admin
                    </p>
                    <CardTitle className="text-3xl">
                        Recruiter Operations Dashboard
                    </CardTitle>
                    <CardDescription>
                        Private tracking URL:{" "}
                        <a
                            href={adminTrackingUrl}
                            className="font-mono text-xs underline underline-offset-4"
                        >
                            {adminTrackingUrl}
                        </a>
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase text-muted-foreground">
                            Team Members
                        </p>
                        <p className="text-2xl font-semibold">
                            {dashboard.members.length}
                        </p>
                    </div>
                    <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase text-muted-foreground">
                            Requisitions
                        </p>
                        <p className="text-2xl font-semibold">
                            {dashboard.requisitions.length}
                        </p>
                    </div>
                    <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase text-muted-foreground">
                            Candidates
                        </p>
                        <p className="text-2xl font-semibold">
                            {dashboard.candidates.length}
                        </p>
                    </div>
                    <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase text-muted-foreground">
                            Pipeline Cards
                        </p>
                        <p className="text-2xl font-semibold">
                            {dashboard.pipelines.length}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <section className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">
                            Create Requisition
                        </CardTitle>
                        <CardDescription>
                            Add an open role for recruiter matching.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={createRequisitionAction} className="space-y-3">
                            <input
                                type="hidden"
                                name="organizationId"
                                value={workspace.organizationId}
                            />
                            <input
                                name="title"
                                required
                                placeholder="Role title"
                                className="w-full rounded-md border px-3 py-2 text-sm"
                            />
                            <textarea
                                name="description"
                                required
                                placeholder="Role description"
                                className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                    name="department"
                                    placeholder="Department"
                                    className="w-full rounded-md border px-3 py-2 text-sm"
                                />
                                <input
                                    name="location"
                                    placeholder="Location"
                                    className="w-full rounded-md border px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                    name="employmentType"
                                    placeholder="Employment type"
                                    className="w-full rounded-md border px-3 py-2 text-sm"
                                />
                                <select
                                    name="teamId"
                                    className="w-full rounded-md border px-3 py-2 text-sm"
                                    defaultValue=""
                                >
                                    <option value="">No team</option>
                                    {teamOptions.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Button type="submit">Create Requisition</Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">
                            Manual Candidate Import
                        </CardTitle>
                        <CardDescription>
                            Add candidate profile information manually.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={importCandidateAction} className="space-y-3">
                            <input
                                type="hidden"
                                name="organizationId"
                                value={workspace.organizationId}
                            />
                            <input
                                name="fullName"
                                required
                                placeholder="Candidate full name"
                                className="w-full rounded-md border px-3 py-2 text-sm"
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="Email"
                                    className="w-full rounded-md border px-3 py-2 text-sm"
                                />
                                <input
                                    name="phone"
                                    placeholder="Phone"
                                    className="w-full rounded-md border px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <input
                                    name="location"
                                    placeholder="Location"
                                    className="w-full rounded-md border px-3 py-2 text-sm"
                                />
                                <input
                                    name="headline"
                                    placeholder="Headline"
                                    className="w-full rounded-md border px-3 py-2 text-sm"
                                />
                            </div>
                            <textarea
                                name="profileText"
                                placeholder="Candidate summary / profile text"
                                className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
                            />
                            <Button type="submit">Import Candidate</Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">
                            Match Candidate to Requisition
                        </CardTitle>
                        <CardDescription>
                            Creates/updates a pipeline card with automatic score.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={matchCandidateAction} className="space-y-3">
                            <input
                                type="hidden"
                                name="organizationId"
                                value={workspace.organizationId}
                            />
                            <select
                                name="candidateId"
                                required
                                className="w-full rounded-md border px-3 py-2 text-sm"
                                defaultValue=""
                            >
                                <option value="" disabled>
                                    Select candidate
                                </option>
                                {dashboard.candidates.map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                        {candidate.fullName}
                                    </option>
                                ))}
                            </select>
                            <select
                                name="requisitionId"
                                required
                                className="w-full rounded-md border px-3 py-2 text-sm"
                                defaultValue=""
                            >
                                <option value="" disabled>
                                    Select requisition
                                </option>
                                {dashboard.requisitions.map((requisition) => (
                                    <option
                                        key={requisition.id}
                                        value={requisition.id}
                                    >
                                        {requisition.title}
                                    </option>
                                ))}
                            </select>
                            <Button type="submit">Run Match</Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">
                            Move Candidate Stage
                        </CardTitle>
                        <CardDescription>
                            Advances candidate cards through pipeline.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={moveStageAction} className="space-y-3">
                            <input
                                type="hidden"
                                name="organizationId"
                                value={workspace.organizationId}
                            />
                            <select
                                name="pipelineId"
                                required
                                className="w-full rounded-md border px-3 py-2 text-sm"
                                defaultValue=""
                            >
                                <option value="" disabled>
                                    Select candidate pipeline card
                                </option>
                                {dashboard.pipelines.map((pipeline) => (
                                    <option key={pipeline.id} value={pipeline.id}>
                                        {pipeline.candidate.fullName} -&gt;{" "}
                                        {pipeline.requisition.title}
                                    </option>
                                ))}
                            </select>
                            <select
                                name="stageId"
                                required
                                className="w-full rounded-md border px-3 py-2 text-sm"
                                defaultValue=""
                            >
                                <option value="" disabled>
                                    Select target stage
                                </option>
                                {stageOptions.map((stage) => (
                                    <option key={stage.id} value={stage.id}>
                                        {stage.position}. {stage.name}
                                    </option>
                                ))}
                            </select>
                            <Button type="submit">Move Stage</Button>
                        </form>
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Pipeline Board</CardTitle>
                        <CardDescription>
                            Live recruiter pipeline cards and scores.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {dashboard.pipelines.length === 0 ? (
                            <p className="text-muted-foreground">
                                No candidate matches yet.
                            </p>
                        ) : (
                            dashboard.pipelines.map((pipeline) => (
                                <div
                                    key={pipeline.id}
                                    className="rounded-md border p-3"
                                >
                                    <p className="font-medium">
                                        {pipeline.candidate.fullName}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {pipeline.requisition.title}
                                    </p>
                                    <p>
                                        Stage:{" "}
                                        {pipeline.currentStage?.name || "Unassigned"}
                                    </p>
                                    <p>Score: {pipeline.matchScore ?? 0}</p>
                                    <p>Status: {pipeline.status}</p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Activity Log</CardTitle>
                        <CardDescription>
                            Auditable recruiter actions in this workspace.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {dashboard.activityLogs.length === 0 ? (
                            <p className="text-muted-foreground">
                                No activity yet.
                            </p>
                        ) : (
                            dashboard.activityLogs.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="rounded-md border p-3"
                                >
                                    <p className="font-medium">{entry.action}</p>
                                    <p className="text-muted-foreground">
                                        {entry.entityType} · {entry.entityId}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {entry.actorUser?.email || "system"} ·{" "}
                                        {entry.createdAt.toISOString()}
                                    </p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
