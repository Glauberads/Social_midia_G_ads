# Guia de Deploy de Homologação (Staging)

## Arquitetura
A infraestrutura de homologação do monorepo roda via Docker Compose, utilizando o Traefik da VPS como Reverse Proxy com rescisão TLS.
Serviços locais (Docker):
- **Web (Next.js)**: Frontend standalone.
- **API (NestJS)**: Backend. 
- **Worker**: Processamento de filas e background jobs.
- **Redis**: Instância de cache/filas isolada.
- **Migration**: Container one-shot para Prisma Migrate.

## Pré-requisitos
- SSH Access à VPS via alias `glauber-staging` (a definir).
- `.env.staging` populado (use `.env.staging.example` como base). Nota: Integração Meta é opcional para o boot, mas obrigatória para funcionalidades do Instagram. O callback deve apontar para `https://api-staging.glauberads.com.br/api/integrations/meta/callback` ou equivalente configurado no Meta App.
- Repositório atualizado na máquina host.

## Procedimento de Deploy
1. **Preparação**: Realize o pull das alterações na VPS (ou baixe a imagem do registry).
2. **Environment**: Valide se o `.env.staging` está na raiz com as chaves corretas de Supabase e Meta.
3. **Migration One-Shot**:
   Execute a migração de banco isolada para evitar race conditions:
   ```bash
   docker compose -f docker-compose.staging.yml run --rm migration
   ```
4. **Deploy Completo**:
   Caso o exit code do comando acima seja `0` (sucesso), suba a stack completa:
   ```bash
   docker compose -f docker-compose.staging.yml up -d redis api worker web
   ```
5. **Acompanhamento (Healthchecks)**:
   Os containers possuem políticas rigorosas de dependência por `service_healthy`.
   Use `docker ps` e `docker compose logs -f` para validar.

## Rollback
Se houver falha, pode-se reverter utilizando a imagem/commit anterior:
```bash
git checkout <commit-anterior>
docker compose -f docker-compose.staging.yml up -d --build
```
> [!WARNING]
> Certifique-se de documentar alterações de esquema destrutivas, pois podem inviabilizar rollbacks fáceis sem o restore de dump do Supabase.

## Smoke Test (VPS)
Após o ambiente indicar `healthy`:
1. Acesse `https://app-staging.dominio.com` e verifique login/tenant.
2. Acesse `https://api-staging.dominio.com/api/health/live`.
3. Verifique se o Worker processa eventos no Redis sem erros de crash.
4. Execute aprovações fake e calendários para confirmar comunicação com API e integridade do banco.
