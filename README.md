# Kanban Estoque

Sistema web de **controle de estoque com metodologia Kanban** — cálculo de pontos de reposição, classificação ABC, gestão de pedidos, alertas de prazo, dashboard em tempo real.

---

## Stack

| Camada | Tecnologias |
|---|---|
| **Frontend** | React 18, Vite, TailwindCSS, React Query, Zustand, Socket.io-client, Recharts |
| **Backend** | Node.js, Express, Socket.io, JWT (com refresh + blacklist), Zod, Winston, node-cron |
| **Banco** | PostgreSQL 15+ (UUID, JSONB, audit log) |
| **Cache** | Redis 7 (opcional em dev — fallback em memória) |

---

## Principais fluxos do sistema

### Produtos e estoque inicial

O catálogo separa duas intenções operacionais:

- **Cadastrar produto**: cria o cadastro técnico do item, seus parâmetros de custo, unidade, localização, nível de serviço e dados iniciais de Kanban.
- **Inserir item existente**: usado quando o material já existe fisicamente no estoque e veio de planilha, inventário ou outro método anterior. O sistema cria o produto e registra uma **entrada inicial de estoque** com turno e documento de referência.

Essa separação evita misturar cadastro mestre com movimentação real de estoque, mantendo rastreabilidade desde a implantação.

### Movimentações

As movimentações exigem produto, tipo, quantidade e **turno operacional**. Os tipos disponíveis para novos lançamentos são:

- Entrada
- Saída
- Ajuste positivo
- Ajuste negativo
- Devolução

Transferências foram retiradas dos novos lançamentos para manter o fluxo mais simples e auditável. Registros históricos continuam preservados caso existam no banco.

### Kanban e gráficos

O cadastro pode usar CMD (consumo médio diário) e lead time estimado para iniciar o cálculo. Conforme o uso real cresce, o sistema recalcula parâmetros com histórico de movimentações e pedidos.

O gráfico de ciclo Kanban usa eixo temporal real com data e hora. Se houver mais de uma saída no mesmo dia, os pontos aparecem como eventos separados; o usuário pode usar o controle de zoom/brush para investigar detalhes por período.

O estoque maximo (EMax) nao e uma quantidade fixa de dias. O sistema calcula `EMax = estoque de seguranca + lote economico (EOQ)`. A cobertura em dias e derivada depois: `dias de cobertura no maximo = EMax / CMD`. Exemplo: se o EMax for 120 unidades e o consumo medio diario for 6 unidades/dia, o estoque maximo representa cerca de 20 dias de cobertura.

Quando ainda nao existe historico suficiente, o sistema nao forca ES, PR, EOQ ou EMax estatisticos. Ele usa os valores manuais cadastrados no item ate haver dados reais suficientes.

### Aprovações e notificações

O fluxo principal de compra é:

1. O facilitador cria a solicitação vinculando produto e máquina.
2. A máquina identifica o departamento e o supervisor responsável.
3. A solicitação vai para o supervisor quando fica abaixo do limite configurado.
4. Acima do limite do supervisor, vai para o gerente de operações.
5. Acima do limite do gerente, escala para diretoria/plant manager.
6. Quando aprovada, cai para o comprador emitir a OC externa e escolher/confirmar fornecedor.

Pedidos e movimentações pendentes aparecem no sino de notificação com contador em vermelho. Eventos recebidos via WebSocket também geram popups de feedback para melhorar a fluidez do processo, por exemplo:

- pedido criado aguardando aprovação;
- pedido aprovado e liberado para compra;
- movimentação pendente, aprovada ou rejeitada;
- alertas operacionais de estoque.

### Configurações administrativas

Administradores podem ajustar limites de aprovação, nível de serviço padrão, ciclos iniciais de estimativa, turnos operacionais e permissões por cargo. Essas configurações ficam centralizadas para reduzir alterações manuais no código.

Os turnos iniciais cadastrados pelo sistema são:

- `1T`: 06:00-14:00
- `2T`: 14:01-22:00
- `3T`: 22:01-05:59

Eles ficam em `configuracoes_sistema` e podem ser alterados pelo admin na tela de Configurações.

---

## Como rodar — modo local sem Docker

> **Pré-requisitos:** Node.js ≥ 20 e PostgreSQL ≥ 15 instalados nativamente.

### 1. Instale o PostgreSQL (se ainda não tiver)

PowerShell **como Administrador**:
```powershell
winget install -e --id PostgreSQL.PostgreSQL.16
```

Ou baixe o instalador oficial: <https://www.postgresql.org/download/windows/>

Durante a instalação, anote a senha do superusuário `postgres`.

### 2. Setup automatizado

Na raiz do projeto, abra o PowerShell e rode:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

O script:
- Verifica Node e PostgreSQL
- Cria role `kanban_user` e database `kanban_estoque`
- Instala dependências (raiz + backend + frontend)
- Aplica schema e configuracoes padrao, sem dados mockados

### 3. Iniciar backend e frontend

```powershell
.\scripts\start-local.ps1
```

Ou diretamente:

```bash
npm run dev
```

- Frontend: <http://localhost:5173>
- Backend health: <http://localhost:3001/health>

### Comandos úteis

| Comando | Função |
|---|---|
| `npm run dev` | Sobe backend + frontend juntos |
| `npm run dev:backend` | Só backend |
| `npm run dev:frontend` | Só frontend |
| `npm run db:migrate` | Aplica schema |
| `npm run db:reset` | Remove todas as tabelas do banco local |
| `npm run db:fresh` | Recria schema e configuracoes padrao sem dados operacionais |
| `npm run build:frontend` | Build de produção do frontend |

---

## Como rodar — modo Docker (alternativa)

Requer Docker Desktop em execução.

```bash
docker compose up -d --build
```

> Os Dockerfiles podem precisar ser criados se ainda não existirem nas pastas `backend/` e `frontend/`.

---

## Variáveis de ambiente

Veja `.env.example`. Principais:

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://kanban_user:...@localhost:5432/kanban_estoque` | String de conexão Postgres |
| `REDIS_ENABLED` | `false` (dev) | `false` usa stub em memória; `true` exige Redis em `REDIS_URL` |
| `JWT_SECRET` | (dev secret) | **Trocar em produção** — mínimo 32 caracteres |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Origens permitidas |

---

## Estrutura do projeto

```
.
├── backend/
│   ├── migrations/       # SQL — schema + configuracoes padrao
│   ├── src/
│   │   ├── config/       # env, database, redis, migrate, reset
│   │   ├── middleware/   # auth, rbac, audit, rate limit, error
│   │   ├── routes/       # auth, usuarios, produtos, pedidos, ...
│   │   ├── services/     # auth, kanban.calc, notificações
│   │   ├── jobs/         # cron — recálculo, prazos, ABC, limpeza
│   │   ├── socket/       # WebSocket
│   │   ├── utils/        # logger, errors, pagination
│   │   ├── app.js
│   │   └── server.js
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/   # charts, kanban, layout
│       ├── pages/        # Dashboard, Login, Produtos, ...
│       ├── hooks/        # useAuth, useSocket
│       ├── stores/       # zustand (auth, ui)
│       └── services/     # api (axios), socket
├── scripts/              # setup-local.ps1, start-local.ps1
├── docker-compose.yml
├── RACI.md               # Matriz de responsabilidades
└── README.md
```

---

## Cron jobs (em produção)

| Quando | O quê |
|---|---|
| 06:00 e 18:00 | Recálculo Kanban (pontos de reposição) |
| 08:00 | Verificar pedidos com prazo vencido |
| 03:00 | Limpar tokens expirados |
| Domingo 02:00 | Reclassificação ABC |

---

## Suporte / Quem contactar

Veja [RACI.md](RACI.md) — matriz de responsabilidades por situação (bug, parametrização Kanban, parada do sistema, dúvida de processo, etc.).

---

## Licença e propriedade

⚠️ **Software proprietário da Brimajor.ia. Todos os direitos reservados.**

Este projeto é um **produto-base** comercializado pela Brimajor.ia, customizado conforme contrato para cada cliente. **Não é open-source** e não pode ser copiado, modificado ou redistribuído sem autorização expressa por escrito.

- Termos completos: [LICENSE](LICENSE)
- Aviso de propriedade intelectual: [NOTICE.md](NOTICE.md)

© 2026 Brimajor.ia.
