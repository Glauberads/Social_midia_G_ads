# Incremento 9A — Containerização e Deploy de Homologação na VPS

Este incremento preparou a infraestrutura Docker e Compose do monorepo para deploy de homologação na VPS, isolando os serviços de testes, garantindo builds reproduzíveis e protegendo credenciais sensíveis via Traefik.

## O que foi realizado
- Auditoria do Repositório (Local)
- Limpeza de arquivos untracked residuais
- Setup do `next.config.js` com `output: "standalone"`
- Criação de Dockerfiles Multi-stage nativos (Turbo prune) para `web`, `api`, `worker` e `migration`
- Configuração de `.dockerignore` rígido
- Arquivo `docker-compose.staging.yml` pronto para deploy remoto com dependências hierárquicas e Traefik
- Isolamento de serviços (Redis exclusivo, migração one-shot)
- Templates de ambiente em `.env.staging.example`
- Build e validações (Smoke test e gates locais)

*Para detalhes de deploy, consulte `docs/deployment/STAGING.md`*

## Incremento 9A.1 — Correção de Boot (Meta Opcional)
- A integração com o Meta/Instagram agora é **opcional na inicialização**.
- A aplicação (API e Worker) inicia normalmente e se mantém saudável (`healthy`) mesmo sem as variáveis `META_*`.
- Variáveis `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION`, e `META_REDIRECT_URI` são obrigatórias apenas para:
  - conectar uma conta Instagram;
  - renovar ou validar a conexão Meta;
  - publicar conteúdo no Instagram.
- Caso a integração não esteja configurada, os endpoints relacionados retornarão código `503 Service Unavailable` (`META_INTEGRATION_NOT_CONFIGURED`) e o Worker ignorará de maneira controlada os jobs Meta.
- O domínio de callback continua flexível e configurável por ambiente via `META_REDIRECT_URI` (ex: `https://api-staging.glauberads.com.br/api/integrations/meta/callback`).
