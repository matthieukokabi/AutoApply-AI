import { describe, it, expect, vi, beforeEach } from "vitest";
import { clerkClient } from "@clerk/nextjs/server";
import { GET, DELETE } from "@/app/api/account/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const mockUserWithData = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    subscriptionStatus: "pro",
    creditsRemaining: 50,
    automationEnabled: true,
    createdAt: new Date("2025-01-01"),
    masterProfile: {
        id: "profile_1",
        rawText: "My CV content",
        structuredJson: {},
    },
    preferences: {
        id: "pref_1",
        targetTitles: ["Engineer"],
        locations: ["Remote"],
    },
    applications: [
        {
            id: "app_1",
            status: "tailored",
            job: { title: "Developer", company: "Corp" },
        },
    ],
};

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    stripeCustomerId: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_account_deletion";
    process.env.CLERK_SECRET_KEY = "sk_test_clerk";
});

describe("GET /api/account (GDPR data export)", () => {
    it("exports all user data", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithData as any);

        const request = new Request("http://localhost/api/account");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.exportedAt).toBeDefined();
        expect(data.user.email).toBe("test@example.com");
        expect(data.masterProfile).toBeDefined();
        expect(data.preferences).toBeDefined();
        expect(data.applications).toHaveLength(1);
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/account");
        const response = await GET(request);
        expect(response.status).toBe(401);
    });

    it("returns 404 when user not found in database", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const request = new Request("http://localhost/api/account");
        const response = await GET(request);
        expect(response.status).toBe(404);
    });
});

describe("DELETE /api/account (GDPR data deletion)", () => {
    it("cancels orphaned billing, deletes payment data and identity, then deletes app data", async () => {
        const deleteClerkUser = vi.fn().mockResolvedValue({});
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(clerkClient).mockResolvedValue({
            users: { deleteUser: deleteClerkUser },
        } as any);
        vi.mocked(stripe.customers.list).mockResolvedValue({
            data: [
                {
                    id: "cus_orphaned",
                    email: "test@example.com",
                    deleted: false,
                },
            ],
        } as any);
        vi.mocked(stripe.subscriptions.list).mockResolvedValue({
            data: [
                { id: "sub_active", status: "active" },
                { id: "sub_already_cancelled", status: "canceled" },
            ],
        } as any);
        vi.mocked(stripe.subscriptions.cancel).mockResolvedValue({
            id: "sub_active",
            status: "canceled",
        } as any);
        vi.mocked(stripe.customers.del).mockResolvedValue({
            id: "cus_orphaned",
            deleted: true,
        } as any);
        vi.mocked(prisma.user.delete).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/account", { method: "DELETE" });
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toContain("deleted successfully");
        expect(stripe.customers.list).toHaveBeenCalledWith({
            email: "test@example.com",
            limit: 100,
        });
        expect(stripe.subscriptions.cancel).toHaveBeenCalledWith(
            "sub_active",
            { prorate: false }
        );
        expect(stripe.subscriptions.cancel).not.toHaveBeenCalledWith(
            "sub_already_cancelled",
            expect.anything()
        );
        expect(stripe.customers.del).toHaveBeenCalledWith("cus_orphaned");
        expect(deleteClerkUser).toHaveBeenCalledWith("clerk_test_user_123");
        expect(prisma.user.delete).toHaveBeenCalledWith({
            where: { id: "user_1" },
        });
        expect(vi.mocked(stripe.customers.del).mock.invocationCallOrder[0]).toBeLessThan(
            deleteClerkUser.mock.invocationCallOrder[0]
        );
        expect(deleteClerkUser.mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(prisma.user.delete).mock.invocationCallOrder[0]
        );
    });

    it("deduplicates the stored customer and exact email matches", async () => {
        const linkedUser = { ...mockUser, stripeCustomerId: "cus_linked" };
        vi.mocked(getAuthUser).mockResolvedValue(linkedUser as any);
        vi.mocked(stripe.customers.retrieve).mockResolvedValue({
            id: "cus_linked",
            email: "test@example.com",
            deleted: false,
        } as any);
        vi.mocked(stripe.customers.list).mockResolvedValue({
            data: [
                { id: "cus_linked", email: "test@example.com", deleted: false },
                { id: "cus_duplicate", email: "TEST@example.com", deleted: false },
                { id: "cus_wrong", email: "other@example.com", deleted: false },
            ],
        } as any);
        vi.mocked(stripe.subscriptions.list).mockResolvedValue({ data: [] } as any);
        vi.mocked(stripe.customers.del).mockResolvedValue({ deleted: true } as any);
        vi.mocked(prisma.user.delete).mockResolvedValue(linkedUser as any);

        const response = await DELETE(
            new Request("http://localhost/api/account", { method: "DELETE" })
        );

        expect(response.status).toBe(200);
        expect(stripe.customers.del).toHaveBeenCalledTimes(2);
        expect(stripe.customers.del).toHaveBeenCalledWith("cus_linked");
        expect(stripe.customers.del).toHaveBeenCalledWith("cus_duplicate");
        expect(stripe.customers.del).not.toHaveBeenCalledWith("cus_wrong");
    });

    it("does not delete Clerk or app data when billing cleanup fails", async () => {
        const deleteClerkUser = vi.fn();
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(clerkClient).mockResolvedValue({
            users: { deleteUser: deleteClerkUser },
        } as any);
        vi.mocked(stripe.customers.list).mockRejectedValue(
            new Error("stripe unavailable")
        );

        const response = await DELETE(
            new Request("http://localhost/api/account", { method: "DELETE" })
        );

        expect(response.status).toBe(500);
        expect(deleteClerkUser).not.toHaveBeenCalled();
        expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("does not delete app data when Clerk deletion fails", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(stripe.customers.list).mockResolvedValue({ data: [] } as any);
        vi.mocked(clerkClient).mockResolvedValue({
            users: {
                deleteUser: vi.fn().mockRejectedValue(new Error("clerk unavailable")),
            },
        } as any);

        const response = await DELETE(
            new Request("http://localhost/api/account", { method: "DELETE" })
        );

        expect(response.status).toBe(500);
        expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/account", { method: "DELETE" });
        const response = await DELETE(request);
        expect(response.status).toBe(401);
    });
});
