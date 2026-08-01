-- ==============================================
-- 1. Helper Functions
-- ==============================================
CREATE OR REPLACE FUNCTION public.app_current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::UUID;
$$;

-- ==============================================
-- 2. UserProfile (app.user_id RLS)
-- ==============================================
ALTER TABLE public."UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserProfile" FORCE ROW LEVEL SECURITY;

CREATE POLICY userprofile_select ON public."UserProfile"
FOR SELECT USING ("id" = app_current_user_id());

CREATE POLICY userprofile_insert ON public."UserProfile"
FOR INSERT WITH CHECK ("id" = app_current_user_id());

CREATE POLICY userprofile_update ON public."UserProfile"
FOR UPDATE USING ("id" = app_current_user_id()) WITH CHECK ("id" = app_current_user_id());

CREATE POLICY userprofile_delete ON public."UserProfile"
FOR DELETE USING ("id" = app_current_user_id());

-- ==============================================
-- 3. Tenant (SELECT based on membership)
-- ==============================================
ALTER TABLE public."Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tenant" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON public."Tenant"
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public."Membership" m 
    WHERE m."tenantId" = "Tenant"."id" 
    AND m."userId" = app_current_user_id()
  )
);

-- We use a specific internal setting for the SECURITY DEFINER function to bypass insert RLS safely.
CREATE POLICY tenant_insert ON public."Tenant" FOR INSERT WITH CHECK (current_setting('app.is_admin_bypass', true) = 'true');
CREATE POLICY tenant_update ON public."Tenant" FOR UPDATE USING (current_setting('app.is_admin_bypass', true) = 'true');
CREATE POLICY tenant_delete ON public."Tenant" FOR DELETE USING (current_setting('app.is_admin_bypass', true) = 'true');

-- ==============================================
-- 4. Membership (app.tenant_id RLS)
-- ==============================================
ALTER TABLE public."Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Membership" FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_select ON public."Membership"
FOR SELECT USING ("tenantId" = app_current_tenant_id());

CREATE POLICY membership_insert ON public."Membership"
FOR INSERT WITH CHECK ("tenantId" = app_current_tenant_id() OR current_setting('app.is_admin_bypass', true) = 'true');

CREATE POLICY membership_update ON public."Membership"
FOR UPDATE USING ("tenantId" = app_current_tenant_id() OR current_setting('app.is_admin_bypass', true) = 'true') 
WITH CHECK ("tenantId" = app_current_tenant_id() OR current_setting('app.is_admin_bypass', true) = 'true');

CREATE POLICY membership_delete ON public."Membership"
FOR DELETE USING ("tenantId" = app_current_tenant_id() OR current_setting('app.is_admin_bypass', true) = 'true');

-- ==============================================
-- 5. Invitation (app.tenant_id RLS)
-- ==============================================
ALTER TABLE public."Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invitation" FORCE ROW LEVEL SECURITY;

CREATE POLICY invitation_select ON public."Invitation" FOR SELECT USING ("tenantId" = app_current_tenant_id());
CREATE POLICY invitation_insert ON public."Invitation" FOR INSERT WITH CHECK ("tenantId" = app_current_tenant_id());
CREATE POLICY invitation_update ON public."Invitation" FOR UPDATE USING ("tenantId" = app_current_tenant_id()) WITH CHECK ("tenantId" = app_current_tenant_id());
CREATE POLICY invitation_delete ON public."Invitation" FOR DELETE USING ("tenantId" = app_current_tenant_id());

-- ==============================================
-- 6. AuditLog (app.tenant_id RLS)
-- ==============================================
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY auditlog_select ON public."AuditLog" FOR SELECT USING ("tenantId" = app_current_tenant_id());
CREATE POLICY auditlog_insert ON public."AuditLog" FOR INSERT WITH CHECK ("tenantId" = app_current_tenant_id());
CREATE POLICY auditlog_insert_global ON public."AuditLog" FOR INSERT WITH CHECK (current_setting('app.is_admin_bypass', true) = 'true');
CREATE POLICY auditlog_update ON public."AuditLog" FOR UPDATE USING (false);
CREATE POLICY auditlog_delete ON public."AuditLog" FOR DELETE USING (false);

-- ==============================================
-- 7. Global Administrative Flows (SECURITY DEFINER)
-- ==============================================

-- 7.1 Create Tenant Atomically (Global Flow)
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
  p_user_id UUID, p_tenant_id UUID, p_name TEXT, p_slug TEXT, p_membership_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.is_admin_bypass', 'true', true);
  PERFORM set_config('app.tenant_id', p_tenant_id::TEXT, true);
  INSERT INTO public."Tenant" (id, name, slug, status, "createdAt", "updatedAt") VALUES (p_tenant_id, p_name, p_slug, 'ACTIVE', NOW(), NOW());
  INSERT INTO public."Membership" (id, role, status, "userId", "tenantId", "createdAt", "updatedAt") VALUES (p_membership_id, 'OWNER', 'ACTIVE', p_user_id, p_tenant_id, NOW(), NOW());
END;
$$;

-- 7.2 Accept Invitation Atomically (Global Flow)
CREATE OR REPLACE FUNCTION public.accept_invitation_atomically(
  p_token_hash TEXT, p_user_id UUID, p_membership_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_invitation_id UUID;
  v_role TEXT;
BEGIN
  PERFORM set_config('app.is_admin_bypass', 'true', true);
  
  SELECT id, "tenantId", role INTO v_invitation_id, v_tenant_id, v_role
  FROM public."Invitation"
  WHERE "tokenHash" = p_token_hash AND status = 'PENDING' AND "expiresAt" > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or invalid';
  END IF;

  UPDATE public."Invitation"
  SET status = 'ACCEPTED', "acceptedById" = p_user_id, "acceptedAt" = NOW(), "updatedAt" = NOW()
  WHERE id = v_invitation_id;

  INSERT INTO public."Membership" (id, role, status, "userId", "tenantId", "createdAt", "updatedAt")
  VALUES (p_membership_id, v_role::"Role", 'ACTIVE', p_user_id, v_tenant_id, NOW(), NOW());
  
END;
$$;

-- 7.3 Log Global Audit
CREATE OR REPLACE FUNCTION public.log_global_audit(
  p_id UUID, p_action TEXT, p_entity TEXT, p_entity_id TEXT, p_actor_id UUID, p_metadata JSONB
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.is_admin_bypass', 'true', true);
  INSERT INTO public."AuditLog" (id, action, entity, "entityId", "actorId", metadata, "createdAt")
  VALUES (p_id, p_action, p_entity, p_entity_id, p_actor_id, p_metadata, NOW());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_tenant_with_owner FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_invitation_atomically FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_global_audit FROM PUBLIC;
