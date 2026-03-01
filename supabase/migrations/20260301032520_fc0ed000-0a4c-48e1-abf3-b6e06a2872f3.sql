
-- =============================================
-- 1) TABELA taxas_config (impostos e taxas com vigência)
-- =============================================
CREATE TABLE public.taxas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo text NOT NULL CHECK (tipo IN ('imposto','taxa')),
  codigo text NOT NULL,
  nome text NOT NULL,
  percentual numeric(7,4) NOT NULL,
  base_calculo text NOT NULL CHECK (base_calculo IN ('rt','receita_cartao')),
  vigente_de date NOT NULL,
  vigente_ate date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_taxas_config_clinica_codigo_vigencia ON public.taxas_config (clinica_id, codigo, vigente_de);
CREATE INDEX idx_taxas_config_clinica_tipo ON public.taxas_config (clinica_id, tipo, codigo);

ALTER TABLE public.taxas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage taxas_config"
  ON public.taxas_config FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view taxas_config"
  ON public.taxas_config FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- =============================================
-- 2) TRIGGER para validar não-sobreposição de vigência
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_taxa_vigencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.taxas_config
    WHERE clinica_id = NEW.clinica_id
      AND codigo = NEW.codigo
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND vigente_de <= COALESCE(NEW.vigente_ate, '9999-12-31'::date)
      AND COALESCE(vigente_ate, '9999-12-31'::date) >= NEW.vigente_de
  ) THEN
    RAISE EXCEPTION 'Sobreposição de vigência para o código % na clínica', NEW.codigo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_taxa_vigencia
  BEFORE INSERT OR UPDATE ON public.taxas_config
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_taxa_vigencia();

-- =============================================
-- 3) RPC upsert_taxa_vigencia
-- =============================================
CREATE OR REPLACE FUNCTION public.upsert_taxa_vigencia(
  _clinica_id uuid,
  _tipo text,
  _codigo text,
  _nome text,
  _percentual numeric,
  _base_calculo text,
  _vigente_de date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_id uuid;
BEGIN
  -- Encerrar vigência anterior
  UPDATE public.taxas_config
  SET vigente_ate = _vigente_de - INTERVAL '1 day'
  WHERE clinica_id = _clinica_id
    AND codigo = _codigo
    AND vigente_ate IS NULL
    AND vigente_de < _vigente_de;

  -- Inserir nova alíquota
  INSERT INTO public.taxas_config (clinica_id, tipo, codigo, nome, percentual, base_calculo, vigente_de)
  VALUES (_clinica_id, _tipo, _codigo, _nome, _percentual, _base_calculo, _vigente_de)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- =============================================
-- 4) TABELA dre_mapeamento_contas
-- =============================================
CREATE TABLE public.dre_mapeamento_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  plano_contas_id uuid NOT NULL REFERENCES public.plano_contas(id),
  linha_dre text NOT NULL CHECK (linha_dre IN ('repasses_medicos','custo_fixo')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dre_mapeamento_clinica ON public.dre_mapeamento_contas (clinica_id, linha_dre);

ALTER TABLE public.dre_mapeamento_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage dre_mapeamento"
  ON public.dre_mapeamento_contas FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view dre_mapeamento"
  ON public.dre_mapeamento_contas FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- =============================================
-- 5) RPC get_dre (cálculo principal)
-- =============================================
CREATE OR REPLACE FUNCTION public.get_dre(
  _start_date date,
  _end_date date,
  _filtros jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  _clinica_id := get_user_clinica_id(auth.uid());
  IF _clinica_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem clínica';
  END IF;

  -- Parse filters
  _convenio_filter := (_filtros->>'convenio_id')::uuid;
  _forma_pagamento_filter := _filtros->>'forma_pagamento';
  _medico_filter := (_filtros->>'medico_id')::uuid;
  _sala_filter := (_filtros->>'sala_id')::uuid;

  _cur_date := date_trunc('month', _start_date)::date;

  WHILE _cur_date <= _end_date LOOP
    _month_start := _cur_date;
    _month_end := (date_trunc('month', _cur_date) + INTERVAL '1 month - 1 day')::date;

    -- RT (Receita Bruta)
    SELECT COALESCE(SUM(valor_bruto), 0) INTO _rt
    FROM public.transacoes_vendas
    WHERE clinica_id = _clinica_id
      AND data_competencia BETWEEN _month_start AND _month_end
      AND (_convenio_filter IS NULL OR convenio_id = _convenio_filter)
      AND (_forma_pagamento_filter IS NULL OR forma_pagamento_enum::text = _forma_pagamento_filter)
      AND (_medico_filter IS NULL OR medico_id = _medico_filter)
      AND (_sala_filter IS NULL OR sala_id = _sala_filter);

    -- Receita de cartão (para taxa)
    SELECT COALESCE(SUM(valor_bruto), 0) INTO _receita_cartao
    FROM public.transacoes_vendas
    WHERE clinica_id = _clinica_id
      AND data_competencia BETWEEN _month_start AND _month_end
      AND forma_pagamento_enum IN ('cartao_credito', 'cartao_debito')
      AND (_convenio_filter IS NULL OR convenio_id = _convenio_filter)
      AND (_medico_filter IS NULL OR medico_id = _medico_filter)
      AND (_sala_filter IS NULL OR sala_id = _sala_filter);

    -- Buscar alíquota de imposto vigente no mês
    SELECT percentual INTO _imposto_pct
    FROM public.taxas_config
    WHERE clinica_id = _clinica_id
      AND codigo = 'lp_total'
      AND vigente_de <= _month_start
      AND (vigente_ate IS NULL OR vigente_ate >= _month_start)
      AND ativo = true
    ORDER BY vigente_de DESC LIMIT 1;

    -- Info do imposto para detalhes
    SELECT jsonb_build_object(
      'codigo', codigo, 'nome', nome, 'percentual', percentual,
      'vigente_de', vigente_de, 'vigente_ate', vigente_ate
    ) INTO _imp_info
    FROM public.taxas_config
    WHERE clinica_id = _clinica_id
      AND codigo = 'lp_total'
      AND vigente_de <= _month_start
      AND (vigente_ate IS NULL OR vigente_ate >= _month_start)
      AND ativo = true
    ORDER BY vigente_de DESC LIMIT 1;

    IF _imposto_pct IS NULL THEN
      _imposto_pct := 0;
      _imp_info := jsonb_build_object('alerta', format('Sem alíquota vigente para lp_total em %s', to_char(_month_start, 'YYYY-MM')));
    END IF;

    -- Buscar taxa de cartão vigente no mês
    SELECT percentual INTO _taxa_cartao_pct
    FROM public.taxas_config
    WHERE clinica_id = _clinica_id
      AND codigo = 'taxa_cartao'
      AND vigente_de <= _month_start
      AND (vigente_ate IS NULL OR vigente_ate >= _month_start)
      AND ativo = true
    ORDER BY vigente_de DESC LIMIT 1;

    SELECT jsonb_build_object(
      'codigo', codigo, 'nome', nome, 'percentual', percentual,
      'vigente_de', vigente_de, 'vigente_ate', vigente_ate
    ) INTO _taxa_info
    FROM public.taxas_config
    WHERE clinica_id = _clinica_id
      AND codigo = 'taxa_cartao'
      AND vigente_de <= _month_start
      AND (vigente_ate IS NULL OR vigente_ate >= _month_start)
      AND ativo = true
    ORDER BY vigente_de DESC LIMIT 1;

    IF _taxa_cartao_pct IS NULL THEN
      _taxa_cartao_pct := 0;
      _taxa_info := jsonb_build_object('alerta', format('Sem alíquota vigente para taxa_cartao em %s', to_char(_month_start, 'YYYY-MM')));
    END IF;

    -- Cálculos
    _impostos := ROUND(_rt * _imposto_pct / 100, 2);
    _taxa_cartao := ROUND(_receita_cartao * _taxa_cartao_pct / 100, 2);

    -- Repasses médicos (CV)
    SELECT COALESCE(SUM(cpl.valor), 0) INTO _repasses
    FROM public.contas_pagar_lancamentos cpl
    JOIN public.dre_mapeamento_contas dm ON dm.plano_contas_id = cpl.plano_contas_id
      AND dm.clinica_id = _clinica_id AND dm.linha_dre = 'repasses_medicos' AND dm.ativo = true
    WHERE cpl.clinica_id = _clinica_id
      AND cpl.data_competencia BETWEEN _month_start AND _month_end
      AND cpl.status != 'cancelado';

    -- Custo Fixo (CF)
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

    -- Acumular totais
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
      'repasses', _repasses,
      'mc', _mc,
      'mc_pct', _mc_pct,
      'cf', _cf,
      'resultado', _resultado,
      'resultado_pct', _resultado_pct,
      'receita_cartao', _receita_cartao,
      'imposto_info', COALESCE(_imp_info, '{}'::jsonb),
      'taxa_info', COALESCE(_taxa_info, '{}'::jsonb)
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
    'resultado_pct', CASE WHEN _total_rt > 0 THEN ROUND(_total_resultado / _total_rt * 100, 1) ELSE 0 END
  );

  _result := jsonb_build_object('cards', _cards, 'mensal', _mensal);
  RETURN _result;
END;
$$;

-- =============================================
-- 6) Atualizar onboard_clinica para seed taxas
-- =============================================
CREATE OR REPLACE FUNCTION public.onboard_clinica(
  _nome_clinica text,
  _cnpj text DEFAULT NULL,
  _nome_usuario text DEFAULT NULL,
  _email_usuario text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _clinica_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'Usuário já vinculado a uma clínica';
  END IF;

  INSERT INTO public.clinicas (nome, cnpj)
  VALUES (_nome_clinica, _cnpj)
  RETURNING id INTO _clinica_id;

  INSERT INTO public.usuarios (user_id, clinica_id, nome, email)
  VALUES (_user_id, _clinica_id, COALESCE(_nome_usuario, ''), _email_usuario);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin');

  -- Seed plano de contas
  PERFORM public.seed_plano_contas(_clinica_id);

  -- Seed taxas padrão (LP 7.93% e Taxa Cartão 3.16%)
  INSERT INTO public.taxas_config (clinica_id, tipo, codigo, nome, percentual, base_calculo, vigente_de)
  VALUES
    (_clinica_id, 'imposto', 'lp_total', 'Lucro Presumido (total)', 7.93, 'rt', '2026-01-01'),
    (_clinica_id, 'taxa', 'taxa_cartao', 'Taxa Cartão', 3.16, 'receita_cartao', '2026-01-01');

  -- Seed mapeamento DRE padrão (Mão de obra médica → repasses, Gastos fixos → custo_fixo)
  INSERT INTO public.dre_mapeamento_contas (clinica_id, plano_contas_id, linha_dre)
  SELECT _clinica_id, id, 'repasses_medicos'
  FROM public.plano_contas
  WHERE clinica_id = _clinica_id AND categoria = 'Mão de obra médica e terapêutica';

  INSERT INTO public.dre_mapeamento_contas (clinica_id, plano_contas_id, linha_dre)
  SELECT _clinica_id, id, 'custo_fixo'
  FROM public.plano_contas
  WHERE clinica_id = _clinica_id AND categoria IN (
    'Gastos fixos', 'Gastos com Pessoal', 'Impostos RH', 'Locação de equipamentos',
    'Gastos com Serviços de Terceiros', 'Gastos com Marketing', 'Empréstimos'
  );

  RETURN _clinica_id;
END;
$$;
