
-- =====================================================
-- 1) ENUMS
-- =====================================================
DO $$ BEGIN
  CREATE TYPE tipo_recebivel AS ENUM ('getnet','pix_banco','dinheiro','convenio_nf');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE meio_recebimento AS ENUM ('cartao_credito','cartao_debito','pix','dinheiro','convenio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_recebivel_agg AS ENUM ('pendente','parcial','recebido','divergente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_nf_convenio AS ENUM ('rascunho','enviada','a_receber','paga','glosa_parcial','glosa_total','divergente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE camada_conciliacao AS ENUM ('feegow_getnet_venda','getnet_recebivel_banco','convenio_nf_banco','pix_banco');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_conciliacao_receita AS ENUM ('conciliado','pendente','divergente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_presenca_op AS ENUM ('agendado','confirmado','em_espera','em_atendimento','atendido','faltou','cancelado','cancelado_paciente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_operacao AS ENUM ('consulta','exame','servico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 2) operacao_producao (granular por atendimento)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.operacao_producao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  data_competencia date NOT NULL,
  tipo tipo_operacao NOT NULL DEFAULT 'consulta',
  procedimento_nome text,
  procedimento_id text,
  especialidade text,
  medico_id uuid REFERENCES public.medicos(id),
  paciente_id uuid,
  valor_bruto numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  valor_liquido numeric NOT NULL DEFAULT 0,
  status_presenca status_presenca_op NOT NULL DEFAULT 'agendado',
  forma_pagamento_original text,
  feegow_refs jsonb DEFAULT '{}'::jsonb,
  feegow_agendamento_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_op_prod_feegow ON public.operacao_producao (clinica_id, feegow_agendamento_id) WHERE feegow_agendamento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_op_prod_competencia ON public.operacao_producao (clinica_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_op_prod_medico ON public.operacao_producao (clinica_id, medico_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_op_prod_especialidade ON public.operacao_producao (clinica_id, especialidade, data_competencia);

ALTER TABLE public.operacao_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own operacao_producao" ON public.operacao_producao
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Service role full access operacao_producao" ON public.operacao_producao
  FOR ALL USING (auth.role() = 'service_role'::text);

-- =====================================================
-- 3) contas_receber_agregado (para baixa/conciliar)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contas_receber_agregado (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo_recebivel tipo_recebivel NOT NULL,
  competencia date NOT NULL,
  data_base date,
  data_prevista_recebimento date,
  data_recebimento date,
  meio meio_recebimento NOT NULL,
  bandeira text,
  valor_esperado numeric NOT NULL DEFAULT 0,
  valor_recebido numeric NOT NULL DEFAULT 0,
  status status_recebivel_agg NOT NULL DEFAULT 'pendente',
  origem_ref jsonb DEFAULT '{}'::jsonb,
  conciliacao_id uuid,
  nf_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cr_agg_competencia ON public.contas_receber_agregado (clinica_id, competencia);
CREATE INDEX IF NOT EXISTS idx_cr_agg_status ON public.contas_receber_agregado (clinica_id, status);
CREATE INDEX IF NOT EXISTS idx_cr_agg_tipo ON public.contas_receber_agregado (clinica_id, tipo_recebivel, data_base);

ALTER TABLE public.contas_receber_agregado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cr_agregado" ON public.contas_receber_agregado
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Users update own cr_agregado" ON public.contas_receber_agregado
  FOR UPDATE USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Service role full access cr_agregado" ON public.contas_receber_agregado
  FOR ALL USING (auth.role() = 'service_role'::text);

-- =====================================================
-- 4) convenios_nf (NF manual com competência e glosa)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.convenios_nf (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  convenio_id uuid NOT NULL REFERENCES public.convenios(id),
  credenciador_pagador text,
  competencia date NOT NULL,
  periodo_atendimentos_inicio date,
  periodo_atendimentos_fim date,
  numero_nf text,
  data_emissao date,
  data_envio date,
  valor_faturado numeric NOT NULL DEFAULT 0,
  valor_esperado numeric NOT NULL DEFAULT 0,
  valor_recebido numeric NOT NULL DEFAULT 0,
  valor_glosado numeric NOT NULL DEFAULT 0,
  status status_nf_convenio NOT NULL DEFAULT 'rascunho',
  motivo_glosa text,
  observacoes text,
  banco_tx_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_nf_competencia ON public.convenios_nf (clinica_id, convenio_id, competencia);
CREATE INDEX IF NOT EXISTS idx_conv_nf_status ON public.convenios_nf (clinica_id, status);

ALTER TABLE public.convenios_nf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own convenios_nf" ON public.convenios_nf
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Users insert own convenios_nf" ON public.convenios_nf
  FOR INSERT WITH CHECK (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Users update own convenios_nf" ON public.convenios_nf
  FOR UPDATE USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Users delete own convenios_nf" ON public.convenios_nf
  FOR DELETE USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Service role full access convenios_nf" ON public.convenios_nf
  FOR ALL USING (auth.role() = 'service_role'::text);

-- =====================================================
-- 5) conciliacao_receitas (waterfall audit trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conciliacao_receitas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  competencia date NOT NULL,
  data_liquidacao date,
  camada camada_conciliacao NOT NULL,
  status status_conciliacao_receita NOT NULL DEFAULT 'pendente',
  score numeric,
  motivo_divergencia text,
  refs jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conc_rec_competencia ON public.conciliacao_receitas (clinica_id, competencia);
CREATE INDEX IF NOT EXISTS idx_conc_rec_camada ON public.conciliacao_receitas (clinica_id, camada, status);

ALTER TABLE public.conciliacao_receitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conciliacao_receitas" ON public.conciliacao_receitas
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Service role full access conciliacao_receitas" ON public.conciliacao_receitas
  FOR ALL USING (auth.role() = 'service_role'::text);

-- =====================================================
-- 6) Add credenciador_pagador to convenios table
-- =====================================================
ALTER TABLE public.convenios ADD COLUMN IF NOT EXISTS credenciador_pagador text;

-- =====================================================
-- 7) Updated_at trigger for new tables
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_cr_agregado_updated_at
  BEFORE UPDATE ON public.contas_receber_agregado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_convenios_nf_updated_at
  BEFORE UPDATE ON public.convenios_nf
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
