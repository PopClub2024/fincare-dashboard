
-- =============================================
-- Getnet Recebíveis: 3 tabelas canônicas
-- =============================================

-- RESUMO (settlements por dia/bandeira)
CREATE TABLE public.getnet_recebiveis_resumo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  mes_ref date NOT NULL,
  data_vencimento date NOT NULL,
  bandeira_modalidade text,
  meio_pagamento text, -- cartao_debito, cartao_credito, pix
  status text,
  recebimento text,
  valor_liquido numeric NOT NULL DEFAULT 0,
  banco text,
  agencia text,
  conta_corrente text,
  raw_hash text,
  arquivo_id uuid REFERENCES public.import_runs(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_getnet_resumo_hash ON public.getnet_recebiveis_resumo(clinica_id, raw_hash);

ALTER TABLE public.getnet_recebiveis_resumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage getnet_resumo" ON public.getnet_recebiveis_resumo
  FOR ALL USING (
    clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  );

CREATE POLICY "Clinic users view getnet_resumo" ON public.getnet_recebiveis_resumo
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Service role full access getnet_resumo" ON public.getnet_recebiveis_resumo
  FOR ALL USING (auth.role() = 'service_role'::text);


-- DETALHADO (line items por transação)
CREATE TABLE public.getnet_recebiveis_detalhado (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  mes_ref date NOT NULL,
  data_vencimento date NOT NULL,
  bandeira_modalidade text,
  meio_pagamento text,
  tipo_lancamento text,
  lancamento text,
  valor_liquido numeric NOT NULL DEFAULT 0,
  valor_liquidado numeric DEFAULT 0,
  data_venda date,
  hora_venda text,
  valor_venda numeric DEFAULT 0,
  descontos numeric DEFAULT 0,
  autorizacao text,
  nsu text,
  terminal_logico text,
  raw_hash text,
  arquivo_id uuid REFERENCES public.import_runs(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_getnet_detalhado_hash ON public.getnet_recebiveis_detalhado(clinica_id, raw_hash);

ALTER TABLE public.getnet_recebiveis_detalhado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage getnet_detalhado" ON public.getnet_recebiveis_detalhado
  FOR ALL USING (
    clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  );

CREATE POLICY "Clinic users view getnet_detalhado" ON public.getnet_recebiveis_detalhado
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Service role full access getnet_detalhado" ON public.getnet_recebiveis_detalhado
  FOR ALL USING (auth.role() = 'service_role'::text);


-- SINTÉTICO (agregados por bandeira/modalidade)
CREATE TABLE public.getnet_recebiveis_sintetico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  mes_ref date NOT NULL,
  bandeira_modalidade text,
  meio_pagamento text,
  data_ultima_movimentacao date,
  valor_liquido numeric NOT NULL DEFAULT 0,
  quantidade integer DEFAULT 0,
  raw_hash text,
  arquivo_id uuid REFERENCES public.import_runs(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_getnet_sintetico_hash ON public.getnet_recebiveis_sintetico(clinica_id, raw_hash);

ALTER TABLE public.getnet_recebiveis_sintetico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage getnet_sintetico" ON public.getnet_recebiveis_sintetico
  FOR ALL USING (
    clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  );

CREATE POLICY "Clinic users view getnet_sintetico" ON public.getnet_recebiveis_sintetico
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Service role full access getnet_sintetico" ON public.getnet_recebiveis_sintetico
  FOR ALL USING (auth.role() = 'service_role'::text);


-- CONCILIAÇÃO RECEBÍVEIS (Banco ↔ Getnet Resumo)
CREATE TABLE public.conciliacao_recebiveis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  banco_tx_id uuid REFERENCES public.transacoes_bancarias(id),
  getnet_resumo_id uuid REFERENCES public.getnet_recebiveis_resumo(id),
  score numeric DEFAULT 0,
  rule_applied text,
  status text NOT NULL DEFAULT 'pendente',
  divergencia numeric DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_conciliacao_recebiveis_banco ON public.conciliacao_recebiveis(banco_tx_id) WHERE status = 'conciliado';
CREATE UNIQUE INDEX uq_conciliacao_recebiveis_getnet ON public.conciliacao_recebiveis(getnet_resumo_id) WHERE status = 'conciliado';

ALTER TABLE public.conciliacao_recebiveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage conciliacao_recebiveis" ON public.conciliacao_recebiveis
  FOR ALL USING (
    clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  );

CREATE POLICY "Clinic users view conciliacao_recebiveis" ON public.conciliacao_recebiveis
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Service role full access conciliacao_recebiveis" ON public.conciliacao_recebiveis
  FOR ALL USING (auth.role() = 'service_role'::text);


-- CONCILIAÇÃO VENDAS GATEWAY (Getnet Detalhado ↔ Feegow)
CREATE TABLE public.conciliacao_vendas_gateway (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  getnet_detalhado_id uuid REFERENCES public.getnet_recebiveis_detalhado(id),
  feegow_venda_id uuid REFERENCES public.transacoes_vendas(id),
  score numeric DEFAULT 0,
  match_confidence text,
  rule_applied text,
  status text NOT NULL DEFAULT 'pendente',
  divergencia numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_conc_vendas_gw_getnet ON public.conciliacao_vendas_gateway(getnet_detalhado_id) WHERE status = 'conciliado';
CREATE UNIQUE INDEX uq_conc_vendas_gw_feegow ON public.conciliacao_vendas_gateway(feegow_venda_id) WHERE status = 'conciliado';

ALTER TABLE public.conciliacao_vendas_gateway ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage conc_vendas_gw" ON public.conciliacao_vendas_gateway
  FOR ALL USING (
    clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  );

CREATE POLICY "Clinic users view conc_vendas_gw" ON public.conciliacao_vendas_gateway
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Service role full access conc_vendas_gw" ON public.conciliacao_vendas_gateway
  FOR ALL USING (auth.role() = 'service_role'::text);
