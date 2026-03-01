import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  RefreshCw, Upload, CheckCircle2, XCircle, Clock, Wifi, Plus, Pencil, Trash2, Search, Info, BarChart3,
} from "lucide-react";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ======================= TYPES =======================
interface IntegracaoInfo {
  id: string;
  tipo: string;
  status: string;
  ultima_sincronizacao: string | null;
}

interface SyncLogEntry {
  id: string;
  inicio: string;
  fim: string | null;
  status: string;
  registros_processados: number | null;
  detalhes: string | null;
}

interface PlanoContas {
  id: string;
  codigo: number;
  codigo_estruturado: string;
  descricao: string;
  indicador: string;
  categoria: string;
  ativo: boolean;
}

interface Lancamento {
  plano_contas_id: string | null;
  valor: number;
  plano_contas?: { categoria: string; indicador: string } | null;
}

// ======================= MAIN PAGE =======================
export default function Configuracoes() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie integrações, plano de contas e parâmetros
          </p>
        </div>

        <Tabs defaultValue="integracoes" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="plano">Plano de Contas</TabsTrigger>
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          </TabsList>

          <TabsContent value="integracoes"><TabIntegracoes /></TabsContent>
          <TabsContent value="plano"><TabPlanoContasConfig /></TabsContent>
          <TabsContent value="indicadores"><TabIndicadores /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ======================= TAB: INTEGRAÇÕES =======================
function TabIntegracoes() {
  const { clinicaId } = useAuth();
  const [integracoes, setIntegracoes] = useState<IntegracaoInfo[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loadingOFX, setLoadingOFX] = useState(false);

  useEffect(() => {
    if (!clinicaId) return;
    fetchIntegracoes();
    fetchSyncLogs();
  }, [clinicaId]);

  const fetchIntegracoes = async () => {
    const { data } = await supabase
      .from("integracoes")
      .select("id, tipo, status, ultima_sincronizacao")
      .eq("clinica_id", clinicaId!);
    setIntegracoes(data || []);
  };

  const fetchSyncLogs = async () => {
    const { data } = await supabase
      .from("sync_log")
      .select("id, inicio, fim, status, registros_processados, detalhes")
      .eq("clinica_id", clinicaId!)
      .order("inicio", { ascending: false })
      .limit(10);
    setSyncLogs(data || []);
  };

  const handleSyncFeegow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-feegow", {
        body: { clinica_id: clinicaId },
      });
      if (error) throw error;
      toast.success(`Sincronização concluída! ${data?.result?.medicos || 0} médicos, ${data?.result?.agendamentos || 0} agendamentos.`);
      fetchIntegracoes();
      fetchSyncLogs();
    } catch (e: any) {
      toast.error("Erro na sincronização: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleOFXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Selecione um arquivo .OFX válido");
      return;
    }
    setLoadingOFX(true);
    try {
      const text = await file.text();
      const { data, error } = await supabase.functions.invoke("import-ofx", {
        body: { clinica_id: clinicaId, ofx_content: text },
      });
      if (error) throw error;
      toast.success(`OFX importado! ${data?.created || 0} criados, ${data?.matched || 0} conciliados.`);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoadingOFX(false);
      e.target.value = "";
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "ativo": case "sucesso": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "erro": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "ativo": case "sucesso": return "default" as const;
      case "erro": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  const feegowInteg = integracoes.find((i) => i.tipo === "feegow");
  const getnetInteg = integracoes.find((i) => i.tipo === "getnet");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-secondary" />
                <CardTitle className="text-lg">Feegow</CardTitle>
              </div>
              <Badge variant={statusBadgeVariant(feegowInteg?.status || "inativo")}>{feegowInteg?.status || "inativo"}</Badge>
            </div>
            <CardDescription>Sincroniza médicos, salas, convênios, pacientes e agendamentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {feegowInteg?.ultima_sincronizacao && (
              <p className="text-xs text-muted-foreground">Última: {new Date(feegowInteg.ultima_sincronizacao).toLocaleString("pt-BR")}</p>
            )}
            <Button onClick={handleSyncFeegow} disabled={syncing} className="w-full gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar Agora"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-secondary" />
                <CardTitle className="text-lg">Getnet</CardTitle>
              </div>
              <Badge variant={statusBadgeVariant(getnetInteg?.status || "inativo")}>{getnetInteg?.status || "inativo"}</Badge>
            </div>
            <CardDescription>Conciliação automática de cartões e PIX QR Code</CardDescription>
          </CardHeader>
          <CardContent>
            {getnetInteg?.ultima_sincronizacao && (
              <p className="text-xs text-muted-foreground mb-3">Última: {new Date(getnetInteg.ultima_sincronizacao).toLocaleString("pt-BR")}</p>
            )}
            <p className="text-sm text-muted-foreground">Baixa automática disponível em Contas a Receber.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-secondary" />
            <CardTitle className="text-lg">Importar Extrato OFX</CardTitle>
          </div>
          <CardDescription>Importe extratos bancários para conciliação automática</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="ofx-upload" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 px-6 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted">
              <Upload className="h-4 w-4" />
              {loadingOFX ? "Processando..." : "Selecionar arquivo .OFX"}
            </Label>
            <Input id="ofx-upload" type="file" accept=".ofx" className="hidden" onChange={handleOFXUpload} disabled={loadingOFX} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Histórico de Sincronizações</CardTitle></CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada.</p>
          ) : (
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-3">
                    {statusIcon(log.status)}
                    <div>
                      <p className="text-sm font-medium">{new Date(log.inicio).toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground">{log.detalhes || "—"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={statusBadgeVariant(log.status)} className="text-xs">{log.status}</Badge>
                    {log.registros_processados != null && (
                      <p className="mt-1 text-xs text-muted-foreground">{log.registros_processados} registros</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ======================= TAB: PLANO DE CONTAS (CRUD) =======================
function TabPlanoContasConfig() {
  const { clinicaId } = useAuth();
  const [contas, setContas] = useState<PlanoContas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<PlanoContas | null>(null);
  const [form, setForm] = useState({
    codigo: "", codigo_estruturado: "", descricao: "", indicador: "debito", categoria: "",
  });

  useEffect(() => {
    if (!clinicaId) return;
    fetchContas();
  }, [clinicaId]);

  const fetchContas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("plano_contas")
      .select("*")
      .eq("clinica_id", clinicaId!)
      .order("codigo_estruturado");
    setContas((data as any[]) || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ codigo: "", codigo_estruturado: "", descricao: "", indicador: "debito", categoria: "" });
    setShowDialog(true);
  };

  const openEdit = (c: PlanoContas) => {
    setEditing(c);
    setForm({
      codigo: String(c.codigo),
      codigo_estruturado: c.codigo_estruturado,
      descricao: c.descricao,
      indicador: c.indicador,
      categoria: c.categoria,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.descricao || !form.codigo_estruturado || !form.categoria) {
      toast.error("Preencha código, descrição e categoria");
      return;
    }
    const payload = {
      clinica_id: clinicaId!,
      codigo: parseInt(form.codigo) || 0,
      codigo_estruturado: form.codigo_estruturado,
      descricao: form.descricao.toUpperCase(),
      indicador: form.indicador as any,
      categoria: form.categoria,
    };

    if (editing) {
      const { error } = await supabase.from("plano_contas").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message);
      else { toast.success("Conta atualizada!"); setShowDialog(false); fetchContas(); }
    } else {
      const { error } = await supabase.from("plano_contas").insert(payload);
      if (error) toast.error(error.message);
      else { toast.success("Conta criada!"); setShowDialog(false); fetchContas(); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta do plano de contas?")) return;
    const { error } = await supabase.from("plano_contas").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Conta excluída!"); fetchContas(); }
  };

  const handleToggleAtivo = async (c: PlanoContas) => {
    const { error } = await supabase.from("plano_contas").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) toast.error(error.message);
    else fetchContas();
  };

  const existingCategorias = useMemo(() => {
    return [...new Set(contas.map((c) => c.categoria))].sort();
  }, [contas]);

  const filtered = useMemo(() => {
    if (!searchTerm) return contas;
    return contas.filter(
      (c) =>
        c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.codigo_estruturado.includes(searchTerm)
    );
  }, [contas, searchTerm]);

  const categorias = useMemo(() => {
    const map = new Map<string, PlanoContas[]>();
    for (const c of filtered) {
      const arr = map.get(c.categoria) || [];
      arr.push(c);
      map.set(c.categoria, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar no plano de contas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{contas.length} contas</Badge>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Conta" : "Nova Conta"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Código Numérico</Label>
                  <Input type="number" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex: 90" />
                </div>
                <div className="space-y-1">
                  <Label>Código Estruturado *</Label>
                  <Input value={form.codigo_estruturado} onChange={(e) => setForm({ ...form, codigo_estruturado: e.target.value })} placeholder="Ex: 6.18" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: NOVA DESPESA" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Indicador</Label>
                  <Select value={form.indicador} onValueChange={(v) => setForm({ ...form, indicador: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debito">Débito (Despesa)</SelectItem>
                      <SelectItem value="credito">Crédito (Receita)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Categoria *</Label>
                  <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Gastos fixos" list="cat-list" />
                  <datalist id="cat-list">
                    {existingCategorias.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
              <Button onClick={handleSave}>{editing ? "Salvar Alterações" : "Criar Conta"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : categorias.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">Nenhuma conta encontrada.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categorias.map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[90px]">Tipo</TableHead>
                      <TableHead className="w-[70px]">Ativo</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((c) => (
                      <TableRow key={c.id} className={!c.ativo ? "opacity-50" : ""}>
                        <TableCell className="font-mono text-sm">{c.codigo_estruturado}</TableCell>
                        <TableCell>{c.descricao}</TableCell>
                        <TableCell>
                          <Badge variant={c.indicador === "credito" ? "default" : "secondary"} className="text-xs">
                            {c.indicador === "credito" ? "Crédito" : "Débito"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button onClick={() => handleToggleAtivo(c)} className="cursor-pointer">
                            {c.ativo ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================= TAB: INDICADORES =======================
function TabIndicadores() {
  const { clinicaId } = useAuth();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [vendas, setVendas] = useState<{ valor_bruto: number; convenio_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicaId) return;
    fetchData();
  }, [clinicaId]);

  const fetchData = async () => {
    setLoading(true);
    const [lancRes, vendasRes] = await Promise.all([
      supabase
        .from("contas_pagar_lancamentos")
        .select("plano_contas_id, valor, plano_contas(categoria, indicador)")
        .eq("clinica_id", clinicaId!)
        .neq("status", "cancelado"),
      supabase
        .from("transacoes_vendas")
        .select("valor_bruto, convenio_id")
        .eq("clinica_id", clinicaId!),
    ]);
    setLancamentos((lancRes.data as any[]) || []);
    setVendas((vendasRes.data as any[]) || []);
    setLoading(false);
  };

  const { custosPorCategoria, totalCustos, totalReceitas } = useMemo(() => {
    const map = new Map<string, number>();
    let totalCustos = 0;
    for (const l of lancamentos) {
      const cat = (l.plano_contas as any)?.categoria || "Sem classificação";
      const v = l.valor || 0;
      map.set(cat, (map.get(cat) || 0) + v);
      totalCustos += v;
    }
    const totalReceitas = vendas.reduce((s, v) => s + (v.valor_bruto || 0), 0);
    const custosPorCategoria = Array.from(map.entries())
      .map(([cat, valor]) => ({
        categoria: cat,
        valor,
        pctCusto: totalCustos > 0 ? (valor / totalCustos) * 100 : 0,
        pctReceita: totalReceitas > 0 ? (valor / totalReceitas) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
    return { custosPorCategoria, totalCustos, totalReceitas };
  }, [lancamentos, vendas]);

  const receitasPorFonte = useMemo(() => {
    let particular = 0;
    let convenio = 0;
    for (const v of vendas) {
      if (v.convenio_id) convenio += v.valor_bruto || 0;
      else particular += v.valor_bruto || 0;
    }
    return { particular, convenio, total: particular + convenio };
  }, [vendas]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Receita Total</p>
            <p className="text-lg font-bold">{formatCurrency(totalReceitas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custo Total</p>
            <p className="text-lg font-bold">{formatCurrency(totalCustos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Particular</p>
            <p className="text-lg font-bold">{formatCurrency(receitasPorFonte.particular)}</p>
            <p className="text-xs text-muted-foreground">
              {receitasPorFonte.total > 0 ? ((receitasPorFonte.particular / receitasPorFonte.total) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Convênio</p>
            <p className="text-lg font-bold">{formatCurrency(receitasPorFonte.convenio)}</p>
            <p className="text-xs text-muted-foreground">
              {receitasPorFonte.total > 0 ? ((receitasPorFonte.convenio / receitasPorFonte.total) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost breakdown by category */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-secondary" />
            <CardTitle className="text-lg">Composição de Custos por Categoria</CardTitle>
          </div>
          <CardDescription>Quanto cada categoria representa do custo total e da receita</CardDescription>
        </CardHeader>
        <CardContent>
          {custosPorCategoria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento classificado encontrado.</p>
          ) : (
            <div className="space-y-4">
              {custosPorCategoria.map((item) => (
                <div key={item.categoria} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.categoria}</span>
                    <div className="flex items-center gap-4">
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-muted-foreground">{formatCurrency(item.valor)}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{item.pctCusto.toFixed(1)}% do custo total</p>
                          <p>{item.pctReceita.toFixed(1)}% da receita</p>
                        </TooltipContent>
                      </Tooltip>
                      <Badge variant="outline" className="text-xs min-w-[60px] justify-center">
                        {item.pctCusto.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={item.pctCusto} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-[70px] text-right">
                      {item.pctReceita.toFixed(1)}% RL
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
