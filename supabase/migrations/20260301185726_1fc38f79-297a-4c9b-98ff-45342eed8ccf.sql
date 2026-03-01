
-- ═══════════════════════════════════════════════════
-- 1) Contas Bancárias
-- ═══════════════════════════════════════════════════
CREATE TABLE public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  banco text NOT NULL,
  agencia text NOT NULL,
  conta text NOT NULL,
  tipo text NOT NULL DEFAULT 'corrente',
  apelido text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage contas_bancarias"
  ON public.contas_bancarias FOR ALL TO authenticated
  USING (clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view contas_bancarias"
  ON public.contas_bancarias FOR SELECT TO authenticated
  USING (clinica_id = get_user_clinica_id(auth.uid()));

CREATE TRIGGER update_contas_bancarias_updated_at
  BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add FK from transacoes_bancarias to contas_bancarias
ALTER TABLE public.transacoes_bancarias
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id);

-- ═══════════════════════════════════════════════════
-- 2) Getnet Transações (CSV import)
-- ═══════════════════════════════════════════════════
CREATE TABLE public.getnet_transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  tipo_extrato text NOT NULL, -- cartao, pix
  data_venda timestamptz NOT NULL,
  bandeira text,
  modalidade text,
  forma_pagamento text,
  status_transacao text,
  parcelas integer DEFAULT 1,
  data_prevista_pagamento date,
  numero_cartao text,
  autorizacao text,
  comprovante_venda text,
  terminal text,
  valor_bruto numeric NOT NULL,
  valor_taxa numeric NOT NULL DEFAULT 0,
  valor_liquido numeric NOT NULL,
  id_transacao_pix text,
  instituicao_bancaria text,
  arquivo_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, tipo_extrato, comprovante_venda)
);

ALTER TABLE public.getnet_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage getnet_transacoes"
  ON public.getnet_transacoes FOR ALL TO authenticated
  USING (clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view getnet_transacoes"
  ON public.getnet_transacoes FOR SELECT TO authenticated
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- ═══════════════════════════════════════════════════
-- 3) Arquivos Importados (file archive)
-- ═══════════════════════════════════════════════════
CREATE TABLE public.arquivos_importados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  nome_arquivo text NOT NULL,
  tipo text NOT NULL,
  tamanho_bytes integer,
  registros_importados integer DEFAULT 0,
  periodo_inicio date,
  periodo_fim date,
  arquivo_url text,
  status text NOT NULL DEFAULT 'processado',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid
);

ALTER TABLE public.arquivos_importados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor manage arquivos_importados"
  ON public.arquivos_importados FOR ALL TO authenticated
  USING (clinica_id = get_user_clinica_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor')));

CREATE POLICY "Clinic users view arquivos_importados"
  ON public.arquivos_importados FOR SELECT TO authenticated
  USING (clinica_id = get_user_clinica_id(auth.uid()));

-- Storage bucket for imported files
INSERT INTO storage.buckets (id, name, public) VALUES ('extratos', 'extratos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clinic users upload extratos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'extratos');

CREATE POLICY "Clinic users view own extratos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'extratos');

-- ═══════════════════════════════════════════════════
-- 4) Permissões Granulares por Módulo
-- ═══════════════════════════════════════════════════
CREATE TABLE public.permissoes_modulo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  pode_visualizar boolean NOT NULL DEFAULT true,
  pode_editar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinica_id, user_id, modulo)
);

ALTER TABLE public.permissoes_modulo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage permissoes"
  ON public.permissoes_modulo FOR ALL TO authenticated
  USING (clinica_id = get_user_clinica_id(auth.uid())
    AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own permissoes"
  ON public.permissoes_modulo FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════
-- 5) Add venda_id link on getnet_transacoes for matching
-- ═══════════════════════════════════════════════════
ALTER TABLE public.getnet_transacoes
  ADD COLUMN venda_id uuid REFERENCES public.transacoes_vendas(id);

ALTER TABLE public.getnet_transacoes
  ADD COLUMN transacao_bancaria_id uuid REFERENCES public.transacoes_bancarias(id);

ALTER TABLE public.getnet_transacoes
  ADD COLUMN status_conciliacao text NOT NULL DEFAULT 'pendente';

-- Index for fast matching
CREATE INDEX idx_getnet_transacoes_clinica_data ON public.getnet_transacoes(clinica_id, data_venda);
CREATE INDEX idx_getnet_transacoes_valor ON public.getnet_transacoes(clinica_id, valor_bruto);
