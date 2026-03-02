
-- Add origem_dado enum
DO $$ BEGIN
  CREATE TYPE public.origem_dado_cr AS ENUM ('feegow_caixa', 'feegow_invoice', 'getnet_vendas', 'banco_credito', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to contas_receber_agregado
ALTER TABLE public.contas_receber_agregado
  ADD COLUMN IF NOT EXISTS origem_dado public.origem_dado_cr DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS referencias_json jsonb DEFAULT '{}';

-- Add unique index for idempotency (clinica_id, competencia, data_base, meio, bandeira, origem_dado)
-- First drop if exists to avoid conflicts
DROP INDEX IF EXISTS idx_cr_agregado_unique;
CREATE UNIQUE INDEX idx_cr_agregado_unique
  ON public.contas_receber_agregado (clinica_id, competencia, data_base, meio, COALESCE(bandeira, ''), COALESCE(origem_dado, 'manual'));

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_cr_agregado_status ON public.contas_receber_agregado (clinica_id, status);
CREATE INDEX IF NOT EXISTS idx_cr_agregado_competencia ON public.contas_receber_agregado (clinica_id, competencia, data_base);

-- Extend meio_recebimento enum with missing values
DO $$ BEGIN
  ALTER TYPE public.meio_recebimento ADD VALUE IF NOT EXISTS 'boleto';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.meio_recebimento ADD VALUE IF NOT EXISTS 'transferencia';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.meio_recebimento ADD VALUE IF NOT EXISTS 'outros';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
