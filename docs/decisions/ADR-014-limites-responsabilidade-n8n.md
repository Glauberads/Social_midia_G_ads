# ADR-014 — Limites de Responsabilidade do n8n

## Status
Aprovado

## Contexto
O n8n é uma ferramenta visual de orquestração de workflows de alta velocidade. No entanto, sua interface visual pode incentivar o vazamento de regras de negócios, transformando a plataforma em uma "fonte de verdade" paralela e quebrando os princípios de coesão do backend.

## Decisão
O n8n será utilizado de forma **estritamente periférica e auxiliar**.
Ele **NÃO** deve e **NÃO** pode:
- Ser o responsável pela autorização ou decisão de estados no sistema.
- Alterar as tabelas principais do banco de dados (posts, aprovações, tenants).
- Decidir se um conteúdo está "Aprovado" ou "Rejeitado".
- Atuar como único ponto de persistência de webhooks (Idempotência central).
- Executar lógicas que envolvam pagamentos, assinaturas ou billing.
- Guardar prompts finais sem versionamento.

O n8n **PODE** e **DEVE** ser usado para:
- Notificações auxiliares (enviar relatórios semanais por e-mail ou slack da equipe).
- Sincronização secundária com CRMs (ex: exportar leads).
- Prototipar integrações não-críticas rapidamente.
- Encaminhar e tratar dados legados que não afetam a máquina de estado central da aplicação.

## Consequências
- O código do backend (NestJS) permanece previsível, auditável e puramente testável.
- Velocidade de desenvolvimento menor para integrações cruciais, pois será exigido Adapter em código, mas garantimos manutenibilidade a longo prazo.
