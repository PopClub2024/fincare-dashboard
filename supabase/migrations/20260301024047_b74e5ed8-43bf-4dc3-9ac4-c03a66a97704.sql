
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'operador_caixa', 'visualizador');
CREATE TYPE public.status_recebimento AS ENUM ('a_receber', 'recebido', 'inadimplente', 'glosado');
CREATE TYPE public.status_conciliacao AS ENUM ('pendente', 'conciliado', 'divergente');
CREATE TYPE public.status_presenca AS ENUM ('confirmado', 'atendido', 'faltou', 'cancelado');
CREATE TYPE public.tipo_despesa AS ENUM ('fixa', 'variavel');
CREATE TYPE public.status_conta AS ENUM ('pendente', 'pago', 'vencido', 'cancelado');
CREATE TYPE public.tipo_divida AS ENUM ('curto_prazo', 'longo_prazo');
CREATE TYPE public.status_integracao AS ENUM ('ativo', 'inativo', 'erro');
CREATE TYPE public.status_sync AS ENUM ('em_andamento', 'sucesso', 'erro');

-- =============================================
-- TABELAS BASE
-- =============================================
CREATE TABLE public.clinicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  configuracoes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- =============================================
-- SECURITY DEFINER: has_role
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =============================================
-- SECURITY DEFINER: get_user_clinica_id
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_clinica_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinica_id FROM public.usuarios WHERE user_id = _user_id LIMIT 1
$$;

-- =============================================
-- TABELAS DE DIMENSÕES OPERACIONAIS (Feegow)
-- =============================================
CREATE TABLE public.medicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  especialidade TEXT,
  crm TEXT,
  feegow_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, feegow_id)
);

CREATE TABLE public.salas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  capacidade INTEGER DEFAULT 1,
  feegow_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, feegow_id)
);

CREATE TABLE public.convenios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  prazo_repasse_dias INTEGER DEFAULT 30,
  taxa_adm_percent NUMERIC(5,2) DEFAULT 0,
  feegow_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, feegow_id)
);

CREATE TABLE public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  feegow_id TEXT,
  data_cadastro DATE,
  primeira_consulta DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, feegow_id)
);

-- =============================================
-- TABELAS DE TRANSAÇÕES
-- =============================================
CREATE TABLE public.transacoes_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  medico_id UUID REFERENCES public.medicos(id),
  sala_id UUID REFERENCES public.salas(id),
  convenio_id UUID REFERENCES public.convenios(id),
  paciente_id UUID REFERENCES public.pacientes(id),
  data_competencia DATE NOT NULL,
  data_caixa DATE,
  descricao TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_bruto NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  impostos_taxas NUMERIC(12,2) NOT NULL DEFAULT 0,
  custo_direto_csv NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(12,2) GENERATED ALWAYS AS (valor_bruto - desconto - impostos_taxas) STORED,
  status_recebimento status_recebimento NOT NULL DEFAULT 'a_receber',
  data_prevista_recebimento DATE,
  forma_pagamento TEXT,
  status_conciliacao status_conciliacao NOT NULL DEFAULT 'pendente',
  status_presenca status_presenca DEFAULT 'confirmado',
  feegow_id TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, feegow_id)
);

CREATE TABLE public.transacoes_recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES public.transacoes_vendas(id),
  data_recebimento DATE NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  origem TEXT NOT NULL DEFAULT 'manual',
  referencia_externa TEXT,
  getnet_id TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.conciliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES public.transacoes_vendas(id),
  recebimento_id UUID REFERENCES public.transacoes_recebimentos(id),
  status status_conciliacao NOT NULL DEFAULT 'pendente',
  divergencia NUMERIC(12,2) DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELAS FINANCEIRAS
-- =============================================
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  tipo tipo_despesa NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  data_competencia DATE NOT NULL,
  data_pagamento DATE,
  fornecedor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  fornecedor TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status status_conta NOT NULL DEFAULT 'pendente',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dividas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  credor TEXT NOT NULL,
  descricao TEXT,
  saldo NUMERIC(12,2) NOT NULL,
  taxa_juros NUMERIC(5,2) DEFAULT 0,
  custo_efetivo NUMERIC(5,2) DEFAULT 0,
  tipo tipo_divida NOT NULL DEFAULT 'curto_prazo',
  data_inicio DATE,
  data_vencimento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ajustes_contabeis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT,
  valor_mensal NUMERIC(12,2) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TABELAS DE PARÂMETROS E INTEGRAÇÕES
-- =============================================
CREATE TABLE public.parametros_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, chave)
);

CREATE TABLE public.integracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  status status_integracao NOT NULL DEFAULT 'inativo',
  ultima_sincronizacao TIMESTAMPTZ,
  configuracoes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, tipo)
);

CREATE TABLE public.sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  integracao_tipo TEXT NOT NULL,
  status status_sync NOT NULL DEFAULT 'em_andamento',
  inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fim TIMESTAMPTZ,
  registros_processados INTEGER DEFAULT 0,
  erros JSONB DEFAULT '[]'::jsonb,
  detalhes TEXT
);

-- =============================================
-- TABELAS DE MARKETING E OCUPAÇÃO
-- =============================================
CREATE TABLE public.marketing_gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  canal TEXT NOT NULL,
  campanha TEXT,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agenda_ocupacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  medico_id UUID REFERENCES public.medicos(id),
  sala_id UUID REFERENCES public.salas(id),
  slots_total INTEGER NOT NULL DEFAULT 0,
  slots_ocupados INTEGER NOT NULL DEFAULT 0,
  feegow_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, data, medico_id, sala_id)
);

-- =============================================
-- TRIGGER: updated_at automático
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clinicas','usuarios','medicos','salas','convenios','pacientes',
    'transacoes_vendas','transacoes_recebimentos','despesas','contas_pagar',
    'dividas','ajustes_contabeis','parametros_financeiros','integracoes','marketing_gastos'
  ])
  LOOP
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END;
$$;

-- =============================================
-- TRIGGER: criar perfil automaticamente no signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Não cria perfil automaticamente; o onboarding da clínica fará isso
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RLS: habilitar em todas as tabelas
-- =============================================
ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_contabeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_ocupacao ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- clinicas: usuário vê apenas sua clínica
CREATE POLICY "Users view own clinica" ON public.clinicas
  FOR SELECT TO authenticated
  USING (id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Admins manage clinica" ON public.clinicas
  FOR ALL TO authenticated
  USING (id = public.get_user_clinica_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- usuarios: vê próprio perfil, admin vê todos da clínica
CREATE POLICY "Users view own profile" ON public.usuarios
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin view clinic users" ON public.usuarios
  FOR SELECT TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin insert users" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.get_user_clinica_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- user_roles: apenas admin gerencia
CREATE POLICY "Admin manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Macro para tabelas com clinica_id: SELECT para todos autenticados da clínica
-- INSERT/UPDATE/DELETE para admin e gestor

-- medicos
CREATE POLICY "Clinic users view medicos" ON public.medicos
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage medicos" ON public.medicos
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- salas
CREATE POLICY "Clinic users view salas" ON public.salas
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage salas" ON public.salas
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- convenios
CREATE POLICY "Clinic users view convenios" ON public.convenios
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage convenios" ON public.convenios
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- pacientes
CREATE POLICY "Clinic users view pacientes" ON public.pacientes
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage pacientes" ON public.pacientes
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- transacoes_vendas
CREATE POLICY "Clinic users view vendas" ON public.transacoes_vendas
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage vendas" ON public.transacoes_vendas
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));
-- operador_caixa pode atualizar status de recebimento
CREATE POLICY "Caixa update vendas" ON public.transacoes_vendas
  FOR UPDATE TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND public.has_role(auth.uid(), 'operador_caixa'));

-- transacoes_recebimentos
CREATE POLICY "Clinic users view recebimentos" ON public.transacoes_recebimentos
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage recebimentos" ON public.transacoes_recebimentos
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));
CREATE POLICY "Caixa insert recebimentos" ON public.transacoes_recebimentos
  FOR INSERT TO authenticated
  WITH CHECK (clinica_id = public.get_user_clinica_id(auth.uid()) AND public.has_role(auth.uid(), 'operador_caixa'));

-- conciliacoes
CREATE POLICY "Clinic users view conciliacoes" ON public.conciliacoes
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage conciliacoes" ON public.conciliacoes
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- despesas
CREATE POLICY "Clinic users view despesas" ON public.despesas
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage despesas" ON public.despesas
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- contas_pagar
CREATE POLICY "Clinic users view contas_pagar" ON public.contas_pagar
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage contas_pagar" ON public.contas_pagar
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- dividas
CREATE POLICY "Clinic users view dividas" ON public.dividas
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage dividas" ON public.dividas
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- ajustes_contabeis
CREATE POLICY "Clinic users view ajustes" ON public.ajustes_contabeis
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage ajustes" ON public.ajustes_contabeis
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- parametros_financeiros
CREATE POLICY "Clinic users view parametros" ON public.parametros_financeiros
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin manage parametros" ON public.parametros_financeiros
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- integracoes
CREATE POLICY "Clinic users view integracoes" ON public.integracoes
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin manage integracoes" ON public.integracoes
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- sync_log
CREATE POLICY "Clinic users view sync_log" ON public.sync_log
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin manage sync_log" ON public.sync_log
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- marketing_gastos
CREATE POLICY "Clinic users view marketing" ON public.marketing_gastos
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage marketing" ON public.marketing_gastos
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- agenda_ocupacao
CREATE POLICY "Clinic users view agenda" ON public.agenda_ocupacao
  FOR SELECT TO authenticated USING (clinica_id = public.get_user_clinica_id(auth.uid()));
CREATE POLICY "Admin/gestor manage agenda" ON public.agenda_ocupacao
  FOR ALL TO authenticated
  USING (clinica_id = public.get_user_clinica_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_usuarios_clinica ON public.usuarios(clinica_id);
CREATE INDEX idx_usuarios_user ON public.usuarios(user_id);
CREATE INDEX idx_medicos_clinica ON public.medicos(clinica_id);
CREATE INDEX idx_medicos_feegow ON public.medicos(clinica_id, feegow_id);
CREATE INDEX idx_salas_clinica ON public.salas(clinica_id);
CREATE INDEX idx_convenios_clinica ON public.convenios(clinica_id);
CREATE INDEX idx_pacientes_clinica ON public.pacientes(clinica_id);
CREATE INDEX idx_pacientes_feegow ON public.pacientes(clinica_id, feegow_id);
CREATE INDEX idx_vendas_clinica ON public.transacoes_vendas(clinica_id);
CREATE INDEX idx_vendas_data ON public.transacoes_vendas(clinica_id, data_competencia);
CREATE INDEX idx_vendas_medico ON public.transacoes_vendas(medico_id);
CREATE INDEX idx_vendas_sala ON public.transacoes_vendas(sala_id);
CREATE INDEX idx_vendas_convenio ON public.transacoes_vendas(convenio_id);
CREATE INDEX idx_vendas_status ON public.transacoes_vendas(clinica_id, status_recebimento);
CREATE INDEX idx_vendas_feegow ON public.transacoes_vendas(clinica_id, feegow_id);
CREATE INDEX idx_vendas_presenca ON public.transacoes_vendas(clinica_id, status_presenca);
CREATE INDEX idx_recebimentos_clinica ON public.transacoes_recebimentos(clinica_id);
CREATE INDEX idx_recebimentos_data ON public.transacoes_recebimentos(clinica_id, data_recebimento);
CREATE INDEX idx_recebimentos_venda ON public.transacoes_recebimentos(venda_id);
CREATE INDEX idx_conciliacoes_clinica ON public.conciliacoes(clinica_id);
CREATE INDEX idx_despesas_clinica ON public.despesas(clinica_id);
CREATE INDEX idx_despesas_data ON public.despesas(clinica_id, data_competencia);
CREATE INDEX idx_contas_pagar_clinica ON public.contas_pagar(clinica_id);
CREATE INDEX idx_contas_pagar_venc ON public.contas_pagar(clinica_id, data_vencimento);
CREATE INDEX idx_dividas_clinica ON public.dividas(clinica_id);
CREATE INDEX idx_agenda_clinica ON public.agenda_ocupacao(clinica_id, data);
CREATE INDEX idx_sync_log_clinica ON public.sync_log(clinica_id, integracao_tipo);
CREATE INDEX idx_marketing_clinica ON public.marketing_gastos(clinica_id);

-- =============================================
-- SERVICE ROLE POLICIES para Edge Functions (sync)
-- =============================================
-- As edge functions usam service_role key que bypassa RLS automaticamente
