# Incremento 7B — pipeline de geração

## Arquitetura

`POST /api/content-requests/:id/submit` valida tenant/RBAC e cria uma `ContentGeneration` em uma transação RLS. Depois publica um job mínimo na fila BullMQ `content-generation`. Se o enqueue falhar, a API executa compensação: remove a geração ainda `QUEUED` e restaura o status anterior. Redis transporta jobs, mas PostgreSQL permanece a fonte de verdade.

O worker relê a geração e o briefing dentro do contexto RLS do tenant, muda `SUBMITTED → GENERATING`, chama a abstração `ContentGenerationProvider` e persiste `GeneratedContent`, `READY` e `AuditLog`. Jobs terminais são no-op, e `generationId @unique` impede resultado duplicado em restart/reentrega.

Estados: `DRAFT|REJECTED → SUBMITTED → GENERATING → READY`; falha terminal leva a `FAILED`. `POST /api/content-requests/:id/retry` é a ação explícita que permite `FAILED → SUBMITTED`. Conteúdo `READY` ou `ARCHIVED` não pode ser submetido.

## Ambiente local

1. Inicie Docker/Supabase conforme o fluxo atual: `supabase start`.
2. Inicie somente o Redis local: `docker compose -f docker-compose.local.yml up -d redis`.
3. Confira o Redis: `docker compose -f docker-compose.local.yml exec redis redis-cli ping`.
4. Aplique as migrations: `pnpm --filter @projeto/database exec prisma migrate reset --force`.
5. Configure os `.env` a partir de `apps/api/.env.example`, `apps/worker/.env.example` e `apps/web/.env.example`.
6. Compile a API (`pnpm --filter api build`) e inicie API, worker e web em terminais separados: `pnpm --filter api start`, `pnpm --filter worker dev`, `pnpm --filter web dev`.

Para limpar apenas o Redis local: `docker compose -f docker-compose.local.yml down`. A persistência do Redis foi desabilitada de propósito no desenvolvimento.

## Variáveis

- `REDIS_URL` (padrão local `redis://127.0.0.1:6379`)
- `QUEUE_PREFIX` (separa ambientes)
- `GENERATION_MAX_ATTEMPTS` (API/BullMQ)
- `WORKER_CONCURRENCY`
- `AI_PROVIDER=fake|openai-compatible`
- `AI_API_KEY` (somente worker e somente provider real)
- `AI_MODEL`, `AI_BASE_URL`, `AI_TIMEOUT_MS`

`AI_PROVIDER=fake` é determinístico e aceita marcadores no briefing: `[[fake:timeout]]`, `[[fake:transient]]` e `[[fake:permanent]]`. O bootstrap rejeita fake em produção. O prompt `pt-BR-v1` exige JSON estruturado, pt-BR, limites, aderência a plataforma/tom e proíbe inventar fatos.

## Retries, idempotência e health

BullMQ usa 3 tentativas por padrão, backoff exponencial de 2 segundos, retenção limitada e lock maior que o timeout do provider. Só timeout, 429, HTTP 5xx e rede são transitórios; payload/resposta inválida não repete. Clique duplo reutiliza a geração ativa; a chave `content-generation-<requestId>-<n>` vira o `jobId`; reentrega/restart não cria outra versão.

`GET /api/health/live` indica processo vivo. `GET /api/health/ready` verifica PostgreSQL, Redis e fila; Redis indisponível torna readiness não saudável. O worker emite `worker_ready` ao conectar, sem imprimir configuração ou secrets.

## Fluxo manual e limites

Crie um briefing, abra `/dashboard/content/[id]`, confirme “Enviar para geração” e acompanhe o polling de 4 segundos até o resultado. Use um marcador fake para validar `FAILED` e “Tentar novamente”. O incremento gera somente legenda, CTA e hashtags. Não inclui imagem, WhatsApp, Instagram, publicação, agendamento, billing ou deploy.
