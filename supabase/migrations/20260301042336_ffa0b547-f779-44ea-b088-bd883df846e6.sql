
-- =============================================
-- PRECIFICAÇÃO, PONTO DE EQUILÍBRIO E METAS
-- =============================================

-- 1) Tipos enum
DO $$ BEGIN
  CREATE TYPE public.tipo_procedimento AS ENUM ('consulta', 'exame', 'procedimento', 'servico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_pagador AS ENUM ('particular', 'convenio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_preco AS ENUM ('publicado', 'inativo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.origem_preco AS ENUM ('importado_planilha', 'manual', 'sync_feegow');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_rascunho AS ENUM ('rascunho', 'aprovado', 'publicado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_sync_feegow AS ENUM ('nao_enviado', 'enviado', 'confirmado', 'erro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_sync_feegow AS ENUM ('sync_procedimentos', 'update_precos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_sync_log AS ENUM ('sucesso', 'erro', 'parcial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Tabela procedimentos
CREATE TABLE IF NOT EXISTS public.procedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo public.tipo_procedimento NOT NULL DEFAULT 'consulta',
  codigo_feegow text,
  nome text NOT NULL,
  especialidade text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage procedimentos" ON public.procedimentos
  FOR ALL USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view procedimentos" ON public.procedimentos
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 3) Tabela pagadores
CREATE TABLE IF NOT EXISTS public.pagadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo public.tipo_pagador NOT NULL DEFAULT 'convenio',
  nome text NOT NULL,
  codigo_feegow text,
  usa_taxa_cartao boolean NOT NULL DEFAULT false,
  usa_comissao_faturista boolean NOT NULL DEFAULT false,
  comissao_faturista_pct numeric(7,4) DEFAULT 0,
  cf_alocado_pct numeric(7,4) DEFAULT 0,
  cf_alocado_valor numeric(12,2) DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pagadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage pagadores" ON public.pagadores
  FOR ALL USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view pagadores" ON public.pagadores
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 4) Tabela precos_procedimento (oficial com vigência)
CREATE TABLE IF NOT EXISTS public.precos_procedimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  pagador_id uuid NOT NULL REFERENCES public.pagadores(id),
  procedimento_id uuid NOT NULL REFERENCES public.procedimentos(id),
  preco_bruto numeric(12,2) NOT NULL,
  repasse_medico numeric(12,2) DEFAULT 0,
  repasse_medico_pct numeric(7,4),
  custo_variavel numeric(12,2) DEFAULT 0,
  desconto_pct numeric(7,4) DEFAULT 0,
  vigente_de date NOT NULL,
  vigente_ate date,
  status public.status_preco NOT NULL DEFAULT 'publicado',
  origem public.origem_preco NOT NULL DEFAULT 'manual',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.precos_procedimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage precos" ON public.precos_procedimento
  FOR ALL USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view precos" ON public.precos_procedimento
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 5) Rascunhos / Simulações
CREATE TABLE IF NOT EXISTS public.precos_rascunho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome_cenario text NOT NULL,
  descricao text,
  status public.status_rascunho NOT NULL DEFAULT 'rascunho',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.precos_rascunho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage rascunhos" ON public.precos_rascunho
  FOR ALL USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view rascunhos" ON public.precos_rascunho
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 6) Itens do rascunho
CREATE TABLE IF NOT EXISTS public.precos_rascunho_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  rascunho_id uuid NOT NULL REFERENCES public.precos_rascunho(id) ON DELETE CASCADE,
  pagador_id uuid NOT NULL REFERENCES public.pagadores(id),
  procedimento_id uuid NOT NULL REFERENCES public.procedimentos(id),
  novo_preco_bruto numeric(12,2) NOT NULL,
  novo_repasse numeric(12,2),
  vigente_de date NOT NULL,
  observacao text,
  status_sync_feegow public.status_sync_feegow NOT NULL DEFAULT 'nao_enviado',
  feegow_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.precos_rascunho_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage rascunho_itens" ON public.precos_rascunho_itens
  FOR ALL USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view rascunho_itens" ON public.precos_rascunho_itens
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 7) Log de sincronização Feegow
CREATE TABLE IF NOT EXISTS public.feegow_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo public.tipo_sync_feegow NOT NULL,
  rascunho_id uuid REFERENCES public.precos_rascunho(id),
  payload jsonb NOT NULL DEFAULT '{}',
  response jsonb,
  status public.status_sync_log NOT NULL DEFAULT 'sucesso',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feegow_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage feegow_log" ON public.feegow_sync_log
  FOR ALL USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view feegow_log" ON public.feegow_sync_log
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 8) Premissas de precificação (configuráveis por clínica)
CREATE TABLE IF NOT EXISTS public.premissas_precificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) UNIQUE,
  cf_total_mensal numeric(12,2) NOT NULL DEFAULT 0,
  aliquota_lp_pct numeric(7,4) NOT NULL DEFAULT 7.93,
  taxa_cartao_pct numeric(7,4) NOT NULL DEFAULT 3.16,
  comissao_faturista_pct numeric(7,4) NOT NULL DEFAULT 1.50,
  meta_lucro_sobrevivencia numeric(7,4) NOT NULL DEFAULT 0,
  meta_lucro_conservador numeric(7,4) NOT NULL DEFAULT 10,
  meta_lucro_saudavel numeric(7,4) NOT NULL DEFAULT 15,
  meta_lucro_ideal numeric(7,4) NOT NULL DEFAULT 20,
  meta_lucro_excelente numeric(7,4) NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.premissas_precificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage premissas_prec" ON public.premissas_precificacao
  FOR ALL USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view premissas_prec" ON public.premissas_precificacao
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_precos_proc_vigencia ON public.precos_procedimento (clinica_id, pagador_id, procedimento_id, vigente_de);
CREATE INDEX IF NOT EXISTS idx_precos_rascunho_status ON public.precos_rascunho (clinica_id, status);
CREATE INDEX IF NOT EXISTS idx_procedimentos_clinica ON public.procedimentos (clinica_id, ativo);
CREATE INDEX IF NOT EXISTS idx_pagadores_clinica ON public.pagadores (clinica_id, ativo);
