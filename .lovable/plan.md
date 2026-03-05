

## Diagnóstico

### Problema 1: Faltas não são contabilizadas
A função `sync-feegow` tem um filtro nas linhas 407-412 que **ignora completamente** agendamentos com status "faltou", "cancelado_paciente" e "cancelado". Eles nunca são inseridos em nenhuma tabela (`transacoes_vendas` nem `operacao_producao`).

Dados atuais (março/2026):
- `transacoes_vendas`: 179 registros (116 sem prefixo `inv_`), **0 faltas**
- `operacao_producao`: **0 registros** (nada é inserido)
- Sistema Feegow: 184 agendamentos + ~50 faltas

### Problema 2: Contagem de atendimentos divergente (116 vs 184)
O filtro `not like 'inv_%'` remove 63 registros de vendas financeiras avulsas. Além disso, as faltas (50) nunca foram sincronizadas.

### Problema 3: Falta totalização na tabela "Produção Realizada"
Não existe linha de totais ao final da tabela filtrada.

---

## Plano de Correção

### 1. Corrigir `sync-feegow` (edge function)
- **Remover o `continue`** para registros "faltou"/"cancelado_paciente" — eles devem ser inseridos em `operacao_producao` (com valor 0) e em `transacoes_vendas` (com valor 0 e status_presenca correto)
- Manter o skip apenas para "cancelado" (cancelamento pela clínica, não conta como falta)
- Garantir que `operacao_producao` receba TODOS os agendamentos, incluindo faltas

### 2. Adicionar totalização na tabela "Produção Realizada"
- Inserir uma `TableRow` ao final da tabela com:
  - **Total de itens** (contagem de registros filtrados)
  - **Total do valor** (soma de `valor_bruto` dos registros filtrados)
- Exibir em negrito com fundo destacado (mesmo padrão do `ConvenioProducao`)

### 3. Re-sincronizar dados de março
- Após deploy da correção, o usuário poderá re-sincronizar para popular os dados corretos

### Arquivos alterados:
- `supabase/functions/sync-feegow/index.ts` — remover skip de faltas, incluir no `operacao_producao` e `transacoes_vendas`
- `src/components/dashboard/TabProducao.tsx` — adicionar linha de totais na tabela

