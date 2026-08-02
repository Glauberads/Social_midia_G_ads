-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ContentGeneration" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "contentRequestId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT NOT NULL,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentGeneration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeneratedContent" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "contentRequestId" UUID NOT NULL,
  "generationId" UUID NOT NULL,
  "caption" TEXT NOT NULL,
  "callToAction" TEXT NOT NULL,
  "hashtags" TEXT[] NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GeneratedContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentGeneration_idempotencyKey_key" ON "ContentGeneration"("idempotencyKey");
CREATE INDEX "ContentGeneration_tenantId_status_idx" ON "ContentGeneration"("tenantId", "status");
CREATE INDEX "ContentGeneration_tenantId_contentRequestId_createdAt_idx" ON "ContentGeneration"("tenantId", "contentRequestId", "createdAt");
CREATE INDEX "ContentGeneration_contentRequestId_status_idx" ON "ContentGeneration"("contentRequestId", "status");
CREATE UNIQUE INDEX "GeneratedContent_generationId_key" ON "GeneratedContent"("generationId");
CREATE UNIQUE INDEX "GeneratedContent_contentRequestId_version_key" ON "GeneratedContent"("contentRequestId", "version");
CREATE INDEX "GeneratedContent_tenantId_contentRequestId_idx" ON "GeneratedContent"("tenantId", "contentRequestId");
CREATE INDEX "GeneratedContent_tenantId_createdAt_idx" ON "GeneratedContent"("tenantId", "createdAt");

ALTER TABLE "ContentGeneration" ADD CONSTRAINT "ContentGeneration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentGeneration" ADD CONSTRAINT "ContentGeneration_contentRequestId_fkey" FOREIGN KEY ("contentRequestId") REFERENCES "ContentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentGeneration" ADD CONSTRAINT "ContentGeneration_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_contentRequestId_fkey" FOREIGN KEY ("contentRequestId") REFERENCES "ContentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "ContentGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."ContentGeneration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContentGeneration" FORCE ROW LEVEL SECURITY;
CREATE POLICY content_generation_select ON public."ContentGeneration" FOR SELECT USING ("tenantId" = app_current_tenant_id());
CREATE POLICY content_generation_insert ON public."ContentGeneration" FOR INSERT WITH CHECK (
  "tenantId" = app_current_tenant_id()
  AND "requestedById" = app_current_user_id()
  AND EXISTS (SELECT 1 FROM public."ContentRequest" request WHERE request.id = "ContentGeneration"."contentRequestId" AND request."tenantId" = "ContentGeneration"."tenantId")
);
CREATE POLICY content_generation_update ON public."ContentGeneration" FOR UPDATE
USING ("tenantId" = app_current_tenant_id())
WITH CHECK (
  "tenantId" = app_current_tenant_id()
  AND EXISTS (SELECT 1 FROM public."ContentRequest" request WHERE request.id = "ContentGeneration"."contentRequestId" AND request."tenantId" = "ContentGeneration"."tenantId")
);
CREATE POLICY content_generation_delete ON public."ContentGeneration" FOR DELETE USING ("tenantId" = app_current_tenant_id());

ALTER TABLE public."GeneratedContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GeneratedContent" FORCE ROW LEVEL SECURITY;
CREATE POLICY generated_content_select ON public."GeneratedContent" FOR SELECT USING ("tenantId" = app_current_tenant_id());
CREATE POLICY generated_content_insert ON public."GeneratedContent" FOR INSERT WITH CHECK (
  "tenantId" = app_current_tenant_id()
  AND EXISTS (SELECT 1 FROM public."ContentRequest" request WHERE request.id = "GeneratedContent"."contentRequestId" AND request."tenantId" = "GeneratedContent"."tenantId")
  AND EXISTS (SELECT 1 FROM public."ContentGeneration" generation WHERE generation.id = "GeneratedContent"."generationId" AND generation."tenantId" = "GeneratedContent"."tenantId")
);
CREATE POLICY generated_content_update ON public."GeneratedContent" FOR UPDATE
USING ("tenantId" = app_current_tenant_id())
WITH CHECK (
  "tenantId" = app_current_tenant_id()
  AND EXISTS (SELECT 1 FROM public."ContentRequest" request WHERE request.id = "GeneratedContent"."contentRequestId" AND request."tenantId" = "GeneratedContent"."tenantId")
  AND EXISTS (SELECT 1 FROM public."ContentGeneration" generation WHERE generation.id = "GeneratedContent"."generationId" AND generation."tenantId" = "GeneratedContent"."tenantId")
);
CREATE POLICY generated_content_delete ON public."GeneratedContent" FOR DELETE USING ("tenantId" = app_current_tenant_id());
