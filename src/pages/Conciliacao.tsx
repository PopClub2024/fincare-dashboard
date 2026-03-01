import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, AlertTriangle, XCircle, Play, Eye,
  ArrowDownCircle, ArrowUpCircle, Banknote, RefreshCw, FileSearch,
  Upload, CreditCard, FileArchive,
} from "lucide-react";

interface ReconciliationResult {
  success: boolean;
  periodo: { start: string; end: string };
  totais: { vendas_feegow: number; getnet_transacoes: number; creditos_banco: number; debitos_banco: number };
  matches: { feegow_getnet: number; getnet_banco: number; triplo: number; total: number; persisted: number };
  debitos_automaticos: { processados: number; baixados: number; erros: string[] };
  pendencias: { vendas_sem_match: number; getnet_sem_match: number; creditos_sem_match: number; debitos_sem_match: number };
  taxas_getnet?: { total_bruto: number; total_taxa: number; total_liquido: number };
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
      result.pendencias.getnet_sem_match +
      result.pendencias.creditos_sem_match +
      result.pendencias.debitos_sem_match
    : 0;

  const [importingGetnet, setImportingGetnet] = useState(false);

  const handleGetnetCSV = async (e: React.ChangeEvent<HTMLInputElement>, tipo: "cartao" | "pix") => {
    const file = e.target.files?.[0];
    if (!file || !clinicaId) return;
    setImportingGetnet(true);
    try {
      const text = await file.text();
      const { data, error } = await supabase.functions.invoke("import-getnet-csv", {
        body: { clinica_id: clinicaId, csv_content: text, tipo_extrato: tipo, nome_arquivo: file.name },
      });
      if (error) throw error;
      toast({ title: "Getnet importado!", description: `${data.created} transações criadas, ${data.skipped} duplicadas ignoradas` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setImportingGetnet(false);
      e.target.value = "";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conciliação</h1>
          <p className="text-sm text-muted-foreground">
            Feegow (vendas) × Getnet (taxas) × Banco (depósitos)
          </p>
        </div>

        {/* Import + Filtros */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" /> Importar Getnet CSV</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <div>
                <Label htmlFor="getnet-cartao" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 px-4 py-3 text-sm text-muted-foreground hover:bg-muted">
                  <Upload className="h-4 w-4" />{importingGetnet ? "Processando..." : "Cartão CSV"}
                </Label>
                <Input id="getnet-cartao" type="file" accept=".csv" className="hidden" onChange={(e) => handleGetnetCSV(e, "cartao")} disabled={importingGetnet} />
              </div>
              <div>
                <Label htmlFor="getnet-pix" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 px-4 py-3 text-sm text-muted-foreground hover:bg-muted">
                  <Upload className="h-4 w-4" />{importingGetnet ? "Processando..." : "PIX CSV"}
                </Label>
                <Input id="getnet-pix" type="file" accept=".csv" className="hidden" onChange={(e) => handleGetnetCSV(e, "pix")} disabled={importingGetnet} />
              </div>
            </CardContent>
          </Card>

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
              <Button variant="outline" onClick={() => runReconciliation(true)} disabled={loading} size="sm">
                <Eye className="mr-1 h-4 w-4" />Simular
              </Button>
              <Button onClick={() => runReconciliation(false)} disabled={loading} size="sm">
                <Play className="mr-1 h-4 w-4" />Executar
              </Button>
              <Button variant="ghost" onClick={loadConciliacoes} disabled={loadingList} size="sm">
                <RefreshCw className="mr-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Cards de resultado */}
        {result && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard title="Vendas (Feegow)" value={result.totais.vendas_feegow} matched={result.matches.feegow_getnet} pending={result.pendencias.vendas_sem_match} icon={<ArrowDownCircle className="h-5 w-5 text-emerald-500" />} />
            <SummaryCard title="Getnet" value={result.totais.getnet_transacoes} matched={result.matches.feegow_getnet} pending={result.pendencias.getnet_sem_match} icon={<CreditCard className="h-5 w-5 text-blue-500" />} />
            <SummaryCard title="Créditos (Banco)" value={result.totais.creditos_banco} matched={result.matches.getnet_banco} pending={result.pendencias.creditos_sem_match} icon={<ArrowUpCircle className="h-5 w-5 text-violet-500" />} />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Triplo ✓</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{result.matches.triplo}</p>
                <p className="text-xs text-muted-foreground">Feegow↔Getnet↔Banco</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Débitos Auto</CardTitle>
                <FileSearch className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{result.debitos_automaticos.baixados}/{result.totais.debitos_banco}</p>
                <p className="text-xs text-muted-foreground">baixados</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Taxas Getnet */}
        {result?.taxas_getnet && result.taxas_getnet.total_bruto > 0 && (
          <Card>
            <CardContent className="flex items-center gap-6 pt-6">
              <div><p className="text-xs text-muted-foreground">Bruto</p><p className="font-bold">{fmt(result.taxas_getnet.total_bruto)}</p></div>
              <span className="text-muted-foreground">−</span>
              <div><p className="text-xs text-muted-foreground">Taxas Getnet</p><p className="font-bold text-destructive">{fmt(result.taxas_getnet.total_taxa)}</p></div>
              <span className="text-muted-foreground">=</span>
              <div><p className="text-xs text-muted-foreground">Líquido (banco)</p><p className="font-bold text-emerald-600">{fmt(result.taxas_getnet.total_liquido)}</p></div>
            </CardContent>
          </Card>
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
                <StatRow label="Feegow↔Getnet" value={result.matches.feegow_getnet} />
                <StatRow label="Getnet↔Banco" value={result.matches.getnet_banco} />
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
