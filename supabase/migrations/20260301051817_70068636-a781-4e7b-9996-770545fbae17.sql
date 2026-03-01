
-- Add invoice_id and origem to transacoes_vendas for Feegow financial traceability
ALTER TABLE public.transacoes_vendas
  ADD COLUMN IF NOT EXISTS invoice_id text,
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual';

-- Create index for idempotency lookups
CREATE INDEX IF NOT EXISTS idx_transacoes_vendas_feegow_id ON public.transacoes_vendas (clinica_id, feegow_id) WHERE feegow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transacoes_vendas_invoice_id ON public.transacoes_vendas (clinica_id, invoice_id) WHERE invoice_id IS NOT NULL;

-- Create integracao_logs table for structured observability
CREATE TABLE IF NOT EXISTS public.integracao_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  integracao text NOT NULL, -- 'feegow_metadata', 'feegow_sales', 'getnet', 'ofx'
  endpoint text,
  acao text, -- 'sync_metadata', 'sync_sales', etc.
  status text NOT NULL DEFAULT 'em_andamento', -- 'em_andamento', 'sucesso', 'erro'
  registros_processados integer DEFAULT 0,
  registros_criados integer DEFAULT 0,
  registros_atualizados integer DEFAULT 0,
  registros_ignorados integer DEFAULT 0,
  request_hash text, -- hash of request params for idempotency check
  erros jsonb DEFAULT '[]'::jsonb,
  detalhes jsonb DEFAULT '{}'::jsonb,
  inicio timestamp with time zone NOT NULL DEFAULT now(),
  fim timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.integracao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage integracao_logs"
  ON public.integracao_logs FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view integracao_logs"
  ON public.integracao_logs FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE INDEX idx_integracao_logs_clinica ON public.integracao_logs (clinica_id, integracao, created_at DESC);
