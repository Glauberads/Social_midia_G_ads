import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS test_rls (id int, val text)`;
  await prisma.$executeRaw`ALTER TABLE test_rls ENABLE ROW LEVEL SECURITY`;
  await prisma.$executeRaw`ALTER TABLE test_rls FORCE ROW LEVEL SECURITY`;
  await prisma.$executeRaw`DROP POLICY IF EXISTS test_rls_policy ON test_rls`;
  await prisma.$executeRaw`CREATE POLICY test_rls_policy ON test_rls USING (false)`;
  await prisma.$executeRaw`INSERT INTO test_rls (id, val) VALUES (1, 'a')`;
  const count = await prisma.$executeRaw`SELECT COUNT(*) FROM test_rls`;
  console.log('COUNT:', count);
  await prisma.$executeRaw`DROP TABLE test_rls`;
}
main().catch(console.error).finally(() => prisma.$disconnect());
