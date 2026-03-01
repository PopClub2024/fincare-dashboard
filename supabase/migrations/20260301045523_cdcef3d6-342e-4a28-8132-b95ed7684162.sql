
-- Add new columns to impostos_devidos for detailed tax tracking
ALTER TABLE public.impostos_devidos
  ADD COLUMN IF NOT EXISTS qtd_parcelas integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS valor_parcela numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT 'boleto',
  ADD COLUMN IF NOT EXISTS dia_vencimento_fixo integer;

-- Add comment for clarity
COMMENT ON COLUMN public.impostos_devidos.forma_pagamento IS 'boleto or debito_automatico';
COMMENT ON COLUMN public.impostos_devidos.dia_vencimento_fixo IS 'Fixed day of month for due date (e.g. 7, 20)';
