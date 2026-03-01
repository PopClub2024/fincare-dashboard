import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
  FileText, Upload, RotateCcw, Inbox,
} from "lucide-react";

const formatDate = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const statusBadge = (status: string) => {
  if (status === "sucesso" || status === "processado") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">OK</Badge>;
  if (status === "erro") return <Badge variant="destructive">Erro</Badge>;
  if (status === "erro_parcial") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Parcial</Badge>;
  if (status === "em_andamento" || status === "processando") return <Badge variant="secondary">Processando</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

export default function ImportInboxPage() {
  const { clinicaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [importRuns, setImportRuns] = useState<any[]>([]);
  const [arquivos, setArquivos] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    const [runsRes, arqRes] = await Promise.all([
      supabase.from("import_runs").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(50),
      supabase.from("arquivos_importados").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(50),
    ]);
    setImportRuns(runsRes.data || []);
    setArquivos(arqRes.data || []);
    setLoading(false);
  }, [clinicaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  const pendentes = importRuns.filter(r => r.status === "em_andamento").length;
  const erros = importRuns.filter(r => r.status === "erro" || r.status === "erro_parcial").length;
  const ok = importRuns.filter(r => r.status === "sucesso").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Inbox className="h-6 w-6" /> Inbox de Importações
            </h1>
            <p className="text-sm text-muted-foreground">Arquivos recebidos via Make.com e upload manual</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{ok}</p>
                  <p className="text-xs text-muted-foreground">Processados com sucesso</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{erros}</p>
                  <p className="text-xs text-muted-foreground">Com erros</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{pendentes}</p>
                  <p className="text-xs text-muted-foreground">Em processamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Import Runs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Runs de Importação</CardTitle>
          </CardHeader>
          <CardContent>
            {importRuns.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Upload className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>
                <p className="text-xs text-muted-foreground">Configure o Make.com para enviar arquivos automaticamente.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Criados</TableHead>
                      <TableHead className="text-right">Rejeitados</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRuns.map(r => {
                      const errosArr = Array.isArray(r.erros) ? r.erros : [];
                      return (
                        <TableRow key={r.id}>
                          <TableCell><Badge variant="outline" className="text-xs">{r.tipo}</Badge></TableCell>
                          <TableCell className="text-xs">{r.origem}</TableCell>
                          <TableCell className="text-xs truncate max-w-[150px]" title={r.arquivo_nome}>{r.arquivo_nome || "—"}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{r.registros_total || 0}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{r.registros_criados || 0}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{r.registros_rejeitados || 0}</TableCell>
                          <TableCell className="text-xs">{r.periodo_inicio ? `${r.periodo_inicio} → ${r.periodo_fim}` : "—"}</TableCell>
                          <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                          <TableCell>
                            {errosArr.length > 0 ? (
                              <Badge variant="destructive" className="text-xs cursor-pointer"
                                title={errosArr.slice(0, 5).join("\n")}>
                                {errosArr.length} erro(s)
                              </Badge>
                            ) : "—"}
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

        {/* Legacy Arquivos */}
        {arquivos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Arquivos Importados (legado)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arquivos.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs truncate max-w-[200px]">{a.nome_arquivo}</TableCell>
                      <TableCell><Badge variant="outline">{a.tipo}</Badge></TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell className="text-right font-mono">{a.registros_importados || 0}</TableCell>
                      <TableCell className="text-xs">{formatDate(a.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
