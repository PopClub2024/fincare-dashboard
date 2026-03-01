
-- Add unique constraint for integracoes upsert
ALTER TABLE public.integracoes ADD CONSTRAINT integracoes_clinica_tipo_unique UNIQUE (clinica_id, tipo);
