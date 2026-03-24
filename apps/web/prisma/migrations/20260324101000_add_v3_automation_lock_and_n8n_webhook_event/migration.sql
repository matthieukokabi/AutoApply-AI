-- Additive v3 automation reliability tables.
-- Safe and reversible: creates two new tables and indexes only.

CREATE TABLE "automation_locks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_locks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "automation_locks_name_key" ON "automation_locks"("name");
CREATE INDEX "automation_locks_expiresAt_idx" ON "automation_locks"("expiresAt");

CREATE TABLE "n8n_webhook_events" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n8n_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "n8n_webhook_events_idempotencyKey_key" ON "n8n_webhook_events"("idempotencyKey");
CREATE INDEX "n8n_webhook_events_type_idx" ON "n8n_webhook_events"("type");
CREATE INDEX "n8n_webhook_events_createdAt_idx" ON "n8n_webhook_events"("createdAt");

-- Manual rollback (if required):
-- DROP TABLE IF EXISTS "n8n_webhook_events";
-- DROP TABLE IF EXISTS "automation_locks";
