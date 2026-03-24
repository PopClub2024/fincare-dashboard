import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInMinutes } from "date-fns";
import {
  Stethoscope, FileText, Pill, ArrowRight, Award, Clock,
  User, Save, Sparkles, CheckCircle, AlertCircle, Printer
} from "lucide-react";

export default function AreaMedico() {
  const { clinicaId, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCheckin, setSelectedCheckin] = useState<any>(null);
  const [tab, setTab] = useState("fila");

  // Anamnese
  const [anamnese, setAnamnese] = useState({ texto_medico: "", doencas: ["", "", "", "", ""], queixa: "", hipotese: "", cid: "" });
  const [anamneseIA, setAnamneseIA] = useState("");
  // Prescrição
  const [prescricao, setPrescricao] = useState({ texto_medico: "", sem_prescricao: false });
  const [prescricaoIA, setPrescricaoIA] = useState("");
  // Encaminhamento
  const [encaminhamento, setEncaminhamento] = useState({ texto_medico: "", sem_encaminhamento: false, especialidade_destino: "" });
  const [encaminhamentoIA, setEncaminhamentoIA] = useState("");
  // Laudo/Atestado
  const [laudo, setLaudo] = useState({ texto_medico: "" });
  const [atestado, setAtestado] = useState({ texto_medico: "", dias: "" });

  // Cronômetro
  const [cronometroInicio, setCronometroInicio] = useState<Date | null>(null);

  // Fila do médico
  const { data: fila = [] } = useQuery({
    queryKey: ["fila-medico", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("checkins")
        .select("*, pacientes(nome, cpf, data_nascimento, convenio_id), medicos(nome, especialidade), agendamentos(data_hora)")
        .eq("clinica_id", clinicaId)
        .gte("hora_checkin", today)
        .in("status", ["aguardando", "em_atendimento"])
        .order("hora_checkin");
      return data || [];
    },
    enabled: !!clinicaId,
    refetchInterval: 10000,
  });

  const salvarAnamnese = useMutation({
    mutationFn: async () => {
      if (!selectedCheckin) return;
      const { error } = await supabase.from("anamneses").insert({
        clinica_id: clinicaId,
        paciente_id: selectedCheckin.paciente_id,
        medico_id: selectedCheckin.medico_id,
        checkin_id: selectedCheckin.id,
        texto_medico: anamnese.texto_medico,
        texto_ia: anamneseIA || null,
        doencas_preexistentes: anamnese.doencas.filter(Boolean),
        queixa_principal: anamnese.queixa,
        hipotese_diagnostica: anamnese.hipotese,
        cid: anamnese.cid || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anamnese salva!");
      setTab("prescricao");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const salvarPrescricao = useMutation({
    mutationFn: async () => {
      if (!selectedCheckin) return;
      const { error } = await supabase.from("prescricoes").insert({
        clinica_id: clinicaId,
        paciente_id: selectedCheckin.paciente_id,
        medico_id: selectedCheckin.medico_id,
        checkin_id: selectedCheckin.id,
        sem_prescricao: prescricao.sem_prescricao,
        texto_medico: prescricao.texto_medico || null,
        texto_ia: prescricaoIA || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prescrição salva!");
      setTab("encaminhamento");
    },
  });

  const salvarEncaminhamento = useMutation({
    mutationFn: async () => {
      if (!selectedCheckin) return;
      const { error } = await supabase.from("encaminhamentos").insert({
        clinica_id: clinicaId,
        paciente_id: selectedCheckin.paciente_id,
        medico_id: selectedCheckin.medico_id,
        checkin_id: selectedCheckin.id,
        sem_encaminhamento: encaminhamento.sem_encaminhamento,
        texto_medico: encaminhamento.texto_medico || null,
        texto_ia: encaminhamentoIA || null,
        especialidade_destino: encaminhamento.especialidade_destino || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Encaminhamento salvo!");
      setTab("opcionais");
    },
  });

  const finalizarAtendimento = useMutation({
    mutationFn: async () => {
      if (!selectedCheckin) return;
      await supabase.from("checkins").update({
        status: "finalizado",
        hora_fim_atendimento: new Date().toISOString(),
      } as any).eq("id", selectedCheckin.id);
      await supabase.from("agendamentos").update({ status: "atendido" } as any).eq("id", selectedCheckin.agendamento_id);
      // Parar cronômetro
      if (cronometroInicio) {
        const duracao = differenceInMinutes(new Date(), cronometroInicio) * 60;
        await supabase.from("cronometro_atendimento").update({
          fim: new Date().toISOString(),
          duracao_total_segundos: duracao,
        } as any).eq("checkin_id", selectedCheckin.id);
      }
    },
    onSuccess: () => {
      toast.success("Atendimento finalizado!");
      setSelectedCheckin(null);
      setTab("fila");
      setCronometroInicio(null);
      queryClient.invalidateQueries({ queryKey: ["fila-medico"] });
    },
  });

  const iniciarAtendimento = (checkin: any) => {
    setSelectedCheckin(checkin);
    setCronometroInicio(new Date());
    setTab("anamnese");
    setAnamnese({ texto_medico: "", doencas: ["", "", "", "", ""], queixa: "", hipotese: "", cid: "" });
    setPrescricao({ texto_medico: "", sem_prescricao: false });
    setEncaminhamento({ texto_medico: "", sem_encaminhamento: false, especialidade_destino: "" });
  };

  const gerarSugestaoIA = (tipo: string) => {
    // Placeholder — em produção, chamaria Edge Function com Claude
    const msg = `[IA] Sugestão baseada no histórico do paciente e input atual. Em produção, integra com Anthropic Claude.`;
    if (tipo === "anamnese") setAnamneseIA(msg);
    if (tipo === "prescricao") setPrescricaoIA(msg);
    if (tipo === "encaminhamento") setEncaminhamentoIA(msg);
    toast.info("Sugestão de IA gerada (simulação)");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Área do Médico</h1>
            <p className="text-sm text-muted-foreground">Painel de atendimento</p>
          </div>
          {cronometroInicio && (
            <Badge variant="outline" className="text-lg gap-2 px-4 py-2">
              <Clock className="h-4 w-4" />
              Atendimento em andamento
            </Badge>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="fila">Fila</TabsTrigger>
            <TabsTrigger value="anamnese" disabled={!selectedCheckin}>Anamnese</TabsTrigger>
            <TabsTrigger value="prescricao" disabled={!selectedCheckin}>Prescrição</TabsTrigger>
            <TabsTrigger value="encaminhamento" disabled={!selectedCheckin}>Encaminhamento</TabsTrigger>
            <TabsTrigger value="opcionais" disabled={!selectedCheckin}>Laudos/Atestados</TabsTrigger>
          </TabsList>

          {/* FILA */}
          <TabsContent value="fila">
            <div className="space-y-2">
              {fila.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum paciente na fila</CardContent></Card>
              ) : fila.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <User className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{(c as any).pacientes?.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Check-in: {format(new Date(c.hora_checkin), "HH:mm")} •
                          {(c as any).pacientes?.convenio_id ? " Convênio" : " Particular"}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => iniciarAtendimento(c)}>
                      <Stethoscope className="h-4 w-4 mr-2" /> Iniciar Atendimento
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ANAMNESE */}
          <TabsContent value="anamnese">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Anamnese — Médico</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Queixa Principal</Label>
                    <Input value={anamnese.queixa} onChange={(e) => setAnamnese({ ...anamnese, queixa: e.target.value })} />
                  </div>
                  <div>
                    <Label>Evolução / Exame Físico</Label>
                    <Textarea rows={6} value={anamnese.texto_medico} onChange={(e) => setAnamnese({ ...anamnese, texto_medico: e.target.value })} />
                  </div>
                  <div>
                    <Label>Doenças Pré-existentes (5 obrigatórias)</Label>
                    {anamnese.doencas.map((d, i) => (
                      <Input key={i} className="mt-1" placeholder={`Doença ${i + 1}`} value={d}
                        onChange={(e) => { const next = [...anamnese.doencas]; next[i] = e.target.value; setAnamnese({ ...anamnese, doencas: next }); }} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Hipótese Diagnóstica</Label>
                      <Input value={anamnese.hipotese} onChange={(e) => setAnamnese({ ...anamnese, hipotese: e.target.value })} />
                    </div>
                    <div>
                      <Label>CID</Label>
                      <Input value={anamnese.cid} onChange={(e) => setAnamnese({ ...anamnese, cid: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Sugestão IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" onClick={() => gerarSugestaoIA("anamnese")}>
                    <Sparkles className="h-4 w-4 mr-2" /> Gerar Sugestão
                  </Button>
                  <Textarea rows={12} value={anamneseIA} readOnly className="bg-muted" placeholder="A IA sugere com base no input e histórico do paciente..." />
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => salvarAnamnese.mutate()} disabled={!anamnese.texto_medico}>
                <Save className="h-4 w-4 mr-2" /> Salvar e Próximo
              </Button>
            </div>
          </TabsContent>

          {/* PRESCRIÇÃO */}
          <TabsContent value="prescricao">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Pill className="h-4 w-4" /> Prescrição</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={prescricao.sem_prescricao} onCheckedChange={(v) => setPrescricao({ ...prescricao, sem_prescricao: v })} />
                    <Label>Sem prescrição</Label>
                  </div>
                  {!prescricao.sem_prescricao && (
                    <Textarea rows={10} value={prescricao.texto_medico} onChange={(e) => setPrescricao({ ...prescricao, texto_medico: e.target.value })}
                      placeholder="Medicamentos, posologia, duração..." />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Sugestão IA</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" onClick={() => gerarSugestaoIA("prescricao")} disabled={prescricao.sem_prescricao}>
                    <Sparkles className="h-4 w-4 mr-2" /> Gerar Sugestão
                  </Button>
                  <Textarea rows={10} value={prescricaoIA} readOnly className="bg-muted" />
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => salvarPrescricao.mutate()}>
                <Save className="h-4 w-4 mr-2" /> Salvar e Próximo
              </Button>
            </div>
          </TabsContent>

          {/* ENCAMINHAMENTO */}
          <TabsContent value="encaminhamento">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowRight className="h-4 w-4" /> Encaminhamento</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={encaminhamento.sem_encaminhamento} onCheckedChange={(v) => setEncaminhamento({ ...encaminhamento, sem_encaminhamento: v })} />
                    <Label>Sem encaminhamento</Label>
                  </div>
                  {!encaminhamento.sem_encaminhamento && (
                    <>
                      <div>
                        <Label>Especialidade/Exame destino</Label>
                        <Input value={encaminhamento.especialidade_destino} onChange={(e) => setEncaminhamento({ ...encaminhamento, especialidade_destino: e.target.value })} />
                      </div>
                      <Textarea rows={6} value={encaminhamento.texto_medico} onChange={(e) => setEncaminhamento({ ...encaminhamento, texto_medico: e.target.value })}
                        placeholder="Detalhes do encaminhamento..." />
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Sugestão IA</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" onClick={() => gerarSugestaoIA("encaminhamento")} disabled={encaminhamento.sem_encaminhamento}>
                    <Sparkles className="h-4 w-4 mr-2" /> Gerar Sugestão
                  </Button>
                  <Textarea rows={8} value={encaminhamentoIA} readOnly className="bg-muted" />
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => salvarEncaminhamento.mutate()}>
                <Save className="h-4 w-4 mr-2" /> Salvar e Próximo
              </Button>
            </div>
          </TabsContent>

          {/* OPCIONAIS: Laudos + Atestados + Finalizar */}
          <TabsContent value="opcionais">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Laudo (Opcional)</CardTitle></CardHeader>
                <CardContent>
                  <Textarea rows={6} value={laudo.texto_medico} onChange={(e) => setLaudo({ ...laudo, texto_medico: e.target.value })} placeholder="Texto do laudo..." />
                  <Button variant="outline" size="sm" className="mt-2" disabled={!laudo.texto_medico}
                    onClick={async () => {
                      if (!selectedCheckin) return;
                      await supabase.from("laudos").insert({ clinica_id: clinicaId, paciente_id: selectedCheckin.paciente_id, medico_id: selectedCheckin.medico_id, checkin_id: selectedCheckin.id, texto_medico: laudo.texto_medico } as any);
                      toast.success("Laudo salvo!");
                    }}>
                    <Save className="h-3 w-3 mr-1" /> Salvar Laudo
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Atestado (Opcional)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Textarea rows={4} value={atestado.texto_medico} onChange={(e) => setAtestado({ ...atestado, texto_medico: e.target.value })} placeholder="Texto do atestado..." />
                  <div>
                    <Label>Dias de afastamento</Label>
                    <Input type="number" value={atestado.dias} onChange={(e) => setAtestado({ ...atestado, dias: e.target.value })} />
                  </div>
                  <Button variant="outline" size="sm" disabled={!atestado.texto_medico}
                    onClick={async () => {
                      if (!selectedCheckin) return;
                      await supabase.from("atestados").insert({ clinica_id: clinicaId, paciente_id: selectedCheckin.paciente_id, medico_id: selectedCheckin.medico_id, checkin_id: selectedCheckin.id, texto_medico: atestado.texto_medico, dias_afastamento: atestado.dias ? parseInt(atestado.dias) : null } as any);
                      toast.success("Atestado salvo!");
                    }}>
                    <Save className="h-3 w-3 mr-1" /> Salvar Atestado
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="flex justify-end mt-6">
              <Button size="lg" onClick={() => finalizarAtendimento.mutate()}>
                <CheckCircle className="h-4 w-4 mr-2" /> Finalizar Atendimento
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
