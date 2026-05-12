# Analise da Equipe Codex - Kanban Estoque

Data: 2026-05-12
Repositorio analisado: `C:\Users\CMDI\kanban-estoque`
Status: analise somente leitura realizada antes deste documento
Contexto: projeto ja esta no ar no Render, segundo informacao do usuario

## Objetivo Da Analise

Avaliar o projeto `kanban-estoque` com a equipe de agentes, considerando:

- aderencia ao conceito de controle de estoque com Kanban;
- separacao entre Kanban de estoque e matriz RACI de acoes;
- maturidade do MVP para demonstracao e venda;
- riscos de backend, frontend, banco, seguranca e deploy no Render;
- proximos passos para evoluir o sistema para SaaS robusto.

## Equipe Envolvida

- Coordenador: consolidacao da analise e priorizacao.
- Product Owner: leitura de produto, MVP, fluxo Kanban/RACI e proposta comercial.
- Arquiteto: arquitetura, banco, contratos entre frontend/backend e stack.
- Backend: rotas, migrations, RBAC, seguranca, jobs e calculos.
- Frontend: UX, telas, integracao com API/socket e demo vendavel.
- ML/IA: previsao de consumo, lead time, Holt, regressao e qualidade dos dados.
- DevOps: Render, Docker, ambiente, health check, CI/CD e operacao.
- QA/Revisor: riscos, testes ausentes e validacao antes de producao.

## Veredito Geral

O projeto ja tem uma base forte. Ele nao e apenas uma ideia: possui frontend React/Vite, backend Express, PostgreSQL, JWT, RBAC basico, movimentacoes, pedidos, fornecedores, alertas, dashboard, regua Kanban, grafico serrote, calculos com Holt/regressao e uma tela RACI visual.

A melhor descricao atual e:

> Controle de estoque com ponto de reposicao Kanban e RACI documental.

Ainda nao e plenamente:

> SaaS multiempresa com Kanban de estoque, RACI acionavel, cargos/permissoes editaveis por cliente e operacao reproduzivel no Render.

## Conceito Correto Do Produto

O Kanban deve representar o controle visual do estoque, nao um quadro de tarefas.

No projeto atual, isso ja aparece em:

- faixas `VERDE`, `AMARELO`, `VERMELHO`;
- estoque de seguranca;
- ponto de reposicao;
- EOQ;
- estoque maximo;
- risco de ruptura;
- sugestoes de compra;
- grafico de serrote.

A matriz RACI deve representar quem age quando surge um problema:

- ruptura;
- atraso de fornecedor;
- divergencia de inventario;
- excesso de estoque;
- erro de movimentacao;
- bug de calculo;
- parada operacional.

Hoje a RACI esta boa para explicacao e treinamento, mas ainda nao cria ocorrencias/tarefas rastreaveis dentro do sistema.

## Pontos Fortes

- Boa separacao entre frontend e backend.
- Stack adequada para MVP: React, Vite, Express, PostgreSQL, Socket.io, TanStack Query e Tailwind.
- Modelo matematico de Kanban ja implementa Holt para demanda e regressao para lead time.
- Existem migrations, seed, jobs, auditoria, JWT, refresh token e blacklist.
- A tela RACI tem boa narrativa visual, com problemas, fluxos e papeis.
- O detalhe do produto tem regua Kanban e grafico serrote, que sao diferenciais comerciais.
- Ha preocupacao com aprovacao de pedidos e movimentacoes.
- O projeto tem historico de commits recentes e parece estar em evolucao ativa.

## Achados P0 - Corrigir Antes De Vender

### P0.1 - Fluxo de aprovacao de pedidos pode quebrar no banco

O codigo usa o status `AGUARDANDO_DIRETORIA`, mas a migration `004_maquinas_departamentos.sql` nao inclui esse status na constraint de `pedidos_compra.status`.

Impacto:

- pedidos acima do limite de diretoria podem falhar ao escalar/aprovar;
- fluxo comercial critico fica inconsistente;
- erro so aparece em runtime.

Arquivos relevantes:

- `backend/src/routes/pedidos.js`
- `backend/migrations/004_maquinas_departamentos.sql`

Recomendacao:

- adicionar `AGUARDANDO_DIRETORIA` na constraint;
- criar migration nova, nao editar historico se o banco de producao ja aplicou a 004;
- adicionar teste de fluxo para pedido acima de `LIMITE_DIRETORIA`.

### P0.2 - Endpoint generico permite alterar status de pedido com permissao ampla demais

`PATCH /api/v1/pedidos/:id/status` exige apenas autenticacao para varios movimentos de status, exceto aprovacao direta.

Impacto:

- usuario autenticado pode mover pedido para estados sensiveis;
- RBAC de compra/aprovacao pode ser contornado;
- risco operacional e financeiro.

Arquivo relevante:

- `backend/src/routes/pedidos.js`

Recomendacao:

- restringir por perfil/capacidade;
- separar endpoints de transicao operacional;
- impedir mudancas criticas sem regra de permissao clara;
- testar todos os status por perfil.

### P0.3 - Criacao de fornecedor provavelmente falha

A rota de fornecedores insere a coluna `criado_por`, mas a tabela `fornecedores` na migration inicial nao possui essa coluna.

Impacto:

- cadastro de fornecedor pode falhar sempre;
- produto nao consegue vincular fornecedor principal;
- pedidos sugeridos ficam comprometidos.

Arquivos relevantes:

- `backend/src/routes/fornecedores.js`
- `backend/migrations/001_initial_schema.sql`

Recomendacao:

- criar migration adicionando `criado_por UUID REFERENCES usuarios(id)` em `fornecedores`;
- ou remover a coluna do insert se nao for necessaria;
- adicionar teste de criacao de fornecedor.

### P0.4 - Frontend e backend estao desalinhados no vinculo produto-fornecedor

Frontend tenta:

- `POST /produtos/:id/fornecedores` ao criar produto;
- `GET /produtos/:id/fornecedores` no detalhe.

Backend expoe:

- `PUT /produtos/:id/fornecedores`;
- fornecedores ja aparecem embutidos no `GET /produtos/:id`.

Impacto:

- cliente pode criar produto achando que vinculou fornecedor, mas o vinculo falha;
- aba de fornecedores pode aparecer vazia;
- demonstracao fica fragil.

Arquivos relevantes:

- `frontend/src/pages/Produtos.jsx`
- `frontend/src/pages/ProdutoDetalhe.jsx`
- `backend/src/routes/produtos.js`

Recomendacao:

- ajustar frontend para usar `PUT` com array `{ fornecedores: [...] }`;
- ou criar endpoints `GET` e `POST` compatíveis;
- remover `catch` silencioso que esconde falha.

## Achados P1 - Alta Prioridade

### P1.1 - RACI ainda nao delega acoes reais

A RACI e um mapa estatico de problemas e responsabilidades. Ela ainda nao cria uma ocorrencia acionavel com responsavel, aprovador, prazo, status, comentarios e evidencia.

Impacto:

- o sistema detecta problemas, mas a execucao fica fora do fluxo;
- perde rastreabilidade operacional;
- a promessa de delegar acoes fica parcialmente manual.

Recomendacao:

Criar entidade `ocorrencias_raci` ou `acoes_operacionais`:

```text
ocorrencias_raci
- id
- tipo_problema
- produto_id
- pedido_id
- movimentacao_id
- alerta_id
- responsavel_id
- aprovador_id
- status
- severidade
- prazo
- descricao
- evidencia
- criado_em
- concluido_em
```

### P1.2 - Botoes do detalhe do produto nao executam acao

No detalhe do produto, os botoes `Lancar Movimentacao` e `Emitir Pedido` nao tem handler.

Impacto:

- quebra o fluxo natural da demo: produto critico -> acao;
- passa sensacao de prototipo incompleto.

Arquivo relevante:

- `frontend/src/pages/ProdutoDetalhe.jsx`

Recomendacao:

- navegar para `/movimentacoes?produto_id=...` e `/pedidos?produto_id=...`;
- ou abrir modais com produto pre-selecionado.

### P1.3 - RBAC ainda e hardcoded

Cargos e permissoes estao fixos no schema/codigo. Isso atende uma operacao industrial especifica, mas nao atende a promessa de cargos/permissoes totalmente editaveis por cliente.

Arquivos relevantes:

- `backend/migrations/001_initial_schema.sql`
- `backend/src/middleware/rbac.js`

Recomendacao:

Evoluir para tabelas:

```text
cargos
permissoes
cargo_permissoes
usuario_cargos
```

Depois trocar `authorize(perfil)` por `authorizePermission('recurso.acao')`.

### P1.4 - Projeto ainda nao e SaaS multiempresa

O README descreve como produto-base customizado. Nao ha `tenant_id`, organizacoes, isolamento por cliente, planos, onboarding ou permissoes por empresa.

Impacto:

- bom para cliente unico;
- limitado para vender como SaaS para varias empresas.

Recomendacao:

Adicionar:

```text
empresas
unidades
usuarios_empresas
cargos por empresa
permissoes por empresa
produtos.empresa_id
pedidos.empresa_id
movimentacoes.empresa_id
alertas.empresa_id
```

### P1.5 - Render nao esta reproduzivel pelo repositorio

Nao foram encontrados:

- `render.yaml`;
- `Procfile`;
- `backend/Dockerfile`;
- `frontend/Dockerfile`;
- release command de migrations;
- documentacao especifica de deploy Render.

Impacto:

- o app pode estar no ar, mas o deploy depende de configuracao manual;
- dificil reproduzir em outra conta/ambiente;
- risco de esquecer variaveis ou migrations.

Recomendacao:

- adicionar `render.yaml` ou documentar o painel do Render;
- definir build/start de backend e frontend;
- definir migration antes do start;
- configurar health check real.

### P1.6 - Health check superficial

`/health` retorna `ok`, mas nao valida Postgres, Redis, migrations ou dependencias criticas.

Impacto:

- Render pode considerar a instancia saudavel mesmo com banco/Redis quebrados.

Recomendacao:

Criar:

- `/health` simples para uptime;
- `/ready` validando Postgres/Redis/migrations.

### P1.7 - Cron jobs podem duplicar em multiplas instancias

Os jobs rodam no `server.js`. Se o Render escalar para mais de uma instancia, cada instancia roda os mesmos jobs.

Impacto:

- alertas duplicados;
- recalc duplicado;
- carga extra;
- inconsistencias operacionais.

Recomendacao:

- usar Render Cron Job separado;
- ou lock distribuido no Postgres/Redis;
- ou variavel `RUN_JOBS=true` em apenas uma instancia.

### P1.8 - Redis falha aberto

`connectRedis()` loga erro, mas o servidor continua. Depois autenticação usa Redis para blacklist.

Impacto:

- autenticacao pode falhar em runtime;
- logout/blacklist pode nao ser confiavel;
- producao pode subir degradada sem perceber.

Recomendacao:

- se `REDIS_ENABLED=true` e `NODE_ENV=production`, falhar boot quando Redis estiver indisponivel;
- ou tratar modo degradado explicitamente.

## Achados P2 - Importantes Para Polimento

### P2.1 - Calculo Kanban ignora semanas sem consumo

A serie semanal vem somente das semanas com movimentacao. Semanas zeradas somem.

Impacto:

- demanda media pode ser inflada;
- itens intermitentes parecem consumir mais do que consomem;
- ES/PR podem ficar altos demais.

Arquivo relevante:

- `backend/src/services/kanban.repo.js`

Recomendacao:

- gerar calendario semanal completo;
- preencher semanas sem consumo com zero;
- considerar metodos para demanda intermitente no futuro.

### P2.2 - Formula exibida no frontend esta desatualizada

Backend usa:

```text
ES = Z * sqrt(LT * sigmaD^2 + demanda^2 * sigmaLT^2)
```

Frontend mostra formula simplificada:

```text
Z * sigmaD * sqrt(LT)
```

Impacto:

- reduz confianca em usuarios tecnicos;
- auditoria matematica fica inconsistente.

Arquivos relevantes:

- `backend/src/services/kanban.math.js`
- `frontend/src/pages/ProdutoDetalhe.jsx`

### P2.3 - Alertas e sockets nao estao totalmente sincronizados

Frontend escuta alguns eventos, mas nao todos os eventos emitidos pelo backend, como movimentacao pendente/aprovada/rejeitada.

Impacto:

- dashboard/badges podem ficar desatualizados;
- demo em tempo real fica incompleta.

Recomendacao:

- invalidar queries de `dashboard`, `alertas`, `movimentacoes`, `produtos`, `pedidos` conforme evento.

### P2.4 - Contador global de alertas pode iniciar errado

`alertsUnread` comeca em zero e depende muito de socket/evento novo.

Impacto:

- ao entrar com alertas existentes, badge pode mostrar zero.

Recomendacao:

- buscar resumo inicial no backend;
- sincronizar ao marcar como lido.

### P2.5 - Encoding/mojibake em documentacao e comentarios

O terminal mostrou caracteres quebrados em README, RACI, .env.example e varios comentarios.

Impacto:

- prejudica onboarding;
- passa impressao ruim para cliente/equipe;
- pode atrapalhar scripts/automacoes que leem texto.

Recomendacao:

- padronizar arquivos em UTF-8;
- revisar README, RACI e .env.example;
- evitar caracteres decorativos em logs se o ambiente nao renderiza bem.

## DevOps E Render

### Riscos Atuais

- Docker Compose referencia Dockerfiles inexistentes.
- Nao ha `render.yaml`.
- Nao ha pipeline CI/CD.
- Migrations sao manuais.
- Health check nao valida dependencias.
- Logs em arquivo nao combinam com filesystem efemero do Render.
- Segredos default de desenvolvimento aparecem em exemplos e Compose.
- Frontend depende de `VITE_API_URL` e `VITE_WS_URL` em build-time.

### Checklist Render Recomendado

Variaveis obrigatorias:

```text
NODE_ENV=production
DATABASE_URL=...
REDIS_ENABLED=true
REDIS_URL=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGINS=https://seu-frontend.onrender.com
VITE_API_URL=https://seu-backend.onrender.com/api/v1
VITE_WS_URL=https://seu-backend.onrender.com
```

Backend:

```text
Build: npm ci --prefix backend
Release: npm run migrate --prefix backend
Start: npm start --prefix backend
```

Frontend:

```text
Build: npm ci --prefix frontend && npm run build --prefix frontend
Publish: frontend/dist
```

## QA Recomendado

### Testes Criticos A Criar

- Criar fornecedor.
- Vincular fornecedor a produto.
- Criar produto com fornecedor principal.
- Criar pedido abaixo do limite.
- Criar pedido acima do limite de gerencia.
- Criar pedido acima do limite de diretoria.
- Aprovar pedido por perfil inadequado e esperar 403.
- Aprovar pedido por perfil adequado e esperar status correto.
- Movimentacao que exige aprovacao.
- Autoaprovacao proibida.
- Recalculo Kanban apos movimentacao.
- Serie semanal com semanas zeradas.
- Health/readiness com Postgres indisponivel.
- Render env sem Redis em producao.

## Plano De Execucao Recomendado

### Fase 1 - Estabilizacao P0

1. Corrigir status `AGUARDANDO_DIRETORIA` no banco via migration nova.
2. Restringir `PATCH /pedidos/:id/status` por RBAC.
3. Corrigir criacao de fornecedores.
4. Corrigir vinculo produto-fornecedor no frontend/backend.
5. Conectar CTAs de produto para movimentacao e pedido.

### Fase 2 - Demo Vendavel

1. Preparar seed com itens em verde, amarelo e vermelho.
2. Garantir fornecedores vinculados.
3. Garantir pedidos em varios status.
4. Ajustar formula exibida no detalhe.
5. Sincronizar alertas e sockets.
6. Revisar textos com encoding correto.

### Fase 3 - Operacao Render

1. Adicionar configuracao de deploy reproduzivel.
2. Definir release step de migrations.
3. Criar readiness check.
4. Corrigir Redis em producao.
5. Criar pipeline CI minimo.
6. Resolver Dockerfiles ou remover promessa de Docker.

### Fase 4 - RACI Acionavel

1. Criar entidade de ocorrencias/acoes.
2. Vincular ocorrencias a alertas, produtos, pedidos e movimentacoes.
3. Aplicar matriz RACI para atribuir responsavel e aprovador.
4. Criar status, prazo, comentarios e evidencias.
5. Exibir trilha no detalhe do produto e dashboard.

### Fase 5 - SaaS Real

1. Adicionar empresas/tenants.
2. Adicionar unidades por empresa.
3. Adicionar cargos editaveis por empresa.
4. Adicionar permissoes editaveis por empresa.
5. Isolar dados por tenant.
6. Criar onboarding de cliente.
7. Criar plano comercial/billing futuramente.

## Conclusao

O projeto tem um nucleo promissor e ja demonstra conhecimento real de estoque Kanban. O maior problema nao e falta de funcionalidade: e desalinhamento entre contratos, permissao, banco, frontend e operacao de producao.

A prioridade deve ser estabilizar o fluxo principal:

```text
Produto critico -> fornecedor vinculado -> pedido sugerido -> aprovacao correta -> recebimento -> movimentacao -> recalculo Kanban -> alerta/RACI acionavel
```

Quando esse caminho estiver confiavel, o produto fica muito mais convincente para cliente e muito mais seguro para rodar no Render.

## Implementacao BRIMAJOR

Branch inicial de melhorias: `codex/melhorias-brimajor-mvp`.

Escopo implementado nesta fase:

- migration de estabilizacao para status de diretoria, fornecedor com `criado_por` e base de ocorrencias RACI;
- contratos `GET/POST/PUT /produtos/:id/fornecedores`;
- restricao do endpoint generico de status de pedido;
- readiness check `/ready`;
- protecao contra segredos dev em producao;
- Redis falha o boot em producao quando indisponivel;
- logs cloud-friendly sem transporte de arquivo;
- rate limit usando `RATE_LIMIT_MAX`;
- frontend vinculando fornecedor principal sem engolir erro de API;
- CTAs do detalhe do produto navegando para pedido/movimentacao com produto;
- formula exibida alinhada ao calculo estocastico;
- listeners socket para movimentacoes;
- `render.yaml` e guia `BRIMAJOR_DEPLOY_RENDER.md`.
