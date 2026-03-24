-- =============================================
-- TABELAS DE DOCUMENTOS PARA UPLOADS
-- Contratos, RH, Pacientes (exames)
-- =============================================

-- Documentos de contratos de prestadores
CREATE TABLE IF NOT EXISTS public.contrato_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos_prestadores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT, -- mime type
  url TEXT NOT NULL,
  tamanho INTEGER,
  categoria TEXT, -- contrato, aditivo, cnpj, crm, seguro_rc, certificado
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contrato_docs ON public.contrato_documentos(contrato_id);

-- Documentos de colaboradores (RH)
CREATE TABLE IF NOT EXISTS public.colaborador_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  url TEXT NOT NULL,
  tamanho INTEGER,
  categoria TEXT, -- contrato, rg, cpf, ctps, aso, certificado, diploma, crm, seguro_rc
  data_vencimento DATE, -- para alertas de vencimento
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_colab_docs ON public.colaborador_documentos(colaborador_id);

-- Garantir que a coluna arquivo_hash existe em comprovantes
ALTER TABLE public.comprovantes ADD COLUMN IF NOT EXISTS arquivo_hash TEXT;
ALTER TABLE public.comprovantes ADD COLUMN IF NOT EXISTS erro_processamento TEXT;
CREATE INDEX IF NOT EXISTS idx_comprovantes_hash ON public.comprovantes(clinica_id, arquivo_hash);
