import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageHeader, KpiCards, DataTable, StatusBadge } from "@/components/medicpop";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";
import { Stethoscope, Monitor } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

export default function SalaEspera() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [medicoFilter, setMedicoFilter] = useState("todos");
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const { data: fila = [], isLoading } = useQuery({
    queryKey: ["sala-espera", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("checkins")
        .select("*, pacientes(nome, cpf), medicos(id, nome, especialidade), agendamentos(data_hora)")
        .eq("clinica_id", clinicaId)
        .gte("hora_checkin", today)
        .in("status", ["aguardando", "em_atendimento"])
        .order("hora_checkin");
      return data || [];
    },
    enabled: !!clinicaId,
    refetchInterval: 10000,
  });

  const { data: medicos = [] } = useQuery({
    queryKey: ["medicos-se", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("medicos").select("id, nome").eq("clinica_id", clinicaId).eq("ativo", true).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const chamarPaciente = useMutation({
    mutationFn: async (checkin: any) => {
      await supabase.from("chamadas_paciente").insert({
        clinica_id: clinicaId,
        checkin_id: checkin.id,
        paciente_nome: checkin.pacientes?.nome || "Paciente",
        consultorio: checkin.sala_id ? `Consultório ${checkin.sala_id}` : "Consultório 1",
      } as any);
      await supabase.from("checkins").update({ hora_chamada: new Date().toISOString() } as any).eq("id", checkin.id);
    },
    onSuccess: () => {
      toast.success("Paciente chamado na TV!");
      queryClient.invalidateQueries({ queryKey: ["sala-espera"] });
    },
  });

  const filteredFila = medicoFilter === "todos" ? fila : fila.filter((c: any) => c.medico_id === medicoFilter);

  const getTempoEspera = (t: string) => differenceInMinutes(new Date(), new Date(t));
  const getTempoColor = (mins: number) => mins < 15 ? "#1D9E75" : mins < 30 ? "#BA7517" : "#E24B4A";

  const kpis = [
    { label: "Na fila", value: filteredFila.filter((c: any) => c.status === "aguardando").length, isCurrency: false },
    { label: "Em atendimento", value: filteredFila.filter((c: any) => c.status === "em_atendimento").length, isCurrency: false, sublabelColor: "#378ADD" },
    { label: "Tempo médio", value: filteredFila.length > 0 ? `${Math.round(filteredFila.reduce((s: number, c: any) => s + getTempoEspera(c.hora_checkin), 0) / filteredFila.length)} min` : "0 min", isCurrency: false },
    { label: "Maior espera", value: filteredFila.length > 0 ? `${Math.max(...filteredFila.map((c: any) => getTempoEspera(c.hora_checkin)))} min` : "0 min", isCurrency: false, sublabelColor: "#E24B4A" },
  ];

  const columns = [
    { key: "checkin", header: "Check-in", width: "10%", render: (row: any) => <span className="font-mono text-[13px]">{format(new Date(row.hora_checkin), "HH:mm")}</span> },
    { key: "agendamento", header: "Agendado", width: "10%", render: (row: any) => <span className="text-[13px]" style={{ color: "#666" }}>{row.agendamentos?.data_hora ? format(new Date(row.agendamentos.data_hora), "HH:mm") : "—"}</span> },
    { key: "paciente", header: "Paciente", width: "22%", render: (row: any) => (<div><p className="font-medium text-[13px]" style={{ color: "#2C3E50" }}>{row.pacientes?.nome}</p><p className="text-[11px]" style={{ color: "#666" }}>{row.pacientes?.cpf || ""}</p></div>) },
    { key: "medico", header: "Profissional", width: "18%", render: (row: any) => (<div><p className="text-[13px]">{row.medicos?.nome}</p><p className="text-[11px]" style={{ color: "#666" }}>{row.medicos?.especialidade}</p></div>) },
    { key: "tempo", header: "Tempo de espera", width: "15%", render: (row: any) => { const m = getTempoEspera(row.hora_checkin); return <span className="text-[13px] font-medium" style={{ color: getTempoColor(m) }}>{m} min</span>; } },
    { key: "status", header: "Status", width: "10%", align: "center" as const, render: (row: any) => <StatusBadge status={row.status === "em_atendimento" ? "em_atendimento" : "checkin"} type="agendamento" label={row.status === "em_atendimento" ? "Em atendimento" : "Aguardando"} /> },
    { key: "acoes", header: "", width: "15%", align: "center" as const, render: (row: any) => (
      <div className="flex gap-1">
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => chamarPaciente.mutate(row)}><Monitor className="h-3 w-3" /> Chamar</Button>
        <Button size="sm" className="h-7 text-[11px] gap-1" style={{ background: "#1B5E7B", color: "white" }}><Stethoscope className="h-3 w-3" /> Atender</Button>
      </div>
    )},
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader title="Sala de Espera" subtitle={`${format(new Date(), "dd/MM/yyyy")} — Pacientes aguardando`}
          actions={<Select value={medicoFilter} onValueChange={setMedicoFilter}><SelectTrigger className="w-[200px] h-9 text-[13px]"><SelectValue placeholder="Todos os médicos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{medicos.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent></Select>}
        />
        <KpiCards items={kpis} />
        <DataTable columns={columns} data={filteredFila} loading={isLoading} emptyMessage="Nenhum paciente na fila" exportFilename="sala-espera" exportTitle="Sala de Espera" />
        <p className="text-[11px] text-center" style={{ color: "#666" }}>A lista de espera NUNCA aparece na TV. Apenas nome + consultorio ao chamar.</p>
      </div>
    </DashboardLayout>
  );
}
