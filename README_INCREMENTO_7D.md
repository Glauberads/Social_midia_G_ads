# Incremento 7D - Calendário Editorial e Agendamento

## O que foi implementado

O Incremento 7D introduz o modelo de agendamento (`ContentSchedule`) para solicitações de conteúdo. Ele permite que um conteúdo que já esteja no status `APPROVED` seja agendado para publicação no futuro.

### Model e Timezone
- Foi criada a tabela `ContentSchedule` vinculada 1:1 de forma ativa ao `ContentRequest` (uma solicitação possui no máximo um agendamento com status `SCHEDULED` ou `DUE`).
- Toda a persistência de datas é realizada em formato **UTC absoluto** no campo `scheduledFor`. O fuso horário de origem escolhido pelo usuário é armazenado separadamente no campo `timezone` (formato IANA, ex: `America/Sao_Paulo`) para fins de exibição e cálculo de dias corretos, evitando quebras caso o fuso horário mude (como horário de verão).
- Para evitar sobreposição, é extraído um campo derivado `scheduledMinute` gerado automaticamente (truncado para o minuto) que ajuda a garantir constraints de slot, impedindo que dois conteúdos do mesmo tenant sejam agendados simultaneamente no exato mesmo minuto.

### Endpoints
- `POST /api/content-requests/:id/schedule`: Cria um agendamento novo a partir do UTC iso e do timezone informados (desde que `APPROVED`).
- `PATCH /api/content-requests/:id/schedule`: Realiza o reagendamento para uma nova data/hora.
- `POST /api/content-requests/:id/schedule/cancel`: Realiza o cancelamento lógico, marcando o agendamento atual como `CANCELED` com um motivo (reason), mantendo histórico em vez de apagar do banco.
- `GET /api/content-requests/:id/schedule`: Retorna os detalhes de agendamento para a view de detalhes do briefing.
- `GET /api/calendar`: Novo endpoint dedicado no `CalendarController` para listar múltiplos agendamentos através de um intervalo de datas para visualização.

### Concorrência e Worker DUE
- As mudanças de estado são gerenciadas localmente nos Use Cases utilizando a Service de `TenantTransactionService`, assegurando o registro das mudanças no `AuditLog`.
- Foi criado um background process no Worker chamado `DueScheduleProcessor`. Ele executa em polling controlado (batch sizing limit) buscando agendas cujo horário `scheduledFor` tenha chegado ou passado de forma global rápida, e, *para cada match*, abre uma transação enclausurada e adquire lock na linha específica com `FOR UPDATE SKIP LOCKED`.
- Após adquirir o lock em contexto tenant, ele avança o estado para `DUE`, registra o `AuditLog` e remove o bloqueio, garantindo alta simultaneidade em workers replicados sem conflitos (Sem Lost Updates).

### RLS
- Todo o módulo de Schedule está regido pelas Row Level Security Policies do PostgreSQL, validando o contexto de permissões ativas e barrando leituras (`SELECT`), inclusões, edições e remoções trans-tenant ou sem autenticação correta de tenant.
- A exclusão via `DELETE` está globalmente proibida (como no ContentRequest e Generation) visando preservação de rastros.
- O Worker não utiliza um Bypass genérico global no Prisma Client de edição; ele executa `set_config('app.tenant_id')` limitando suas ações à mesma blindagem RLS garantida nas APIs.

### Limitações do Incremento
- Não inclui, propositalmente, integração com Instagram.
- Não inclui, propositalmente, publicação real de conteúdo via Meta Graph API.
- Não inclui notificações via WhatsApp.
Essas responsabilidades ficam isoladas nos próximos incrementos; aqui validamos estritamente a mudança de estados operacionais e segurança.
