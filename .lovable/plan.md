

## Plano: Integrar funcionalidades do OrbRH no módulo de RH

O projeto OrbRH possui um sistema completo de gestão de RH. O objetivo é trazer as funcionalidades-chave para a página `/rh` e criar sub-páginas complementares, adaptadas ao schema existente (tabelas `colaboradores`, `registros_ponto`, `colaborador_documentos`).

---

### Funcionalidades a integrar

| Funcionalidade | Origem (OrbRH) | Status atual |
|---|---|---|
| **Gestão de Colaboradores avançada** | Filtros por departamento/cargo/vínculo, ordenação, view cards/tabela, exportação CSV, perfil detalhado | Lista simples com busca básica |
| **Controle de Ponto completo** | Clock in/out, timeline diária, banco de horas, heatmap mensal, ranking de horas, gráficos | Apenas tabela de registros do dia |
| **Férias e Afastamentos** | Solicitações, aprovação/rejeição, calendário de férias, dashboard com KPIs | Não existe |
| **Departamentos** | CRUD de departamentos com responsáveis, expansão por colaboradores | Não existe (campo texto "area") |
| **Desligamentos** | Registro de demissões com motivo, decisão, custo, histórico | Não existe |
| **Feedbacks** | Envio de feedbacks positivo/neutro/negativo entre colaboradores | Não existe |
| **Avaliação de Desempenho** | Ciclos de avaliação, competências hard/soft skills, níveis | Não existe |
| **People Analytics** | Dashboard com métricas de contratação, retenção, diversidade | Não existe |
| **Escalas** | Calendário de escalas por colaborador, turno e dia | Placeholder vazio |

---

### Plano de implementação

#### 1. Migrations de banco de dados
Criar tabelas complementares que faltam:
- `rh_departamentos` — id, clinica_id, nome, descricao, responsavel_id (FK colaboradores)
- `rh_ferias` — id, clinica_id, colaborador_id, data_inicio, data_fim, dias_total, status (pendente/aprovada/rejeitada/cancelada), notas, aprovado_por
- `rh_desligamentos` — id, clinica_id, colaborador_id, data_desligamento, motivo, decisao, causa, custo, observacoes
- `rh_feedbacks` — id, clinica_id, remetente_id, destinatario_id, tipo (positivo/neutro/negativo), mensagem, created_at
- `rh_escalas` — id, clinica_id, colaborador_id, dia_semana, turno, hora_inicio, hora_fim
- Adicionar colunas em `colaboradores`: `departamento_id`, `gestor_id`, `data_desligamento`, `status` (expandir para incluir "desligado")

#### 2. Refatorar a página RH em abas modulares
Expandir as abas de 4 para 8:
- **Colaboradores** — Tabela avançada com filtros (departamento, cargo, vínculo, status), ordenação por coluna, ações (editar, desligar, excluir)
- **Ponto** — Clock in/out visual, timeline diária, registros da semana, totais mensais
- **Férias** — Dashboard com KPIs (em férias agora, pendentes, aprovadas), tabela de solicitações, aprovação/rejeição
- **Departamentos** — CRUD de departamentos, lista de colaboradores por departamento expandível
- **Desligamentos** — Registro e histórico de demissões com motivo, custo, decisão
- **Feedbacks** — Envio e consulta de feedbacks entre colaboradores com filtros por tipo/data
- **Documentos** — Manter funcionalidade atual de upload
- **Escalas** — Calendário visual de escalas por colaborador e turno

#### 3. Componentes a criar
Em `src/components/rh/`:
- `RHColaboradores.tsx` — Tabela avançada com filtros e ordenação
- `RHPonto.tsx` — Controle de ponto com timeline e totais
- `RHFerias.tsx` — Gestão de férias com aprovação
- `RHDepartamentos.tsx` — CRUD de departamentos
- `RHDesligamentos.tsx` — Gestão de desligamentos
- `RHFeedbacks.tsx` — Envio e consulta de feedbacks
- `RHDocumentos.tsx` — Upload de documentos (extraído do atual)
- `RHEscalas.tsx` — Calendário de escalas

#### 4. Adaptar ao schema existente
- Usar tabela `colaboradores` existente (com colunas: nome, cpf, cargo, area, tipo_vinculo, salario, status, etc.)
- Usar `registros_ponto` existente para o controle de ponto
- Usar `colaborador_documentos` existente para documentos
- Criar novas tabelas com prefixo `rh_` para férias, feedbacks, desligamentos, departamentos, escalas

---

### Abordagem técnica

- **Adaptação ao contexto clínica**: Todas as tabelas terão `clinica_id` como filtro (padrão do projeto atual), diferente do OrbRH que usa `organization_id`
- **Sem dependências novas**: Usa apenas shadcn/ui, lucide-react, recharts, date-fns já existentes
- **Design**: Manter o padrão `DashboardLayout` + Tabs do projeto atual
- **RLS**: Políticas baseadas em `clinica_id` consistentes com o resto do sistema

### Arquivos criados/alterados
- `src/components/rh/RHColaboradores.tsx` (novo)
- `src/components/rh/RHPonto.tsx` (novo)
- `src/components/rh/RHFerias.tsx` (novo)
- `src/components/rh/RHDepartamentos.tsx` (novo)
- `src/components/rh/RHDesligamentos.tsx` (novo)
- `src/components/rh/RHFeedbacks.tsx` (novo)
- `src/components/rh/RHDocumentos.tsx` (novo)
- `src/components/rh/RHEscalas.tsx` (novo)
- `src/pages/RH.tsx` (refatorado — importa componentes modulares)
- Migration SQL para novas tabelas + RLS

