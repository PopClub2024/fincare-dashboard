
-- 1. Add ref_dia_trabalhado column to contas_pagar_lancamentos
ALTER TABLE public.contas_pagar_lancamentos
ADD COLUMN IF NOT EXISTS ref_dia_trabalhado date;

-- 2. Add medico_id column to contas_pagar_lancamentos for repasse reference
ALTER TABLE public.contas_pagar_lancamentos
ADD COLUMN IF NOT EXISTS medico_id uuid REFERENCES public.medicos(id);

-- 3. Create validation trigger: if plano_contas is "REPASSE MÉDICO" (code 19.1), ref_dia_trabalhado must not be null
CREATE OR REPLACE FUNCTION public.validate_repasse_medico()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _is_repasse boolean := false;
BEGIN
  -- Check if plano_contas is "MÃO DE OBRA MÉDICA E TERAPÊUTICA" (code 19.1 / codigo 83)
  IF NEW.plano_contas_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.plano_contas
      WHERE id = NEW.plano_contas_id
      AND codigo_estruturado = '19.1'
    ) INTO _is_repasse;
  END IF;

  IF _is_repasse AND NEW.ref_dia_trabalhado IS NULL THEN
    RAISE EXCEPTION 'Repasse médico (plano 19.1) exige ref_dia_trabalhado preenchido';
  END IF;

  -- Auto-set data_competencia = ref_dia_trabalhado for repasses
  IF _is_repasse AND NEW.ref_dia_trabalhado IS NOT NULL THEN
    NEW.data_competencia := NEW.ref_dia_trabalhado;
    -- Ensure description contains reference
    IF NEW.descricao IS NULL OR NEW.descricao NOT LIKE '%ref:%' THEN
      NEW.descricao := COALESCE(NEW.descricao, 'Repasse médico') || ' ref:' || NEW.ref_dia_trabalhado::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_repasse_medico
BEFORE INSERT OR UPDATE ON public.contas_pagar_lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.validate_repasse_medico();

-- 4. Create feegow_sync_runs table for month-level orchestration tracking
CREATE TABLE IF NOT EXISTS public.feegow_sync_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  year integer NOT NULL,
  month integer NOT NULL,
  status text NOT NULL DEFAULT 'em_andamento',
  healthcheck_ok boolean,
  sync_invoices_ok boolean,
  validate_sales_ok boolean,
  totals jsonb DEFAULT '{}'::jsonb,
  errors jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE(clinica_id, year, month)
);

ALTER TABLE public.feegow_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage sync_runs"
ON public.feegow_sync_runs FOR ALL
USING (
  clinica_id = get_user_clinica_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
);

CREATE POLICY "Clinic users view sync_runs"
ON public.feegow_sync_runs FOR SELECT
USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 5. Create import_runs table for file import tracking (Make.com + manual)
CREATE TABLE IF NOT EXISTS public.import_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo text NOT NULL, -- 'banco_ofx', 'banco_csv', 'getnet_cartao', 'getnet_pix', 'repasse_medico'
  origem text NOT NULL DEFAULT 'manual', -- 'manual', 'make', 'webhook'
  arquivo_nome text,
  arquivo_hash text, -- SHA-256 for idempotency
  periodo_inicio date,
  periodo_fim date,
  status text NOT NULL DEFAULT 'em_andamento',
  registros_total integer DEFAULT 0,
  registros_criados integer DEFAULT 0,
  registros_atualizados integer DEFAULT 0,
  registros_ignorados integer DEFAULT 0,
  registros_rejeitados integer DEFAULT 0,
  erros jsonb DEFAULT '[]'::jsonb,
  detalhes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE(clinica_id, arquivo_hash)
);

ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage import_runs"
ON public.import_runs FOR ALL
USING (
  clinica_id = get_user_clinica_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
);

CREATE POLICY "Clinic users view import_runs"
ON public.import_runs FOR SELECT
USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 6. Ensure dre_mapeamento_contas has repasses_medicos mapping for code 19.1
-- (This is a data operation but safe as idempotent)
