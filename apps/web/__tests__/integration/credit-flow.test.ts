import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as tailorPOST } from "@/app/api/tailor/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { sendCreditsLowEmail } from "@/lib/email";

/**
 * Integration tests for the credit consumption workflow:
 * tailor request → credit check → deduction → low-credit email → upgrade required
 */

const createMockUser = (overrides: any = {}) => ({
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    subscriptionStatus: "pro",
    creditsRemaining: 10,
    masterProfile: {
        id: "profile_1",
        rawText: "Experienced software engineer with 5 years of React and Node.js experience in enterprise applications.",
        structuredJson: { skills: ["React", "Node.js"] },
    },
    ...overrides,
});

const mockJob = {
    id: "job_1",
    externalId: "manual-123",
    title: "Developer",
    company: "Corp",
};

function createTailorRequest() {
    return new Request("http://localhost/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jobDescription: "Looking for a React developer with TypeScript and Node.js experience.",
            jobTitle: "React Developer",
            company: "Test Corp",
        }),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
        text: async () => "",
    } as any);
});

describe("Credit Flow Integration", () => {
    it("full flow: tailor → deduct → success (normal credits)", async () => {
        const user = createMockUser({ creditsRemaining: 5 });
        vi.mocked(getAuthUser).mockResolvedValue(user as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(user as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...user,
            creditsRemaining: 4,
        } as any);

        const response = await tailorPOST(createTailorRequest());
        expect(response.status).toBe(200);

        // Credit was deducted
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: { creditsRemaining: { decrement: 1 } },
        });

        // No low-credit email (still has 4)
        expect(sendCreditsLowEmail).not.toHaveBeenCalled();
    });

    it("full flow: tailor → deduct → low-credit email (credits drop to 1)", async () => {
        const user = createMockUser({ creditsRemaining: 2, subscriptionStatus: "pro" });
        vi.mocked(getAuthUser).mockResolvedValue(user as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(user as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...user,
            creditsRemaining: 1,
        } as any);

        const response = await tailorPOST(createTailorRequest());
        expect(response.status).toBe(200);

        // Low credit email was sent
        expect(sendCreditsLowEmail).toHaveBeenCalledWith(
            "test@example.com",
            "Test User",
            1
        );
    });

    it("full flow: tailor → deduct → low-credit email (credits drop to 0)", async () => {
        const user = createMockUser({ creditsRemaining: 1, subscriptionStatus: "free" });
        vi.mocked(getAuthUser).mockResolvedValue(user as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(user as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...user,
            creditsRemaining: 0,
        } as any);

        const response = await tailorPOST(createTailorRequest());
        expect(response.status).toBe(200);

        expect(sendCreditsLowEmail).toHaveBeenCalledWith(
            "test@example.com",
            "Test User",
            0
        );
    });

    it("blocks tailoring when free user has 0 credits", async () => {
        const user = createMockUser({ creditsRemaining: 0, subscriptionStatus: "free" });
        vi.mocked(getAuthUser).mockResolvedValue(user as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(user as any);

        const response = await tailorPOST(createTailorRequest());
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toContain("credits");

        // Nothing should have been created or deducted
        expect(prisma.job.upsert).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("unlimited users bypass credit checks entirely", async () => {
        const user = createMockUser({
            creditsRemaining: 0,
            subscriptionStatus: "unlimited",
        });
        vi.mocked(getAuthUser).mockResolvedValue(user as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(user as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);

        const response = await tailorPOST(createTailorRequest());
        expect(response.status).toBe(200);

        // No credit deduction for unlimited
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(sendCreditsLowEmail).not.toHaveBeenCalled();
    });

    it("handles concurrent requests correctly (sequential credit deduction)", async () => {
        // Simulate two requests with user at 2 credits
        const user = createMockUser({ creditsRemaining: 2, subscriptionStatus: "pro" });

        // First request
        vi.mocked(getAuthUser).mockResolvedValue(user as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(user as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValueOnce({
            ...user,
            creditsRemaining: 1,
        } as any);

        const response1 = await tailorPOST(createTailorRequest());
        expect(response1.status).toBe(200);
        expect(prisma.user.update).toHaveBeenCalledTimes(1);

        // Second request - user now has 1 credit
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            ...user,
            creditsRemaining: 1,
        } as any);
        vi.mocked(prisma.user.update).mockResolvedValueOnce({
            ...user,
            creditsRemaining: 0,
        } as any);

        const response2 = await tailorPOST(createTailorRequest());
        expect(response2.status).toBe(200);
        expect(prisma.user.update).toHaveBeenCalledTimes(2);
    });
});
