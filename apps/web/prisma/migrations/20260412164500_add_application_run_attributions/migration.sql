-- Add durable successful-run attribution for application persistence writes.
CREATE TABLE "application_run_attributions" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "n8nExecutionId" INTEGER,
    "schedulerSource" TEXT,
    "triggerKind" TEXT,
    "slotId" TEXT,
    "writeAction" TEXT NOT NULL,
    "persistedStatus" TEXT NOT NULL,
    "persistedTailoredCv" BOOLEAN NOT NULL,
    "persistedCoverLetter" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_run_attributions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_run_attributions_applicationId_createdAt_idx"
    ON "application_run_attributions"("applicationId", "createdAt");
CREATE INDEX "application_run_attributions_runId_createdAt_idx"
    ON "application_run_attributions"("runId", "createdAt");
CREATE INDEX "application_run_attributions_userId_createdAt_idx"
    ON "application_run_attributions"("userId", "createdAt");
CREATE INDEX "application_run_attributions_eventType_createdAt_idx"
    ON "application_run_attributions"("eventType", "createdAt");
CREATE INDEX "application_run_attributions_jobId_createdAt_idx"
    ON "application_run_attributions"("jobId", "createdAt");

ALTER TABLE "application_run_attributions"
    ADD CONSTRAINT "application_run_attributions_applicationId_fkey"
    FOREIGN KEY ("applicationId")
    REFERENCES "applications"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
