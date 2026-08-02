-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'GENERATING', 'READY', 'APPROVED', 'REJECTED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentPlatform" AS ENUM ('INSTAGRAM_FEED', 'INSTAGRAM_STORY', 'INSTAGRAM_REEL');

-- CreateTable
CREATE TABLE "ContentRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "briefing" TEXT NOT NULL,
    "objective" TEXT,
    "audience" TEXT,
    "tone" TEXT,
    "platform" "ContentPlatform" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentRequest_tenantId_createdAt_idx" ON "ContentRequest"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentRequest_tenantId_status_idx" ON "ContentRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ContentRequest_createdById_idx" ON "ContentRequest"("createdById");

-- AddForeignKey
ALTER TABLE "ContentRequest" ADD CONSTRAINT "ContentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRequest" ADD CONSTRAINT "ContentRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==============================================
-- RLS (app.tenant_id)
-- ==============================================
ALTER TABLE public."ContentRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContentRequest" FORCE ROW LEVEL SECURITY;

CREATE POLICY content_request_select ON public."ContentRequest"
FOR SELECT USING ("tenantId" = app_current_tenant_id());

CREATE POLICY content_request_insert ON public."ContentRequest"
FOR INSERT WITH CHECK ("tenantId" = app_current_tenant_id() AND "createdById" = app_current_user_id());

CREATE POLICY content_request_update ON public."ContentRequest"
FOR UPDATE USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id());

CREATE POLICY content_request_delete ON public."ContentRequest"
FOR DELETE USING ("tenantId" = app_current_tenant_id());
