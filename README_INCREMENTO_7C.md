# Incremento 7C — revisão e aprovação editorial

## Modelo editorial

`ContentRevision` é o registro imutável de cada versão de trabalho. Ele pertence a um tenant e a um `ContentRequest`, pode apontar para o `GeneratedContent` de origem e guarda legenda, CTA, hashtags, autor, versão, origem e estado. Edições nunca sobrescrevem uma versão anterior.

Origens: `AI_GENERATED`, `MANUAL_EDIT` e `REGENERATED`. Estados: `DRAFT`, `APPROVED`, `REJECTED` e `SUPERSEDED`. A constraint `(contentRequestId, version)` e o lock pessimista do request serializam a numeração; um índice parcial permite somente um `DRAFT` ativo por request.

O worker cria a revisão de origem IA na mesma transação que persiste o resultado e muda o request para `READY`. Reentregas terminais são no-op. Uma geração após rejeição supersede o draft existente e cria uma versão `REGENERATED`.

## Estados e concorrência

- `READY → APPROVED`: somente a revisão ativa `DRAFT`; grava `approvedAt` e `approvedById` atomicamente.
- `READY → REJECTED`: somente a revisão ativa `DRAFT`; exige e sanitiza um motivo.
- `REJECTED → SUBMITTED`: usa o submit de geração já existente e cria nova geração.
- `READY|REJECTED → nova revisão DRAFT`: copia a versão-base e aplica apenas os campos editados.
- `APPROVED` e `ARCHIVED` são terminais neste incremento.

Create, approve, reject e persistência do worker bloqueiam a linha de `ContentRequest` com `FOR UPDATE`. Por isso, edições concorrentes recebem versões ordenadas; approve/reject concorrentes produzem uma transição vencedora e conflito controlado na outra. Request e revisão mudam na mesma transação.

## API e permissões

- `GET /api/content-requests/:id/revisions?page=1&limit=20`
- `GET /api/content-requests/:id/revisions/:revisionId`
- `POST /api/content-requests/:id/revisions`
- `POST /api/content-requests/:id/revisions/:revisionId/approve`
- `POST /api/content-requests/:id/revisions/:revisionId/reject` com `{ "reason": "..." }`

OWNER, ADMIN e MEMBER podem editar, aprovar e rejeitar. Tenant, usuário e papel são derivados do contexto autenticado; valores enviados no body não concedem acesso. O histórico é paginado por versão decrescente e não expõe prompt ou metadata do provider.

## RLS e auditoria

A migration `20260803000000_add_content_revision_editorial` cria e faz backfill das revisões técnicas existentes. `ContentRevision` usa `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`. As policies exigem tenant ativo e validam que request e resultado referenciados pertencem ao mesmo tenant; delete direto é negado.

Audit logs registram revisão manual, nova revisão gerada, aprovação e rejeição. O motivo é sanitizado; tokens, keys, prompt interno e payload bruto do provider não são registrados.

## Fluxo manual

Gere um request até `READY`, abra `/dashboard/content/[id]`, navegue pelas versões, edite a atual e salve uma nova versão. Aprove-a ou rejeite-a com motivo. Em `REJECTED`, edite novamente ou use “Gerar nova versão”. `APPROVED` fica somente leitura.

## Testes e limites

Os testes cobrem versionamento, preservação do histórico, idempotência do worker, concorrência approve/reject, validação HTTP, isolamento RLS e estados da interface. O script E2E local usa o provider fake e valida geração e regeneração editoriais.

Este incremento não publica conteúdo e não inclui Instagram, WhatsApp, agendamento, calendário editorial, geração de imagem, billing ou deploy.
