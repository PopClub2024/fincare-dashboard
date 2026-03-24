
-- RAG ENGINE TABLES
CREATE TABLE IF NOT EXISTS public.rag_knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  descricao text,
  tipo text DEFAULT 'documentos',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_knowledge_bases ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  knowledge_base_id uuid REFERENCES public.rag_knowledge_bases(id),
  conteudo text NOT NULL,
  metadata jsonb DEFAULT '{}',
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rag_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  query_hash text NOT NULL,
  resposta text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);
ALTER TABLE public.rag_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rag_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  user_id uuid,
  titulo text,
  mensagens jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_conversations ENABLE ROW LEVEL SECURITY;

-- DOCUMENTOS UPLOAD
CREATE TABLE IF NOT EXISTS public.documentos_upload (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome text NOT NULL,
  categoria text DEFAULT 'outros',
  arquivo_url text,
  tamanho_bytes bigint,
  tipo_mime text,
  paciente_id uuid REFERENCES public.pacientes(id),
  funcionario_id uuid REFERENCES public.funcionarios(id),
  contrato_id uuid REFERENCES public.contratos_prestadores(id),
  uploaded_by uuid,
  observacoes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.documentos_upload ENABLE ROW LEVEL SECURITY;

-- CHECKINS
CREATE TABLE IF NOT EXISTS public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  medico_id uuid REFERENCES public.medicos(id),
  hora_chegada timestamptz DEFAULT now(),
  hora_chamada timestamptz,
  hora_inicio_atendimento timestamptz,
  hora_fim_atendimento timestamptz,
  status text DEFAULT 'aguardando',
  sala_id uuid REFERENCES public.salas_consultorios(id),
  observacao text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- CONTA_PACIENTE
CREATE TABLE IF NOT EXISTS public.conta_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  desconto numeric DEFAULT 0,
  valor_final numeric GENERATED ALWAYS AS (valor - desconto) STORED,
  forma_pagamento text,
  status text DEFAULT 'pendente',
  pago_em timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.conta_paciente ENABLE ROW LEVEL SECURITY;

-- GUIAS_TISS
CREATE TABLE IF NOT EXISTS public.guias_tiss (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  convenio_id uuid REFERENCES public.convenios(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  medico_id uuid REFERENCES public.medicos(id),
  tipo_guia text DEFAULT 'consulta',
  numero_guia text,
  senha_autorizacao text,
  status text DEFAULT 'rascunho',
  procedimentos jsonb DEFAULT '[]',
  valor_total numeric DEFAULT 0,
  data_emissao date DEFAULT CURRENT_DATE,
  data_autorizacao date,
  observacoes text,
  xml_tiss text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.guias_tiss ENABLE ROW LEVEL SECURITY;

-- LOTES_FATURAMENTO
CREATE TABLE IF NOT EXISTS public.lotes_faturamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  convenio_id uuid REFERENCES public.convenios(id),
  competencia text NOT NULL,
  numero_lote text,
  status text DEFAULT 'aberto',
  quantidade_guias int DEFAULT 0,
  valor_total numeric DEFAULT 0,
  data_envio date,
  data_resposta date,
  xml_lote text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.lotes_faturamento ENABLE ROW LEVEL SECURITY;

-- RECIBOS
CREATE TABLE IF NOT EXISTS public.recibos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  medico_id uuid REFERENCES public.medicos(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  tipo text DEFAULT 'paciente',
  numero text,
  valor numeric NOT NULL DEFAULT 0,
  descricao text,
  data_emissao date DEFAULT CURRENT_DATE,
  conteudo_editavel text,
  assinatura_url text,
  status text DEFAULT 'emitido',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;

-- ANAMNESES
CREATE TABLE IF NOT EXISTS public.anamneses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  medico_id uuid REFERENCES public.medicos(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  queixa_principal text,
  historia_doenca text,
  antecedentes text,
  medicamentos text,
  alergias text,
  exame_fisico text,
  hipotese_diagnostica text,
  conduta text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;

-- PRESCRICOES
CREATE TABLE IF NOT EXISTS public.prescricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  medico_id uuid REFERENCES public.medicos(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  itens jsonb DEFAULT '[]',
  observacoes text,
  status text DEFAULT 'emitida',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.prescricoes ENABLE ROW LEVEL SECURITY;

-- ENCAMINHAMENTOS
CREATE TABLE IF NOT EXISTS public.encaminhamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  medico_id uuid REFERENCES public.medicos(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  especialidade_destino text,
  motivo text,
  observacoes text,
  status text DEFAULT 'emitido',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.encaminhamentos ENABLE ROW LEVEL SECURITY;

-- LAUDOS
CREATE TABLE IF NOT EXISTS public.laudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  medico_id uuid REFERENCES public.medicos(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  tipo text,
  conteudo text,
  conclusao text,
  status text DEFAULT 'rascunho',
  assinado_em timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.laudos ENABLE ROW LEVEL SECURITY;

-- ATESTADOS
CREATE TABLE IF NOT EXISTS public.atestados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  medico_id uuid REFERENCES public.medicos(id),
  agendamento_id uuid REFERENCES public.agendamentos(id),
  tipo text DEFAULT 'medico',
  dias_afastamento int,
  cid text,
  conteudo text,
  data_emissao date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;

-- RESULTADOS_EXAMES
CREATE TABLE IF NOT EXISTS public.resultados_exames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  medico_id uuid REFERENCES public.medicos(id),
  tipo_exame text,
  resultado text,
  arquivo_url text,
  data_exame date,
  observacoes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.resultados_exames ENABLE ROW LEVEL SECURITY;

-- CRONOMETRO_ATENDIMENTO
CREATE TABLE IF NOT EXISTS public.cronometro_atendimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  checkin_id uuid REFERENCES public.checkins(id),
  medico_id uuid REFERENCES public.medicos(id),
  paciente_id uuid REFERENCES public.pacientes(id),
  inicio timestamptz DEFAULT now(),
  fim timestamptz,
  duracao_segundos int,
  status text DEFAULT 'em_andamento',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.cronometro_atendimento ENABLE ROW LEVEL SECURITY;

-- TIMELINE_PACIENTE
CREATE TABLE IF NOT EXISTS public.timeline_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id),
  tipo text NOT NULL,
  titulo text,
  descricao text,
  metadata jsonb DEFAULT '{}',
  referencia_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.timeline_paciente ENABLE ROW LEVEL SECURITY;

-- RLS for all new tables
CREATE POLICY "clinic_rag_knowledge_bases" ON public.rag_knowledge_bases FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_rag_chunks" ON public.rag_chunks FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_rag_cache" ON public.rag_cache FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_rag_conversations" ON public.rag_conversations FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_documentos_upload" ON public.documentos_upload FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_checkins" ON public.checkins FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_conta_paciente" ON public.conta_paciente FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_guias_tiss" ON public.guias_tiss FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_lotes_faturamento" ON public.lotes_faturamento FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_recibos" ON public.recibos FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_anamneses" ON public.anamneses FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_prescricoes" ON public.prescricoes FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_encaminhamentos" ON public.encaminhamentos FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_laudos" ON public.laudos FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_atestados" ON public.atestados FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_resultados_exames" ON public.resultados_exames FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_cronometro_atendimento" ON public.cronometro_atendimento FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "clinic_timeline_paciente" ON public.timeline_paciente FOR ALL TO authenticated USING (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1)) WITH CHECK (clinica_id = (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1));
