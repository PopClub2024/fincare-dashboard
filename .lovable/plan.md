
# Plano: Dashboard CFO Inteligente com Dados Reais Integrados

## Problema Atual
- Os KPI Cards do Dashboard CFO mostram valores zerados ("R$ 0,00")
- A aba Operacional e' estática sem dados do Feegow
- Nao existe painel de consultas realizadas com visao Particular vs Convenio
- A previsao de caixa nao considera prazos reais de recebimento dos convenios
- Os dados da conciliacao (Feegow + Getnet + Banco) nao alimentam automaticamente DRE e Fluxo de Caixa

## Visao Geral da Solucao

Criar um fluxo de dados completo onde:
1. **Feegow** (vendas/consultas) alimenta automaticamente o DRE, Fluxo de Caixa e AR
2. **Getnet** (taxas/liquido) alimenta o calculo real de taxas de cartao
3. **Banco** (OFX) alimenta o saldo real e saidas
4. A **conciliacao** fecha o ciclo conectando os tres

```text
Feegow (vendas brutas)
    |
    v
transacoes_vendas --> DRE (RT), AR (a receber), Previsao de Caixa
    |
    v
Getnet (taxas reais) --> DRE (taxa cartao real), Conciliacao
    |
    v
Banco (depositos liquidos) --> Fluxo de Caixa (saldo real), AP (pagamentos)
```

---

## Tarefas de Implementacao

### 1. KPI Cards Dinamicos no Dashboard CFO

O componente `KpiCards` atualmente retorna valores estaticos. Sera refatorado para:
- Chamar `get_dre` e `get_cash_kpis` com o periodo selecionado nos filtros
- Exibir: Receita Liquida, EBITDA, Margem Liquida, MC%/PE, Fluxo de Caixa, % Conciliacao
- Cada KPI com tooltip mostrando formula e fonte dos dados
- Variacao percentual MoM quando houver dados historicos

**Arquivo:** `src/components/dashboard/KpiCards.tsx` -- refatorar para aceitar `dateFrom/dateTo` e buscar dados reais

### 2. Nova Aba "Consultas" no Dashboard CFO (Painel Feegow)

Criar componente `TabConsultas` com:
- **Cards resumo**: Total consultas, Receita bruta, Ticket medio, Taxa de falta
- **Tabela de consultas**: Data, Paciente, Medico, Procedimento, Convenio/Particular, Valor bruto, Status recebimento, Previsao recebimento
- **Grafico**: Receita por canal (Particular vs Convenio) em barras empilhadas por mes
- **Grafico**: Consultas por medico (ranking horizontal)
- **Detalhe Convenio**: Tabela com nome do convenio, total faturado, prazo medio de repasse (usando `convenios.prazo_repasse_dias`), previsao de entrada, valor ja recebido, valor pendente

**Dados fonte**: `transacoes_vendas` com joins em `medicos`, `convenios`, `pacientes`
**Arquivo novo:** `src/components/dashboard/TabConsultas.tsx`

### 3. Previsao Real de Caixa (Cash Forecast)

Criar uma secao na aba Caixa que projeta entradas futuras baseado em:
- **Particular (cartao)**: Entrada D+1 (dia util seguinte, respeitando regra sexta/sabado para segunda)
- **Particular (PIX/dinheiro)**: Entrada imediata (D+0)
- **Convenio**: Entrada baseada em `convenios.prazo_repasse_dias` a partir da data da consulta
- **Getnet**: Usa `data_prevista_pagamento` da tabela `getnet_transacoes` quando disponivel

Implementar funcao SQL `get_cash_forecast` que:
- Agrupa recebimentos previstos por semana/mes
- Considera vendas com `status_recebimento = 'a_receber'`
- Calcula `data_prevista_recebimento` automaticamente quando nulo, usando prazo do convenio
- Mostra grafico de projecao: entradas previstas vs saidas programadas (AP vencendo)

**Migration:** Nova funcao `get_cash_forecast`
**Arquivo novo:** Secao dentro de `TabCaixa.tsx` ou componente separado `CashForecast.tsx`

### 4. Aba Operacional com Dados Reais do Feegow

Refatorar `TabOperacional` para buscar dados reais:
- **Folha/Receita**: Somar `contas_pagar_lancamentos` com categoria pessoal / RT do periodo
- **Ticket Medio**: `SUM(valor_bruto) / COUNT(*)` de `transacoes_vendas`
- **Taxa de Falta**: Contar `status_presenca = 'faltou'` / total de agendamentos
- **Receita por Medico**: Agrupar `transacoes_vendas` por `medico_id` com join `medicos.nome`
- **Receita por Sala**: Agrupar por `sala_id` com join `salas.nome`
- **Taxa de Ocupacao**: Usar `agenda_ocupacao` (slots_ocupados / slots_total)

**Arquivo:** `src/components/dashboard/TabOperacional.tsx` -- refatorar com queries reais

### 5. Alimentacao Automatica do DRE com Dados Reais de Taxa

Atualizar a funcao `get_dre` para:
- Quando houver dados de `getnet_transacoes`, usar a taxa real (soma de `valor_taxa`) em vez da taxa estimada por percentual
- Manter fallback para calculo por percentual quando nao houver dados Getnet
- Adicionar campo `taxa_cartao_real` vs `taxa_cartao_estimada` na resposta para transparencia

**Migration:** Alterar funcao `get_dre` para consultar `getnet_transacoes`

### 6. Fluxo de Dados Conciliacao para Caixa

Atualizar `get_cash_kpis` para:
- Quando houver `transacoes_bancarias`, usar como fonte primaria de entradas/saidas (dados reais do banco)
- Enriquecer com dados de conciliacao: mostrar quanto das entradas bancarias esta conciliado vs nao identificado
- Adicionar no retorno: `entradas_conciliadas`, `entradas_nao_identificadas`, `saidas_conciliadas`, `saidas_nao_identificadas`

**Migration:** Alterar funcao `get_cash_kpis`

### 7. Rota e Navegacao

- Adicionar aba "Consultas" no `DashboardCFO.tsx` (total de 8 abas)
- Passar `dateFrom/dateTo` para `KpiCards`

---

## Detalhes Tecnicos

### Ordem de Execucao
1. Migration: `get_cash_forecast` + atualizar `get_dre` e `get_cash_kpis`
2. `TabConsultas.tsx` (novo componente)
3. Refatorar `KpiCards.tsx` (dados reais)
4. Refatorar `TabOperacional.tsx` (dados reais)
5. Adicionar previsao de caixa em `TabCaixa.tsx`
6. Atualizar `DashboardCFO.tsx` (nova aba + props)

### Fontes de Dados por Modulo

| Modulo | Fonte Primaria | Fallback |
|--------|---------------|----------|
| DRE - RT | transacoes_vendas | dre_historico_mensal |
| DRE - Taxa Cartao | getnet_transacoes.valor_taxa | taxas_config percentual |
| Caixa - Entradas | transacoes_recebimentos + transacoes_bancarias | caixa_historico_mensal |
| Caixa - Previsao | transacoes_vendas (a_receber) + convenios.prazo | -- |
| AR | transacoes_vendas (a_receber) | -- |
| Operacional | transacoes_vendas + agenda_ocupacao | -- |
| Consultas | transacoes_vendas + medicos + convenios | -- |

### Regra Sexta/Sabado
Vendas realizadas sexta ou sabado: `data_prevista_recebimento` sera calculada como proxima segunda-feira (proximo dia util). Implementada na funcao SQL `get_cash_forecast` usando `CASE WHEN EXTRACT(DOW FROM date) IN (5,6) THEN date + (8 - EXTRACT(DOW FROM date))::int ...`.
