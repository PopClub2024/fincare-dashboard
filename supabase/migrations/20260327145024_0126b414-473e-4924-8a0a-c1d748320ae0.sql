
-- Marketing creatives (AI-generated images)
CREATE TABLE public.marketing_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prompt TEXT,
  image_url TEXT,
  formato TEXT DEFAULT 'square',
  plataforma TEXT DEFAULT 'meta',
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing swipe files (copy library)
CREATE TABLE public.marketing_swipe_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  plataforma TEXT,
  tipo TEXT,
  tags TEXT[],
  favorito BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing copy formulas
CREATE TABLE public.marketing_copy_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  template TEXT NOT NULL,
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing A/B tests
CREATE TABLE public.marketing_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  campanha_id UUID,
  metrica_principal TEXT DEFAULT 'ctr',
  status TEXT DEFAULT 'rascunho',
  resultado TEXT,
  analise_ia TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- A/B test variants
CREATE TABLE public.marketing_ab_test_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teste_id UUID NOT NULL REFERENCES public.marketing_ab_tests(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  impressoes INTEGER DEFAULT 0,
  cliques INTEGER DEFAULT 0,
  conversoes INTEGER DEFAULT 0,
  gasto NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing automation rules
CREATE TABLE public.marketing_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  condicao_campo TEXT NOT NULL,
  condicao_operador TEXT NOT NULL,
  condicao_valor NUMERIC,
  acao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ultima_execucao TIMESTAMPTZ,
  execucoes_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing rule execution log
CREATE TABLE public.marketing_rule_execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.marketing_automation_rules(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  campanha_id UUID,
  acao_executada TEXT,
  resultado TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing report templates
CREATE TABLE public.marketing_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  secoes JSONB DEFAULT '[]',
  agendamento TEXT,
  ultimo_envio TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing report history
CREATE TABLE public.marketing_historico_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.marketing_report_templates(id),
  conteudo_json JSONB,
  enviado_para TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.marketing_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_swipe_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_copy_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_rule_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_historico_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_creatives_policy" ON public.marketing_creatives FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()));

CREATE POLICY "mkt_swipe_policy" ON public.marketing_swipe_files FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()));

CREATE POLICY "mkt_formulas_policy" ON public.marketing_copy_formulas FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()));

CREATE POLICY "mkt_ab_tests_policy" ON public.marketing_ab_tests FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()));

CREATE POLICY "mkt_ab_variants_policy" ON public.marketing_ab_test_variants FOR ALL TO authenticated
  USING (teste_id IN (SELECT id FROM public.marketing_ab_tests WHERE clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid())))
  WITH CHECK (teste_id IN (SELECT id FROM public.marketing_ab_tests WHERE clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid())));

CREATE POLICY "mkt_rules_policy" ON public.marketing_automation_rules FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()));

CREATE POLICY "mkt_rule_log_policy" ON public.marketing_rule_execution_log FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()));

CREATE POLICY "mkt_report_templates_policy" ON public.marketing_report_templates FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()));

CREATE POLICY "mkt_report_history_policy" ON public.marketing_historico_reports FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()));
