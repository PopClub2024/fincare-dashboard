ALTER TYPE status_presenca ADD VALUE IF NOT EXISTS 'agendado';
ALTER TYPE status_presenca ADD VALUE IF NOT EXISTS 'em_espera';
ALTER TYPE status_presenca ADD VALUE IF NOT EXISTS 'em_atendimento';
ALTER TYPE status_presenca ADD VALUE IF NOT EXISTS 'cancelado_paciente';