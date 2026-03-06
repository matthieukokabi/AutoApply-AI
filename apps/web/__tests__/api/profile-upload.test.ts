import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/profile/upload/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// Mock mammoth (ESM dynamic import in route)
vi.mock("mammoth", () => ({
    extractRawText: vi.fn(),
}));

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
};

const mockProfile = {
    id: "profile_1",
    userId: "user_1",
    rawText: "Experienced software engineer with extensive React and Node.js skills and background.",
    structuredJson: {
        contact: { name: "", email: "", phone: "", location: "" },
        summary: "",
        experience: [],
        education: [],
        skills: [],
    },
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("POST /api/profile/upload", () => {
    it("returns 401 for unauthenticated user", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/profile/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawText: "test" }),
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    describe("JSON body upload (paste)", () => {
        it("creates profile from pasted text", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
            vi.mocked(prisma.masterProfile.upsert).mockResolvedValue(mockProfile as any);

            const rawText = "Experienced software engineer with 5 years of React and Node.js development background and skills.";
            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText, fileName: "pasted-cv" }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toContain("uploaded successfully");
            expect(data.fileName).toBe("pasted-cv");

            expect(prisma.masterProfile.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: "user_1" },
                    create: expect.objectContaining({
                        userId: "user_1",
                        rawText,
                    }),
                })
            );
        });

        it("rejects text shorter than 50 characters", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText: "Too short CV" }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("too short");
        });

        it("rejects empty text", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText: "" }),
            });

            const response = await POST(request);
            expect(response.status).toBe(400);
        });
    });

    describe("multipart file upload", () => {
        it("handles TXT file upload", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
            vi.mocked(prisma.masterProfile.upsert).mockResolvedValue(mockProfile as any);

            const cvContent = "Senior Software Engineer\nExperienced full-stack developer with 8 years of experience in building web applications.";
            const file = new File([cvContent], "resume.txt", { type: "text/plain" });
            const formData = new FormData();
            formData.append("file", file);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.fileName).toBe("resume.txt");
        });

        it("rejects unsupported file types", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const file = new File(["content"], "resume.jpg", { type: "image/jpeg" });
            const formData = new FormData();
            formData.append("file", file);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Unsupported file type");
        });

        it("returns 400 when no file provided in multipart", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const formData = new FormData();
            // No file appended

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("No file");
        });

        it("handles PDF file upload (returns 500 due to binary mock limitation)", async () => {
            // Note: pdf-parse requires a real binary PDF buffer to work.
            // In unit tests with vitest module mocking, the require() call inside
            // the route gets the raw module. We test that the route properly
            // catches parse errors and returns 500 gracefully.
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const file = new File([Buffer.from("fake-pdf-content")], "resume.pdf", {
                type: "application/pdf",
            });
            const formData = new FormData();
            formData.append("file", file);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            const response = await POST(request);
            // pdf-parse will throw on non-PDF content, route catches it as 500
            expect(response.status).toBe(500);
        });

        it("handles DOCX file upload", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
            vi.mocked(prisma.masterProfile.upsert).mockResolvedValue(mockProfile as any);

            const mammoth = await import("mammoth");
            vi.mocked(mammoth.extractRawText).mockResolvedValue({
                value: "Senior Software Engineer with extensive experience in Java and microservices architecture.",
                messages: [],
            } as any);

            const file = new File([Buffer.from("fake-docx-content")], "resume.docx", {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });
            const formData = new FormData();
            formData.append("file", file);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
        });
    });
});
