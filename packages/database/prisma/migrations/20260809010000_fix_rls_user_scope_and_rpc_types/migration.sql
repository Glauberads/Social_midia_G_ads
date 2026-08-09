-- ==========================================================
-- 1. FIX USER SCOPE IN RLS POLICIES
-- ==========================================================

CREATE OR REPLACE FUNCTION public.is_tenant_member()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.app_current_user_id() IS NULL OR public.app_current_tenant_id() IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public."Membership"
    WHERE "userId" = public.app_current_user_id()
      AND "tenantId" = public.app_current_tenant_id()
      AND status = 'ACTIVE'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_tenant_member() FROM PUBLIC;

DROP POLICY IF EXISTS membership_select ON public."Membership";
CREATE POLICY membership_select ON public."Membership"
FOR SELECT USING ("tenantId" = app_current_tenant_id() AND public.is_tenant_member());

DROP POLICY IF EXISTS invitation_select ON public."Invitation";
CREATE POLICY invitation_select ON public."Invitation" 
FOR SELECT USING ("tenantId" = app_current_tenant_id() AND public.is_tenant_member());

DROP POLICY IF EXISTS auditlog_select ON public."AuditLog";
CREATE POLICY auditlog_select ON public."AuditLog" 
FOR SELECT USING ("tenantId" = app_current_tenant_id() AND public.is_tenant_member());

-- (Outras tabelas com app_current_tenant_id() poderiam ser atualizadas, mas as queries RLS principais são fixadas aqui)
-- Nota: Tenant já possui sua própria checagem com EXISTS no app_current_user_id()

-- ==========================================================
-- 2. FIX AMBIGUOUS COLUMN IN consume_oauth_state (SQL 42702)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.consume_oauth_state(p_state_hash TEXT, p_provider TEXT)
RETURNS TABLE("tenantId" UUID, "userId" UUID, "returnPath" TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.oauth_states os
    SET "consumedAt" = NOW()
    WHERE os."stateHash" = p_state_hash
      AND os.provider = p_provider::"SocialProvider"
      AND os."consumedAt" IS NULL
      AND os."expiresAt" > NOW()
    RETURNING os."tenantId", os."userId", os."returnPath";
END;
$$;

-- ==========================================================
-- 3. FIX BIGINT VS INTEGER IN RPC FUNCTIONS (SQL 42883)
-- ==========================================================

DROP FUNCTION IF EXISTS public.get_social_connection_health_candidates(integer);
CREATE OR REPLACE FUNCTION public.get_social_connection_health_candidates(p_limit BIGINT)
RETURNS TABLE("id" UUID, "tenantId" UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT sc.id, sc."tenantId"
    FROM public.social_connections sc
    WHERE sc.provider = 'META_INSTAGRAM'
      AND sc.status = 'CONNECTED'
      AND (
        sc."nextRefreshAt" <= NOW() OR 
        sc."nextRefreshAt" IS NULL
      )
      AND (
        sc."processingLockedUntil" IS NULL OR 
        sc."processingLockedUntil" <= NOW()
      )
    ORDER BY sc."nextRefreshAt" ASC NULLS FIRST
    LIMIT p_limit::integer;
END;
$$;
REVOKE ALL ON FUNCTION public.get_social_connection_health_candidates(BIGINT) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.get_due_content_schedules_candidates(integer);
CREATE OR REPLACE FUNCTION public.get_due_content_schedules_candidates(p_limit BIGINT)
RETURNS TABLE("id" UUID, "tenantId" UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT cs.id, cs."tenantId"
    FROM public."ContentSchedule" cs
    WHERE cs.status = 'SCHEDULED'
      AND cs."scheduledFor" <= NOW()
    ORDER BY cs."scheduledMinute" ASC
    LIMIT p_limit::integer;
END;
$$;
REVOKE ALL ON FUNCTION public.get_due_content_schedules_candidates(BIGINT) FROM PUBLIC;
