import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/mobile/route";
import { clerkClient } from "@clerk/nextjs/server";
import { createMobileToken } from "@/lib/mobile-auth";

const mockUsers = {
    createUser: vi.fn(),
    getUserList: vi.fn(),
    verifyPassword: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clerkClient).mockResolvedValue({ users: mockUsers } as any);
});

describe("POST /api/auth/mobile", () => {
    it("returns 400 when email is missing", async () => {
        const request = new Request("http://localhost/api/auth/mobile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: "password123" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("required");
    });

    it("returns 400 when password is missing", async () => {
        const request = new Request("http://localhost/api/auth/mobile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "test@example.com" }),
        });

        const response = await POST(request);
        expect(response.status).toBe(400);
    });

    describe("sign-up flow", () => {
        it("creates a new user and returns token", async () => {
            vi.mocked(mockUsers.createUser).mockResolvedValue({
                id: "clerk_new_user",
            } as any);
            vi.mocked(createMobileToken).mockResolvedValue("new_jwt_token");

            const request = new Request("http://localhost/api/auth/mobile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "newuser@example.com",
                    password: "SecurePass123!",
                    action: "sign-up",
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.token).toBe("new_jwt_token");
            expect(data.userId).toBe("clerk_new_user");
            expect(data.email).toBe("newuser@example.com");

            expect(mockUsers.createUser).toHaveBeenCalledWith({
                emailAddress: ["newuser@example.com"],
                password: "SecurePass123!",
            });
        });

        it("returns 400 when sign-up fails (duplicate email)", async () => {
            vi.mocked(mockUsers.createUser).mockRejectedValue({
                errors: [{ message: "That email address is taken" }],
            });

            const request = new Request("http://localhost/api/auth/mobile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "existing@example.com",
                    password: "password123",
                    action: "sign-up",
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("taken");
        });
    });

    describe("sign-in flow", () => {
        it("signs in existing user and returns token", async () => {
            vi.mocked(mockUsers.getUserList).mockResolvedValue([
                {
                    id: "clerk_existing_user",
                    emailAddresses: [{ emailAddress: "user@example.com" }],
                },
            ] as any);
            vi.mocked(mockUsers.verifyPassword).mockResolvedValue({} as any);
            vi.mocked(createMobileToken).mockResolvedValue("signed_in_token");

            const request = new Request("http://localhost/api/auth/mobile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "user@example.com",
                    password: "CorrectPassword123!",
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.token).toBe("signed_in_token");
            expect(data.userId).toBe("clerk_existing_user");
        });

        it("returns 401 when user not found", async () => {
            vi.mocked(mockUsers.getUserList).mockResolvedValue([] as any);

            const request = new Request("http://localhost/api/auth/mobile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "nonexistent@example.com",
                    password: "password123",
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toContain("Invalid");
        });

        it("returns 401 when password is wrong", async () => {
            vi.mocked(mockUsers.getUserList).mockResolvedValue([
                { id: "clerk_user", emailAddresses: [] },
            ] as any);
            vi.mocked(mockUsers.verifyPassword).mockRejectedValue(
                new Error("Password incorrect")
            );

            const request = new Request("http://localhost/api/auth/mobile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "user@example.com",
                    password: "WrongPassword",
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toContain("Invalid");
        });

        it("defaults to sign-in when no action specified", async () => {
            vi.mocked(mockUsers.getUserList).mockResolvedValue([
                { id: "clerk_user", emailAddresses: [{ emailAddress: "user@example.com" }] },
            ] as any);
            vi.mocked(mockUsers.verifyPassword).mockResolvedValue({} as any);
            vi.mocked(createMobileToken).mockResolvedValue("token_123");

            const request = new Request("http://localhost/api/auth/mobile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "user@example.com",
                    password: "password123",
                    // no action field
                }),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
            // Should have called getUserList (sign-in flow), not createUser
            expect(mockUsers.getUserList).toHaveBeenCalled();
            expect(mockUsers.createUser).not.toHaveBeenCalled();
        });
    });
});
