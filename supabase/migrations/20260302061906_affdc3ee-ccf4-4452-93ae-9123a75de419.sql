
-- Add competencia_referencia to track which month a payment refers to
ALTER TABLE public.contas_pagar_lancamentos 
ADD COLUMN IF NOT EXISTS competencia_referencia date NULL;

COMMENT ON COLUMN public.contas_pagar_lancamentos.competencia_referencia IS 'Mês de competência do serviço (ex: pagamento em março referente a fevereiro)';
