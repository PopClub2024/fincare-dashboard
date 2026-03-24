// =============================================
// MEDIC POP — Design Tokens v2.0
// Paleta de cores, tipografia e constantes visuais
// Baseado no Guia de Implementação Financeiro
// =============================================

// Cores primárias
export const COLORS = {
  accent: "#1B5E7B",       // Azul petróleo — botões primários, headers, links
  textPrimary: "#2C3E50",  // Dark slate — texto principal
  textSecondary: "#666666", // Cinza médio — labels, subtítulos
  bgPrimary: "#FFFFFF",    // Branco — cards, modais
  bgSecondary: "#F5F5F5",  // Cinza claro — KPI cards, linhas alternadas
  border: "#E5E5E5",       // Cinza borda — tabelas, inputs
} as const;

// Cores semânticas (status e badges)
export const STATUS_COLORS = {
  pago:    { bg: "#E1F5EE", text: "#1D9E75" },  // Verde teal
  aberto:  { bg: "#E6F1FB", text: "#378ADD" },  // Azul
  vencido: { bg: "#FCEBEB", text: "#E24B4A" },  // Vermelho
  alerta:  { bg: "#FAEEDA", text: "#BA7517" },  // Âmbar
  roxo:    { bg: "#EEEDFE", text: "#534AB7" },  // Roxo — convênio, marketing
  neutro:  { bg: "#F1EFE8", text: "#5F5E5A" },  // Cinza
} as const;

// Tags de forma de pagamento
export const FORMA_PAGAMENTO_TAGS: Record<string, { bg: string; text: string; label: string }> = {
  pix:               { bg: "rgba(29,158,117,0.08)", text: "#1D9E75", label: "PIX" },
  dinheiro:          { bg: "rgba(136,135,128,0.08)", text: "#5F5E5A", label: "Dinheiro" },
  credito:           { bg: "rgba(55,138,221,0.08)",  text: "#378ADD", label: "Crédito" },
  cartao_credito:    { bg: "rgba(55,138,221,0.08)",  text: "#378ADD", label: "Crédito" },
  debito:            { bg: "rgba(186,117,23,0.08)",  text: "#BA7517", label: "Débito" },
  cartao_debito:     { bg: "rgba(186,117,23,0.08)",  text: "#BA7517", label: "Débito" },
  debito_automatico: { bg: "rgba(186,117,23,0.08)",  text: "#BA7517", label: "Déb. auto" },
  convenio:          { bg: "rgba(83,74,183,0.08)",   text: "#534AB7", label: "Convênio" },
  convenio_nf:       { bg: "rgba(83,74,183,0.08)",   text: "#534AB7", label: "Convênio" },
  boleto:            { bg: "rgba(136,135,128,0.08)", text: "#5F5E5A", label: "Boleto" },
  transferencia:     { bg: "rgba(55,138,221,0.08)",  text: "#378ADD", label: "Transf." },
  ted_doc:           { bg: "rgba(55,138,221,0.08)",  text: "#378ADD", label: "TED/DOC" },
  particular_pix:    { bg: "rgba(29,158,117,0.08)", text: "#1D9E75", label: "PIX" },
  particular_dinheiro: { bg: "rgba(136,135,128,0.08)", text: "#5F5E5A", label: "Dinheiro" },
  particular_cartao: { bg: "rgba(55,138,221,0.08)",  text: "#378ADD", label: "Cartão" },
};

// Tags de centro de custo
export const CENTRO_CUSTO_TAGS: Record<string, { bg: string; text: string; label: string }> = {
  marketing:      { bg: "rgba(83,74,183,0.08)",   text: "#534AB7", label: "Marketing" },
  rh:             { bg: "rgba(55,138,221,0.08)",   text: "#378ADD", label: "RH" },
  medico:         { bg: "rgba(29,158,117,0.08)",   text: "#1D9E75", label: "Médico" },
  administrativo: { bg: "rgba(136,135,128,0.1)",   text: "#5F5E5A", label: "Fixo" },
  fixo:           { bg: "rgba(136,135,128,0.1)",   text: "#5F5E5A", label: "Fixo" },
  asg:            { bg: "rgba(186,117,23,0.08)",   text: "#BA7517", label: "ASG" },
  juridico:       { bg: "rgba(83,74,183,0.08)",    text: "#534AB7", label: "Jurídico" },
};

// Status de agendamento
export const AGENDAMENTO_STATUS: Record<string, { bg: string; text: string; icon: string }> = {
  agendado:               { bg: "#F1EFE8", text: "#5F5E5A", icon: "circle" },
  confirmado:             { bg: "#E1F5EE", text: "#1D9E75", icon: "check" },
  nao_confirmado:         { bg: "#F1EFE8", text: "#5F5E5A", icon: "circle" },
  checkin:                { bg: "#FAEEDA", text: "#BA7517", icon: "clock" },
  em_atendimento:         { bg: "#E6F1FB", text: "#378ADD", icon: "stethoscope" },
  atendido:               { bg: "#E1F5EE", text: "#1D9E75", icon: "check-double" },
  faltou:                 { bg: "#FCEBEB", text: "#E24B4A", icon: "x" },
  cancelado:              { bg: "#FCEBEB", text: "#E24B4A", icon: "x" },
  remarcado_paciente:     { bg: "#E6F1FB", text: "#378ADD", icon: "arrow" },
  remarcado_profissional: { bg: "#FAEEDA", text: "#BA7517", icon: "arrow" },
};

// Status de guias TISS
export const GUIA_STATUS: Record<string, { bg: string; text: string }> = {
  gerada:          { bg: "#FAEEDA", text: "#BA7517" },
  pendente_token:  { bg: "#FAEEDA", text: "#BA7517" },
  lancada_portal:  { bg: "#E6F1FB", text: "#378ADD" },
  em_lote:         { bg: "#EEEDFE", text: "#534AB7" },
  confirmada:      { bg: "#E1F5EE", text: "#1D9E75" },
  paga:            { bg: "#E1F5EE", text: "#1D9E75" },
  glosada:         { bg: "#FCEBEB", text: "#E24B4A" },
};

// Taxas padrão por forma de pagamento
export const TAXAS_PADRAO: Record<string, number> = {
  pix: 0,
  dinheiro: 0,
  credito: 4,
  cartao_credito: 4,
  debito: 1.5,
  cartao_debito: 1.5,
  convenio: 0,
  boleto: 0,
  transferencia: 0,
};

// Formatação monetária
export const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export const formatPercent = (v: number) =>
  `${v.toFixed(1)}%`;
