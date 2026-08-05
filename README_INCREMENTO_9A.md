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
