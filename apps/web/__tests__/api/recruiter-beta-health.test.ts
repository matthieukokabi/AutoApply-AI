import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/recruiter-beta", () => ({
    canAccessRecruiterBeta: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { canAccessRecruiterBeta } from "@/lib/recruiter-beta";
import { GET } from "@/app/api/recruiter-beta/health/route";

const prismaAny = prisma as any;

function seedHealthyCounts() {
    prismaAny.recruiterOrganization = {
        count: vi.fn().mockResolvedValue(1),
    };
    prismaAny.recruiterOrganizationMembership = {
        count: vi.fn().mockResolvedValue(1),
    };
    prismaAny.recruiterPipelineStage = {
        count: vi.fn().mockResolvedValue(6),
    };
    prismaAny.recruiterRequisition = {
        count: vi.fn().mockResolvedValue(2),
    };
    prismaAny.recruiterCandidate = {
        count: vi.fn().mockResolvedValue(5),
    };
    prismaAny.recruiterCandidatePipeline = {
        count: vi.fn((args?: { where?: { currentStageId?: null } }) =>
            Promise.resolve(args?.where?.currentStageId === null ? 0 : 4)
        ),
    };
    prismaAny.recruiterActivityLog = {
        count: vi.fn(
            (args?: { where?: { action?: { endsWith?: string } } }) =>
                Promise.resolve(
                    args?.where?.action?.endsWith === ".failed" ? 0 : 8
                )
        ),
    };
}

describe("GET /api/recruiter-beta/health", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.RECRUITER_BETA_HEALTH_TOKEN;
        vi.mocked(auth).mockResolvedValue({ userId: "clerk_user_1" } as any);
        vi.mocked(canAccessRecruiterBeta).mockReturnValue(true);
        seedHealthyCounts();
    });

    it("returns 401 when requester is not authenticated", async () => {
        vi.mocked(auth).mockResolvedValue({ userId: null } as any);

        const response = await GET(
            new Request("http://localhost/api/recruiter-beta/health")
        );
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toContain("Unauthorized");
    });

    it("returns 403 when recruiter beta access is denied", async () => {
        vi.mocked(canAccessRecruiterBeta).mockReturnValue(false);

        const response = await GET(
            new Request("http://localhost/api/recruiter-beta/health")
        );
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toContain("denied");
    });

    it("returns 401 when token auth is configured but missing", async () => {
        process.env.RECRUITER_BETA_HEALTH_TOKEN = "beta_secret";

        const response = await GET(
            new Request("http://localhost/api/recruiter-beta/health")
        );
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toContain("Unauthorized");
    });

    it("returns healthy metrics and noindex headers for authorized requests", async () => {
        process.env.RECRUITER_BETA_HEALTH_TOKEN = "beta_secret";

        const response = await GET(
            new Request("http://localhost/api/recruiter-beta/health", {
                headers: {
                    "x-recruiter-beta-health-token": "beta_secret",
                },
            })
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(response.headers.get("x-robots-tag")).toContain("noindex");
        expect(data.status).toBe("healthy");
        expect(data.alerts).toEqual([]);
        expect(data.metrics.organizations).toBe(1);
    });

    it("returns critical status when failures are detected", async () => {
        prismaAny.recruiterActivityLog = {
            count: vi.fn(
                (args?: { where?: { action?: { endsWith?: string } } }) =>
                    Promise.resolve(
                        args?.where?.action?.endsWith === ".failed" ? 2 : 0
                    )
            ),
        };

        const response = await GET(
            new Request("http://localhost/api/recruiter-beta/health")
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe("critical");
        expect(data.alerts.some((a: any) => a.code === "recruiter_workflow_failures")).toBe(
            true
        );
    });
});
