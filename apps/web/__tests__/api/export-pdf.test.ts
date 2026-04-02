import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/export/pdf/route";
import { getAuthUser } from "@/lib/auth";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
};

describe("POST /api/export/pdf", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when unauthenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/export/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "cv", markdown: "# Test CV" }),
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    it("rejects invalid export type", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/export/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "invalid", markdown: "# Test CV" }),
        });

        const response = await POST(request);
        expect(response.status).toBe(400);
    });

    it("exports CV markdown to a PDF payload", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/export/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "cv",
                fileName: "candidate_cv",
                markdown: `# Jane Doe
**Senior Product Manager**
Zurich | jane@example.com | +41 79 123 45 67

## Summary
Experienced product manager.

## Skills
- Strategy
- Leadership`,
            }),
        });

        const response = await POST(request);
        const body = Buffer.from(await response.arrayBuffer());

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("application/pdf");
        expect(response.headers.get("Content-Disposition")).toContain("candidate_cv.pdf");
        expect(body.length).toBeGreaterThan(500);
    });

    it("exports cover letter markdown to a PDF payload", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/export/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "letter",
                fileName: "cover-letter",
                markdown: `# Motivation Letter

Dear Hiring Manager,

I am excited to apply for this role.

Sincerely,
Jane Doe`,
            }),
        });

        const response = await POST(request);
        const body = Buffer.from(await response.arrayBuffer());

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("application/pdf");
        expect(response.headers.get("Content-Disposition")).toContain("cover-letter.pdf");
        expect(body.length).toBeGreaterThan(500);
    });
});
