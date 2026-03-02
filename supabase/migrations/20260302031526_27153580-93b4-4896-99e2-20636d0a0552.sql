
-- Add missing columns to contas_pagar_lancamentos
ALTER TABLE public.contas_pagar_lancamentos
ADD COLUMN IF NOT EXISTS match_score numeric,
ADD COLUMN IF NOT EXISTS match_rule text,
ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- Add rule_applied to conciliacao_despesas
ALTER TABLE public.conciliacao_despesas
ADD COLUMN IF NOT EXISTS rule_applied text;

-- Add unique constraint: one bank transaction can only reconcile one expense
CREATE UNIQUE INDEX IF NOT EXISTS idx_conciliacao_despesas_transacao_unica
ON public.conciliacao_despesas (transacao_bancaria_id)
WHERE transacao_bancaria_id IS NOT NULL AND status = 'conciliado';

-- Add unique constraint: one lancamento can only be reconciled once
CREATE UNIQUE INDEX IF NOT EXISTS idx_conciliacao_despesas_lancamento_unico
ON public.conciliacao_despesas (lancamento_id)
WHERE status = 'conciliado';

-- Add divergente to status_lancamento_cp enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'divergente' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_lancamento_cp')) THEN
    ALTER TYPE public.status_lancamento_cp ADD VALUE 'divergente';
  END IF;
END$$;
