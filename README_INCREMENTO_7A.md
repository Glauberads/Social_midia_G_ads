# Incremento 7A - Domínio de Conteúdo e Fluxo Inicial

## Como subir a Stack Localmente

1. **Subir Banco de Dados e Serviços Auxiliares (Supabase)**
   Certifique-se de que o Docker está rodando e inicie o Supabase CLI:
   ```bash
   npx supabase start
   # ou
   pnpm supabase start
   ```
   Isso vai iniciar os serviços em `http://127.0.0.1:54321` (API) e `http://127.0.0.1:54323` (Studio).

2. **Subir a API Backend (NestJS)**
   Em um terminal dedicado, inicie a API:
   ```bash
   cd apps/api
   npx ts-node src/main.ts
   # ou o script apropriado do repositório
   ```
   A API rodará em `http://localhost:3001/api`.

3. **Subir o Frontend (Next.js)**
   Em outro terminal, inicie o frontend:
   ```bash
   pnpm --filter web run dev
   ```
   O frontend rodará em `http://localhost:3000`.

## Variáveis de Ambiente Locais Necessárias (`apps/web/.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`: (URL do Supabase API Local, ex: `http://127.0.0.1:54321`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Chave pública do Supabase)
- `NEXT_PUBLIC_API_URL`: `http://localhost:3001/api`

## Fluxo Manual de Teste
1. Acesse `http://localhost:3000/login`
2. Autentique-se com um usuário real ou crie uma conta local.
3. No Dashboard, crie ou selecione um Tenant.
4. Navegue para a guia "Conteúdos" (Solicitações de Conteúdo).
5. Clique em "Nova Solicitação" e preencha os dados (título, briefing, plataforma).
6. Confirme que a solicitação aparece na lista para o tenant logado.
7. Edite a solicitação enquanto o status for `DRAFT`.
8. Clique em "Arquivar". O conteúdo assumirá status `ARCHIVED` e não será mais editável.

## Domínio `ContentRequest` e Estados Suportados
As solicitações possuem os seguintes status (`ContentStatus`):
- `DRAFT`
- `SUBMITTED`
- `GENERATING`
- `READY`
- `APPROVED`
- `REJECTED`
- `FAILED`
- `ARCHIVED`

Plataformas (`ContentPlatform`):
- `INSTAGRAM_FEED`
- `INSTAGRAM_STORY`
- `INSTAGRAM_REEL`

## Rotas da API
- `POST /api/content-requests`: Cria uma nova solicitação.
- `GET /api/content-requests`: Lista solicitações do tenant atual.
- `GET /api/content-requests/:id`: Obtém detalhes.
- `PATCH /api/content-requests/:id`: Edita uma solicitação (se estiver em DRAFT ou REJECTED).
- `POST /api/content-requests/:id/archive`: Arquiva uma solicitação logicamente.

## Limitações Atuais e Riscos Residuais
- **Inteligência Artificial (IA)** ainda **não** está implementada no fluxo, estando reservada para os Incrementos 7B ou posteriores.
- Validação no lado do servidor em relação a permissões rigorosas por role (além do TenantScope) ainda segue sendo refinada.
- Fluxo de agendamento (Integração WhatsApp/Instagram) não implementado.
