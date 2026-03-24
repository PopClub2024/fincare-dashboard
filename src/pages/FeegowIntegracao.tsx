import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Wifi, WifiOff,
  Activity, Database, AlertTriangle, Play, History, Download,
  Users, Stethoscope, FileText, Pill, ArrowRight, Calendar,
  Shield, Trash2, Upload, BarChart3, Archive,
} from "lucide-react";

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR") : "—";

// Entidades que serão migradas do Feegow
const ENTIDADES_MIGRACAO = [
  { key: "pacientes", label: "Pacientes", icon: Users, desc: "Cadastro completo: nome, CPF, nascimento, telefone, email, convênio, carteirinha, endereço" },
  { key: "medicos", label: "Médicos / Profissionais", icon: Stethoscope, desc: "Nome, CRM, especialidade, RQE, status" },
  { key: "agendamentos", label: "Agendamentos", icon: Calendar, desc: "Histórico completo de agendamentos, status, remarcações, cancelamentos" },
  { key: "prontuarios", label: "Prontuários / Anamneses", icon: FileText, desc: "Evoluções, anamneses, exame físico, hipóteses diagnósticas, CID" },
  { key: "prescricoes", label: "Prescrições", icon: Pill, desc: "Medicamentos prescritos, posologia, duração" },
  { key: "encaminhamentos", label: "Encaminhamentos", icon: ArrowRight, desc: "Encaminhamentos para especialidades e exames" },
  { key: "laudos", label: "Laudos e Atestados", icon: FileText, desc: "Laudos médicos e atestados emitidos" },
  { key: "resultados", label: "Resultados de Exames", icon: BarChart3, desc: "Resultados e arquivos de exames do paciente" },
];

interface LogEntry {
  id: string;
  integracao: string;
  acao: string | null;
  status: string;
  inicio: string;
  fim: string | null;
  registros_processados: number | null;
  registros_criados: number | null;
  registros_atualizados: number | null;
  registros_ignorados: number | null;
  erros: any;
  detalhes: any;
}

export default function FeegowIntegracaoPage() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [migracaoProgresso, setMigracaoProgresso] = useState(0);
  const [migracaoEtapa, setMigracaoEtapa] = useState("");
  const [retencaoAnos, setRetencaoAnos] = useState(5);
  const [migrarDesde, setMigrarDesde] = useState("");
  const [entidadesSelecionadas, setEntidadesSelecionadas] = useState<Record<string, boolean>>(
    Object.fromEntries(ENTIDADES_MIGRACAO.map(e => [e.key, true]))
  );

  // Status da integração
  const { data: integStatus } = useQuery({
    queryKey: ["feegow-status", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return null;
      const { data } = await supabase
        .from("integracoes")
        .select("*")
        .eq("clinica_id", clinicaId)
        .eq("tipo", "feegow")
        .maybeSingle();
      return data;
    },
    enabled: !!clinicaId,
  });

  // Contadores de dados importados
  const { data: contadores } = useQuery({
    queryKey: ["feegow-contadores", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return null;
      const [pac, ag, anam, presc, enc, laud, atest, res] = await Promise.all([
        supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId),
        supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId),
        supabase.from("anamneses").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId),
        supabase.from("prescricoes").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId),
        supabase.from("encaminhamentos").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId),
        supabase.from("laudos").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId),
        supabase.from("atestados").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId),
        supabase.from("resultados_exames").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId),
      ]);
      return {
        pacientes: pac.count || 0,
        agendamentos: ag.count || 0,
        anamneses: anam.count || 0,
        prescricoes: presc.count || 0,
        encaminhamentos: enc.count || 0,
        laudos: laud.count || 0,
        atestados: atest.count || 0,
        resultados: res.count || 0,
      };
    },
    enabled: !!clinicaId,
  });

  const fetchLogs = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("integracao_logs")
      .select("*")
      .eq("clinica_id", clinicaId)
      .in("integracao", ["feegow", "feegow_sales", "feegow_metadata", "feegow_backfill", "feegow_migracao_completa"])
      .order("created_at", { ascending: false })
      .limit(30);
    setLogs((data as any[]) || []);
    setLoading(false);
  }, [clinicaId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Calcular data mínima baseada na retenção
  useEffect(() => {
    const dataMinima = new Date();
    dataMinima.setFullYear(dataMinima.getFullYear() - retencaoAnos);
    setMigrarDesde(dataMinima.toISOString().split("T")[0]);
  }, [retencaoAnos]);

  const handleHealthCheck = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("feegow-healthcheck", {
        body: { clinica_id: clinicaId },
      });
      if (error) throw error;
      if (data?.ok) toast.success(`Conexao OK! ${data.duration_ms}ms, ${data.professional_count} profissionais.`);
      else toast.error(data?.error || "Falha na conexao");
      fetchLogs();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  // MIGRAÇÃO COMPLETA
  const handleMigracaoCompleta = async () => {
    const entidades = Object.entries(entidadesSelecionadas).filter(([, v]) => v).map(([k]) => k);
    if (entidades.length === 0) { toast.error("Selecione ao menos uma entidade"); return; }

    if (!confirm(
      `MIGRAÇÃO COMPLETA DO FEEGOW\n\n` +
      `Entidades: ${entidades.join(", ")}\n` +
      `Desde: ${new Date(migrarDesde).toLocaleDateString("pt-BR")}\n` +
      `Retenção: ${retencaoAnos} anos\n\n` +
      `Para cada paciente importado, o sistema irá:\n` +
      `- Criar/atualizar cadastro completo (CPF, nascimento, convenio...)\n` +
      `- Importar TODOS os prontuários e evoluções\n` +
      `- Importar prescrições, encaminhamentos, laudos e atestados\n` +
      `- Construir a linha do tempo automática do paciente\n` +
      `- Preservar histórico por no mínimo ${retencaoAnos} anos conforme CFM\n\n` +
      `Deseja continuar?`
    )) return;

    setMigrando(true);
    setMigracaoProgresso(0);

    const totalEtapas = entidades.length;
    let etapaAtual = 0;

    try {
      // Etapa 1: Médicos/Profissionais (sempre primeiro — são FK dos demais)
      if (entidades.includes("medicos")) {
        etapaAtual++;
        setMigracaoEtapa(`[${etapaAtual}/${totalEtapas}] Importando medicos e profissionais...`);
        setMigracaoProgresso((etapaAtual / totalEtapas) * 100);
        const { data, error } = await supabase.functions.invoke("feegow-migrate", {
          body: { clinica_id: clinicaId, entity: "professionals", since: migrarDesde },
        });
        if (error) throw error;
        toast.success(`Medicos: ${data?.created || 0} criados, ${data?.updated || 0} atualizados`);
      }

      // Etapa 2: Pacientes com dados completos
      if (entidades.includes("pacientes")) {
        etapaAtual++;
        setMigracaoEtapa(`[${etapaAtual}/${totalEtapas}] Importando pacientes com cadastro completo...`);
        setMigracaoProgresso((etapaAtual / totalEtapas) * 100);
        const { data, error } = await supabase.functions.invoke("feegow-migrate", {
          body: { clinica_id: clinicaId, entity: "patients", since: migrarDesde, retention_years: retencaoAnos },
        });
        if (error) throw error;
        toast.success(`Pacientes: ${data?.created || 0} criados, ${data?.updated || 0} atualizados`);
      }

      // Etapa 3: Agendamentos históricos
      if (entidades.includes("agendamentos")) {
        etapaAtual++;
        setMigracaoEtapa(`[${etapaAtual}/${totalEtapas}] Importando agendamentos historicos...`);
        setMigracaoProgresso((etapaAtual / totalEtapas) * 100);
        const { data, error } = await supabase.functions.invoke("feegow-migrate", {
          body: { clinica_id: clinicaId, entity: "appointments", since: migrarDesde },
        });
        if (error) throw error;
        toast.success(`Agendamentos: ${data?.created || 0} criados`);
      }

      // Etapa 4: Prontuários / Anamneses
      if (entidades.includes("prontuarios")) {
        etapaAtual++;
        setMigracaoEtapa(`[${etapaAtual}/${totalEtapas}] Importando prontuarios e anamneses...`);
        setMigracaoProgresso((etapaAtual / totalEtapas) * 100);
        const { data, error } = await supabase.functions.invoke("feegow-migrate", {
          body: { clinica_id: clinicaId, entity: "medical_records", since: migrarDesde },
        });
        if (error) throw error;
        toast.success(`Prontuarios: ${data?.created || 0} importados`);
      }

      // Etapa 5: Prescrições
      if (entidades.includes("prescricoes")) {
        etapaAtual++;
        setMigracaoEtapa(`[${etapaAtual}/${totalEtapas}] Importando prescricoes...`);
        setMigracaoProgresso((etapaAtual / totalEtapas) * 100);
        const { data, error } = await supabase.functions.invoke("feegow-migrate", {
          body: { clinica_id: clinicaId, entity: "prescriptions", since: migrarDesde },
        });
        if (error) throw error;
        toast.success(`Prescricoes: ${data?.created || 0} importadas`);
      }

      // Etapa 6: Encaminhamentos
      if (entidades.includes("encaminhamentos")) {
        etapaAtual++;
        setMigracaoEtapa(`[${etapaAtual}/${totalEtapas}] Importando encaminhamentos...`);
        setMigracaoProgresso((etapaAtual / totalEtapas) * 100);
        const { data, error } = await supabase.functions.invoke("feegow-migrate", {
          body: { clinica_id: clinicaId, entity: "referrals", since: migrarDesde },
        });
        if (error) throw error;
        toast.success(`Encaminhamentos: ${data?.created || 0} importados`);
      }

      // Etapa 7: Laudos e Atestados
      if (entidades.includes("laudos")) {
        etapaAtual++;
        setMigracaoEtapa(`[${etapaAtual}/${totalEtapas}] Importando laudos e atestados...`);
        setMigracaoProgresso((etapaAtual / totalEtapas) * 100);
        const { data, error } = await supabase.functions.invoke("feegow-migrate", {
          body: { clinica_id: clinicaId, entity: "reports_certificates", since: migrarDesde },
        });
        if (error) throw error;
        toast.success(`Laudos/Atestados: ${data?.created || 0} importados`);
      }

      // Etapa 8: Resultados de exames
      if (entidades.includes("resultados")) {
        etapaAtual++;
        setMigracaoEtapa(`[${etapaAtual}/${totalEtapas}] Importando resultados de exames...`);
        setMigracaoProgresso((etapaAtual / totalEtapas) * 100);
        const { data, error } = await supabase.functions.invoke("feegow-migrate", {
          body: { clinica_id: clinicaId, entity: "exam_results", since: migrarDesde },
        });
        if (error) throw error;
        toast.success(`Resultados: ${data?.created || 0} importados`);
      }

      setMigracaoProgresso(100);
      setMigracaoEtapa("Migracao completa! Todos os dados foram importados.");
      toast.success("Migracao completa do Feegow finalizada com sucesso!");

      // Invalidar queries para atualizar contadores
      queryClient.invalidateQueries({ queryKey: ["feegow-contadores"] });
      fetchLogs();

    } catch (e: any) {
      toast.error("Erro na migracao: " + e.message);
      setMigracaoEtapa(`Erro: ${e.message}`);
    } finally {
      setMigrando(false);
    }
  };

  // Sync incremental (diário)
  const handleSyncIncremental = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("sync-feegow", {
        body: { clinica_id: clinicaId, action: "full" },
      });
      if (error) throw error;
      toast.success(`Sync incremental: ${data?.sales?.criados || 0} criados, ${data?.sales?.atualizados || 0} atualizados`);
      fetchLogs();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "sucesso") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Sucesso</Badge>;
    if (status === "erro") return <Badge variant="destructive">Erro</Badge>;
    if (status === "erro_parcial") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Parcial</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Migracao Feegow → Medic Pop</h1>
          <p className="text-sm text-muted-foreground">
            Importe todos os dados do Feegow: pacientes, prontuarios, prescricoes, laudos, agendamentos. Retencao minima de 5 anos (CFM).
          </p>
        </div>

        <Tabs defaultValue="migracao">
          <TabsList>
            <TabsTrigger value="migracao">Migracao Completa</TabsTrigger>
            <TabsTrigger value="status">Status & Contadores</TabsTrigger>
            <TabsTrigger value="sync">Sync Incremental</TabsTrigger>
            <TabsTrigger value="logs">Historico</TabsTrigger>
          </TabsList>

          {/* === MIGRAÇÃO COMPLETA === */}
          <TabsContent value="migracao" className="space-y-4">
            {/* Conexão */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {integStatus?.status === "ativo" ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
                    Conexao com Feegow
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleHealthCheck} disabled={testing}>
                    <Activity className={`h-4 w-4 mr-2 ${testing ? "animate-pulse" : ""}`} />
                    {testing ? "Testando..." : "Testar Conexao"}
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Configuração da migração */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-5 w-5" /> Configurar Migracao
                </CardTitle>
                <CardDescription>
                  Selecione o que importar e o periodo de retencao. Para cada paciente, o sistema importa automaticamente
                  todo o cadastro, historico de consultas, prontuarios, prescricoes, laudos e constroi a linha do tempo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Retenção */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-semibold">Retencao de Dados (CFM exige minimo 5 anos)</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <Select value={String(retencaoAnos)} onValueChange={(v) => setRetencaoAnos(parseInt(v))}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 anos (minimo CFM)</SelectItem>
                          <SelectItem value="10">10 anos</SelectItem>
                          <SelectItem value="15">15 anos</SelectItem>
                          <SelectItem value="20">20 anos (recomendado)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant="outline" className="gap-1">
                        <Shield className="h-3 w-3" /> CFM
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dados de pacientes cujo ultimo atendimento ocorreu dentro deste periodo serao importados com historico completo.
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Importar desde</Label>
                    <Input type="date" value={migrarDesde} onChange={(e) => setMigrarDesde(e.target.value)} className="mt-2 w-[180px]" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Calculado automaticamente com base na retencao. Ajuste manualmente se necessario.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Seleção de entidades */}
                <div>
                  <Label className="text-sm font-semibold mb-3 block">Entidades a importar</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {ENTIDADES_MIGRACAO.map((ent) => (
                      <div key={ent.key} className="flex items-start gap-3 rounded-lg border p-3">
                        <Switch
                          checked={entidadesSelecionadas[ent.key]}
                          onCheckedChange={(v) => setEntidadesSelecionadas({ ...entidadesSelecionadas, [ent.key]: v })}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <ent.icon className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">{ent.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{ent.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* O que acontece na importação */}
                <Card className="bg-blue-50/50 border-blue-200">
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm text-blue-800 mb-2">O que acontece para cada paciente importado:</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>1. Cadastro completo criado/atualizado (nome, CPF, nascimento, telefone, email, convenio, carteirinha, endereco, sexo)</li>
                      <li>2. Todos os agendamentos historicos importados com status original (confirmado, cancelado, faltou, etc.)</li>
                      <li>3. Prontuarios e anamneses importados com texto medico original, CID, queixa, hipotese diagnostica</li>
                      <li>4. Prescricoes importadas com medicamentos, posologia e datas</li>
                      <li>5. Encaminhamentos importados com especialidade destino e exames solicitados</li>
                      <li>6. Laudos e atestados preservados com texto original e dias de afastamento</li>
                      <li>7. Resultados de exames vinculados ao paciente</li>
                      <li>8. <strong>Linha do tempo do paciente construida automaticamente</strong> — todo o historico acessivel na ficha do paciente</li>
                      <li>9. Dados retidos por no minimo {retencaoAnos} anos a partir do ultimo atendimento (CFM)</li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Progresso da migração */}
                {(migrando || migracaoProgresso > 0) && (
                  <Card className="border-primary">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{migracaoEtapa}</span>
                        <span className="text-sm font-mono">{Math.round(migracaoProgresso)}%</span>
                      </div>
                      <Progress value={migracaoProgresso} className="h-3" />
                    </CardContent>
                  </Card>
                )}

                {/* Botão de migração */}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleMigracaoCompleta}
                  disabled={migrando || !integStatus}
                >
                  {migrando ? (
                    <><RefreshCw className="h-5 w-5 mr-2 animate-spin" /> Migrando...</>
                  ) : (
                    <><Download className="h-5 w-5 mr-2" /> Iniciar Migracao Completa do Feegow</>
                  )}
                </Button>

                {!integStatus && (
                  <p className="text-xs text-destructive text-center">Configure a integração Feegow antes de migrar (teste a conexao acima).</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === STATUS & CONTADORES === */}
          <TabsContent value="status" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Dados Importados no Medic Pop</h2>
              <p className="text-sm text-muted-foreground">Totais atuais de registros por entidade</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Pacientes", value: contadores?.pacientes || 0, icon: Users, color: "text-blue-600" },
                { label: "Agendamentos", value: contadores?.agendamentos || 0, icon: Calendar, color: "text-green-600" },
                { label: "Anamneses", value: contadores?.anamneses || 0, icon: FileText, color: "text-purple-600" },
                { label: "Prescricoes", value: contadores?.prescricoes || 0, icon: Pill, color: "text-orange-600" },
                { label: "Encaminhamentos", value: contadores?.encaminhamentos || 0, icon: ArrowRight, color: "text-teal-600" },
                { label: "Laudos", value: contadores?.laudos || 0, icon: FileText, color: "text-indigo-600" },
                { label: "Atestados", value: contadores?.atestados || 0, icon: FileText, color: "text-pink-600" },
                { label: "Resultados Exames", value: contadores?.resultados || 0, icon: BarChart3, color: "text-yellow-600" },
              ].map((c) => (
                <Card key={c.label}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <c.icon className={`h-7 w-7 ${c.color}`} />
                    <div>
                      <p className="text-xl font-bold">{c.value.toLocaleString("pt-BR")}</p>
                      <p className="text-[11px] text-muted-foreground">{c.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-muted/30">
              <CardContent className="p-4 flex items-center gap-3">
                <Archive className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Politica de Retencao: {retencaoAnos} anos</p>
                  <p className="text-xs text-muted-foreground">
                    Dados de pacientes serao retidos por no minimo {retencaoAnos} anos a partir da data do ultimo atendimento, conforme Resolucao CFM 1.821/2007.
                    Apos este periodo, dados podem ser anonimizados mantendo apenas estatisticas agregadas.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === SYNC INCREMENTAL === */}
          <TabsContent value="sync" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sincronizacao Incremental</CardTitle>
                <CardDescription>
                  Apos a migracao completa, use a sincronizacao incremental para manter os dados atualizados
                  enquanto opera em paralelo com o Feegow (periodo de transicao de 30 dias).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={handleSyncIncremental} className="gap-2">
                    <Play className="h-4 w-4" /> Sync Agora (ultimos 30 dias)
                  </Button>
                  <Button variant="outline" onClick={async () => {
                    const { data, error } = await supabase.functions.invoke("feegow-backfill", {
                      body: { clinica_id: clinicaId, days: 90 },
                    });
                    if (error) toast.error(error.message);
                    else toast.success(`Backfill: ${data?.total_criados || 0} criados`);
                    fetchLogs();
                  }} className="gap-2">
                    <History className="h-4 w-4" /> Backfill (90 dias)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O sync incremental importa apenas registros novos ou alterados desde a ultima execucao.
                  Recomendado executar diariamente durante o periodo de operacao paralela.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === LOGS === */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Historico de Execucoes</CardTitle>
                  <Button variant="ghost" size="sm" onClick={fetchLogs}><RefreshCw className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma execucao registrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Acao</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead>Duracao</TableHead>
                        <TableHead className="text-right">Criados</TableHead>
                        <TableHead className="text-right">Atualiz.</TableHead>
                        <TableHead>Erros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const durationMs = log.fim ? new Date(log.fim).getTime() - new Date(log.inicio).getTime() : null;
                        const errosArr = Array.isArray(log.erros) ? log.erros : [];
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium text-sm">{log.acao || log.integracao}</TableCell>
                            <TableCell>{statusBadge(log.status)}</TableCell>
                            <TableCell className="text-xs">{formatDate(log.inicio)}</TableCell>
                            <TableCell className="text-xs font-mono">{durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : "—"}</TableCell>
                            <TableCell className="text-right font-mono">{log.registros_criados ?? "—"}</TableCell>
                            <TableCell className="text-right font-mono">{log.registros_atualizados ?? "—"}</TableCell>
                            <TableCell>
                              {errosArr.length > 0 ? <Badge variant="destructive">{errosArr.length}</Badge> : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
