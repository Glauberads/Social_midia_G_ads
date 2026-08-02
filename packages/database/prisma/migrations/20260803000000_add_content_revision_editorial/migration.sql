-- CreateEnum
CREATE TYPE "RevisionSource" AS ENUM ('AI_GENERATED', 'MANUAL_EDIT', 'REGENERATED');
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "ContentRevision" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "contentRequestId" UUID NOT NULL,
  "generatedContentId" UUID,
  "createdById" UUID NOT NULL,
  "source" "RevisionSource" NOT NULL,
  "caption" TEXT NOT NULL,
  "callToAction" TEXT NOT NULL,
  "hashtags" TEXT[] NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "rejectionReason" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentRevision_contentRequestId_version_key" ON "ContentRevision"("contentRequestId", "version");
CREATE UNIQUE INDEX "ContentRevision_one_active_draft_key" ON "ContentRevision"("contentRequestId") WHERE status = 'DRAFT';
CREATE INDEX "ContentRevision_tenantId_contentRequestId_status_idx" ON "ContentRevision"("tenantId", "contentRequestId", "status");
CREATE INDEX "ContentRevision_tenantId_createdAt_idx" ON "ContentRevision"("tenantId", "createdAt");
CREATE INDEX "ContentRevision_contentRequestId_createdAt_idx" ON "ContentRevision"("contentRequestId", "createdAt");
CREATE INDEX "ContentRevision_generatedContentId_idx" ON "ContentRevision"("generatedContentId");
CREATE INDEX "ContentRevision_createdById_idx" ON "ContentRevision"("createdById");
CREATE INDEX "ContentRevision_approvedById_idx" ON "ContentRevision"("approvedById");

ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_contentRequestId_fkey" FOREIGN KEY ("contentRequestId") REFERENCES "ContentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_generatedContentId_fkey" FOREIGN KEY ("generatedContentId") REFERENCES "GeneratedContent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill technical versions without overwriting generated content.
WITH ranked AS (
  SELECT generated.*, request.status AS request_status,
    ROW_NUMBER() OVER (PARTITION BY generated."contentRequestId" ORDER BY generated.version DESC) AS recency
  FROM public."GeneratedContent" generated
  JOIN public."ContentRequest" request ON request.id = generated."contentRequestId" AND request."tenantId" = generated."tenantId"
)
INSERT INTO public."ContentRevision" (
  id, "tenantId", "contentRequestId", "generatedContentId", "createdById", source,
  caption, "callToAction", hashtags, version, status, "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), ranked."tenantId", ranked."contentRequestId", ranked.id, request."createdById",
  CASE WHEN ranked.version = 1 THEN 'AI_GENERATED'::"RevisionSource" ELSE 'REGENERATED'::"RevisionSource" END,
  ranked.caption, ranked."callToAction", ranked.hashtags, ranked.version,
  CASE
    WHEN ranked.recency = 1 AND ranked.request_status = 'READY' THEN 'DRAFT'::"RevisionStatus"
    WHEN ranked.recency = 1 AND ranked.request_status = 'REJECTED' THEN 'REJECTED'::"RevisionStatus"
    ELSE 'SUPERSEDED'::"RevisionStatus"
  END,
  ranked."createdAt", ranked."updatedAt"
FROM ranked
JOIN public."ContentRequest" request ON request.id = ranked."contentRequestId";

ALTER TABLE public."ContentRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContentRevision" FORCE ROW LEVEL SECURITY;

CREATE POLICY content_revision_select ON public."ContentRevision"
FOR SELECT USING ("tenantId" = app_current_tenant_id());

CREATE POLICY content_revision_insert ON public."ContentRevision"
FOR INSERT WITH CHECK (
  "tenantId" = app_current_tenant_id()
  AND "createdById" = app_current_user_id()
  AND EXISTS (
    SELECT 1 FROM public."ContentRequest" request
    WHERE request.id = "ContentRevision"."contentRequestId"
      AND request."tenantId" = "ContentRevision"."tenantId"
  )
  AND (
    "generatedContentId" IS NULL OR EXISTS (
      SELECT 1 FROM public."GeneratedContent" generated
      WHERE generated.id = "ContentRevision"."generatedContentId"
        AND generated."tenantId" = "ContentRevision"."tenantId"
        AND generated."contentRequestId" = "ContentRevision"."contentRequestId"
    )
  )
);

CREATE POLICY content_revision_update ON public."ContentRevision"
FOR UPDATE USING ("tenantId" = app_current_tenant_id())
WITH CHECK (
  "tenantId" = app_current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM public."ContentRequest" request
    WHERE request.id = "ContentRevision"."contentRequestId"
      AND request."tenantId" = "ContentRevision"."tenantId"
  )
);

CREATE POLICY content_revision_delete ON public."ContentRevision"
FOR DELETE USING (false);
