/**
 * Busca dados de empresa por CNPJ via API pública (BrasilAPI)
 * Retorna nome, fantasia, endereço, telefone, email
 */
export interface CnpjData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  telefone: string;
  email: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  situacao_cadastral: string;
}

export async function buscarCNPJ(cnpj: string): Promise<CnpjData | null> {
  const cleanCnpj = cnpj.replace(/\D/g, "");
  if (cleanCnpj.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (!res.ok) return null;
    const data = await res.json();

    return {
      cnpj: cleanCnpj,
      razao_social: data.razao_social || "",
      nome_fantasia: data.nome_fantasia || "",
      telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)})${data.ddd_telefone_1.slice(2)}` : "",
      email: data.email || "",
      logradouro: data.logradouro || "",
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      municipio: data.municipio || "",
      uf: data.uf || "",
      cep: data.cep ? data.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "",
      situacao_cadastral: data.descricao_situacao_cadastral || "",
    };
  } catch {
    return null;
  }
}

/**
 * Busca CEP via ViaCEP
 */
export async function buscarCEP(cep: string): Promise<any | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      uf: data.uf,
    };
  } catch {
    return null;
  }
}

/**
 * Formata CNPJ para exibição
 */
export function formatCNPJ(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Formata CPF para exibição
 */
export function formatCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}
