
-- Enum types for CFO Assistente module
CREATE TYPE public.tipo_insight AS ENUM ('analise_completa', 'alertas', 'conciliacao', 'metas', 'resumo_diario', 'resumo_mensal');
CREATE TYPE public.trigger_autopilot AS ENUM ('feegow_sync', 'import_bank', 'import_getnet', 'reconciliation', 'manual');
CREATE TYPE public.status_autopilot AS ENUM ('sucesso', 'erro', 'parcial', 'em_andamento');
CREATE TYPE public.severidade_alerta AS ENUM ('info', 'warning', 'critical');
CREATE TYPE public.status_alerta AS ENUM ('aberto', 'resolvido', 'ignorado');

-- 1) kpi_snapshots
CREATE TABLE public.kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  periodo date NOT NULL,
  granularidade text NOT NULL DEFAULT 'mensal',
  kpis jsonb NOT NULL DEFAULT '{}',
  data_quality_score int DEFAULT 0,
  data_quality_breakdown jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_kpi_snapshots_unique ON public.kpi_snapshots (clinica_id, periodo, granularidade);
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own kpi_snapshots" ON public.kpi_snapshots FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));
CREATE POLICY "Users can insert own kpi_snapshots" ON public.kpi_snapshots FOR INSERT WITH CHECK (clinica_id = get_user_clinica_id(auth.uid()));
CREATE POLICY "Users can update own kpi_snapshots" ON public.kpi_snapshots FOR UPDATE USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 2) alertas_eventos
CREATE TABLE public.alertas_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo text NOT NULL,
  severidade public.severidade_alerta NOT NULL DEFAULT 'info',
  titulo text NOT NULL,
  descricao text,
  contexto jsonb DEFAULT '{}',
  status public.status_alerta NOT NULL DEFAULT 'aberto',
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alertas_clinica_status ON public.alertas_eventos (clinica_id, status);
ALTER TABLE public.alertas_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own alertas" ON public.alertas_eventos FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));
CREATE POLICY "Users can insert own alertas" ON public.alertas_eventos FOR INSERT WITH CHECK (clinica_id = get_user_clinica_id(auth.uid()));
CREATE POLICY "Users can update own alertas" ON public.alertas_eventos FOR UPDATE USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 3) metas_financeiras
CREATE TABLE public.metas_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  competencia date NOT NULL,
  indicador text NOT NULL,
  meta_valor numeric(14,2) NOT NULL DEFAULT 0,
  realizado_valor numeric(14,2) DEFAULT 0,
  unidade text DEFAULT 'R$',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_metas_unique ON public.metas_financeiras (clinica_id, competencia, indicador);
ALTER TABLE public.metas_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own metas" ON public.metas_financeiras FOR ALL USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 4) insights_ia
CREATE TABLE public.insights_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  tipo public.tipo_insight NOT NULL DEFAULT 'analise_completa',
  data_quality_score int DEFAULT 0,
  input_context jsonb DEFAULT '{}',
  output_markdown text,
  acoes_recomendadas jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insights_ia_clinica ON public.insights_ia (clinica_id, created_at DESC);
ALTER TABLE public.insights_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own insights" ON public.insights_ia FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));
CREATE POLICY "Users can insert own insights" ON public.insights_ia FOR INSERT WITH CHECK (clinica_id = get_user_clinica_id(auth.uid()));

-- 5) autopilot_runs
CREATE TABLE public.autopilot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  trigger public.trigger_autopilot NOT NULL DEFAULT 'manual',
  status public.status_autopilot NOT NULL DEFAULT 'em_andamento',
  steps jsonb DEFAULT '[]',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX idx_autopilot_clinica ON public.autopilot_runs (clinica_id, created_at DESC);
ALTER TABLE public.autopilot_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own autopilot_runs" ON public.autopilot_runs FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));
CREATE POLICY "Users can insert own autopilot_runs" ON public.autopilot_runs FOR INSERT WITH CHECK (clinica_id = get_user_clinica_id(auth.uid()));
CREATE POLICY "Users can update own autopilot_runs" ON public.autopilot_runs FOR UPDATE USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 6) autofix_logs
CREATE TABLE public.autofix_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  acao text NOT NULL,
  tipo text NOT NULL DEFAULT 'deterministic',
  entidade_tipo text,
  entidade_id uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_autofix_clinica ON public.autofix_logs (clinica_id, created_at DESC);
ALTER TABLE public.autofix_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own autofix_logs" ON public.autofix_logs FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));
CREATE POLICY "Users can insert own autofix_logs" ON public.autofix_logs FOR INSERT WITH CHECK (clinica_id = get_user_clinica_id(auth.uid()));

-- Trigger for metas updated_at
CREATE TRIGGER update_metas_financeiras_updated_at
  BEFORE UPDATE ON public.metas_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: get_data_quality_score
CREATE OR REPLACE FUNCTION public.get_data_quality_score(_start_date date, _end_date date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _clinica_id uuid;
  _score int := 0;
  _max_score int := 100;
  _checks jsonb := '[]'::jsonb;
  _has_vendas boolean;
  _has_bank boolean;
  _has_getnet boolean;
  _has_contas_pagar boolean;
  _pct_conciliacao numeric;
  _has_taxas boolean;
  _has_convenios boolean;
  _has_custo_fixo boolean;
BEGIN
  _clinica_id := get_user_clinica_id(auth.uid());
  IF _clinica_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  -- Check: vendas/produção (20pts)
  SELECT EXISTS(SELECT 1 FROM transacoes_vendas WHERE clinica_id = _clinica_id AND data_competencia BETWEEN _start_date AND _end_date LIMIT 1) INTO _has_vendas;
  IF _has_vendas THEN _score := _score + 20; END IF;
  _checks := _checks || jsonb_build_object('name', 'Produção/Vendas (Feegow)', 'ok', _has_vendas, 'weight', 20, 'action', 'Sincronizar Feegow para o período');

  -- Check: extrato bancário (20pts)
  SELECT EXISTS(SELECT 1 FROM transacoes_bancarias WHERE clinica_id = _clinica_id AND data_transacao::date BETWEEN _start_date AND _end_date LIMIT 1) INTO _has_bank;
  IF _has_bank THEN _score := _score + 20; END IF;
  _checks := _checks || jsonb_build_object('name', 'Extrato Bancário (OFX)', 'ok', _has_bank, 'weight', 20, 'action', 'Importar extrato OFX do período');

  -- Check: getnet (15pts)
  SELECT EXISTS(SELECT 1 FROM getnet_transacoes WHERE clinica_id = _clinica_id AND data_venda::date BETWEEN _start_date AND _end_date LIMIT 1) INTO _has_getnet;
  IF _has_getnet THEN _score := _score + 15; END IF;
  _checks := _checks || jsonb_build_object('name', 'Getnet (taxas cartão)', 'ok', _has_getnet, 'weight', 15, 'action', 'Importar CSV Getnet do período');

  -- Check: contas a pagar (15pts)
  SELECT EXISTS(SELECT 1 FROM contas_pagar_lancamentos WHERE clinica_id = _clinica_id AND data_competencia BETWEEN _start_date AND _end_date LIMIT 1) INTO _has_contas_pagar;
  IF _has_contas_pagar THEN _score := _score + 15; END IF;
  _checks := _checks || jsonb_build_object('name', 'Contas a Pagar lançadas', 'ok', _has_contas_pagar, 'weight', 15, 'action', 'Lançar contas a pagar do período');

  -- Check: conciliação (15pts)
  SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE status = 'conciliado')::numeric / COUNT(*) * 100, 0) ELSE 0 END
  INTO _pct_conciliacao
  FROM conciliacoes WHERE clinica_id = _clinica_id AND created_at::date BETWEEN _start_date AND _end_date;
  IF _pct_conciliacao >= 80 THEN _score := _score + 15;
  ELSIF _pct_conciliacao >= 50 THEN _score := _score + 8;
  END IF;
  _checks := _checks || jsonb_build_object('name', 'Conciliação bancária', 'ok', _pct_conciliacao >= 80, 'weight', 15, 'value', _pct_conciliacao, 'action', 'Executar conciliação bancária');

  -- Check: taxas configuradas (10pts)
  SELECT EXISTS(SELECT 1 FROM taxas_config WHERE clinica_id = _clinica_id AND ativo = true LIMIT 1) INTO _has_taxas;
  IF _has_taxas THEN _score := _score + 10; END IF;
  _checks := _checks || jsonb_build_object('name', 'Taxas e alíquotas configuradas', 'ok', _has_taxas, 'weight', 10, 'action', 'Configurar taxas em Configurações');

  -- Check: custo fixo (5pts)
  SELECT EXISTS(SELECT 1 FROM custo_fixo_itens WHERE clinica_id = _clinica_id AND ativo = true LIMIT 1) INTO _has_custo_fixo;
  IF _has_custo_fixo THEN _score := _score + 5; END IF;
  _checks := _checks || jsonb_build_object('name', 'Custo fixo cadastrado', 'ok', _has_custo_fixo, 'weight', 5, 'action', 'Cadastrar itens de custo fixo');

  RETURN jsonb_build_object('score', _score, 'max_score', _max_score, 'checks', _checks, 'pct_conciliacao', _pct_conciliacao);
END;
$$;
