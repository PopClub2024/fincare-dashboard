

## Plano: Integrar funcionalidades do WhatsApp Clinica no projeto atual

O projeto **WhatsApp Clinica** (jumedicpop) possui um sistema completo de CRM via WhatsApp com módulos que não existem ou estão simplificados no projeto atual. O objetivo é trazer as funcionalidades-chave para a página `/whatsapp` e criar sub-páginas/componentes complementares.

---

### Funcionalidades a integrar

| Funcionalidade | Origem (WhatsApp Clinica) | Status no projeto atual |
|---|---|---|
| **Chat ao vivo com realtime** | `ChatInterface.tsx` + `useConversations.ts` — chat completo com inbox filters, transcrição de áudio, gravação de áudio, upload de mídia, painel de notas internas, respostas rápidas, media library | Existe um chat básico usando polling simples (refetchInterval 3s/5s) |
| **Kanban - Jornada do Paciente** | `Kanban.tsx` — drag-and-drop, stages configuráveis, deal detail com atividades, memória do cliente, integração Feegow | Só tem um pipeline estático com etapas hardcoded |
| **Dashboard WhatsApp** | `Dashboard.tsx` — KPIs reais (atendimentos, contatos, agendamentos, sessões billing, TMA, off-hours), gráficos com filtro de período | Não existe dashboard dedicado ao WhatsApp |
| **Contatos CRM** | `Contacts.tsx` — lista de contatos com status lead/customer/churned, busca, ação iniciar conversa | Apenas leitura simples da tabela pacientes |
| **Inteligência (AI Insights)** | `Intelligence.tsx` — análise de conversas por IA, insights categorizados, iniciativas CEO, chat com copilot, funnel analytics | Não existe |
| **Relatórios avançados** | `Reports.tsx` — jornada do paciente, satisfação, sessões WhatsApp, métricas humanas, marketing, lista de espera | Não existe no contexto WhatsApp |

---

### Plano de implementação

#### 1. Refatorar a página WhatsApp em sub-abas modulares
- Manter a estrutura atual de `TabsList` mas **substituir o conteúdo** de cada aba com os componentes do WhatsApp Clinica adaptados
- Criar componentes em `src/components/whatsapp/`:
  - `WhatsAppDashboard.tsx` — Dashboard com KPIs e gráficos
  - `WhatsAppChat.tsx` — Chat completo com inbox filters, gravação de áudio, media library, notas internas
  - `WhatsAppKanban.tsx` — Kanban drag-and-drop com stages configuráveis
  - `WhatsAppContacts.tsx` — CRM de contatos
  - `WhatsAppIntelligence.tsx` — Painel de inteligência com insights e chat AI
  - `WhatsAppReports.tsx` — Relatórios avançados

#### 2. Adaptar a camada de dados
- Criar `src/services/whatsapp-api.ts` — Adaptação do `api.ts` do projeto fonte para usar as tabelas existentes neste projeto (`whatsapp_conversas`, `whatsapp_chat_mensagens`, `whatsapp_tags`, etc.)
- Criar `src/hooks/useWhatsAppConversations.ts` — Hook de realtime baseado no `useConversations.ts` original, adaptado para o schema local
- Criar `src/types/whatsapp.ts` — Tipos e interfaces (Message, Conversation, Deal, Contact, etc.)

#### 3. Migrations de banco de dados
- Criar tabelas que existem no WhatsApp Clinica mas faltam aqui:
  - `contacts` (tabela CRM separada de `pacientes`)
  - `conversations` + `messages` (schema do realtime chat)
  - `pipeline_stages` + `deals` + `deal_activities`
  - `team_members` + `teams` + `team_functions`
  - `tags` (tag definitions)
  - `insight_items` + `insight_runs` + `initiatives` + `funnel_analytics_daily`
  - `waitlist_entries`
  - `whatsapp_billing_sessions`
  - `marketing_campaigns` (se não existir)
- OU adaptar os componentes para usar as tabelas já existentes (`whatsapp_conversas`, `whatsapp_mensagens`, `whatsapp_pipeline_contatos`, etc.)

#### 4. Atualizar a página principal
- Refatorar `src/pages/WhatsApp.tsx` para importar os novos componentes modulares em vez de ter tudo inline (695 linhas hoje)
- Adicionar as novas abas: Dashboard, Chat, Pipeline, Contatos, Inteligência, Relatórios

---

### Abordagem técnica

- **Adaptar ao schema existente**: As tabelas `whatsapp_conversas`, `whatsapp_chat_mensagens`, `whatsapp_pipeline_contatos`, `whatsapp_tags`, `whatsapp_respostas_prontas`, `whatsapp_fila_humano` já existem. Os componentes serão adaptados para usar estas tabelas em vez de criar novas
- **Realtime**: Substituir o polling atual (refetchInterval) por subscription Supabase realtime como no projeto fonte
- **Design**: Manter o design system dark (slate-950) do WhatsApp Clinica que já combina com o tema do projeto
- **Sem dependências externas novas**: Os componentes usam apenas shadcn/ui, lucide-react, recharts e react-day-picker que já existem no projeto

### Arquivos criados/alterados
- `src/types/whatsapp.ts` (novo)
- `src/services/whatsapp-api.ts` (novo)
- `src/hooks/useWhatsAppConversations.ts` (novo)
- `src/components/whatsapp/WhatsAppDashboard.tsx` (novo)
- `src/components/whatsapp/WhatsAppChat.tsx` (novo)
- `src/components/whatsapp/WhatsAppKanban.tsx` (novo)
- `src/components/whatsapp/WhatsAppContacts.tsx` (novo)
- `src/components/whatsapp/WhatsAppIntelligence.tsx` (novo)
- `src/components/whatsapp/WhatsAppReports.tsx` (novo)
- `src/pages/WhatsApp.tsx` (refatorado)
- Migration SQL para tabelas faltantes (`pipeline_stages`, `deals`, `deal_activities`, `tags`, `insight_items`, etc.)

