-- ============================================================
-- Migration: Feegow Data Import Tables
-- Tabelas para importação dos dados extraídos do Feegow
-- Mantém referência ao ID original do Feegow para rastreabilidade
-- ============================================================

-- Tabela de convênios importados
CREATE TABLE IF NOT EXISTS convenios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  feegow_id int UNIQUE,
  nome varchar(200) NOT NULL,
  registro_ans varchar(30),
  cnpj varchar(18),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Planos dos convênios
CREATE TABLE IF NOT EXISTS convenio_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convenio_id uuid REFERENCES convenios(id) ON DELETE CASCADE,
  feegow_plano_id int,
  nome varchar(200) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Especialidades
CREATE TABLE IF NOT EXISTS especialidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  feegow_id int UNIQUE,
  nome varchar(200) NOT NULL,
  codigo_tiss varchar(20),
  cbos varchar(20),
  ativo boolean DEFAULT true,
  recall_dias int DEFAULT 180,
  created_at timestamptz DEFAULT now()
);

-- Procedimentos
CREATE TABLE IF NOT EXISTS procedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  feegow_id int UNIQUE,
  nome varchar(300) NOT NULL,
  codigo_tiss varchar(20),
  tipo_procedimento int,
  valor_particular decimal(10,2) DEFAULT 0,
  tempo_minutos int DEFAULT 10,
  especialidade_ids jsonb DEFAULT '[]',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Médicos/Profissionais
CREATE TABLE IF NOT EXISTS medicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  feegow_id int UNIQUE,
  nome varchar(200) NOT NULL,
  tratamento varchar(10),
  cpf varchar(14),
  email varchar(200),
  sexo varchar(20),
  conselho varchar(10),
  documento_conselho varchar(30),
  uf_conselho varchar(2),
  rqe varchar(30),
  especialidades jsonb DEFAULT '[]',
  ativo boolean DEFAULT true,
  foto_url varchar(500),
  idade_minima int,
  idade_maxima int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pacientes (estrutura completa conforme PDF spec)
CREATE TABLE IF NOT EXISTS pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  feegow_id int,
  prontuario serial UNIQUE,
  nome varchar(200) NOT NULL,
  nome_social varchar(200),
  cpf varchar(14),
  rg varchar(20),
  data_nascimento date,
  sexo varchar(20),
  email varchar(200),
  telefone varchar(20),
  celular varchar(20),
  cep varchar(10),
  endereco varchar(300),
  numero varchar(20),
  complemento varchar(100),
  bairro varchar(100),
  cidade varchar(100),
  estado varchar(2),
  convenio_id uuid REFERENCES convenios(id),
  plano varchar(100),
  carteirinha varchar(50),
  token_carteirinha varchar(50),
  validade_carteirinha date,
  titular varchar(200),
  observacoes text,
  avisos_pendencias text,
  foto_url varchar(500),
  profissao varchar(100),
  indicado_por varchar(200),
  origem varchar(50),
  status varchar(20) DEFAULT 'ativo',
  data_retencao date, -- 5 anos após último atendimento
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  feegow_criado_em timestamptz,
  feegow_alterado_em timestamptz,
  CONSTRAINT unique_paciente_feegow UNIQUE (clinica_id, feegow_id)
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_pacientes_cpf ON pacientes(cpf);
CREATE INDEX IF NOT EXISTS idx_pacientes_nome ON pacientes(nome);
CREATE INDEX IF NOT EXISTS idx_pacientes_clinica ON pacientes(clinica_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_feegow ON pacientes(feegow_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_nascimento ON pacientes(data_nascimento);

-- Agendamentos históricos (importados do Feegow)
CREATE TABLE IF NOT EXISTS agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  feegow_id int,
  paciente_id uuid REFERENCES pacientes(id),
  medico_id uuid REFERENCES medicos(id),
  especialidade_id uuid REFERENCES especialidades(id),
  procedimento_id uuid REFERENCES procedimentos(id),
  consultorio_id uuid,
  data date NOT NULL,
  horario time NOT NULL,
  duracao int DEFAULT 0,
  tipo varchar(20) DEFAULT 'particular', -- particular | convenio
  convenio_id uuid REFERENCES convenios(id),
  status varchar(30) DEFAULT 'agendado',
  -- agendado|confirmado|checkin|em_atendimento|atendido|nao_compareceu|cancelado|remarcado
  is_encaixe boolean DEFAULT false,
  valor decimal(10,2) DEFAULT 0,
  motivo_cancelamento varchar(50),
  obs_cancelamento text,
  observacao text,
  agendado_por varchar(200),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_agendamento_feegow UNIQUE (clinica_id, feegow_id)
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente ON agendamentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_medico ON agendamentos(medico_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);

-- Guias TISS
CREATE TABLE IF NOT EXISTS guias_tiss (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  agendamento_id uuid REFERENCES agendamentos(id),
  paciente_id uuid REFERENCES pacientes(id),
  medico_id uuid REFERENCES medicos(id),
  convenio_id uuid REFERENCES convenios(id),
  tipo_guia varchar(20) NOT NULL, -- consulta | sadt | servico
  codigo_procedimento varchar(20),
  carteirinha varchar(50),
  token varchar(50),
  numero_guia_portal varchar(50),
  numero_requisicao varchar(50),
  qtd_sessoes int DEFAULT 1,
  valor decimal(10,2),
  status varchar(30) DEFAULT 'pendente',
  -- pendente|pendente_token|lancada|em_lote|paga|glosada
  lote_id uuid,
  motivo_glosa text,
  data_atendimento date,
  indicacao_acidente varchar(30) DEFAULT 'Não acidente',
  regime_atendimento varchar(30) DEFAULT 'Ambulatorial',
  tipo_consulta varchar(30) DEFAULT 'Primeira consulta',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lotes de faturamento
CREATE TABLE IF NOT EXISTS lotes_faturamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  convenio_id uuid REFERENCES convenios(id),
  periodo_inicio date,
  periodo_fim date,
  total_guias int DEFAULT 0,
  valor_total decimal(12,2) DEFAULT 0,
  status varchar(20) DEFAULT 'aberto', -- aberto|fechado|pago|parcial
  fechado_por uuid,
  fechado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Conta financeira do paciente (histórico de pagamentos)
CREATE TABLE IF NOT EXISTS conta_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  paciente_id uuid REFERENCES pacientes(id),
  agendamento_id uuid REFERENCES agendamentos(id),
  tipo varchar(20) NOT NULL, -- pagamento|recibo|estorno
  descricao varchar(300),
  valor decimal(10,2) NOT NULL,
  forma_pagamento varchar(30),
  data_pagamento date,
  recibo_gerado boolean DEFAULT false,
  recibo_url varchar(500),
  created_at timestamptz DEFAULT now()
);

-- Recibos médicos editáveis
CREATE TABLE IF NOT EXISTS recibos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  paciente_id uuid REFERENCES pacientes(id),
  medico_id uuid REFERENCES medicos(id),
  agendamento_id uuid REFERENCES agendamentos(id),
  tipo varchar(20) DEFAULT 'paciente', -- paciente | medico
  valor decimal(10,2) NOT NULL,
  descricao text,
  procedimento varchar(200),
  data_emissao date DEFAULT CURRENT_DATE,
  template_html text, -- HTML editável do recibo
  impresso boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Linha do tempo do paciente (auto-preenchida)
CREATE TABLE IF NOT EXISTS timeline_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid REFERENCES clinicas(id),
  paciente_id uuid REFERENCES pacientes(id),
  tipo varchar(30) NOT NULL,
  -- consulta|exame|prescricao|laudo|atestado|encaminhamento|pagamento|cancelamento
  titulo varchar(300),
  descricao text,
  medico_nome varchar(200),
  data_evento timestamptz NOT NULL,
  dados_extras jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_paciente ON timeline_paciente(paciente_id, data_evento DESC);

-- Tabela de mapeamento Feegow → Medic Pop para status de agendamento
-- Feegow status_id: 1=Agendado, 2=Confirmado, 3=Desmarcado paciente, 4=Desmarcado profissional,
-- 5=Atendido, 6=Não compareceu, 7=Remarcado, 8=Em espera, 9=Em atendimento

-- Função para calcular data de retenção (5 anos após último atendimento)
CREATE OR REPLACE FUNCTION update_data_retencao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'atendido' THEN
    UPDATE pacientes SET data_retencao = (NEW.data + interval '5 years')::date
    WHERE id = NEW.paciente_id
    AND (data_retencao IS NULL OR data_retencao < (NEW.data + interval '5 years')::date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_retencao
AFTER INSERT OR UPDATE ON agendamentos
FOR EACH ROW EXECUTE FUNCTION update_data_retencao();

-- Trigger para auto-preencher timeline quando agendamento muda de status
CREATE OR REPLACE FUNCTION auto_timeline_agendamento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('atendido', 'cancelado', 'nao_compareceu') AND
     (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    INSERT INTO timeline_paciente (clinica_id, paciente_id, tipo, titulo, descricao, medico_nome, data_evento, dados_extras)
    SELECT
      NEW.clinica_id,
      NEW.paciente_id,
      CASE NEW.status
        WHEN 'atendido' THEN 'consulta'
        WHEN 'cancelado' THEN 'cancelamento'
        WHEN 'nao_compareceu' THEN 'cancelamento'
      END,
      CASE NEW.status
        WHEN 'atendido' THEN 'Consulta realizada'
        WHEN 'cancelado' THEN 'Agendamento cancelado'
        WHEN 'nao_compareceu' THEN 'Paciente não compareceu'
      END,
      COALESCE(NEW.observacao, ''),
      m.nome,
      (NEW.data || ' ' || NEW.horario)::timestamptz,
      jsonb_build_object('agendamento_id', NEW.id, 'status', NEW.status)
    FROM medicos m WHERE m.id = NEW.medico_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_timeline_agendamento
AFTER UPDATE ON agendamentos
FOR EACH ROW EXECUTE FUNCTION auto_timeline_agendamento();

-- RLS policies
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE convenios ENABLE ROW LEVEL SECURITY;
ALTER TABLE guias_tiss ENABLE ROW LEVEL SECURITY;

-- Policies permitem acesso por clinica_id
DO $$ BEGIN
  CREATE POLICY "pacientes_clinica" ON pacientes FOR ALL USING (clinica_id = (SELECT clinica_id FROM user_profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "agendamentos_clinica" ON agendamentos FOR ALL USING (clinica_id = (SELECT clinica_id FROM user_profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "medicos_clinica" ON medicos FOR ALL USING (clinica_id = (SELECT clinica_id FROM user_profiles WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
