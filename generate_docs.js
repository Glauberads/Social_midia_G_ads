const fs = require('fs');
const path = require('path');

const write = (file, content) => {
  const fullPath = path.join(__dirname, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
};

// ==========================================
// CENTRAL DOCS
// ==========================================

write('PROJECT_MAP.md', `
# Project Map - Social Media IA Glauber Ads

## Arquitetura
Monorepo gerenciado com Turborepo.
- **apps/web**: Next.js (Frontend estrito)
- **apps/api**: NestJS (Backend com Arquitetura Hexagonal)
- **apps/worker**: Processamento assíncrono BullMQ
- **packages/***: Contratos, banco de dados (Prisma) e configurações

## Fluxo Principal
1. Pedido via WhatsApp (Evolution API -> API -> Worker).
2. Geração de Conteúdo (Worker -> OpenAI/Ideogram -> API).
3. Aprovação explícita e auditável (Interface Next.js).
4. Agendamento e Publicação (API -> Meta Graph API).
`);

write('AI_EDITING_GUIDE.md', `
# AI Editing Guide

## Onde editar cada categoria
- **Regras de negócio / Casos de uso**: \`apps/api/src/modules/*/application/use-cases/\`
- **Telas e Componentes**: \`apps/web/src/features/*/components/\`
- **Banco de Dados**: \`packages/database/prisma/schema.prisma\`
- **Contratos da API**: \`packages/contracts/src/\`

## Regras Inegociáveis para IA
- **NÃO** misture frontend e backend.
- **NÃO** adicione bibliotecas externas sem permissão.
- **NÃO** faça bypass do TenantContext no backend.
- Sempre crie um Plano de Impacto antes de alterar contratos.
- Atualize os arquivos README dos módulos após mudanças.
`);

write('SECURITY_GUIDE.md', `
# Security Guide
- **Multi-Tenant**: Validação dupla (Middleware + RLS).
- **Segredos**: Nunca exportar credenciais no frontend (\`apps/web\`).
- **Auditoria**: Toda ação sensível de mutação deve gerar um AuditLog.
- **Permissões**: Uso restrito do papel de Admin da Plataforma.
`);

write('ENVIRONMENT.md', `
# Variáveis de Ambiente Necessárias
(Exemplo, não colocar valores reais aqui)
- \`DATABASE_URL\`: String de conexão (Pooling).
- \`DIRECT_URL\`: Conexão direta para migrations.
- \`SUPABASE_URL\`, \`SUPABASE_SERVICE_KEY\`
- \`REDIS_URL\`
- \`WHATSAPP_API_URL\`, \`WHATSAPP_API_KEY\`
- \`OPENAI_API_KEY\`
`);

write('CHECKLIST_FUNDACAO.md', `
# Checklist Fase Zero
- [x] Árvore do Monorepo criada.
- [x] Documentação central gerada.
- [x] ADRs iniciais registrados.
- [x] Schema inicial com mapeamento Tenant.
`);

// ==========================================
// STANDARDS
// ==========================================

write('docs/integrations/WEBHOOK_STANDARD.md', `
# Padrão de Webhooks
Toda integração via webhook deve incluir:
1. Verificação de assinatura do provedor.
2. Persistência do evento bruto antes do processamento.
3. \`idempotencyKey\` para evitar duplicação.
4. Processamento assíncrono via fila.
`);

write('docs/operations/JOB_STANDARD.md', `
# Padrão de Jobs e Filas
Todo Job deve conter no payload:
- \`jobId\` e \`jobType\`
- \`tenantId\` (Obrigatório para restauração de contexto)
- \`correlationId\`
- \`payloadVersion\` e \`attempt\`
Nunca trafegar segredos no payload.
`);

write('docs/security/AI_SECURITY.md', `
# Segurança em IA (AI Security)
- Proteção contra Prompt Injection: Delimitar entradas de usuário estritamente.
- Validação de Saída (Structured Output + Zod).
- Limites de timeout e custos por tenant.
- Varredura de links em textos gerados.
`);

// ==========================================
// DECISION RECORDS (ADRs)
// ==========================================

const adrs = [
  { id: '001', title: 'Utilização de Monorepo (Turborepo)', context: 'Necessidade de compartilhar contratos e tipos.' },
  { id: '002', title: 'Separação entre Frontend e Backend', context: 'Frontend (Next.js) e Backend (NestJS) estritamente isolados para segurança.' },
  { id: '003', title: 'Escolha do Next.js', context: 'Framework React focado na apresentação.' },
  { id: '004', title: 'Escolha do NestJS', context: 'Injeção de dependência e arquitetura modular forçada.' },
  { id: '005', title: 'PostgreSQL e Estratégia Multi-tenant', context: 'Separação lógica por tenant_id.' },
  { id: '006', title: 'Uso do Supabase', context: 'Infraestrutura inicial para Postgres e Storage.' },
  { id: '007', title: 'Arquitetura Modular Hexagonal', context: 'Regras de negócio isoladas de frameworks.' },
  { id: '008', title: 'Abstração de Fornecedores Externos', context: 'Uso de Adapters (ex: WhatsAppProvider).' },
  { id: '009', title: 'Utilização Limitada do n8n', context: 'Apenas para integrações auxiliares, nunca fonte de verdade.' },
  { id: '010', title: 'Filas e Processamento Assíncrono', context: 'Redis e BullMQ para jobs pesados e webhooks.' },
  { id: '011', title: 'Política de Auditoria', context: 'Tudo deve ser auditável e ligado a um TenantContext.' },
  { id: '012', title: 'Estratégia de Observabilidade', context: 'Logs estruturados e correlationIds.' },
];

adrs.forEach(adr => {
  write(\`docs/decisions/ADR-\${adr.id}-\${adr.title.toLowerCase().replace(/\\s+/g, '-')}.md\`, \`
# ADR-\${adr.id}: \${adr.title}
**Status**: Aprovado
**Contexto**: \${adr.context}
**Decisão**: Aplicado na fundação do projeto.
  \`);
});

write('docs/decisions/ADR-013-estrategia-row-level-security-com-prisma.md', `
# ADR-013: Estratégia de Aplicação de Row-Level Security com Prisma
**Status**: Aprovado
**Contexto**: O Prisma por padrão usa uma única role e ignora o RLS do Supabase se não for configurado dinamicamente com set_config().
**Decisão**: 
1. O backend será a autoridade primária de segurança, utilizando \`TenantContext\` obrigatório nos Use Cases.
2. Repositories receberão o \`TenantContext\` injetado e aplicarão \`tenant_id\` em todas as queries explicitamente.
3. Como defesa secundária (RLS), o cliente Prisma usará uma Extension de Client que executa \`SET LOCAL request.jwt.claims = ...\` contendo o tenant_id antes das transações críticas, garantindo que o PostgreSQL RLS atue em conjunto.
`);

write('docs/decisions/ADR-014-limites-responsabilidade-n8n.md', `
# ADR-014: Limites de Responsabilidade do n8n
**Status**: Aprovado
**Decisão**: O n8n é proibido de armazenar estados críticos, aprovar posts, publicar diretamente sem consultar a API ou gerenciar regras de negócios do núcleo. Ele atua estritamente como orquestrador auxiliar de APIs externas e notificador de baixa prioridade.
`);

// ==========================================
// PRISMA SCHEMA & CONTRACTS
// ==========================================

write('packages/database/prisma/schema.prisma', \`
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  users               Membership[]
  whatsappConnections WhatsAppConnection[]
  posts               Post[]
}

model User {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email     String   @unique
  memberships Membership[]
}

model Membership {
  id       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId   String  @db.Uuid
  tenantId String  @db.Uuid
  role     String  // ADMIN, EDITOR, VIEWER

  user     User    @relation(fields: [userId], references: [id])
  tenant   Tenant  @relation(fields: [tenantId], references: [id])

  @@unique([userId, tenantId])
}

model WhatsAppConnection {
  id         String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId   String @db.Uuid
  instanceId String
  status     String // CONNECTED, DISCONNECTED
  
  tenant     Tenant @relation(fields: [tenantId], references: [id])
}

model Post {
  id        String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String @db.Uuid
  status    String // draft, generating, awaiting_review, approved, published
  content   String?
  
  tenant    Tenant @relation(fields: [tenantId], references: [id])
}
\`);

write('packages/contracts/src/TenantContext.ts', \`
export interface TenantContext {
  tenantId: string;
  userId: string;
  membershipId: string;
  roles: string[];
  permissions: string[];
  requestId: string;
  source: string;
  isPlatformAdmin: boolean;
}
\`);

write('packages/contracts/src/index.ts', \`
export * from './TenantContext';
// Aqui serão exportados os schemas do Zod de DTOs compartilhados
\`);

// ==========================================
// ABSTRACT PROVIDERS (PORTS)
// ==========================================

const portsPath = 'apps/api/src/modules/whatsapp-connections/application/ports';
write(\`\${portsPath}/WhatsAppProvider.ts\`, \`
export interface WhatsAppProvider {
  sendMessage(to: string, content: string): Promise<void>;
  getConnectionStatus(instanceId: string): Promise<string>;
}
\`);

console.log("Documents and specific files generated successfully.");
