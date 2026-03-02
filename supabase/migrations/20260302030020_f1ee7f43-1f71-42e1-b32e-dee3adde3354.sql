
-- Add pendente_conciliacao to status_lancamento_cp enum
ALTER TYPE status_lancamento_cp ADD VALUE IF NOT EXISTS 'pendente_conciliacao';

-- Create conciliacao_despesas table for expense reconciliation tracking
CREATE TABLE IF NOT EXISTS public.conciliacao_despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id),
  lancamento_id UUID NOT NULL REFERENCES public.contas_pagar_lancamentos(id),
  transacao_bancaria_id UUID REFERENCES public.transacoes_bancarias(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliado', 'divergente', 'ignorado')),
  match_key TEXT, -- normalized key for matching: valor|data|fornecedor
  score NUMERIC DEFAULT 0, -- confidence score 0-100
  metodo_match TEXT, -- 'valor_data_exato', 'valor_fuzzy', 'manual', etc.
  divergencia NUMERIC DEFAULT 0, -- value difference
  observacao TEXT,
  conciliado_em TIMESTAMPTZ,
  conciliado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lancamento_id, transacao_bancaria_id)
);

-- Enable RLS
ALTER TABLE public.conciliacao_despesas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own clinic conciliacao_despesas"
  ON public.conciliacao_despesas FOR SELECT
  USING (clinica_id = (SELECT get_user_clinica_id(auth.uid())));

CREATE POLICY "Users can insert own clinic conciliacao_despesas"
  ON public.conciliacao_despesas FOR INSERT
  WITH CHECK (clinica_id = (SELECT get_user_clinica_id(auth.uid())));

CREATE POLICY "Users can update own clinic conciliacao_despesas"
  ON public.conciliacao_despesas FOR UPDATE
  USING (clinica_id = (SELECT get_user_clinica_id(auth.uid())));

-- Service role bypass for edge functions
CREATE POLICY "Service role full access conciliacao_despesas"
  ON public.conciliacao_despesas FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_conciliacao_despesas_updated_at
  BEFORE UPDATE ON public.conciliacao_despesas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_conciliacao_despesas_clinica_status
  ON public.conciliacao_despesas(clinica_id, status);
CREATE INDEX IF NOT EXISTS idx_conciliacao_despesas_match_key
  ON public.conciliacao_despesas(clinica_id, match_key);
