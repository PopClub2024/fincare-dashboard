

# Plataforma de Gestão Financeira para Clínicas Médicas — Dashboard CFO

## Visão Geral
Plataforma full-stack com **Feegow como fonte primária de dados operacionais**, conciliação automática (Feegow + Getnet + OFX bancário), Dashboard CFO com 25+ KPIs financeiros/operacionais, e tela de caixa para baixa manual de pagamentos em dinheiro.

---

## Fase 1 — Infraestrutura e Schema do Banco de Dados

### Habilitar Lovable Cloud (Supabase)
- Ativar Supabase com Auth, DB, Storage, Edge Functions e Secrets

### Tabelas Base
- **clinicas** — dados da clínica (nome, CNPJ, endereço, configurações)
- **usuarios** — perfis vinculados a auth.users com clinica_id
- **user_roles** — roles (admin, gestor, operador_caixa, visualizador) com função `has_role()` security definer

### Tabelas de Dimensões Operacionais (populadas via Feegow)
- **medicos** — (clinica_id, nome, documento, especialidade, crm, feegow_id, ativo) — **sincronizado do Feegow**
- **salas** — (clinica_id, nome, capacidade, feegow_id, ativo) — **sincronizado do Feegow**
- **convenios** — (clinica_id, nome, prazo_repasse_dias, taxa_adm_percent, feegow_id, ativo) — **sincronizado do Feegow**
- **pacientes** — (clinica_id, nome, feegow_id, data_cadastro, primeira_consulta) — **sincronizado do Feegow** (para CAC, LTV e taxa de falta)

### Tabelas de Transações (alimentadas pelo Feegow + Getnet + OFX)
- **transacoes_vendas** — receita bruta com: medico_id, sala_id, convenio_id, paciente_id, quantidade, desconto, impostos_taxas, custo_direto_csv, status_recebimento (enum: a_receber, recebido, inadimplente, glosado), data_prevista_recebimento, forma_pagamento, status_conciliacao, feegow_id, **status_presenca** (enum: confirmado, atendido, faltou, cancelado — do Feegow, para taxa de falta)
- **transacoes_recebimentos** — recebimentos efetivos (data_recebimento, valor, origem, referência externa, getnet_id)
- **conciliacoes** — registro de conciliações (vendas x recebimentos, status, divergência)

### Tabelas Financeiras
- **despesas** — com tipo (fixa/variável), categoria, data_competencia, data_pagamento
- **contas_pagar** — AP completo (vencimento, pagamento, status, fornecedor, categoria)
- **dividas** — endividamento (credor, saldo, taxa_juros, custo_efetivo, tipo curto/longo)
- **ajustes_contabeis** — depreciação/amortização mensal

### Tabelas de Parâmetros e Integrações
- **parametros_financeiros** — configurações de cálculo por clínica
- **integracoes** — credenciais e status das integrações (Feegow, Getnet, OFX), última sincronização, status
- **sync_log** — log de cada sincronização (início, fim, registros processados, erros)

### Tabelas de Marketing e Ocupação
- **marketing_gastos** — gastos por canal/campanha/período
- **agenda_ocupacao** — slots_total vs slots_ocupados por dia/sala/médico — **sincronizado do Feegow** (agendamentos)

### Views Materializadas / RPCs
- **vw_dre_mensal** — DRE mensal (RL, CSV, CV, CF, EBITDA, Resultado, Lucro)
- **vw_fluxo_caixa_diario** — entradas, saídas e saldo acumulado por dia
- **vw_ar_aging** — aging de recebíveis por faixas (0-7, 8-15, 16-30, 31-60, 61-90, 90+)
- **vw_conciliacao_resumo** — % conciliada, divergência, por origem
- **vw_kpis_operacionais** — ticket médio, receita/médico, receita/sala, ocupação, **taxa de falta**

### RLS e Índices
- RLS por clinica_id em todas as tabelas
- Índices em clinica_id, datas, status, medico_id, sala_id, feegow_id

---

## Fase 2 — Edge Functions (Backend)

### `sync_feegow` (Sincronização Diária Automática via pg_cron)
Função principal que importa **todos os dados operacionais** do Feegow:
- **Médicos**: lista completa com especialidade, CRM → tabela `medicos`
- **Salas/Locais**: espaços de atendimento → tabela `salas`
- **Convênios**: planos aceitos, prazos, taxas → tabela `convenios`
- **Pacientes**: cadastro, data primeira consulta → tabela `pacientes`
- **Agendamentos/Consultas**: atendimentos realizados, valores, convênio ou particular, status de presença (atendido/faltou/cancelado) → tabela `transacoes_vendas` + `agenda_ocupacao`
- **Faturamento de convênios**: valores faturados, glosas, previsão de repasse → AR e status_recebimento
- **Recebimentos diretos**: pagamentos registrados no Feegow (cartão, pix no Feegow) → `transacoes_recebimentos`
- Execução automática diária (madrugada) via pg_cron + pg_net
- Lógica de upsert por `feegow_id` para evitar duplicatas
- Log detalhado em `sync_log`
- Credenciais armazenadas via Supabase Secrets

### `sync_getnet`
- Importar transações de cartão (crédito/débito)
- Conciliação automática com transacoes_vendas por referência
- Credenciais via Secrets

### `import_ofx`
- Parse de arquivos OFX bancários (upload via Storage)
- Importação para transacoes_recebimentos
- Conciliação automática com vendas/despesas

### `get_dashboard_kpis`
Edge Function que retorna payload consolidado com todos os KPIs, aceitando filtros (período, convênio, forma_pagamento, médico, sala, base: competência/caixa):
- Cards topo, DRE, Caixa, Capital de Giro, Operacional (incluindo **taxa de falta**), Growth
- Todas as fórmulas calculadas server-side

---

## Fase 3 — Tela de Caixa (Baixa Manual)

### Página `/caixa`
Tela dedicada para operadores confirmarem pagamentos em dinheiro:
- **Lista de atendimentos do dia** (vindos do Feegow) com status de pagamento
- **Filtros**: data, médico, sala, forma de pagamento
- **Ação principal**: botão "Confirmar recebimento" para pagamentos em dinheiro
- Campos: valor recebido, observação opcional
- Atualiza `status_recebimento` para 'recebido' e cria registro em `transacoes_recebimentos`
- **Resumo do caixa do dia**: total recebido em dinheiro, pendentes, total geral
- Acesso controlado por role (operador_caixa, admin, gestor)

---

## Fase 4 — Dashboard CFO (Frontend)

### Página `/dashboard-cfo`

#### Filtros Globais (sticky no topo)
- Date range picker (período)
- Select de convênio, forma de pagamento, médico, sala
- Toggle "Base de cálculo": Competência vs Caixa
- Indicador "Última sincronização Feegow: [data/hora]"
- Indicador "Última conciliação em: [data]"

#### Cards Principais (sempre visíveis)
- RL do período, EBITDA, Lucro Líquido + Margem Líquida %, MC% + PE, Fluxo de Caixa, Conciliação %
- Cada card com tooltip mostrando a fórmula

#### Aba DRE
- Gráfico barras/linha: RL, CSV, CV, CF, EBITDA por mês
- Tabela DRE detalhada expansível

#### Aba Caixa
- Gráfico fluxo diário com saldo acumulado
- Resumo: entradas, saídas, maior saída por categoria

#### Aba Capital de Giro
- Cards: AR, AP, NCG, Capital de Giro
- Aging de recebíveis (tabela + gráfico)
- Endividamento Total + Custo Médio da Dívida

#### Aba Operacional
- Folha sobre Receita (%), Ticket Médio
- Receita por Médico e por Sala (rankings)
- Taxa de Ocupação (linha por dia + consolidado)
- **Taxa de Falta de Pacientes** (% por período, por médico, por convênio — dados do Feegow)

#### Aba Growth
- CAC, LTV, LTV/CAC
- Marketing por canal/campanha
- Novos pacientes por período

#### Estados Vazios
- Sem dados do Feegow → "Configurar integração Feegow" com CTA
- Sem dados Getnet/OFX → "Conectar Getnet / Importar OFX" com CTA

---

## Fase 5 — Configuração e Gestão

### Página de Integrações
- Configurar API key Feegow (armazenada em Secrets)
- Configurar credenciais Getnet (Secrets)
- Upload de arquivos OFX
- Status de cada integração, última sincronização, próxima execução
- Botão "Sincronizar agora" (força sync manual além do cron diário)
- Log de sincronizações (sync_log)

### Página de Parâmetros Financeiros
- Categorias fixas/variáveis, alíquotas, depreciação

### Autenticação
- Login/signup com Supabase Auth
- Rotas protegidas, multi-clínica
- Roles: admin, gestor, operador_caixa, visualizador

---

## Requisitos Transversais
- **Feegow como fonte da verdade** para dados operacionais — médicos, salas, convênios, pacientes, consultas e status de presença são sincronizados automaticamente
- **Dinheiro = única baixa manual** — tudo que vem de cartão/convênio é conciliado automaticamente
- **Mobile-first** (320px+), responsivo
- **Performance**: < 3s para 12 meses
- **Segurança**: RLS por clinica_id, secrets nunca no frontend
- **Tooltips**: cada KPI com fórmula visível

