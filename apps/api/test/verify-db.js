const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("--- PROVA FÍSICA DO CATÁLOGO POSTGRESQL ---");

  // 1. Colunas e Restrições na tabela Invitation
  const columnsQuery = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Invitation'
    AND column_name IN ('acceptedAt', 'revokedAt', 'acceptedById', 'updatedAt');
  `;
  console.log("Colunas da Tabela Invitation:");
  console.table(columnsQuery);

  // 2. Foreign Key de acceptedById
  const fkQuery = await prisma.$queryRaw`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      rc.update_rule AS on_update,
      rc.delete_rule AS on_delete
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_name = 'Invitation' AND kcu.column_name = 'acceptedById';
  `;
  console.log("\nForeign Key acceptedById:");
  console.table(fkQuery);

  // 3. Índices na Tabela Invitation
  const indexesQuery = await prisma.$queryRaw`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'Invitation'
    AND (indexname LIKE '%pending%' OR indexname LIKE '%tokenHash%');
  `;
  console.log("\nÍndices Relevantes:");
  console.table(indexesQuery);

  // 4. Migrations aplicadas
  const migrationsQuery = await prisma.$queryRaw`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    ORDER BY finished_at ASC;
  `;
  console.log("\nMigrations Aplicadas:");
  console.table(migrationsQuery);

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
