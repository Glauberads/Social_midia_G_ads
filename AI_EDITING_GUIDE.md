# Guia de Edição por Inteligência Artificial (AI_EDITING_GUIDE)

Este projeto segue uma rigorosa estrutura de Monorepo Modular separando Next.js e NestJS.
IAs (e humanos) devem seguir este guia incondicionalmente.

## 🗺️ Mapa de Navegação

1. **Interface do Usuário / Páginas / Telas**:
   - Diretório: `apps/web/src/features/*`
   - O Next.js é estritamente UI. Nenhuma regra de banco de dados ou acesso direto a provedores (Evolution, Meta) deve residir aqui.
   
2. **Backend / API / Regras de Negócio**:
   - Diretório: `apps/api/src/modules/*`
   - Segue os princípios da Clean Architecture. Cada módulo contém `domain`, `application`, `infrastructure` e `presentation`.
   
3. **Contratos e Tipos**:
   - Diretório: `packages/contracts/src/`
   - O Frontend não pode importar tipos do Backend, deve sempre importar de `@projeto/contracts`.

4. **Banco de Dados**:
   - Diretório: `packages/database/prisma/schema.prisma`
   - O Prisma Client só será instanciado no `packages/database` e importado pelo Backend/Worker.

## 🛑 Arquivos Intocáveis sem Revisão Arquitetural
- `packages/database/prisma/schema.prisma` (qualquer alteração estrutural impacta o RLS).
- Interfaces de providers no Backend (alterações quebram Adapters implementados).
- `pnpm-workspace.yaml` e configurações de raiz do Turborepo.

## 🔄 Procedimentos Obrigatórios

### Adicionar uma Integração Externa (Adapter)
1. Crie a Interface (Port) na camada de Aplicação: `apps/api/src/modules/*/application/ports/[Nome]Provider.ts`.
2. Implemente o Adapter na camada de Infraestrutura: `apps/api/src/modules/*/infrastructure/adapters/[Nome]Adapter.ts`.
3. Registre a injeção de dependência no módulo NestJS, amarrando a interface à implementação.
4. **NÃO acople o caso de uso** à implementação.

### Alterar Contratos Públicos (API)
- IA deve apresentar **Plano de Impacto**.
- Atualizar DTOs e Zod Schemas em `packages/contracts/src`.
- Sincronizar o Controller no Backend e o Service de fetch no Frontend.

## 🛡️ Regras de Segurança
- IAs NUNCA devem criar refatorações globais (busca e substituição em todo o monorepo) a menos que explicitamente solicitado pelo usuário sênior.
- `tenant_id` não pode ser ignorado nas buscas do Prisma. Utilize `TenantContext` injetado no Use Case.
