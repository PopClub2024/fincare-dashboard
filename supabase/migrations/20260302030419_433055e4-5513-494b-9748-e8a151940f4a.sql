
-- Add tipo_despesa_raw for storing AI raw output
ALTER TABLE public.contas_pagar_lancamentos
ADD COLUMN IF NOT EXISTS tipo_despesa_raw text;

-- Add arquivo_hash to comprovantes for idempotency
ALTER TABLE public.comprovantes
ADD COLUMN IF NOT EXISTS arquivo_hash text;

-- Create index for idempotency lookups
CREATE INDEX IF NOT EXISTS idx_comprovantes_hash_clinica
ON public.comprovantes (arquivo_hash, clinica_id)
WHERE arquivo_hash IS NOT NULL;
