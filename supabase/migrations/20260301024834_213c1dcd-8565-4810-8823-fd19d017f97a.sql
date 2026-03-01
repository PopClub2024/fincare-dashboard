
-- Função SECURITY DEFINER para onboarding atômico: cria clínica + usuário + role admin
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

  -- Verificar se usuário já tem clínica
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'Usuário já vinculado a uma clínica';
  END IF;

  -- Criar clínica
  INSERT INTO public.clinicas (nome, cnpj)
  VALUES (_nome_clinica, _cnpj)
  RETURNING id INTO _clinica_id;

  -- Criar perfil do usuário
  INSERT INTO public.usuarios (user_id, clinica_id, nome, email)
  VALUES (_user_id, _clinica_id, COALESCE(_nome_usuario, ''), _email_usuario);

  -- Atribuir role admin ao primeiro usuário
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin');

  RETURN _clinica_id;
END;
$$;
