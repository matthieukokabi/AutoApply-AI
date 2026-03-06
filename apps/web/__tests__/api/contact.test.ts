import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/contact/route";

beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
});

describe("POST /api/contact", () => {
    it("sends contact form email successfully", async () => {
        const request = new Request("http://localhost/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "John Doe",
                email: "john@example.com",
                subject: "support",
                message: "I need help with my account settings.",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it("returns 400 when name is missing", async () => {
        const request = new Request("http://localhost/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "john@example.com",
                message: "Hello",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("required");
    });

    it("returns 400 when email is missing", async () => {
        const request = new Request("http://localhost/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "John",
                message: "Hello",
            }),
        });

        const response = await POST(request);
        expect(response.status).toBe(400);
    });

    it("returns 400 when message is missing", async () => {
        const request = new Request("http://localhost/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "John",
                email: "john@example.com",
            }),
        });

        const response = await POST(request);
        expect(response.status).toBe(400);
    });

    it("returns 400 for invalid email format", async () => {
        const request = new Request("http://localhost/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "John",
                email: "not-an-email",
                message: "Hello there",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("email");
    });

    it("returns 400 when message exceeds 5000 characters", async () => {
        const longMessage = "a".repeat(5001);
        const request = new Request("http://localhost/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "John",
                email: "john@example.com",
                message: longMessage,
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("too long");
    });

    it("handles missing subject gracefully (defaults to General)", async () => {
        const request = new Request("http://localhost/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Jane",
                email: "jane@example.com",
                message: "General question about your service.",
            }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
    });

    it("handles all valid subject types", async () => {
        const subjects = ["general", "support", "billing", "privacy", "feedback"];

        for (const subject of subjects) {
            vi.clearAllMocks();
            const request = new Request("http://localhost/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Jane",
                    email: "jane@example.com",
                    subject,
                    message: `Message about ${subject}`,
                }),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
        }
    });
});
