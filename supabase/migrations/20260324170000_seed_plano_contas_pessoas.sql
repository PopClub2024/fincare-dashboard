-- =============================================
-- SEED: Plano de Contas + Pessoas (Clientes/Fornecedores)
-- Dados importados dos CSVs fornecidos
-- =============================================

-- Função auxiliar para inserir plano de contas por clínica
CREATE OR REPLACE FUNCTION public.seed_plano_contas(_clinica_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.plano_contas (clinica_id, codigo, codigo_estruturado, descricao, indicador, categoria, ativo)
  VALUES
    (_clinica_id, 1, '1.1', 'VENDA DE PRODUTOS', 'credito', 'Receita com Vendas', true),
    (_clinica_id, 2, '1.2', 'PRESTAÇÃO DE SERVIÇOS', 'credito', 'Receita com Vendas', true),
    (_clinica_id, 3, '2.1', 'DAS - SIMPLES NACIONAL', 'debito', 'Impostos Sobre Vendas', true),
    (_clinica_id, 9, '13.3', 'ESTORNO/DEVOLUÇÕES CLIENTES', 'debito', 'Transferências e Ajustes de Saldo', true),
    (_clinica_id, 10, '22.2', 'TAXA MÁQUINA CARTÃO', 'debito', 'Taxas e Tarifas Bancárias', true),
    (_clinica_id, 11, '3.3', 'TAXA DE APLICATIVOS', 'debito', 'Outras Deduções', true),
    (_clinica_id, 14, '4.2', 'MATÉRIA-PRIMA', 'debito', 'Custos Variáveis', true),
    (_clinica_id, 15, '4.3', 'INSUMOS', 'debito', 'Custos Variáveis', true),
    (_clinica_id, 16, '4.4', 'MÃO DE OBRA VARIÁVEL', 'debito', 'Custos Variáveis', true),
    (_clinica_id, 17, '5.1', 'PRÓ-LABORE', 'debito', 'Gastos com Pessoal', true),
    (_clinica_id, 18, '5.2', 'ENCARGOS SOCIAIS E TRABALHISTAS', 'debito', 'Gastos com Pessoal', true),
    (_clinica_id, 19, '5.3', 'SALÁRIOS', 'debito', 'Gastos com Pessoal', true),
    (_clinica_id, 20, '20.1', 'TRANSPORTE COLABORADORES', 'debito', 'Vale Transporte Colaboradores', true),
    (_clinica_id, 23, '6.1', 'ÁGUA', 'debito', 'Gastos fixos', true),
    (_clinica_id, 24, '6.2', 'LOCAÇÃO 244', 'debito', 'Gastos fixos', true),
    (_clinica_id, 25, '6.3', 'TELEFONE + INTERNET', 'debito', 'Gastos fixos', true),
    (_clinica_id, 26, '6.4', 'LIMPEZA E CONSERVAÇÃO', 'debito', 'Gastos fixos', true),
    (_clinica_id, 27, '6.5', 'ENERGIA ELÉTRICA', 'debito', 'Gastos fixos', true),
    (_clinica_id, 28, '6.16', 'CONTABILIDADE', 'debito', 'Gastos fixos', true),
    (_clinica_id, 29, '7.2', 'SERVIÇOS JURÍDICOS', 'debito', 'Gastos com Serviços de Terceiros', true),
    (_clinica_id, 30, '7.3', 'CONSULTORIA', 'debito', 'Gastos com Serviços de Terceiros', true),
    (_clinica_id, 31, '8.1', 'ANÚNCIOS', 'debito', 'Gastos com Marketing', true),
    (_clinica_id, 32, '8.2', 'PROPAGANDA', 'debito', 'Gastos com Marketing', true),
    (_clinica_id, 33, '8.3', 'CAMPANHAS', 'debito', 'Gastos com Marketing', true),
    (_clinica_id, 34, '9.1', 'JUROS DE APLICAÇÕES', 'credito', 'Receitas não Operacionais', true),
    (_clinica_id, 35, '9.2', 'OUTRAS RECEITAS NÃO OPERACIONAIS', 'credito', 'Receitas não Operacionais', true),
    (_clinica_id, 36, '23.1', 'JUROS POR ATRASO', 'debito', 'Juros', true),
    (_clinica_id, 37, '22.1', 'TARIFAS BANCÁRIAS', 'debito', 'Taxas e Tarifas Bancárias', true),
    (_clinica_id, 38, '10.3', 'OUTROS GASTOS NÃO OPERACIONAIS', 'debito', 'Gastos não Operacionais', true),
    (_clinica_id, 41, '12.1', 'INVESTIMENTOS GERAIS', 'debito', 'Investimentos', true),
    (_clinica_id, 42, '13.1', 'TRANSFERÊNCIA ENTRE CONTAS PRÓPRIAS - EFETUADAS', 'debito', 'Transferências e Ajustes de Saldo', true),
    (_clinica_id, 43, '13.2', 'AJUSTE DE SALDO', 'debito', 'Transferências e Ajustes de Saldo', true),
    (_clinica_id, 44, '14.1', 'TRANSFERÊNCIA CONTRA PRÓPRIA - RECEBIDA', 'credito', 'Transferências e Ajustes de Saldo', true),
    (_clinica_id, 45, '14.2', 'AJUSTE DE SALDO', 'credito', 'Transferências e Ajustes de Saldo', true),
    (_clinica_id, 46, '6.6', 'CONDOMÍNIO', 'debito', 'Gastos fixos', true),
    (_clinica_id, 47, '6.7', 'IPTU', 'debito', 'Gastos fixos', true),
    (_clinica_id, 48, '15.3', 'SHD - HOLTER', 'debito', 'Locação de equipamentos', true),
    (_clinica_id, 49, '15.2', 'TELECLINI - ESPIROMETRIA E MAPA', 'debito', 'Locação de equipamentos', true),
    (_clinica_id, 50, '6.8', 'FEEGOW - SISTEMA OPERACIONAL', 'debito', 'Gastos fixos', true),
    (_clinica_id, 51, '6.9', 'VERTEC - COLETA DE RESÍDUOS', 'debito', 'Gastos fixos', true),
    (_clinica_id, 52, '6.10', 'CLOUDIA - SISTEMA DE WHATSAPP', 'debito', 'Gastos fixos', true),
    (_clinica_id, 53, '5.7', 'CIEE - Agenciamento estágio', 'debito', 'Gastos com Pessoal', true),
    (_clinica_id, 54, '6.15', 'HM1 - IMPRESSORAS', 'debito', 'Gastos fixos', true),
    (_clinica_id, 55, '6.11', 'INDESK - SISTEMA DE SENHAS', 'debito', 'Gastos fixos', true),
    (_clinica_id, 56, '6.12', 'ZL - SISTEMA ENVIO MENSAGEM EM MASSA', 'debito', 'Gastos fixos', true),
    (_clinica_id, 57, '5.8', 'RT MÉDICA', 'debito', 'Gastos com Pessoal', true),
    (_clinica_id, 58, '5.9', 'RT LABORATÓRIO', 'debito', 'Gastos com Pessoal', true),
    (_clinica_id, 59, '16.1', 'INSS', 'debito', 'Impostos RH', true),
    (_clinica_id, 60, '16.2', 'FGTS', 'debito', 'Impostos RH', true),
    (_clinica_id, 61, '10.5', 'TAXA SANITÁRIA', 'debito', 'Gastos não Operacionais', true),
    (_clinica_id, 62, '10.4', 'ANUIDADE CREMERJ', 'debito', 'Gastos não Operacionais', true),
    (_clinica_id, 63, '17.3', 'MANUTENÇÕES - INFRA', 'debito', 'Gastos eventuais', true),
    (_clinica_id, 64, '17.4', 'UNIFORME', 'debito', 'Gastos eventuais', true),
    (_clinica_id, 65, '4.5', 'MATERIAIS GRÁFICOS', 'debito', 'Custos Variáveis', true),
    (_clinica_id, 66, '18.1', 'FAMP', 'debito', 'Empréstimos', true),
    (_clinica_id, 67, '18.2', 'PRONAMP', 'debito', 'Empréstimos', true),
    (_clinica_id, 68, '18.3', 'FGI', 'debito', 'Empréstimos', true),
    (_clinica_id, 69, '6.13', 'SEGURO DO ESTABELECIMENTO', 'debito', 'Gastos fixos', true),
    (_clinica_id, 70, '5.10', 'SEGURO COLABORADORES', 'debito', 'Gastos com Pessoal', true),
    (_clinica_id, 71, '8.4', 'SHARK - AGÊNCIA DE MARKETING', 'debito', 'Gastos com Marketing', true),
    (_clinica_id, 72, '6.14', 'LOCAÇÃO 248', 'debito', 'Gastos fixos', true),
    (_clinica_id, 73, '4.6', 'BRINDES', 'debito', 'Custos Variáveis', true),
    (_clinica_id, 74, '5.11', 'COMISSÃO', 'debito', 'Gastos com Pessoal', true),
    (_clinica_id, 76, '18.5', 'EMPRÉSTIMOS', 'debito', 'Empréstimos', true),
    (_clinica_id, 77, '9.3', 'EMPRÉSTIMOS', 'credito', 'Receitas não Operacionais', true),
    (_clinica_id, 79, '7.4', 'JVA SAÚDE LTDA - LAB E USG', 'debito', 'Gastos com Serviços de Terceiros', true),
    (_clinica_id, 80, '3.5', 'ESTORNO PACIENTE', 'debito', 'Outras Deduções', true),
    (_clinica_id, 81, '4.7', 'TRANSPORTE OPERACIONAL', 'debito', 'Custos Variáveis', true),
    (_clinica_id, 82, '24.1', 'CARTÃO DE CRÉDITO', 'debito', 'Gastos Variáveis', true),
    (_clinica_id, 83, '19.1', 'MÃO DE OBRA MÉDICA E TERAPÊUTICA', 'debito', 'Mão de obra médica e terapêutica', true),
    (_clinica_id, 84, '9.4', 'Rendimento Conta', 'credito', 'Receitas não Operacionais', true),
    (_clinica_id, 85, '3.6', 'ESTORNO DE RENDIMENTO CONTA', 'debito', 'Outras Deduções', true),
    (_clinica_id, 86, '6.17', 'Verisure - Alarme', 'debito', 'Gastos fixos', true),
    (_clinica_id, 87, '4.8', 'InterSaúde', 'debito', 'Custos Variáveis', true),
    (_clinica_id, 88, '4.9', 'FATURISTA', 'debito', 'Custos Variáveis', true),
    (_clinica_id, 89, '1.3', 'GLOSAS - RECEBIMENTO', 'credito', 'Receita com Vendas', true)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Tabela de pessoas (clientes + fornecedores) — unificada
CREATE TABLE IF NOT EXISTS public.pessoas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  codigo_externo INTEGER,
  cpf_cnpj TEXT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Fornecedor', -- Cliente, Fornecedor, ClienteFornecedor
  telefone TEXT,
  email TEXT,
  contato TEXT,
  cidade TEXT,
  uf TEXT,
  endereco TEXT,
  cep TEXT,
  observacao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pessoas_clinica ON public.pessoas(clinica_id, tipo);
CREATE INDEX IF NOT EXISTS idx_pessoas_cnpj ON public.pessoas(clinica_id, cpf_cnpj);

-- Mapeamento DRE: categorias do plano de contas → linhas do DRE
-- Isso permite que o DRE seja gerado automaticamente a partir do plano de contas
CREATE TABLE IF NOT EXISTS public.dre_mapeamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id UUID NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  categoria_plano_contas TEXT NOT NULL,
  linha_dre TEXT NOT NULL, -- receita_bruta, deducoes, custos_variaveis, gastos_pessoal, gastos_fixos, etc
  ordem INTEGER DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'debito', -- credito ou debito
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed do mapeamento DRE
CREATE OR REPLACE FUNCTION public.seed_dre_mapeamento(_clinica_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.dre_mapeamento (clinica_id, categoria_plano_contas, linha_dre, ordem, tipo) VALUES
    -- RECEITAS
    (_clinica_id, 'Receita com Vendas', 'receita_bruta', 1, 'credito'),
    -- DEDUÇÕES
    (_clinica_id, 'Impostos Sobre Vendas', 'impostos_vendas', 2, 'debito'),
    (_clinica_id, 'Outras Deduções', 'outras_deducoes', 3, 'debito'),
    (_clinica_id, 'Taxas e Tarifas Bancárias', 'taxas_bancarias', 4, 'debito'),
    -- CUSTOS VARIÁVEIS
    (_clinica_id, 'Custos Variáveis', 'custos_variaveis', 5, 'debito'),
    (_clinica_id, 'Gastos Variáveis', 'custos_variaveis', 5, 'debito'),
    -- MÃO DE OBRA
    (_clinica_id, 'Gastos com Pessoal', 'gastos_pessoal', 6, 'debito'),
    (_clinica_id, 'Vale Transporte Colaboradores', 'gastos_pessoal', 6, 'debito'),
    (_clinica_id, 'Mão de obra médica e terapêutica', 'mao_obra_medica', 7, 'debito'),
    -- GASTOS FIXOS
    (_clinica_id, 'Gastos fixos', 'gastos_fixos', 8, 'debito'),
    (_clinica_id, 'Locação de equipamentos', 'gastos_fixos', 8, 'debito'),
    -- SERVIÇOS TERCEIROS
    (_clinica_id, 'Gastos com Serviços de Terceiros', 'servicos_terceiros', 9, 'debito'),
    -- MARKETING
    (_clinica_id, 'Gastos com Marketing', 'marketing', 10, 'debito'),
    -- IMPOSTOS RH
    (_clinica_id, 'Impostos RH', 'impostos_rh', 11, 'debito'),
    -- NÃO OPERACIONAIS
    (_clinica_id, 'Receitas não Operacionais', 'receitas_nao_operacionais', 12, 'credito'),
    (_clinica_id, 'Gastos não Operacionais', 'gastos_nao_operacionais', 13, 'debito'),
    (_clinica_id, 'Gastos eventuais', 'gastos_eventuais', 14, 'debito'),
    -- JUROS E EMPRÉSTIMOS
    (_clinica_id, 'Juros', 'juros', 15, 'debito'),
    (_clinica_id, 'Empréstimos', 'emprestimos', 16, 'debito'),
    -- INVESTIMENTOS
    (_clinica_id, 'Investimentos', 'investimentos', 17, 'debito'),
    -- TRANSFERÊNCIAS (neutro no DRE)
    (_clinica_id, 'Transferências e Ajustes de Saldo', 'transferencias', 99, 'debito')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Adicionar coluna pessoa_id nas contas a pagar/receber (FK para pessoas)
ALTER TABLE public.contas_pagar_lancamentos ADD COLUMN IF NOT EXISTS pessoa_id UUID REFERENCES public.pessoas(id);
