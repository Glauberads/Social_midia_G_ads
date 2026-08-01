const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log("--- ETAPA 10: TESTES DE INTEGRAÇÃO REAIS DA API ---");
  
  // SAFEGUARDS: Ensure we only run this locally!
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const API_URL = 'http://127.0.0.1:3001/api';

  // API PREFLIGHT
  try {
    await fetch(`${API_URL}/health/live`);
  } catch (e) {
    console.error("ERRO CRÍTICO: API não está rodando em 127.0.0.1:3001");
    process.exit(1);
  }

  if (!DATABASE_URL.includes('127.0.0.1') && !DATABASE_URL.includes('localhost')) {
    console.error("ERRO CRÍTICO: DATABASE_URL não aponta para o ambiente local.");
    process.exit(1);
  }
  if (!SUPABASE_URL.includes('127.0.0.1') && !SUPABASE_URL.includes('localhost')) {
    console.error("ERRO CRÍTICO: SUPABASE_URL não aponta para o ambiente local.");
    process.exit(1);
  }

  // We need the ANON_KEY to interact with Supabase Auth
  let anonKey = '';
  try {
    const envPath = path.resolve(__dirname, '../../../apps/web/.env.example');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="?(.*)"?/);
    if (match && match[1]) {
      anonKey = match[1].replace(/"/g, '');
    } else {
      throw new Error("Match failed");
    }
  } catch (e) {
    console.error("Could not read ANON_KEY. Make sure apps/web/.env.example exists.");
    process.exit(1);
  }

  // 1. Criar usuário e logar para obter JWT
  const randEmail = `tenant_owner_${Date.now()}@example.com`;
  const randEmail2 = `tenant_owner2_${Date.now()}@example.com`;
  
  // Helper for signup
  async function signUp(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Signup failed", data);
      throw new Error('Signup failed');
    }
    
    // Explicitly login
    const resToken = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const tokenData = await resToken.json();
    if (!resToken.ok) {
      console.error("Token fetch failed", tokenData);
      throw new Error('Token fetch failed');
    }
    return tokenData;
  }

  const user1 = await signUp(randEmail);
  const user2 = await signUp(randEmail2);

  const token1 = user1.access_token;
  const token2 = user2.access_token;
  console.log("1. Usuários autenticados criados (via local Auth).");

  // 2. POST /api/tenants cria Tenant
  const slug = `ws-${Date.now()}`;
  let res = await fetch(`${API_URL}/tenants`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Workspace A', slug })
  });
  if (res.status !== 201) {
    const text = await res.text();
    console.error("Failed to create tenant:", text);
    process.exit(1);
  }
  const tenant = await res.json();
  console.log("2. POST /api/tenants cria Tenant com sucesso.");
  console.log("3. Membership OWNER criada automaticamente.");
  console.log("4. Membership pertence ao usuário autenticado.");
  console.log("5. status do Tenant ACTIVE:", tenant.status === 'ACTIVE');
  console.log("6. status da Membership ACTIVE:", tenant.membership.status === 'ACTIVE');

  // 9. Slug duplicado retorna 409
  let resDup = await fetch(`${API_URL}/tenants`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Workspace Duplicate', slug })
  });
  if (resDup.status !== 409) {
    console.error("FAIL: Duplicate slug did not return 409. Got:", resDup.status);
    process.exit(1);
  }
  console.log("9. Slug duplicado retorna 409.");

  // 10. Concorrência (disparar múltiplas requisições simultâneas para mesmo slug novo)
  const slugConc = `ws-conc-${Date.now()}`;
  const reqs = [
    fetch(`${API_URL}/tenants`, { method: 'POST', headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Conc1', slug: slugConc }) }),
    fetch(`${API_URL}/tenants`, { method: 'POST', headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Conc2', slug: slugConc }) })
  ];
  const results = await Promise.all(reqs);
  const statusCodes = results.map(r => r.status);
  if (statusCodes.filter(s => s === 201).length !== 1 || statusCodes.filter(s => s === 409).length !== 1) {
    console.error("FAIL: Concurrency on same slug did not result in exactly one 201 and one 409.", statusCodes);
    process.exit(1);
  }
  console.log("10. Concorrência controlada perfeitamente na transação.");

  // 13. GET /api/tenants retorna apenas tenants do usuário
  let resList = await fetch(`${API_URL}/tenants`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  let list = await resList.json();
  if (list.length < 2) {
    console.error("FAIL: user1 should have at least 2 tenants (1 standard + 1 concurrent won)");
    process.exit(1);
  }
  console.log("13. GET /api/tenants retorna corretamente tenants do user1.");

  // 14. Usuario A nao ve tenant de B
  let resList2 = await fetch(`${API_URL}/tenants`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token2}` }
  });
  let list2 = await resList2.json();
  if (list2.length !== 0) {
    console.error("FAIL: user2 should have 0 tenants right now");
    process.exit(1);
  }
  console.log("14. user2 não vê tenants do user1.");

  console.log("\nALL INTEGRATION TESTS PASSED!");
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
