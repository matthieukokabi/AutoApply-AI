const PHOTO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export function getPhotoUploadValidationError(
    file: Pick<File, "type" | "size"> | null | undefined
) {
    if (!file) {
        return null;
    }

    if (!file.type.startsWith("image/")) {
        return "Please select an image file.";
    }

    if (file.size > PHOTO_UPLOAD_MAX_BYTES) {
        return "Image must be under 5MB.";
    }

    return null;
}
