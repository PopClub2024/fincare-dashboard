

## Plano: Integrar funcionalidades do Traffic AI no módulo de Marketing

O projeto **Traffic AI** (MIDAS) é uma plataforma completa de gestão de tráfego pago com IA. O objetivo é trazer as funcionalidades-chave para a página `/marketing`, expandindo-a de 3 abas simples para um hub completo de marketing digital com IA.

---

### Funcionalidades a integrar

| Funcionalidade | Origem (Traffic AI) | Status atual |
|---|---|---|
| **Dashboard de Performance** | KPIs com gasto, impressoes, CTR, CPC, CPM, alcance, gráficos de tendencia, heatmap, distribuicao de gasto | Apenas KPIs simples somando dados locais |
| **Campaign Optimizer** | Diagnóstico IA por campanha, oportunidades, audience intelligence, pausar/ativar campanhas | Tabela estática de campanhas |
| **Analytics & Attribution** | Visão geral com comparação vs período anterior, gráficos de área, análise por campanha, IA Insights (diagnóstico, anomalias, tendências) | Não existe |
| **AI Copywriter** | Geração de copies para Meta/Google Ads, fórmulas de copy, swipe file, variações com IA | Não existe |
| **AI Creative Studio** | Geração de imagens com IA, remove background, editor, resize, galeria | Não existe |
| **Budget Allocator** | Simulador de redistribuição de orçamento, pie chart, recomendações IA | Não existe |
| **A/B Testing Lab** | Criação de testes A/B, comparação de métricas, análise de significância com IA | Não existe |
| **Automated Rules** | Regras automáticas (pausar se CPC > X, escalar se CTR > Y), execução com IA | Não existe |
| **Reports** | Templates de relatório, agendamento, envio via WhatsApp, histórico | Não existe |
| **MIDAS Agent** | Chat IA especialista em tráfego pago, análise de dados colados | Não existe |

---

### Plano de implementação

#### 1. Migrations de banco de dados
Adaptar as tabelas do Traffic AI para o contexto `clinica_id`:
- `marketing_meta_accounts` — conexao Meta Ads por clínica
- `marketing_creatives` — imagens geradas salvas
- `marketing_swipe_files` — biblioteca de copies
- `marketing_copy_formulas` — formulas de copywriting
- `marketing_ab_tests` + `marketing_ab_test_variants` — testes A/B
- `marketing_automation_rules` + `marketing_rule_execution_log` — regras automáticas
- `marketing_report_templates` + `marketing_historico_reports` — relatórios

#### 2. Expandir a página Marketing em sub-abas modulares
Refatorar `src/pages/Marketing.tsx` de 3 abas para 10:
- **Dashboard** — KPIs de performance, gráficos de tendência, distribuição de gasto
- **Campanhas** — Tabela de campanhas existentes + diagnóstico IA
- **Analytics** — Visão geral com comparação periódica, gráficos, IA Insights
- **Copywriter** — Geração de copies com IA para diferentes plataformas/formatos
- **Criativos** — Geração de imagens com IA, galeria, edição
- **Orçamento** — Simulador de alocação de budget com recomendações IA
- **A/B Testing** — Laboratório de testes A/B com análise estatística
- **Regras** — Automação de campanhas com condições e ações
- **Relatórios** — Templates e agendamento de reports
- **Calendário** — Calendário de postagens (já existe)

#### 3. Componentes a criar
Em `src/components/marketing/`:
- `MarketingDashboard.tsx` — Dashboard com KPIs e gráficos
- `MarketingCampaigns.tsx` — Otimizador de campanhas com diagnóstico IA
- `MarketingAnalytics.tsx` — Analytics com IA Insights
- `MarketingCopywriter.tsx` — Gerador de copies com fórmulas
- `MarketingCreatives.tsx` — Estúdio criativo com geração de imagens
- `MarketingBudget.tsx` — Alocador de orçamento
- `MarketingABTests.tsx` — Laboratório de A/B testing
- `MarketingRules.tsx` — Regras automáticas
- `MarketingReports.tsx` — Relatórios e agendamento
- `MarketingAgent.tsx` — Chat IA especialista (MIDAS adaptado)

#### 4. Edge functions para IA
- `marketing-ai-chat` — Chat com IA para análise de campanhas (usa Lovable AI)
- `marketing-generate-creative` — Geração de imagens com IA (usa Lovable AI image models)

#### 5. Adaptar ao contexto clínica
- Todas as tabelas com `clinica_id` como filtro
- Dados de campanhas alimentados manualmente (cole dados do Meta/Google) ou via tabelas existentes `campanhas_marketing`
- IA usa dados colados pelo usuário para análise (sem integração direta com Meta API)

---

### Abordagem técnica

- **IA via Lovable AI**: Usar edge functions com `LOVABLE_API_KEY` para chat, copywriting e análise. Modelo padrão: `google/gemini-3-flash-preview`. Para imagens: `google/gemini-3-pro-image-preview`
- **Sem Meta API direta**: Diferente do Traffic AI que conecta ao Meta Ads, aqui o usuário cola dados manualmente ou usa a tabela `campanhas_marketing` existente
- **Streaming**: Chat do agent usa SSE streaming como no padrão Lovable AI
- **Design**: Manter o padrão `DashboardLayout` + Tabs do projeto atual
- **Sem dependências novas**: Usa shadcn/ui, lucide-react, recharts já existentes

### Arquivos criados/alterados
- `src/components/marketing/MarketingDashboard.tsx` (novo)
- `src/components/marketing/MarketingCampaigns.tsx` (novo)
- `src/components/marketing/MarketingAnalytics.tsx` (novo)
- `src/components/marketing/MarketingCopywriter.tsx` (novo)
- `src/components/marketing/MarketingCreatives.tsx` (novo)
- `src/components/marketing/MarketingBudget.tsx` (novo)
- `src/components/marketing/MarketingABTests.tsx` (novo)
- `src/components/marketing/MarketingRules.tsx` (novo)
- `src/components/marketing/MarketingReports.tsx` (novo)
- `src/components/marketing/MarketingAgent.tsx` (novo)
- `src/pages/Marketing.tsx` (refatorado)
- `supabase/functions/marketing-ai-chat/index.ts` (novo)
- `supabase/functions/marketing-generate-creative/index.ts` (novo)
- Migration SQL para novas tabelas + RLS

