import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInSeconds } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope, FileText, Pill, ArrowRight, Clock,
  User, Save, Sparkles, CheckCircle, AlertCircle,
  Trash2, Edit2, Eye, History, Timer, Play, Pause, Square,
  ClipboardList, FileSignature, Award, Search, RefreshCw,
  ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════ */

type Checkin = {
  id: string;
  clinica_id: string;
  agendamento_id: string | null;
  paciente_id: string | null;
  medico_id: string | null;
  hora_chegada: string | null;
  hora_chamada: string | null;
  hora_inicio_atendimento: string | null;
  hora_fim_atendimento: string | null;
  status: string | null;
  observacao: string | null;
  sala_id: string | null;
  pacientes?: { nome: string; cpf: string | null; data_nascimento: string | null; convenio_id: string | null } | null;
  medicos?: { nome: string; especialidade: string | null } | null;
  agendamentos?: { data: string | null; horario: string | null } | null;
};

type AnamneseForm = {
  queixa_principal: string;
  historia_doenca: string;
  exame_fisico: string;
  antecedentes: string;
  medicamentos: string;
  alergias: string;
  hipotese_diagnostica: string;
  conduta: string;
  observacoes: string;
};

type PrescricaoItem = { medicamento: string; posologia: string; duracao: string };

const emptyAnamnese: AnamneseForm = {
  queixa_principal: "", historia_doenca: "", exame_fisico: "",
  antecedentes: "", medicamentos: "", alergias: "",
  hipotese_diagnostica: "", conduta: "", observacoes: "",
};

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function AreaMedico() {
  const { clinicaId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("fila");
  const [selected, setSelected] = useState<Checkin | null>(null);
  const [searchFila, setSearchFila] = useState("");

  // ── Anamnese state
  const [anamnese, setAnamnese] = useState<AnamneseForm>(emptyAnamnese);
  const [anamneseIA, setAnamneseIA] = useState("");
  const [editingAnamneseId, setEditingAnamneseId] = useState<string | null>(null);

  // ── Prescrição state
  const [prescItens, setPrescItens] = useState<PrescricaoItem[]>([{ medicamento: "", posologia: "", duracao: "" }]);
  const [prescObs, setPrescObs] = useState("");
  const [semPrescricao, setSemPrescricao] = useState(false);
  const [prescricaoIA, setPrescricaoIA] = useState("");
  const [editingPrescId, setEditingPrescId] = useState<string | null>(null);

  // ── Encaminhamento state
  const [encEspecialidade, setEncEspecialidade] = useState("");
  const [encMotivo, setEncMotivo] = useState("");
  const [encObs, setEncObs] = useState("");
  const [semEncaminhamento, setSemEncaminhamento] = useState(false);
  const [encaminhamentoIA, setEncaminhamentoIA] = useState("");
  const [editingEncId, setEditingEncId] = useState<string | null>(null);

  // ── Laudos/Atestados state
  const [laudoTipo, setLaudoTipo] = useState("laudo_medico");
  const [laudoConteudo, setLaudoConteudo] = useState("");
  const [laudoConclusao, setLaudoConclusao] = useState("");
  const [editingLaudoId, setEditingLaudoId] = useState<string | null>(null);

  const [atestadoConteudo, setAtestadoConteudo] = useState("");
  const [atestadoDias, setAtestadoDias] = useState("");
  const [atestadoCid, setAtestadoCid] = useState("");
  const [editingAtestadoId, setEditingAtestadoId] = useState<string | null>(null);

  // ── Cronômetro
  const [cronId, setCronId] = useState<string | null>(null);
  const [cronInicio, setCronInicio] = useState<Date | null>(null);
  const [cronPaused, setCronPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // ── History dialog
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; table: string; title: string }>({ open: false, table: "", title: "" });

  // ── Timer tick
  useEffect(() => {
    if (!cronInicio || cronPaused) return;
    const iv = setInterval(() => setElapsed(differenceInSeconds(new Date(), cronInicio)), 1000);
    return () => clearInterval(iv);
  }, [cronInicio, cronPaused]);

  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  /* ── QUERIES ─────────────────────────────────────────── */

  const { data: fila = [], isLoading: filaLoading } = useQuery({
    queryKey: ["fila-medico", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("checkins")
        .select("*, pacientes(nome, cpf, data_nascimento, convenio_id), medicos(nome, especialidade), agendamentos(data, horario)")
        .eq("clinica_id", clinicaId)
        .gte("hora_chegada", today)
        .in("status", ["aguardando", "em_atendimento"])
        .order("hora_chegada");
      return (data ?? []) as Checkin[];
    },
    enabled: !!clinicaId,
    refetchInterval: 10_000,
  });

  // Existing records for current patient
  const patientId = selected?.paciente_id;
  const medicoId = selected?.medico_id;
  const agendamentoId = selected?.agendamento_id;

  const { data: historicoAnamneses = [] } = useQuery({
    queryKey: ["anamneses-paciente", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("anamneses").select("*")
        .eq("paciente_id", patientId!).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const { data: historicoPrescricoes = [] } = useQuery({
    queryKey: ["prescricoes-paciente", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("prescricoes").select("*")
        .eq("paciente_id", patientId!).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const { data: historicoEncaminhamentos = [] } = useQuery({
    queryKey: ["encaminhamentos-paciente", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("encaminhamentos").select("*")
        .eq("paciente_id", patientId!).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const { data: historicoLaudos = [] } = useQuery({
    queryKey: ["laudos-paciente", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("laudos").select("*")
        .eq("paciente_id", patientId!).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const { data: historicoAtestados = [] } = useQuery({
    queryKey: ["atestados-paciente", patientId],
    queryFn: async () => {
      const { data } = await supabase.from("atestados").select("*")
        .eq("paciente_id", patientId!).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!patientId,
  });

  /* ── MUTATIONS ───────────────────────────────────────── */

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["fila-medico"] });
    if (patientId) {
      qc.invalidateQueries({ queryKey: ["anamneses-paciente", patientId] });
      qc.invalidateQueries({ queryKey: ["prescricoes-paciente", patientId] });
      qc.invalidateQueries({ queryKey: ["encaminhamentos-paciente", patientId] });
      qc.invalidateQueries({ queryKey: ["laudos-paciente", patientId] });
      qc.invalidateQueries({ queryKey: ["atestados-paciente", patientId] });
    }
  };

  // ── Anamnese CRUD
  const salvarAnamnese = useMutation({
    mutationFn: async () => {
      if (!clinicaId || !patientId) throw new Error("Sem contexto");
      const payload = {
        clinica_id: clinicaId,
        paciente_id: patientId,
        medico_id: medicoId,
        agendamento_id: agendamentoId,
        queixa_principal: anamnese.queixa_principal || null,
        historia_doenca: anamnese.historia_doenca || null,
        exame_fisico: anamnese.exame_fisico || null,
        antecedentes: anamnese.antecedentes || null,
        medicamentos: anamnese.medicamentos || null,
        alergias: anamnese.alergias || null,
        hipotese_diagnostica: anamnese.hipotese_diagnostica || null,
        conduta: anamnese.conduta || null,
        observacoes: anamnese.observacoes || null,
      };
      if (editingAnamneseId) {
        const { error } = await supabase.from("anamneses").update(payload).eq("id", editingAnamneseId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("anamneses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingAnamneseId ? "Anamnese atualizada!" : "Anamnese salva!");
      setEditingAnamneseId(null);
      invalidateAll();
      setTab("prescricao");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletarAnamnese = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("anamneses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Anamnese excluída"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Prescrição CRUD
  const salvarPrescricao = useMutation({
    mutationFn: async () => {
      if (!clinicaId || !patientId) throw new Error("Sem contexto");
      const itens = semPrescricao ? null : prescItens.filter(i => i.medicamento);
      const payload = {
        clinica_id: clinicaId,
        paciente_id: patientId,
        medico_id: medicoId,
        agendamento_id: agendamentoId,
        itens: itens as any,
        observacoes: prescObs || null,
        status: semPrescricao ? "sem_prescricao" : "ativa",
      };
      if (editingPrescId) {
        const { error } = await supabase.from("prescricoes").update(payload).eq("id", editingPrescId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prescricoes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPrescId ? "Prescrição atualizada!" : "Prescrição salva!");
      setEditingPrescId(null);
      invalidateAll();
      setTab("encaminhamento");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletarPrescricao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prescricoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Prescrição excluída"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Encaminhamento CRUD
  const salvarEncaminhamento = useMutation({
    mutationFn: async () => {
      if (!clinicaId || !patientId) throw new Error("Sem contexto");
      const payload = {
        clinica_id: clinicaId,
        paciente_id: patientId,
        medico_id: medicoId,
        agendamento_id: agendamentoId,
        especialidade_destino: encEspecialidade || null,
        motivo: encMotivo || null,
        observacoes: encObs || null,
        status: semEncaminhamento ? "sem_encaminhamento" : "pendente",
      };
      if (editingEncId) {
        const { error } = await supabase.from("encaminhamentos").update(payload).eq("id", editingEncId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("encaminhamentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingEncId ? "Encaminhamento atualizado!" : "Encaminhamento salvo!");
      setEditingEncId(null);
      invalidateAll();
      setTab("opcionais");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletarEncaminhamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("encaminhamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Encaminhamento excluído"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Laudo CRUD
  const salvarLaudo = useMutation({
    mutationFn: async () => {
      if (!clinicaId || !patientId) throw new Error("Sem contexto");
      const payload = {
        clinica_id: clinicaId,
        paciente_id: patientId,
        medico_id: medicoId,
        agendamento_id: agendamentoId,
        tipo: laudoTipo,
        conteudo: laudoConteudo || null,
        conclusao: laudoConclusao || null,
        status: "rascunho",
      };
      if (editingLaudoId) {
        const { error } = await supabase.from("laudos").update(payload).eq("id", editingLaudoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("laudos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingLaudoId ? "Laudo atualizado!" : "Laudo salvo!");
      setEditingLaudoId(null);
      setLaudoConteudo(""); setLaudoConclusao("");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletarLaudo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("laudos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Laudo excluído"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const assinarLaudo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("laudos").update({
        status: "assinado",
        assinado_em: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Laudo assinado!"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Atestado CRUD
  const salvarAtestado = useMutation({
    mutationFn: async () => {
      if (!clinicaId || !patientId) throw new Error("Sem contexto");
      const payload = {
        clinica_id: clinicaId,
        paciente_id: patientId,
        medico_id: medicoId,
        agendamento_id: agendamentoId,
        conteudo: atestadoConteudo || null,
        dias_afastamento: atestadoDias ? parseInt(atestadoDias) : null,
        cid: atestadoCid || null,
        data_emissao: format(new Date(), "yyyy-MM-dd"),
        tipo: "atestado_medico",
      };
      if (editingAtestadoId) {
        const { error } = await supabase.from("atestados").update(payload).eq("id", editingAtestadoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("atestados").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingAtestadoId ? "Atestado atualizado!" : "Atestado salvo!");
      setEditingAtestadoId(null);
      setAtestadoConteudo(""); setAtestadoDias(""); setAtestadoCid("");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletarAtestado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atestados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atestado excluído"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Cronômetro
  const iniciarCronometro = async () => {
    if (!clinicaId || !selected) return;
    const { data, error } = await supabase.from("cronometro_atendimento").insert({
      clinica_id: clinicaId,
      checkin_id: selected.id,
      medico_id: medicoId,
      paciente_id: patientId,
      inicio: new Date().toISOString(),
      status: "em_andamento",
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setCronId(data.id);
    setCronInicio(new Date());
    setCronPaused(false);
    setElapsed(0);
    // Mark checkin as in progress
    await supabase.from("checkins").update({
      status: "em_atendimento",
      hora_inicio_atendimento: new Date().toISOString(),
    }).eq("id", selected.id);
    qc.invalidateQueries({ queryKey: ["fila-medico"] });
  };

  const pararCronometro = async () => {
    if (!cronId) return;
    await supabase.from("cronometro_atendimento").update({
      fim: new Date().toISOString(),
      duracao_segundos: elapsed,
      status: "finalizado",
    }).eq("id", cronId);
    setCronId(null);
    setCronInicio(null);
    setCronPaused(false);
  };

  // ── Finalizar atendimento
  const finalizarAtendimento = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await pararCronometro();
      await supabase.from("checkins").update({
        status: "finalizado",
        hora_fim_atendimento: new Date().toISOString(),
      }).eq("id", selected.id);
      if (selected.agendamento_id) {
        await supabase.from("agendamentos").update({ status: "atendido" }).eq("id", selected.agendamento_id);
      }
    },
    onSuccess: () => {
      toast.success("Atendimento finalizado!");
      resetAtendimento();
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Iniciar atendimento
  const iniciarAtendimento = async (checkin: Checkin) => {
    setSelected(checkin);
    setTab("anamnese");
    resetForms();
    // Start timer immediately
    if (!clinicaId) return;
    const { data, error } = await supabase.from("cronometro_atendimento").insert({
      clinica_id: clinicaId,
      checkin_id: checkin.id,
      medico_id: checkin.medico_id,
      paciente_id: checkin.paciente_id,
      inicio: new Date().toISOString(),
      status: "em_andamento",
    }).select("id").single();
    if (!error && data) {
      setCronId(data.id);
      setCronInicio(new Date());
      setElapsed(0);
    }
    await supabase.from("checkins").update({
      status: "em_atendimento",
      hora_inicio_atendimento: new Date().toISOString(),
    }).eq("id", checkin.id);
    qc.invalidateQueries({ queryKey: ["fila-medico"] });
  };

  const resetForms = () => {
    setAnamnese(emptyAnamnese); setAnamneseIA("");
    setPrescItens([{ medicamento: "", posologia: "", duracao: "" }]); setPrescObs(""); setSemPrescricao(false); setPrescricaoIA("");
    setEncEspecialidade(""); setEncMotivo(""); setEncObs(""); setSemEncaminhamento(false); setEncaminhamentoIA("");
    setLaudoConteudo(""); setLaudoConclusao(""); setLaudoTipo("laudo_medico");
    setAtestadoConteudo(""); setAtestadoDias(""); setAtestadoCid("");
    setEditingAnamneseId(null); setEditingPrescId(null); setEditingEncId(null);
    setEditingLaudoId(null); setEditingAtestadoId(null);
  };

  const resetAtendimento = () => {
    setSelected(null);
    setTab("fila");
    setCronId(null); setCronInicio(null); setCronPaused(false); setElapsed(0);
    resetForms();
  };

  // ── Load existing record for editing
  const editAnamnese = (rec: any) => {
    setAnamnese({
      queixa_principal: rec.queixa_principal ?? "",
      historia_doenca: rec.historia_doenca ?? "",
      exame_fisico: rec.exame_fisico ?? "",
      antecedentes: rec.antecedentes ?? "",
      medicamentos: rec.medicamentos ?? "",
      alergias: rec.alergias ?? "",
      hipotese_diagnostica: rec.hipotese_diagnostica ?? "",
      conduta: rec.conduta ?? "",
      observacoes: rec.observacoes ?? "",
    });
    setEditingAnamneseId(rec.id);
    setTab("anamnese");
  };

  const editPrescricao = (rec: any) => {
    const itens = Array.isArray(rec.itens) ? rec.itens : [{ medicamento: "", posologia: "", duracao: "" }];
    setPrescItens(itens);
    setPrescObs(rec.observacoes ?? "");
    setSemPrescricao(rec.status === "sem_prescricao");
    setEditingPrescId(rec.id);
    setTab("prescricao");
  };

  const editEncaminhamento = (rec: any) => {
    setEncEspecialidade(rec.especialidade_destino ?? "");
    setEncMotivo(rec.motivo ?? "");
    setEncObs(rec.observacoes ?? "");
    setSemEncaminhamento(rec.status === "sem_encaminhamento");
    setEditingEncId(rec.id);
    setTab("encaminhamento");
  };

  const editLaudo = (rec: any) => {
    setLaudoTipo(rec.tipo ?? "laudo_medico");
    setLaudoConteudo(rec.conteudo ?? "");
    setLaudoConclusao(rec.conclusao ?? "");
    setEditingLaudoId(rec.id);
    setTab("opcionais");
  };

  const editAtestado = (rec: any) => {
    setAtestadoConteudo(rec.conteudo ?? "");
    setAtestadoDias(rec.dias_afastamento != null ? String(rec.dias_afastamento) : "");
    setAtestadoCid(rec.cid ?? "");
    setEditingAtestadoId(rec.id);
    setTab("opcionais");
  };

  // ── IA stub
  const gerarSugestaoIA = (tipo: string) => {
    const msg = `[IA] Sugestão baseada no histórico do paciente. Em produção, integra com Claude via Edge Function.`;
    if (tipo === "anamnese") setAnamneseIA(msg);
    if (tipo === "prescricao") setPrescricaoIA(msg);
    if (tipo === "encaminhamento") setEncaminhamentoIA(msg);
    toast.info("Sugestão de IA gerada (simulação)");
  };

  // ── Prescrição items helpers
  const addPrescItem = () => setPrescItens([...prescItens, { medicamento: "", posologia: "", duracao: "" }]);
  const removePrescItem = (i: number) => setPrescItens(prescItens.filter((_, idx) => idx !== i));
  const updatePrescItem = (i: number, field: keyof PrescricaoItem, val: string) => {
    const next = [...prescItens];
    next[i] = { ...next[i], [field]: val };
    setPrescItens(next);
  };

  // ── Filter fila
  const filaFiltrada = fila.filter(c =>
    !searchFila || (c.pacientes?.nome ?? "").toLowerCase().includes(searchFila.toLowerCase())
  );

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Área do Médico</h1>
            <p className="text-sm text-muted-foreground">
              {selected
                ? <>Atendendo: <span className="font-medium text-foreground">{selected.pacientes?.nome}</span></>
                : "Selecione um paciente da fila"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {cronInicio && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2"
              >
                <Badge variant="outline" className="text-lg gap-2 px-4 py-2 font-mono tabular-nums">
                  <Timer className="h-4 w-4 text-primary animate-pulse" />
                  {fmtTimer(elapsed)}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCronPaused(!cronPaused)}>
                  {cronPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
              </motion.div>
            )}
            {selected && (
              <Button variant="outline" size="sm" onClick={resetAtendimento}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="fila" className="gap-1"><ClipboardList className="h-3.5 w-3.5" /> Fila</TabsTrigger>
            <TabsTrigger value="anamnese" disabled={!selected} className="gap-1"><FileText className="h-3.5 w-3.5" /> Anamnese</TabsTrigger>
            <TabsTrigger value="prescricao" disabled={!selected} className="gap-1"><Pill className="h-3.5 w-3.5" /> Prescrição</TabsTrigger>
            <TabsTrigger value="encaminhamento" disabled={!selected} className="gap-1"><ArrowRight className="h-3.5 w-3.5" /> Encaminhamento</TabsTrigger>
            <TabsTrigger value="opcionais" disabled={!selected} className="gap-1"><FileSignature className="h-3.5 w-3.5" /> Laudos/Atestados</TabsTrigger>
          </TabsList>

          {/* ═══════════════════ FILA ═══════════════════ */}
          <TabsContent value="fila">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Fila de Atendimento</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar paciente..."
                        value={searchFila}
                        onChange={e => setSearchFila(e.target.value)}
                        className="pl-9 h-9 w-[200px]"
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => qc.invalidateQueries({ queryKey: ["fila-medico"] })}>
                      <RefreshCw className={cn("h-4 w-4", filaLoading && "animate-spin")} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filaFiltrada.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Stethoscope className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">Nenhum paciente na fila</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filaFiltrada.map((c) => (
                      <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className={cn(
                          "flex items-center justify-between rounded-lg border p-4 transition-colors",
                          c.status === "em_atendimento" && "border-primary/50 bg-primary/5"
                        )}>
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{c.pacientes?.nome ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.hora_chegada ? `Chegada: ${format(new Date(c.hora_chegada), "HH:mm")}` : ""}
                                {c.agendamentos?.horario ? ` • Agendado: ${c.agendamentos.horario.slice(0, 5)}` : ""}
                                {c.pacientes?.convenio_id ? " • Convênio" : " • Particular"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={c.status === "em_atendimento" ? "default" : "secondary"} className="text-xs">
                              {c.status === "em_atendimento" ? "Em atendimento" : "Aguardando"}
                            </Badge>
                            <Button size="sm" onClick={() => iniciarAtendimento(c)} disabled={c.status === "em_atendimento" && selected?.id === c.id}>
                              <Stethoscope className="h-4 w-4 mr-1" /> Atender
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ ANAMNESE ═══════════════════ */}
          <TabsContent value="anamnese">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {editingAnamneseId ? "Editar Anamnese" : "Nova Anamnese"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Queixa Principal</Label>
                      <Input value={anamnese.queixa_principal} onChange={e => setAnamnese({ ...anamnese, queixa_principal: e.target.value })} placeholder="Motivo da consulta" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>História da Doença Atual</Label>
                        <Textarea rows={4} value={anamnese.historia_doenca} onChange={e => setAnamnese({ ...anamnese, historia_doenca: e.target.value })} />
                      </div>
                      <div>
                        <Label>Exame Físico</Label>
                        <Textarea rows={4} value={anamnese.exame_fisico} onChange={e => setAnamnese({ ...anamnese, exame_fisico: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Antecedentes</Label>
                        <Textarea rows={3} value={anamnese.antecedentes} onChange={e => setAnamnese({ ...anamnese, antecedentes: e.target.value })} />
                      </div>
                      <div>
                        <Label>Medicamentos em Uso</Label>
                        <Textarea rows={3} value={anamnese.medicamentos} onChange={e => setAnamnese({ ...anamnese, medicamentos: e.target.value })} />
                      </div>
                      <div>
                        <Label>Alergias</Label>
                        <Textarea rows={3} value={anamnese.alergias} onChange={e => setAnamnese({ ...anamnese, alergias: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Hipótese Diagnóstica</Label>
                        <Input value={anamnese.hipotese_diagnostica} onChange={e => setAnamnese({ ...anamnese, hipotese_diagnostica: e.target.value })} />
                      </div>
                      <div>
                        <Label>Conduta</Label>
                        <Input value={anamnese.conduta} onChange={e => setAnamnese({ ...anamnese, conduta: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Textarea rows={2} value={anamnese.observacoes} onChange={e => setAnamnese({ ...anamnese, observacoes: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button onClick={() => salvarAnamnese.mutate()} disabled={salvarAnamnese.isPending}>
                        <Save className="h-4 w-4 mr-1" /> {editingAnamneseId ? "Atualizar" : "Salvar"} e Próximo
                      </Button>
                      {editingAnamneseId && (
                        <Button variant="ghost" onClick={() => { setEditingAnamneseId(null); setAnamnese(emptyAnamnese); }}>Cancelar edição</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Side: IA + History */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Sugestão IA</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => gerarSugestaoIA("anamnese")}>
                      <Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar Sugestão
                    </Button>
                    <Textarea rows={6} value={anamneseIA} readOnly className="bg-muted text-xs" placeholder="A IA sugere com base no histórico..." />
                  </CardContent>
                </Card>

                <HistoryList
                  title="Anamneses Anteriores"
                  items={historicoAnamneses}
                  labelFn={(r: any) => r.queixa_principal || r.hipotese_diagnostica || "Anamnese"}
                  onEdit={editAnamnese}
                  onDelete={(id) => deletarAnamnese.mutate(id)}
                />
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════ PRESCRIÇÃO ═══════════════════ */}
          <TabsContent value="prescricao">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-4 w-4" />
                      {editingPrescId ? "Editar Prescrição" : "Nova Prescrição"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={semPrescricao} onCheckedChange={setSemPrescricao} />
                      <Label>Sem prescrição</Label>
                    </div>

                    {!semPrescricao && (
                      <>
                        <div className="space-y-3">
                          {prescItens.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="grid grid-cols-3 gap-2 flex-1">
                                <div>
                                  <Label className="text-xs">Medicamento</Label>
                                  <Input value={item.medicamento} onChange={e => updatePrescItem(i, "medicamento", e.target.value)} placeholder="Nome do medicamento" />
                                </div>
                                <div>
                                  <Label className="text-xs">Posologia</Label>
                                  <Input value={item.posologia} onChange={e => updatePrescItem(i, "posologia", e.target.value)} placeholder="Ex: 1 comp. 8/8h" />
                                </div>
                                <div>
                                  <Label className="text-xs">Duração</Label>
                                  <Input value={item.duracao} onChange={e => updatePrescItem(i, "duracao", e.target.value)} placeholder="Ex: 7 dias" />
                                </div>
                              </div>
                              {prescItens.length > 1 && (
                                <Button variant="ghost" size="icon" className="mt-5 h-9 w-9 text-destructive" onClick={() => removePrescItem(i)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={addPrescItem}>+ Adicionar medicamento</Button>
                      </>
                    )}

                    <div>
                      <Label>Observações</Label>
                      <Textarea rows={3} value={prescObs} onChange={e => setPrescObs(e.target.value)} placeholder="Orientações adicionais..." />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button onClick={() => salvarPrescricao.mutate()} disabled={salvarPrescricao.isPending}>
                        <Save className="h-4 w-4 mr-1" /> {editingPrescId ? "Atualizar" : "Salvar"} e Próximo
                      </Button>
                      {editingPrescId && (
                        <Button variant="ghost" onClick={() => { setEditingPrescId(null); setPrescItens([{ medicamento: "", posologia: "", duracao: "" }]); setPrescObs(""); }}>Cancelar edição</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Sugestão IA</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => gerarSugestaoIA("prescricao")} disabled={semPrescricao}>
                      <Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar Sugestão
                    </Button>
                    <Textarea rows={6} value={prescricaoIA} readOnly className="bg-muted text-xs" />
                  </CardContent>
                </Card>

                <HistoryList
                  title="Prescrições Anteriores"
                  items={historicoPrescricoes}
                  labelFn={(r: any) => {
                    if (r.status === "sem_prescricao") return "Sem prescrição";
                    const itens = Array.isArray(r.itens) ? r.itens : [];
                    return itens.length > 0 ? itens.map((i: any) => i.medicamento).join(", ") : "Prescrição";
                  }}
                  onEdit={editPrescricao}
                  onDelete={(id) => deletarPrescricao.mutate(id)}
                />
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════ ENCAMINHAMENTO ═══════════════════ */}
          <TabsContent value="encaminhamento">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      {editingEncId ? "Editar Encaminhamento" : "Novo Encaminhamento"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={semEncaminhamento} onCheckedChange={setSemEncaminhamento} />
                      <Label>Sem encaminhamento</Label>
                    </div>

                    {!semEncaminhamento && (
                      <>
                        <div>
                          <Label>Especialidade / Exame destino</Label>
                          <Input value={encEspecialidade} onChange={e => setEncEspecialidade(e.target.value)} placeholder="Ex: Cardiologia, Ressonância..." />
                        </div>
                        <div>
                          <Label>Motivo</Label>
                          <Textarea rows={4} value={encMotivo} onChange={e => setEncMotivo(e.target.value)} placeholder="Justificativa clínica do encaminhamento..." />
                        </div>
                        <div>
                          <Label>Observações</Label>
                          <Textarea rows={2} value={encObs} onChange={e => setEncObs(e.target.value)} />
                        </div>
                      </>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <Button onClick={() => salvarEncaminhamento.mutate()} disabled={salvarEncaminhamento.isPending}>
                        <Save className="h-4 w-4 mr-1" /> {editingEncId ? "Atualizar" : "Salvar"} e Próximo
                      </Button>
                      {editingEncId && (
                        <Button variant="ghost" onClick={() => { setEditingEncId(null); setEncEspecialidade(""); setEncMotivo(""); setEncObs(""); }}>Cancelar edição</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Sugestão IA</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => gerarSugestaoIA("encaminhamento")} disabled={semEncaminhamento}>
                      <Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar Sugestão
                    </Button>
                    <Textarea rows={6} value={encaminhamentoIA} readOnly className="bg-muted text-xs" />
                  </CardContent>
                </Card>

                <HistoryList
                  title="Encaminhamentos Anteriores"
                  items={historicoEncaminhamentos}
                  labelFn={(r: any) => r.especialidade_destino || r.motivo || "Encaminhamento"}
                  onEdit={editEncaminhamento}
                  onDelete={(id) => deletarEncaminhamento.mutate(id)}
                />
              </div>
            </div>
          </TabsContent>

          {/* ═══════════════════ LAUDOS / ATESTADOS ═══════════════════ */}
          <TabsContent value="opcionais">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Laudo */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {editingLaudoId ? "Editar Laudo" : "Novo Laudo"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={laudoTipo} onValueChange={setLaudoTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="laudo_medico">Laudo Médico</SelectItem>
                        <SelectItem value="laudo_exame">Laudo de Exame</SelectItem>
                        <SelectItem value="parecer">Parecer Técnico</SelectItem>
                        <SelectItem value="relatorio">Relatório Médico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Conteúdo</Label>
                    <Textarea rows={5} value={laudoConteudo} onChange={e => setLaudoConteudo(e.target.value)} placeholder="Texto do laudo..." />
                  </div>
                  <div>
                    <Label>Conclusão</Label>
                    <Textarea rows={2} value={laudoConclusao} onChange={e => setLaudoConclusao(e.target.value)} placeholder="Conclusão do laudo..." />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => salvarLaudo.mutate()} disabled={!laudoConteudo || salvarLaudo.isPending} size="sm">
                      <Save className="h-3.5 w-3.5 mr-1" /> {editingLaudoId ? "Atualizar" : "Salvar"} Laudo
                    </Button>
                    {editingLaudoId && (
                      <Button variant="ghost" size="sm" onClick={() => { setEditingLaudoId(null); setLaudoConteudo(""); setLaudoConclusao(""); }}>Cancelar</Button>
                    )}
                  </div>

                  <Separator />
                  <HistoryList
                    title="Laudos do Paciente"
                    items={historicoLaudos}
                    labelFn={(r: any) => `${r.tipo ?? "Laudo"} ${r.status === "assinado" ? "✓" : ""}`}
                    onEdit={editLaudo}
                    onDelete={(id) => deletarLaudo.mutate(id)}
                    extraAction={(r: any) => r.status !== "assinado" ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => assinarLaudo.mutate(r.id)} title="Assinar">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                      </Button>
                    ) : null}
                    compact
                  />
                </CardContent>
              </Card>

              {/* Atestado */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSignature className="h-4 w-4" />
                    {editingAtestadoId ? "Editar Atestado" : "Novo Atestado"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Conteúdo do Atestado</Label>
                    <Textarea rows={5} value={atestadoConteudo} onChange={e => setAtestadoConteudo(e.target.value)} placeholder="Atesto para os devidos fins que o(a) paciente..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Dias de Afastamento</Label>
                      <Input type="number" min={0} value={atestadoDias} onChange={e => setAtestadoDias(e.target.value)} />
                    </div>
                    <div>
                      <Label>CID (opcional)</Label>
                      <Input value={atestadoCid} onChange={e => setAtestadoCid(e.target.value)} placeholder="Ex: J06.9" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => salvarAtestado.mutate()} disabled={!atestadoConteudo || salvarAtestado.isPending} size="sm">
                      <Save className="h-3.5 w-3.5 mr-1" /> {editingAtestadoId ? "Atualizar" : "Salvar"} Atestado
                    </Button>
                    {editingAtestadoId && (
                      <Button variant="ghost" size="sm" onClick={() => { setEditingAtestadoId(null); setAtestadoConteudo(""); setAtestadoDias(""); setAtestadoCid(""); }}>Cancelar</Button>
                    )}
                  </div>

                  <Separator />
                  <HistoryList
                    title="Atestados do Paciente"
                    items={historicoAtestados}
                    labelFn={(r: any) => `${r.dias_afastamento ? `${r.dias_afastamento} dias` : "Atestado"} ${r.cid ? `(${r.cid})` : ""}`}
                    onEdit={editAtestado}
                    onDelete={(id) => deletarAtestado.mutate(id)}
                    compact
                  />
                </CardContent>
              </Card>
            </div>

            {/* Finalizar */}
            <div className="flex justify-end mt-6">
              <Button size="lg" onClick={() => finalizarAtendimento.mutate()} disabled={finalizarAtendimento.isPending} className="gap-2">
                <CheckCircle className="h-5 w-5" /> Finalizar Atendimento
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ══════════════════════════════════════════════════════════
   HISTORY LIST COMPONENT
   ══════════════════════════════════════════════════════════ */
function HistoryList({
  title, items, labelFn, onEdit, onDelete, extraAction, compact,
}: {
  title: string;
  items: any[];
  labelFn: (r: any) => string;
  onEdit: (r: any) => void;
  onDelete: (id: string) => void;
  extraAction?: (r: any) => React.ReactNode;
  compact?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (compact) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <History className="h-3 w-3" /> {title} ({items.length})
        </p>
        {items.length === 0 && <p className="text-xs text-muted-foreground/60">Nenhum registro</p>}
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-1">
            {items.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
                <div className="flex-1 truncate">
                  <span className="font-medium">{labelFn(r)}</span>
                  {r.created_at && <span className="text-muted-foreground ml-2">{format(new Date(r.created_at), "dd/MM HH:mm")}</span>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {extraAction?.(r)}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(r)}><Edit2 className="h-3 w-3" /></Button>
                  {confirmDelete === r.id ? (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { onDelete(r.id); setConfirmDelete(null); }}>
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setConfirmDelete(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" /> {title}
          <Badge variant="outline" className="text-[10px] ml-auto">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro anterior</p>
        ) : (
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-1.5">
              {items.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{labelFn(r)}</p>
                    {r.created_at && (
                      <p className="text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(r)} title="Editar">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    {confirmDelete === r.id ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { onDelete(r.id); setConfirmDelete(null); }} title="Confirmar exclusão">
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(r.id)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
