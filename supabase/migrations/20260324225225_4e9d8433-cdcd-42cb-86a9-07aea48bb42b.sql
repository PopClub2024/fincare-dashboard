
-- Drop and recreate views with security_invoker
DROP VIEW IF EXISTS public.api_keys;
DROP VIEW IF EXISTS public.whatsapp_chat_mensagens;
DROP VIEW IF EXISTS public.campanhas_marketing;
DROP VIEW IF EXISTS public.calendario_postagens;
DROP VIEW IF EXISTS public.rag_documentos;

-- Add missing columns to chaves_api
ALTER TABLE public.chaves_api ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo';
ALTER TABLE public.chaves_api ADD COLUMN IF NOT EXISTS ultimo_teste timestamptz;
ALTER TABLE public.chaves_api ADD COLUMN IF NOT EXISTS resultado_teste text;

-- Add missing column to whatsapp_templates
ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS mensagem text;

-- Recreate views with security_invoker
CREATE VIEW public.api_keys WITH (security_invoker = true) AS
  SELECT id, clinica_id, servico, chave_encriptada, ativo, status, ultimo_teste, resultado_teste, created_at, updated_at
  FROM public.chaves_api;

CREATE VIEW public.whatsapp_chat_mensagens WITH (security_invoker = true) AS
  SELECT * FROM public.whatsapp_mensagens;

CREATE VIEW public.campanhas_marketing WITH (security_invoker = true) AS
  SELECT * FROM public.marketing_campanhas;

CREATE VIEW public.calendario_postagens WITH (security_invoker = true) AS
  SELECT * FROM public.marketing_calendario;

CREATE VIEW public.rag_documentos WITH (security_invoker = true) AS
  SELECT id, clinica_id, nome, categoria, arquivo_url, tamanho_bytes, tipo_mime, observacoes, created_at
  FROM public.documentos_upload;

-- Add pacientes extra columns
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS nome_social text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS rg text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS sexo text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS celular text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS convenio_id uuid REFERENCES public.convenios(id);
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS plano text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS carteirinha text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS validade_carteirinha date;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS titular text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS observacoes text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS profissao text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS indicado_por text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS feegow_criado_em text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS feegow_alterado_em text;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS data_retencao date;

-- Add medicos extra columns
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS tratamento text;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS sexo text;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS conselho text;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS documento_conselho text;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS uf_conselho text;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS rqe text;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS especialidades jsonb;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS idade_minima int;
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS idade_maxima int;

-- Add convenios extra columns
ALTER TABLE public.convenios ADD COLUMN IF NOT EXISTS registro_ans text;
ALTER TABLE public.convenios ADD COLUMN IF NOT EXISTS cnpj text;

-- Add procedimentos extra columns
ALTER TABLE public.procedimentos ADD COLUMN IF NOT EXISTS feegow_id text;
ALTER TABLE public.procedimentos ADD COLUMN IF NOT EXISTS codigo_tiss text;
ALTER TABLE public.procedimentos ADD COLUMN IF NOT EXISTS tipo_procedimento text;
ALTER TABLE public.procedimentos ADD COLUMN IF NOT EXISTS valor_particular numeric;
ALTER TABLE public.procedimentos ADD COLUMN IF NOT EXISTS tempo_minutos int DEFAULT 10;
ALTER TABLE public.procedimentos ADD COLUMN IF NOT EXISTS especialidade_ids jsonb DEFAULT '[]';
ALTER TABLE public.procedimentos ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;

-- Add unique constraint on procedimentos.feegow_id if not exists
DO $$ BEGIN
  ALTER TABLE public.procedimentos ADD CONSTRAINT procedimentos_feegow_id_key UNIQUE (feegow_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add unique constraint on pacientes for feegow import
DO $$ BEGIN
  ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_clinica_feegow_id_key UNIQUE (clinica_id, feegow_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-pacientes', 'fotos-pacientes', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('recibos', 'recibos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', true) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DO $$ BEGIN
  CREATE POLICY "Auth upload documentos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Auth read documentos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Auth upload fotos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-pacientes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Auth read fotos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'fotos-pacientes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Auth upload recibos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'recibos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Auth read recibos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'recibos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Auth upload whatsapp" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'whatsapp-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Auth read whatsapp" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'whatsapp-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read exports" ON storage.objects FOR SELECT TO public USING (bucket_id = 'exports');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Auth upload exports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exports');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
