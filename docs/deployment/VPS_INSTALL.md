# Manual de Instalação e Atualização na VPS (Staging)

Este manual detalha o processo de provisionamento, deploy e atualização do Incremento 9A (Staging) na VPS via Docker Compose, em conformidade com o ecossistema existente.

## 1. Pré-requisitos
- Acesso SSH à VPS.
- Docker e Docker Compose instalados.
- Traefik ativo, gerenciando a rede externa e certificados TLS.
- Arquivo `.env.staging` (não versionado) configurado com as chaves reais.
- Acesso ou permissão para puxar o código do repositório (Git) ou registro de imagens, se as imagens forem pré-compiladas.

## 2. Variáveis de Ambiente e Traefik
Assegure-se de que o arquivo `.env.staging` seja criado a partir do `.env.staging.example`. 

**Configurações Importantes para o Traefik:**
Não presuma o nome da rede externa ou do resolver TLS. Preencha adequadamente:
- `TRAEFIK_NETWORK`: O nome da rede externa (ex: informar a rede existente do Traefik).
- `TRAEFIK_CERTRESOLVER`: O nome do provedor Let's Encrypt configurado no Traefik existente.
- `STAGING_WEB_HOST`: Domínio de roteamento do Frontend (ex: `app-staging.seudominio.com`).
- `STAGING_API_HOST`: Domínio de roteamento da API (ex: `api-staging.seudominio.com`).

> [!WARNING]
> NUNCA faça o upload do arquivo `.env.staging` para o GitHub. Insira-o diretamente no servidor via SSH ou use um cofre de chaves (Secret Manager).
>
> **Nota sobre o Meta/Instagram:** As variáveis `META_*` são opcionais para o boot da aplicação. O deploy ocorrerá com sucesso e os healthchecks serão positivos. Porém, para utilizar as funcionalidades do Instagram, certifique-se de preenchê-las (incluindo `META_REDIRECT_URI` apontando para o callback real configurado no App do Facebook, ex: `https://api-staging.glauberads.com.br/api/integrations/meta/callback`).

## 3. Registro e Auditoria Pré e Pós-Deploy
Antes e depois de realizar qualquer deploy, registre as seguintes informações em seu sistema de controle ou logs de homologação:
- **Antes do Deploy:**
  - Commit Atual (Hash) e Tag das Imagens em execução.
  - Data (UTC).
  - Resultado do Backup (Exit Code e validação).
  - Resultado de `docker compose config` (Exit Code).
- **Depois do Deploy:**
  - Novo Commit (Hash) implantado e Novas Tags de Imagem em execução.

## 4. Instalação Inicial (Primeiro Deploy)

### 4.1 Validação do Compose (Obrigatório)
Antes de tudo, verifique se a configuração é válida. O deploy deve parar imediatamente se este comando retornar código diferente de zero:
```bash
docker compose --env-file .env.staging -p social-media-gads-staging -f docker-compose.staging.yml config
```

### 4.2 Backup Seguro do Banco (Formato Custom)
Utilize o arquivo `~/.pgpass` com permissão 600 (`chmod 600 ~/.pgpass`) para evitar o uso de senhas expostas via variáveis ou inline. Execute o dump no formato customizado:
```bash
pg_dump --format=custom -h <HOST_DB> -U <USER_DB> -d <NOME_DB> -p <PORT_DB> -f staging_backup_$(date +%s).dump
```
**Validação Obrigatória:**
Garanta que o arquivo foi criado e não está vazio, além de testar sua legibilidade:
```bash
test -s staging_backup_*.dump && echo "Backup criado" || exit 1
pg_restore --list staging_backup_*.dump > /dev/null && echo "Backup válido" || exit 1
```

### 4.3 Migration Segura (One-shot)
> [!CAUTION]
> - NUNCA usar `migrate reset`, `db push` ou `migrate dev` na VPS.
> - O rollback da aplicação não reverte migrations aplicadas no banco. Restaure o banco apenas quando houver incompatibilidade comprovada.

Execute a migration, capturando e validando o exit code estritamente ANTES de subir a aplicação:
```bash
docker compose --env-file .env.staging -p social-media-gads-staging -f docker-compose.staging.yml run --rm migration
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "Migration falhou com exit code $EXIT_CODE. Abortando deploy."
  exit $EXIT_CODE
fi
```

### 4.4 Subindo a Stack
Após a validação da migração (Exit 0), inicie os serviços. 
Se estiver usando **imagens imutáveis (via Registry)**, efetue apenas pull e up:
```bash
docker compose --env-file .env.staging -p social-media-gads-staging -f docker-compose.staging.yml pull
docker compose --env-file .env.staging -p social-media-gads-staging -f docker-compose.staging.yml up -d redis api worker web
```

*(O argumento `--build` só deve ser utilizado caso o servidor esteja sendo usado em modo temporário para compilação/build direto na VPS).*

## 5. Atualização de Versão

Para realizar um deploy de atualização:
1. Registre o ambiente (Passo 3).
2. Obtenha a nova versão atualizando as Tags no `.env.staging` (ou compose) caso use Registry. Se for build local na VPS:
   ```bash
   git fetch origin
   git switch --detach <hash-validado>
   ```
   *(Não use checkout arbitrário sobre uma árvore que contenha alterações locais).*
3. Execute o **Backup** com validação (4.2).
4. Execute o **Validador de Compose** (4.1).
5. Execute a **Migration** e valide o Exit Code (4.3).
6. Recarregue os serviços via `pull` e `up -d` (sem build) para imagens tagueadas, ou com `--build` somente em construção local na VPS.

## 6. Validações Pós-Subida

Verifique o estado dos containers:
```bash
docker compose --env-file .env.staging -p social-media-gads-staging -f docker-compose.staging.yml ps
```
Confirme que:
- O `redis` está **healthy**.
- A `api` está **healthy**.
- A `web` está **saudável (healthy)**.
- O `worker` está rodando **sem restart loop**.
- O container efêmero `migration` encerrou com **exit 0**.

## 7. Smoke Test

Execute o teste de fogo validando os itens críticos:
- **Rede e Segurança:**
  - [ ] HTTPS operando com o certificado correto.
  - [ ] Cookies trafegados com `Secure`, `HttpOnly` e `SameSite=Lax`.
  - [ ] CORS restrito aos domínios definidos nas variáveis.
- **Saúde (Health):**
  - [ ] Frontend retorna HTTP 200.
  - [ ] API liveness (`/api/health/live`) retorna HTTP 200.
  - [ ] API readiness (`/api/health/ready`) retorna HTTP 200.
- **Autenticação e Multi-tenancy:**
  - [ ] Login pelo Supabase ocorre com sucesso.
  - [ ] Sessão mantém o Tenant ativo corretamente resolvido.
  - [ ] RLS (Row Level Security) isola as informações entre Tenant A e Tenant B.
- **Funcionalidades e Integrações:**
  - [ ] Geração de conteúdo fake (simulado) opera corretamente.
  - [ ] Fluxo de revisão e aprovação salva o status no banco.
  - [ ] Agendamento funciona via Calendário.
  - [ ] Transição temporal altera o status do conteúdo para DUE.
  - [ ] Integração com o fluxo Meta fake funciona via callback OAuth em ambiente de teste.
- **Restrição de Ambiente:**
  - [ ] Comprovado: Nenhuma publicação real disparada para os provedores sociais.

## 8. Rollback e Derrubada (Down)

Se a atualização introduzir bugs fatais, realize o rollback imediatamente, recuperando a imagem tagueada (hash commit) validada ou restaurando o código fonte exato:
```bash
# Para build na VPS: git switch --detach <hash-anterior>
docker compose --env-file .env.staging -p social-media-gads-staging -f docker-compose.staging.yml up -d redis api worker web
```
*(Esclarecimento: O rollback da aplicação não desfaz as migrations aplicadas no banco. O restore de banco utilizando o backup anterior `pg_restore` só deve ser executado quando houver uma **incompatibilidade comprovada** do banco com os containers na versão antiga).*

> [!CAUTION]
> **Proibições Estruturais:**
> - Nunca execute `docker compose down -v` (isto expurgará volumes essenciais).
> - Nunca execute `docker system prune` ou `docker volume prune` na VPS.

Para derrubar a stack completamente (sem apagar volumes):
```bash
docker compose --env-file .env.staging -p social-media-gads-staging -f docker-compose.staging.yml down
```

## 9. Coleta de Diagnóstico
Caso necessite investigar anomalias:
```bash
docker compose --env-file .env.staging -p social-media-gads-staging -f docker-compose.staging.yml ps
docker compose --env-file .env.staging -p social-media-gads-staging -f docker-compose.staging.yml logs --tail 200 api worker web redis
docker inspect <container>
docker stats --no-stream
```

> [!WARNING]
> CUIDADO COM DADOS SENSÍVEIS! O comando `docker inspect` pode e irá revelar variáveis de ambiente limpas em texto puro (incluindo chaves, JWT, etc). Prefira usar formatação de saída seletiva e **nunca** compartilhe ou documente a saída completa destes comandos em relatórios sem sanitização, omitindo tokens, cookies, Authorization headers e strings de conexão.
