
-- WHATSAPP CONVERSAS & MESSAGING
CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  telefone text NOT NULL,
  nome_contato text,
  status text DEFAULT 'aberta',
  ultima_mensagem text,
  ultima_mensagem_em timestamptz,
  atendente_id uuid,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  conversa_id uuid REFERENCES public.whatsapp_conversas(id),
  direcao text NOT NULL CHECK (direcao IN ('entrada','saida')),
  tipo text DEFAULT 'texto',
  conteudo text,
  media_url text,
  status text DEFAULT 'enviada',
  wamid text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

-- Alias view for whatsapp_chat_mensagens
CREATE OR REPLACE VIEW public.whatsapp_chat_mensagens AS
  SELECT * FROM public.whatsapp_mensagens;

CREATE TABLE IF NOT EXISTS public.whatsapp_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  cor text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinica_id, nome)
);
ALTER TABLE public.whatsapp_tags ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.whatsapp_respostas_prontas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  categoria text,
  atalho text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_respostas_prontas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.whatsapp_fila_humano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  conversa_id uuid REFERENCES public.whatsapp_conversas(id),
  motivo text,
  prioridade int DEFAULT 0,
  status text DEFAULT 'aguardando',
  atendente_id uuid,
  atendido_em timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_fila_humano ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.whatsapp_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  template_id uuid REFERENCES public.whatsapp_templates(id),
  status text DEFAULT 'rascunho',
  destinatarios jsonb DEFAULT '[]',
  enviados int DEFAULT 0,
  entregues int DEFAULT 0,
  lidos int DEFAULT 0,
  agendado_para timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_campanhas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.whatsapp_pipeline_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  conversa_id uuid REFERENCES public.whatsapp_conversas(id),
  etapa text DEFAULT 'novo',
  valor_estimado numeric DEFAULT 0,
  procedimento_interesse text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_pipeline_contatos ENABLE ROW LEVEL SECURITY;

-- CONTRATO_DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.contrato_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  contrato_id uuid REFERENCES public.contratos_prestadores(id),
  nome text NOT NULL,
  arquivo_url text,
  tipo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.contrato_documentos ENABLE ROW LEVEL SECURITY;

-- COLABORADORES (alias for funcionarios or separate table for RH)
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  cargo text,
  departamento text,
  data_admissao date,
  data_demissao date,
  salario numeric,
  tipo_contrato text DEFAULT 'clt',
  cpf text,
  email text,
  telefone text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.colaborador_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  colaborador_id uuid REFERENCES public.colaboradores(id),
  nome text NOT NULL,
  arquivo_url text,
  tipo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.colaborador_documentos ENABLE ROW LEVEL SECURITY;

-- NPS_RESPOSTAS (alias or separate for NPS page)
CREATE TABLE IF NOT EXISTS public.nps_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  nota int CHECK (nota BETWEEN 0 AND 10),
  comentario text,
  canal text DEFAULT 'whatsapp',
  medico_id uuid REFERENCES public.medicos(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.nps_respostas ENABLE ROW LEVEL SECURITY;

-- CAMPANHAS_MARKETING (alias view)
CREATE OR REPLACE VIEW public.campanhas_marketing AS
  SELECT * FROM public.marketing_campanhas;

-- CALENDARIO_POSTAGENS (alias view)
CREATE OR REPLACE VIEW public.calendario_postagens AS
  SELECT * FROM public.marketing_calendario;

-- PESSOAS
CREATE TABLE IF NOT EXISTS public.pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  tipo text DEFAULT 'fornecedor',
  cpf_cnpj text,
  email text,
  telefone text,
  endereco text,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;

-- RAG_DOCUMENTOS (alias view for knowledge bases documents)
CREATE OR REPLACE VIEW public.rag_documentos AS
  SELECT id, clinica_id, nome, categoria, arquivo_url, tamanho_bytes, tipo_mime, observacoes, created_at
  FROM public.documentos_upload;

-- API_KEYS (alias view for chaves_api)
CREATE OR REPLACE VIEW public.api_keys AS
  SELECT id, clinica_id, servico, chave_encriptada, ativo, created_at, updated_at
  FROM public.chaves_api;

-- RLS policies for new tables
CREATE POLICY "clinic_whatsapp_conversas" ON public.whatsapp_conversas FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_whatsapp_mensagens" ON public.whatsapp_mensagens FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_whatsapp_tags" ON public.whatsapp_tags FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_whatsapp_respostas_prontas" ON public.whatsapp_respostas_prontas FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_whatsapp_fila_humano" ON public.whatsapp_fila_humano FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_whatsapp_campanhas" ON public.whatsapp_campanhas FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_whatsapp_pipeline_contatos" ON public.whatsapp_pipeline_contatos FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_contrato_documentos" ON public.contrato_documentos FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_colaboradores" ON public.colaboradores FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_colaborador_documentos" ON public.colaborador_documentos FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_nps_respostas" ON public.nps_respostas FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_pessoas" ON public.pessoas FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
