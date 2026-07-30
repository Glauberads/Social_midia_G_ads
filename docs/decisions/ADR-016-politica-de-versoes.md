# ADR-016 — Política de versões e ciclo de suporte

## Status
Aprovado

## Contexto
O Monorepo adota frameworks pesados (Next.js, NestJS, Prisma) cujas versões devem ser estritas para garantir previsibilidade e evitar falhas de deploy em produção provocadas por dependências instáveis ou obsoletas. A escolha anterior (Next 14) não correspondia mais ao status LTS ativo atual (Agosto/2026), deixando a aplicação sujeita a falhas de segurança do RSC.

## Decisão (Data: Julho/Agosto 2026)
1. **Versões Oficiais (Fase 0 e Fase 1)**:
   - Node.js: `>= 24.14.0` (Fixado via `.npmrc` / `engines`).
   - pnpm: `9.0.0` (Fixado via `packageManager`).
   - Next.js: `16.2.12` (**Active LTS** escolhido como base do projeto para garantir conformidade e segurança ao longo da vida do SaaS).
   - NestJS: `10.0.0` (Major estável vigente).
   - Prisma: `5.22.0`
2. **Atualização do Lockfile**: Somente o líder técnico ou pipeline autorizado executará a atualização massiva. `pnpm-lock.yaml` será a fonte absoluta.
3. **Política Mensal de Patches**: Atualizações de segurança críticas serão integradas todo dia 5 de cada mês mediante testes isolados no pipeline automatizado.
4. **Rollback**: Updates falhos disparam restauração pelo `backup_manager.ps1` usando as pastas imutáveis de backup local, com base em Hash e Data.
