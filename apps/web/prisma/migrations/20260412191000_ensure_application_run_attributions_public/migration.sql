-- Ensure durable run attribution table exists in public schema, even if prior
-- migrations were applied under a non-public default schema.
DO $$
BEGIN
    IF to_regclass('public.application_run_attributions') IS NULL THEN
        CREATE TABLE "public"."application_run_attributions" (
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
    END IF;
END
$$;

-- If a same-named table exists in n8n schema from an earlier mismatched apply,
-- copy rows forward into the canonical public table.
DO $$
BEGIN
    IF to_regclass('n8n.application_run_attributions') IS NOT NULL THEN
        INSERT INTO "public"."application_run_attributions" (
            "id",
            "applicationId",
            "userId",
            "jobId",
            "eventType",
            "workflowId",
            "runId",
            "n8nExecutionId",
            "schedulerSource",
            "triggerKind",
            "slotId",
            "writeAction",
            "persistedStatus",
            "persistedTailoredCv",
            "persistedCoverLetter",
            "createdAt"
        )
        SELECT
            "id",
            "applicationId",
            "userId",
            "jobId",
            "eventType",
            "workflowId",
            "runId",
            "n8nExecutionId",
            "schedulerSource",
            "triggerKind",
            "slotId",
            "writeAction",
            "persistedStatus",
            "persistedTailoredCv",
            "persistedCoverLetter",
            "createdAt"
        FROM "n8n"."application_run_attributions"
        ON CONFLICT ("id") DO NOTHING;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "application_run_attributions_applicationId_createdAt_idx"
    ON "public"."application_run_attributions"("applicationId", "createdAt");
CREATE INDEX IF NOT EXISTS "application_run_attributions_runId_createdAt_idx"
    ON "public"."application_run_attributions"("runId", "createdAt");
CREATE INDEX IF NOT EXISTS "application_run_attributions_userId_createdAt_idx"
    ON "public"."application_run_attributions"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "application_run_attributions_eventType_createdAt_idx"
    ON "public"."application_run_attributions"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "application_run_attributions_jobId_createdAt_idx"
    ON "public"."application_run_attributions"("jobId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'application_run_attributions_applicationId_fkey'
          AND conrelid = 'public.application_run_attributions'::regclass
    ) THEN
        ALTER TABLE "public"."application_run_attributions"
            ADD CONSTRAINT "application_run_attributions_applicationId_fkey"
            FOREIGN KEY ("applicationId")
            REFERENCES "public"."applications"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;
END
$$;
