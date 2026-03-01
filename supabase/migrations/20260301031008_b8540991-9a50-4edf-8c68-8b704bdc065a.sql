
-- Function to seed plano de contas for a clinic
CREATE OR REPLACE FUNCTION public.seed_plano_contas(_clinica_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.plano_contas (clinica_id, codigo, codigo_estruturado, descricao, indicador, categoria) VALUES
    (_clinica_id, 1, '1.1', 'VENDA DE PRODUTOS', 'credito', 'Receita com Vendas'),
    (_clinica_id, 2, '1.2', 'PRESTAÇÃO DE SERVIÇOS', 'credito', 'Receita com Vendas'),
    (_clinica_id, 3, '2.1', 'DAS - SIMPLES NACIONAL', 'debito', 'Impostos Sobre Vendas'),
    (_clinica_id, 9, '13.3', 'ESTORNO/DEVOLUÇÕES CLIENTES', 'debito', 'Transferências e Ajustes de Saldo'),
    (_clinica_id, 10, '22.2', 'TAXA MÁQUINA CARTÃO', 'debito', 'Taxas e Tarifas Bancárias'),
    (_clinica_id, 11, '3.3', 'TAXA DE APLICATIVOS', 'debito', 'Outras Deduções'),
    (_clinica_id, 14, '4.2', 'MATÉRIA-PRIMA', 'debito', 'Custos Variáveis'),
    (_clinica_id, 15, '4.3', 'INSUMOS', 'debito', 'Custos Variáveis'),
    (_clinica_id, 16, '4.4', 'MÃO DE OBRA VARIÁVEL', 'debito', 'Custos Variáveis'),
    (_clinica_id, 17, '5.1', 'PRÓ-LABORE', 'debito', 'Gastos com Pessoal'),
    (_clinica_id, 18, '5.2', 'ENCARGOS SOCIAIS E TRABALHISTAS', 'debito', 'Gastos com Pessoal'),
    (_clinica_id, 19, '5.3', 'SALÁRIOS', 'debito', 'Gastos com Pessoal'),
    (_clinica_id, 20, '20.1', 'TRANSPORTE COLABORADORES', 'debito', 'Vale Transporte Colaboradores'),
    (_clinica_id, 23, '6.1', 'ÁGUA', 'debito', 'Gastos fixos'),
    (_clinica_id, 24, '6.2', 'LOCAÇÃO 244', 'debito', 'Gastos fixos'),
    (_clinica_id, 25, '6.3', 'TELEFONE + INTERNET', 'debito', 'Gastos fixos'),
    (_clinica_id, 26, '6.4', 'LIMPEZA E CONSERVAÇÃO', 'debito', 'Gastos fixos'),
    (_clinica_id, 27, '6.5', 'ENERGIA ELÉTRICA', 'debito', 'Gastos fixos'),
    (_clinica_id, 28, '6.16', 'CONTABILIDADE', 'debito', 'Gastos fixos'),
    (_clinica_id, 29, '7.2', 'SERVIÇOS JURÍDICOS', 'debito', 'Gastos com Serviços de Terceiros'),
    (_clinica_id, 30, '7.3', 'CONSULTORIA', 'debito', 'Gastos com Serviços de Terceiros'),
    (_clinica_id, 31, '8.1', 'ANÚNCIOS', 'debito', 'Gastos com Marketing'),
    (_clinica_id, 32, '8.2', 'PROPAGANDA', 'debito', 'Gastos com Marketing'),
    (_clinica_id, 33, '8.3', 'CAMPANHAS', 'debito', 'Gastos com Marketing'),
    (_clinica_id, 34, '9.1', 'JUROS DE APLICAÇÕES', 'credito', 'Receitas não Operacionais'),
    (_clinica_id, 35, '9.2', 'OUTRAS RECEITAS NÃO OPERACIONAIS', 'credito', 'Receitas não Operacionais'),
    (_clinica_id, 36, '23.1', 'JUROS POR ATRASO', 'debito', 'Juros'),
    (_clinica_id, 37, '22.1', 'TARIFAS BANCÁRIAS', 'debito', 'Taxas e Tarifas Bancárias'),
    (_clinica_id, 38, '10.3', 'OUTROS GASTOS NÃO OPERACIONAIS', 'debito', 'Gastos não Operacionais'),
    (_clinica_id, 41, '12.1', 'INVESTIMENTOS GERAIS', 'debito', 'Investimentos'),
    (_clinica_id, 42, '13.1', 'TRANSFERÊNCIA ENTRE CONTAS PRÓPRIAS - EFETUADAS', 'debito', 'Transferências e Ajustes de Saldo'),
    (_clinica_id, 43, '13.2', 'AJUSTE DE SALDO', 'debito', 'Transferências e Ajustes de Saldo'),
    (_clinica_id, 44, '14.1', 'TRANSFERÊNCIA CONTRA PRÓPRIA - RECEBIDA', 'credito', 'Transferências e Ajustes de Saldo'),
    (_clinica_id, 45, '14.2', 'AJUSTE DE SALDO', 'credito', 'Transferências e Ajustes de Saldo'),
    (_clinica_id, 46, '6.6', 'CONDOMÍNIO', 'debito', 'Gastos fixos'),
    (_clinica_id, 47, '6.7', 'IPTU', 'debito', 'Gastos fixos'),
    (_clinica_id, 48, '15.3', 'SHD - HOLTER', 'debito', 'Locação de equipamentos'),
    (_clinica_id, 49, '15.2', 'TELECLINI - ESPIROMETRIA E MAPA', 'debito', 'Locação de equipamentos'),
    (_clinica_id, 50, '6.8', 'FEEGOW - SISTEMA OPERACIONAL', 'debito', 'Gastos fixos'),
    (_clinica_id, 51, '6.9', 'VERTEC - COLETA DE RESÍDUOS', 'debito', 'Gastos fixos'),
    (_clinica_id, 52, '6.10', 'CLOUDIA - SISTEMA DE WHATSAPP', 'debito', 'Gastos fixos'),
    (_clinica_id, 53, '5.7', 'CIEE - Agenciamento estágio', 'debito', 'Gastos com Pessoal'),
    (_clinica_id, 54, '6.15', 'HM1 - IMPRESSORAS', 'debito', 'Gastos fixos'),
    (_clinica_id, 55, '6.11', 'INDESK - SISTEMA DE SENHAS', 'debito', 'Gastos fixos'),
    (_clinica_id, 56, '6.12', 'ZL - SISTEMA ENVIO MENSAGEM EM MASSA', 'debito', 'Gastos fixos'),
    (_clinica_id, 57, '5.8', 'RT MÉDICA', 'debito', 'Gastos com Pessoal'),
    (_clinica_id, 58, '5.9', 'RT LABORATÓRIO', 'debito', 'Gastos com Pessoal'),
    (_clinica_id, 59, '16.1', 'INSS', 'debito', 'Impostos RH'),
    (_clinica_id, 60, '16.2', 'FGTS', 'debito', 'Impostos RH'),
    (_clinica_id, 61, '10.5', 'TAXA SANITÁRIA', 'debito', 'Gastos não Operacionais'),
    (_clinica_id, 62, '10.4', 'ANUIDADE CREMERJ', 'debito', 'Gastos não Operacionais'),
    (_clinica_id, 63, '17.3', 'MANUTENÇÕES - INFRA', 'debito', 'Gastos eventuais'),
    (_clinica_id, 64, '17.4', 'UNIFORME', 'debito', 'Gastos eventuais'),
    (_clinica_id, 65, '4.5', 'MATERIAIS GRÁFICOS', 'debito', 'Custos Variáveis'),
    (_clinica_id, 66, '18.1', 'FAMP', 'debito', 'Empréstimos'),
    (_clinica_id, 67, '18.2', 'PRONAMP', 'debito', 'Empréstimos'),
    (_clinica_id, 68, '18.3', 'FGI', 'debito', 'Empréstimos'),
    (_clinica_id, 69, '6.13', 'SEGURO DO ESTABELECIMENTO', 'debito', 'Gastos fixos'),
    (_clinica_id, 70, '5.10', 'SEGURO COLABORADORES', 'debito', 'Gastos com Pessoal'),
    (_clinica_id, 71, '8.4', 'SHARK - AGÊNCIA DE MARKETING', 'debito', 'Gastos com Marketing'),
    (_clinica_id, 72, '6.14', 'LOCAÇÃO 248', 'debito', 'Gastos fixos'),
    (_clinica_id, 73, '4.6', 'BRINDES', 'debito', 'Custos Variáveis'),
    (_clinica_id, 74, '5.11', 'COMISSÃO', 'debito', 'Gastos com Pessoal'),
    (_clinica_id, 76, '18.5', 'EMPRÉSTIMOS', 'debito', 'Empréstimos'),
    (_clinica_id, 77, '9.3', 'EMPRÉSTIMOS', 'credito', 'Receitas não Operacionais'),
    (_clinica_id, 79, '7.4', 'JVA SAÚDE LTDA - LAB E USG', 'debito', 'Gastos com Serviços de Terceiros'),
    (_clinica_id, 80, '3.5', 'ESTORNO PACIENTE', 'debito', 'Outras Deduções'),
    (_clinica_id, 81, '4.7', 'TRANSPORTE OPERACIONAL', 'debito', 'Custos Variáveis'),
    (_clinica_id, 82, '24.1', 'CARTÃO DE CRÉDITO', 'debito', 'Gastos Variáveis'),
    (_clinica_id, 83, '19.1', 'MÃO DE OBRA MÉDICA E TERAPÊUTICA', 'debito', 'Mão de obra médica e terapêutica'),
    (_clinica_id, 84, '9.4', 'Rendimento Conta', 'credito', 'Receitas não Operacionais'),
    (_clinica_id, 85, '3.6', 'ESTORNO DE RENDIMENTO CONTA', 'debito', 'Outras Deduções'),
    (_clinica_id, 86, '6.17', 'Verisure - Alarme', 'debito', 'Gastos fixos'),
    (_clinica_id, 87, '4.8', 'InterSaúde', 'debito', 'Custos Variáveis'),
    (_clinica_id, 88, '4.9', 'FATURISTA', 'debito', 'Custos Variáveis'),
    (_clinica_id, 89, '1.3', 'GLOSAS - RECEBIMENTO', 'credito', 'Receita com Vendas')
  ON CONFLICT (clinica_id, codigo) DO NOTHING;
END;
$$;

-- Update onboard_clinica to also seed plano de contas
CREATE OR REPLACE FUNCTION public.onboard_clinica(
  _nome_clinica text,
  _cnpj text DEFAULT NULL,
  _nome_usuario text DEFAULT NULL,
  _email_usuario text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clinica_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'Usuário já vinculado a uma clínica';
  END IF;

  INSERT INTO public.clinicas (nome, cnpj)
  VALUES (_nome_clinica, _cnpj)
  RETURNING id INTO _clinica_id;

  INSERT INTO public.usuarios (user_id, clinica_id, nome, email)
  VALUES (_user_id, _clinica_id, COALESCE(_nome_usuario, ''), _email_usuario);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin');

  -- Seed plano de contas
  PERFORM public.seed_plano_contas(_clinica_id);

  RETURN _clinica_id;
END;
$$;
