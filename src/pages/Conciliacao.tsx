import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, AlertTriangle, XCircle, Play, Eye,
  ArrowDownCircle, ArrowUpCircle, Banknote, RefreshCw, FileSearch,
} from "lucide-react";

interface ReconciliationResult {
  success: boolean;
  periodo: { start: string; end: string };
  totais: { vendas: number; recebimentos: number; creditos_banco: number; debitos_banco: number };
  matches: { venda_recebimento: number; recebimento_banco: number; triplo: number; total: number; persisted: number };
  debitos_automaticos: { processados: number; baixados: number; erros: string[] };
  pendencias: { vendas_sem_match: number; recebimentos_sem_match: number; creditos_sem_match: number; debitos_sem_match: number };
  dry_run: boolean;
}

interface ConciliacaoRow {
  id: string;
  status: string;
  divergencia: number;
  tipo: string;
  metodo_match: string;
  score: number;
  observacao: string;
  created_at: string;
  venda_id: string | null;
  recebimento_id: string | null;
  transacao_bancaria_id: string | null;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Conciliacao() {
  const { clinicaId } = useAuth();
  const { toast } = useToast();
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [conciliacoes, setConciliacoes] = useState<ConciliacaoRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const runReconciliation = async (dryRun: boolean) => {
    if (!clinicaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-reconciliation", {
        body: { clinica_id: clinicaId, date_start: dateStart, date_end: dateEnd, dry_run: dryRun },
      });
      if (error) throw error;
      setResult(data);
      toast({
        title: dryRun ? "Simulação concluída" : "Conciliação executada",
        description: `${data.matches.total} matches ${dryRun ? "identificados" : "persistidos"}`,
      });
      if (!dryRun) loadConciliacoes();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadConciliacoes = async () => {
    if (!clinicaId) return;
    setLoadingList(true);
    const { data } = await supabase
      .from("conciliacoes")
      .select("*")
      .eq("clinica_id", clinicaId)
      .gte("created_at", `${dateStart}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(100);
    setConciliacoes((data as any[]) || []);
    setLoadingList(false);
  };

  const totalPendencias = result
    ? result.pendencias.vendas_sem_match +
      result.pendencias.recebimentos_sem_match +
      result.pendencias.creditos_sem_match +
      result.pendencias.debitos_sem_match
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conciliação</h1>
          <p className="text-sm text-muted-foreground">
            Compare vendas Feegow × recebimentos × extrato bancário
          </p>
        </div>

        {/* Filtros + Ações */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4 pt-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Início</label>
              <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fim</label>
              <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" onClick={() => runReconciliation(true)} disabled={loading}>
              <Eye className="mr-2 h-4 w-4" />
              Simular (Dry Run)
            </Button>
            <Button onClick={() => runReconciliation(false)} disabled={loading}>
              <Play className="mr-2 h-4 w-4" />
              Executar Conciliação
            </Button>
            <Button variant="ghost" onClick={loadConciliacoes} disabled={loadingList}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar Lista
            </Button>
          </CardContent>
        </Card>

        {/* Cards de resultado */}
        {result && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Vendas (Feegow)"
              value={result.totais.vendas}
              matched={result.matches.venda_recebimento}
              pending={result.pendencias.vendas_sem_match}
              icon={<ArrowDownCircle className="h-5 w-5 text-emerald-500" />}
            />
            <SummaryCard
              title="Recebimentos"
              value={result.totais.recebimentos}
              matched={result.matches.venda_recebimento}
              pending={result.pendencias.recebimentos_sem_match}
              icon={<Banknote className="h-5 w-5 text-blue-500" />}
            />
            <SummaryCard
              title="Créditos (Banco)"
              value={result.totais.creditos_banco}
              matched={result.matches.recebimento_banco}
              pending={result.pendencias.creditos_sem_match}
              icon={<ArrowUpCircle className="h-5 w-5 text-violet-500" />}
            />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Débitos Auto</CardTitle>
                <FileSearch className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{result.debitos_automaticos.baixados}/{result.totais.debitos_banco}</p>
                <p className="text-xs text-muted-foreground">baixados automaticamente</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Status geral */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {totalPendencias === 0 ? (
                  <><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Tudo conciliado</>
                ) : (
                  <><AlertTriangle className="h-5 w-5 text-amber-500" /> {totalPendencias} pendência(s)</>
                )}
                {result.dry_run && <Badge variant="outline" className="ml-2">Simulação</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatRow label="Matches Venda↔Recebimento" value={result.matches.venda_recebimento} />
                <StatRow label="Matches Recebimento↔Banco" value={result.matches.recebimento_banco} />
                <StatRow label="Conciliações Triplas" value={result.matches.triplo} />
              </div>
              {result.debitos_automaticos.erros.length > 0 && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive">Erros nos débitos automáticos:</p>
                  {result.debitos_automaticos.erros.map((e, i) => (
                    <p key={i} className="text-xs text-destructive/80">{e}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Lista de conciliações */}
        <Tabs defaultValue="todas">
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="conciliado">Conciliadas</TabsTrigger>
            <TabsTrigger value="divergente">Divergentes</TabsTrigger>
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          </TabsList>

          {["todas", "conciliado", "divergente", "pendente"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">Divergência</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conciliacoes
                        .filter((c) => tab === "todas" || c.status === tab)
                        .map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <StatusBadge status={c.status} />
                            </TableCell>
                            <TableCell className="text-xs">{c.tipo || "-"}</TableCell>
                            <TableCell className="text-xs">{c.metodo_match || "-"}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {c.score ? `${c.score.toFixed(0)}%` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {c.divergencia ? fmt(c.divergencia) : "-"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {c.observacao || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      {conciliacoes.filter((c) => tab === "todas" || c.status === tab).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhuma conciliação encontrada. Clique em "Atualizar Lista" ou execute uma conciliação.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({
  title, value, matched, pending, icon,
}: {
  title: string; value: number; matched: number; pending: number; icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{matched}/{value}</p>
        <p className="text-xs text-muted-foreground">
          {pending > 0 ? (
            <span className="text-amber-500">{pending} sem match</span>
          ) : (
            <span className="text-emerald-500">Todos conciliados</span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "conciliado")
    return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"><CheckCircle2 className="mr-1 h-3 w-3" />Conciliado</Badge>;
  if (status === "divergente")
    return <Badge variant="outline" className="border-amber-500/30 text-amber-600"><AlertTriangle className="mr-1 h-3 w-3" />Divergente</Badge>;
  return <Badge variant="outline" className="border-muted text-muted-foreground"><XCircle className="mr-1 h-3 w-3" />Pendente</Badge>;
}
