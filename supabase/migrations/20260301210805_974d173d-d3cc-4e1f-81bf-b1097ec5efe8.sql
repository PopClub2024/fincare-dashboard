
-- Audit table
CREATE TABLE IF NOT EXISTS public.auditoria_integracoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  integracao text NOT NULL,
  periodo text NOT NULL,
  relatorio_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auditoria_integracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/gestor manage auditoria" ON public.auditoria_integracoes FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)));
CREATE POLICY "Clinic users view auditoria" ON public.auditoria_integracoes FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- vendas_itens
CREATE TABLE IF NOT EXISTS public.vendas_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  feegow_invoice_id text NOT NULL,
  feegow_item_id text NOT NULL,
  data_competencia date NOT NULL,
  procedimento_id text,
  procedimento_nome text,
  tipo text,
  quantidade integer NOT NULL DEFAULT 1,
  valor_bruto_item numeric NOT NULL DEFAULT 0,
  desconto_item numeric NOT NULL DEFAULT 0,
  valor_liquido_item numeric NOT NULL DEFAULT 0,
  medico_id uuid REFERENCES public.medicos(id),
  especialidade text,
  convenio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, feegow_invoice_id, feegow_item_id)
);
ALTER TABLE public.vendas_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/gestor manage vendas_itens" ON public.vendas_itens FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)));
CREATE POLICY "Clinic users view vendas_itens" ON public.vendas_itens FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));
CREATE INDEX idx_vendas_itens_clinica_data ON public.vendas_itens(clinica_id, data_competencia);
CREATE INDEX idx_vendas_itens_clinica_medico ON public.vendas_itens(clinica_id, medico_id);
CREATE INDEX idx_vendas_itens_clinica_espec ON public.vendas_itens(clinica_id, especialidade);

-- vendas_pagamentos
CREATE TABLE IF NOT EXISTS public.vendas_pagamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  feegow_invoice_id text NOT NULL,
  feegow_payment_id text,
  data_pagamento date,
  forma_pagamento_feegow_id integer,
  forma_pagamento forma_pagamento,
  valor_pago numeric NOT NULL DEFAULT 0,
  parcelas integer DEFAULT 1,
  bandeira text,
  nsu_tid_autorizacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, feegow_invoice_id, feegow_payment_id)
);
ALTER TABLE public.vendas_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/gestor manage vendas_pagamentos" ON public.vendas_pagamentos FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)));
CREATE POLICY "Clinic users view vendas_pagamentos" ON public.vendas_pagamentos FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- Add valor_pago to transacoes_vendas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_vendas' AND column_name = 'valor_pago') THEN
    ALTER TABLE public.transacoes_vendas ADD COLUMN valor_pago numeric DEFAULT 0;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tv_clinica_data ON public.transacoes_vendas(clinica_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_tv_clinica_medico ON public.transacoes_vendas(clinica_id, medico_id);
CREATE INDEX IF NOT EXISTS idx_tv_clinica_espec ON public.transacoes_vendas(clinica_id, especialidade);

-- RPC: get_discount_summary
CREATE OR REPLACE FUNCTION public.get_discount_summary(_start_date date, _end_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE _clinica_id uuid; _result jsonb;
BEGIN
  _clinica_id := get_user_clinica_id(auth.uid());
  IF _clinica_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT jsonb_build_object(
    'total_bruto', COALESCE(SUM(valor_bruto), 0),
    'total_desconto', COALESCE(SUM(desconto), 0),
    'total_liquido', COALESCE(SUM(valor_liquido), 0),
    'total_pago', COALESCE(SUM(valor_pago), 0),
    'pct_desconto', CASE WHEN SUM(valor_bruto) > 0 THEN ROUND(SUM(desconto) / SUM(valor_bruto) * 100, 1) ELSE 0 END,
    'por_medico', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT COALESCE(m.nome, 'Sem médico') as medico, SUM(tv.valor_bruto) as bruto, SUM(tv.desconto) as desconto,
               SUM(tv.valor_liquido) as liquido, COUNT(*) as qtd
        FROM transacoes_vendas tv LEFT JOIN medicos m ON m.id = tv.medico_id
        WHERE tv.clinica_id = _clinica_id AND tv.data_competencia BETWEEN _start_date AND _end_date
        GROUP BY m.nome ORDER BY bruto DESC LIMIT 20
      ) t
    ),
    'por_especialidade', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT COALESCE(especialidade, 'Sem especialidade') as especialidade,
               SUM(valor_bruto) as bruto, SUM(desconto) as desconto,
               SUM(valor_liquido) as liquido, COUNT(*) as qtd
        FROM transacoes_vendas WHERE clinica_id = _clinica_id AND data_competencia BETWEEN _start_date AND _end_date
        GROUP BY especialidade ORDER BY bruto DESC LIMIT 20
      ) t
    ),
    'por_procedimento', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT COALESCE(procedimento, 'Sem procedimento') as procedimento,
               SUM(valor_bruto) as bruto, SUM(desconto) as desconto,
               SUM(valor_liquido) as liquido, SUM(quantidade) as qtd
        FROM transacoes_vendas WHERE clinica_id = _clinica_id AND data_competencia BETWEEN _start_date AND _end_date
        GROUP BY procedimento ORDER BY bruto DESC LIMIT 30
      ) t
    )
  ) INTO _result
  FROM transacoes_vendas WHERE clinica_id = _clinica_id AND data_competencia BETWEEN _start_date AND _end_date;

  RETURN _result;
END; $fn$;
