# BRIMAJOR - Deploy Render

Este projeto deve ser publicado como dois servicos no Render:

- API: `brimajor-kanban-estoque-api`
- Web: `brimajor-kanban-estoque-web`

## Variaveis obrigatorias da API

```text
NODE_ENV=production
BRAND_NAME=BRIMAJOR
DATABASE_URL=...
REDIS_ENABLED=true
REDIS_URL=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGINS=https://brimajor-kanban-estoque-web.onrender.com
```

## Variaveis obrigatorias do frontend

```text
VITE_API_URL=https://brimajor-kanban-estoque-api.onrender.com/api/v1
VITE_WS_URL=https://brimajor-kanban-estoque-api.onrender.com
```

## Health checks

- `/health`: processo HTTP vivo.
- `/ready`: Postgres e Redis prontos.

## Observacao

O arquivo `render.yaml` deixa o ambiente reproduzivel. Se o Render estiver configurado manualmente, espelhe estes comandos e variaveis no painel.
