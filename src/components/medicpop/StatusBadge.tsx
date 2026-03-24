import { STATUS_COLORS, FORMA_PAGAMENTO_TAGS, CENTRO_CUSTO_TAGS, AGENDAMENTO_STATUS, GUIA_STATUS } from "./design-tokens";

interface StatusBadgeProps {
  status: string;
  type?: "financial" | "pagamento" | "centro_custo" | "agendamento" | "guia";
  label?: string;
}

export default function StatusBadge({ status, type = "financial", label }: StatusBadgeProps) {
  let bg = "#F1EFE8";
  let text = "#5F5E5A";
  let displayLabel = label || status;

  if (type === "financial") {
    const s = status.toLowerCase();
    if (s === "pago" || s === "sucesso" || s === "ativo" || s === "confirmada") { bg = STATUS_COLORS.pago.bg; text = STATUS_COLORS.pago.text; }
    else if (s === "aberto" || s === "pendente" || s === "info" || s === "lancada_portal") { bg = STATUS_COLORS.aberto.bg; text = STATUS_COLORS.aberto.text; }
    else if (s === "vencido" || s === "erro" || s === "glosada" || s === "cancelado") { bg = STATUS_COLORS.vencido.bg; text = STATUS_COLORS.vencido.text; }
    else if (s === "parcial" || s === "alerta" || s === "pendente_conciliacao") { bg = STATUS_COLORS.alerta.bg; text = STATUS_COLORS.alerta.text; }
    displayLabel = label || s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
  } else if (type === "pagamento") {
    const tag = FORMA_PAGAMENTO_TAGS[status.toLowerCase()];
    if (tag) { bg = tag.bg; text = tag.text; displayLabel = label || tag.label; }
  } else if (type === "centro_custo") {
    const tag = CENTRO_CUSTO_TAGS[status.toLowerCase()];
    if (tag) { bg = tag.bg; text = tag.text; displayLabel = label || tag.label; }
  } else if (type === "agendamento") {
    const s = AGENDAMENTO_STATUS[status];
    if (s) { bg = s.bg; text = s.text; }
    displayLabel = label || status.replace(/_/g, " ");
  } else if (type === "guia") {
    const s = GUIA_STATUS[status];
    if (s) { bg = s.bg; text = s.text; }
    displayLabel = label || status.replace(/_/g, " ");
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ background: bg, color: text }}
    >
      {displayLabel}
    </span>
  );
}
