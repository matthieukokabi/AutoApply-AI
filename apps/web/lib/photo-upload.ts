const PHOTO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export type PhotoUploadValidationError =
    | "invalidFileType"
    | "fileTooLarge";

export function getPhotoUploadValidationError(
    file: Pick<File, "type" | "size"> | null | undefined
): PhotoUploadValidationError | null {
    if (!file) {
        return null;
    }

    if (!file.type.startsWith("image/")) {
        return "invalidFileType";
    }

    if (file.size > PHOTO_UPLOAD_MAX_BYTES) {
        return "fileTooLarge";
    }

    return null;
}
