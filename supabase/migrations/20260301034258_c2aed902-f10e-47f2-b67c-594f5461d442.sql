
-- Tabela de DRE histórico mensal (dados importados de planilhas)
CREATE TABLE public.dre_historico_mensal (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  rt numeric NOT NULL DEFAULT 0,
  impostos numeric NOT NULL DEFAULT 0,
  taxa_cartao numeric NOT NULL DEFAULT 0,
  repasses numeric NOT NULL DEFAULT 0,
  mc numeric NOT NULL DEFAULT 0,
  mc_pct numeric NOT NULL DEFAULT 0,
  cf numeric NOT NULL DEFAULT 0,
  resultado numeric NOT NULL DEFAULT 0,
  resultado_pct numeric NOT NULL DEFAULT 0,
  regime_tributario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, ano, mes)
);

ALTER TABLE public.dre_historico_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage dre_historico"
  ON public.dre_historico_mensal FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view dre_historico"
  ON public.dre_historico_mensal FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- Tabela de receita por canal mensal
CREATE TABLE public.receita_canal_mensal (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  canal text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, ano, mes, canal)
);

ALTER TABLE public.receita_canal_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage receita_canal"
  ON public.receita_canal_mensal FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view receita_canal"
  ON public.receita_canal_mensal FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));
