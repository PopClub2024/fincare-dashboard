// WhatsApp CRM Types adapted from WhatsApp Clinica project

export type ConversationStatus = 'ia' | 'humano' | 'fila_espera';
export type MessageDirection = 'enviada' | 'recebida';
export type MessageContentType = 'texto' | 'imagem' | 'audio' | 'documento' | 'video';

export interface WhatsAppConversation {
  id: string;
  clinica_id: string;
  nome_contato: string | null;
  telefone: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  pipeline_etapa: string | null;
  atendimento: string | null;
  atendente_id: string | null;
  tags: string[] | null;
  nao_lidas: number | null;
  created_at: string | null;
}

export interface WhatsAppMessage {
  id: string;
  clinica_id: string;
  conversa_id: string;
  direcao: MessageDirection;
  remetente: string | null;
  tipo_conteudo: MessageContentType;
  texto: string | null;
  midia_url: string | null;
  audio_transcricao: string | null;
  audio_duracao_segundos: number | null;
  status: string | null;
  created_at: string;
}

export interface WhatsAppTag {
  id: string;
  clinica_id: string;
  nome: string;
  cor: string | null;
}

export interface WhatsAppDeal {
  id: string;
  clinica_id: string;
  stage_id: string | null;
  conversa_id: string | null;
  paciente_id: string | null;
  title: string;
  value: number;
  priority: string;
  tags: string[];
  deal_type: string;
  owner_id: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  scheduled_at: string | null;
  confirmed_at: string | null;
  attended_at: string | null;
  canceled_at: string | null;
  no_show_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppPipelineStage {
  id: string;
  clinica_id: string;
  title: string;
  color: string;
  position: number;
  is_system: boolean;
  is_active: boolean;
  is_ai_managed: boolean;
}

export interface WhatsAppInsightItem {
  id: string;
  clinica_id: string;
  run_id: string | null;
  category: string;
  title: string;
  summary: string | null;
  metrics: any;
  evidence: any;
  recommended_actions: any;
  priority: string;
  impact_estimate: any;
  confidence: string;
  created_at: string;
}

export interface WhatsAppInsightRun {
  id: string;
  clinica_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  period_start: string | null;
  period_end: string | null;
  run_type: string;
  conversations_analyzed: number;
}

export interface WhatsAppInitiative {
  id: string;
  clinica_id: string;
  title: string;
  description: string | null;
  category: string | null;
  effort: string;
  status: string;
  created_at: string;
}

export interface StatMetric {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
}

export const PIPELINE_ETAPAS = [
  { key: "novo_contato", label: "Novo Contato", cor: "#3b82f6" },
  { key: "primeiro_contato", label: "1o Contato", cor: "#8b5cf6" },
  { key: "interessado", label: "Interessado", cor: "#f59e0b" },
  { key: "agendamento_pendente", label: "Agend. Pendente", cor: "#f97316" },
  { key: "agendado", label: "Agendou", cor: "#10b981" },
  { key: "confirmado", label: "Confirmou", cor: "#22c55e" },
  { key: "atendido", label: "Atendido", cor: "#14b8a6" },
  { key: "pos_atendimento", label: "Pos-Atend.", cor: "#06b6d4" },
  { key: "retorno_pendente", label: "Retorno Pend.", cor: "#a855f7" },
  { key: "cancelou", label: "Cancelou", cor: "#ef4444" },
  { key: "faltou", label: "Faltou", cor: "#f97316" },
  { key: "so_conhecendo", label: "So Conhecendo", cor: "#6b7280" },
  { key: "perdido", label: "Perdido", cor: "#9ca3af" },
];
