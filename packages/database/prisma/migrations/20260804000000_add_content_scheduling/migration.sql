ALTER TABLE public."Tenant" ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'CANCELED', 'DUE', 'COMPLETED', 'FAILED');

CREATE TABLE public."ContentSchedule" (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "contentRequestId" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "scheduledById" UUID NOT NULL,
  status "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduledFor" TIMESTAMPTZ(3) NOT NULL,
  "scheduledMinute" TIMESTAMPTZ(3) NOT NULL,
  timezone TEXT NOT NULL,
  "canceledAt" TIMESTAMP(3),
  "canceledById" UUID,
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentSchedule_pkey" PRIMARY KEY (id),
  CONSTRAINT "ContentSchedule_minute_precision_check" CHECK ("scheduledFor" = "scheduledMinute")
);

CREATE UNIQUE INDEX "ContentSchedule_one_active_content_key" ON public."ContentSchedule"("contentRequestId") WHERE status IN ('SCHEDULED', 'DUE');
CREATE UNIQUE INDEX "ContentSchedule_one_active_tenant_slot_key" ON public."ContentSchedule"("tenantId", "scheduledMinute") WHERE status IN ('SCHEDULED', 'DUE');
CREATE INDEX "ContentSchedule_tenantId_scheduledFor_idx" ON public."ContentSchedule"("tenantId", "scheduledFor");
CREATE INDEX "ContentSchedule_tenantId_status_scheduledFor_idx" ON public."ContentSchedule"("tenantId", status, "scheduledFor");
CREATE INDEX "ContentSchedule_contentRequestId_status_idx" ON public."ContentSchedule"("contentRequestId", status);
CREATE INDEX "ContentSchedule_revisionId_idx" ON public."ContentSchedule"("revisionId");
CREATE INDEX "ContentSchedule_scheduledById_idx" ON public."ContentSchedule"("scheduledById");
CREATE INDEX "ContentSchedule_canceledById_idx" ON public."ContentSchedule"("canceledById");

ALTER TABLE public."ContentSchedule" ADD CONSTRAINT "ContentSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."ContentSchedule" ADD CONSTRAINT "ContentSchedule_contentRequestId_fkey" FOREIGN KEY ("contentRequestId") REFERENCES public."ContentRequest"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."ContentSchedule" ADD CONSTRAINT "ContentSchedule_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES public."ContentRevision"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."ContentSchedule" ADD CONSTRAINT "ContentSchedule_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES public."UserProfile"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."ContentSchedule" ADD CONSTRAINT "ContentSchedule_canceledById_fkey" FOREIGN KEY ("canceledById") REFERENCES public."UserProfile"(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."ContentSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContentSchedule" FORCE ROW LEVEL SECURITY;

CREATE POLICY content_schedule_select ON public."ContentSchedule"
FOR SELECT USING ("tenantId" = app_current_tenant_id());

CREATE POLICY content_schedule_insert ON public."ContentSchedule"
FOR INSERT WITH CHECK (
  "tenantId" = app_current_tenant_id()
  AND "scheduledById" = app_current_user_id()
  AND status = 'SCHEDULED'
  AND EXISTS (
    SELECT 1 FROM public."ContentRequest" request
    WHERE request.id = "ContentSchedule"."contentRequestId"
      AND request."tenantId" = "ContentSchedule"."tenantId"
      AND request.status = 'APPROVED'
  )
  AND EXISTS (
    SELECT 1 FROM public."ContentRevision" revision
    WHERE revision.id = "ContentSchedule"."revisionId"
      AND revision."tenantId" = "ContentSchedule"."tenantId"
      AND revision."contentRequestId" = "ContentSchedule"."contentRequestId"
      AND revision.status = 'APPROVED'
  )
);

CREATE POLICY content_schedule_update ON public."ContentSchedule"
FOR UPDATE USING ("tenantId" = app_current_tenant_id())
WITH CHECK (
  "tenantId" = app_current_tenant_id()
  AND ("canceledById" IS NULL OR "canceledById" = app_current_user_id())
  AND EXISTS (
    SELECT 1 FROM public."ContentRequest" request
    WHERE request.id = "ContentSchedule"."contentRequestId"
      AND request."tenantId" = "ContentSchedule"."tenantId"
  )
  AND EXISTS (
    SELECT 1 FROM public."ContentRevision" revision
    WHERE revision.id = "ContentSchedule"."revisionId"
      AND revision."tenantId" = "ContentSchedule"."tenantId"
      AND revision."contentRequestId" = "ContentSchedule"."contentRequestId"
  )
);

CREATE POLICY content_schedule_delete ON public."ContentSchedule"
FOR DELETE USING (false);
