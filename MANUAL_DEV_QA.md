# Manual Dev e QA - Kanban Estoque

Este manual descreve como preparar o ambiente, validar regras de negocio e executar testes funcionais, regressivos e tecnicos do sistema Kanban Estoque.

## 1. Visao Geral

O sistema controla estoque industrial com Kanban, compras, fornecedores, usuarios, permissoes, matriz RACI, maquinas, relatorios e historico de movimentacoes.

Fluxo principal:

1. Admin acessa o sistema.
2. Admin cria/ativa usuarios e define permissoes.
3. Produtos e fornecedores sao cadastrados.
4. Estoque e movimentado por entradas, saidas, ajustes e devolucoes.
5. O sistema calcula parametros Kanban quando ha dados suficientes.
6. Facilitador cria solicitacao de compra.
7. Supervisor/gerente aprova conforme valores configurados.
8. Comprador escolhe fornecedor e informa numero da OC externa.
9. Pedido fica emitido sem gerar OC interna.

## 2. Stack

Frontend:

- React 18
- Vite
- TailwindCSS
- React Query
- Zustand
- Socket.io-client
- Recharts

Backend:

- Node.js
- Express
- PostgreSQL
- JWT com refresh token
- bcrypt
- Socket.io
- Jest/Supertest
- Winston
- node-cron

Banco:

- PostgreSQL 15+
- UUID
- JSONB
- migrations SQL em `backend/migrations`

Cache:

- Redis opcional
- Em desenvolvimento, pode usar stub em memoria com `REDIS_ENABLED=false`

## 3. Branches e Publicacao

Branch principal:

- `main`

Padrao para branches de trabalho:

- `codex/<descricao-curta>`

Fluxo recomendado:

1. Criar branch a partir de `main`.
2. Implementar mudancas pequenas.
3. Rodar testes backend.
4. Rodar build frontend.
5. Fazer commit.
6. Push da branch.
7. Merge fast-forward na `main`.
8. Push da `main`.

Comandos:

```bash
git status --short --branch
git switch -c codex/minha-mudanca
git add <arquivos>
git commit -m "Mensagem objetiva"
git push -u origin codex/minha-mudanca
git switch main
git merge --ff-only codex/minha-mudanca
git push origin main
```

## 4. Preparacao do Ambiente Local

Pre-requisitos:

- Node.js 20+
- PostgreSQL 15+
- PowerShell no Windows
- Git

Instalacao automatica:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

Subir backend e frontend:

```powershell
.\scripts\start-local.ps1
```

Ou:

```bash
npm run dev
```

URLs:

- Frontend: http://localhost:5173
- Backend health: http://localhost:3001/health

## 5. Variaveis de Ambiente

Ver arquivo:

- `.env.example`

Variaveis importantes:

| Variavel | Finalidade |
|---|---|
| `DATABASE_URL` | Conexao PostgreSQL |
| `JWT_SECRET` | Assinatura do access token |
| `JWT_REFRESH_SECRET` | Assinatura do refresh token |
| `BCRYPT_ROUNDS` | Custo de hash das senhas |
| `CORS_ORIGINS` | Origens permitidas no frontend |
| `REDIS_ENABLED` | Liga/desliga Redis real |
| `REDIS_URL` | Conexao Redis |

Em producao, trocar todos os secrets.

## 6. Banco de Dados e Migrations

Aplicar migrations:

```bash
npm run db:migrate
```

Resetar banco local:

```bash
npm run db:reset
npm run db:migrate
```

Recriar banco limpo com configuracoes:

```bash
npm run db:fresh
```

Estado esperado apos migrations recentes:

- Dados operacionais/mockados removidos.
- Tabelas estruturadas.
- Apenas admin inicial ativo.
- Configuracoes padrao criadas.
- Permissoes por pagina disponiveis.
- Custo para manter estoque configuravel.

Admin inicial em banco vazio:

| Campo | Valor |
|---|---|
| Usuario | `admin` |
| Senha | `Admin@123` |

Observacao: trocar a senha no primeiro acesso de homologacao/producao.

## 7. Comandos de Validacao Tecnica

Backend:

```bash
cd backend
npm test
```

Ou, da raiz usando o node local:

```bash
node backend/node_modules/jest/bin/jest.js --runInBand --forceExit
```

Frontend:

```bash
cd frontend
npm run build
```

Checagem Git:

```bash
git status --short --branch
git diff --check
```

Resultado esperado:

- Todos os testes backend passam.
- Build frontend conclui sem erro.
- `git diff --check` sem erro de whitespace.

## 8. Regras de Perfil

Admin:

- Acesso total.
- Cria, edita, ativa e desativa usuarios.
- Configura permissoes.
- Edita toda a matriz RACI.
- Define cargos que podem cadastrar item.
- Define cargos que podem editar curva ABC.
- Define acesso por pagina.

Facilitador:

- Uso operacional diario.
- Nao cadastra itens por padrao.
- Cria solicitacao/pedido de compra.

Supervisor de turno:

- Aprova solicitacoes conforme regras de valor.

Comprador:

- Recebe solicitacoes aprovadas.
- Escolhe fornecedor.
- Registra numero da OC externa.
- Nao cria OC interna.
- Pode cadastrar itens por padrao.
- Recebe sugestoes inteligentes por lead time.

Visualizador:

- Nao executa acoes.
- Apenas visualiza dados importantes conforme permissoes de pagina.

## 9. Configuracoes Administrativas

Tela:

- Configuracoes

Validar:

1. Limite do supervisor de turno.
2. Limite do gerente de operacoes.
3. Nivel de servico padrao.
4. Custo para manter estoque.
5. Ciclos de estimativa inicial.
6. Turnos operacionais.
7. Permissoes para cadastrar item.
8. Permissoes para editar curva ABC.
9. Acesso por pagina.

Regra do custo para manter:

- Campo salvo como decimal.
- `0.20` significa 20% ao ano.
- Usado como default no cadastro de novos produtos.
- Produtos ja existentes mantem o valor individual salvo no cadastro.
- O calculo EOQ usa `H = taxa_carregamento * custo_unitario`.

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| CFG-01 | Admin altera limite supervisor | Salva e recarrega com mesmo valor |
| CFG-02 | Gerente menor que supervisor | Bloqueia com erro |
| CFG-03 | Admin altera custo para manter para `0.25` | Salva e recarrega como `0.25` |
| CFG-04 | Admin tenta custo `1.5` | API retorna 400 |
| CFG-05 | Admin altera acesso a pagina Relatorios | Menu respeita permissao apos novo login |
| CFG-06 | Admin remove permissao de cadastrar item | Botao de cadastro some para cargo afetado |

## 10. Login e Usuarios

Tela:

- Login
- Usuarios

Regras de senha para criar/resetar usuario:

- Minimo 8 caracteres.
- Maximo 100 caracteres.
- Nao pode conter espaco ou qualquer whitespace.

Exemplos invalidos:

- `1234567`
- `Senha 123`
- `        `
- `abc defgh`

Exemplos validos:

- `Admin@123`
- `Comprador#2026`
- `SenhaForte01`

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| USR-01 | Criar usuario com senha `1234567` | Bloqueia antes/API 400 |
| USR-02 | Criar usuario com senha `Senha 123` | Bloqueia antes/API 400 |
| USR-03 | Resetar senha com espaco | API 400 |
| USR-04 | Criar usuario com `SenhaForte01` | Usuario criado |
| USR-05 | Criar username com espaco | API 400 |
| USR-06 | Criar username duplicado | API 409 |
| USR-07 | Usuario inativo tenta login | Login bloqueado |
| USR-08 | Senha incorreta repetida | Tentativas aumentam e pode bloquear temporariamente |

## 11. Fornecedores

Tela:

- Fornecedores

Campos:

- Nome/Razao social
- CNPJ
- Modal padrao
- Contato
- Telefone
- E-mail
- Cidade
- Estado
- Prazo de pagamento

Modais aceitos:

- `rodoviario`
- `aereo`
- `maritimo`
- `ferroviario`
- `expresso`
- `motoboy`
- `correios`

Regras:

- Apenas admin cadastra, edita e desativa fornecedores.
- Modal e salvo em minusculo.
- UF e normalizada para maiusculo.
- Modal invalido deve retornar 400, nunca 500.
- CNPJ duplicado deve retornar 409.

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| FOR-01 | Criar fornecedor so com nome | Cria com sucesso |
| FOR-02 | Criar fornecedor com modal Motoboy | Cria com `modal_padrao=motoboy` |
| FOR-03 | Criar fornecedor com modal Correios | Cria com `modal_padrao=correios` |
| FOR-04 | Criar fornecedor com UF `sp` | Salva `SP` |
| FOR-05 | Criar fornecedor com e-mail invalido | API 400 |
| FOR-06 | Criar fornecedor com modal invalido | API 400 |
| FOR-07 | Criar fornecedor com CNPJ duplicado | API 409 |
| FOR-08 | Editar fornecedor e trocar modal | Salva e lista atualizado |
| FOR-09 | Desativar fornecedor | Sai da listagem ativa |

## 12. Produtos

Tela:

- Produtos
- Detalhes do produto

Fluxos:

1. Cadastrar produto novo.
2. Inserir item existente com entrada inicial.
3. Editar produto.
4. Desativar produto.
5. Vincular fornecedor.
6. Editar curva ABC quando permitido.

Campos importantes:

- Codigo
- Nome
- Unidade
- Preco de compra
- Custo para manter
- Nivel de servico
- Localizacao
- CMD inicial
- Lead time inicial
- Fornecedor principal

Regras:

- Custo para manter padrao vem de Configuracoes.
- Campo individual do produto pode ser ajustado no modal.
- Se nao houver historico suficiente, ES, PR, EOQ e EMax nao devem ser calculados automaticamente com falsa precisao.
- Quando CMD e LT iniciais sao informados, o sistema gera uma estimativa inicial.
- Tempo restante no detalhe = `estoque_atual / CMD`.

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| PRD-01 | Criar produto sem CMD/LT | Faixa SEM_DADOS |
| PRD-02 | Criar produto com CMD e LT | Parametros Kanban iniciais aparecem |
| PRD-03 | Custo para manter config `0.25` | Novo produto herda `0.25` |
| PRD-04 | Inserir item existente com estoque inicial | Cria entrada inicial rastreavel |
| PRD-05 | Inserir item existente sem turno | Bloqueia |
| PRD-06 | Editar curva ABC sem permissao | Bloqueia |
| PRD-07 | Vincular fornecedor ao produto | Fornecedor aparece nos detalhes |
| PRD-08 | Detalhe com CMD positivo | Mostra dias de estoque restante |
| PRD-09 | Detalhe sem CMD | Mostra mensagem para informar CMD |

## 13. Estoque e Movimentacoes

Tela:

- Movimentacoes

Tipos:

- Entrada
- Saida
- Ajuste positivo
- Ajuste negativo
- Devolucao

Regras:

- Toda movimentacao deve ter produto, quantidade e turno quando exigido.
- Saida reduz estoque.
- Entrada aumenta estoque.
- Ajuste positivo aumenta estoque.
- Ajuste negativo reduz estoque.
- Devolucao aumenta estoque.
- Movimentacoes podem depender de aprovacao conforme perfil e regra operacional.
- Movimentacao executada dispara recalculo Kanban em segundo plano.

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| MOV-01 | Entrada de 100 unidades | Estoque aumenta 100 |
| MOV-02 | Saida de 10 unidades | Estoque reduz 10 |
| MOV-03 | Saida maior que estoque | Bloqueia ou gera pendencia conforme regra |
| MOV-04 | Ajuste negativo | Estoque reduz e audita |
| MOV-05 | Devolucao | Estoque aumenta |
| MOV-06 | Movimentacao com turno invalido | API 400 |
| MOV-07 | Aprovar pendencia | Status muda e estoque atualiza |
| MOV-08 | Rejeitar pendencia | Estoque nao muda |

## 14. Kanban

Parametros:

- ES: estoque de seguranca.
- PR: ponto de reposicao.
- EOQ: lote economico.
- EMax: estoque maximo.
- CMD: consumo medio diario.
- LT: lead time.

Formulas principais:

- `H = taxa_carregamento * custo_unitario`
- `EOQ = sqrt((2 * demanda_anual * custo_pedido) / H)`
- `EMax = ES + EOQ`
- `dias_restantes = estoque_atual / CMD`
- `valor_consumo_ABC = custo_unitario * demanda_anual`

Regra de historico insuficiente:

- Nao calcular ES, PR, EOQ ou EMax estatisticos quando nao houver dados suficientes.
- Usar valores manuais cadastrados pelo usuario.

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| KAN-01 | Produto sem historico suficiente | Nao forca parametros estatisticos |
| KAN-02 | Produto com historico suficiente | Recalculo gera ES/PR/EOQ/EMax |
| KAN-03 | LT do fornecedor alterado | Regua, serrote e estoque projetado refletem LT |
| KAN-04 | Estoque abaixo ES | Faixa vermelha |
| KAN-05 | Estoque entre ES e PR | Faixa amarela |
| KAN-06 | Estoque acima PR | Faixa verde |

## 15. Compras e Pedidos

Fluxo correto:

1. Facilitador cria solicitacao.
2. Supervisor aprova conforme valor.
3. Gerente/diretoria aprovam quando a regra exigir.
4. Comprador recebe a solicitacao aprovada.
5. Comprador escolhe fornecedor.
6. Comprador informa numero da OC externa.
7. Pedido fica marcado como emitido.

Regra importante:

- O sistema nao gera ordem de compra interna.
- Apenas registra o numero da OC externa informado pelo comprador.

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| PED-01 | Facilitador cria solicitacao | Status de aprovacao correto |
| PED-02 | Valor abaixo limite supervisor | Vai para supervisor |
| PED-03 | Valor acima limite supervisor | Vai para gerente |
| PED-04 | Valor acima limite gerente | Escala para diretoria/plant manager |
| PED-05 | Supervisor aprova | Pedido segue fluxo |
| PED-06 | Aprovador rejeita | Pedido fica rejeitado |
| PED-07 | Comprador informa fornecedor e OC externa | Pedido fica EMITIDO |
| PED-08 | Comprador tenta emitir sem OC externa | Bloqueia |
| PED-09 | Receber pedido emitido | Estoque aumenta |

## 16. Relatorios

Tela:

- Relatorios

Relatorios principais:

- Saidas no periodo.
- Valor consumido.
- Compras emitidas.
- Pendencias.
- Quem mais consome.
- Materiais que mais saem.
- Consumo por categoria.
- Curva ABC.
- Previsao de gastos.
- Giro de estoque.

Curva ABC:

- Valor de consumo anual nao e valor em estoque.
- Formula: `custo_unitario * demanda_anual`.
- Valor em estoque seria `custo_unitario * estoque_atual`.

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| REL-01 | Sem movimentacoes | Relatorios mostram estado vazio |
| REL-02 | Saidas no periodo | KPIs atualizam |
| REL-03 | Curva ABC com um produto | Produto aparece 100% acumulado |
| REL-04 | Filtro de periodo | Numeros mudam conforme periodo |
| REL-05 | Previsao de gastos | Mostra OCs em aberto por chegada estimada |

## 17. Maquinas e Departamentos

Tela:

- Maquinas

Regras:

- Maquina pode estar vinculada a departamento.
- Produto pode ter consumo estimado por maquina.
- Solicitacao pode herdar departamento/supervisor a partir da maquina.

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| MAQ-01 | Criar maquina | Lista maquina criada |
| MAQ-02 | Vincular produto a maquina | Produto aparece com consumo estimado |
| MAQ-03 | Criar pedido por maquina | Departamento/supervisor sao associados |

## 18. RACI

Tela:

- RACI

Admin pode editar:

- Descricao.
- Responsaveis.
- R.
- A.
- C.
- I.

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| RACI-01 | Expandir item | Abre sem quebrar layout |
| RACI-02 | Editar descricao | Salva alteracao |
| RACI-03 | Adicionar linha | Nova linha aparece |
| RACI-04 | Excluir linha | Linha some |
| RACI-05 | Usuario nao admin tenta editar | Bloqueia |

## 19. Permissoes e Navegacao

Casos de QA:

| ID | Caso | Resultado esperado |
|---|---|---|
| PER-01 | Admin acessa todas as paginas | Acesso liberado |
| PER-02 | Visualizador acessa pagina permitida | Visualiza sem botoes de acao |
| PER-03 | Visualizador tenta acao de escrita | Bloqueado/sem botao |
| PER-04 | Cargo sem acesso abre URL direta | Tela de acesso restrito |
| PER-05 | Admin altera matriz de paginas | Menu atualiza apos recarregar/login |

## 20. Checklist de Regressao Obrigatorio

Executar antes de aprovar release:

- Login com admin inicial.
- Criacao de usuario com senha valida.
- Bloqueio de senha curta.
- Bloqueio de senha com espaco.
- Cadastro de fornecedor com todos os modais.
- Cadastro de produto novo.
- Insercao de item existente.
- Entrada de estoque.
- Saida de estoque.
- Solicitacao de compra.
- Aprovacao de compra.
- Emissao com OC externa.
- Recebimento de pedido.
- Relatorios principais.
- Configuracoes de permissao.
- RACI expandir/adicionar/excluir.
- Build frontend.
- Testes backend.

## 21. Criterios de Aceite

Uma entrega so deve ser aprovada quando:

- Nao ha erro 500 em fluxo de usuario.
- Validacoes de formulario retornam 400/409 quando aplicavel.
- Admin consegue configurar permissoes.
- Comprador nao gera OC interna.
- Fornecedor e escolhido apenas no fluxo do comprador.
- Visualizador nao executa acoes.
- Banco limpo nao possui dados mockados.
- Testes automatizados passam.
- Build frontend passa.
- QA consegue reproduzir casos deste manual.

## 22. Evidencias para QA Anexar

Para cada ciclo de teste, anexar:

- Data e hora.
- Branch/commit testado.
- Ambiente usado.
- Navegador e versao.
- Usuario/perfil usado.
- Prints dos fluxos criticos.
- Payload/resposta da API quando houver erro.
- Logs do backend se ocorrer erro 500.
- Resultado final: aprovado, reprovado ou bloqueado.

## 23. Bugs Conhecidos que Dev Deve Evitar

- Nao usar valores mockados em migrations de producao.
- Nao recriar arquitetura para ajuste pontual.
- Nao gerar OC interna.
- Nao calcular parametros Kanban sem historico suficiente.
- Nao aceitar senha com espaco.
- Nao deixar constraint de banco virar erro 500.
- Nao dar a visualizador botoes de escrita.
- Nao esconder erro de validacao como erro generico.

## 24. APIs Criticas

Auth:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Usuarios:

- `GET /api/v1/usuarios`
- `POST /api/v1/usuarios`
- `PATCH /api/v1/usuarios/:id`
- `POST /api/v1/usuarios/:id/reset-senha`
- `DELETE /api/v1/usuarios/:id`

Configuracoes:

- `GET /api/v1/configuracoes/pedidos`
- `PATCH /api/v1/configuracoes/pedidos`
- `GET /api/v1/configuracoes/kanban`
- `PATCH /api/v1/configuracoes/kanban`
- `GET /api/v1/configuracoes/permissoes`
- `PATCH /api/v1/configuracoes/permissoes`
- `GET /api/v1/configuracoes/turnos`
- `PATCH /api/v1/configuracoes/turnos`

Fornecedores:

- `GET /api/v1/fornecedores`
- `POST /api/v1/fornecedores`
- `PATCH /api/v1/fornecedores/:id`
- `DELETE /api/v1/fornecedores/:id`

Produtos:

- `GET /api/v1/produtos`
- `POST /api/v1/produtos`
- `GET /api/v1/produtos/:id`
- `PATCH /api/v1/produtos/:id`
- `DELETE /api/v1/produtos/:id`
- `POST /api/v1/produtos/:id/fornecedores`
- `PATCH /api/v1/produtos/:id/classificacao-abc`
- `GET /api/v1/produtos/:id/rastreamento-calculo`

Movimentacoes:

- `GET /api/v1/movimentacoes`
- `POST /api/v1/movimentacoes`
- `POST /api/v1/movimentacoes/:id/aprovar`
- `POST /api/v1/movimentacoes/:id/rejeitar`

Pedidos:

- `GET /api/v1/pedidos`
- `POST /api/v1/pedidos`
- `POST /api/v1/pedidos/:id/aprovar`
- `POST /api/v1/pedidos/:id/rejeitar`
- `PATCH /api/v1/pedidos/:id/status` com `status=EMITIDO`, `fornecedor_id` e `numero_oc_externa`
- `POST /api/v1/pedidos/:id/receber`

Relatorios:

- `GET /api/v1/relatorios/curva-abc`
- `GET /api/v1/relatorios/giro-estoque`
- `GET /api/v1/relatorios/consumo-por-categoria`
- `GET /api/v1/relatorios/estatisticas-gerais`
- `GET /api/v1/relatorios/previsao-gastos-mensal`

## 25. Resultado Esperado do Build Atual

Ao final desta entrega:

- Custo para manter estoque editavel em Configuracoes.
- Criacao/reset de senha bloqueia espacos e senha curta.
- Cadastro de fornecedor nao retorna 500 por modal invalido.
- Modais de fornecedor alinhados com banco e frontend.
- Manual de QA disponivel neste arquivo.
- Branch publicada e mergeada na `main` apos validacao.
