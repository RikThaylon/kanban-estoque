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
- Aplica schema e seed inicial

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
| `npm run db:seed` | Aplica dados iniciais |
| `npm run db:reset` | Schema + seed |
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
│   ├── migrations/       # SQL — schema + seed
│   ├── src/
│   │   ├── config/       # env, database, redis, migrate, seed
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
