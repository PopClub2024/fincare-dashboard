
-- Enum para status de pagamento de NF
CREATE TYPE public.status_pagamento_nf AS ENUM (
  'a_emitir', 'emitida', 'enviada', 'a_receber', 'paga', 'atrasada'
);

-- Enum para status de recurso de glosa
CREATE TYPE public.status_recurso_glosa AS ENUM (
  'nao_iniciado', 'em_andamento', 'concluido', 'negado', 'parcial'
);

-- Enum para linha de receita
CREATE TYPE public.linha_receita_convenio AS ENUM (
  'consulta', 'exame', 'prestacao_servicos', 'outros'
);

-- =============================================
-- 1) CONTROLE DE FATURAMENTO / NF POR CONVÊNIO
-- =============================================
CREATE TABLE public.convenio_faturamentos_nf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  convenio_id uuid NOT NULL REFERENCES public.convenios(id),
  competencia date NOT NULL, -- 1o dia do mês
  periodo_referencia text,
  numero_nf text,
  data_emissao date,
  valor_nf numeric(12,2),
  valor_calculado numeric(12,2) NOT NULL DEFAULT 0,
  previsao_pagamento date,
  status_pagamento public.status_pagamento_nf NOT NULL DEFAULT 'a_emitir',
  data_pagamento date,
  valor_enviado numeric(12,2), -- EDITÁVEL MANUAL
  valor_liberado numeric(12,2),
  pendencia_recuperada numeric(12,2),
  glosa_estimada numeric(12,2),
  observacoes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, convenio_id, competencia)
);

ALTER TABLE public.convenio_faturamentos_nf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clinic faturamentos"
  ON public.convenio_faturamentos_nf FOR SELECT
  USING (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Users can insert own clinic faturamentos"
  ON public.convenio_faturamentos_nf FOR INSERT
  WITH CHECK (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Users can update own clinic faturamentos"
  ON public.convenio_faturamentos_nf FOR UPDATE
  USING (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Users can delete own clinic faturamentos"
  ON public.convenio_faturamentos_nf FOR DELETE
  USING (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE TRIGGER update_faturamentos_nf_updated_at
  BEFORE UPDATE ON public.convenio_faturamentos_nf
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2) PRODUÇÃO / ITENS FEEGOW POR CONVÊNIO
-- =============================================
CREATE TABLE public.convenio_producao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  convenio_id uuid NOT NULL REFERENCES public.convenios(id),
  data_competencia date NOT NULL,
  procedimento_id text,
  procedimento_nome text,
  linha_receita public.linha_receita_convenio NOT NULL DEFAULT 'consulta',
  especialidade text,
  medico_id uuid REFERENCES public.medicos(id),
  quantidade int NOT NULL DEFAULT 1,
  valor_bruto numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(12,2) NOT NULL DEFAULT 0,
  feegow_invoice_id text,
  feegow_item_key text, -- unique key for idempotency
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, feegow_invoice_id, feegow_item_key)
);

ALTER TABLE public.convenio_producao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clinic producao"
  ON public.convenio_producao_itens FOR SELECT
  USING (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Users can insert own clinic producao"
  ON public.convenio_producao_itens FOR INSERT
  WITH CHECK (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Users can update own clinic producao"
  ON public.convenio_producao_itens FOR UPDATE
  USING (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Users can delete own clinic producao"
  ON public.convenio_producao_itens FOR DELETE
  USING (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE INDEX idx_producao_itens_convenio_data 
  ON public.convenio_producao_itens(clinica_id, convenio_id, data_competencia);

-- =============================================
-- 3) GLOSAS (manual, workflow completo)
-- =============================================
CREATE TABLE public.convenio_glosas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  convenio_id uuid NOT NULL REFERENCES public.convenios(id),
  competencia date NOT NULL,
  protocolo text,
  nf_id uuid REFERENCES public.convenio_faturamentos_nf(id),
  valor_apresentado numeric(12,2) NOT NULL DEFAULT 0,
  valor_aprovado numeric(12,2) NOT NULL DEFAULT 0,
  valor_glosado numeric(12,2) NOT NULL DEFAULT 0,
  glosa_devida numeric(12,2),
  valor_a_recorrer numeric(12,2),
  valor_recursado numeric(12,2),
  valor_liberado numeric(12,2),
  valor_negado numeric(12,2),
  status_recurso public.status_recurso_glosa NOT NULL DEFAULT 'nao_iniciado',
  pago boolean NOT NULL DEFAULT false,
  data_pagamento date,
  valor_pago_recurso numeric(12,2),
  observacao_pagamento text,
  observacoes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.convenio_glosas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clinic glosas"
  ON public.convenio_glosas FOR SELECT
  USING (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Users can insert own clinic glosas"
  ON public.convenio_glosas FOR INSERT
  WITH CHECK (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Users can update own clinic glosas"
  ON public.convenio_glosas FOR UPDATE
  USING (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE POLICY "Users can delete own clinic glosas"
  ON public.convenio_glosas FOR DELETE
  USING (clinica_id = public.get_user_clinica_id(auth.uid()));

CREATE INDEX idx_glosas_convenio_comp 
  ON public.convenio_glosas(clinica_id, convenio_id, competencia);

CREATE TRIGGER update_glosas_updated_at
  BEFORE UPDATE ON public.convenio_glosas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4) RPC: KPIs por convênio/competência
-- =============================================
CREATE OR REPLACE FUNCTION public.get_convenio_kpis(
  _start_date date, 
  _end_date date,
  _convenio_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _clinica_id uuid;
  _result jsonb;
BEGIN
  _clinica_id := get_user_clinica_id(auth.uid());
  IF _clinica_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem clínica';
  END IF;

  SELECT jsonb_build_object(
    'cards', jsonb_build_object(
      'faturado_feegow', COALESCE(SUM(f.valor_calculado), 0),
      'enviado', COALESCE(SUM(f.valor_enviado), 0),
      'valor_nf', COALESCE(SUM(f.valor_nf), 0),
      'liberado', COALESCE(SUM(f.valor_liberado), 0),
      'glosa_estimada', COALESCE(SUM(f.glosa_estimada), 0),
      'pendencia_recuperada', COALESCE(SUM(f.pendencia_recuperada), 0),
      'a_receber', COALESCE(SUM(CASE WHEN f.status_pagamento NOT IN ('paga') THEN COALESCE(f.valor_enviado, f.valor_nf, f.valor_calculado) ELSE 0 END), 0),
      'pago', COALESCE(SUM(CASE WHEN f.status_pagamento = 'paga' THEN COALESCE(f.valor_liberado, f.valor_enviado, f.valor_nf) ELSE 0 END), 0)
    ),
    'glosas', (
      SELECT jsonb_build_object(
        'total_apresentado', COALESCE(SUM(g.valor_apresentado), 0),
        'total_aprovado', COALESCE(SUM(g.valor_aprovado), 0),
        'total_glosado', COALESCE(SUM(g.valor_glosado), 0),
        'total_recursado', COALESCE(SUM(g.valor_recursado), 0),
        'total_liberado', COALESCE(SUM(g.valor_liberado), 0),
        'total_negado', COALESCE(SUM(g.valor_negado), 0),
        'total_pago_recurso', COALESCE(SUM(g.valor_pago_recurso), 0),
        'pct_glosa', CASE WHEN SUM(g.valor_apresentado) > 0 
          THEN ROUND(SUM(g.valor_glosado) / SUM(g.valor_apresentado) * 100, 2) ELSE 0 END,
        'pct_recuperacao', CASE WHEN SUM(g.valor_recursado) > 0 
          THEN ROUND(SUM(g.valor_liberado) / SUM(g.valor_recursado) * 100, 2) ELSE 0 END
      )
      FROM public.convenio_glosas g
      WHERE g.clinica_id = _clinica_id
        AND g.competencia BETWEEN _start_date AND _end_date
        AND (_convenio_id IS NULL OR g.convenio_id = _convenio_id)
    ),
    'mensal', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.competencia), '[]'::jsonb)
      FROM (
        SELECT 
          f.competencia,
          to_char(f.competencia, 'Mon/YY') as mes_label,
          SUM(f.valor_calculado) as faturado,
          SUM(f.valor_enviado) as enviado,
          SUM(f.valor_liberado) as liberado,
          SUM(f.glosa_estimada) as glosa_est,
          COALESCE((
            SELECT SUM(g.valor_glosado)
            FROM public.convenio_glosas g
            WHERE g.clinica_id = _clinica_id 
              AND g.competencia = f.competencia
              AND (_convenio_id IS NULL OR g.convenio_id = _convenio_id)
          ), 0) as glosa_real
        FROM public.convenio_faturamentos_nf f
        WHERE f.clinica_id = _clinica_id
          AND f.competencia BETWEEN _start_date AND _end_date
          AND (_convenio_id IS NULL OR f.convenio_id = _convenio_id)
        GROUP BY f.competencia
      ) t
    ),
    'por_convenio', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.faturado DESC), '[]'::jsonb)
      FROM (
        SELECT 
          c.nome as convenio,
          c.prazo_repasse_dias,
          SUM(f.valor_calculado) as faturado,
          SUM(f.valor_enviado) as enviado,
          SUM(f.valor_liberado) as liberado,
          SUM(CASE WHEN f.status_pagamento NOT IN ('paga') THEN COALESCE(f.valor_enviado, f.valor_calculado) ELSE 0 END) as a_receber,
          COUNT(*) as qtd_nfs
        FROM public.convenio_faturamentos_nf f
        JOIN public.convenios c ON c.id = f.convenio_id
        WHERE f.clinica_id = _clinica_id
          AND f.competencia BETWEEN _start_date AND _end_date
          AND (_convenio_id IS NULL OR f.convenio_id = _convenio_id)
        GROUP BY c.nome, c.prazo_repasse_dias
      ) t
    )
  ) INTO _result
  FROM public.convenio_faturamentos_nf f
  WHERE f.clinica_id = _clinica_id
    AND f.competencia BETWEEN _start_date AND _end_date
    AND (_convenio_id IS NULL OR f.convenio_id = _convenio_id);

  RETURN COALESCE(_result, jsonb_build_object(
    'cards', jsonb_build_object('faturado_feegow',0,'enviado',0,'valor_nf',0,'liberado',0,'glosa_estimada',0,'pendencia_recuperada',0,'a_receber',0,'pago',0),
    'glosas', jsonb_build_object('total_apresentado',0,'total_aprovado',0,'total_glosado',0,'total_recursado',0,'total_liberado',0,'total_negado',0,'total_pago_recurso',0,'pct_glosa',0,'pct_recuperacao',0),
    'mensal', '[]'::jsonb,
    'por_convenio', '[]'::jsonb
  ));
END;
$$;
