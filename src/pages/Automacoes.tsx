import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Play, Zap, FileText,
  GitCompare, AlertTriangle, Upload, Database, Activity,
} from "lucide-react";

const formatDate = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const statusBadge = (status: string) => {
  if (status === "sucesso") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Sucesso</Badge>;
  if (status === "erro") return <Badge variant="destructive">Erro</Badge>;
  if (status === "erro_parcial") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Parcial</Badge>;
  if (status === "em_andamento") return <Badge variant="secondary">Em andamento</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

export default function AutomacoesPage() {
  const { clinicaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncRuns, setSyncRuns] = useState<any[]>([]);
  const [importRuns, setImportRuns] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    const [runsRes, importsRes, logsRes] = await Promise.all([
      supabase.from("feegow_sync_runs").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(12),
      supabase.from("import_runs").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(30),
      supabase.from("integracao_logs").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(20),
    ]);
    setSyncRuns(runsRes.data || []);
    setImportRuns(importsRes.data || []);
    setRecentLogs(logsRes.data || []);
    setLoading(false);
  }, [clinicaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAction = async (action: string, payload: any, label: string) => {
    setRunning(action);
    try {
      const { data, error } = await supabase.functions.invoke("automation-webhook", {
        body: { action, clinica_id: clinicaId, ...payload },
      });
      if (error) throw error;
      toast.success(`${label} concluído: ${data?.success ? "OK" : "com pendências"}`);
      fetchData();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setRunning(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const lastFeegow = syncRuns[0];
  const lastBanco = importRuns.find(r => r.tipo?.includes("banco"));
  const lastGetnet = importRuns.find(r => r.tipo?.includes("getnet"));
  const lastConciliacao = recentLogs.find(r => r.integracao === "conciliacao");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Automações</h1>
          <p className="text-sm text-muted-foreground">Pipeline automatizado: Feegow → Importações → Conciliação</p>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Feegow</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{lastFeegow ? statusBadge(lastFeegow.status) : <span className="text-muted-foreground text-sm">Nunca executado</span>}</div>
              <p className="text-xs text-muted-foreground mt-1">{lastFeegow ? formatDate(lastFeegow.created_at) : ""}</p>
              <Button size="sm" className="w-full mt-3 gap-2" disabled={running === "feegow_run_month"}
                onClick={() => runAction("feegow_run_month", { year: 2026, month: 1 }, "Feegow Jan/2026")}>
                <Play className="h-3 w-3" /> {running === "feegow_run_month" ? "Rodando..." : "Rodar Jan/2026"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Banco (OFX)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{lastBanco ? statusBadge(lastBanco.status) : <span className="text-muted-foreground text-sm">Aguardando arquivo</span>}</div>
              <p className="text-xs text-muted-foreground mt-1">{lastBanco ? formatDate(lastBanco.created_at) : "Via Make.com ou upload"}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {lastBanco ? `${lastBanco.registros_criados || 0} criados` : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Getnet</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{lastGetnet ? statusBadge(lastGetnet.status) : <span className="text-muted-foreground text-sm">Aguardando arquivo</span>}</div>
              <p className="text-xs text-muted-foreground mt-1">{lastGetnet ? formatDate(lastGetnet.created_at) : "Via Make.com ou upload"}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {lastGetnet ? `${lastGetnet.registros_criados || 0} criados` : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Conciliação</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{lastConciliacao ? statusBadge(lastConciliacao.status) : <span className="text-muted-foreground text-sm">Pendente</span>}</div>
              <p className="text-xs text-muted-foreground mt-1">{lastConciliacao ? formatDate(lastConciliacao.created_at) : ""}</p>
              <Button size="sm" variant="outline" className="w-full mt-3 gap-2" disabled={running === "run_reconciliation"}
                onClick={() => runAction("run_reconciliation", { start_date: "2026-01-01", end_date: "2026-01-31" }, "Conciliação Jan/2026")}>
                <GitCompare className="h-3 w-3" /> {running === "run_reconciliation" ? "Rodando..." : "Conciliar Jan/2026"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Tabs with details */}
        <Tabs defaultValue="feegow" className="space-y-4">
          <TabsList>
            <TabsTrigger value="feegow">Feegow Runs</TabsTrigger>
            <TabsTrigger value="imports">Importações</TabsTrigger>
            <TabsTrigger value="logs">Logs Gerais</TabsTrigger>
          </TabsList>

          <TabsContent value="feegow">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Runs Feegow</CardTitle>
                <CardDescription>Execuções do pipeline healthcheck → sync → validação</CardDescription>
              </CardHeader>
              <CardContent>
                {syncRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhum run registrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>HC</TableHead>
                        <TableHead>Sync</TableHead>
                        <TableHead>Valid</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Erros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncRuns.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-sm">{`${r.month}/${r.year}`}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell>{r.healthcheck_ok === true ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : r.healthcheck_ok === false ? <XCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</TableCell>
                          <TableCell>{r.sync_invoices_ok === true ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : r.sync_invoices_ok === false ? <XCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</TableCell>
                          <TableCell>{r.validate_sales_ok === true ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : r.validate_sales_ok === false ? <XCircle className="h-4 w-4 text-destructive" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</TableCell>
                          <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                          <TableCell>{Array.isArray(r.errors) && r.errors.length > 0 ? <Badge variant="destructive">{r.errors.length}</Badge> : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imports">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Importações Recentes</CardTitle>
                <CardDescription>Arquivos recebidos via Make.com ou upload manual</CardDescription>
              </CardHeader>
              <CardContent>
                {importRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma importação registrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Criados</TableHead>
                        <TableHead className="text-right">Rejeitados</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRuns.map(r => (
                        <TableRow key={r.id}>
                          <TableCell><Badge variant="outline">{r.tipo}</Badge></TableCell>
                          <TableCell className="text-xs">{r.origem}</TableCell>
                          <TableCell className="text-xs truncate max-w-[150px]">{r.arquivo_nome || "—"}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-right font-mono">{r.registros_criados || 0}</TableCell>
                          <TableCell className="text-right font-mono">{r.registros_rejeitados || 0}</TableCell>
                          <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Logs Recentes</CardTitle>
                  <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Integração</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Processados</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{l.integracao}</TableCell>
                        <TableCell className="text-xs">{l.acao || "—"}</TableCell>
                        <TableCell>{statusBadge(l.status)}</TableCell>
                        <TableCell className="text-right font-mono">{l.registros_processados || 0}</TableCell>
                        <TableCell className="text-xs">{formatDate(l.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Make.com Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuração Make.com</CardTitle>
            <CardDescription>URLs e payloads para automação via Make.com</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">Endpoint único:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block overflow-x-auto">
                POST {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "bvezzatavermwhdlljyy"}.supabase.co/functions/v1/automation-webhook`}
              </code>
              <p className="text-xs text-muted-foreground mt-1">Header: <code>x-webhook-secret: [seu_secret]</code></p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                { action: "feegow_run_month", desc: "Sincronizar Feegow", payload: '{ "action": "feegow_run_month", "clinica_id": "...", "year": 2026, "month": 1 }' },
                { action: "import_bank_statement", desc: "Importar extrato bancário", payload: '{ "action": "import_bank_statement", "clinica_id": "...", "file_url": "...", "file_name": "extrato.ofx" }' },
                { action: "import_getnet_statement", desc: "Importar Getnet", payload: '{ "action": "import_getnet_statement", "clinica_id": "...", "file_url": "...", "tipo_extrato": "cartao" }' },
                { action: "run_reconciliation", desc: "Rodar conciliação", payload: '{ "action": "run_reconciliation", "clinica_id": "...", "start_date": "2026-01-01", "end_date": "2026-01-31" }' },
                { action: "import_repasses_medicos", desc: "Importar repasses médicos", payload: '{ "action": "import_repasses_medicos", "clinica_id": "...", "repasses": [{"medico": "Dr. X", "ref_dia_trabalhado": "2026-01-15", "valor": 500}] }' },
              ].map(item => (
                <div key={item.action} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{item.desc}</p>
                  <code className="text-[10px] text-muted-foreground block mt-1 overflow-x-auto whitespace-pre">{item.payload}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
