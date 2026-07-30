const { Client } = require('pg');

async function runTests() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
    console.error('ERROR: DATABASE_URL must point to localhost or 127.0.0.1 for integration tests.');
    process.exit(1);
  }
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  });
  await client.connect();
  let results = {};

  try {
    // Passo 8: Testes Físicos UserProfile
    console.log("--- ETAPA 8: USERPROFILE ---");
    const uuid1 = '11111111-1111-1111-1111-111111111111';
    await client.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'test@example.com')`, [uuid1]);
    console.log("Created auth.user");
    
    // Check if UserProfile was created automatically
    let res = await client.query(`SELECT id, email FROM "UserProfile" WHERE id = $1`, [uuid1]);
    console.log("UserProfile sync:", res.rows);

    // Update email
    await client.query(`UPDATE auth.users SET email = 'updated@example.com' WHERE id = $1`, [uuid1]);
    res = await client.query(`SELECT id, email FROM "UserProfile" WHERE id = $1`, [uuid1]);
    console.log("UserProfile update sync:", res.rows);

    // Insert UserProfile directly with non-existent UUID (should fail)
    try {
      await client.query(`INSERT INTO "UserProfile" (id, email, "updatedAt") VALUES ('22222222-2222-2222-2222-222222222222', 'fake@fake.com', NOW())`);
      console.log("FAIL: FK should have rejected UserProfile insert");
    } catch (e) {
      console.log("SUCCESS: FK rejected UserProfile insert. Error:", e.message);
    }

    // Passo 9: Testes Físicos Membership
    console.log("\n--- ETAPA 9: MEMBERSHIP ---");
    const tenantId = '33333333-3333-3333-3333-333333333333';
    await client.query(`INSERT INTO "Tenant" (id, name, slug, status, "updatedAt") VALUES ($1, 'Test Tenant', 'test-tenant', 'ACTIVE', NOW())`, [tenantId]);
    console.log("Created Tenant");

    const memId1 = '44444444-4444-4444-4444-444444444444';
    await client.query(`INSERT INTO "Membership" (id, role, status, "userId", "tenantId", "updatedAt") VALUES ($1, 'OWNER', 'ACTIVE', $2, $3, NOW())`, [memId1, uuid1, tenantId]);
    console.log("Created Membership");

    try {
      const memId2 = '55555555-5555-5555-5555-555555555555';
      await client.query(`INSERT INTO "Membership" (id, role, status, "userId", "tenantId", "updatedAt") VALUES ($1, 'MEMBER', 'ACTIVE', $2, $3, NOW())`, [memId2, uuid1, tenantId]);
      console.log("FAIL: Should not allow duplicate userId + tenantId");
    } catch (e) {
      console.log("SUCCESS: Duplicate userId+tenantId rejected. Error:", e.message);
    }

    try {
      await client.query(`DELETE FROM "Tenant" WHERE id = $1`, [tenantId]);
      console.log("FAIL: Tenant deletion should fail due to RESTRICT on Membership");
    } catch(e) {
      console.log("SUCCESS: Tenant physical deletion rejected. Error:", e.message);
    }

    // Passo 10: Testes Físicos Invitation
    console.log("\n--- ETAPA 10: INVITATION ---");
    const invId1 = '66666666-6666-6666-6666-666666666666';
    await client.query(`INSERT INTO "Invitation" (id, email, role, status, "tokenHash", "tenantId", "invitedById", "expiresAt") VALUES ($1, 'invite@example.com', 'MEMBER', 'PENDING', 'hash1', $2, $3, NOW() + interval '1 day')`, [invId1, tenantId, uuid1]);
    console.log("Created Invitation");

    try {
      const invId2 = '77777777-7777-7777-7777-777777777777';
      await client.query(`INSERT INTO "Invitation" (id, email, role, status, "tokenHash", "tenantId", "invitedById", "expiresAt") VALUES ($1, 'INVITE@EXAMPLE.COM', 'MEMBER', 'PENDING', 'hash2', $2, $3, NOW() + interval '1 day')`, [invId2, tenantId, uuid1]);
      console.log("FAIL: Should reject duplicate PENDING invitation for same email/tenant (case insensitive)");
    } catch (e) {
      console.log("SUCCESS: Duplicate PENDING invitation rejected. Error:", e.message);
    }

    // Passo 11: Testes Físicos AuditLog
    console.log("\n--- ETAPA 11: AUDITLOG ---");
    const auditId = '88888888-8888-8888-8888-888888888888';
    await client.query(`INSERT INTO "AuditLog" (id, action, entity, "entityId") VALUES ($1, 'CREATE', 'User', $2)`, [auditId, uuid1]);
    console.log("Created AuditLog");

    try {
      await client.query(`UPDATE "AuditLog" SET action = 'UPDATE' WHERE id = $1`, [auditId]);
      console.log("FAIL: AuditLog update should fail");
    } catch(e) {
      console.log("SUCCESS: AuditLog UPDATE rejected. Code:", e.code, "Error:", e.message);
    }

    try {
      await client.query(`DELETE FROM "AuditLog" WHERE id = $1`, [auditId]);
      console.log("FAIL: AuditLog delete should fail");
    } catch(e) {
      console.log("SUCCESS: AuditLog DELETE rejected. Code:", e.code, "Error:", e.message);
    }

  } catch (e) {
    console.error("UNEXPECTED ERROR:", e);
    await client.end();
    process.exit(1);
  }
  await client.end();
}

runTests();
