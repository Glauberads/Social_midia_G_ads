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
    const uuid1 = crypto.randomUUID();
    const randEmail = `test_${Date.now()}@example.com`;
    const randUpdated = `updated_${Date.now()}@example.com`;
    await client.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [uuid1, randEmail]);
    console.log("Created auth.user");
    
    // Testa trigger OnUserCreated
    const res1 = await client.query(`SELECT id, email FROM public."UserProfile" WHERE id = $1`, [uuid1]);
    console.log("UserProfile sync:", res1.rows);
    
    // Testa trigger OnUserUpdated
    await client.query(`UPDATE auth.users SET email = $1 WHERE id = $2`, [randUpdated, uuid1]);
    let res = await client.query(`SELECT id, email FROM "UserProfile" WHERE id = $1`, [uuid1]);
    console.log("UserProfile update sync:", res.rows);

    // Insert UserProfile directly with non-existent UUID (should fail)
    const nonexistentUuid = crypto.randomUUID();
    try {
      await client.query(`INSERT INTO "UserProfile" (id, email, "updatedAt") VALUES ($1, 'fail@example.com', NOW())`, [nonexistentUuid]);
      console.error("FAIL: UserProfile insert should have failed!");
    } catch(e) {
      console.log(`SUCCESS: FK rejected UserProfile insert. Error: ${e.message}`);
    }

    // Passo 9: Memberships e Tenant
    console.log("\n--- ETAPA 9: MEMBERSHIP ---");
    const tenantUuid = crypto.randomUUID();
    await client.query(`INSERT INTO "Tenant" (id, name, slug, "updatedAt") VALUES ($1, 'Tenant 1', 'tenant-${Date.now()}', NOW())`, [tenantUuid]);
    console.log("Created Tenant");

    // Membership requires existing UserProfile
    await client.query(`INSERT INTO "Membership" (id, "userId", "tenantId", "updatedAt") VALUES ($1, $2, $3, NOW())`, [crypto.randomUUID(), uuid1, tenantUuid]);
    console.log("Created Membership");

    try {
      // should fail (duplicate membership for same user/tenant)
      await client.query(`INSERT INTO "Membership" (id, "userId", "tenantId", "updatedAt") VALUES ($1, $2, $3, NOW())`, [crypto.randomUUID(), uuid1, tenantUuid]);
      console.error("FAIL: Duplicate membership should have failed!");
    } catch(e) {
      console.log(`SUCCESS: Unique constraint rejected duplicate membership. Error: ${e.message}`);
    }

    // Step 10: Convites
    console.log("\n--- ETAPA 10: CONVITES ---");
    const tokenHash = crypto.randomUUID();
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 7);
    await client.query(`
      INSERT INTO "Invitation" (id, email, "tokenHash", "tenantId", "invitedById", "expiresAt")
      VALUES ($1, 'invite@example.com', $2, $3, $4, $5)
    `, [crypto.randomUUID(), tokenHash, tenantUuid, uuid1, expireDate.toISOString()]);
    console.log("Created Invitation");

    console.log("\n উপকূল 11: AUDITLOG ---");
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
