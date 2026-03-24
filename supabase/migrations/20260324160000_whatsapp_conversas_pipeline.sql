-- =============================================
-- WHATSAPP: Conversas, Pipeline, Tags, Atendimento Humano
-- Transcrição de áudio, banco de respostas prontas
-- =============================================

-- Etapas do pipeline
DO $$ BEGIN
  CREATE TYPE public.pipeline_etapa AS ENUM (
    'novo_contato',
    'primeiro_contato',
    'interessado',
    'agendamento_pendente',
    'agendado',
    'confirmado',
    'atendido',
    'pos_atendimento',
    'retorno_pendente',
    'cancelou',
    'faltou',
    'so_conhecendo',
    'inativo',
    'perdido'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.conversa_atendimento AS ENUM ('ia','humano','fila_espera','finalizada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Conversas (thread por contato)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES public.pacientes(id),
  telefone TEXT NOT NULL,
  nome_contato TEXT,
  foto_url TEXT,
  pipeline_etapa pipeline_etapa DEFAULT 'novo_contato',
  atendimento conversa_atendimento DEFAULT 'ia',
  atendente_id UUID REFERENCES auth.users(id), -- humano atribuído
  ultima_mensagem TEXT,
  ultima_mensagem_em TIMESTAMPTZ,
  nao_lidas INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}', -- dados extras (origem, campanha, etc)
  arquivada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversas_tel
  ON public.whatsapp_conversas(clinica_id, telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_pipeline
  ON public.whatsapp_conversas(clinica_id, pipeline_etapa);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_atendimento
  ON public.whatsapp_conversas(clinica_id, atendimento);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_atendente
  ON public.whatsapp_conversas(atendente_id, atendimento);

-- Mensagens individuais dentro de uma conversa
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL DEFAULT 'enviada', -- enviada, recebida
  remetente TEXT NOT NULL, -- 'sistema', 'ia', user_id, 'paciente'
  tipo_conteudo TEXT NOT NULL DEFAULT 'texto', -- texto, imagem, audio, documento, localizacao, sticker
  texto TEXT,
  midia_url TEXT,
  midia_tipo TEXT, -- mime type
  audio_transcricao TEXT, -- transcrição automática de áudio
  audio_duracao_segundos INTEGER,
  api_message_id TEXT, -- id da mensagem na API do WhatsApp
  status TEXT DEFAULT 'enviada', -- enviada, entregue, lida, erro
  resposta_pronta_id UUID, -- se veio do banco de respostas
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_msgs_conversa
  ON public.whatsapp_chat_mensagens(conversa_id, created_at);

-- Tags disponíveis para conversas
CREATE TABLE IF NOT EXISTS public.whatsapp_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#3b82f6', -- hex color
  descricao TEXT,
  automatica BOOLEAN DEFAULT false, -- atribuída automaticamente pela IA
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Banco de respostas prontas para atendimento humano
CREATE TABLE IF NOT EXISTS public.whatsapp_respostas_prontas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  categoria TEXT, -- saudacao, agendamento, informacao, encerramento, etc
  texto TEXT NOT NULL,
  imagem_url TEXT,
  atalho TEXT, -- /ola, /horario, /endereco
  uso_count INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fila de atendimento humano
CREATE TABLE IF NOT EXISTS public.whatsapp_fila_humano (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  motivo TEXT, -- ia_nao_soube, solicitacao_paciente, assunto_complexo
  prioridade INTEGER DEFAULT 5, -- 1=urgente, 10=baixa
  atendente_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'aguardando', -- aguardando, em_atendimento, finalizado
  entrou_fila_em TIMESTAMPTZ DEFAULT now(),
  atendido_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fila_humano
  ON public.whatsapp_fila_humano(clinica_id, status);

-- Seed de tags padrão
INSERT INTO public.whatsapp_tags (clinica_id, nome, cor, descricao, automatica)
SELECT c.id, t.nome, t.cor, t.descricao, t.automatica
FROM public.clinicas c
CROSS JOIN (VALUES
  ('Novo Contato', '#3b82f6', 'Primeiro contato com a clínica', true),
  ('Agendou', '#10b981', 'Paciente agendou consulta', true),
  ('Cancelou', '#ef4444', 'Paciente cancelou agendamento', true),
  ('Confirmou', '#22c55e', 'Paciente confirmou agendamento', true),
  ('Faltou', '#f97316', 'Paciente não compareceu', true),
  ('Retorno', '#8b5cf6', 'Paciente de retorno', true),
  ('Só Conhecendo', '#6b7280', 'Apenas buscando informações', true),
  ('Convênio', '#0ea5e9', 'Atendimento por convênio', false),
  ('Particular', '#f59e0b', 'Atendimento particular', false),
  ('Urgente', '#dc2626', 'Atendimento prioritário', false),
  ('VIP', '#a855f7', 'Paciente VIP', false),
  ('Pós-Atendimento', '#14b8a6', 'Follow-up pós consulta', true),
  ('Token Pendente', '#f59e0b', 'Aguardando token do convênio', true),
  ('NPS Respondido', '#10b981', 'Respondeu pesquisa de satisfação', true)
) AS t(nome, cor, descricao, automatica)
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_tags wt WHERE wt.clinica_id = c.id AND wt.nome = t.nome
);

-- Seed de respostas prontas
INSERT INTO public.whatsapp_respostas_prontas (clinica_id, titulo, categoria, texto, atalho)
SELECT c.id, t.titulo, t.categoria, t.texto, t.atalho
FROM public.clinicas c
CROSS JOIN (VALUES
  ('Saudação', 'saudacao', 'Olá! Bem-vindo(a) à Medic Pop. Como posso ajudar?', '/ola'),
  ('Horário Funcionamento', 'informacao', 'Nosso horário de funcionamento é de segunda a sexta, das 7h às 18h, e sábados das 7h às 12h.', '/horario'),
  ('Endereço', 'informacao', 'Estamos localizados em [ENDEREÇO DA CLÍNICA]. Referência: [PONTO DE REFERÊNCIA].', '/endereco'),
  ('Agendar Consulta', 'agendamento', 'Para agendar sua consulta, preciso das seguintes informações: nome completo, CPF, especialidade desejada e melhor horário.', '/agendar'),
  ('Confirmar Agendamento', 'agendamento', 'Seu agendamento está confirmado! Lembre-se de trazer documento com foto e carteirinha do convênio (se aplicável).', '/confirmar'),
  ('Cancelar/Remarcar', 'agendamento', 'Entendo! Para cancelar ou remarcar, posso verificar outras datas disponíveis. Qual seria o melhor dia e horário para você?', '/remarcar'),
  ('Convênios Aceitos', 'informacao', 'Trabalhamos com os convênios: Unimed e Klini. Para particular, aceitamos PIX, cartão e dinheiro.', '/convenios'),
  ('Preparo para Exame', 'informacao', 'Para seu exame, é necessário: [INSTRUÇÕES DE PREPARO]. Em caso de dúvidas, estamos à disposição.', '/preparo'),
  ('Pós-Atendimento', 'encerramento', 'Esperamos que seu atendimento tenha sido excelente! Se precisar de algo, estamos aqui. 😊', '/pos'),
  ('Transferir para Humano', 'encerramento', 'Vou transferir você para um de nossos atendentes. Aguarde um momento, por favor.', '/humano'),
  ('Encerrar Conversa', 'encerramento', 'Obrigado pelo contato! Se precisar de algo mais, é só nos chamar. Tenha um ótimo dia!', '/encerrar')
) AS t(titulo, categoria, texto, atalho)
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_respostas_prontas rp WHERE rp.clinica_id = c.id AND rp.atalho = t.atalho
);
