
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.forma_pagamento AS ENUM ('pix','dinheiro','convenio_nf','cartao_credito','cartao_debito');
CREATE TYPE public.canal_pagamento AS ENUM ('qrcode','chave_celular','chave_cnpj','maquininha','boleto','deposito','outro');
CREATE TYPE public.linha_receita AS ENUM ('prestacao_servicos','consulta','exame','procedimento','produto');
CREATE TYPE public.status_comprovante AS ENUM ('pendente','processado','erro','rejeitado');
CREATE TYPE public.indicador_plano AS ENUM ('credito','debito');
CREATE TYPE public.status_lancamento_cp AS ENUM ('a_classificar','classificado','pago','cancelado');

-- =====================================================
-- PLANO DE CONTAS
-- =====================================================
CREATE TABLE public.plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  codigo integer NOT NULL,
  codigo_estruturado text NOT NULL,
  descricao text NOT NULL,
  indicador indicador_plano NOT NULL DEFAULT 'debito',
  categoria text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, codigo)
);

ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users view plano_contas" ON public.plano_contas
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Admin/gestor manage plano_contas" ON public.plano_contas
  FOR ALL USING (
    clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  );

CREATE INDEX idx_plano_contas_clinica ON public.plano_contas(clinica_id);

CREATE TRIGGER update_plano_contas_updated_at
  BEFORE UPDATE ON public.plano_contas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- CONTAS A PAGAR LANÇAMENTOS (replaces contas_pagar for new workflow)
-- =====================================================
CREATE TABLE public.contas_pagar_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  plano_contas_id uuid REFERENCES public.plano_contas(id),
  descricao text,
  fornecedor text,
  valor numeric NOT NULL DEFAULT 0,
  data_competencia date NOT NULL,
  data_vencimento date,
  data_pagamento date,
  tipo_despesa tipo_despesa NOT NULL DEFAULT 'variavel',
  status status_lancamento_cp NOT NULL DEFAULT 'a_classificar',
  forma_pagamento forma_pagamento,
  canal_pagamento canal_pagamento,
  banco_referencia text,
  comprovante_id uuid,
  ofx_transaction_id text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_pagar_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users view lancamentos_cp" ON public.contas_pagar_lancamentos
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Admin/gestor manage lancamentos_cp" ON public.contas_pagar_lancamentos
  FOR ALL USING (
    clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  );

CREATE POLICY "Caixa insert lancamentos_cp" ON public.contas_pagar_lancamentos
  FOR INSERT WITH CHECK (
    clinica_id = get_user_clinica_id(auth.uid())
    AND has_role(auth.uid(), 'operador_caixa')
  );

CREATE INDEX idx_lancamentos_cp_clinica ON public.contas_pagar_lancamentos(clinica_id);
CREATE INDEX idx_lancamentos_cp_data ON public.contas_pagar_lancamentos(data_competencia);
CREATE INDEX idx_lancamentos_cp_plano ON public.contas_pagar_lancamentos(plano_contas_id);
CREATE INDEX idx_lancamentos_cp_status ON public.contas_pagar_lancamentos(status);

CREATE TRIGGER update_lancamentos_cp_updated_at
  BEFORE UPDATE ON public.contas_pagar_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COMPROVANTES
-- =====================================================
CREATE TABLE public.comprovantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  lancamento_id uuid REFERENCES public.contas_pagar_lancamentos(id),
  arquivo_url text NOT NULL,
  arquivo_nome text,
  tipo_arquivo text,
  status status_comprovante NOT NULL DEFAULT 'pendente',
  dados_extraidos jsonb,
  erro_processamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comprovantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users view comprovantes" ON public.comprovantes
  FOR SELECT USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE POLICY "Admin/gestor manage comprovantes" ON public.comprovantes
  FOR ALL USING (
    clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  );

CREATE POLICY "Caixa insert comprovantes" ON public.comprovantes
  FOR INSERT WITH CHECK (
    clinica_id = get_user_clinica_id(auth.uid())
    AND has_role(auth.uid(), 'operador_caixa')
  );

CREATE INDEX idx_comprovantes_clinica ON public.comprovantes(clinica_id);
CREATE INDEX idx_comprovantes_lancamento ON public.comprovantes(lancamento_id);

CREATE TRIGGER update_comprovantes_updated_at
  BEFORE UPDATE ON public.comprovantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add comprovante_id FK after comprovantes table exists
ALTER TABLE public.contas_pagar_lancamentos
  ADD CONSTRAINT fk_lancamento_comprovante
  FOREIGN KEY (comprovante_id) REFERENCES public.comprovantes(id);

-- =====================================================
-- ALTER transacoes_vendas: add new payment/revenue columns
-- =====================================================
ALTER TABLE public.transacoes_vendas
  ADD COLUMN IF NOT EXISTS linha_receita linha_receita,
  ADD COLUMN IF NOT EXISTS procedimento text,
  ADD COLUMN IF NOT EXISTS especialidade text,
  ADD COLUMN IF NOT EXISTS forma_pagamento_enum forma_pagamento,
  ADD COLUMN IF NOT EXISTS canal_pagamento canal_pagamento,
  ADD COLUMN IF NOT EXISTS banco_referencia text,
  ADD COLUMN IF NOT EXISTS parcelas integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcela_atual integer DEFAULT 1;

-- =====================================================
-- STORAGE BUCKET FOR COMPROVANTES
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes', 'comprovantes', false);

CREATE POLICY "Users can upload comprovantes" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'comprovantes' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view own comprovantes" ON storage.objects
  FOR SELECT USING (bucket_id = 'comprovantes' AND auth.role() = 'authenticated');
