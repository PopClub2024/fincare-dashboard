
-- ============================================================
-- Endividamento & Impostos a Pagar module
-- ============================================================

-- 1) Enums
CREATE TYPE public.origem_pagamento AS ENUM ('extrato', 'manual');
CREATE TYPE public.tipo_imposto AS ENUM ('simples', 'fgts', 'inss', 'iss');
CREATE TYPE public.status_imposto AS ENUM ('aberto', 'parcial', 'pago');
CREATE TYPE public.tipo_destino_regra AS ENUM ('divida', 'imposto', 'conta_pagar');

-- 2) Alter dividas: add nome, saldo_inicial, ativo (if missing)
ALTER TABLE public.dividas
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric(12,2),
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Update nome from descricao where null
UPDATE public.dividas SET nome = COALESCE(descricao, credor) WHERE nome IS NULL;

-- 3) divida_pagamentos
CREATE TABLE public.divida_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  divida_id uuid NOT NULL REFERENCES public.dividas(id),
  data_pagamento date NOT NULL,
  valor_pago numeric(12,2) NOT NULL,
  principal_amortizado numeric(12,2),
  juros_pago numeric(12,2),
  origem origem_pagamento NOT NULL DEFAULT 'manual',
  transacao_bancaria_id text,
  conta_pagar_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.divida_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage divida_pagamentos"
  ON public.divida_pagamentos FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view divida_pagamentos"
  ON public.divida_pagamentos FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE INDEX idx_divida_pagamentos_divida ON public.divida_pagamentos(divida_id);
CREATE INDEX idx_divida_pagamentos_clinica_data ON public.divida_pagamentos(clinica_id, data_pagamento);

-- 4) impostos_devidos
CREATE TABLE public.impostos_devidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  imposto tipo_imposto NOT NULL,
  competencia date NOT NULL,
  valor_devido numeric(12,2) NOT NULL,
  valor_pago numeric(12,2) NOT NULL DEFAULT 0,
  status status_imposto NOT NULL DEFAULT 'aberto',
  vencimento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, imposto, competencia)
);

ALTER TABLE public.impostos_devidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage impostos_devidos"
  ON public.impostos_devidos FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view impostos_devidos"
  ON public.impostos_devidos FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE INDEX idx_impostos_devidos_clinica_comp ON public.impostos_devidos(clinica_id, competencia);

-- 5) imposto_pagamentos
CREATE TABLE public.imposto_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  impostos_devidos_id uuid NOT NULL REFERENCES public.impostos_devidos(id),
  data_pagamento date NOT NULL,
  valor_pago numeric(12,2) NOT NULL,
  origem origem_pagamento NOT NULL DEFAULT 'manual',
  transacao_bancaria_id text,
  conta_pagar_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.imposto_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage imposto_pagamentos"
  ON public.imposto_pagamentos FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view imposto_pagamentos"
  ON public.imposto_pagamentos FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 6) regras_conciliacao_debito
CREATE TABLE public.regras_conciliacao_debito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo_destino tipo_destino_regra NOT NULL,
  destino_id uuid,
  imposto tipo_imposto,
  descricao_regex text NOT NULL,
  janela_dias int NOT NULL DEFAULT 10,
  tolerancia_abs numeric(12,2) NOT NULL DEFAULT 5.00,
  tolerancia_pct numeric(7,4) NOT NULL DEFAULT 0.05,
  prioridade int NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.regras_conciliacao_debito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage regras_conciliacao"
  ON public.regras_conciliacao_debito FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view regras_conciliacao"
  ON public.regras_conciliacao_debito FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 7) divida_parcelas_previstas (schedule from spreadsheet)
CREATE TABLE public.divida_parcelas_previstas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  divida_id uuid NOT NULL REFERENCES public.dividas(id),
  competencia date NOT NULL,
  pmt numeric(12,2) NOT NULL,
  amortizacao numeric(12,2),
  juros numeric(12,2),
  saldo_devedor numeric(12,2),
  pago boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(divida_id, competencia)
);

ALTER TABLE public.divida_parcelas_previstas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage divida_parcelas"
  ON public.divida_parcelas_previstas FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view divida_parcelas"
  ON public.divida_parcelas_previstas FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE INDEX idx_divida_parcelas_divida ON public.divida_parcelas_previstas(divida_id, competencia);
