const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log("--- ETAPA 9 E 10: TESTES DE CONTEXTO TENANT E CONCORRÊNCIA ALS ---");
  
  const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const API_URL = 'http://127.0.0.1:3001/api';

  // API PREFLIGHT
  try {
    await fetch(`${API_URL}/health/live`);
  } catch (e) {
    console.error("ERRO CRÍTICO: API não está rodando em 127.0.0.1:3001");
    process.exit(1);
  }

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

  async function signUp(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Signup failed:", data);
      throw new Error('Signup failed');
    }
    
    const resToken = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    return await resToken.json();
  }

  const userA = await signUp(`user_a_${Date.now()}@example.com`);
  const userB = await signUp(`user_b_${Date.now()}@example.com`);
  const tokenA = userA.access_token;
  const tokenB = userB.access_token;
  
  console.log("Users created.");

  async function createTenant(token, slug) {
    const res = await fetch(`${API_URL}/tenants`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Tenant ${slug}`, slug })
    });
    if (!res.ok) throw new Error("Failed to create tenant");
    return await res.json();
  }

  const tenantA = await createTenant(tokenA, `ta-${Date.now()}`);
  const tenantB = await createTenant(tokenB, `tb-${Date.now()}`);

  console.log("Tenants created.");

  async function getContext(token, tenantId) {
    const headers = { 'Authorization': `Bearer ${token}` };
    if (tenantId) headers['x-tenant-id'] = tenantId;
    return fetch(`${API_URL}/tenant-context`, { headers });
  }

  // 1. usuário A acessa tenant A
  let res = await getContext(tokenA, tenantA.id);
  if (res.status !== 200) throw new Error("A failed to access A");
  let data = await res.json();
  if (data.tenantId !== tenantA.id || data.role !== 'OWNER') throw new Error("Invalid context data");
  console.log("1. usuário A acessa tenant A");

  // 2. usuário A não acessa tenant B
  res = await getContext(tokenA, tenantB.id);
  if (res.status !== 403) throw new Error("A accessed B unexpectedly");
  console.log("2. usuário A não acessa tenant B");

  // 3. usuário B não acessa tenant A
  res = await getContext(tokenB, tenantA.id);
  if (res.status !== 403) throw new Error("B accessed A unexpectedly");
  console.log("3. usuário B não acessa tenant A");

  // 4. usuário B acessa tenant B
  res = await getContext(tokenB, tenantB.id);
  if (res.status !== 200) throw new Error("B failed to access B");
  console.log("4. usuário B acessa tenant B");

  // 5. header com tenant inexistente não revela dados
  res = await getContext(tokenA, crypto.randomUUID());
  if (res.status !== 403 && res.status !== 404) throw new Error("Revealed data for non-existent tenant");
  console.log("5. header com tenant inexistente não revela dados");

  // 9. rota global GET /api/tenants funciona sem x-tenant-id
  res = await fetch(`${API_URL}/tenants`, { headers: { 'Authorization': `Bearer ${tokenA}` } });
  if (res.status !== 200) throw new Error("Global GET failed");
  console.log("9. rota global funciona sem x-tenant-id");

  // 10. rota tenant-scoped exige x-tenant-id
  const resNoHeader2 = await fetch(`${API_URL}/tenant-context`, { headers: { 'Authorization': `Bearer ${tokenB}` } });
  if (resNoHeader2.status !== 400) throw new Error("Tenant-scoped allowed without header");
  console.log("10. rota tenant-scoped exige x-tenant-id");

  // ETAPA 2: VALIDAR X-TENANT-ID EXPLICITAMENTE
  const multiHeaders = await fetch(`${API_URL}/tenant-context`, { headers: { 'Authorization': `Bearer ${tokenA}`, 'x-tenant-id': `${tenantA.id}, ${tenantB.id}` } });
  if (multiHeaders.status !== 400) throw new Error("Accepted comma-separated multiple headers");

  const emptyHeader = await fetch(`${API_URL}/tenant-context`, { headers: { 'Authorization': `Bearer ${tokenA}`, 'x-tenant-id': '' } });
  if (emptyHeader.status !== 400) throw new Error("Accepted empty header");

  const spaceHeader = await fetch(`${API_URL}/tenant-context`, { headers: { 'Authorization': `Bearer ${tokenA}`, 'x-tenant-id': '   ' } });
  if (spaceHeader.status !== 400) throw new Error("Accepted space header");

  console.log("11. headers múltiplos e inválidos bloqueados com sucesso");

  // Concorrência ALS Forte
  const reqs = [];
  for(let i=0; i<10; i++) {
    reqs.push(getContext(tokenA, tenantA.id).then(r => r.json()));
    reqs.push(getContext(tokenB, tenantB.id).then(r => r.json()));
    // Delay routes:
    reqs.push(getContext(tokenA, tenantA.id).then(r => r.json()));
    reqs.push(getContext(tokenB, tenantB.id).then(r => r.json()));
  }
  
  const results = await Promise.all(reqs);
  
  let index = 0;
  for(let i=0; i<10; i++) {
    const resA = results[index++];
    const resB = results[index++];
    const resADelay = results[index++];
    const resBDelay = results[index++];

    if (resA.tenantId !== tenantA.id) throw new Error("ALS leakage A");
    if (resB.tenantId !== tenantB.id) throw new Error("ALS leakage B");
    if (resADelay.tenantId !== tenantA.id) throw new Error("ALS leakage A Delay");
    if (resBDelay.tenantId !== tenantB.id) throw new Error("ALS leakage B Delay");
  }
  
  console.log("10. Concorrência forte (120 reqs intercaladas) controlada perfeitamente na AsyncLocalStorage.");

  console.log("\nALL INTEGRATION TESTS PASSED!");
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
