import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Wifi, WifiOff,
  Activity, Database, AlertTriangle, Play, History,
} from "lucide-react";

interface LogEntry {
  id: string;
  integracao: string;
  acao: string | null;
  endpoint: string | null;
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

interface DiagnosticData {
  vendas_total: number;
  vendas_por_mes: Array<{ mes: string; total: number }>;
  ultima_execucao_ok: string | null;
  ultima_execucao_erro: string | null;
  status_integracao: string;
  ultima_sincronizacao: string | null;
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR") : "—";

export default function FeegowIntegracaoPage() {
  const { clinicaId } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [healthResult, setHealthResult] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);

    const [logsRes, integRes, vendasRes, vendasMesRes, lastOkRes, lastErrRes] = await Promise.all([
      supabase
        .from("integracao_logs")
        .select("*")
        .eq("clinica_id", clinicaId)
        .in("integracao", ["feegow", "feegow_sales", "feegow_metadata", "feegow_backfill"])
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("integracoes")
        .select("status, ultima_sincronizacao")
        .eq("clinica_id", clinicaId)
        .eq("tipo", "feegow")
        .maybeSingle(),
      supabase
        .from("transacoes_vendas")
        .select("id", { count: "exact", head: true })
        .eq("clinica_id", clinicaId),
      supabase.rpc("get_dre", {
        _start_date: new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0],
        _end_date: new Date().toISOString().split("T")[0],
      }),
      supabase
        .from("integracao_logs")
        .select("created_at")
        .eq("clinica_id", clinicaId)
        .like("integracao", "feegow%")
        .eq("status", "sucesso")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("integracao_logs")
        .select("created_at")
        .eq("clinica_id", clinicaId)
        .like("integracao", "feegow%")
        .eq("status", "erro")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setLogs((logsRes.data as any[]) || []);

    setDiagnostic({
      vendas_total: vendasRes.count || 0,
      vendas_por_mes: [],
      ultima_execucao_ok: lastOkRes.data?.[0]?.created_at || null,
      ultima_execucao_erro: lastErrRes.data?.[0]?.created_at || null,
      status_integracao: integRes.data?.status || "inativo",
      ultima_sincronizacao: integRes.data?.ultima_sincronizacao || null,
    });

    setLoading(false);
  }, [clinicaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleHealthCheck = async () => {
    setTesting(true);
    setHealthResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("feegow-healthcheck", {
        body: { clinica_id: clinicaId },
      });
      if (error) throw error;
      setHealthResult(data);
      if (data?.ok) toast.success(`Conexão OK! ${data.duration_ms}ms, ${data.professional_count} profissionais encontrados.`);
      else toast.error(data?.error || "Falha na conexão");
      fetchData();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
      setHealthResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-feegow", {
        body: { clinica_id: clinicaId, action: "full" },
      });
      if (error) throw error;
      const sales = data?.sales;
      toast.success(
        `Sincronização concluída! ${sales?.criados || 0} criados, ${sales?.atualizados || 0} atualizados.`
      );
      fetchData();
    } catch (e: any) {
      toast.error("Erro na sincronização: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfill = async () => {
    if (!confirm("Iniciar backfill dos últimos 90 dias? Isso pode levar alguns minutos.")) return;
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("feegow-backfill", {
        body: { clinica_id: clinicaId, days: 90 },
      });
      if (error) throw error;
      toast.success(
        `Backfill concluído! ${data?.total_criados || 0} criados, ${data?.total_atualizados || 0} atualizados em ${data?.windows_processed || 0} janelas.`
      );
      fetchData();
    } catch (e: any) {
      toast.error("Erro no backfill: " + e.message);
    } finally {
      setBackfilling(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === "sucesso") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (status === "erro") return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === "erro_parcial") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const statusBadge = (status: string) => {
    if (status === "sucesso") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Sucesso</Badge>;
    if (status === "erro") return <Badge variant="destructive">Erro</Badge>;
    if (status === "erro_parcial") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Parcial</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integração Feegow</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a conexão, sincronize dados e monitore logs
          </p>
        </div>

        {/* Status + Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Connection Status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {diagnostic?.status_integracao === "ativo" ? (
                  <Wifi className="h-5 w-5 text-emerald-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                )}
                <CardTitle className="text-base">Status da Conexão</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={diagnostic?.status_integracao === "ativo" ? "default" : "secondary"}>
                  {diagnostic?.status_integracao || "inativo"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Última sync</span>
                <span className="text-xs">{formatDate(diagnostic?.ultima_sincronizacao || null)}</span>
              </div>
              {healthResult && (
                <div className={`rounded-lg p-2 text-xs ${healthResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
                  {healthResult.ok
                    ? `✓ OK em ${healthResult.duration_ms}ms — ${healthResult.professional_count} profissionais`
                    : `✗ ${healthResult.error}`}
                </div>
              )}
              <Button onClick={handleHealthCheck} disabled={testing} variant="outline" className="w-full gap-2" size="sm">
                <Activity className={`h-4 w-4 ${testing ? "animate-pulse" : ""}`} />
                {testing ? "Testando..." : "Testar Conexão"}
              </Button>
            </CardContent>
          </Card>

          {/* Sync Actions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Sincronização</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleSync} disabled={syncing || backfilling} className="w-full gap-2">
                <Play className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sincronizar Agora (30 dias)"}
              </Button>
              <Button onClick={handleBackfill} disabled={backfilling || syncing} variant="outline" className="w-full gap-2">
                <History className={`h-4 w-4 ${backfilling ? "animate-spin" : ""}`} />
                {backfilling ? "Processando..." : "Backfill (90 dias)"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Backfill divide em janelas de 7 dias para maior confiabilidade.
              </p>
            </CardContent>
          </Card>

          {/* Diagnostic */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Diagnóstico</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total de vendas</span>
                <span className="font-mono text-sm font-bold">{diagnostic?.vendas_total.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Última OK</span>
                <span className="text-xs">{formatDate(diagnostic?.ultima_execucao_ok || null)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Último erro</span>
                <span className="text-xs text-destructive">{formatDate(diagnostic?.ultima_execucao_erro || null)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Histórico de Execuções</CardTitle>
                <CardDescription>Últimas 30 execuções da integração Feegow</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>
                <p className="text-xs text-muted-foreground">Clique em "Testar Conexão" ou "Sincronizar" para começar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead className="text-right">Criados</TableHead>
                      <TableHead className="text-right">Atualiz.</TableHead>
                      <TableHead>Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const durationMs = log.fim
                        ? new Date(log.fim).getTime() - new Date(log.inicio).getTime()
                        : null;
                      const errosArr = Array.isArray(log.erros) ? log.erros : [];
                      return (
                        <TableRow key={log.id}>
                          <TableCell>{statusIcon(log.status)}</TableCell>
                          <TableCell>
                            <div>
                              <span className="text-sm font-medium">{log.acao || log.integracao}</span>
                              {log.endpoint && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{log.endpoint}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{statusBadge(log.status)}</TableCell>
                          <TableCell className="text-xs">{formatDate(log.inicio)}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{log.registros_criados ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{log.registros_atualizados ?? "—"}</TableCell>
                          <TableCell>
                            {errosArr.length > 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                {errosArr.length} erro(s)
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
