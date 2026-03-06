import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/cron/weekly-digest/route";
import { prisma } from "@/lib/prisma";
import { sendWeeklyDigestEmail } from "@/lib/email";

const mockUsers = [
    {
        id: "user_1",
        email: "active@example.com",
        name: "Active User",
        automationEnabled: true,
        applications: [
            {
                id: "app_1",
                status: "tailored",
                compatibilityScore: 85,
                createdAt: new Date(),
                job: { title: "React Developer", company: "Tech Corp" },
            },
            {
                id: "app_2",
                status: "applied",
                compatibilityScore: 92,
                createdAt: new Date(),
                job: { title: "Frontend Engineer", company: "StartupCo" },
            },
            {
                id: "app_3",
                status: "discovered",
                compatibilityScore: 70,
                createdAt: new Date(),
                job: { title: "Full Stack Dev", company: "BigCo" },
            },
        ],
    },
    {
        id: "user_2",
        email: "inactive@example.com",
        name: "Inactive User",
        automationEnabled: true,
        applications: [], // No activity this week
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test_cron_secret";
});

describe("POST /api/cron/weekly-digest", () => {
    it("returns 401 for missing authorization", async () => {
        const request = new Request("http://localhost/api/cron/weekly-digest", {
            method: "POST",
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    it("returns 401 for invalid cron secret", async () => {
        const request = new Request("http://localhost/api/cron/weekly-digest", {
            method: "POST",
            headers: { authorization: "Bearer wrong_secret" },
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    it("sends digest to users with activity", async () => {
        vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

        const request = new Request("http://localhost/api/cron/weekly-digest", {
            method: "POST",
            headers: { authorization: "Bearer test_cron_secret" },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.emailsSent).toBe(1); // Only user_1 has applications
        expect(data.totalUsers).toBe(2);
    });

    it("calculates correct stats for digest email", async () => {
        vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

        const request = new Request("http://localhost/api/cron/weekly-digest", {
            method: "POST",
            headers: { authorization: "Bearer test_cron_secret" },
        });

        await POST(request);

        expect(sendWeeklyDigestEmail).toHaveBeenCalledWith(
            "active@example.com",
            "Active User",
            expect.objectContaining({
                newJobsCount: 3,
                tailoredCount: 2, // tailored + applied
                appliedCount: 1,
                avgScore: 82, // Math.round((85 + 92 + 70) / 3) = 82
                topJobs: expect.arrayContaining([
                    expect.objectContaining({ title: "React Developer" }),
                ]),
            })
        );
    });

    it("skips users with no applications", async () => {
        vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any);

        const request = new Request("http://localhost/api/cron/weekly-digest", {
            method: "POST",
            headers: { authorization: "Bearer test_cron_secret" },
        });

        await POST(request);

        // sendWeeklyDigestEmail should only be called for user_1 (who has applications)
        expect(sendWeeklyDigestEmail).toHaveBeenCalledTimes(1);
        expect(sendWeeklyDigestEmail).not.toHaveBeenCalledWith(
            "inactive@example.com",
            expect.anything(),
            expect.anything()
        );
    });

    it("continues sending to other users if one email fails", async () => {
        const usersWithMultipleActive = [
            mockUsers[0],
            {
                id: "user_3",
                email: "another@example.com",
                name: "Another User",
                applications: [
                    {
                        id: "app_4",
                        status: "tailored",
                        compatibilityScore: 78,
                        createdAt: new Date(),
                        job: { title: "Backend Dev", company: "ServerCo" },
                    },
                ],
            },
        ];

        vi.mocked(prisma.user.findMany).mockResolvedValue(usersWithMultipleActive as any);
        // First call succeeds, second call fails
        vi.mocked(sendWeeklyDigestEmail)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("Email failed"));

        const request = new Request("http://localhost/api/cron/weekly-digest", {
            method: "POST",
            headers: { authorization: "Bearer test_cron_secret" },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.emailsSent).toBe(1); // Only first succeeded
        expect(sendWeeklyDigestEmail).toHaveBeenCalledTimes(2);
    });

    it("handles empty user list gracefully", async () => {
        vi.mocked(prisma.user.findMany).mockResolvedValue([]);

        const request = new Request("http://localhost/api/cron/weekly-digest", {
            method: "POST",
            headers: { authorization: "Bearer test_cron_secret" },
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.emailsSent).toBe(0);
        expect(data.totalUsers).toBe(0);
    });
});
