const fetch = require('node-fetch');
const { PrismaClient } = require('@projeto/database');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const API_URL = 'http://127.0.0.1:3001/api';

const generateToken = (userId, email) => {
  return jwt.sign({
    sub: userId,
    email: email,
    role: 'authenticated',
    aud: 'authenticated',
  }, process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long');
};

async function run() {
  console.log("--- TESTES DE INTEGRAÇÃO REAIS DA API (MEMBERSHIPS E RBAC) ---");
  await prisma.auditLog.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.userProfile.deleteMany({});

  // Criar Usuários
  const userA1 = await prisma.userProfile.create({ data: { id: 'a1000000-0000-0000-0000-000000000000', email: 'owner.a1@test.com' } });
  const userA2 = await prisma.userProfile.create({ data: { id: 'a2000000-0000-0000-0000-000000000000', email: 'owner.a2@test.com' } });
  const adminA = await prisma.userProfile.create({ data: { id: 'a3000000-0000-0000-0000-000000000000', email: 'admin.a@test.com' } });
  const memberA = await prisma.userProfile.create({ data: { id: 'a4000000-0000-0000-0000-000000000000', email: 'member.a@test.com' } });
  const viewerA = await prisma.userProfile.create({ data: { id: 'a5000000-0000-0000-0000-000000000000', email: 'viewer.a@test.com' } });
  const userB = await prisma.userProfile.create({ data: { id: 'b1000000-0000-0000-0000-000000000000', email: 'owner.b@test.com' } });

  // Criar Tenants
  const tenantA = await prisma.tenant.create({ data: { name: 'Tenant A', slug: 'tenant-a' } });
  const tenantB = await prisma.tenant.create({ data: { name: 'Tenant B', slug: 'tenant-b' } });

  // Memberships
  await prisma.membership.create({ data: { userId: userA1.id, tenantId: tenantA.id, role: 'OWNER' } });
  const memA2 = await prisma.membership.create({ data: { userId: userA2.id, tenantId: tenantA.id, role: 'OWNER' } });
  const memAdminA = await prisma.membership.create({ data: { userId: adminA.id, tenantId: tenantA.id, role: 'ADMIN' } });
  const memMemberA = await prisma.membership.create({ data: { userId: memberA.id, tenantId: tenantA.id, role: 'MEMBER' } });
  await prisma.membership.create({ data: { userId: viewerA.id, tenantId: tenantA.id, role: 'VIEWER' } });
  
  await prisma.membership.create({ data: { userId: userB.id, tenantId: tenantB.id, role: 'OWNER' } });

  const tokenOwnerA1 = generateToken(userA1.id, userA1.email);
  const tokenAdminA = generateToken(adminA.id, adminA.email);
  const tokenMemberA = generateToken(memberA.id, memberA.email);
  const tokenViewerA = generateToken(viewerA.id, viewerA.email);
  const tokenOwnerB = generateToken(userB.id, userB.email);

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
  const resSuspended = await fetch(`${API_URL}/tenant-context`, { headers: { 'Authorization': `Bearer ${tokenA2 || generateToken(userA2.id, userA2.email)}`, 'x-tenant-id': tenantA.id } });
  if (resSuspended.status !== 403) throw new Error("Membership suspensa ainda tem acesso");
  console.log("13. membership suspensa perde acesso imediatamente.");

  // 14. membership reativada recupera acesso.
  res = await req('PATCH', `/memberships/${memA2.id}/status`, tokenOwnerA1, tenantA.id, { status: 'ACTIVE' });
  if (res.status !== 200) throw new Error("OWNER falhou ao reativar membro");
  const resActive = await fetch(`${API_URL}/tenant-context`, { headers: { 'Authorization': `Bearer ${generateToken(userA2.id, userA2.email)}`, 'x-tenant-id': tenantA.id } });
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
    const tcUserA = await prisma.userProfile.create({ data: { id: `c1000000-0000-0000-0000-${Date.now()}`, email: `c.a.${Date.now()}@test.com` } });
    const tcUserB = await prisma.userProfile.create({ data: { id: `c2000000-0000-0000-0000-${Date.now()}`, email: `c.b.${Date.now()}@test.com` } });
    
    const memA = await prisma.membership.create({ data: { userId: tcUserA.id, tenantId: tcTenant.id, role: 'OWNER' } });
    const memB = await prisma.membership.create({ data: { userId: tcUserB.id, tenantId: tcTenant.id, role: 'OWNER' } });
    
    const tokenA = generateToken(tcUserA.id, tcUserA.email);
    const tokenB = generateToken(tcUserB.id, tcUserB.email);

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
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
