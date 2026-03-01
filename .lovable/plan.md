
# Padronizar graficos de h-64 para h-80

Alterar 3 graficos que usam `h-64` para `h-80`, igualando aos demais graficos do projeto que ja usam `h-80`.

## Arquivos afetados

| Arquivo | Linha | Grafico |
|---------|-------|---------|
| `src/components/dashboard/TabCapitalGiro.tsx` | 37 | Aging de Recebiveis (BarChart) |
| `src/components/dashboard/TabGrowth.tsx` | 28 | Novos Pacientes por Periodo (BarChart) |
| `src/components/dashboard/TabOperacional.tsx` | 51 | Taxa de Ocupacao (LineChart) |

## Alteracao

Em cada arquivo, trocar `h-64` por `h-80` na div wrapper do grafico. Nenhuma outra mudanca.

## Detalhes tecnicos

- `h-64` = 256px, `h-80` = 320px
- Os graficos em TabCaixa, TabDRE e DRE.tsx ja usam `h-80` e permanecem inalterados
- Apenas a classe CSS muda, sem impacto em logica ou dados
