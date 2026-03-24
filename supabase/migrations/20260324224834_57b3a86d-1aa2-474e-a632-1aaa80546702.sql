
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- SALAS_CONSULTORIOS
CREATE TABLE IF NOT EXISTS public.salas_consultorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  tipo text DEFAULT 'consultorio',
  andar text,
  equipamentos jsonb DEFAULT '[]',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.salas_consultorios ENABLE ROW LEVEL SECURITY;

-- ESCALAS_HORARIOS
CREATE TABLE IF NOT EXISTS public.escalas_horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  medico_id uuid REFERENCES public.medicos(id),
  sala_id uuid REFERENCES public.salas_consultorios(id),
  dia_semana int NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  intervalo_minutos int DEFAULT 30,
  ativo boolean DEFAULT true,
  vigente_de date DEFAULT CURRENT_DATE,
  vigente_ate date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.escalas_horarios ENABLE ROW LEVEL SECURITY;

-- REGISTROS_PONTO
CREATE TABLE IF NOT EXISTS public.registros_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  funcionario_id uuid REFERENCES public.funcionarios(id),
  data date NOT NULL,
  entrada timestamptz,
  saida timestamptz,
  horas_trabalhadas numeric(5,2),
  observacao text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;

-- ESTOQUE
CREATE TABLE IF NOT EXISTS public.estoque_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  descricao text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.estoque_categorias ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.estoque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  categoria_id uuid REFERENCES public.estoque_categorias(id),
  nome text NOT NULL,
  codigo text,
  unidade text DEFAULT 'un',
  estoque_minimo numeric DEFAULT 0,
  estoque_atual numeric DEFAULT 0,
  custo_unitario numeric DEFAULT 0,
  fornecedor text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  item_id uuid NOT NULL REFERENCES public.estoque_itens(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade numeric NOT NULL,
  custo_unitario numeric,
  motivo text,
  referencia_id uuid,
  usuario_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

-- CONTRATOS_PRESTADORES
CREATE TABLE IF NOT EXISTS public.contratos_prestadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  medico_id uuid REFERENCES public.medicos(id),
  tipo text DEFAULT 'pj',
  percentual_repasse numeric,
  valor_fixo numeric,
  vigente_de date NOT NULL,
  vigente_ate date,
  documento_url text,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.contratos_prestadores ENABLE ROW LEVEL SECURITY;

-- PLAYBOOKS
CREATE TABLE IF NOT EXISTS public.playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  titulo text NOT NULL,
  descricao text,
  categoria text,
  conteudo_markdown text,
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

-- NPS
CREATE TABLE IF NOT EXISTS public.nps_pesquisas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  agendamento_id uuid,
  nota int CHECK (nota BETWEEN 0 AND 10),
  comentario text,
  canal text DEFAULT 'whatsapp',
  respondido_em timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.nps_pesquisas ENABLE ROW LEVEL SECURITY;

-- MARKETING
CREATE TABLE IF NOT EXISTS public.marketing_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  plataforma text,
  status text DEFAULT 'rascunho',
  orcamento numeric DEFAULT 0,
  gasto_total numeric DEFAULT 0,
  leads_gerados int DEFAULT 0,
  conversoes int DEFAULT 0,
  data_inicio date,
  data_fim date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.marketing_campanhas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  campanha_id uuid REFERENCES public.marketing_campanhas(id),
  nome text,
  telefone text,
  email text,
  origem text,
  status text DEFAULT 'novo',
  paciente_id uuid REFERENCES public.pacientes(id),
  convertido_em timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.marketing_criativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  campanha_id uuid REFERENCES public.marketing_campanhas(id),
  tipo text DEFAULT 'imagem',
  titulo text,
  descricao text,
  arquivo_url text,
  plataforma text,
  status text DEFAULT 'rascunho',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.marketing_criativos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.marketing_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  titulo text NOT NULL,
  descricao text,
  data_publicacao date,
  plataforma text,
  status text DEFAULT 'planejado',
  criativo_id uuid REFERENCES public.marketing_criativos(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.marketing_calendario ENABLE ROW LEVEL SECURITY;

-- WHATSAPP TEMPLATES
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  categoria text DEFAULT 'utility',
  corpo text NOT NULL,
  variaveis jsonb DEFAULT '[]',
  aprovado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- CHAMADAS_PACIENTE
CREATE TABLE IF NOT EXISTS public.chamadas_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  agendamento_id uuid,
  sala_id uuid REFERENCES public.salas_consultorios(id),
  medico_id uuid REFERENCES public.medicos(id),
  status text DEFAULT 'chamando',
  chamado_em timestamptz DEFAULT now(),
  atendido_em timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.chamadas_paciente ENABLE ROW LEVEL SECURITY;

-- CONFIGURACOES_SISTEMA
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  chave text NOT NULL,
  valor jsonb,
  descricao text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinica_id, chave)
);
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- AGENTES_IA
CREATE TABLE IF NOT EXISTS public.agentes_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  tipo text NOT NULL,
  prompt_sistema text,
  modelo text DEFAULT 'gpt-4o-mini',
  temperatura numeric DEFAULT 0.3,
  ativo boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.agentes_ia ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.agentes_ia_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  agente_id uuid REFERENCES public.agentes_ia(id),
  input_text text,
  output_text text,
  tokens_usados int,
  duracao_ms int,
  modelo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.agentes_ia_logs ENABLE ROW LEVEL SECURITY;

-- CHAVES_API
CREATE TABLE IF NOT EXISTS public.chaves_api (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  servico text NOT NULL,
  chave_encriptada text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinica_id, servico)
);
ALTER TABLE public.chaves_api ENABLE ROW LEVEL SECURITY;

-- USUARIOS_PERMISSOES
CREATE TABLE IF NOT EXISTS public.usuarios_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(user_id),
  modulo text NOT NULL,
  pode_ver boolean DEFAULT true,
  pode_editar boolean DEFAULT false,
  pode_excluir boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, modulo)
);
ALTER TABLE public.usuarios_permissoes ENABLE ROW LEVEL SECURITY;

-- ESPECIALIDADES
CREATE TABLE IF NOT EXISTS public.especialidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  feegow_id text UNIQUE,
  nome text NOT NULL,
  codigo_tiss text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;

-- CONVENIO_PLANOS
CREATE TABLE IF NOT EXISTS public.convenio_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id uuid NOT NULL REFERENCES public.convenios(id),
  feegow_plano_id text,
  nome text NOT NULL,
  codigo_ans text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(convenio_id, feegow_plano_id)
);
ALTER TABLE public.convenio_planos ENABLE ROW LEVEL SECURITY;

-- AGENDAMENTOS
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  feegow_id text,
  paciente_id uuid REFERENCES public.pacientes(id),
  medico_id uuid REFERENCES public.medicos(id),
  especialidade_id uuid REFERENCES public.especialidades(id),
  procedimento_id uuid REFERENCES public.procedimentos(id),
  data date NOT NULL,
  horario time,
  duracao int DEFAULT 30,
  tipo text DEFAULT 'particular',
  convenio_id uuid REFERENCES public.convenios(id),
  status text DEFAULT 'agendado',
  is_encaixe boolean DEFAULT false,
  valor numeric DEFAULT 0,
  observacao text,
  agendado_por text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinica_id, feegow_id)
);
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- RLS policies for all tables with clinica_id
CREATE POLICY "clinic_salas_consultorios" ON public.salas_consultorios FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_escalas_horarios" ON public.escalas_horarios FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_registros_ponto" ON public.registros_ponto FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_estoque_categorias" ON public.estoque_categorias FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_estoque_itens" ON public.estoque_itens FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_estoque_movimentacoes" ON public.estoque_movimentacoes FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_contratos_prestadores" ON public.contratos_prestadores FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_playbooks" ON public.playbooks FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_nps_pesquisas" ON public.nps_pesquisas FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_marketing_campanhas" ON public.marketing_campanhas FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_marketing_leads" ON public.marketing_leads FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_marketing_criativos" ON public.marketing_criativos FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_marketing_calendario" ON public.marketing_calendario FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_whatsapp_templates" ON public.whatsapp_templates FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_chamadas_paciente" ON public.chamadas_paciente FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_configuracoes_sistema" ON public.configuracoes_sistema FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_agentes_ia" ON public.agentes_ia FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_agentes_ia_logs" ON public.agentes_ia_logs FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_chaves_api" ON public.chaves_api FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_especialidades" ON public.especialidades FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_agendamentos" ON public.agendamentos FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));

-- usuarios_permissoes (no clinica_id)
CREATE POLICY "view_own_permissions" ON public.usuarios_permissoes FOR SELECT TO authenticated USING (usuario_id = auth.uid());

-- convenio_planos (via convenio_id)
CREATE POLICY "clinic_convenio_planos" ON public.convenio_planos FOR ALL TO authenticated
  USING (convenio_id IN (SELECT id FROM public.convenios WHERE clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)))
  WITH CHECK (convenio_id IN (SELECT id FROM public.convenios WHERE clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)));
