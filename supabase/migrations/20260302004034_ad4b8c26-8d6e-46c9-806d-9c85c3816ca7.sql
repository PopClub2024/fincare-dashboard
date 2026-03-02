
-- Table for async job tracking
CREATE TABLE public.integracao_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id),
  job_type TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  progress JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for idempotency (one active job per clinica + type + params hash)
CREATE UNIQUE INDEX idx_integracao_jobs_active_lock
  ON public.integracao_jobs (clinica_id, job_type, (params->>'date_start'), (params->>'date_end'))
  WHERE status IN ('queued', 'running');

CREATE INDEX idx_integracao_jobs_clinica ON public.integracao_jobs (clinica_id, created_at DESC);

ALTER TABLE public.integracao_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on integracao_jobs"
  ON public.integracao_jobs FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their clinic jobs"
  ON public.integracao_jobs FOR SELECT
  USING (clinica_id = (SELECT get_user_clinica_id(auth.uid())));
