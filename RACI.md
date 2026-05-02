# Matriz RACI — Kanban Estoque

> **RACI** = **R**esponsável (executa) · **A**provador (responde pelo resultado) · **C**onsultado (opina antes) · **I**nformado (recebe ciência depois)
>
> Regra: **deve haver exatamente um A por linha**. R pode ser mais de um.

---

## Legenda dos papéis

| Sigla | Papel | Quando acionar |
|---|---|---|
| **CMP** | Comprador | Pedidos de compra, fornecedores, prazos de entrega, condições comerciais |
| **FAC** | Facilitador Kanban (Lean) | Treinamento de operadores, cartões físicos, rotina de chão de fábrica, dúvidas de fluxo |
| **EPD** | Engenheiro de Produção | Capacidade, lead time, demanda, layout, dimensionamento de Kanban |
| **EPC** | Engenheiro de Processos | Padrões de operação, mudanças de método, melhorias contínuas, FMEA |
| **GOP** | Gerente de Operações | Decisões táticas operacionais, escalonamento de paradas, priorização |
| **GEN** | Gerente de Engenharia | Decisões técnicas estruturais, aprovação de mudanças no sistema, contratos com TI |
| **PM** | Plant Manager | Decisões finais com impacto financeiro/estratégico, riscos críticos, auditoria |

---

## 1. Operação diária — o que fazer quando…

| Situação | CMP | FAC | EPD | EPC | GOP | GEN | PM |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Cartão Kanban não chegou ao fornecedor | **R** | C | I | — | **A** | — | — |
| Operador não consegue logar / esqueceu senha | — | **R** | — | — | **A** | I | — |
| Movimentação de estoque feita errada (consumo, entrada) | — | **R** | C | — | **A** | — | — |
| Pedido em status "atrasado" sem justificativa | **R** | I | C | — | **A** | — | I |
| Produto não cadastrado / SKU faltando no sistema | **R** | C | C | — | **A** | I | — |
| Estoque físico ≠ estoque do sistema (divergência) | C | **R** | C | — | **A** | I | I |
| Ajuste de inventário cíclico | C | **R** | C | — | **A** | — | I |
| Dúvida sobre cor do cartão / regra do quadro | — | **R** / **A** | C | — | I | — | — |
| Pedido travado aguardando aprovação | **R** | I | — | — | **A** | I | I |

---

## 2. Parametrização técnica do Kanban

| Situação | CMP | FAC | EPD | EPC | GOP | GEN | PM |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Definir / revisar lead time de um item | **R** | C | **R** | — | C | **A** | I |
| Calcular quantidade por cartão (tamanho de lote) | C | C | **R** | C | C | **A** | I |
| Definir estoque de segurança (safety stock) | C | C | **R** | — | C | **A** | I |
| Mudar curva ABC manualmente (override) | — | C | **R** | C | **A** | I | I |
| Habilitar/desabilitar item no Kanban | C | C | **R** | — | **A** | I | — |
| Mudar política de reposição (min/max, ROP, EOQ) | C | C | **R** | C | C | **A** | I |
| Adicionar novo fornecedor ao sistema | **R** | — | C | — | **A** | I | I |
| Definir modal de transporte padrão | **R** | — | C | — | **A** | I | — |

---

## 3. Processos e melhoria contínua

| Situação | CMP | FAC | EPD | EPC | GOP | GEN | PM |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Mudança em padrão operacional (POP/IT) | C | **R** | C | **R** | C | **A** | I |
| Implantar Kanban em nova linha/célula | C | **R** | **R** | **R** | C | **A** | I |
| Análise de causa raiz (5 porquês / Ishikawa) | C | **R** | **R** | **R** | **A** | C | I |
| Indicador de desempenho fora da meta | — | C | **R** | C | **R** | **A** | I |
| Auditoria 5S / Gemba walk | C | **R** | C | C | **A** | I | I |
| Treinamento de operadores no sistema | — | **R** / **A** | C | C | I | — | — |
| Sugestão de melhoria do operador (kaizen) | C | **R** | C | C | **A** | I | I |

---

## 4. Sistema (TI) — bug, indisponibilidade, mudança técnica

| Situação | CMP | FAC | EPD | EPC | GOP | GEN | PM |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Sistema fora do ar (login não funciona) | I | I | I | — | C | **R** / **A** | I |
| Erro ao salvar movimentação (bug no app) | I | **R** (reporta) | C | — | I | **A** | — |
| Cálculo Kanban automatizado retornou número estranho | — | C | **R** (valida) | C | I | **A** | I |
| Banco de dados lento ou com timeout | — | I | I | — | I | **R** / **A** | I |
| Pedir nova feature no sistema | C | **R** (levanta) | **R** | C | C | **A** | I |
| Mudar regra de negócio que afeta o cálculo | C | **R** | **R** | C | C | **A** | **I** |
| Aprovar deploy em produção | — | I | C | — | C | **R** / **A** | I |
| Restaurar backup após perda de dados | — | I | I | — | C | **R** / **A** | **I** |
| Adicionar/remover usuário do sistema | — | **R** | — | — | **A** | I | — |
| Mudar permissões (perfil RBAC) | — | C | — | — | **A** | **R** | I |

---

## 5. Crises e decisões com impacto financeiro

| Situação | CMP | FAC | EPD | EPC | GOP | GEN | PM |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Parada de linha por falta de material | **R** | I | C | — | **R** | C | **A** |
| Compra emergencial (frete aéreo, fornecedor alternativo) | **R** | — | C | — | C | C | **A** |
| Aceitar lote fora de especificação | C | I | C | **R** | C | C | **A** |
| Mudança de fornecedor estratégico | **R** | — | C | C | C | C | **A** |
| Escalonamento para o Plant Manager | I | I | I | I | **R** | C | **A** |
| Investimento em nova ferramenta / módulo | — | C | C | C | C | **R** | **A** |
| Comunicação a cliente externo sobre atraso | C | — | — | — | **R** | C | **A** |

---

## Fluxo de escalonamento (quando contactar quem)

```
                     ┌───────────────────────┐
                     │   PROBLEMA OCORRE     │
                     └───────────┬───────────┘
                                 │
                     ┌───────────▼───────────┐
                     │ É problema de fluxo,  │
                     │ cartão, dúvida de     │
                     │ rotina no chão?       │──── SIM ──► FACILITADOR (FAC)
                     └───────────┬───────────┘
                                 │ NÃO
                     ┌───────────▼───────────┐
                     │ É problema de pedido, │
                     │ fornecedor, prazo?    │──── SIM ──► COMPRADOR (CMP)
                     └───────────┬───────────┘
                                 │ NÃO
                     ┌───────────▼───────────┐
                     │ É bug do sistema,     │
                     │ indisponibilidade,    │
                     │ erro de cálculo?      │──── SIM ──► GERENTE DE ENGENHARIA (GEN)
                     └───────────┬───────────┘
                                 │ NÃO
                     ┌───────────▼───────────┐
                     │ É parametrização      │
                     │ (lead time, lote,     │
                     │ ABC, safety stock)?   │──── SIM ──► ENG DE PRODUÇÃO (EPD)
                     └───────────┬───────────┘
                                 │ NÃO
                     ┌───────────▼───────────┐
                     │ É mudança de método   │
                     │ ou processo?          │──── SIM ──► ENG DE PROCESSOS (EPC)
                     └───────────┬───────────┘
                                 │ NÃO
                     ┌───────────▼───────────┐
                     │ Decisão tática,       │
                     │ priorização, recurso? │──── SIM ──► GERENTE DE OPERAÇÕES (GOP)
                     └───────────┬───────────┘
                                 │ NÃO
                     ┌───────────▼───────────┐
                     │ Impacto financeiro    │
                     │ ou risco crítico      │
                     │ para a planta         │──── SIM ──► PLANT MANAGER (PM)
                     └───────────────────────┘
```

---

## Contatos (preencher antes de publicar)

| Papel | Nome | Telefone | E-mail | Substituto |
|---|---|---|---|---|
| Comprador (CMP) | | | | |
| Facilitador Kanban (FAC) | | | | |
| Eng. de Produção (EPD) | | | | |
| Eng. de Processos (EPC) | | | | |
| Gerente de Operações (GOP) | | | | |
| Gerente de Engenharia (GEN) | | | | |
| Plant Manager (PM) | | | | |

---

## Notas

- **Toda chamada de incidente crítico** (parada de linha, sistema fora do ar > 1h, perda de dados) deve gerar **registro no audit log** do sistema e **comunicado ao PM**.
- A matriz é **viva**: revisar a cada 6 meses ou após qualquer mudança organizacional.
- Em conflito de RACI entre dois papéis, prevalece o **A** definido nesta tabela.
