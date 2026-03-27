
-- RH Departamentos
CREATE TABLE public.rh_departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  responsavel_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_departamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_departamentos_clinica" ON public.rh_departamentos FOR ALL TO authenticated
  USING (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1))
  WITH CHECK (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1));

-- RH Férias
CREATE TABLE public.rh_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias_total integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  notas text,
  aprovado_por uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_ferias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_ferias_clinica" ON public.rh_ferias FOR ALL TO authenticated
  USING (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1))
  WITH CHECK (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1));

-- RH Desligamentos
CREATE TABLE public.rh_desligamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  data_desligamento date NOT NULL,
  motivo text,
  decisao text DEFAULT 'empresa',
  causa text,
  custo numeric DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_desligamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_desligamentos_clinica" ON public.rh_desligamentos FOR ALL TO authenticated
  USING (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1))
  WITH CHECK (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1));

-- RH Feedbacks
CREATE TABLE public.rh_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  remetente_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'positivo',
  mensagem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_feedbacks_clinica" ON public.rh_feedbacks FOR ALL TO authenticated
  USING (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1))
  WITH CHECK (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1));

-- RH Escalas
CREATE TABLE public.rh_escalas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  dia_semana integer NOT NULL,
  turno text NOT NULL DEFAULT 'integral',
  hora_inicio time,
  hora_fim time,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_escalas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_escalas_clinica" ON public.rh_escalas FOR ALL TO authenticated
  USING (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1))
  WITH CHECK (clinica_id = (SELECT u.clinica_id FROM usuarios u WHERE u.user_id = auth.uid() LIMIT 1));

-- Add departamento_id and gestor_id to colaboradores
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS departamento_id uuid REFERENCES public.rh_departamentos(id) ON DELETE SET NULL;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS gestor_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL;
