import { describe, expect, it } from "vitest";
import { getPhotoUploadValidationError } from "@/lib/photo-upload";

describe("photo upload validation", () => {
    it("accepts image files under the size limit", () => {
        const file = {
            type: "image/jpeg",
            size: 1024,
        } as Pick<File, "type" | "size">;

        expect(getPhotoUploadValidationError(file)).toBeNull();
    });

    it("rejects non-image files", () => {
        const file = {
            type: "application/pdf",
            size: 1024,
        } as Pick<File, "type" | "size">;

        expect(getPhotoUploadValidationError(file)).toBe(
            "Please select an image file."
        );
    });

    it("rejects oversized image files", () => {
        const file = {
            type: "image/png",
            size: 5 * 1024 * 1024 + 1,
        } as Pick<File, "type" | "size">;

        expect(getPhotoUploadValidationError(file)).toBe(
            "Image must be under 5MB."
        );
    });
});
