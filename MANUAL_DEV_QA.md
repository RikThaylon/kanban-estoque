# Manual Dev e QA - Kanban Estoque

Este manual e o guia operacional de desenvolvimento e qualidade do projeto
Kanban Estoque. Ele foi escrito para servir tanto ao dev que vai manter ou
evoluir o codigo quanto ao QA que precisa planejar, executar, evidenciar e
automatizar testes.

O documento cobre:

- arquitetura e responsabilidades por camada;
- setup local, banco, variaveis e scripts;
- padroes de desenvolvimento backend/frontend;
- regras de negocio criticas;
- matriz de APIs, telas e arquivos;
- estrategia de QA manual e automatizado;
- checklists regressivos por modulo;
- criterios de aceite, release e evidencias.

> Regra de ouro: nenhuma entrega deve ser aprovada apenas porque "funcionou na
> tela". O fluxo precisa respeitar permissao, transacao, auditoria, consistencia
> de estoque, regras Kanban, status de pedido e ausencia de erro 500 em caso de
> validacao esperada.

---

## 1. Visao Geral do Produto

O Kanban Estoque e um sistema web para controle de estoque industrial com:

- cadastro de produtos, fornecedores, departamentos e maquinas;
- movimentacoes de entrada, saida, ajustes e devolucoes;
- calculo de parametros Kanban;
- sugestoes de compra;
- fluxo de aprovacao por valor, departamento e cargo;
- emissao baseada em OC externa;
- recebimento de pedido com atualizacao de estoque;
- dashboard, alertas, relatorios e grafo de relacionamentos;
- usuarios, perfis, permissoes por pagina e auditoria.

Fluxo macro:

1. Admin prepara usuarios, cargos, permissoes, turnos e limites.
2. Produtos, fornecedores, departamentos e maquinas sao cadastrados.
3. Produtos sao vinculados a fornecedores e maquinas.
4. Estoque muda por movimentacoes ou recebimento de pedidos.
5. Kanban recalcula faixa, PR, ES, EOQ e EMax quando ha dados suficientes.
6. Solicitantes criam pedidos de compra para itens vinculados a maquinas.
7. Aprovadores N1/N2/N3 aprovam ou rejeitam conforme configuracao.
8. Comprador informa fornecedor e numero da OC externa.
9. Recebedor registra NF e quantidade recebida.
10. Relatorios, alertas e grafo refletem o historico.

---

## 2. Stack e Componentes

| Camada | Tecnologia | Onde fica |
|---|---|---|
| Frontend | React 18, Vite, TailwindCSS | `frontend/` |
| Estado server | TanStack React Query | `frontend/src/pages`, `frontend/src/components` |
| Estado local | Zustand | `frontend/src/stores` |
| HTTP client | Axios com refresh token | `frontend/src/services/api.js` |
| Realtime | Socket.io-client | `frontend/src/services/socket.js`, `frontend/src/hooks/useSocket.js` |
| Backend | Node.js, Express | `backend/src` |
| Banco | PostgreSQL 15+ | `backend/migrations` |
| Cache | Redis opcional, stub em dev/test | `backend/src/config/redis.js` |
| Auth | JWT access + refresh rotation | `backend/src/services/auth.service.js` |
| Validacao | express-validator e Zod/env | rotas + `backend/src/config/env.js` |
| Testes backend | Jest + Supertest | `backend/tests` |
| Jobs | node-cron | `backend/src/jobs` |

---

## 3. Estrutura do Repositorio

```text
.
|-- backend/
|   |-- migrations/          # SQL versionado do schema e configuracoes
|   |-- src/
|   |   |-- app.js           # Express, middlewares globais e rotas
|   |   |-- server.js        # HTTP, Socket.io e cron jobs
|   |   |-- config/          # env, database, redis, migrate, reset
|   |   |-- middleware/      # auth, rbac, audit, errorHandler, rateLimiter
|   |   |-- routes/          # endpoints por modulo
|   |   |-- services/        # regras de negocio e calculos
|   |   |-- jobs/            # rotinas agendadas
|   |   |-- socket/          # autenticacao e salas Socket.io
|   |   `-- utils/           # erros, logger, paginacao, dados sensiveis
|   `-- tests/               # unit, integration, middleware, helpers
|-- frontend/
|   |-- src/
|   |   |-- App.jsx          # rotas protegidas e permissao por pagina
|   |   |-- main.jsx         # bootstrap React/QueryClient
|   |   |-- pages/           # telas do sistema
|   |   |-- components/      # layout, charts e kanban
|   |   |-- hooks/           # useAuth, useSocket
|   |   |-- services/        # api e socket
|   |   |-- stores/          # authStore e uiStore
|   |   |-- utils/           # formatadores, permissoes, status, invalidacao
|   |   `-- data/            # dados estaticos RACI
|-- scripts/                 # setup-local.ps1, start-local.ps1
|-- package.json             # scripts raiz
|-- docker-compose.yml       # alternativa Docker
|-- README.md
|-- RACI.md
`-- MANUAL_DEV_QA.md
```

---

## 4. Setup Local

Pre-requisitos:

- Node.js 20+;
- PostgreSQL 15+;
- PowerShell no Windows;
- Git;
- Redis opcional em dev.

Setup automatizado:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

O script:

- valida Node e `psql`;
- le `.env`;
- cria role e database;
- instala dependencias da raiz, backend e frontend;
- aplica migrations.

Subir backend e frontend:

```powershell
.\scripts\start-local.ps1
```

Ou:

```bash
npm run dev
```

URLs:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3001/health`
- Backend readiness: `http://localhost:3001/ready`

Comandos principais:

| Comando | Uso |
|---|---|
| `npm run install:all` | instala raiz, backend e frontend |
| `npm run dev` | sobe backend e frontend juntos |
| `npm run dev:backend` | sobe apenas backend |
| `npm run dev:frontend` | sobe apenas frontend |
| `npm run db:migrate` | aplica migrations |
| `npm run db:reset` | remove tabelas do banco local |
| `npm run db:fresh` | reseta e migra novamente |
| `npm run build:frontend` | build Vite |
| `npm run validate` | testes unit backend + build frontend |
| `cd backend && npm test` | suite backend completa |
| `cd backend && npm run test:unit` | testes unitarios |
| `cd backend && npm run test:integration` | testes de integracao |

---

## 5. Variaveis de Ambiente

Arquivo base: `.env.example`.

Obrigatorias para backend:

| Variavel | Regra |
|---|---|
| `NODE_ENV` | `development`, `production` ou `test` |
| `PORT` | porta do backend, padrao `3001` |
| `DATABASE_URL` | string PostgreSQL obrigatoria |
| `REDIS_ENABLED` | `false` em dev local sem Redis real |
| `REDIS_URL` | usada quando Redis real esta ativo |
| `JWT_SECRET` | minimo 32 caracteres |
| `JWT_REFRESH_SECRET` | minimo 32 caracteres |
| `DATA_ENCRYPTION_SECRET` | recomendado para dados sensiveis |
| `CORS_ORIGINS` | lista separada por virgula |
| `BCRYPT_ROUNDS` | custo bcrypt |
| `RATE_LIMIT_MAX` | limite global `/api` |

Obrigatorias ou uteis para frontend:

| Variavel | Regra |
|---|---|
| `VITE_API_URL` | se omitida, o frontend usa host atual na porta 3001 |
| `VITE_WS_URL` | se omitida, segue estrategia similar a API |

Em producao:

- trocar todos os secrets de exemplo;
- `JWT_SECRET` e `JWT_REFRESH_SECRET` nao podem conter placeholders;
- Redis real deve estar disponivel se `REDIS_ENABLED=true`;
- revisar `CORS_ORIGINS`;
- validar `/ready` antes de liberar trafego.

---

## 6. Manual do Dev - Arquitetura Backend

### 6.1 Entrada HTTP

Arquivo: `backend/src/app.js`.

Responsabilidades:

- configurar Helmet;
- configurar CORS;
- aceitar JSON ate 10 MB;
- log HTTP via Morgan/Winston;
- aplicar rate limit global em `/api`;
- expor `/health` e `/ready`;
- montar rotas `/api/v1/*`;
- responder 404 padronizado;
- delegar erros para `errorHandler`.

Ponto de atencao:

- CORS aceita LAN privada em development para testes em celular/tablet.
- `/ready` checa Postgres e Redis/stub.
- novas rotas devem ser registradas em `app.js` e protegidas por `authenticate`,
  exceto quando forem deliberadamente publicas.

### 6.2 Servidor, WebSocket e Jobs

Arquivo: `backend/src/server.js`.

Responsabilidades:

- criar HTTP server;
- acoplar Socket.io;
- configurar CORS do WebSocket;
- chamar `configurarSocket(io)`;
- armazenar `io` em `app.set('io', io)`;
- conectar Redis;
- agendar jobs;
- escutar em `0.0.0.0` para permitir acesso LAN em dev.

Jobs agendados:

| Horario | Job | Arquivo |
|---|---|---|
| 06:00 e 18:00 | recalculo Kanban | `jobs/recalculo.job.js` |
| 08:00 | prazos vencidos | `jobs/prazos.job.js` |
| 03:00 | limpeza de tokens | `jobs/limpeza.job.js` |
| Domingo 02:00 | recalculo ABC | `jobs/abc.job.js` |

### 6.3 Banco

Arquivo: `backend/src/config/database.js`.

Padrao:

- usar `query(text, params)` para queries simples;
- usar `getClient()` com `BEGIN/COMMIT/ROLLBACK` para operacoes transacionais;
- nunca montar SQL com valores de usuario interpolados;
- usar parametros `$1`, `$2`, etc.;
- bloquear linhas criticas com `FOR UPDATE` quando estoque/pedido puder sofrer
  concorrencia.

Transacoes obrigatorias:

- movimentacao que altera estoque;
- aprovacao de movimentacao pendente;
- recebimento de pedido;
- qualquer fluxo futuro que altere pedido + estoque + movimentacao no mesmo ato.

### 6.4 Middlewares

| Middleware | Arquivo | O que garante |
|---|---|---|
| `authenticate` | `middleware/auth.js` | JWT valido, nao expirado e nao em blacklist |
| `optionalAuth` | `middleware/auth.js` | permite request sem token, mas popula usuario se valido |
| `authorize` | `middleware/rbac.js` | cargo permitido; admin tem bypass |
| `audit` | `middleware/audit.js` | grava acao bem-sucedida com dados sanitizados |
| `validate` | `middleware/validate.js` | transforma express-validator em `ValidationError` |
| `apiLimiter/createLimiter` | `middleware/rateLimiter.js` | limita abuso |
| `errorHandler` | `middleware/errorHandler.js` | padroniza erros 400/401/403/404/409/500 |

Padrao de erro esperado:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Mensagem legivel",
  "code": 400
}
```

QA deve considerar bug quando:

- validacao previsivel retorna 500;
- erro de constraint vaza stack;
- rota protegida aceita usuario sem token;
- usuario sem cargo consegue mutacao;
- erro de negocio nao tem mensagem legivel.

### 6.5 Servicos

| Servico | Arquivo | Papel |
|---|---|---|
| Auth | `services/auth.service.js` | login, refresh rotation, logout, blacklist |
| Configuracoes | `services/configuracoes.service.js` | defaults, permissoes, cargos e turnos |
| Pedido workflow | `services/pedido.workflow.js` | maquina, status inicial e aprovacao N1/N2/N3 |
| Kanban math | `services/kanban.math.js` | Holt, regressao, ES, PR, EOQ, ABC |
| Kanban calc | `services/kanban.calc.js` | orquestra recalculo e persistencia |
| Kanban repo | `services/kanban.repo.js` | series historicas de consumo e lead time |
| Notificacoes | `services/notificacoes.js` | cria alerta e emite socket |
| Recalculo dispatcher | `services/recalculo.dispatcher.js` | nao deixa recalc quebrar resposta HTTP |

Regra para dev:

- regra de dominio compartilhada deve ficar em `services/`, nao espalhada apenas
  na tela ou rota;
- rotas devem validar, autenticar, orquestrar e responder;
- frontend nao deve ser fonte unica de regra de permissao.

---

## 7. Manual do Dev - Modulos Backend

### 7.1 Auth

Rotas:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Regras:

- login usa `username` e `senha`;
- usuario inativo nao loga;
- apos 5 tentativas incorretas, conta bloqueia por 15 minutos;
- refresh token faz rotation: token antigo e revogado;
- logout coloca access token em blacklist ate expirar e revoga refresh tokens;
- refresh token e salvo como hash, nao em texto puro.

Testes automatizados existentes:

- login invalido/valido;
- usuario inexistente;
- usuario desativado;
- conta bloqueada;
- `/me` com e sem token;
- logout com e sem token;
- middleware de auth e blacklist.

### 7.2 Usuarios

Rotas:

- `GET /api/v1/usuarios`
- `GET /api/v1/usuarios/cargos`
- `POST /api/v1/usuarios`
- `GET /api/v1/usuarios/:id`
- `PATCH /api/v1/usuarios/:id`
- `DELETE /api/v1/usuarios/:id`
- `POST /api/v1/usuarios/:id/reset-senha`

Regras:

- criar, desativar e resetar senha sao acoes de admin;
- listagem tambem permite cargos gerenciais/engenharia/visualizador;
- `username` aceita letras, numeros, ponto, underscore e hifen;
- senha de criacao/reset deve ter 8 a 100 caracteres;
- senha nao pode conter whitespace;
- delete e soft delete (`ativo=false`).

Perfis validos:

- `admin`
- `plant_manager`
- `gerente_engenharia`
- `eng_processos`
- `eng_producao`
- `gerente_operacoes`
- `supervisor_turno`
- `comprador`
- `facilitador`
- `visualizador`

### 7.3 Configuracoes

Rotas:

- `GET /api/v1/configuracoes/pedidos`
- `PATCH /api/v1/configuracoes/pedidos`
- `GET /api/v1/configuracoes/kanban`
- `PATCH /api/v1/configuracoes/kanban`
- `GET /api/v1/configuracoes/turnos`
- `PATCH /api/v1/configuracoes/turnos`
- `GET /api/v1/configuracoes/permissoes`
- `PATCH /api/v1/configuracoes/permissoes`

Regras:

- alteracoes sao restritas ao admin;
- limite do gerente deve ser maior ou igual ao limite do supervisor;
- compradores, facilitadores e visualizador nao podem ser aprovadores internos;
- turnos devem ter codigo unico, horario `HH:mm` e lista entre 1 e 12 itens;
- nivel de servico padrao deve ser 90, 95, 98 ou 99;
- ciclos de estimativa inicial devem ficar entre 3 e 10;
- taxa de carregamento/custo de manter deve ficar entre 0 e 1;
- permissoes por pagina sao listas de cargos.

Defaults importantes:

| Chave | Default |
|---|---|
| `pedidos.limite_supervisor` | `5000` |
| `pedidos.limite_gerente` | `50000` |
| `pedidos.solicitantes` | `facilitador,comprador` |
| `pedidos.aprovadores_nivel_1` | `supervisor_turno` |
| `pedidos.aprovadores_nivel_2` | `gerente_operacoes` |
| `pedidos.aprovadores_nivel_3` | `plant_manager` |
| `pedidos.compradores` | `comprador` |
| `pedidos.recebedores` | `comprador,facilitador` |
| `permissoes.cadastrar_item` | `comprador` |
| `permissoes.editar_curva_abc` | `eng_producao` |
| `kanban.nivel_servico_padrao` | `95` |
| `kanban.ciclos_estimativa_inicial` | `10` |
| `kanban.taxa_carregamento_padrao` | `0.2` |

Turnos default:

- `1T`: 06:00-14:00
- `2T`: 14:01-22:00
- `3T`: 22:01-05:59

### 7.4 Produtos

Rotas:

- `GET /api/v1/produtos`
- `POST /api/v1/produtos`
- `GET /api/v1/produtos/:id`
- `PATCH /api/v1/produtos/:id`
- `DELETE /api/v1/produtos/:id`
- `GET /api/v1/produtos/:id/fornecedores`
- `POST /api/v1/produtos/:id/fornecedores`
- `PUT /api/v1/produtos/:id/fornecedores`
- `GET /api/v1/produtos/:id/historico-consumo`
- `GET /api/v1/produtos/:id/historico-lead-time`
- `GET /api/v1/produtos/:id/rastreamento-calculo`
- `PATCH /api/v1/produtos/:id/classificacao-abc`

Campos base:

- codigo, nome, descricao, unidade;
- categoria;
- custo unitario;
- custo de pedido;
- taxa de carregamento;
- nivel de servico;
- localizacao;
- estoque atual;
- classificacao ABC;
- CMD inicial e lead time inicial no fluxo de criacao.

Regras:

- permissao de cadastro vem de `permissoes.cadastrar_item`;
- admin sempre pode cadastrar;
- classificacao ABC manual exige `permissoes.editar_curva_abc`;
- delete e soft delete;
- produto criado com CMD e LT iniciais gera serie estimada e parametros Kanban;
- produto sem CMD/LT inicial nasce com faixa `SEM_DADOS`;
- custo para manter default vem de configuracoes Kanban;
- vinculo de fornecedor usa prioridade, preco acordado e lead time nominal.

Ponto de cuidado:

- inserir item existente no frontend cria produto e depois uma movimentacao de
  entrada. Se a entrada falhar, QA deve reportar se o estado ficou parcial.

### 7.5 Fornecedores

Rotas:

- `GET /api/v1/fornecedores`
- `POST /api/v1/fornecedores`
- `GET /api/v1/fornecedores/:id`
- `PATCH /api/v1/fornecedores/:id`
- `DELETE /api/v1/fornecedores/:id`

Regras:

- criar, editar e desativar sao restritos ao admin;
- `nome` e obrigatorio;
- CNPJ deve ter 14 a 18 caracteres quando informado;
- e-mail deve ser valido;
- UF e normalizada para maiusculo;
- modal e normalizado para minusculo;
- CNPJ duplicado retorna 409;
- delete e soft delete.

Modais validos:

- `rodoviario`
- `aereo`
- `maritimo`
- `ferroviario`
- `expresso`
- `motoboy`
- `correios`

### 7.6 Departamentos e Maquinas

Rotas de departamentos:

- `GET /api/v1/departamentos`
- `GET /api/v1/departamentos/:id`
- `POST /api/v1/departamentos`
- `PATCH /api/v1/departamentos/:id`
- `DELETE /api/v1/departamentos/:id`

Rotas de maquinas:

- `GET /api/v1/maquinas`
- `GET /api/v1/maquinas/:id`
- `POST /api/v1/maquinas`
- `PATCH /api/v1/maquinas/:id`
- `DELETE /api/v1/maquinas/:id`
- `POST /api/v1/maquinas/:id/produtos`
- `DELETE /api/v1/maquinas/:id/produtos/:produto_id`

Regras:

- codigo e nome sao obrigatorios;
- departamento pode ter supervisor;
- maquina pode estar vinculada a departamento;
- maquina pode ter varios produtos;
- produto pode estar em varias maquinas;
- pedido exige maquina quando produto esta vinculado a maquinas;
- se produto esta em uma unica maquina, backend resolve automaticamente;
- se produto esta em varias maquinas, backend exige escolha explicita;
- maquina/departamento guiam aprovador N1.

### 7.7 Movimentacoes

Rotas:

- `GET /api/v1/movimentacoes`
- `GET /api/v1/movimentacoes/pendentes`
- `POST /api/v1/movimentacoes`
- `POST /api/v1/movimentacoes/:id/aprovar`
- `POST /api/v1/movimentacoes/:id/rejeitar`

Tipos aceitos para novo lancamento:

- `ENTRADA`
- `SAIDA`
- `AJUSTE_POSITIVO`
- `AJUSTE_NEGATIVO`
- `DEVOLUCAO`

Tipo historico ainda existente no banco:

- `TRANSFERENCIA`, mas novos lancamentos devem ser bloqueados.

Regras:

- `produto_id` UUID obrigatorio;
- quantidade deve ser maior que zero;
- turno e opcional na API, mas quando informado precisa casar com
  `^[A-Za-z0-9_-]{1,20}$`;
- entrada e saida executam direto;
- ajuste positivo, ajuste negativo e devolucao ficam `PENDENTE`;
- pendente nao muda estoque ate aprovacao;
- aprovadores de movimentacao: admin, supervisor_turno, gerente_operacoes,
  plant_manager;
- usuario nao-admin nao aprova a propria movimentacao;
- rejeicao exige motivo de 5 a 1000 caracteres;
- saida/ajuste negativo nao pode deixar estoque negativo;
- toda alteracao de estoque dispara recalculo Kanban em background;
- eventos Socket.io sao emitidos para pendencia, aprovacao, rejeicao e estoque
  atualizado.

### 7.8 Pedidos

Rotas:

- `GET /api/v1/pedidos`
- `GET /api/v1/pedidos/sugestoes`
- `POST /api/v1/pedidos`
- `GET /api/v1/pedidos/numero/:numero`
- `POST /api/v1/pedidos/:id/aprovar`
- `POST /api/v1/pedidos/:id/rejeitar`
- `GET /api/v1/pedidos/:id`
- `PATCH /api/v1/pedidos/:id/status`
- `POST /api/v1/pedidos/:id/receber`

Status principais:

- `RASCUNHO`
- `AGUARDANDO_APROVACAO`
- `AGUARDANDO_GERENTE`
- `AGUARDANDO_DIRETORIA`
- `APROVADO`
- `AGUARDANDO_CHEGADA`
- `EMITIDO` (legado/alias em transicoes)
- `EM_TRANSITO`
- `RECEBIDO_PARCIAL`
- `CONCLUIDO`
- `RECEBIDO` (legado/alias)
- `CANCELADO`
- `REJEITADO`

Regras de criacao:

- cargo solicitante vem de configuracao;
- visualizador nunca deve solicitar compra;
- produto deve existir;
- produto precisa estar vinculado a maquina;
- se produto estiver em N maquinas, `maquina_id` e obrigatorio;
- facilitador nao escolhe fornecedor na solicitacao;
- comprador pode escolher fornecedor;
- se fornecedor nao vier, sistema usa fornecedor principal do produto;
- se preco nao vier, usa preco acordado ou custo unitario do produto;
- numero segue `PC-YYYYMM-NNNN`;
- solicitacao nasce em fila acionavel, nao parada como rascunho;
- se supervisor responsavel cria sua propria solicitacao, status inicial vai
  para `AGUARDANDO_GERENTE` para evitar autoaprovacao.

Regras de aprovacao:

- N1 aprova `AGUARDANDO_APROVACAO`;
- N2 aprova `AGUARDANDO_GERENTE`;
- N3 aprova `AGUARDANDO_DIRETORIA`;
- admin sempre e elegivel;
- comprador, facilitador e visualizador sao removidos da lista de aprovadores
  internos mesmo que aparecam em configuracao;
- nao-admin nao aprova o proprio pedido;
- supervisor so aprova/rejeita pedido do departamento pelo qual e responsavel;
- custo maior ou igual ao limite do supervisor pode escalar para gerente;
- custo maior ou igual ao limite do gerente pode escalar para diretoria.

Regras de emissao/OC externa:

- sistema nao gera OC interna;
- comprador registra `numero_oc_externa`;
- para marcar como `AGUARDANDO_CHEGADA`, e obrigatorio informar OC externa;
- fornecedor tambem deve existir no pedido ou ser informado nesse momento;
- endpoint de status normaliza `EMITIDO` para `AGUARDANDO_CHEGADA`.

Regras de recebimento:

- recebedores vem de configuracao;
- status permitido: `AGUARDANDO_CHEGADA`, `EMITIDO`, `EM_TRANSITO`,
  `RECEBIDO_PARCIAL`;
- `numero_nf` e obrigatorio;
- recebimento parcial muda para `RECEBIDO_PARCIAL`;
- recebimento total muda para `CONCLUIDO`;
- cria movimentacao `ENTRADA` executada;
- atualiza estoque;
- dispara recalculo Kanban.

### 7.9 Dashboard, Alertas, Relatorios e Grafo

Dashboard:

- `GET /api/v1/dashboard/resumo`
- `GET /api/v1/dashboard/evolucao-estoque`
- `GET /api/v1/dashboard/desempenho-fornecedores`
- `GET /api/v1/dashboard/consumo-semanal`

Alertas:

- `GET /api/v1/alertas`
- `PATCH /api/v1/alertas/:id/ler`
- `POST /api/v1/alertas/ler-todos`

Relatorios:

- `GET /api/v1/relatorios/curva-abc`
- `GET /api/v1/relatorios/giro-estoque`
- `GET /api/v1/relatorios/pedidos-periodo`
- `GET /api/v1/relatorios/rupturas-historico`
- `GET /api/v1/relatorios/top-solicitantes`
- `GET /api/v1/relatorios/top-produtos-saida`
- `GET /api/v1/relatorios/consumo-por-categoria`
- `GET /api/v1/relatorios/estatisticas-gerais`
- `GET /api/v1/relatorios/previsao-gastos-mensal`

Grafo:

- `GET /api/v1/grafo/relacionamentos`

Regras:

- todos exigem autenticacao;
- acesso ao grafo tambem respeita permissao por pagina/cargo;
- relatorios devem suportar estado vazio;
- curva ABC usa valor de consumo, nao valor em estoque;
- alertas nao lidos alimentam o sino e eventos realtime.

---

## 8. Manual do Dev - Kanban

Arquivos:

- `backend/src/services/kanban.math.js`
- `backend/src/services/kanban.calc.js`
- `backend/src/services/kanban.repo.js`
- componentes frontend em `frontend/src/components/kanban`

Conceitos:

- CMD: consumo medio diario;
- LT: lead time;
- ES: estoque de seguranca;
- PR: ponto de reposicao;
- EOQ: lote economico;
- EMax: estoque maximo;
- Faixa: `VERDE`, `AMARELO`, `VERMELHO`, `SEM_DADOS`.

Calculo:

- demanda semanal prevista usa Holt;
- lead time previsto usa regressao linear;
- fator Z vem do nivel de servico: 90, 95, 98, 99;
- ES usa demanda e lead time estocasticos;
- PR = demanda diaria prevista * lead time previsto + ES;
- H = taxa de carregamento * custo unitario;
- EOQ = sqrt((2 * demanda anual * custo pedido) / H);
- EMax = ES + EOQ;
- cobertura = `(estoqueAtual - ES) / demandaDiariaMedia`.

Historico insuficiente:

- menos de 3 semanas de consumo resulta em insuficiencia;
- menos de 2 lead times resulta em insuficiencia, salvo lead time nominal do
  fornecedor;
- quando historico e insuficiente, o recalculo preserva parametros manuais
  existentes em vez de inventar precisao;
- se o produto tem CMD/LT iniciais, o sistema pode gerar serie estimada entre 3
  e 10 ciclos para parametros iniciais.

Eventos:

- mudanca de faixa cria alerta;
- `faixa:mudou`;
- `kanban:recalculado`.

QA deve validar sempre:

- produto sem dados nao ganha parametros estatisticos falsos;
- produto com CMD/LT inicial mostra parametros iniciais;
- EMax e ES + EOQ;
- faixa vermelha quando estoque <= ES;
- faixa amarela quando ES < estoque <= PR;
- faixa verde quando estoque > PR;
- rastreamento de calculo traz insumos, intermediarios e conferencia simples.

---

## 9. Manual do Dev - Frontend

### 9.1 Bootstrap e Rotas

Arquivos:

- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

Regras:

- rotas protegidas exigem auth;
- `ProtectedRoute` chama `checkAuth`;
- inatividade de 10 minutos executa logout;
- cada pagina interna passa por `PageRoute`;
- `PageRoute` consulta `/configuracoes/permissoes`;
- se cargo nao tem acesso, mostra mensagem de acesso negado;
- lazy loading e usado para paginas.

Rotas UI:

| Rota | Pagina | Permissao |
|---|---|---|
| `/login` | Login | publica |
| `/dashboard` | Dashboard | `dashboard` |
| `/produtos` | Produtos | `produtos` |
| `/produtos/:id` | ProdutoDetalhe | `produtos` |
| `/movimentacoes` | Movimentacoes | `movimentacoes` |
| `/pedidos` | Pedidos | `pedidos` |
| `/pedidos/acompanhar` | AcompanharPedido | `pedidos` |
| `/grafo` | GrafoRelacionamentos | `grafo` |
| `/alertas` | Alertas | `alertas` |
| `/relatorios` | Relatorios | `relatorios` |
| `/maquinas` | Maquinas | `maquinas` |
| `/usuarios` | Usuarios | `usuarios` |
| `/fornecedores` | Fornecedores | `fornecedores` |
| `/configuracoes` | Configuracoes | `configuracoes` |
| `/raci` | Raci | `raci` |

### 9.2 API Client

Arquivo: `frontend/src/services/api.js`.

Regras:

- base URL vem de `VITE_API_URL`;
- se nao houver env, usa host atual com porta `3001`;
- request interceptor injeta `Authorization: Bearer <token>`;
- response interceptor tenta refresh em 401;
- fila evita varios refreshes simultaneos;
- em falha de refresh, authStore faz logout;
- mensagens de erro da API sao normalizadas para a UI.

Pontos de teste:

- acesso por `localhost`;
- acesso por IP LAN;
- token expirado com refresh valido;
- refresh expirado/invalido;
- duas chamadas simultaneas recebendo 401.

### 9.3 Estado

Arquivos:

- `frontend/src/stores/authStore.js`
- `frontend/src/stores/uiStore.js`

Auth store:

- usuario;
- access token;
- refresh token quando aplicavel;
- flag `authChecked`;
- status do socket;
- actions `setAuth`, `setTokens`, `setUser`, `logout`.

UI store:

- sidebar aberta/fechada;
- contador de alertas nao lidos;
- toasts.

Regra:

- dados vindos da API devem ficar no React Query;
- estado local e transiente deve ficar no Zustand;
- apos mutacao, invalidar queries relacionadas.

### 9.4 Paginas e Responsabilidades

| Pagina | Responsabilidade principal |
|---|---|
| `Login.jsx` | autenticacao |
| `Dashboard.jsx` | KPIs e graficos resumidos |
| `Produtos.jsx` | lista, filtros, cadastro, edicao e inserir item existente |
| `ProdutoDetalhe.jsx` | detalhe, Kanban, fornecedores, historico e ABC |
| `Movimentacoes.jsx` | lista, criar, aprovar e rejeitar movimentacoes |
| `Pedidos.jsx` | solicitacao, aprovacao, emissao, cancelamento e recebimento |
| `AcompanharPedido.jsx` | busca por numero do pedido |
| `Fornecedores.jsx` | CRUD de fornecedores |
| `Maquinas.jsx` | departamentos, maquinas e vinculos produto/maquina |
| `Configuracoes.jsx` | limites, fluxo, permissoes, Kanban e turnos |
| `Relatorios.jsx` | consultas analiticas |
| `Alertas.jsx` | leitura de alertas |
| `GrafoRelacionamentos.jsx` | mapa operacional de relacionamentos |
| `Usuarios.jsx` | CRUD de usuarios e reset de senha |
| `Raci.jsx` | matriz RACI local |

### 9.5 Padroes Frontend

Para dev:

- usar `api` centralizado, nao criar outro axios;
- manter `queryKey` estavel e especifica;
- invalidar queries apos mutacao bem-sucedida;
- mostrar estados de loading, vazio e erro;
- nao confiar so no frontend para permissao;
- preservar mensagens do backend;
- manter botoes de acao ocultos/desabilitados conforme perfil;
- evitar duplicar regras complexas ja existentes no backend.

Para QA:

- testar permissao pelo menu e tambem por URL direta;
- testar refresh de pagina em telas internas;
- testar erro de validacao vindo do backend;
- testar telas vazias com banco limpo;
- testar responsividade no minimo em desktop e mobile.

---

## 10. Banco de Dados e Migrations

Migrations ficam em `backend/migrations`.

Tabelas principais:

- `usuarios`
- `refresh_tokens`
- `audit_log`
- `fornecedores`
- `categorias`
- `produtos`
- `produto_fornecedor`
- `kanban_parametros`
- `movimentacoes`
- `pedidos_compra`
- `alertas`
- `departamentos`
- `maquinas`
- `maquina_produto`
- `configuracoes_sistema`
- `ocorrencias_raci`

Regras para dev:

- migration deve ser idempotente quando possivel (`IF NOT EXISTS`);
- nunca colocar dados mockados operacionais em migration de producao;
- defaults de configuracao podem entrar em `configuracoes_sistema`;
- constraints devem refletir os enums aceitos pelo backend;
- ao mudar status/enum, atualizar migration, rota, frontend, testes e manual;
- preferir soft delete onde o dominio precisa manter historico.

Checagens de QA apos migration:

- `npm run db:fresh`;
- login com admin inicial;
- configuracoes default existem;
- permissoes por pagina existem;
- turnos default existem;
- banco limpo nao tem pedidos, produtos ou movimentacoes mockadas;
- constraints retornam 400/409 via API, nao 500.

---

## 11. Seguranca, Permissao e Auditoria

Pontos obrigatorios:

- toda rota `/api/v1/*` precisa de auth, salvo excecao explicita;
- mutacoes sensiveis precisam de `authorize` ou regra por configuracao;
- mutacoes relevantes precisam de `audit`;
- dados sensiveis devem ser sanitizados antes de auditar;
- senha nunca aparece em resposta;
- refresh token nunca e salvo em texto puro;
- access token em logout entra em blacklist;
- erro 401/403 deve ser consistente.

Matriz resumida de perfis:

| Perfil | Papel esperado |
|---|---|
| `admin` | acesso total e configuracao |
| `plant_manager` | aprovacao alta/diretoria e visao gerencial |
| `gerente_operacoes` | aprovacao N2 e operacao gerencial |
| `supervisor_turno` | aprovacao N1 e movimentacoes |
| `comprador` | compras, fornecedor e OC externa |
| `facilitador` | solicitacao, movimentacao operacional e recebimento se configurado |
| `eng_producao` | manutencao tecnica, ABC conforme permissao |
| `eng_processos` | visao/analise conforme permissao |
| `gerente_engenharia` | visao gerencial de engenharia |
| `visualizador` | leitura, sem mutacoes |

QA deve tentar:

- mutacao como visualizador;
- mutacao como cargo fora do fluxo;
- URL direta sem permissao de pagina;
- token ausente;
- token invalido;
- token expirado;
- autoaprovacao de pedido e movimentacao;
- supervisor aprovando pedido de outro departamento.

---

## 12. Realtime e Notificacoes

Socket backend:

- arquivo `backend/src/socket/socket.js`;
- autentica com JWT no handshake;
- adiciona dados do usuario no socket;
- permite subscribe/unsubscribe por produto.

Eventos emitidos:

| Evento | Quando |
|---|---|
| `alerta:novo` | alerta criado |
| `movimentacao:pendente` | ajuste/devolucao criado pendente |
| `movimentacao:aprovada` | pendencia aprovada |
| `movimentacao:rejeitada` | pendencia rejeitada |
| `estoque:atualizado` | estoque mudou |
| `pedido:status` | status de pedido mudou |
| `faixa:mudou` | faixa Kanban mudou |
| `kanban:recalculado` | recalculo concluido |

QA manual:

- abrir duas sessoes em navegadores/perfis diferentes;
- criar pedido em uma sessao e observar contador/notificacao na outra;
- criar ajuste pendente e validar sino/lista de pendencias;
- aprovar movimentacao e observar atualizacao de estoque sem refresh, quando UI
  suportar;
- simular token invalido no socket e validar desconexao sem quebrar app.

---

## 13. Estrategia de Testes

### 13.1 Piramide Recomendada

1. Unitarios backend para regras puras:
   - Kanban math;
   - pedido workflow;
   - RBAC;
   - erros;
   - paginacao;
   - dados sensiveis;
   - dispatcher.

2. Middleware tests:
   - auth;
   - audit;
   - validate;
   - errorHandler.

3. Integracao API:
   - auth;
   - produtos;
   - fornecedores;
   - configuracoes;
   - movimentacoes;
   - pedidos;
   - usuarios;
   - grafo;
   - dashboard/alertas/listagens gerais.

4. Manual funcional:
   - navegacao real;
   - permissoes por UI;
   - responsividade;
   - fluxos ponta a ponta;
   - evidencia visual.

5. E2E futuro recomendado:
   - Playwright ou Cypress para login, produto, estoque, pedido, aprovacao,
     emissao e recebimento.

### 13.2 Comandos de Automacao

Suite backend completa:

```bash
cd backend
npm test
```

Unitarios:

```bash
cd backend
npm run test:unit
```

Integracao:

```bash
cd backend
npm run test:integration
```

Build frontend:

```bash
cd frontend
npm run build
```

Validacao combinada da raiz:

```bash
npm run validate
```

Checagem de whitespace:

```bash
git diff --check
```

### 13.3 Cobertura Automatizada Atual

Ja existe cobertura automatizada para:

- auth routes;
- auth middleware;
- error handler;
- validate middleware;
- audit middleware;
- RBAC;
- pedido workflow;
- Kanban math;
- paginacao;
- dados sensiveis;
- produtos routes;
- pedidos routes;
- movimentacoes routes;
- configuracoes routes;
- fornecedores routes;
- usuarios routes;
- grafo routes;
- rotas gerais de health/dashboard/alertas/listagens.

Gaps conhecidos:

- frontend nao possui suite automatizada propria;
- Socket.io nao tem teste E2E dedicado;
- cron jobs precisam de testes especificos quando alterados;
- acessibilidade visual e teclado dependem de QA manual;
- fluxo completo navegador + backend + banco ainda depende de regressao manual.

---

## 14. Manual do QA - Preparacao de Ciclo

Antes de testar:

1. Registrar branch e commit.
2. Confirmar `.env`.
3. Rodar `npm run db:fresh` se for ciclo limpo.
4. Rodar `npm run dev`.
5. Abrir `http://localhost:5173`.
6. Checar `http://localhost:3001/health`.
7. Checar `http://localhost:3001/ready`.
8. Logar com admin inicial quando banco estiver limpo.
9. Criar usuarios/perfis necessarios.
10. Anotar navegador, resolucao e ambiente.

Admin inicial esperado em banco limpo:

| Campo | Valor |
|---|---|
| Usuario | `admin` |
| Senha | `Admin@123` |

Trocar senha em homologacao/producao.

Massa minima recomendada:

- 1 admin;
- 1 comprador;
- 1 facilitador;
- 1 supervisor_turno;
- 1 gerente_operacoes;
- 1 plant_manager;
- 1 visualizador;
- 1 departamento com supervisor;
- 1 maquina vinculada ao departamento;
- 1 fornecedor ativo;
- 1 produto sem historico;
- 1 produto com CMD/LT inicial;
- 1 produto vinculado a fornecedor e maquina.

---

## 15. Manual do QA - Smoke Test

Executar em toda subida de ambiente:

| ID | Caso | Esperado |
|---|---|---|
| SMK-01 | Abrir `/health` | `status=ok` |
| SMK-02 | Abrir `/ready` | `status=ready` em ambiente completo |
| SMK-03 | Abrir frontend | tela de login carrega |
| SMK-04 | Login admin | redireciona para dashboard |
| SMK-05 | Menu lateral | itens respeitam permissao |
| SMK-06 | Dashboard | KPIs carregam sem erro 500 |
| SMK-07 | Produtos | lista ou estado vazio aparece |
| SMK-08 | Movimentacoes | lista ou estado vazio aparece |
| SMK-09 | Pedidos | lista ou estado vazio aparece |
| SMK-10 | Logout | volta para login |

Falha em qualquer smoke bloqueia teste exploratorio mais profundo.

---

## 16. Manual do QA - Casos por Modulo

### 16.1 Auth e Sessao

| ID | Caso | Passos | Esperado |
|---|---|---|---|
| AUTH-01 | Login valido | entrar com admin/senha correta | dashboard abre |
| AUTH-02 | Usuario inexistente | login com usuario falso | 401 e mensagem legivel |
| AUTH-03 | Senha incorreta | errar senha | 401, contador de tentativas |
| AUTH-04 | Bloqueio | errar 5 vezes | conta bloqueada por 15 min |
| AUTH-05 | Usuario inativo | desativar usuario e tentar login | login negado |
| AUTH-06 | Refresh | expirar access token em teste controlado | chamada refaz token sem logout |
| AUTH-07 | Logout | sair do sistema | token revogado, volta login |
| AUTH-08 | Inatividade | ficar 10 min sem interacao | logout automatico |
| AUTH-09 | URL interna sem login | abrir `/produtos` anonimo | redirect para login |

### 16.2 Usuarios

| ID | Caso | Esperado |
|---|---|---|
| USR-01 | Admin cria usuario valido | 201, usuario aparece |
| USR-02 | Senha menor que 8 | 400 |
| USR-03 | Senha com espaco | 400 |
| USR-04 | Username com espaco | 400 |
| USR-05 | Username duplicado | 409 ou erro de conflito |
| USR-06 | Reset senha valido | senha nova funciona |
| USR-07 | Reset senha com whitespace | 400 |
| USR-08 | Desativar usuario | nao consegue logar |
| USR-09 | Comprador tenta criar usuario | 403 |
| USR-10 | Visualizador abre tela usuarios sem permissao | acesso negado ou menu oculto |

### 16.3 Configuracoes

| ID | Caso | Esperado |
|---|---|---|
| CFG-01 | Alterar limite supervisor | salva e recarrega |
| CFG-02 | Gerente menor que supervisor | 400 `LIMITE_INVALIDO` |
| CFG-03 | Custo manter `0.25` | salva como decimal |
| CFG-04 | Custo manter `1.5` | 400 |
| CFG-05 | Nivel servico 98 | salva e novo produto usa default |
| CFG-06 | Ciclos 2 | 400 |
| CFG-07 | Ciclos 11 | 400 |
| CFG-08 | Turno duplicado | 400 `TURNO_DUPLICADO` |
| CFG-09 | Turno horario invalido | 400 |
| CFG-10 | Remover pagina de visualizador | menu/URL respeitam novo acesso |
| CFG-11 | Colocar comprador como aprovador | 400 |
| CFG-12 | Nao-admin salva configuracao | 403 |

### 16.4 Fornecedores

| ID | Caso | Esperado |
|---|---|---|
| FOR-01 | Criar so com nome | fornecedor ativo criado |
| FOR-02 | Criar com modal `Motoboy` | salva `motoboy` |
| FOR-03 | Criar com modal `Correios` | salva `correios` |
| FOR-04 | UF `sp` | salva `SP` |
| FOR-05 | Email invalido | 400 |
| FOR-06 | Modal invalido | 400, nunca 500 |
| FOR-07 | CNPJ duplicado | 409 |
| FOR-08 | Editar modal/preco/prazo | dados atualizam |
| FOR-09 | Desativar fornecedor | sai da listagem ativa |
| FOR-10 | Comprador tenta criar fornecedor | 403 |

### 16.5 Departamentos e Maquinas

| ID | Caso | Esperado |
|---|---|---|
| MAQ-01 | Criar departamento com supervisor | supervisor aparece no detalhe |
| MAQ-02 | Criar maquina vinculada ao departamento | maquina aparece na lista |
| MAQ-03 | Vincular produto a maquina | vinculo aparece no detalhe |
| MAQ-04 | Produto em uma maquina | pedido resolve maquina automaticamente |
| MAQ-05 | Produto em duas maquinas sem escolher | 400 `MAQUINA_AMBIGUA` |
| MAQ-06 | Escolher maquina vinculada | pedido criado |
| MAQ-07 | Escolher maquina nao vinculada | 400 `MAQUINA_NAO_VINCULADA` |
| MAQ-08 | Produto sem maquina | 400 `MAQUINA_OBRIGATORIA` |
| MAQ-09 | Desativar maquina | nao aparece como ativa |

### 16.6 Produtos

| ID | Caso | Esperado |
|---|---|---|
| PRD-01 | Criar produto sem CMD/LT | faixa `SEM_DADOS` |
| PRD-02 | Criar com CMD e LT | Kanban inicial calculado |
| PRD-03 | Novo produto herda custo manter config | taxa correta |
| PRD-04 | Campos obrigatorios vazios | 400 |
| PRD-05 | Custo unitario negativo | 400 |
| PRD-06 | Nivel servico invalido | 400 |
| PRD-07 | Editar campos permitidos | dados atualizam |
| PRD-08 | PATCH vazio | 400 |
| PRD-09 | Desativar produto | some da lista ativa |
| PRD-10 | Vincular fornecedor | fornecedor aparece no detalhe |
| PRD-11 | Atualizar fornecedores em lote | lista reflete nova ordem |
| PRD-12 | Editar ABC sem permissao | 403 |
| PRD-13 | Editar ABC com permissao | valor A/B/C salva |
| PRD-14 | Rastreamento calculo | retorna inputs, outputs e conferencia |
| PRD-15 | Inserir item existente | produto criado + entrada inicial |

### 16.7 Movimentacoes

| ID | Caso | Esperado |
|---|---|---|
| MOV-01 | Entrada 100 | estoque aumenta 100, status EXECUTADO |
| MOV-02 | Saida 10 | estoque reduz 10, status EXECUTADO |
| MOV-03 | Saida maior que estoque | 400 `ESTOQUE_INSUFICIENTE` |
| MOV-04 | Ajuste positivo | status PENDENTE, estoque nao muda |
| MOV-05 | Ajuste negativo | status PENDENTE, estoque nao muda |
| MOV-06 | Devolucao | status PENDENTE, estoque nao muda |
| MOV-07 | Aprovar ajuste | estoque muda, status EXECUTADO |
| MOV-08 | Rejeitar ajuste | estoque nao muda, status REJEITADO |
| MOV-09 | Autoaprovacao nao-admin | 403 |
| MOV-10 | Admin autoaprova | permitido |
| MOV-11 | Motivo rejeicao curto | 400 |
| MOV-12 | TRANSFERENCIA novo lancamento | 400 |
| MOV-13 | Turno invalido | 400 |
| MOV-14 | Eng processos cria movimentacao | 403 |
| MOV-15 | Recalculo/alerta apos estoque mudar | faixa/alerta atualizados |

### 16.8 Pedidos

| ID | Caso | Esperado |
|---|---|---|
| PED-01 | Facilitador solicita sem fornecedor | cria usando fornecedor principal |
| PED-02 | Facilitador envia fornecedor | 403 |
| PED-03 | Comprador solicita com fornecedor | pedido criado |
| PED-04 | Produto sem maquina | 400 |
| PED-05 | Produto em N maquinas sem escolher | 400 |
| PED-06 | Supervisor responsavel cria pedido | status `AGUARDANDO_GERENTE` |
| PED-07 | Pedido abaixo limite | supervisor aprova para `APROVADO` |
| PED-08 | Pedido >= limite supervisor | supervisor escala para gerente |
| PED-09 | Pedido >= limite gerente | gerente escala para diretoria |
| PED-10 | Diretoria aprova N3 | status `APROVADO` |
| PED-11 | Autoaprovacao nao-admin | 403 |
| PED-12 | Supervisor de outro depto | 403 |
| PED-13 | Rejeitar com motivo valido | status `REJEITADO` |
| PED-14 | Rejeitar com motivo curto | 400 |
| PED-15 | Comprador emite sem OC externa | 400 |
| PED-16 | Comprador emite sem fornecedor | 400 |
| PED-17 | Comprador informa OC externa | status `AGUARDANDO_CHEGADA` |
| PED-18 | Receber sem NF | 400 |
| PED-19 | Recebimento parcial | status `RECEBIDO_PARCIAL` |
| PED-20 | Recebimento total | status `CONCLUIDO`, estoque aumenta |
| PED-21 | Buscar por numero | retorna pedido correto |
| PED-22 | Cancelar por perfil sem permissao | 403 |

### 16.9 Kanban

| ID | Caso | Esperado |
|---|---|---|
| KAN-01 | Sem historico e sem CMD/LT | `SEM_DADOS` |
| KAN-02 | CMD/LT inicial validos | parametros estimados |
| KAN-03 | Historico real suficiente | recalculo estatistico |
| KAN-04 | Historico insuficiente com parametros manuais | preserva manuais |
| KAN-05 | Estoque <= ES | vermelho |
| KAN-06 | ES < estoque <= PR | amarelo |
| KAN-07 | Estoque > PR | verde |
| KAN-08 | EOQ com custo unitario 0 | EOQ 0 |
| KAN-09 | Nivel servico invalido no calculo | usa 95 |
| KAN-10 | Produto muda de faixa | alerta criado |
| KAN-11 | Rastreamento | formulas e intermediarios coerentes |

### 16.10 Dashboard, Alertas e Relatorios

| ID | Caso | Esperado |
|---|---|---|
| REL-01 | Banco vazio | telas mostram estado vazio |
| REL-02 | Produtos por faixa | dashboard soma corretamente |
| REL-03 | Alertas nao lidos | contador correto |
| REL-04 | Marcar alerta lido | contador reduz |
| REL-05 | Marcar todos lidos | contador zera |
| REL-06 | Curva ABC | valor consumo = custo * demanda anual |
| REL-07 | Giro estoque | lista coerente com movimentacoes |
| REL-08 | Top solicitantes | ordena por volume/valor |
| REL-09 | Top produtos saida | considera saidas |
| REL-10 | Previsao gastos | considera pedidos abertos/previstos |
| REL-11 | Filtro periodo | altera resultados |

### 16.11 Grafo

| ID | Caso | Esperado |
|---|---|---|
| GRA-01 | Abrir grafo com permissao | nos e arestas carregam |
| GRA-02 | Filtrar por produto | reduz relacionamentos |
| GRA-03 | Filtrar por maquina/departamento | grafo coerente |
| GRA-04 | Filtro invalido | 400 |
| GRA-05 | Cargo sem acesso | 403 ou pagina bloqueada |
| GRA-06 | Banco vazio | estado vazio sem erro |

### 16.12 RACI

| ID | Caso | Esperado |
|---|---|---|
| RACI-01 | Abrir matriz | renderiza sem erro |
| RACI-02 | Expandir item | conteudo aparece |
| RACI-03 | Editar como admin se tela permitir | salva/atualiza estado |
| RACI-04 | Usuario nao admin tenta editar | bloqueado |
| RACI-05 | Layout mobile | nao quebra colunas criticas |

---

## 17. Checklist Regressivo Obrigatorio

Rodar antes de aprovar release:

- `git status --short --branch`;
- `git diff --check`;
- `cd backend && npm test`;
- `cd frontend && npm run build`;
- login admin;
- criar usuario valido;
- bloquear senha curta;
- bloquear senha com espaco;
- criar fornecedor com modal valido;
- bloquear fornecedor com modal invalido;
- criar departamento com supervisor;
- criar maquina;
- criar produto sem CMD/LT;
- criar produto com CMD/LT;
- vincular produto a fornecedor;
- vincular produto a maquina;
- inserir item existente com estoque inicial;
- entrada de estoque;
- saida de estoque;
- ajuste pendente;
- aprovar ajuste;
- rejeitar ajuste;
- criar pedido como facilitador;
- aprovar N1;
- escalar N2;
- escalar N3 quando valor exigir;
- emitir com OC externa;
- receber parcial;
- receber total;
- validar estoque apos recebimento;
- validar alerta/sino;
- validar dashboard;
- validar relatorios;
- validar grafo;
- validar permissao de pagina por URL direta;
- validar visualizador sem acoes de escrita;
- testar mobile ou viewport estreito.

---

## 18. Matriz de Rastreabilidade

| Modulo | Backend | Frontend | Testes existentes | QA manual obrigatorio |
|---|---|---|---|---|
| Auth | `routes/auth.js`, `services/auth.service.js` | `Login.jsx`, `useAuth.js`, `api.js` | auth routes/middleware | login, refresh, logout, inatividade |
| Usuarios | `routes/usuarios.js` | `Usuarios.jsx` | usuarios routes | CRUD, senha, perfil |
| Configuracoes | `routes/configuracoes.js`, `configuracoes.service.js` | `Configuracoes.jsx` | configuracoes routes | limites, permissoes, turnos |
| Produtos | `routes/produtos.js`, Kanban services | `Produtos.jsx`, `ProdutoDetalhe.jsx` | produtos routes, kanban math | cadastro, item existente, detalhe |
| Fornecedores | `routes/fornecedores.js` | `Fornecedores.jsx` | fornecedores routes | modais, CNPJ, soft delete |
| Maquinas | `routes/maquinas.js`, `routes/departamentos.js` | `Maquinas.jsx` | general routes | vinculos e roteamento pedido |
| Movimentacoes | `routes/movimentacoes.js` | `Movimentacoes.jsx` | movimentacoes routes | estoque, pendencia, aprovacao |
| Pedidos | `routes/pedidos.js`, `pedido.workflow.js` | `Pedidos.jsx`, `AcompanharPedido.jsx` | pedidos routes/workflow | fluxo E2E compra |
| Kanban | `kanban.math.js`, `kanban.calc.js` | components kanban/charts | kanban math | faixas e rastreamento |
| Dashboard | `routes/dashboard.js` | `Dashboard.jsx` | general routes | KPIs e estados vazios |
| Alertas | `routes/alertas.js`, notificacoes | `Alertas.jsx`, `Header.jsx` | general routes | contador e lidos |
| Relatorios | `routes/relatorios.js` | `Relatorios.jsx` | parcial por rotas | numeros e filtros |
| Grafo | `routes/grafo.js` | `GrafoRelacionamentos.jsx` | grafo routes | filtros e permissao |
| RACI | dados locais | `Raci.jsx`, `raci.data.js` | nao dedicado | renderizacao e permissao |
| Realtime | `socket/socket.js`, eventos nas rotas | `useSocket.js`, `socket.js` | nao dedicado | duas sessoes e eventos |

---

## 19. Criterios de Aceite

Uma entrega so deve ser aprovada quando:

- testes automatizados relevantes passam;
- build frontend passa;
- nao ha erro 500 em fluxo previsivel de validacao;
- permissoes backend e frontend estao coerentes;
- estoque nao fica negativo;
- mutacao de estoque e transacional;
- pedido nao pula aprovacao indevida;
- comprador informa OC externa em vez de gerar OC interna;
- visualizador nao executa mutacoes;
- mensagens de erro sao legiveis;
- banco limpo nao contem dados operacionais mockados;
- documentacao foi atualizada quando regra/status/API mudou;
- QA anexou evidencias dos fluxos criticos.

---

## 20. Evidencias de QA

Para cada ciclo, anexar:

- data e hora;
- ambiente;
- branch e commit;
- navegador e versao;
- usuario/perfil usado;
- massa de dados usada;
- comandos executados;
- resultado dos testes automatizados;
- prints ou video dos fluxos criticos;
- payload e resposta da API em falhas;
- logs do backend em erro 500;
- resultado final: aprovado, reprovado ou bloqueado.

Template:

```text
Ciclo:
Data:
Ambiente:
Branch/commit:
Executor:
Navegador:

Automacao:
- backend:
- frontend build:

Fluxos manuais:
- Auth:
- Usuarios:
- Produtos:
- Movimentacoes:
- Pedidos:
- Relatorios:
- Permissoes:

Defeitos:
- ID:
- Severidade:
- Passos:
- Esperado:
- Obtido:
- Evidencias:

Resultado:
```

---

## 21. Severidade de Bugs

| Severidade | Definicao | Exemplos |
|---|---|---|
| S1 - Bloqueante | impede uso ou corrompe dado | estoque errado, login indisponivel, pedido travado |
| S2 - Alta | fluxo critico falha com contorno ruim | aprovacao indevida, OC sem validacao, 500 em acao comum |
| S3 - Media | problema funcional com contorno simples | filtro errado, mensagem ruim, contador atrasado |
| S4 - Baixa | visual/cosmetico sem impacto operacional | alinhamento, texto, pequeno ajuste de layout |

Sempre abrir como S1/S2 quando envolver:

- perda ou corrupcao de estoque;
- permissao indevida;
- aprovacao indevida;
- vazamento de dado sensivel;
- falha de login geral;
- migracao quebrada;
- erro 500 em validacao normal.

---

## 22. Checklist do Dev Antes de Entregar

- entendi qual regra de negocio estou alterando;
- li rota, service, frontend e testes relacionados;
- mantive a mudanca no menor escopo possivel;
- atualizei ou criei teste unit/integration quando a regra mudou;
- nao deixei regra critica apenas no frontend;
- usei transacao quando alterei multiplas tabelas criticas;
- tratei erro de validacao como 400/409, nao 500;
- preservei audit em mutacoes;
- invalidei queries React Query apos mutacao;
- testei perfil permitido e perfil negado;
- rodei `npm test` no backend ou teste especifico justificavel;
- rodei build frontend quando alterei UI;
- atualizei este manual quando API/status/regra mudou.

---

## 23. Checklist do QA Antes de Aprovar

- smoke passou;
- automacao passou ou falha foi justificada;
- testei pelo menos um perfil permitido e um negado;
- testei pelo menos um caso feliz e um negativo por modulo alterado;
- validei banco/estoque antes e depois quando aplicavel;
- validei mensagens de erro;
- validei reload da pagina;
- validei URL direta para permissao;
- validei estado vazio ou massa minima;
- anexei evidencias;
- registrei riscos residuais.

---

## 24. Troubleshooting

Backend nao sobe:

- checar `.env`;
- checar `DATABASE_URL`;
- checar Postgres rodando;
- abrir `/health`;
- abrir `/ready`;
- se porta 3001 ocupada, encerrar processo ou mudar `PORT`.

Frontend nao conecta na API:

- checar console: `[Kanban Estoque] API base`;
- checar `VITE_API_URL`;
- checar CORS;
- checar se backend esta em `3001`;
- em celular/tablet, acessar pelo IP LAN e garantir backend em `0.0.0.0`.

Testes falhando por banco:

- confirmar env de teste em `backend/tests/setup.js`;
- confirmar mocks de Redis nos testes;
- rodar teste isolado para reduzir ruido;
- revisar queries mockadas em integracao.

Erro 401 inesperado:

- token expirou;
- refresh falhou;
- usuario foi desativado;
- access token esta em blacklist;
- secret diferente entre geracao e validacao.

Erro 403 inesperado:

- cargo nao esta no fluxo configurado;
- permissao por pagina foi removida;
- rota exige cargo fixo;
- usuario tentou autoaprovacao;
- supervisor nao e responsavel pelo departamento.

Pedido nao cria:

- produto nao existe;
- produto nao esta vinculado a maquina;
- produto esta em varias maquinas e nenhuma foi escolhida;
- facilitador tentou escolher fornecedor;
- cargo nao esta em `pedidos.solicitantes`.

Pedido nao emite:

- status nao esta `APROVADO`;
- usuario nao e comprador/admin ou nao esta nos compradores configurados;
- falta OC externa;
- falta fornecedor.

Pedido nao recebe:

- status ainda nao esta aguardando chegada/transito/parcial;
- usuario nao esta nos recebedores;
- falta NF;
- quantidade invalida.

Kanban estranho:

- historico pode ser insuficiente;
- produto pode depender de parametros manuais;
- CMD/LT iniciais podem ter gerado serie estimada;
- verificar `/produtos/:id/rastreamento-calculo`;
- confirmar lead time nominal no fornecedor vinculado.

---

## 25. Roadmap Recomendado de Qualidade

Prioridade alta:

- adicionar Playwright E2E para fluxo login -> produto -> estoque -> pedido ->
  aprovacao -> emissao -> recebimento;
- adicionar teste de Socket.io autenticado;
- adicionar teste automatizado para permissao por pagina no frontend;
- adicionar teste de acessibilidade basico nas telas principais;
- adicionar cobertura para jobs cron.

Prioridade media:

- dados seed controlados para homologacao;
- relatorio de cobertura Jest em CI;
- contrato OpenAPI ou colecao Postman versionada;
- testes visuais de componentes Kanban/charts;
- teste mobile LAN documentado.

Prioridade baixa:

- snapshots de emails/notificacoes futuras;
- testes de carga para listagens grandes;
- auditoria automatica de contraste visual.

---

## 26. Definicao de Pronto

Uma tarefa esta pronta quando dev e QA conseguem responder "sim" para:

- a regra alterada esta clara?
- a API responde corretamente em sucesso e erro?
- a UI mostra feedback correto?
- permissao foi testada?
- auditoria/log nao quebrou?
- estoque/pedido/Kanban ficaram consistentes?
- testes automatizados relevantes passam?
- regressao manual minima passou?
- documentacao foi atualizada?

Se uma dessas respostas for "nao", a entrega ainda nao esta pronta.

---

## 27. Evidencias da Atualizacao QA - UI Redesign & Security Patch (2026-07-22)

### 27.1 Correcoes de Seguranca, UI/UX e RBAC Aplicadas

1. **Recuperacao de Senha com Token Manual (`/recuperar-senha`)**:
   - Adicionado campo de input explicito de Token de Recuperacao na tela `RecuperacaoSenha.jsx`.
   - Adicionada opcao *"Já possui um token de recuperação? Digite o token aqui"* no modal de login.
   - Eliminada a mensagem impeditiva de "Token Invalido" quando o usuario navega sem parametro de query na URL.

2. **RBAC Rigido na UI e Sidebar**:
   - `Sidebar.jsx` e `permissoes.js` atualizados com fallback seguro `DEFAULTS_PAGINAS`.
   - Modulos sensiveis como **Seguranca** e **Configuracoes** agora sao **totalmente ocultos na Sidebar** para perfis sem acesso (ex: `visualizador`, `comprador`, `facilitador`).
   - `PageRoute` redireciona diretamente com `<Navigate to="/dashboard" replace />` impedindo acesso por URL direta.

3. **Gestao de Fornecedores Vinculados ao Produto (`ProdutoDetalhe.jsx`)**:
   - Criada coluna **Acoes** na tabela de fornecedores vinculados do produto.
   - Adicionado botao de **Editar** (preenche form e permite atualizar prioridade, preco acordado e lead time nominal).
   - Adicionado botao de **Desvincular / Excluir** (`DELETE /api/v1/produtos/:id/fornecedores/:fornecedor_id`).

4. **Reformulacao da Regua Kanban (`KanbanBar.jsx`)**:
   - Posicionamento da pill `Atual: X` isolado no topo da regua com seta indicadora.
   - Marcacoes numericas (`0`, `ES`, `PR`, `Emax`) com alinhamento inteligente e sem sobreposicao ou corte de texto nas bordas.

5. **Harmonizacao da Matriz RACI (`Raci.jsx` e `raci.data.js`)**:
   - Cores das letras RACI diferenciadas e padronizadas:
     - **R (Responsavel)**: Verde Esmeralda (`#0B7A4B`)
     - **A (Aprovador)**: Red Accent (`#C0182A`)
     - **C (Consultado)**: Ambar / Laranja (`#D97706`)
     - **I (Informado)**: Grafite / Slate (`#475569`)
   - Filtros de categoria integrados no tema Red & White.

6. **Validacao de Logout por Inatividade**:
   - Unificado o timer de inatividade (10 min) + modal com contagem regressiva de 60s em `App.jsx`.
   - Removidos timers concorrentes ou redundantes.

### 27.2 Status de Testes e Compilacao
- **Backend Unit Tests:** 254/254 testes unitarios executados e aprovados.
- **Frontend Build (Vite):** Compilacao final de producao concluida com sucesso.
