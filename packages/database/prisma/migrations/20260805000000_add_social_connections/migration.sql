-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('META_INSTAGRAM');
CREATE TYPE "SocialConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "oauth_states" (
    "stateHash" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "returnPath" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("stateHash")
);

-- CreateTable
CREATE TABLE "oauth_sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_connections" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "externalAccountId" TEXT,
    "externalAccountName" TEXT,
    "pageId" TEXT,
    "instagramAccountId" TEXT,
    "scopes" TEXT[],
    "accessTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "refreshMetadata" JSONB,
    "connectedById" UUID NOT NULL,
    "connectedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_states_tenantId_createdAt_idx" ON "oauth_states"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "oauth_sessions_tenantId_createdAt_idx" ON "oauth_sessions"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_connections_tenantId_provider_key" ON "social_connections"("tenantId", "provider");

-- AddForeignKey
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_connections" ADD CONSTRAINT "social_connections_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE public."oauth_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."oauth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."social_connections" ENABLE ROW LEVEL SECURITY;

-- Force RLS
ALTER TABLE public."oauth_states" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."oauth_sessions" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."social_connections" FORCE ROW LEVEL SECURITY;

-- RLS Policies for oauth_states
CREATE POLICY "oauth_states_tenant_isolation"
    ON public."oauth_states"
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        NULLIF(current_setting('app.tenant_id', true), '')::uuid = "tenantId"
    )
    WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '')::uuid = "tenantId"
    );


-- RLS Policies for oauth_sessions
CREATE POLICY "oauth_sessions_tenant_isolation"
    ON public."oauth_sessions"
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        NULLIF(current_setting('app.tenant_id', true), '')::uuid = "tenantId"
    )
    WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '')::uuid = "tenantId"
    );


-- RLS Policies for social_connections
CREATE POLICY "social_connections_tenant_isolation"
    ON public."social_connections"
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        NULLIF(current_setting('app.tenant_id', true), '')::uuid = "tenantId"
    )
    WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '')::uuid = "tenantId"
    );


