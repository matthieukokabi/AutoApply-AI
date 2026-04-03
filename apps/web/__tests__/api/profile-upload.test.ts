import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/profile/upload/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const { mockPdfParse } = vi.hoisted(() => ({
    mockPdfParse: vi.fn(),
}));

// Mock pdf-parse v1 API (ESM dynamic import in route)
vi.mock("pdf-parse/lib/pdf-parse.js", () => ({
    default: mockPdfParse,
}));

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
    mockPdfParse.mockResolvedValue({
        text: "Experienced software engineer with 10 years of delivering enterprise applications and cloud migrations.",
    });
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

        it("rejects text payloads that exceed max length", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText: "a".repeat(200001) }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("too long");
            expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
        });

        it("returns 400 for invalid JSON upload payloads", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{invalid-json",
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Invalid upload payload");
            expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
        });
    });

    describe("multipart file upload", () => {
        it("returns 400 when multipart payload cannot be parsed", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                headers: { "Content-Type": "multipart/form-data; boundary=test-boundary" },
                body: "--test-boundary--",
            });
            Object.defineProperty(request, "formData", {
                value: vi.fn().mockRejectedValueOnce(new TypeError("Failed to parse body as FormData")),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Could not process this upload payload");
            expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
        });

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

        it("returns 413 for files larger than 5MB", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "resume.txt", {
                type: "text/plain",
            });
            const formData = new FormData();
            formData.append("file", file);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(413);
            expect(data.error).toContain("too large");
            expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
        });

        it("rejects invalid PDF payloads quickly", async () => {
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
            const data = await response.json();
            expect(response.status).toBe(400);
            expect(data.error).toContain("Invalid PDF");
        });

        it("handles PDF file upload via pdfjs-dist text extraction", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
            vi.mocked(prisma.masterProfile.upsert).mockResolvedValue(mockProfile as any);

            const file = new File([Buffer.from("%PDF-1.7 test-pdf-content")], "resume.pdf", {
                type: "application/pdf",
            });
            const formData = new FormData();
            formData.append("file", file);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.fileName).toBe("resume.pdf");
            expect(mockPdfParse).toHaveBeenCalledOnce();
        });

        it("returns 400 when PDF parser cannot extract text", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
            mockPdfParse.mockRejectedValueOnce(new Error("bad pdf"));

            const file = new File([Buffer.from("%PDF-1.7 broken-content")], "resume.pdf", {
                type: "application/pdf",
            });
            const formData = new FormData();
            formData.append("file", file);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Unable to read this PDF");
            expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
        });

        it("returns 400 when PDF runtime lacks DOM/canvas support", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
            mockPdfParse.mockRejectedValueOnce(new ReferenceError("DOMMatrix is not defined"));

            const file = new File([Buffer.from("%PDF-1.7 no-dommatrix")], "resume.pdf", {
                type: "application/pdf",
            });
            const formData = new FormData();
            formData.append("file", file);

            const response = await POST(
                new Request("http://localhost/api/profile/upload", {
                    method: "POST",
                    body: formData,
                })
            );
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Unable to read this PDF");
            expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
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

        it("returns 400 when file bytes cannot be read", async () => {
            vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

            const unreadableFile = new File([Buffer.from("%PDF-1.7 unreadable-content")], "resume.pdf", {
                type: "application/pdf",
            });
            const formData = new FormData();
            formData.append("file", unreadableFile);

            const request = new Request("http://localhost/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            const arrayBufferSpy = vi
                .spyOn(File.prototype, "arrayBuffer")
                .mockRejectedValueOnce(new Error("file read failed"));
            const response = await POST(request);
            const data = await response.json();
            arrayBufferSpy.mockRestore();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Could not read this file");
            expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
        });
    });

    it("returns 429 when one IP exceeds upload request limits", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.masterProfile.upsert).mockResolvedValue(mockProfile as any);

        const headers = {
            "Content-Type": "application/json",
            "x-forwarded-for": "198.51.100.99",
        };

        for (let i = 0; i < 6; i += 1) {
            const response = await POST(
                new Request("http://localhost/api/profile/upload", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        rawText:
                            "Experienced software engineer with full-stack delivery background and strong TypeScript expertise.",
                    }),
                })
            );

            expect(response.status).toBe(200);
        }

        const limitedResponse = await POST(
            new Request("http://localhost/api/profile/upload", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    rawText:
                        "Experienced software engineer with full-stack delivery background and strong TypeScript expertise.",
                }),
            })
        );
        const data = await limitedResponse.json();

        expect(limitedResponse.status).toBe(429);
        expect(data.error).toContain("Too many upload attempts");
    });
});
