-- ==========================================================
-- 1. resolve_tenant_membership
-- Resolve se o usuário pertence ao tenant e retorna role
-- ==========================================================

CREATE OR REPLACE FUNCTION public.resolve_tenant_membership(p_user_uuid UUID, p_tenant_uuid UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'membershipId', m.id,
        'role', m.role,
        'membershipStatus', m.status,
        'tenantStatus', t.status
    )
    INTO v_result
    FROM public."Membership" m
    JOIN public."Tenant" t ON m."tenantId" = t.id
    WHERE m."userId" = p_user_uuid
      AND m."tenantId" = p_tenant_uuid;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_tenant_membership(UUID, UUID) FROM PUBLIC;

-- ==========================================================
-- 2. get_due_content_schedules_candidates
-- Descoberta restrita para worker processar due schedules
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_due_content_schedules_candidates(p_limit INT)
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
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_due_content_schedules_candidates(INT) FROM PUBLIC;

-- ==========================================================
-- 3. get_social_connection_health_candidates
-- Descoberta restrita para worker validar social connections
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_social_connection_health_candidates(p_limit INT)
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
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_social_connection_health_candidates(INT) FROM PUBLIC;

-- ==========================================================
-- 4. consume_oauth_state
-- Bootstrap OAUTH callback lookup sem context global
-- ==========================================================

CREATE OR REPLACE FUNCTION public.consume_oauth_state(p_state_hash TEXT, p_provider TEXT)
RETURNS TABLE("tenantId" UUID, "userId" UUID, "returnPath" TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.oauth_states
    SET "consumedAt" = NOW()
    WHERE "stateHash" = p_state_hash
      AND provider = p_provider::"SocialProvider"
      AND "consumedAt" IS NULL
      AND "expiresAt" > NOW()
    RETURNING "tenantId", "userId", "returnPath";
END;
$$;

REVOKE ALL ON FUNCTION public.consume_oauth_state(TEXT, TEXT) FROM PUBLIC;
