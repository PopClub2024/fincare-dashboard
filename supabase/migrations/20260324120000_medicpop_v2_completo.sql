-- =============================================
-- MEDIC POP v2.0 — MIGRAÇÃO COMPLETA
-- Todas as fases: Base, Prontuário, Comunicação,
-- RH, Estoque, Jurídico, Marketing, NPS, Playbooks
-- =============================================

-- NOVOS ENUMS
DO $$ BEGIN
  CREATE TYPE public.status_agendamento AS ENUM ('agendado','confirmado','nao_confirmado','cancelado','remarcado_paciente','remarcado_profissional','checkin','atendido','faltou');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_pagamento_consulta AS ENUM ('convenio','particular_dinheiro','particular_cartao','particular_pix');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_atendimento AS ENUM ('aguardando','em_atendimento','finalizado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_repasse AS ENUM ('fixo_plantao','variavel_producao');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_guia_tiss AS ENUM ('gerada','lancada_portal','confirmada','glosada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_vinculo AS ENUM ('clt','pj','autonomo','estagiario');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_colaborador AS ENUM ('ativo','ferias','afastado','desligado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.categoria_estoque AS ENUM ('administrativo','medico','asg');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_movimento_estoque AS ENUM ('entrada','saida','ajuste');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_contrato AS ENUM ('vigente','vencido','proximo_vencimento','irregular');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_whatsapp AS ENUM ('confirmacao','lembrete_48h','lembrete_24h','lembrete_3h','recall','pos_venda','aniversario','token','agendamento','cancelamento');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_mensagem AS ENUM ('pendente','enviada','entregue','lida','erro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- FASE 1: BASE OPERACIONAL
-- =============================================

-- Especialidades
CREATE TABLE IF NOT EXISTS public.especialidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  periodo_recall_dias INTEGER DEFAULT 180,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enriquecer tabela de salas/consultórios
ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS equipamentos TEXT[];
ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS especialidade_primaria_id UUID REFERENCES public.especialidades(id);
ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- Enriquecer tabela de pacientes
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS sexo TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS carteirinha TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS origem TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- Índice único no CPF por clínica
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_cpf_clinica ON public.pacientes(clinica_id, cpf) WHERE cpf IS NOT NULL;

-- Agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  especialidade_id UUID REFERENCES public.especialidades(id),
  sala_id UUID REFERENCES public.salas(id),
  procedimento_id UUID REFERENCES public.procedimentos(id),
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER DEFAULT 30,
  status status_agendamento DEFAULT 'agendado',
  tipo_pagamento tipo_pagamento_consulta,
  valor_previsto NUMERIC(12,2),
  motivo_cancelamento TEXT,
  motivo_remarcacao TEXT,
  observacoes TEXT,
  confirmado_por TEXT,
  confirmado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON public.agendamentos(clinica_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_agendamentos_medico ON public.agendamentos(medico_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente ON public.agendamentos(paciente_id);

-- Check-ins
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  hora_checkin TIMESTAMPTZ DEFAULT now(),
  hora_chamada TIMESTAMPTZ,
  hora_inicio_atendimento TIMESTAMPTZ,
  hora_fim_atendimento TIMESTAMPTZ,
  status status_atendimento DEFAULT 'aguardando',
  sala_id UUID REFERENCES public.salas(id),
  tipo_pagamento tipo_pagamento_consulta,
  valor_bruto NUMERIC(12,2),
  desconto NUMERIC(12,2) DEFAULT 0,
  taxa_cartao NUMERIC(12,2) DEFAULT 0,
  imposto NUMERIC(12,2) DEFAULT 0,
  valor_liquido NUMERIC(12,2),
  pago BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sala de espera (view em tempo real)
CREATE TABLE IF NOT EXISTS public.chamadas_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  checkin_id UUID NOT NULL REFERENCES public.checkins(id),
  paciente_nome TEXT NOT NULL,
  consultorio TEXT NOT NULL,
  chamado_em TIMESTAMPTZ DEFAULT now(),
  exibido BOOLEAN DEFAULT false
);

-- =============================================
-- FASE 2: PRONTUÁRIO / ÁREA DO MÉDICO
-- =============================================

-- Anamneses
CREATE TABLE IF NOT EXISTS public.anamneses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  checkin_id UUID REFERENCES public.checkins(id),
  texto_medico TEXT NOT NULL,
  texto_ia TEXT,
  doencas_preexistentes TEXT[] DEFAULT '{}',
  queixa_principal TEXT,
  historico_doenca_atual TEXT,
  exame_fisico TEXT,
  hipotese_diagnostica TEXT,
  cid TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prescrições
CREATE TABLE IF NOT EXISTS public.prescricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  checkin_id UUID REFERENCES public.checkins(id),
  sem_prescricao BOOLEAN DEFAULT false,
  texto_medico TEXT,
  texto_ia TEXT,
  medicamentos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Encaminhamentos
CREATE TABLE IF NOT EXISTS public.encaminhamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  checkin_id UUID REFERENCES public.checkins(id),
  sem_encaminhamento BOOLEAN DEFAULT false,
  texto_medico TEXT,
  texto_ia TEXT,
  especialidade_destino TEXT,
  exames_solicitados JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Laudos
CREATE TABLE IF NOT EXISTS public.laudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  checkin_id UUID REFERENCES public.checkins(id),
  tipo TEXT DEFAULT 'laudo',
  texto_medico TEXT NOT NULL,
  texto_ia TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Atestados
CREATE TABLE IF NOT EXISTS public.atestados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  checkin_id UUID REFERENCES public.checkins(id),
  texto_medico TEXT NOT NULL,
  texto_ia TEXT,
  dias_afastamento INTEGER,
  cid TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Resultados de exames (upload)
CREATE TABLE IF NOT EXISTS public.resultados_exames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  nome_exame TEXT NOT NULL,
  arquivo_url TEXT,
  data_exame DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cronômetro de atendimento
CREATE TABLE IF NOT EXISTS public.cronometro_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES public.checkins(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fim TIMESTAMPTZ,
  pausas JSONB DEFAULT '[]',
  duracao_total_segundos INTEGER
);

-- =============================================
-- FASE 3: COMPLEMENTOS FINANCEIROS
-- =============================================

-- Repasses médicos
CREATE TABLE IF NOT EXISTS public.repasses_medicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  tipo tipo_repasse NOT NULL,
  valor_fixo NUMERIC(12,2),
  valor_por_atendimento NUMERIC(12,2),
  percentual_particular NUMERIC(5,2),
  percentual_convenio NUMERIC(5,2),
  especialidade_id UUID REFERENCES public.especialidades(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recibos médicos
CREATE TABLE IF NOT EXISTS public.recibos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  checkin_id UUID REFERENCES public.checkins(id),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  valor NUMERIC(12,2) NOT NULL,
  procedimento TEXT,
  assinatura_digital_url TEXT,
  arquivo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notas fiscais
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  checkin_id UUID REFERENCES public.checkins(id),
  paciente_id UUID REFERENCES public.pacientes(id),
  numero_nf TEXT,
  valor NUMERIC(12,2),
  status TEXT DEFAULT 'pendente',
  xml_url TEXT,
  pdf_url TEXT,
  api_response JSONB,
  emitida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- FASE 4: COMUNICAÇÃO WHATSAPP
-- =============================================

-- Templates de mensagem
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  tipo tipo_whatsapp NOT NULL,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  imagem_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Mensagens enviadas
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES public.pacientes(id),
  template_id UUID REFERENCES public.whatsapp_templates(id),
  tipo tipo_whatsapp NOT NULL,
  telefone TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status status_mensagem DEFAULT 'pendente',
  resposta_paciente TEXT,
  agendamento_id UUID REFERENCES public.agendamentos(id),
  api_message_id TEXT,
  erro TEXT,
  enviada_em TIMESTAMPTZ,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tokens de convênio (solicitados via WhatsApp)
CREATE TABLE IF NOT EXISTS public.tokens_convenio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  agendamento_id UUID REFERENCES public.agendamentos(id),
  token TEXT,
  solicitado_em TIMESTAMPTZ DEFAULT now(),
  recebido_em TIMESTAMPTZ,
  mensagem_id UUID REFERENCES public.whatsapp_mensagens(id),
  status TEXT DEFAULT 'solicitado'
);

-- =============================================
-- FASE 5: NPS E SATISFAÇÃO
-- =============================================

CREATE TABLE IF NOT EXISTS public.nps_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID REFERENCES public.medicos(id),
  checkin_id UUID REFERENCES public.checkins(id),
  nota INTEGER NOT NULL CHECK (nota >= 0 AND nota <= 10),
  comentario TEXT,
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- FASE 6: RECURSOS HUMANOS
-- =============================================

-- Colaboradores (complementa funcionarios existente)
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  medico_id UUID REFERENCES public.medicos(id),
  nome TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  cargo TEXT,
  area TEXT,
  data_admissao DATE,
  tipo_vinculo tipo_vinculo DEFAULT 'clt',
  salario NUMERIC(12,2),
  status status_colaborador DEFAULT 'ativo',
  foto_url TEXT,
  crm TEXT,
  rqe TEXT,
  especialidades TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documentos RH
CREATE TABLE IF NOT EXISTS public.documentos_rh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nome TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  data_validade DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Escalas
CREATE TABLE IF NOT EXISTS public.escalas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
  dia_semana INTEGER,
  data_especifica DATE,
  turno TEXT,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  tipo TEXT DEFAULT 'regular',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Registro de ponto
CREATE TABLE IF NOT EXISTS public.registros_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
  tipo TEXT NOT NULL,
  data_hora TIMESTAMPTZ DEFAULT now(),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  dentro_perimetro BOOLEAN,
  foto_url TEXT,
  observacoes TEXT
);

-- Férias
CREATE TABLE IF NOT EXISTS public.ferias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
  periodo_aquisitivo_inicio DATE NOT NULL,
  periodo_aquisitivo_fim DATE NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  dias INTEGER,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- FASE 7: ESTOQUE
-- =============================================

CREATE TABLE IF NOT EXISTS public.estoque_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria categoria_estoque NOT NULL,
  subcategoria TEXT,
  fabricante TEXT,
  lote TEXT,
  validade DATE,
  quantidade_atual INTEGER DEFAULT 0,
  quantidade_minima INTEGER DEFAULT 5,
  valor_unitario NUMERIC(12,2),
  nf_referencia TEXT,
  especialidade_id UUID REFERENCES public.especialidades(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estoque_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  tipo tipo_movimento_estoque NOT NULL,
  quantidade INTEGER NOT NULL,
  motivo TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- FASE 7: ADMINISTRATIVO-JURÍDICO
-- =============================================

CREATE TABLE IF NOT EXISTS public.contratos_prestadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  medico_id UUID REFERENCES public.medicos(id),
  nome_prestador TEXT NOT NULL,
  cnpj TEXT,
  tipo TEXT,
  data_assinatura DATE,
  data_vigencia DATE,
  data_renovacao DATE,
  valor NUMERIC(12,2),
  arquivo_url TEXT,
  status status_contrato DEFAULT 'vigente',
  documentos JSONB DEFAULT '[]',
  aditivos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Playbooks (POP)
CREATE TABLE IF NOT EXISTS public.playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  area TEXT NOT NULL,
  perfil TEXT,
  conteudo TEXT NOT NULL,
  versao INTEGER DEFAULT 1,
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- FASE 8: GUIAS TISS (SEM API)
-- =============================================

CREATE TABLE IF NOT EXISTS public.guias_tiss (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  convenio_id UUID REFERENCES public.convenios(id),
  agendamento_id UUID REFERENCES public.agendamentos(id),
  tipo TEXT DEFAULT 'consulta',
  codigo_procedimento TEXT,
  numero_carteirinha TEXT,
  crm_medico TEXT,
  token TEXT,
  numero_guia TEXT,
  dados_preenchidos JSONB DEFAULT '{}',
  status status_guia_tiss DEFAULT 'gerada',
  checklist JSONB DEFAULT '[]',
  arquivo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- FASE 9: MARKETING
-- =============================================

CREATE TABLE IF NOT EXISTS public.campanhas_marketing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  canal TEXT,
  plataforma TEXT,
  orcamento NUMERIC(12,2),
  data_inicio DATE,
  data_fim DATE,
  impressoes INTEGER DEFAULT 0,
  cliques INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  agendamentos_convertidos INTEGER DEFAULT 0,
  custo_por_lead NUMERIC(12,2),
  roi NUMERIC(8,2),
  status TEXT DEFAULT 'ativa',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.criativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID REFERENCES public.campanhas_marketing(id) ON DELETE CASCADE,
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  titulo TEXT,
  copy_texto TEXT,
  cta TEXT,
  imagem_url TEXT,
  performance_score NUMERIC(5,2),
  impressoes INTEGER DEFAULT 0,
  cliques INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendario_postagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_publicacao DATE NOT NULL,
  hora_publicacao TIME,
  rede_social TEXT,
  tipo TEXT,
  conteudo TEXT,
  imagem_url TEXT,
  publicado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CONFIGURAÇÕES DO SISTEMA
-- =============================================

CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  valor JSONB NOT NULL,
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinica_id, chave)
);

-- Chaves de API
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  servico TEXT NOT NULL,
  chave_encriptada TEXT NOT NULL,
  status TEXT DEFAULT 'ativa',
  data_expiracao TIMESTAMPTZ,
  ultimo_teste TIMESTAMPTZ,
  resultado_teste TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agentes de IA
CREATE TABLE IF NOT EXISTS public.agentes_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  modelo TEXT DEFAULT 'claude-sonnet-4-6',
  prompt_sistema TEXT,
  temperatura NUMERIC(3,2) DEFAULT 0.7,
  limite_tokens INTEGER DEFAULT 4096,
  limite_gasto_mensal NUMERIC(12,2),
  gasto_atual_mes NUMERIC(12,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  total_chamadas INTEGER DEFAULT 0,
  total_tokens_consumidos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Log de interações com IA
CREATE TABLE IF NOT EXISTS public.ia_interacoes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  agente_id UUID REFERENCES public.agentes_ia(id),
  usuario_id UUID REFERENCES auth.users(id),
  tipo TEXT,
  input_resumo TEXT,
  output_resumo TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  custo_estimado NUMERIC(8,4),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ATUALIZAR PERFIS DE ACESSO (app_role)
-- =============================================
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'medico';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'recepcao';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketing';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rh';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisao';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'atendimento';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- RLS BÁSICO PARA NOVAS TABELAS
-- =============================================

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encaminhamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanhas_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guias_tiss ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_prestadores ENABLE ROW LEVEL SECURITY;

-- Políticas genéricas por clinica_id para todas as novas tabelas
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'agendamentos','checkins','anamneses','prescricoes','encaminhamentos',
    'laudos','atestados','especialidades','colaboradores','estoque_itens',
    'whatsapp_mensagens','nps_respostas','campanhas_marketing','guias_tiss',
    'playbooks','contratos_prestadores','chamadas_paciente','whatsapp_templates',
    'tokens_convenio','recibos','notas_fiscais','repasses_medicos',
    'documentos_rh','escalas','registros_ponto','criativos',
    'calendario_postagens','configuracoes_sistema','api_keys','agentes_ia',
    'ia_interacoes_log','resultados_exames','estoque_movimentos','cronometro_atendimento'
  ] LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "clinica_isolation_%s" ON public.%I FOR ALL USING (
          CASE
            WHEN %I ? ''clinica_id'' THEN
              (SELECT clinica_id FROM public.usuarios WHERE user_id = auth.uid()) = clinica_id
            ELSE true
          END
        )',
        tbl, tbl, tbl
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Política simplificada para tabelas sem clinica_id direto
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ferias','estoque_movimentos','cronometro_atendimento','documentos_rh'] LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "authenticated_access_%s" ON public.%I FOR ALL TO authenticated USING (true)',
        tbl, tbl
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
