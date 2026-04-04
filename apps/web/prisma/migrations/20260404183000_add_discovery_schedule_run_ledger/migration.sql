-- Additive ledger for externally scheduled discovery runs.
CREATE TABLE "discovery_schedule_runs" (
    "id" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "schedulerSource" TEXT NOT NULL,
    "triggerKind" TEXT NOT NULL DEFAULT 'scheduled',
    "workflowId" TEXT NOT NULL DEFAULT 'job-discovery-pipeline-v3',
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "runId" TEXT,
    "n8nExecutionId" INTEGER,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "usersSeen" INTEGER NOT NULL DEFAULT 0,
    "usersCanary" INTEGER NOT NULL DEFAULT 0,
    "usersProcessed" INTEGER NOT NULL DEFAULT 0,
    "usersFailed" INTEGER NOT NULL DEFAULT 0,
    "persistedApplications" INTEGER NOT NULL DEFAULT 0,
    "lockAcquired" BOOLEAN,
    "lockReleased" BOOLEAN,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_schedule_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discovery_schedule_runs_slotKey_triggerKind_key"
    ON "discovery_schedule_runs"("slotKey", "triggerKind");

CREATE UNIQUE INDEX "discovery_schedule_runs_runId_key"
    ON "discovery_schedule_runs"("runId");

CREATE INDEX "discovery_schedule_runs_requestedAt_idx"
    ON "discovery_schedule_runs"("requestedAt");

CREATE INDEX "discovery_schedule_runs_status_idx"
    ON "discovery_schedule_runs"("status");

CREATE INDEX "discovery_schedule_runs_workflowId_requestedAt_idx"
    ON "discovery_schedule_runs"("workflowId", "requestedAt");
