import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay, isWithinInterval, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, AlertCircle, Circle, ArrowRightCircle } from "lucide-react";
import { KpiCards, FilterPills, StatusBadge, PageHeader, formatCurrency, AGENDAMENTO_STATUS } from "@/components/medicpop";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

// Maps status key to badge colors per PDF spec
function getStatusStyle(status: string): { bg: string; text: string } {
  const s = AGENDAMENTO_STATUS[status];
  if (s) return { bg: s.bg, text: s.text };
  return { bg: "#F1EFE8", text: "#5F5E5A" };
}

// Icon per status
function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  const color = AGENDAMENTO_STATUS[status]?.text || "#5F5E5A";
  const style = { color, width: size, height: size, flexShrink: 0 };
  if (status === "atendido" || status === "confirmado") return <CheckCircle2 style={style} />;
  if (status === "cancelado" || status === "faltou") return <XCircle style={style} />;
  if (status === "checkin" || status === "em_atendimento") return <AlertCircle style={style} />;
  if (status === "remarcado_paciente" || status === "remarcado_profissional") return <ArrowRightCircle style={style} />;
  return <Circle style={style} />;
}

// Human-readable status labels
const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  nao_confirmado: "Não confirmado",
  checkin: "Check-in",
  em_atendimento: "Em atendimento",
  atendido: "Atendido",
  faltou: "Faltou",
  cancelado: "Cancelado",
  remarcado_paciente: "Remarcado (pac.)",
  remarcado_profissional: "Remarcado (prof.)",
};

// Cancelled / rescheduled statuses for the bottom section
const CANCELLED_STATUSES = new Set(["cancelado", "faltou", "remarcado_paciente", "remarcado_profissional"]);

export default function Agenda() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"dia" | "semana">("semana");
  const [medicoFilter, setMedicoFilter] = useState("todos");
  const [especialidadeFilter, setEspecialidadeFilter] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [form, setForm] = useState({
    paciente_id: "",
    medico_id: "",
    data_hora: "",
    duracao_minutos: "30",
    observacoes: "",
  });

  const now = new Date();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  // ── Supabase queries ────────────────────────────────────────────────────────
  const { data: medicos = [] } = useQuery({
    queryKey: ["medicos", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("medicos")
        .select("*")
        .eq("clinica_id", clinicaId)
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos", clinicaId, currentDate.toISOString()],
    queryFn: async () => {
      if (!clinicaId) return [];
      const start =
        view === "dia"
          ? format(currentDate, "yyyy-MM-dd")
          : format(weekStart, "yyyy-MM-dd");
      const end =
        view === "dia"
          ? format(addDays(currentDate, 1), "yyyy-MM-dd")
          : format(addDays(weekStart, 7), "yyyy-MM-dd");
      const { data } = await supabase
        .from("agendamentos")
        .select("*, pacientes(nome, telefone), medicos(nome, especialidade)")
        .eq("clinica_id", clinicaId)
        .gte("data_hora", start)
        .lt("data_hora", end)
        .order("data_hora");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-select", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome")
        .eq("clinica_id", clinicaId)
        .order("nome")
        .limit(500);
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // ── Mutation ────────────────────────────────────────────────────────────────
  const criarAgendamento = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("agendamentos").insert({
        clinica_id: clinicaId,
        paciente_id: form.paciente_id,
        medico_id: form.medico_id,
        data_hora: form.data_hora,
        duracao_minutos: parseInt(form.duracao_minutos),
        observacoes: form.observacoes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado!");
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      setDialogOpen(false);
      setForm({ paciente_id: "", medico_id: "", data_hora: "", duracao_minutos: "30", observacoes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Derived data ────────────────────────────────────────────────────────────
  const especialidades = Array.from(
    new Set((medicos as any[]).map((m) => m.especialidade).filter(Boolean))
  );

  const filteredAgendamentos = (agendamentos as any[]).filter((a) => {
    if (medicoFilter !== "todos" && a.medico_id !== medicoFilter) return false;
    if (
      especialidadeFilter !== "todas" &&
      a.medicos?.especialidade !== especialidadeFilter
    )
      return false;
    if (
      searchValue &&
      !a.pacientes?.nome?.toLowerCase().includes(searchValue.toLowerCase()) &&
      !a.medicos?.nome?.toLowerCase().includes(searchValue.toLowerCase())
    )
      return false;
    return true;
  });

  const getAgendamentosByDay = (day: Date) =>
    filteredAgendamentos.filter((a) => isSameDay(new Date(a.data_hora), day));

  // KPI counts
  const totalDia = getAgendamentosByDay(now).length;
  const confirmados = getAgendamentosByDay(now).filter(
    (a) => a.status === "confirmado" || a.status === "checkin"
  ).length;
  const atendidos = getAgendamentosByDay(now).filter(
    (a) => a.status === "atendido"
  ).length;
  const canceladosDia = getAgendamentosByDay(now).filter((a) =>
    CANCELLED_STATUSES.has(a.status)
  ).length;

  // Active agendamentos (non-cancelled) and cancelled for bottom section
  const activeAgendamentos = filteredAgendamentos.filter(
    (a) => !CANCELLED_STATUSES.has(a.status)
  );
  const cancelledAgendamentos = filteredAgendamentos.filter((a) =>
    CANCELLED_STATUSES.has(a.status)
  );

  // Helpers
  const navigate = (dir: number) =>
    setCurrentDate((d) => addDays(d, view === "dia" ? dir : dir * 7));

  const isCurrentTimeSlot = (a: any) => {
    const start = new Date(a.data_hora);
    const end = addMinutes(start, a.duracao_minutos || 30);
    return isWithinInterval(now, { start, end });
  };

  const dateLabel =
    view === "dia"
      ? format(currentDate, "dd 'de' MMMM yyyy", { locale: ptBR })
      : `${format(weekStart, "dd/MM")} — ${format(addDays(weekStart, 6), "dd/MM/yyyy")}`;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* ── Section 1: Header ── */}
        <PageHeader
          title="Agenda Médica"
          subtitle="Visão geral de agendamentos"
          actions={
            <div className="flex items-center gap-2">
              <ExportButtons
                data={flattenForExport(agendamentos, {
                  Horario: (r: any) => r.data_hora,
                  Paciente: (r: any) => r.pacientes?.nome,
                  Medico: (r: any) => r.medicos?.nome,
                  Status: "status",
                })}
                filename="agenda"
                titulo="Agenda Medica"
              />
              {/* Date navigation */}
              <div className="flex items-center gap-1 rounded-lg border px-2 py-1" style={{ borderColor: "#E5E5E5" }}>
                <button
                  onClick={() => navigate(-1)}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-4 w-4" style={{ color: "#2C3E50" }} />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-2 text-[13px] font-medium rounded hover:bg-gray-100 transition-colors"
                  style={{ color: "#1B5E7B" }}
                >
                  Hoje
                </button>
                <button
                  onClick={() => navigate(1)}
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  aria-label="Próximo"
                >
                  <ChevronRight className="h-4 w-4" style={{ color: "#2C3E50" }} />
                </button>
              </div>
              <span className="text-[13px] font-medium" style={{ color: "#2C3E50" }}>
                {dateLabel}
              </span>
              {/* View toggle */}
              <div
                className="flex rounded-lg overflow-hidden border"
                style={{ borderColor: "#E5E5E5" }}
              >
                {(["semana", "dia"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className="px-3 py-1.5 text-[13px] font-medium transition-colors"
                    style={
                      view === v
                        ? { background: "#1B5E7B", color: "white" }
                        : { background: "white", color: "#666" }
                    }
                  >
                    {v === "dia" ? "Dia" : "Semana"}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        {/* ── KPI Cards ── */}
        <KpiCards
          cards={[
            { label: "Agendamentos hoje", value: totalDia, icon: "calendar" },
            { label: "Confirmados / Check-in", value: confirmados, color: "green" },
            { label: "Atendidos", value: atendidos, color: "green" },
            { label: "Cancelados / Faltou", value: canceladosDia, color: "red" },
          ]}
        />

        {/* ── Section 2: Filters bar ── */}
        <div
          className="flex items-center gap-3 flex-wrap rounded-xl px-4 py-3"
          style={{ background: "#F5F5F5", border: "1px solid #E5E5E5" }}
        >
          {/* Médico select */}
          <Select value={medicoFilter} onValueChange={setMedicoFilter}>
            <SelectTrigger
              className="h-9 w-[200px] text-[13px] rounded-lg bg-white"
              style={{ borderColor: "#E5E5E5" }}
            >
              <SelectValue placeholder="Todos os médicos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os médicos</SelectItem>
              {(medicos as any[]).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Especialidade select */}
          <Select value={especialidadeFilter} onValueChange={setEspecialidadeFilter}>
            <SelectTrigger
              className="h-9 w-[200px] text-[13px] rounded-lg bg-white"
              style={{ borderColor: "#E5E5E5" }}
            >
              <SelectValue placeholder="Todas as especialidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as especialidades</SelectItem>
              {especialidades.map((esp: any) => (
                <SelectItem key={esp} value={esp}>
                  {esp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative">
            <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5" style={{ color: "#888" }} />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Buscar paciente ou médico..."
              className="h-9 w-[220px] pl-8 text-[13px] rounded-lg bg-white"
              style={{ borderColor: "#E5E5E5" }}
            />
          </div>

          <div className="ml-auto">
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="h-9 gap-1.5 text-[13px] font-semibold rounded-lg"
              style={{ background: "#1B5E7B", color: "white" }}
            >
              <Plus className="h-3.5 w-3.5" /> Novo Agendamento
            </Button>
          </div>
        </div>

        {/* ── Section 3: Views ── */}

        {/* Weekly view */}
        {view === "semana" ? (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const daySlots = getAgendamentosByDay(day);
              const isToday = isSameDay(day, now);
              return (
                <div
                  key={day.toISOString()}
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: isToday ? "2px solid #1B5E7B" : "1px solid #E5E5E5",
                    background: "#FFFFFF",
                  }}
                >
                  {/* Day header */}
                  <div
                    className="px-2 py-2 text-center"
                    style={{
                      background: isToday ? "#1B5E7B" : "#F5F5F5",
                      borderBottom: "1px solid #E5E5E5",
                    }}
                  >
                    <div
                      className="text-[11px] uppercase tracking-wide"
                      style={{ color: isToday ? "rgba(255,255,255,0.8)" : "#888" }}
                    >
                      {format(day, "EEE", { locale: ptBR })}
                    </div>
                    <div
                      className="text-[15px] font-bold leading-tight"
                      style={{ color: isToday ? "white" : "#2C3E50" }}
                    >
                      {format(day, "dd/MM")}
                    </div>
                  </div>

                  {/* Slots */}
                  <div className="p-1.5 space-y-1 min-h-[80px]">
                    {daySlots.length === 0 ? (
                      <div
                        className="text-center text-[10px] py-4"
                        style={{ color: "#CCC" }}
                      >
                        —
                      </div>
                    ) : (
                      daySlots.map((a: any) => {
                        const isCurrent = isCurrentTimeSlot(a);
                        const style = isCurrent
                          ? { bg: "#1B5E7B", text: "white" }
                          : getStatusStyle(a.status);
                        return (
                          <div
                            key={a.id}
                            className="rounded-md px-1.5 py-1 text-[11px] cursor-default"
                            style={{ background: style.bg, color: style.text }}
                          >
                            <div className="flex items-center gap-1 font-semibold">
                              <Clock
                                style={{ width: 10, height: 10, flexShrink: 0, opacity: 0.8 }}
                              />
                              {format(new Date(a.data_hora), "HH:mm")}
                            </div>
                            <div className="truncate font-medium leading-tight mt-0.5">
                              {a.pacientes?.nome || "—"}
                            </div>
                            <div
                              className="truncate leading-tight"
                              style={{ opacity: 0.75, fontSize: 10 }}
                            >
                              {a.medicos?.nome || "—"}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Daily view */
          <Card style={{ border: "1px solid #E5E5E5" }}>
            <CardContent className="p-0">
              {activeAgendamentos.filter((a) =>
                isSameDay(new Date(a.data_hora), currentDate)
              ).length === 0 ? (
                <div
                  className="text-center py-12 text-[14px]"
                  style={{ color: "#888" }}
                >
                  Nenhum agendamento para este dia
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "#E5E5E5" }}>
                  {activeAgendamentos
                    .filter((a) => isSameDay(new Date(a.data_hora), currentDate))
                    .map((a: any, idx) => {
                      const isCurrent = isCurrentTimeSlot(a);
                      const statusStyle = getStatusStyle(a.status);
                      const isConvenio =
                        a.tipo_atendimento === "convenio" ||
                        a.medicos?.especialidade?.toLowerCase().includes("conv");
                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-4 px-4 py-3"
                          style={{
                            background:
                              isCurrent
                                ? "rgba(27,94,123,0.06)"
                                : idx % 2 === 1
                                ? "#F9F9F9"
                                : "#FFFFFF",
                            borderLeft: isCurrent ? "3px solid #1B5E7B" : "3px solid transparent",
                          }}
                        >
                          {/* Time badge */}
                          <div
                            className="rounded-md px-2 py-1 text-[12px] font-mono font-bold min-w-[52px] text-center"
                            style={{
                              background: isCurrent ? "#1B5E7B" : statusStyle.bg,
                              color: isCurrent ? "white" : statusStyle.text,
                            }}
                          >
                            {format(new Date(a.data_hora), "HH:mm")}
                          </div>

                          {/* Status icon */}
                          <StatusIcon status={a.status} size={16} />

                          {/* Patient + doctor */}
                          <div className="flex-1 min-w-0">
                            <p
                              className="truncate font-medium"
                              style={{ fontSize: 14, color: "#2C3E50" }}
                            >
                              {a.pacientes?.nome || "—"}
                            </p>
                            <p
                              className="truncate"
                              style={{ fontSize: 13, color: "#666" }}
                            >
                              {a.medicos?.nome}
                              {a.medicos?.especialidade
                                ? ` — ${a.medicos.especialidade}`
                                : ""}
                            </p>
                          </div>

                          {/* Status badge */}
                          <StatusBadge
                            status={a.status}
                            type="agendamento"
                            label={STATUS_LABELS[a.status] || a.status}
                          />

                          {/* Type tag */}
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
                            style={
                              isConvenio
                                ? { background: "#EEEDFE", color: "#534AB7" }
                                : { background: "#E1F5EE", color: "#1D9E75" }
                            }
                          >
                            {isConvenio ? "Convênio" : "Particular"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Section 6: Cancelled / rescheduled section ── */}
        {cancelledAgendamentos.length > 0 && (
          <div>
            <div
              className="flex items-center gap-3 mb-3"
              style={{ borderTop: "1.5px dashed #E5E5E5", paddingTop: 16 }}
            >
              <span
                className="text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "#888" }}
              >
                Cancelados / Remarcados
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px]"
                style={{ background: "#FCEBEB", color: "#E24B4A" }}
              >
                {cancelledAgendamentos.length}
              </span>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid #E5E5E5" }}
            >
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ background: "#F5F5F5", borderBottom: "1px solid #E5E5E5" }}>
                    <th
                      className="text-left px-3 py-2 font-semibold"
                      style={{ color: "#888" }}
                    >
                      Horário
                    </th>
                    <th
                      className="text-left px-3 py-2 font-semibold"
                      style={{ color: "#888" }}
                    >
                      Paciente
                    </th>
                    <th
                      className="text-left px-3 py-2 font-semibold"
                      style={{ color: "#888" }}
                    >
                      Médico
                    </th>
                    <th
                      className="text-left px-3 py-2 font-semibold"
                      style={{ color: "#888" }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledAgendamentos.map((a: any, idx) => (
                    <tr
                      key={a.id}
                      style={{
                        background: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                        borderBottom: "1px solid #F0F0F0",
                      }}
                    >
                      <td className="px-3 py-2 font-mono" style={{ color: "#888" }}>
                        {format(new Date(a.data_hora), "dd/MM HH:mm")}
                      </td>
                      <td className="px-3 py-2" style={{ color: "#2C3E50" }}>
                        {a.pacientes?.nome || "—"}
                      </td>
                      <td className="px-3 py-2" style={{ color: "#666" }}>
                        {a.medicos?.nome || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          status={a.status}
                          type="agendamento"
                          label={STATUS_LABELS[a.status] || a.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Agendamento Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: "#2C3E50", fontSize: 18 }}>
              Novo Agendamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Paciente */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium" style={{ color: "#2C3E50" }}>
                Paciente <span style={{ color: "#E24B4A" }}>*</span>
              </Label>
              <Select
                value={form.paciente_id}
                onValueChange={(v) => setForm({ ...form, paciente_id: v })}
              >
                <SelectTrigger
                  className="h-9 text-[13px]"
                  style={{ borderColor: "#E5E5E5" }}
                >
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {(pacientes as any[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Médico */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium" style={{ color: "#2C3E50" }}>
                Médico <span style={{ color: "#E24B4A" }}>*</span>
              </Label>
              <Select
                value={form.medico_id}
                onValueChange={(v) => setForm({ ...form, medico_id: v })}
              >
                <SelectTrigger
                  className="h-9 text-[13px]"
                  style={{ borderColor: "#E5E5E5" }}
                >
                  <SelectValue placeholder="Selecione o médico" />
                </SelectTrigger>
                <SelectContent>
                  {(medicos as any[]).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} — {m.especialidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data e Hora */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium" style={{ color: "#2C3E50" }}>
                Data e Hora <span style={{ color: "#E24B4A" }}>*</span>
              </Label>
              <Input
                type="datetime-local"
                value={form.data_hora}
                onChange={(e) => setForm({ ...form, data_hora: e.target.value })}
                className="h-9 text-[13px]"
                style={{ borderColor: "#E5E5E5" }}
              />
            </div>

            {/* Duração */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium" style={{ color: "#2C3E50" }}>
                Duração (min)
              </Label>
              <Input
                type="number"
                value={form.duracao_minutos}
                onChange={(e) => setForm({ ...form, duracao_minutos: e.target.value })}
                className="h-9 text-[13px]"
                style={{ borderColor: "#E5E5E5" }}
                min={5}
                step={5}
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium" style={{ color: "#2C3E50" }}>
                Observações
              </Label>
              <Input
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Opcional"
                className="h-9 text-[13px]"
                style={{ borderColor: "#E5E5E5" }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 h-9 text-[13px] font-medium"
                style={{ borderColor: "#E5E5E5", color: "#666" }}
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 h-9 text-[13px] font-semibold"
                style={{ background: "#1B5E7B", color: "white" }}
                onClick={() => criarAgendamento.mutate()}
                disabled={
                  !form.paciente_id ||
                  !form.medico_id ||
                  !form.data_hora ||
                  criarAgendamento.isPending
                }
              >
                {criarAgendamento.isPending ? "Agendando..." : "Agendar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
