# ADR-013 — Estratégia de Aplicação de Row-Level Security com Prisma

## Status
Aprovado

## Contexto
O projeto adota o Supabase com PostgreSQL que oferece Row-Level Security (RLS) nativo.
No entanto, o Prisma, por padrão, conecta-se usando a pool role que geralmente atua de forma privilegiada (bypassing RLS) se não for adequadamente injetada com o contexto de sessão, tornando a proteção do Supabase ineficaz a menos que se aplique `SET LOCAL` antes das queries.
Ao mesmo tempo, delegar a segurança multi-tenant *exclusivamente* ao banco de dados cria um risco arquitetural: a aplicação se torna frágil caso o banco perca as configurações.

## Decisão

A autoridade primária sobre o isolamento do tenant será da **Aplicação (API NestJS)**. 
O RLS será configurado estritamente como **Segunda Camada de Defesa** (Defense in Depth).

1. **Obrigatoriedade do TenantContext**: Nenhum Use Case ou Repository manipulará recursos multi-tenant sem receber a entidade `TenantContext`.
2. **Sem bypass livre**: Controllers nunca poderão injetar `tenant_id` arbitrário lido de payloads (body/query). A extração do tenant será feita exclusivamente no middleware de Autenticação/Autorização validando o token JWT.
3. **Prisma Extension**: Criaremos uma Extensão do Prisma (Client Extension) ou utilizaremos transações forçadas que, ao receberem o `TenantContext`, executam `SELECT set_config('request.jwt.claims', $1, true)` aplicando o `tenant_id` no banco na mesma transação.
4. **Jobs e Workers**: Filas recuperarão o `tenantId` seguro de dentro do payload do job e reconstruirão um `TenantContext` artificial mas autenticado internamente antes de acionar o Use Case.
5. **Operações Administrativas**: Operações que precisem ver todos os tenants terão um Use Case explícito, exigindo a role `isPlatformAdmin = true`. Nesses casos, o repositório usará uma conexão Prisma isolada que não injeta RLS (via service_role), e a ação gerará um Log de Auditoria severo.

## Consequências
- Aumento da segurança através de redundância (App + BD).
- Aumento de complexidade no bootstrap do Repositório Prisma.
- Testes de isolamento cruzado serão mandatórios para garantir que a extensão do Prisma não vaze sessões na pool de conexão (garantido através do escopo Request-Scoped ou injeção correta da transaction).
