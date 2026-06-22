# ONBRIEF CODEX: Kanban Estoque 📦

**Projeto:** Sistema Integrado de Gestão de Estoque Kanban e Solicitações de Compras  
**Stack Principal:** React (Vite) + TailwindCSS (Frontend) | Node.js + Express + PostgreSQL (Backend)  
**Status Atual:** Arquitetura estável, interface reformulada (new-ui).

---

## 1. Visão Geral do Sistema
O **Kanban Estoque** é uma plataforma focada na indústria para gerenciar almoxarifados de forma visual, aplicando os conceitos de *Kanban* e *Ponto de Reposição*. O sistema unifica o controle de consumo interno (chão de fábrica) com o departamento de compras, automatizando o cálculo de segurança e facilitando auditorias e aprovações.

---

## 2. Arquitetura de Software

### 2.1 Backend (Node.js/Express)
A API segue um padrão de rotas modulares focadas em casos de uso.
- **Camada de Rotas (`src/routes`)**: Controllers embutidos que recebem a requisição, executam a lógica/queries e devolvem JSON.
- **Camada de Middleware (`src/middleware`)**: 
  - `auth.js`: Validação de JWT.
  - `rbac.js`: Controle de acesso baseado no perfil (`authorize('admin', 'gerente')`).
  - `audit.js`: Registro automático de ações do usuário na tabela `auditoria`.
  - `validate.js`: Tratamento de erros do `express-validator`.
- **Serviços Especializados (`src/services`)**:
  - `produto.workflow.js`: Centraliza as regras de negócio para cálculo de limites de Kanban e atualização da ficha do produto.
  - `notificacoes.js`: Disparo de alertas sistêmicos.
- **Persistência**: `pg` (PostgreSQL raw queries). Queries SQL otimizadas com indexação.

### 2.2 Frontend (React)
- **State Management**: `Zustand` para estado global (ex: `authStore`) e `TanStack Query (React Query)` para state assíncrono (cache, fetch, revalidação).
- **Roteamento**: `react-router-dom`. Rotas privadas protegidas pelo componente `<PrivateRoute />`.
- **Estilização**: TailwindCSS puro (com design tokens mapeados no `tailwind.config.js`). UI Componentes construídos do zero usando as classes nativas para garantir o Design System *Brimajor*.
- **Iconografia**: `lucide-react`.

---

## 3. Modelo de Domínio e Banco de Dados

- **`usuarios`**: Gestão de acessos. Perfis principais: *admin, gerente_operacoes, supervisor_turno, analista_pcp, comprador, operador, manutentor*.
- **`categorias`**: Metadado obrigatório para classificar produtos (elétrico, mecânico), melhorando relatórios de curva ABC.
- **`produtos`**: Tabela central do estoque físico.
  - *Engine Kanban*: Contém `estoque_atual`, `ponto_reposicao`, `estoque_seguranca`, `estoque_maximo`, `lead_time`, `cmd` (Consumo Médio Diário). O sistema categoriza dinamicamente a `faixa_atual` (VERMELHO, AMARELO, VERDE).
- **`movimentacoes`**: Histórico financeiro/físico de ENTRADA e SAÍDA, registrando quem tirou, qual turno, para qual `maquina_id` ou `departamento_id`.
- **`pedidos_compra`**: Solicitações que transitam em workflow (Aguardando Aprovação -> Aprovado -> Aguardando Chegada -> Concluído).

---

## 4. Workflows Críticos

### A. Algoritmo de Cálculo Kanban
Toda vez que uma movimentação ou novo pedido altera as variáveis base, o sistema não recalcula no frontend. Uma *job* (ou trigger interno via service) utiliza a fórmula estocástica:
1. `ES` (Estoque de Segurança) = Fator Z (baseado no Nível de Serviço) * desvio padrão * raiz do Lead Time.
2. `PR` (Ponto de Reposição) = (CMD * Lead Time) + ES.

### B. Matriz RACI & Permissões
Permissões não são *hardcoded* nos botões. Elas vêm da rota `/api/v1/configuracoes/permissoes` e são armazenadas num JSON em BD (`configuracoes_sistema`). O frontend usa a função `perfilTemPagina` ou valida a presença da permissão via React Query para renderizar abas e botões.

### C. Grafo de Relacionamentos (GrafoRelacionamentos.jsx)
Módulo SVG complexo que desenha as relações entre Pedidos -> Produtos -> Máquinas/Departamentos -> Supervisores.
- Possui engine customizada de *pan & zoom* suportando *Pointer Events* para pinch no mobile.
- Renderiza em tempo real um modelo visual interativo sem o peso de bibliotecas como D3.js.

---

## 5. Diretrizes de Desenvolvimento (Guia Codex)

1. **UX Premium e Minimalista**: 
   - Ao adicionar campos, use modais limpos com overlay (`bg-navy-900/50`).
   - Siga a paleta: `navy` para textos e fundos estruturais, `steel` para interfaces secundárias e `accent/blue` para CTAs primários.
   - Qualquer atualização de estado visual do estoque (como faixas de vermelho/verde) deve usar o componente centralizado `FaixaBadge.jsx`.
2. **Consultas a Banco**:
   - Nunca confie em parâmetros do frontend para updates críticos. Utilize sempre prepared statements (`$1, $2`) no `pg` para evitar SQL Injection.
   - Sempre adicione o middleware `audit()` para logs de conformidade nas rotas POST/PUT/DELETE de entidades core (produtos, pedidos).
3. **Gerenciamento de Estado**:
   - Utilize a invalidação de queries do `React Query` (`queryClient.invalidateQueries`) em vez de gerenciar *loading states* manualmente para atualizar tabelas após uma *mutation*.

---
*Gerado por Antigravity AI - Codex Ops.*
