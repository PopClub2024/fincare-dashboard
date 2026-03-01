
-- =============================================================
-- 1. Tabela de histórico mensal de fluxo de caixa (snapshots)
-- =============================================================
CREATE TABLE public.caixa_historico_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  ano integer NOT NULL,
  mes integer NOT NULL,
  entradas_operacionais numeric NOT NULL DEFAULT 0,
  recuperacoes_glosa numeric NOT NULL DEFAULT 0,
  saidas_mao_obra numeric NOT NULL DEFAULT 0,
  saidas_custos_variaveis numeric NOT NULL DEFAULT 0,
  saidas_custos_fixos numeric NOT NULL DEFAULT 0,
  saidas_marketing numeric NOT NULL DEFAULT 0,
  saidas_impostos numeric NOT NULL DEFAULT 0,
  saidas_emprestimos numeric NOT NULL DEFAULT 0,
  aporte_nao_operacional numeric NOT NULL DEFAULT 0,
  retirada_nao_operacional numeric NOT NULL DEFAULT 0,
  saldo_operacional numeric NOT NULL DEFAULT 0,
  saldo_final numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, ano, mes)
);

ALTER TABLE public.caixa_historico_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users view caixa_historico"
  ON public.caixa_historico_mensal FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Admin/gestor manage caixa_historico"
  ON public.caixa_historico_mensal FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

-- Indexes
CREATE INDEX idx_caixa_hist_clinica_periodo ON public.caixa_historico_mensal(clinica_id, ano, mes);

-- =============================================================
-- 2. Tabela de prazos de recebimento por convênio/forma pagamento
-- =============================================================
CREATE TABLE public.prazos_recebimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo text NOT NULL, -- 'forma_pagamento' ou 'convenio'
  referencia text NOT NULL, -- ex: 'cartao_credito', 'pix', ou nome do convênio
  prazo_dias integer NOT NULL DEFAULT 0,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, tipo, referencia)
);

ALTER TABLE public.prazos_recebimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users view prazos"
  ON public.prazos_recebimento FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Admin/gestor manage prazos"
  ON public.prazos_recebimento FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

-- =============================================================
-- 3. RPC get_cash_kpis - Retorna KPIs de caixa + séries
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_cash_kpis(
  _start_date date,
  _end_date date,
  _filtros jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _clinica_id uuid;
  _result jsonb;
  _mensal jsonb := '[]'::jsonb;
  _cards jsonb;
  _cur_date date;
  _month_start date;
  _month_end date;
  _entradas numeric;
  _saidas numeric;
  _saldo_acum numeric := 0;
  _total_entradas numeric := 0;
  _total_saidas numeric := 0;
  _ar_total numeric;
  _ap_total numeric;
  _ar_vencido numeric;
  _ap_vencido numeric;
  _aging jsonb;
  _top_saidas jsonb;
  _has_live_data boolean := false;
  _hist_row record;
BEGIN
  _clinica_id := get_user_clinica_id(auth.uid());
  IF _clinica_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem clínica';
  END IF;

  -- Check if we have live data (recebimentos) in the period
  SELECT EXISTS(
    SELECT 1 FROM public.transacoes_recebimentos
    WHERE clinica_id = _clinica_id
      AND data_recebimento BETWEEN _start_date AND _end_date
    LIMIT 1
  ) INTO _has_live_data;

  -- Also check contas_pagar_lancamentos
  IF NOT _has_live_data THEN
    SELECT EXISTS(
      SELECT 1 FROM public.contas_pagar_lancamentos
      WHERE clinica_id = _clinica_id
        AND data_pagamento BETWEEN _start_date AND _end_date
      LIMIT 1
    ) INTO _has_live_data;
  END IF;

  -- Saldo inicial: sum of all cash movements before start_date
  SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN tipo = 'debito' THEN valor ELSE 0 END), 0)
  INTO _saldo_acum
  FROM (
    -- Recebimentos before period
    SELECT 'credito' as tipo, valor
    FROM public.transacoes_recebimentos
    WHERE clinica_id = _clinica_id AND data_recebimento < _start_date
    UNION ALL
    -- Pagamentos before period
    SELECT 'debito' as tipo, valor
    FROM public.contas_pagar_lancamentos
    WHERE clinica_id = _clinica_id AND data_pagamento IS NOT NULL AND data_pagamento < _start_date
      AND status != 'cancelado'
  ) pre;

  -- If no live data, try historical
  IF NOT _has_live_data THEN
    -- Use caixa_historico_mensal
    FOR _hist_row IN
      SELECT * FROM public.caixa_historico_mensal
      WHERE clinica_id = _clinica_id
        AND (ano * 100 + mes) >= (EXTRACT(YEAR FROM _start_date) * 100 + EXTRACT(MONTH FROM _start_date))
        AND (ano * 100 + mes) <= (EXTRACT(YEAR FROM _end_date) * 100 + EXTRACT(MONTH FROM _end_date))
      ORDER BY ano, mes
    LOOP
      _entradas := _hist_row.entradas_operacionais + _hist_row.recuperacoes_glosa + _hist_row.aporte_nao_operacional;
      _saidas := _hist_row.saidas_mao_obra + _hist_row.saidas_custos_variaveis 
               + _hist_row.saidas_custos_fixos + _hist_row.saidas_marketing 
               + _hist_row.saidas_impostos + _hist_row.saidas_emprestimos
               + _hist_row.retirada_nao_operacional;
      _saldo_acum := _saldo_acum + _entradas - _saidas;
      _total_entradas := _total_entradas + _entradas;
      _total_saidas := _total_saidas + _saidas;

      _mensal := _mensal || jsonb_build_object(
        'mes', format('%s-%s', _hist_row.ano, lpad(_hist_row.mes::text, 2, '0')),
        'mes_label', to_char(make_date(_hist_row.ano, _hist_row.mes, 1), 'Mon/YY'),
        'entradas', _entradas,
        'saidas', _saidas,
        'saldo', _saldo_acum,
        'entradas_op', _hist_row.entradas_operacionais,
        'recuperacoes', _hist_row.recuperacoes_glosa,
        'mao_obra', _hist_row.saidas_mao_obra,
        'custos_var', _hist_row.saidas_custos_variaveis,
        'custos_fix', _hist_row.saidas_custos_fixos,
        'marketing', _hist_row.saidas_marketing,
        'impostos', _hist_row.saidas_impostos,
        'emprestimos', _hist_row.saidas_emprestimos,
        'aporte', _hist_row.aporte_nao_operacional,
        'retirada', _hist_row.retirada_nao_operacional,
        'saldo_op', _hist_row.saldo_operacional,
        'saldo_final', _hist_row.saldo_final,
        'fonte', 'historico'
      );
    END LOOP;
  ELSE
    -- Live data: iterate months
    _cur_date := date_trunc('month', _start_date)::date;
    WHILE _cur_date <= _end_date LOOP
      _month_start := _cur_date;
      _month_end := (date_trunc('month', _cur_date) + INTERVAL '1 month - 1 day')::date;

      -- Entradas: recebimentos no período
      SELECT COALESCE(SUM(valor), 0) INTO _entradas
      FROM public.transacoes_recebimentos
      WHERE clinica_id = _clinica_id
        AND data_recebimento BETWEEN _month_start AND _month_end;

      -- Saídas: pagamentos no período
      SELECT COALESCE(SUM(valor), 0) INTO _saidas
      FROM public.contas_pagar_lancamentos
      WHERE clinica_id = _clinica_id
        AND data_pagamento BETWEEN _month_start AND _month_end
        AND status != 'cancelado';

      _saldo_acum := _saldo_acum + _entradas - _saidas;
      _total_entradas := _total_entradas + _entradas;
      _total_saidas := _total_saidas + _saidas;

      _mensal := _mensal || jsonb_build_object(
        'mes', to_char(_month_start, 'YYYY-MM'),
        'mes_label', to_char(_month_start, 'Mon/YY'),
        'entradas', _entradas,
        'saidas', _saidas,
        'saldo', _saldo_acum,
        'fonte', 'live'
      );

      _cur_date := (_cur_date + INTERVAL '1 month')::date;
    END LOOP;
  END IF;

  -- AR: Contas a Receber (vendas não recebidas)
  SELECT COALESCE(SUM(valor_bruto), 0) INTO _ar_total
  FROM public.transacoes_vendas
  WHERE clinica_id = _clinica_id
    AND status_recebimento IN ('a_receber', 'inadimplente')
    AND data_competencia <= _end_date;

  -- AR vencido
  SELECT COALESCE(SUM(valor_bruto), 0) INTO _ar_vencido
  FROM public.transacoes_vendas
  WHERE clinica_id = _clinica_id
    AND status_recebimento IN ('a_receber', 'inadimplente')
    AND data_competencia <= _end_date
    AND COALESCE(data_prevista_recebimento, data_competencia) < CURRENT_DATE;

  -- AP: Contas a Pagar em aberto
  SELECT COALESCE(SUM(valor), 0) INTO _ap_total
  FROM public.contas_pagar_lancamentos
  WHERE clinica_id = _clinica_id
    AND status IN ('a_classificar', 'classificado')
    AND data_pagamento IS NULL
    AND data_competencia <= _end_date;

  -- AP vencido
  SELECT COALESCE(SUM(valor), 0) INTO _ap_vencido
  FROM public.contas_pagar_lancamentos
  WHERE clinica_id = _clinica_id
    AND status IN ('a_classificar', 'classificado')
    AND data_pagamento IS NULL
    AND data_vencimento IS NOT NULL
    AND data_vencimento < CURRENT_DATE;

  -- Aging de recebíveis
  SELECT jsonb_build_object(
    '0_7', COALESCE(SUM(CASE WHEN dias BETWEEN 0 AND 7 THEN valor ELSE 0 END), 0),
    '8_15', COALESCE(SUM(CASE WHEN dias BETWEEN 8 AND 15 THEN valor ELSE 0 END), 0),
    '16_30', COALESCE(SUM(CASE WHEN dias BETWEEN 16 AND 30 THEN valor ELSE 0 END), 0),
    '31_60', COALESCE(SUM(CASE WHEN dias BETWEEN 31 AND 60 THEN valor ELSE 0 END), 0),
    '61_90', COALESCE(SUM(CASE WHEN dias BETWEEN 61 AND 90 THEN valor ELSE 0 END), 0),
    '90_plus', COALESCE(SUM(CASE WHEN dias > 90 THEN valor ELSE 0 END), 0)
  ) INTO _aging
  FROM (
    SELECT valor_bruto as valor,
      GREATEST(0, CURRENT_DATE - COALESCE(data_prevista_recebimento, data_competencia)) as dias
    FROM public.transacoes_vendas
    WHERE clinica_id = _clinica_id
      AND status_recebimento IN ('a_receber', 'inadimplente')
      AND data_competencia <= _end_date
  ) aged;

  -- Top 10 saídas por categoria
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _top_saidas
  FROM (
    SELECT pc.categoria, SUM(cpl.valor) as total
    FROM public.contas_pagar_lancamentos cpl
    LEFT JOIN public.plano_contas pc ON pc.id = cpl.plano_contas_id
    WHERE cpl.clinica_id = _clinica_id
      AND cpl.data_pagamento BETWEEN _start_date AND _end_date
      AND cpl.status != 'cancelado'
    GROUP BY pc.categoria
    ORDER BY total DESC
    LIMIT 10
  ) t;

  _cards := jsonb_build_object(
    'saldo_inicial', _saldo_acum - _total_entradas + _total_saidas,
    'entradas', _total_entradas,
    'saidas', _total_saidas,
    'saldo_final', _saldo_acum,
    'ar_total', _ar_total,
    'ar_vencido', _ar_vencido,
    'ar_a_vencer', _ar_total - _ar_vencido,
    'ap_total', _ap_total,
    'ap_vencido', _ap_vencido,
    'ap_a_vencer', _ap_total - _ap_vencido,
    'ncg', _ar_total - _ap_total,
    'capital_giro', _saldo_acum + _ar_total - _ap_total
  );

  _result := jsonb_build_object(
    'cards', _cards,
    'mensal', _mensal,
    'aging', COALESCE(_aging, '{}'::jsonb),
    'top_saidas', COALESCE(_top_saidas, '[]'::jsonb),
    'has_live_data', _has_live_data
  );

  RETURN _result;
END;
$function$;
