
-- Enum for employee type
CREATE TYPE public.tipo_funcionario AS ENUM ('clt', 'diarista', 'estagiario', 'prestador');

-- Funcionários table
CREATE TABLE public.funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  cargo text NOT NULL,
  tipo tipo_funcionario NOT NULL DEFAULT 'clt',
  salario_bruto numeric(12,2) NOT NULL DEFAULT 0,
  insalubridade numeric(12,2) NOT NULL DEFAULT 0,
  vale_transporte numeric(12,2) NOT NULL DEFAULT 0,
  -- For CLT: auto-calculated
  inss_patronal_pct numeric(5,2) NOT NULL DEFAULT 20,
  fgts_pct numeric(5,2) NOT NULL DEFAULT 8,
  ferias_pct numeric(5,2) NOT NULL DEFAULT 11.11,
  decimo_terceiro_pct numeric(5,2) NOT NULL DEFAULT 8.33,
  -- For diarista
  diarias_semanais numeric(5,2) NOT NULL DEFAULT 0,
  valor_diaria numeric(12,2) NOT NULL DEFAULT 0,
  passagem_dia numeric(12,2) NOT NULL DEFAULT 0,
  semanas_mes integer NOT NULL DEFAULT 4,
  -- For estagiário
  bolsa_mensal numeric(12,2) NOT NULL DEFAULT 0,
  auxilio_transporte numeric(12,2) NOT NULL DEFAULT 0,
  -- For prestador
  valor_mensal_prestador numeric(12,2) NOT NULL DEFAULT 0,
  -- Computed total is done in frontend
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage funcionarios"
  ON public.funcionarios FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view funcionarios"
  ON public.funcionarios FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE TRIGGER update_funcionarios_updated_at
  BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Custo Fixo Itens table (budget items)
CREATE TABLE public.custo_fixo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  codigo_pc text,
  descricao text NOT NULL,
  grupo text NOT NULL,
  valor_mensal numeric(12,2) NOT NULL DEFAULT 0,
  recorrencia text NOT NULL DEFAULT 'mensal',
  observacao text,
  fonte_funcionarios boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custo_fixo_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage custo_fixo_itens"
  ON public.custo_fixo_itens FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view custo_fixo_itens"
  ON public.custo_fixo_itens FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE TRIGGER update_custo_fixo_itens_updated_at
  BEFORE UPDATE ON public.custo_fixo_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
