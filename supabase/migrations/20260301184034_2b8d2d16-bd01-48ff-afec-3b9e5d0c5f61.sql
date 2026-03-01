
-- 1. Tabela de transações bancárias (extrato OFX)
CREATE TABLE public.transacoes_bancarias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  fitid text NOT NULL,
  tipo text NOT NULL, -- 'credito' | 'debito'
  valor numeric NOT NULL DEFAULT 0,
  data_transacao date NOT NULL,
  descricao text,
  banco text,
  conta text,
  categoria_auto text, -- categoria inferida por regex
  status text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'conciliado' | 'ignorado'
  conciliacao_id uuid REFERENCES public.conciliacoes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, fitid)
);

CREATE INDEX idx_transacoes_bancarias_data ON public.transacoes_bancarias(clinica_id, data_transacao);
CREATE INDEX idx_transacoes_bancarias_fitid ON public.transacoes_bancarias(clinica_id, fitid);

ALTER TABLE public.transacoes_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage transacoes_bancarias"
  ON public.transacoes_bancarias FOR ALL
  USING (clinica_id = get_user_clinica_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)));

CREATE POLICY "Clinic users view transacoes_bancarias"
  ON public.transacoes_bancarias FOR SELECT
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- 2. Adicionar coluna transacao_bancaria_id na conciliacoes para o terceiro "pé"
ALTER TABLE public.conciliacoes 
  ADD COLUMN IF NOT EXISTS transacao_bancaria_id uuid REFERENCES public.transacoes_bancarias(id),
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'venda_recebimento',
  ADD COLUMN IF NOT EXISTS metodo_match text,
  ADD COLUMN IF NOT EXISTS score numeric DEFAULT 0;

-- 3. Adicionar campos de enrichment nos recebimentos
ALTER TABLE public.transacoes_recebimentos
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS nsu text,
  ADD COLUMN IF NOT EXISTS tid text,
  ADD COLUMN IF NOT EXISTS autorizacao text,
  ADD COLUMN IF NOT EXISTS bandeira text,
  ADD COLUMN IF NOT EXISTS parcelas integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS taxa numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric,
  ADD COLUMN IF NOT EXISTS data_liquidacao date,
  ADD COLUMN IF NOT EXISTS transacao_bancaria_id uuid REFERENCES public.transacoes_bancarias(id);
