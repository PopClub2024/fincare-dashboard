
-- =================================================================
-- 1. get_cash_forecast: previsão de caixa com regra sexta/sábado
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_cash_forecast(_start_date date, _end_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _clinica_id uuid;
  _result jsonb;
  _previsao_entradas jsonb := '[]'::jsonb;
  _saidas_programadas jsonb := '[]'::jsonb;
  _resumo_canal jsonb;
  _total_a_receber numeric := 0;
  _total_particular numeric := 0;
  _total_convenio numeric := 0;
  _rec record;
BEGIN
  _clinica_id := get_user_clinica_id(auth.uid());
  IF _clinica_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem clínica';
  END IF;

  -- Previsão de entradas: vendas a_receber com data prevista calculada
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.semana), '[]'::jsonb)
  INTO _previsao_entradas
  FROM (
    SELECT
      date_trunc('week', data_prev)::date as semana,
      to_char(date_trunc('week', data_prev), 'DD/MM') as semana_label,
      SUM(valor_bruto) as total,
      SUM(CASE WHEN canal = 'particular' THEN valor_bruto ELSE 0 END) as particular,
      SUM(CASE WHEN canal = 'convenio' THEN valor_bruto ELSE 0 END) as convenio,
      COUNT(*) as qtd
    FROM (
      SELECT
        tv.valor_bruto,
        CASE WHEN tv.convenio_id IS NOT NULL THEN 'convenio' ELSE 'particular' END as canal,
        CASE
          -- Se já tem data prevista de recebimento, usar ela
          WHEN tv.data_prevista_recebimento IS NOT NULL THEN tv.data_prevista_recebimento::date
          -- Se tem Getnet com data prevista, usar
          WHEN gt.data_prevista_pagamento IS NOT NULL THEN gt.data_prevista_pagamento
          -- Convênio: data_competencia + prazo_repasse_dias
          WHEN tv.convenio_id IS NOT NULL THEN
            tv.data_competencia::date + COALESCE(c.prazo_repasse_dias, 30)
          -- Particular PIX/dinheiro: D+0
          WHEN tv.forma_pagamento_enum IN ('pix', 'dinheiro') THEN tv.data_competencia::date
          -- Particular cartão: D+1 com regra sexta/sábado→segunda
          ELSE
            CASE
              WHEN EXTRACT(DOW FROM tv.data_competencia::date) = 5 THEN tv.data_competencia::date + 3 -- sex→seg
              WHEN EXTRACT(DOW FROM tv.data_competencia::date) = 6 THEN tv.data_competencia::date + 2 -- sab→seg
              WHEN EXTRACT(DOW FROM tv.data_competencia::date) = 0 THEN tv.data_competencia::date + 1 -- dom→seg
              ELSE tv.data_competencia::date + 1 -- D+1
            END
        END as data_prev
      FROM public.transacoes_vendas tv
      LEFT JOIN public.convenios c ON c.id = tv.convenio_id
      LEFT JOIN public.getnet_transacoes gt ON gt.venda_id = tv.id
      WHERE tv.clinica_id = _clinica_id
        AND tv.status_recebimento = 'a_receber'
    ) sub
    WHERE data_prev BETWEEN _start_date AND _end_date
    GROUP BY date_trunc('week', data_prev)
  ) t;

  -- Totais por canal
  SELECT
    COALESCE(SUM(valor_bruto), 0),
    COALESCE(SUM(CASE WHEN convenio_id IS NULL THEN valor_bruto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN convenio_id IS NOT NULL THEN valor_bruto ELSE 0 END), 0)
  INTO _total_a_receber, _total_particular, _total_convenio
  FROM public.transacoes_vendas
  WHERE clinica_id = _clinica_id
    AND status_recebimento = 'a_receber';

  -- Saídas programadas (AP a vencer)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.semana), '[]'::jsonb)
  INTO _saidas_programadas
  FROM (
    SELECT
      date_trunc('week', COALESCE(data_vencimento, data_competencia))::date as semana,
      to_char(date_trunc('week', COALESCE(data_vencimento, data_competencia)), 'DD/MM') as semana_label,
      SUM(valor) as total,
      COUNT(*) as qtd
    FROM public.contas_pagar_lancamentos
    WHERE clinica_id = _clinica_id
      AND status IN ('a_classificar', 'classificado')
      AND data_pagamento IS NULL
      AND COALESCE(data_vencimento, data_competencia) BETWEEN _start_date AND _end_date
    GROUP BY date_trunc('week', COALESCE(data_vencimento, data_competencia))
  ) t;

  -- Detalhe por convênio
  _resumo_canal := (
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    FROM (
      SELECT
        COALESCE(c.nome, 'Particular') as convenio,
        c.prazo_repasse_dias,
        SUM(tv.valor_bruto) as total_faturado,
        SUM(CASE WHEN tv.status_recebimento = 'recebido' THEN tv.valor_bruto ELSE 0 END) as recebido,
        SUM(CASE WHEN tv.status_recebimento = 'a_receber' THEN tv.valor_bruto ELSE 0 END) as pendente,
        COUNT(*) as qtd_consultas
      FROM public.transacoes_vendas tv
      LEFT JOIN public.convenios c ON c.id = tv.convenio_id
      WHERE tv.clinica_id = _clinica_id
        AND tv.data_competencia BETWEEN _start_date AND _end_date
      GROUP BY COALESCE(c.nome, 'Particular'), c.prazo_repasse_dias
      ORDER BY SUM(tv.valor_bruto) DESC
    ) t
  );

  _result := jsonb_build_object(
    'previsao_entradas', _previsao_entradas,
    'saidas_programadas', _saidas_programadas,
    'total_a_receber', _total_a_receber,
    'total_particular', _total_particular,
    'total_convenio', _total_convenio,
    'resumo_canal', COALESCE(_resumo_canal, '[]'::jsonb)
  );

  RETURN _result;
END;
$function$;

-- =================================================================
-- 2. Atualizar get_dre: usar taxa real Getnet quando disponível
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_dre(_start_date date, _end_date date, _filtros jsonb DEFAULT '{}'::jsonb)
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
  _rt numeric;
  _receita_cartao numeric;
  _imposto_pct numeric;
  _taxa_cartao_pct numeric;
  _impostos numeric;
  _taxa_cartao numeric;
  _taxa_cartao_real numeric;
  _taxa_cartao_estimada numeric;
  _has_getnet boolean;
  _repasses numeric;
  _cf numeric;
  _mc numeric;
  _mc_pct numeric;
  _resultado numeric;
  _resultado_pct numeric;
  _total_rt numeric := 0;
  _total_impostos numeric := 0;
  _total_taxa_cartao numeric := 0;
  _total_repasses numeric := 0;
  _total_cf numeric := 0;
  _total_mc numeric := 0;
  _total_resultado numeric := 0;
  _imp_info jsonb;
  _taxa_info jsonb;
  _convenio_filter uuid;
  _forma_pagamento_filter text;
  _medico_filter uuid;
  _sala_filter uuid;
  _has_vendas boolean;
  _hist_row record;
BEGIN
  _clinica_id := get_user_clinica_id(auth.uid());
  IF _clinica_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem clínica';
  END IF;

  _convenio_filter := (_filtros->>'convenio_id')::uuid;
  _forma_pagamento_filter := _filtros->>'forma_pagamento';
  _medico_filter := (_filtros->>'medico_id')::uuid;
  _sala_filter := (_filtros->>'sala_id')::uuid;

  -- Check if we have live vendas data
  SELECT EXISTS(
    SELECT 1 FROM public.transacoes_vendas
    WHERE clinica_id = _clinica_id
      AND data_competencia BETWEEN _start_date AND _end_date
    LIMIT 1
  ) INTO _has_vendas;

  -- If no live data, fallback to historico
  IF NOT _has_vendas THEN
    FOR _hist_row IN
      SELECT * FROM public.dre_historico_mensal
      WHERE clinica_id = _clinica_id
        AND (ano * 100 + mes) >= (EXTRACT(YEAR FROM _start_date) * 100 + EXTRACT(MONTH FROM _start_date))
        AND (ano * 100 + mes) <= (EXTRACT(YEAR FROM _end_date) * 100 + EXTRACT(MONTH FROM _end_date))
      ORDER BY ano, mes
    LOOP
      _total_rt := _total_rt + _hist_row.rt;
      _total_impostos := _total_impostos + _hist_row.impostos;
      _total_taxa_cartao := _total_taxa_cartao + _hist_row.taxa_cartao;
      _total_repasses := _total_repasses + _hist_row.repasses;
      _total_cf := _total_cf + _hist_row.cf;
      _total_mc := _total_mc + _hist_row.mc;
      _total_resultado := _total_resultado + _hist_row.resultado;

      _mensal := _mensal || jsonb_build_object(
        'mes', format('%s-%s', _hist_row.ano, lpad(_hist_row.mes::text, 2, '0')),
        'mes_label', to_char(make_date(_hist_row.ano, _hist_row.mes, 1), 'Mon/YY'),
        'rt', _hist_row.rt,
        'impostos', _hist_row.impostos,
        'taxa_cartao', _hist_row.taxa_cartao,
        'repasses', _hist_row.repasses,
        'mc', _hist_row.mc,
        'mc_pct', _hist_row.mc_pct,
        'cf', _hist_row.cf,
        'resultado', _hist_row.resultado,
        'resultado_pct', _hist_row.resultado_pct,
        'fonte', 'historico'
      );
    END LOOP;

    _cards := jsonb_build_object(
      'rt', _total_rt,
      'impostos', _total_impostos,
      'taxa_cartao', _total_taxa_cartao,
      'repasses', _total_repasses,
      'mc', _total_mc,
      'mc_pct', CASE WHEN _total_rt > 0 THEN ROUND(_total_mc / _total_rt * 100, 1) ELSE 0 END,
      'cf', _total_cf,
      'resultado', _total_resultado,
      'resultado_pct', CASE WHEN _total_rt > 0 THEN ROUND(_total_resultado / _total_rt * 100, 1) ELSE 0 END,
      'fonte', 'historico'
    );

    RETURN jsonb_build_object('cards', _cards, 'mensal', _mensal);
  END IF;

  -- Live data flow
  _cur_date := date_trunc('month', _start_date)::date;

  WHILE _cur_date <= _end_date LOOP
    _month_start := _cur_date;
    _month_end := (date_trunc('month', _cur_date) + INTERVAL '1 month - 1 day')::date;

    -- RT
    SELECT COALESCE(SUM(valor_bruto), 0) INTO _rt
    FROM public.transacoes_vendas
    WHERE clinica_id = _clinica_id
      AND data_competencia BETWEEN _month_start AND _month_end
      AND (_convenio_filter IS NULL OR convenio_id = _convenio_filter)
      AND (_forma_pagamento_filter IS NULL OR forma_pagamento_enum::text = _forma_pagamento_filter)
      AND (_medico_filter IS NULL OR medico_id = _medico_filter)
      AND (_sala_filter IS NULL OR sala_id = _sala_filter);

    -- Receita de cartão
    SELECT COALESCE(SUM(valor_bruto), 0) INTO _receita_cartao
    FROM public.transacoes_vendas
    WHERE clinica_id = _clinica_id
      AND data_competencia BETWEEN _month_start AND _month_end
      AND forma_pagamento_enum IN ('cartao_credito', 'cartao_debito')
      AND (_convenio_filter IS NULL OR convenio_id = _convenio_filter)
      AND (_medico_filter IS NULL OR medico_id = _medico_filter)
      AND (_sala_filter IS NULL OR sala_id = _sala_filter);

    -- Taxa Getnet REAL
    SELECT COALESCE(SUM(valor_taxa), 0), COUNT(*) > 0
    INTO _taxa_cartao_real, _has_getnet
    FROM public.getnet_transacoes
    WHERE clinica_id = _clinica_id
      AND data_venda::date BETWEEN _month_start AND _month_end;

    -- Imposto
    SELECT percentual INTO _imposto_pct
    FROM public.taxas_config
    WHERE clinica_id = _clinica_id AND codigo = 'lp_total'
      AND vigente_de <= _month_start AND (vigente_ate IS NULL OR vigente_ate >= _month_start)
      AND ativo = true
    ORDER BY vigente_de DESC LIMIT 1;

    SELECT jsonb_build_object('codigo', codigo, 'nome', nome, 'percentual', percentual, 'vigente_de', vigente_de, 'vigente_ate', vigente_ate)
    INTO _imp_info
    FROM public.taxas_config
    WHERE clinica_id = _clinica_id AND codigo = 'lp_total'
      AND vigente_de <= _month_start AND (vigente_ate IS NULL OR vigente_ate >= _month_start)
      AND ativo = true
    ORDER BY vigente_de DESC LIMIT 1;

    IF _imposto_pct IS NULL THEN
      _imposto_pct := 0;
      _imp_info := jsonb_build_object('alerta', format('Sem alíquota vigente para lp_total em %s', to_char(_month_start, 'YYYY-MM')));
    END IF;

    -- Taxa cartão estimada (fallback)
    SELECT percentual INTO _taxa_cartao_pct
    FROM public.taxas_config
    WHERE clinica_id = _clinica_id AND codigo = 'taxa_cartao'
      AND vigente_de <= _month_start AND (vigente_ate IS NULL OR vigente_ate >= _month_start)
      AND ativo = true
    ORDER BY vigente_de DESC LIMIT 1;

    SELECT jsonb_build_object('codigo', codigo, 'nome', nome, 'percentual', percentual, 'vigente_de', vigente_de, 'vigente_ate', vigente_ate)
    INTO _taxa_info
    FROM public.taxas_config
    WHERE clinica_id = _clinica_id AND codigo = 'taxa_cartao'
      AND vigente_de <= _month_start AND (vigente_ate IS NULL OR vigente_ate >= _month_start)
      AND ativo = true
    ORDER BY vigente_de DESC LIMIT 1;

    IF _taxa_cartao_pct IS NULL THEN _taxa_cartao_pct := 0; END IF;

    _taxa_cartao_estimada := ROUND(_receita_cartao * _taxa_cartao_pct / 100, 2);

    -- Usar taxa real quando disponível, senão estimada
    IF _has_getnet THEN
      _taxa_cartao := _taxa_cartao_real;
      _taxa_info := COALESCE(_taxa_info, '{}'::jsonb) || jsonb_build_object('fonte', 'getnet_real', 'valor_real', _taxa_cartao_real, 'valor_estimado', _taxa_cartao_estimada);
    ELSE
      _taxa_cartao := _taxa_cartao_estimada;
      _taxa_info := COALESCE(_taxa_info, '{}'::jsonb) || jsonb_build_object('fonte', 'estimativa_percentual');
    END IF;

    _impostos := ROUND(_rt * _imposto_pct / 100, 2);

    -- Repasses médicos (CV)
    SELECT COALESCE(SUM(cpl.valor), 0) INTO _repasses
    FROM public.contas_pagar_lancamentos cpl
    JOIN public.dre_mapeamento_contas dm ON dm.plano_contas_id = cpl.plano_contas_id
      AND dm.clinica_id = _clinica_id AND dm.linha_dre = 'repasses_medicos' AND dm.ativo = true
    WHERE cpl.clinica_id = _clinica_id
      AND cpl.data_competencia BETWEEN _month_start AND _month_end
      AND cpl.status != 'cancelado';

    -- CF
    SELECT COALESCE(SUM(cpl.valor), 0) INTO _cf
    FROM public.contas_pagar_lancamentos cpl
    JOIN public.dre_mapeamento_contas dm ON dm.plano_contas_id = cpl.plano_contas_id
      AND dm.clinica_id = _clinica_id AND dm.linha_dre = 'custo_fixo' AND dm.ativo = true
    WHERE cpl.clinica_id = _clinica_id
      AND cpl.data_competencia BETWEEN _month_start AND _month_end
      AND cpl.status != 'cancelado';

    _mc := _rt - _impostos - _taxa_cartao - _repasses;
    _mc_pct := CASE WHEN _rt > 0 THEN ROUND(_mc / _rt * 100, 1) ELSE 0 END;
    _resultado := _mc - _cf;
    _resultado_pct := CASE WHEN _rt > 0 THEN ROUND(_resultado / _rt * 100, 1) ELSE 0 END;

    _total_rt := _total_rt + _rt;
    _total_impostos := _total_impostos + _impostos;
    _total_taxa_cartao := _total_taxa_cartao + _taxa_cartao;
    _total_repasses := _total_repasses + _repasses;
    _total_cf := _total_cf + _cf;
    _total_mc := _total_mc + _mc;
    _total_resultado := _total_resultado + _resultado;

    _mensal := _mensal || jsonb_build_object(
      'mes', to_char(_month_start, 'YYYY-MM'),
      'mes_label', to_char(_month_start, 'Mon/YY'),
      'rt', _rt,
      'impostos', _impostos,
      'taxa_cartao', _taxa_cartao,
      'taxa_cartao_real', _taxa_cartao_real,
      'taxa_cartao_estimada', _taxa_cartao_estimada,
      'has_getnet', _has_getnet,
      'repasses', _repasses,
      'mc', _mc,
      'mc_pct', _mc_pct,
      'cf', _cf,
      'resultado', _resultado,
      'resultado_pct', _resultado_pct,
      'receita_cartao', _receita_cartao,
      'imposto_info', COALESCE(_imp_info, '{}'::jsonb),
      'taxa_info', COALESCE(_taxa_info, '{}'::jsonb),
      'fonte', 'live'
    );

    _cur_date := (_cur_date + INTERVAL '1 month')::date;
  END LOOP;

  _cards := jsonb_build_object(
    'rt', _total_rt,
    'impostos', _total_impostos,
    'taxa_cartao', _total_taxa_cartao,
    'repasses', _total_repasses,
    'mc', _total_mc,
    'mc_pct', CASE WHEN _total_rt > 0 THEN ROUND(_total_mc / _total_rt * 100, 1) ELSE 0 END,
    'cf', _total_cf,
    'resultado', _total_resultado,
    'resultado_pct', CASE WHEN _total_rt > 0 THEN ROUND(_total_resultado / _total_rt * 100, 1) ELSE 0 END,
    'pe', CASE WHEN _total_mc > 0 AND _total_rt > 0 THEN ROUND(_total_cf / (_total_mc / _total_rt), 2) ELSE 0 END,
    'fonte', 'live'
  );

  _result := jsonb_build_object('cards', _cards, 'mensal', _mensal);
  RETURN _result;
END;
$function$;

-- =================================================================
-- 3. Atualizar get_cash_kpis: enriquecer com dados bancários reais
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_cash_kpis(_start_date date, _end_date date, _filtros jsonb DEFAULT '{}'::jsonb)
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
  _has_bank_data boolean := false;
  _hist_row record;
  _entradas_conciliadas numeric := 0;
  _entradas_nao_identificadas numeric := 0;
  _saidas_conciliadas numeric := 0;
  _saidas_nao_identificadas numeric := 0;
  _pct_conciliacao numeric := 0;
  _bank_entradas numeric;
  _bank_saidas numeric;
BEGIN
  _clinica_id := get_user_clinica_id(auth.uid());
  IF _clinica_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem clínica';
  END IF;

  -- Check bank data
  SELECT EXISTS(
    SELECT 1 FROM public.transacoes_bancarias
    WHERE clinica_id = _clinica_id
      AND data_transacao::date BETWEEN _start_date AND _end_date
    LIMIT 1
  ) INTO _has_bank_data;

  -- Check live data
  SELECT EXISTS(
    SELECT 1 FROM public.transacoes_recebimentos
    WHERE clinica_id = _clinica_id AND data_recebimento BETWEEN _start_date AND _end_date
    LIMIT 1
  ) INTO _has_live_data;

  IF NOT _has_live_data THEN
    SELECT EXISTS(
      SELECT 1 FROM public.contas_pagar_lancamentos
      WHERE clinica_id = _clinica_id AND data_pagamento BETWEEN _start_date AND _end_date
      LIMIT 1
    ) INTO _has_live_data;
  END IF;

  -- If we have bank data, it takes priority for real cash position
  IF _has_bank_data THEN
    _has_live_data := true;
  END IF;

  -- Saldo inicial
  SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN tipo = 'debito' THEN valor ELSE 0 END), 0)
  INTO _saldo_acum
  FROM (
    SELECT 'credito' as tipo, valor FROM public.transacoes_recebimentos
    WHERE clinica_id = _clinica_id AND data_recebimento < _start_date
    UNION ALL
    SELECT 'debito' as tipo, valor FROM public.contas_pagar_lancamentos
    WHERE clinica_id = _clinica_id AND data_pagamento IS NOT NULL AND data_pagamento < _start_date AND status != 'cancelado'
  ) pre;

  -- If bank data, override saldo inicial
  IF _has_bank_data THEN
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN tipo = 'debito' THEN ABS(valor) ELSE 0 END), 0)
    INTO _saldo_acum
    FROM public.transacoes_bancarias
    WHERE clinica_id = _clinica_id AND data_transacao::date < _start_date;
  END IF;

  IF NOT _has_live_data THEN
    -- Historical fallback
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
        'entradas', _entradas, 'saidas', _saidas, 'saldo', _saldo_acum,
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
    _cur_date := date_trunc('month', _start_date)::date;
    WHILE _cur_date <= _end_date LOOP
      _month_start := _cur_date;
      _month_end := (date_trunc('month', _cur_date) + INTERVAL '1 month - 1 day')::date;

      IF _has_bank_data THEN
        -- Use bank as primary source
        SELECT
          COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN tipo = 'debito' THEN ABS(valor) ELSE 0 END), 0)
        INTO _bank_entradas, _bank_saidas
        FROM public.transacoes_bancarias
        WHERE clinica_id = _clinica_id
          AND data_transacao::date BETWEEN _month_start AND _month_end;

        _entradas := _bank_entradas;
        _saidas := _bank_saidas;
      ELSE
        SELECT COALESCE(SUM(valor), 0) INTO _entradas
        FROM public.transacoes_recebimentos
        WHERE clinica_id = _clinica_id AND data_recebimento BETWEEN _month_start AND _month_end;

        SELECT COALESCE(SUM(valor), 0) INTO _saidas
        FROM public.contas_pagar_lancamentos
        WHERE clinica_id = _clinica_id AND data_pagamento BETWEEN _month_start AND _month_end AND status != 'cancelado';
      END IF;

      _saldo_acum := _saldo_acum + _entradas - _saidas;
      _total_entradas := _total_entradas + _entradas;
      _total_saidas := _total_saidas + _saidas;

      _mensal := _mensal || jsonb_build_object(
        'mes', to_char(_month_start, 'YYYY-MM'),
        'mes_label', to_char(_month_start, 'Mon/YY'),
        'entradas', _entradas, 'saidas', _saidas, 'saldo', _saldo_acum,
        'fonte', CASE WHEN _has_bank_data THEN 'banco' ELSE 'live' END
      );

      _cur_date := (_cur_date + INTERVAL '1 month')::date;
    END LOOP;
  END IF;

  -- Conciliation stats
  IF _has_bank_data THEN
    SELECT
      COALESCE(SUM(CASE WHEN tb.conciliacao_id IS NOT NULL AND tb.tipo = 'credito' THEN tb.valor ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN tb.conciliacao_id IS NULL AND tb.tipo = 'credito' THEN tb.valor ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN tb.conciliacao_id IS NOT NULL AND tb.tipo = 'debito' THEN ABS(tb.valor) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN tb.conciliacao_id IS NULL AND tb.tipo = 'debito' THEN ABS(tb.valor) ELSE 0 END), 0)
    INTO _entradas_conciliadas, _entradas_nao_identificadas, _saidas_conciliadas, _saidas_nao_identificadas
    FROM public.transacoes_bancarias tb
    WHERE tb.clinica_id = _clinica_id
      AND tb.data_transacao::date BETWEEN _start_date AND _end_date;

    IF (_total_entradas + _total_saidas) > 0 THEN
      _pct_conciliacao := ROUND(
        (_entradas_conciliadas + _saidas_conciliadas) / 
        NULLIF(_total_entradas + _total_saidas, 0) * 100, 1
      );
    END IF;
  END IF;

  -- AR
  SELECT COALESCE(SUM(valor_bruto), 0) INTO _ar_total
  FROM public.transacoes_vendas
  WHERE clinica_id = _clinica_id AND status_recebimento IN ('a_receber', 'inadimplente') AND data_competencia <= _end_date;

  SELECT COALESCE(SUM(valor_bruto), 0) INTO _ar_vencido
  FROM public.transacoes_vendas
  WHERE clinica_id = _clinica_id AND status_recebimento IN ('a_receber', 'inadimplente')
    AND data_competencia <= _end_date AND COALESCE(data_prevista_recebimento, data_competencia) < CURRENT_DATE;

  -- AP
  SELECT COALESCE(SUM(valor), 0) INTO _ap_total
  FROM public.contas_pagar_lancamentos
  WHERE clinica_id = _clinica_id AND status IN ('a_classificar', 'classificado') AND data_pagamento IS NULL AND data_competencia <= _end_date;

  SELECT COALESCE(SUM(valor), 0) INTO _ap_vencido
  FROM public.contas_pagar_lancamentos
  WHERE clinica_id = _clinica_id AND status IN ('a_classificar', 'classificado') AND data_pagamento IS NULL
    AND data_vencimento IS NOT NULL AND data_vencimento < CURRENT_DATE;

  -- Aging
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
    WHERE clinica_id = _clinica_id AND status_recebimento IN ('a_receber', 'inadimplente') AND data_competencia <= _end_date
  ) aged;

  -- Top saídas
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _top_saidas
  FROM (
    SELECT pc.categoria, SUM(cpl.valor) as total
    FROM public.contas_pagar_lancamentos cpl
    LEFT JOIN public.plano_contas pc ON pc.id = cpl.plano_contas_id
    WHERE cpl.clinica_id = _clinica_id AND cpl.data_pagamento BETWEEN _start_date AND _end_date AND cpl.status != 'cancelado'
    GROUP BY pc.categoria ORDER BY total DESC LIMIT 10
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
    'capital_giro', _saldo_acum + _ar_total - _ap_total,
    'entradas_conciliadas', _entradas_conciliadas,
    'entradas_nao_identificadas', _entradas_nao_identificadas,
    'saidas_conciliadas', _saidas_conciliadas,
    'saidas_nao_identificadas', _saidas_nao_identificadas,
    'pct_conciliacao', _pct_conciliacao
  );

  _result := jsonb_build_object(
    'cards', _cards,
    'mensal', _mensal,
    'aging', COALESCE(_aging, '{}'::jsonb),
    'top_saidas', COALESCE(_top_saidas, '[]'::jsonb),
    'has_live_data', _has_live_data,
    'has_bank_data', _has_bank_data
  );

  RETURN _result;
END;
$function$;
