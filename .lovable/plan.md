

## Problema Identificado

### 1. Taxa de Falta não contabiliza corretamente
A query atual busca dados de `transacoes_vendas`, que é uma tabela financeira. Registros de "falta" muitas vezes não geram transação financeira (valor_bruto = 0), então podem não estar nessa tabela. A tabela `operacao_producao` é mais adequada pois registra todos os agendamentos incluindo faltas, com o enum `status_presenca_op` que inclui "faltou", "cancelado_paciente", "agendado", etc.

**Solução**: Fazer uma query paralela à `operacao_producao` para calcular a taxa de falta real (como já é feito no `TabOperacional`). Usar `operacao_producao` como fonte primária e `transacoes_vendas` como fallback. A taxa será: `(faltou + cancelado_paciente) / (total agendamentos no período)`.

### 2. Filtros na tabela "Produção Realizada"
Atualmente só existe filtro por tipo de atendimento. Faltam filtros para:
- **Profissional** (médico)
- **Procedimento** 
- **Pagador** (convênio/particular)
- **Status** (recebido, a_receber, inadimplente)

**Solução**: Adicionar uma barra de filtros acima da tabela com `Select` dropdowns para cada dimensão. Os valores serão extraídos dinamicamente dos dados carregados.

---

## Plano de Implementação

### Arquivo: `src/components/dashboard/TabProducao.tsx`

1. **Adicionar estados para os novos filtros**:
   - `filtroProfissional` (string, default "todos")
   - `filtroProcedimento` (string, default "todos")  
   - `filtroPagador` (string, default "todos")
   - `filtroStatus` (string, default "todos")

2. **Buscar dados de no-show via `operacao_producao`**:
   - Query paralela para contar registros com `status_presenca` = "faltou" e "cancelado_paciente"
   - Calcular taxa de falta como `(faltas) / (total_agendamentos) * 100`
   - Exibir faltas e cancelamentos separados no card

3. **Gerar listas de opções dos filtros dinamicamente** a partir dos dados carregados:
   - Lista de profissionais únicos
   - Lista de procedimentos únicos (top 20)
   - Lista de pagadores únicos (convênios + "Particular")
   - Lista de status únicos

4. **Aplicar todos os filtros no `useMemo` de `vendasFiltradas`**:
   - Encadear todos os filtros (tipo + profissional + procedimento + pagador + status)

5. **Renderizar barra de filtros** acima da tabela "Produção Realizada" com 5 selects em linha (tipo, profissional, procedimento, pagador, status)

6. **Adicionar coluna "Presença"** na tabela para exibir o `status_presenca` com badge colorido

