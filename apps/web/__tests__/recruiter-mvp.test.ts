import { describe, expect, it } from "vitest";
import {
    computeRecruiterMatchScore,
    derivePipelineStatusFromStage,
} from "@/lib/recruiter-mvp";

describe("recruiter mvp helpers", () => {
    it("computes higher scores when candidate and requisition overlap strongly", () => {
        const candidate =
            "Senior backend engineer with TypeScript, PostgreSQL, API design, and distributed systems";
        const requisition =
            "Hiring a backend engineer strong in TypeScript and PostgreSQL for API development";
        const lowFitRequisition =
            "Looking for a graphic designer focused on Figma and visual branding";

        const highScore = computeRecruiterMatchScore(candidate, requisition);
        const lowScore = computeRecruiterMatchScore(candidate, lowFitRequisition);

        expect(highScore).toBeGreaterThan(lowScore);
        expect(highScore).toBeGreaterThan(20);
    });

    it("derives active status for non-terminal stages", () => {
        const status = derivePipelineStatusFromStage("Interview", false);
        expect(status).toBe("ACTIVE");
    });

    it("derives hired status for terminal hired stage names", () => {
        const status = derivePipelineStatusFromStage("Hired", true);
        expect(status).toBe("HIRED");
    });

    it("derives rejected status for terminal rejected stage names", () => {
        const status = derivePipelineStatusFromStage("Rejected", true);
        expect(status).toBe("REJECTED");
    });
});
