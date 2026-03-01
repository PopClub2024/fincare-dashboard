import { useState, useEffect, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, { DashboardFilterValues } from "@/components/dashboard/DashboardFilters";
import { startOfMonth } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Search, CheckCircle2, Clock, AlertCircle, RefreshCw, CreditCard, Banknote, QrCode, Upload, FileText,
} from "lucide-react";
import { Label } from "@/components/ui/label";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Recebivel {
  id: string;
  data_competencia: string;
  data_prevista_recebimento: string | null;
  valor_bruto: number;
  desconto: number;
  impostos_taxas: number;
  valor_liquido: number | null;
  descricao: string | null;
  procedimento: string | null;
  especialidade: string | null;
  linha_receita: string | null;
  forma_pagamento: string | null;
  forma_pagamento_enum: string | null;
  canal_pagamento: string | null;
  status_recebimento: string;
  status_conciliacao: string;
  parcelas: number | null;
  parcela_atual: number | null;
  medico_id: string | null;
  convenio_id: string | null;
  paciente_id: string | null;
  medicos?: { nome: string } | null;
  convenios?: { nome: string } | null;
  pacientes?: { nome: string } | null;
}

interface PlanoContas {
  id: string;
  codigo_estruturado: string;
  descricao: string;
  indicador: string;
  categoria: string;
  ativo: boolean;
  codigo: number;
}

const arDefaultFilters: DashboardFilterValues = {
  dateFrom: startOfMonth(new Date(2026, 0, 1)),
  dateTo: new Date(),
  basCalculo: "competencia",
};

// ======================= MAIN PAGE =======================
export default function ContasAReceber() {
  const [filters, setFilters] = useState<DashboardFilterValues>(arDefaultFilters);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">
            Receitas, recebíveis e conciliação de pagamentos
          </p>
        </div>

        <DashboardFilters filters={filters} onFilterChange={setFilters} />

        <Tabs defaultValue="recebiveis" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="recebiveis">Recebíveis</TabsTrigger>
            <TabsTrigger value="plano">Plano de Contas</TabsTrigger>
            <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          </TabsList>

          <TabsContent value="recebiveis"><TabRecebiveis dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="plano"><TabPlanoContasReceitas /></TabsContent>
          <TabsContent value="conciliacao"><TabConciliacaoReceber /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ======================= TAB: RECEBÍVEIS =======================
function TabRecebiveis({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) {
  const { clinicaId } = useAuth();
  const [recebiveis, setRecebiveis] = useState<Recebivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterFonte, setFilterFonte] = useState("todos");
  const [filterPagamento, setFilterPagamento] = useState("todos");
  const [syncing, setSyncing] = useState(false);
  const [baixaDialog, setBaixaDialog] = useState<Recebivel | null>(null);
  const [baixaLoading, setBaixaLoading] = useState(false);
  const [baixaObs, setBaixaObs] = useState("");
  const [baixaData, setBaixaData] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (!clinicaId) return;
    fetchRecebiveis();
  }, [clinicaId, dateFrom, dateTo]);

  const fetchRecebiveis = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("transacoes_vendas")
      .select("*, medicos(nome), convenios(nome), pacientes(nome)")
      .eq("clinica_id", clinicaId!)
      .gte("data_competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("data_competencia", format(dateTo, "yyyy-MM-dd"))
      .order("data_competencia", { ascending: false })
      .limit(500);
    setRecebiveis((data as any[]) || []);
    setLoading(false);
  };

  const handleSyncFeegow = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-feegow", {
        body: { clinica_id: clinicaId },
      });
      if (error) throw error;
      toast.success("Sincronização Feegow concluída!");
      fetchRecebiveis();
    } catch (err: any) {
      toast.error("Erro na sincronização: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncGetnet = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-getnet", {
        body: { clinica_id: clinicaId },
      });
      if (error) throw error;
      toast.success("Conciliação Getnet concluída!");
      fetchRecebiveis();
    } catch (err: any) {
      toast.error("Erro na conciliação: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const getFonte = (r: Recebivel): string => {
    if (r.convenio_id || r.convenios) return "convenio";
    return "particular";
  };

  const getFormaPagamentoCategory = (r: Recebivel): string => {
    const fp = r.forma_pagamento_enum || r.forma_pagamento || "";
    if (fp.includes("cartao_credito")) return "cartao_credito";
    if (fp.includes("cartao_debito")) return "cartao_debito";
    if (fp.includes("pix")) return "pix";
    if (fp.includes("dinheiro")) return "dinheiro";
    if (fp.includes("convenio")) return "convenio";
    return "outro";
  };

  const getMetodoPagamento = (r: Recebivel): string => {
    const fp = r.forma_pagamento_enum || r.forma_pagamento || "";
    if (fp.includes("cartao_credito")) return "Cartão Crédito";
    if (fp.includes("cartao_debito")) return "Cartão Débito";
    if (fp.includes("pix")) {
      if (r.canal_pagamento === "qrcode") return "PIX QR Code";
      if (r.canal_pagamento === "chave_celular" || r.canal_pagamento === "chave_cnpj") return "PIX Chave";
      return "PIX";
    }
    if (fp.includes("dinheiro")) return "Dinheiro";
    if (fp.includes("convenio")) return "Convênio/NF";
    return fp || "—";
  };

  const getBaixaMethod = (r: Recebivel): { label: string; icon: React.ReactNode; color: string } => {
    const fp = r.forma_pagamento_enum || r.forma_pagamento || "";
    if (fp.includes("cartao") || (fp.includes("pix") && r.canal_pagamento === "qrcode")) {
      return { label: "Getnet (Auto)", icon: <CreditCard className="h-3 w-3" />, color: "text-emerald-600" };
    }
    if (fp.includes("pix") && (r.canal_pagamento === "chave_celular" || r.canal_pagamento === "chave_cnpj")) {
      return { label: "OFX (Auto)", icon: <FileText className="h-3 w-3" />, color: "text-blue-600" };
    }
    if (fp.includes("dinheiro")) {
      return { label: "Manual", icon: <Banknote className="h-3 w-3" />, color: "text-amber-600" };
    }
    if (fp.includes("convenio")) {
      return { label: "Convênio", icon: <Clock className="h-3 w-3" />, color: "text-purple-600" };
    }
    return { label: "—", icon: null, color: "text-muted-foreground" };
  };

  const handleBaixa = useCallback(async () => {
    if (!baixaDialog) return;
    setBaixaLoading(true);
    const { error } = await supabase
      .from("transacoes_vendas")
      .update({
        status_recebimento: "recebido" as any,
        data_caixa: baixaData,
        observacao: baixaObs || null,
      })
      .eq("id", baixaDialog.id);

    if (error) {
      toast.error("Erro ao dar baixa: " + error.message);
    } else {
      toast.success("Baixa realizada com sucesso!");
      setRecebiveis((prev) =>
        prev.map((v) =>
          v.id === baixaDialog.id ? { ...v, status_recebimento: "recebido" } : v
        )
      );
    }
    setBaixaLoading(false);
    setBaixaDialog(null);
    setBaixaObs("");
    setBaixaData(format(new Date(), "yyyy-MM-dd"));
  }, [baixaDialog, baixaData, baixaObs]);

  const filtered = useMemo(() => {
    return recebiveis.filter((r) => {
      const matchSearch = !searchTerm
        || r.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
        || r.procedimento?.toLowerCase().includes(searchTerm.toLowerCase())
        || r.pacientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
        || r.medicos?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === "todos" || r.status_recebimento === filterStatus;
      const matchFonte = filterFonte === "todos" || getFonte(r) === filterFonte;
      const matchPagamento = filterPagamento === "todos" || getFormaPagamentoCategory(r) === filterPagamento;
      return matchSearch && matchStatus && matchFonte && matchPagamento;
    });
  }, [recebiveis, searchTerm, filterStatus, filterFonte, filterPagamento]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.valor_bruto, 0);
    const recebido = filtered.filter((r) => r.status_recebimento === "recebido").reduce((s, r) => s + r.valor_bruto, 0);
    const pendente = filtered.filter((r) => r.status_recebimento === "a_receber").reduce((s, r) => s + r.valor_bruto, 0);
    const inadimplente = filtered.filter((r) => r.status_recebimento === "inadimplente" || r.status_recebimento === "glosado").reduce((s, r) => s + r.valor_bruto, 0);
    return { total, recebido, pendente, inadimplente };
  }, [filtered]);

  const statusLabel: Record<string, string> = {
    a_receber: "A Receber", recebido: "Recebido", inadimplente: "Inadimplente", glosado: "Glosado",
  };
  const statusVariant = (s: string) => {
    switch (s) {
      case "recebido": return "default" as const;
      case "a_receber": return "outline" as const;
      case "inadimplente": return "destructive" as const;
      case "glosado": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Bruto</p>
            <p className="text-lg font-bold">{formatCurrency(totals.total)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totals.recebido)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">A Receber</p>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(totals.pendente)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inadimplente/Glosa</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totals.inadimplente)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar paciente, médico, procedimento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="a_receber">A Receber</SelectItem>
            <SelectItem value="recebido">Recebido</SelectItem>
            <SelectItem value="inadimplente">Inadimplente</SelectItem>
            <SelectItem value="glosado">Glosado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterFonte} onValueChange={setFilterFonte}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Fontes</SelectItem>
            <SelectItem value="particular">Particular</SelectItem>
            <SelectItem value="convenio">Convênio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPagamento} onValueChange={setFilterPagamento}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Pagamentos</SelectItem>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
            <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
            <SelectItem value="convenio">Convênio/NF</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncFeegow} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          Feegow
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncGetnet} disabled={syncing}>
          <CreditCard className="h-4 w-4" />
          Getnet
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <AlertCircle className="mx-auto mb-3 h-8 w-8" />
              <p>Nenhum recebível encontrado.</p>
              <p className="text-xs mt-1">Sincronize com o Feegow para importar consultas e exames.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
               <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Médico</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Método Baixa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const fonte = getFonte(r);
                  const baixa = getBaixaMethod(r);
                  const canBaixa = r.status_recebimento === "a_receber" || r.status_recebimento === "inadimplente";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(r.data_competencia + "T12:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium max-w-[150px] truncate">
                        {r.pacientes?.nome || "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">
                        {r.procedimento || r.descricao || r.linha_receita || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.medicos?.nome || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={fonte === "convenio" ? "secondary" : "outline"} className="text-xs">
                          {fonte === "convenio" ? (r.convenios?.nome || "Convênio") : "Particular"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{getMetodoPagamento(r)}</TableCell>
                      <TableCell>
                        <span className={`flex items-center gap-1 text-xs ${baixa.color}`}>
                          {baixa.icon}
                          {baixa.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(r.valor_bruto)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status_recebimento)}>
                          {statusLabel[r.status_recebimento] || r.status_recebimento}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {canBaixa ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => {
                              setBaixaDialog(r);
                              setBaixaData(format(new Date(), "yyyy-MM-dd"));
                              setBaixaObs("");
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Baixa
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Baixa Manual */}
      <Dialog open={!!baixaDialog} onOpenChange={(open) => !open && setBaixaDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Baixa Manual de Receita</DialogTitle>
            <DialogDescription>
              Confirmar recebimento de {baixaDialog ? formatCurrency(baixaDialog.valor_bruto) : ""}
              {baixaDialog?.procedimento ? ` — ${baixaDialog.procedimento}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Paciente</Label>
                <p className="text-sm font-medium">{baixaDialog?.pacientes?.nome || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Pagamento</Label>
                <p className="text-sm font-medium">{baixaDialog ? getMetodoPagamento(baixaDialog) : ""}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="baixa-data-ar">Data do recebimento</Label>
              <Input
                id="baixa-data-ar"
                type="date"
                value={baixaData}
                onChange={(e) => setBaixaData(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="baixa-obs-ar">Observação (opcional)</Label>
              <Textarea
                id="baixa-obs-ar"
                placeholder="Ex: Recebido em dinheiro no caixa"
                value={baixaObs}
                onChange={(e) => setBaixaObs(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaDialog(null)}>Cancelar</Button>
            <Button onClick={handleBaixa} disabled={baixaLoading}>
              {baixaLoading ? "Processando..." : "Confirmar Baixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ======================= TAB: PLANO DE CONTAS (RECEITAS) =======================
function TabPlanoContasReceitas() {
  const { clinicaId } = useAuth();
  const [contas, setContas] = useState<PlanoContas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
      .eq("indicador", "credito")
      .order("codigo_estruturado");
    setContas((data as any[]) || []);
    setLoading(false);
  };

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
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar receitas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{contas.length} contas de receita</Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : categorias.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Nenhuma conta de receita (crédito) cadastrada.
          </CardContent>
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
                      <TableHead className="w-[100px]">Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[80px]">Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.codigo_estruturado}</TableCell>
                        <TableCell>{c.descricao}</TableCell>
                        <TableCell>
                          {c.ativo ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <span className="h-4 w-4 text-muted-foreground">—</span>}
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

// ======================= TAB: CONCILIAÇÃO RECEBER =======================
function TabConciliacaoReceber() {
  const { clinicaId } = useAuth();
  const [importingOFX, setImportingOFX] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleOFXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Selecione um arquivo .OFX");
      return;
    }
    setImportingOFX(true);
    try {
      const text = await file.text();
      const { data, error } = await supabase.functions.invoke("import-ofx", {
        body: { clinica_id: clinicaId, ofx_content: text, tipo: "recebiveis" },
      });
      if (error) throw error;
      setLastResult(data);
      toast.success(`OFX importado! ${data.matched_recebiveis || 0} recebíveis conciliados.`);
    } catch (err: any) {
      toast.error("Erro na importação: " + err.message);
    } finally {
      setImportingOFX(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Sequence explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sequência de Baixa Automática</CardTitle>
          <CardDescription>
            O sistema faz baixa automática em cascata. Apenas dinheiro precisa de confirmação manual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-sm">1. Getnet</p>
                <p className="text-xs text-muted-foreground">Cartões + PIX QR Code → baixa automática</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-sm">2. Extrato OFX</p>
                <p className="text-xs text-muted-foreground">PIX Chave → baixa via conciliação bancária</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900 dark:bg-purple-950/20">
              <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-sm">3. Convênios</p>
                <p className="text-xs text-muted-foreground">Repasse automático pelo prazo configurado</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900">
                <Banknote className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-sm">4. Dinheiro</p>
                <p className="text-xs text-muted-foreground">Única baixa manual → Tela de Caixa</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OFX for receivables */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Conciliação Bancária (PIX Chave)</CardTitle>
          </div>
          <CardDescription>
            Importe o extrato OFX para conciliar automaticamente recebimentos via PIX por chave (celular, CNPJ).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="ofx-receber" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 px-6 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted">
              <Upload className="h-4 w-4" />
              {importingOFX ? "Importando..." : "Selecionar arquivo .OFX"}
            </Label>
            <Input id="ofx-receber" type="file" accept=".ofx" className="hidden" onChange={handleOFXUpload} disabled={importingOFX} />
          </div>

          {lastResult && (
            <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/10">
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-2">Resultado da conciliação</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total transações</p>
                    <p className="text-lg font-bold">{lastResult.total}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recebíveis conciliados</p>
                    <p className="text-lg font-bold text-emerald-600">{lastResult.matched_recebiveis || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Despesas conciliadas</p>
                    <p className="text-lg font-bold text-blue-600">{lastResult.matched || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Criados (s/ comprov.)</p>
                    <p className="text-lg font-bold text-amber-600">{lastResult.created || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
