-- =============================================
-- RECIBOS MÉDICOS + CONTA DO PACIENTE + FATURAMENTO TISS
-- =============================================

-- Complementar tabela de recibos
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'paciente'; -- paciente, medico
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS nome_paciente TEXT;
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS cpf_paciente TEXT;
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS nome_medico TEXT;
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS crm_medico TEXT;
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS especialidade TEXT;
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS data_atendimento DATE;
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS texto_corpo TEXT; -- texto editável do recibo
ALTER TABLE public.recibos ADD COLUMN IF NOT EXISTS numero_recibo SERIAL;

CREATE INDEX IF NOT EXISTS idx_recibos_paciente ON public.recibos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_recibos_medico ON public.recibos(medico_id);

-- Conta corrente do paciente (histórico financeiro consolidado)
CREATE TABLE IF NOT EXISTS public.conta_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  checkin_id UUID REFERENCES public.checkins(id),
  agendamento_id UUID REFERENCES public.agendamentos(id),
  tipo TEXT NOT NULL DEFAULT 'pagamento', -- pagamento, estorno, cortesia
  descricao TEXT NOT NULL,
  medico_nome TEXT,
  especialidade TEXT,
  procedimento TEXT,
  valor_bruto NUMERIC(12,2) NOT NULL,
  desconto NUMERIC(12,2) DEFAULT 0,
  taxa_cartao NUMERIC(12,2) DEFAULT 0,
  imposto NUMERIC(12,2) DEFAULT 0,
  valor_liquido NUMERIC(12,2),
  forma_pagamento TEXT,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  pago BOOLEAN DEFAULT true,
  recibo_id UUID REFERENCES public.recibos(id),
  nota_fiscal_id UUID REFERENCES public.notas_fiscais(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conta_paciente ON public.conta_paciente(paciente_id, data_pagamento);

-- Complementar guias TISS com campos ANS obrigatórios
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS checkin_id UUID REFERENCES public.checkins(id);
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS tipo_guia TEXT DEFAULT 'consulta'; -- consulta (SP/SADT)
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS numero_carteirinha_novo TEXT;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS nome_paciente TEXT;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS cpf_paciente TEXT;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS data_nascimento_paciente DATE;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS nome_contratado TEXT; -- nome da clínica
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS codigo_contratado TEXT; -- CNES da clínica
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS nome_profissional TEXT;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS conselho_profissional TEXT DEFAULT 'CRM';
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS uf_conselho TEXT;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS codigo_cbo TEXT;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS data_atendimento DATE;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS tipo_consulta TEXT DEFAULT 'primeira'; -- primeira, retorno
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS codigo_tabela TEXT DEFAULT '22'; -- 22 = TUSS
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS valor_procedimento NUMERIC(12,2);
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS quantidade INTEGER DEFAULT 1;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS valor_total NUMERIC(12,2);
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS indicacao_clinica TEXT;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS observacao TEXT;
-- SADT específicos
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS numero_guia_principal TEXT; -- guia de referência (consulta)
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS numero_guia_operadora TEXT;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS data_solicitacao DATE;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS data_autorizacao DATE;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS senha_autorizacao TEXT;
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS tipo_atendimento TEXT DEFAULT '05'; -- 05=consulta eletiva
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS carater_atendimento TEXT DEFAULT '1'; -- 1=eletivo
ALTER TABLE public.guias_tiss ADD COLUMN IF NOT EXISTS regime_atendimento TEXT DEFAULT '01'; -- 01=ambulatorial

CREATE INDEX IF NOT EXISTS idx_guias_tiss_checkin ON public.guias_tiss(checkin_id);
CREATE INDEX IF NOT EXISTS idx_guias_tiss_convenio ON public.guias_tiss(convenio_id, status);
