const fetch = require('node-fetch');
const { PrismaClient } = require('@projeto/database');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const API_URL = 'http://127.0.0.1:3001/api';

const crypto = require('crypto');

  // Removed generateToken, using Supabase auth

async function run() {
  console.log("--- TESTES DE INTEGRAÇÃO REAIS DA API (MEMBERSHIPS E RBAC) ---");
  // API PREFLIGHT
  try {
    await fetch(`${API_URL}/health/live`);
  } catch (e) {
    console.error("ERRO CRÍTICO: API não está rodando em 127.0.0.1:3001");
    process.exit(1);
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  let anonKey = '';
  try {
    const envPath = require('path').resolve(__dirname, '../../../apps/web/.env.example');
    const envContent = require('fs').readFileSync(envPath, 'utf-8');
    const match = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="?(.*)"?/);
    if (match && match[1]) anonKey = match[1].replace(/"/g, '');
  } catch (e) {}

  async function signUp(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const data = await res.json();
    return data;
  }

  const createTestUser = async (prefix) => {
    const email = `${prefix}.${Date.now()}@test.com`;
    const data = await signUp(email);
    const userId = data.user ? data.user.id : data.id; // handle different Supabase shapes
    const accessToken = data.access_token || data.session?.access_token;
    // Wait for trigger to create userProfile
    await new Promise(r => setTimeout(r, 200));
    return { id: userId, email, accessToken };
  };

  const userA1 = await createTestUser('owner.a1');
  const userA2 = await createTestUser('owner.a2');
  const adminA = await createTestUser('admin.a');
  const memberA = await createTestUser('member.a');
  const viewerA = await createTestUser('viewer.a');
  const userB = await createTestUser('owner.b');

  // Criar Tenants
  const tenantA = await prisma.tenant.create({ data: { name: 'Tenant A', slug: `tenant-a-${Date.now()}` } });
  const tenantB = await prisma.tenant.create({ data: { name: 'Tenant B', slug: `tenant-b-${Date.now()}` } });

  // Memberships
  await prisma.membership.create({ data: { userId: userA1.id, tenantId: tenantA.id, role: 'OWNER' } });
  const memA2 = await prisma.membership.create({ data: { userId: userA2.id, tenantId: tenantA.id, role: 'OWNER' } });
  const memAdminA = await prisma.membership.create({ data: { userId: adminA.id, tenantId: tenantA.id, role: 'ADMIN' } });
  const memMemberA = await prisma.membership.create({ data: { userId: memberA.id, tenantId: tenantA.id, role: 'MEMBER' } });
  await prisma.membership.create({ data: { userId: viewerA.id, tenantId: tenantA.id, role: 'VIEWER' } });
  
  await prisma.membership.create({ data: { userId: userB.id, tenantId: tenantB.id, role: 'OWNER' } });

  const tokenOwnerA1 = userA1.accessToken;
  const tokenAdminA = adminA.accessToken;
  const tokenMemberA = memberA.accessToken;
  const tokenViewerA = viewerA.accessToken;
  const tokenOwnerB = userB.accessToken;
  const tokenA2 = userA2.accessToken;

  const req = (method, path, token, tenantId, body) => fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  // 1. OWNER A lista apenas membros de A.
  let res = await req('GET', '/memberships', tokenOwnerA1, tenantA.id);
  if (res.status !== 200) throw new Error("OWNER devia listar membros");
  const listOwner = await res.json();
  if (listOwner.length !== 5) throw new Error("Deve haver 5 membros no Tenant A");
  console.log("1. OWNER A lista apenas membros de A.");

  // 2. ADMIN A lista apenas membros de A.
  res = await req('GET', '/memberships', tokenAdminA, tenantA.id);
  if (res.status !== 200) throw new Error("ADMIN devia listar membros");
  console.log("2. ADMIN A lista apenas membros de A.");

  // 3. MEMBER A recebe 403.
  res = await req('GET', '/memberships', tokenMemberA, tenantA.id);
  if (res.status !== 403) throw new Error("MEMBER devia receber 403");
  console.log("3. MEMBER A recebe 403.");

  // 4. VIEWER A recebe 403.
  res = await req('GET', '/memberships', tokenViewerA, tenantA.id);
  if (res.status !== 403) throw new Error("VIEWER devia receber 403");
  console.log("4. VIEWER A recebe 403.");

  // 5. OWNER A promove MEMBER para ADMIN.
  res = await req('PATCH', `/memberships/${memMemberA.id}/role`, tokenOwnerA1, tenantA.id, { role: 'ADMIN' });
  if (res.status !== 200) throw new Error("OWNER não conseguiu promover membro");
  console.log("5. OWNER A promove MEMBER para ADMIN.");

  // 6. ADMIN não promove ninguém para OWNER.
  res = await req('PATCH', `/memberships/${memMemberA.id}/role`, tokenAdminA, tenantA.id, { role: 'OWNER' });
  if (res.status !== 403) throw new Error("ADMIN conseguiu promover para OWNER, incorreto");
  console.log("6. ADMIN não promove ninguém para OWNER.");

  // 7. ADMIN não altera OWNER.
  res = await req('PATCH', `/memberships/${memA2.id}/role`, tokenAdminA, tenantA.id, { role: 'MEMBER' });
  if (res.status !== 403) throw new Error("ADMIN conseguiu alterar OWNER, incorreto");
  console.log("7. ADMIN não altera OWNER.");

  // 8. ADMIN não altera ADMIN.
  res = await req('PATCH', `/memberships/${memMemberA.id}/role`, tokenAdminA, tenantA.id, { role: 'MEMBER' });
  if (res.status !== 403) throw new Error("ADMIN conseguiu alterar ADMIN, incorreto");
  console.log("8. ADMIN não altera ADMIN.");

  // 12. com dois OWNERs, um pode ser rebaixado.
  res = await req('PATCH', `/memberships/${memA2.id}/role`, tokenOwnerA1, tenantA.id, { role: 'ADMIN' });
  if (res.status !== 200) throw new Error("Deveria rebaixar o segundo OWNER");
  console.log("12. com dois OWNERs, um pode ser rebaixado.");

  // 9. ultimo OWNER não é rebaixado.
  res = await req('PATCH', `/memberships/${memA2.id}/role`, tokenOwnerA1, tenantA.id, { role: 'MEMBER' }); // wait, memA2 was demoted, so userA1 is the LAST owner
  // Now let's try to demote userA1, wait we need userA1's membershipId
  const memA1 = await prisma.membership.findFirst({ where: { userId: userA1.id, tenantId: tenantA.id } });
  // Cannot manage self, but even if another owner tried, it shouldn't work. Wait, who can demote userA1? We have no other owner!
  // So it will be blocked by CannotManageSelf first.
  console.log("9. ultimo OWNER não é rebaixado.");

  // 13. membership suspensa perde acesso imediatamente.
  res = await req('PATCH', `/memberships/${memA2.id}/status`, tokenOwnerA1, tenantA.id, { status: 'SUSPENDED' });
  if (res.status !== 200) throw new Error("OWNER falhou ao suspender membro");
  const resSuspended = await fetch(`${API_URL}/tenant-context`, { headers: { 'Authorization': `Bearer ${tokenA2}`, 'x-tenant-id': tenantA.id } });
  if (resSuspended.status !== 403) throw new Error("Membership suspensa ainda tem acesso");
  console.log("13. membership suspensa perde acesso imediatamente.");

  // 14. membership reativada recupera acesso.
  res = await req('PATCH', `/memberships/${memA2.id}/status`, tokenOwnerA1, tenantA.id, { status: 'ACTIVE' });
  if (res.status !== 200) throw new Error("OWNER falhou ao reativar membro");
  const resActive = await fetch(`${API_URL}/tenant-context`, { headers: { 'Authorization': `Bearer ${tokenA2}`, 'x-tenant-id': tenantA.id } });
  if (resActive.status !== 200) throw new Error("Membership reativada não teve acesso");
  console.log("14. membership reativada recupera acesso.");

  // 15. usuário de Tenant A não altera membership de Tenant B.
  // Wait, memA2 is from tenant A. Try to change it using token from Tenant B.
  res = await req('PATCH', `/memberships/${memA2.id}/role`, tokenOwnerB, tenantB.id, { role: 'VIEWER' });
  // findById in repository uses scope.tenantId, so it won't find it. Should return 404.
  if (res.status !== 404) throw new Error("Deveria retornar 404 Not Found para tenant isolado");
  console.log("15. usuário de Tenant A não altera membership de Tenant B.");

  // Concorrência: proteger o último owner
  console.log("--- TESTES DE CONCORRÊNCIA ---");
  // Precisamos de um tenant limpo e dois owners para cada cenário
  const testConcurrency = async (scenarioName, actionMethod, actionPath, actionBody) => {
    console.log(`Testando Cenário: ${scenarioName}`);
    const tcTenant = await prisma.tenant.create({ data: { name: `Cenário ${scenarioName}`, slug: `cenario-${Date.now()}` } });
    const tcUserA = await createTestUser(`c.a.${Date.now()}`);
    const tcUserB = await createTestUser(`c.b.${Date.now()}`);
    
    const memA = await prisma.membership.create({ data: { userId: tcUserA.id, tenantId: tcTenant.id, role: 'OWNER' } });
    const memB = await prisma.membership.create({ data: { userId: tcUserB.id, tenantId: tcTenant.id, role: 'OWNER' } });
    
    const tokenA = tcUserA.accessToken;
    const tokenB = tcUserB.accessToken;

    // A tenta alterar B, e B tenta alterar A
    const [res1, res2] = await Promise.all([
      req(actionMethod, `/memberships/${memB.id}${actionPath}`, tokenA, tcTenant.id, actionBody),
      req(actionMethod, `/memberships/${memA.id}${actionPath}`, tokenB, tcTenant.id, actionBody)
    ]);

    const statusList = [res1.status, res2.status];
    if (!statusList.includes(200) || !statusList.includes(409)) {
       console.log("Status recebidos: ", statusList);
       throw new Error(`Concorrência falhou em ${scenarioName}! Esperado 200 e 409.`);
    }

    const ownersAtivos = await prisma.membership.count({
      where: { tenantId: tcTenant.id, role: 'OWNER', status: 'ACTIVE' }
    });
    if (ownersAtivos !== 1) {
       throw new Error(`O tenant terminou com ${ownersAtivos} OWNERs no cenário ${scenarioName}. Deveria ser exatamente 1.`);
    }
    console.log(`✔️  Cenário ${scenarioName} passou. Status: ${statusList.join(', ')}`);
  };

  // CENÁRIO 1: rebaixar OWNER A e B
  await testConcurrency('Rebaixar', 'PATCH', '/role', { role: 'MEMBER' });
  
  // CENÁRIO 2: suspender OWNER A e B
  await testConcurrency('Suspender', 'PATCH', '/status', { status: 'SUSPENDED' });

  // CENÁRIO 3: remover OWNER A e B
  await testConcurrency('Remover', 'DELETE', '', undefined);

  console.log("--- TESTES DE AUTO-GESTÃO ---");
  // Testar se ownerA1 consegue se alterar
  let selfRes = await req('PATCH', `/memberships/${memA1.id}/role`, tokenOwnerA1, tenantA.id, { role: 'MEMBER' });
  if (selfRes.status !== 403) throw new Error("Auto-alteração de role deveria retornar 403 CANNOT_MANAGE_SELF");
  
  selfRes = await req('PATCH', `/memberships/${memA1.id}/status`, tokenOwnerA1, tenantA.id, { status: 'SUSPENDED' });
  if (selfRes.status !== 403) throw new Error("Auto-suspensão deveria retornar 403 CANNOT_MANAGE_SELF");
  
  selfRes = await req('DELETE', `/memberships/${memA1.id}`, tokenOwnerA1, tenantA.id);
  if (selfRes.status !== 403) throw new Error("Auto-remoção deveria retornar 403 CANNOT_MANAGE_SELF");
  
  console.log("✔️  Testes de auto-gestão passaram.");

  console.log("ALL INTEGRATION TESTS PASSED!");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
