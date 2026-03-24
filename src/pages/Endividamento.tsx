import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
  Tooltip as RTooltip, Line, ComposedChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Landmark, TrendingDown, DollarSign, CalendarDays, Plus, ChevronLeft,
  AlertTriangle, CheckCircle2, Clock, ArrowDownRight, Receipt, AlertCircle, Calendar,
} from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

const MESES_PT: Record<number, string> = {
  0: "Jan", 1: "Fev", 2: "Mar", 3: "Abr", 4: "Mai", 5: "Jun",
  6: "Jul", 7: "Ago", 8: "Set", 9: "Out", 10: "Nov", 11: "Dez",
};

const mesLabel = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  return `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
};

const mesLabelFull = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  return `${MESES_PT[d.getMonth()]}/${d.getFullYear()}`;
};

// ==================== Interfaces ====================
interface Divida {
  id: string; nome: string | null; credor: string; tipo: string; descricao: string | null;
  saldo: number; saldo_inicial: number | null; taxa_juros: number | null;
  custo_efetivo: number | null; data_inicio: string | null; data_vencimento: string | null; ativo: boolean;
}
interface Pagamento {
  id: string; data_pagamento: string; valor_pago: number;
  principal_amortizado: number | null; juros_pago: number | null; origem: string; observacao: string | null;
}
interface Parcela {
  id: string; competencia: string; pmt: number; amortizacao: number | null;
  juros: number | null; saldo_devedor: number | null; pago: boolean;
}
interface ImpostoDevido {
  id: string; imposto: string; competencia: string; valor_devido: number; valor_pago: number;
  status: string; vencimento: string | null; qtd_parcelas: number | null;
  valor_parcela: number | null; forma_pagamento: string | null; dia_vencimento_fixo: number | null;
}

const IMPOSTO_LABELS: Record<string, string> = {
  simples: "Simples Nacional", fgts: "FGTS", inss: "INSS", iss: "ISS",
};
const IMPOSTO_COLORS: Record<string, string> = {
  simples: "hsl(204, 67%, 42%)", fgts: "hsl(152, 60%, 40%)", inss: "hsl(32, 85%, 50%)", iss: "hsl(280, 60%, 50%)",
};
const FORMA_PAG_LABELS: Record<string, string> = {
  boleto: "Boleto", debito_automatico: "Débito Automático",
};

export default function Endividamento() {
  const { clinicaId } = useAuth();
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDivida, setSelectedDivida] = useState<Divida | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [showNewDebt, setShowNewDebt] = useState(false);
  const [newDebt, setNewDebt] = useState({
    nome: "", credor: "", saldo_inicial: "", taxa_juros: "", data_inicio: "", data_vencimento: "", tipo: "curto_prazo",
  });

  // Impostos state
  const [impostos, setImpostos] = useState<ImpostoDevido[]>([]);
  const [loadingImpostos, setLoadingImpostos] = useState(true);
  const [showNewImposto, setShowNewImposto] = useState(false);
  const [showPaymentImposto, setShowPaymentImposto] = useState(false);
  const [selectedImposto, setSelectedImposto] = useState<ImpostoDevido | null>(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [newImpostoForm, setNewImpostoForm] = useState({
    imposto: "simples", competencia: "", valor_devido: "", vencimento: "",
    qtd_parcelas: "1", valor_parcela: "", forma_pagamento: "boleto", dia_vencimento_fixo: "",
  });
  const [payImpostoForm, setPayImpostoForm] = useState({
    valor: "", data: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (!clinicaId) return;
    fetchDividas();
    fetchImpostos();
  }, [clinicaId]);

  useEffect(() => {
    if (!clinicaId) return;
    fetchImpostos();
  }, [filterYear]);

  // ==================== Dividas ====================
  const fetchDividas = async () => {
    setLoading(true);
    const { data } = await supabase.from("dividas").select("*")
      .eq("clinica_id", clinicaId!).eq("ativo", true).order("saldo", { ascending: false });
    setDividas((data as any[]) || []);
    setLoading(false);
  };
  const fetchPagamentos = async (dividaId: string) => {
    const { data } = await supabase.from("divida_pagamentos").select("*")
      .eq("divida_id", dividaId).order("data_pagamento", { ascending: false });
    setPagamentos((data as any[]) || []);
  };
  const fetchParcelas = async (dividaId: string) => {
    const { data } = await supabase.from("divida_parcelas_previstas").select("*")
      .eq("divida_id", dividaId).order("competencia");
    setParcelas((data as any[]) || []);
  };
  const handleSelectDivida = (d: Divida) => {
    setSelectedDivida(d);
    fetchPagamentos(d.id);
    fetchParcelas(d.id);
  };
  const handleCreateDebt = async () => {
    if (!newDebt.nome || !newDebt.credor || !newDebt.saldo_inicial) {
      toast.error("Preencha nome, credor e saldo inicial"); return;
    }
    const saldoInicial = parseFloat(newDebt.saldo_inicial);
    const { error } = await supabase.from("dividas").insert({
      clinica_id: clinicaId!, nome: newDebt.nome, credor: newDebt.credor,
      tipo: newDebt.tipo as any, saldo_inicial: saldoInicial, saldo: saldoInicial,
      taxa_juros: newDebt.taxa_juros ? parseFloat(newDebt.taxa_juros) : null,
      data_inicio: newDebt.data_inicio || null, data_vencimento: newDebt.data_vencimento || null,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Dívida criada!"); setShowNewDebt(false); fetchDividas(); }
  };
  const handleAddPayment = async (dividaId: string, valor: number, principal: number, juros: number, data: string) => {
    const { error } = await supabase.from("divida_pagamentos").insert({
      clinica_id: clinicaId!, divida_id: dividaId, data_pagamento: data,
      valor_pago: valor, principal_amortizado: principal, juros_pago: juros, origem: "manual",
    } as any);
    if (error) { toast.error(error.message); return; }
    await supabase.from("dividas").update({
      saldo: Math.max(0, (selectedDivida?.saldo || 0) - principal),
    } as any).eq("id", dividaId);
    toast.success("Pagamento registrado!");
    fetchDividas(); fetchPagamentos(dividaId);
  };

  // ==================== Impostos ====================
  const fetchImpostos = async () => {
    setLoadingImpostos(true);
    const { data } = await supabase.from("impostos_devidos").select("*")
      .eq("clinica_id", clinicaId!)
      .gte("competencia", `${filterYear}-01-01`).lte("competencia", `${filterYear}-12-31`)
      .order("competencia", { ascending: false });
    setImpostos((data as any[]) || []);
    setLoadingImpostos(false);
  };
  const handleCreateImposto = async () => {
    if (!newImpostoForm.competencia || !newImpostoForm.valor_devido) {
      toast.error("Preencha competência e valor devido"); return;
    }
    const competencia = newImpostoForm.competencia + "-01";
    const { error } = await supabase.from("impostos_devidos").insert({
      clinica_id: clinicaId!, imposto: newImpostoForm.imposto as any, competencia,
      valor_devido: parseFloat(newImpostoForm.valor_devido),
      vencimento: newImpostoForm.vencimento || null,
      qtd_parcelas: parseInt(newImpostoForm.qtd_parcelas) || 1,
      valor_parcela: newImpostoForm.valor_parcela ? parseFloat(newImpostoForm.valor_parcela) : null,
      forma_pagamento: newImpostoForm.forma_pagamento,
      dia_vencimento_fixo: newImpostoForm.dia_vencimento_fixo ? parseInt(newImpostoForm.dia_vencimento_fixo) : null,
    } as any);
    if (error) {
      if (error.message.includes("duplicate")) toast.error("Já existe lançamento para este imposto/competência");
      else toast.error(error.message);
    } else {
      toast.success("Imposto lançado!");
      setShowNewImposto(false);
      setNewImpostoForm({ imposto: "simples", competencia: "", valor_devido: "", vencimento: "", qtd_parcelas: "1", valor_parcela: "", forma_pagamento: "boleto", dia_vencimento_fixo: "" });
      fetchImpostos();
    }
  };
  const handlePayImposto = async () => {
    if (!selectedImposto || !payImpostoForm.valor) { toast.error("Informe o valor"); return; }
    const valor = parseFloat(payImpostoForm.valor);
    const { error } = await supabase.from("imposto_pagamentos").insert({
      clinica_id: clinicaId!, impostos_devidos_id: selectedImposto.id,
      data_pagamento: payImpostoForm.data, valor_pago: valor, origem: "manual",
    } as any);
    if (error) { toast.error(error.message); return; }
    const newPago = selectedImposto.valor_pago + valor;
    const newStatus = newPago >= selectedImposto.valor_devido - 0.01 ? "pago" : newPago > 0 ? "parcial" : "aberto";
    await supabase.from("impostos_devidos").update({ valor_pago: newPago, status: newStatus } as any).eq("id", selectedImposto.id);
    toast.success("Pagamento registrado!");
    setShowPaymentImposto(false);
    setPayImpostoForm({ valor: "", data: new Date().toISOString().split("T")[0] });
    fetchImpostos();
  };

  // KPIs Dividas
  const totalSaldo = dividas.reduce((s, d) => s + d.saldo, 0);
  const totalInicial = dividas.reduce((s, d) => s + (d.saldo_inicial || d.saldo), 0);
  const custoMedio = useMemo(() => {
    const weighted = dividas.reduce((s, d) => s + (d.taxa_juros || 0) * d.saldo, 0);
    return totalSaldo > 0 ? weighted / totalSaldo : 0;
  }, [dividas, totalSaldo]);
  const amortizado = totalInicial - totalSaldo;

  // KPIs Impostos
  const totalImpostoDevido = impostos.reduce((s, i) => s + i.valor_devido, 0);
  const totalImpostoPago = impostos.reduce((s, i) => s + i.valor_pago, 0);
  const totalImpostoAberto = totalImpostoDevido - totalImpostoPago;
  const qtdImpostoAberto = impostos.filter((i) => i.status !== "pago").length;

  // Impostos chart
  const impostoChartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: MESES_PT[i], simples: 0, fgts: 0, inss: 0, iss: 0,
    }));
    impostos.forEach((imp) => {
      const month = new Date(imp.competencia + "T12:00:00").getMonth();
      const key = imp.imposto as keyof typeof months[0];
      if (key in months[month]) (months[month] as any)[key] += imp.valor_devido;
    });
    return months;
  }, [impostos, filterYear]);

  const statusVariant = (s: string) => {
    switch (s) { case "pago": return "secondary" as const; case "parcial": return "default" as const; default: return "outline" as const; }
  };
  const statusLabel: Record<string, string> = { aberto: "Aberto", parcial: "Parcial", pago: "Pago" };

  if (selectedDivida) {
    return (
      <DashboardLayout>
        <DebtDetail divida={selectedDivida} pagamentos={pagamentos} parcelas={parcelas}
          onBack={() => setSelectedDivida(null)} onAddPayment={handleAddPayment} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Endividamento</h1>
          <p className="text-sm text-muted-foreground">Controle de empréstimos, financiamentos e impostos</p>
        </div>

        <Tabs defaultValue="dividas" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="dividas">Empréstimos e Financiamentos</TabsTrigger>
            <TabsTrigger value="impostos">Impostos a Pagar</TabsTrigger>
          </TabsList>

          {/* ==================== TAB DIVIDAS ==================== */}
          <TabsContent value="dividas" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={showNewDebt} onOpenChange={setShowNewDebt}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" />Nova Dívida</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Nova Dívida</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Nome *</Label><Input value={newDebt.nome} onChange={(e) => setNewDebt({ ...newDebt, nome: e.target.value })} placeholder="Ex: Empréstimo Santander" /></div>
                      <div className="space-y-1"><Label>Credor *</Label><Input value={newDebt.credor} onChange={(e) => setNewDebt({ ...newDebt, credor: e.target.value })} placeholder="Ex: Santander" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1"><Label>Saldo Inicial *</Label><Input type="number" step="0.01" value={newDebt.saldo_inicial} onChange={(e) => setNewDebt({ ...newDebt, saldo_inicial: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Taxa Juros (% a.m.)</Label><Input type="number" step="0.01" value={newDebt.taxa_juros} onChange={(e) => setNewDebt({ ...newDebt, taxa_juros: e.target.value })} /></div>
                      <div className="space-y-1">
                        <Label>Tipo</Label>
                        <Select value={newDebt.tipo} onValueChange={(v) => setNewDebt({ ...newDebt, tipo: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="curto_prazo">Curto Prazo</SelectItem>
                            <SelectItem value="longo_prazo">Longo Prazo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Data Início</Label><Input type="date" value={newDebt.data_inicio} onChange={(e) => setNewDebt({ ...newDebt, data_inicio: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Data Vencimento</Label><Input type="date" value={newDebt.data_vencimento} onChange={(e) => setNewDebt({ ...newDebt, data_vencimento: e.target.value })} /></div>
                    </div>
                    <Button onClick={handleCreateDebt}>Criar Dívida</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Endividamento Total" value={fmt(totalSaldo)} icon={<Landmark className="h-4 w-4" />} negative />
              <KpiCard label="Custo Médio Mensal" value={fmtPct(custoMedio)} icon={<TrendingDown className="h-4 w-4" />} />
              <KpiCard label="Total Amortizado" value={fmt(amortizado)} icon={<DollarSign className="h-4 w-4" />} positive />
              <KpiCard label="Contratos Ativos" value={String(dividas.length)} icon={<CalendarDays className="h-4 w-4" />} />
            </div>

            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-lg">Contratos Ativos</CardTitle></CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : dividas.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">Nenhuma dívida cadastrada.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contrato</TableHead>
                        <TableHead>Credor</TableHead>
                        <TableHead className="text-right">Saldo Devedor</TableHead>
                        <TableHead className="text-right">Taxa Mensal</TableHead>
                        <TableHead className="text-right">CET Anual</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dividas.map((d) => (
                        <TableRow key={d.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleSelectDivida(d)}>
                          <TableCell className="font-medium">{d.nome || d.descricao || "—"}</TableCell>
                          <TableCell>{d.credor}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">{fmt(d.saldo)}</TableCell>
                          <TableCell className="text-right">{d.taxa_juros ? `${d.taxa_juros}% a.m.` : "—"}</TableCell>
                          <TableCell className="text-right">{d.custo_efetivo ? `${d.custo_efetivo}%` : "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {d.data_inicio && d.data_vencimento
                              ? `${mesLabel(d.data_inicio)} → ${mesLabel(d.data_vencimento)}`
                              : "—"}
                          </TableCell>
                          <TableCell><Button variant="ghost" size="sm">Detalhes</Button></TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-accent/50">
                        <TableCell>TOTAL / CONSOLIDADO</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-destructive">{fmt(totalSaldo)}</TableCell>
                        <TableCell className="text-right">{fmtPct(custoMedio)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">📊 Indicadores de Saúde Financeira</CardTitle>
                <CardDescription>Baseados na análise de endividamento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <IndicatorRow label="Comprometimento da Receita (PMT/RT)" value="4.09%" ref_text="< 15% saudável" status="ok" />
                  <IndicatorRow label="Comprometimento da MC (PMT/MC)" value="11.69%" ref_text="< 30% saudável" status="ok" />
                  <IndicatorRow label="DSCR — Cobertura do Serviço da Dívida" value="1.96x" ref_text="> 1,25x saudável" status="ok" />
                  <IndicatorRow label="Custo Médio Ponderado (mensal)" value={fmtPct(custoMedio)} ref_text="Menor = melhor" status="info" />
                  <IndicatorRow label="Relação Juros/Principal" value="48.1%" ref_text="Menor = melhor" status="alert" />
                  <IndicatorRow label="Último Vencimento" value="Abr/2029" ref_text="38 meses restantes" status="info" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== TAB IMPOSTOS ==================== */}
          <TabsContent value="impostos" className="space-y-6">
            <div className="flex items-center justify-between">
              <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2026, 2025, 2024].map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                </SelectContent>
              </Select>
              <Dialog open={showNewImposto} onOpenChange={setShowNewImposto}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" />Lançar Imposto</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Lançar Imposto Devido</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Imposto</Label>
                        <Select value={newImpostoForm.imposto} onValueChange={(v) => setNewImpostoForm({ ...newImpostoForm, imposto: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simples">Simples Nacional</SelectItem>
                            <SelectItem value="fgts">FGTS</SelectItem>
                            <SelectItem value="inss">INSS</SelectItem>
                            <SelectItem value="iss">ISS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Competência (mês)</Label>
                        <Input type="month" value={newImpostoForm.competencia} onChange={(e) => setNewImpostoForm({ ...newImpostoForm, competencia: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Valor Total Devido *</Label>
                        <Input type="number" step="0.01" value={newImpostoForm.valor_devido} onChange={(e) => setNewImpostoForm({ ...newImpostoForm, valor_devido: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Vencimento</Label>
                        <Input type="date" value={newImpostoForm.vencimento} onChange={(e) => setNewImpostoForm({ ...newImpostoForm, vencimento: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Parcelas</Label>
                        <Input type="number" min="1" value={newImpostoForm.qtd_parcelas} onChange={(e) => setNewImpostoForm({ ...newImpostoForm, qtd_parcelas: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Valor Parcela</Label>
                        <Input type="number" step="0.01" value={newImpostoForm.valor_parcela} onChange={(e) => setNewImpostoForm({ ...newImpostoForm, valor_parcela: e.target.value })} placeholder="Auto" />
                      </div>
                      <div className="space-y-1">
                        <Label>Dia Fixo Venc.</Label>
                        <Input type="number" min="1" max="31" value={newImpostoForm.dia_vencimento_fixo} onChange={(e) => setNewImpostoForm({ ...newImpostoForm, dia_vencimento_fixo: e.target.value })} placeholder="Ex: 7" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Forma de Pagamento</Label>
                      <Select value={newImpostoForm.forma_pagamento} onValueChange={(v) => setNewImpostoForm({ ...newImpostoForm, forma_pagamento: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="boleto">Boleto</SelectItem>
                          <SelectItem value="debito_automatico">Débito Automático</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateImposto}>Lançar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Total Devido" value={fmt(totalImpostoDevido)} icon={<Receipt className="h-4 w-4" />} />
              <KpiCard label="Total Pago" value={fmt(totalImpostoPago)} icon={<CheckCircle2 className="h-4 w-4" />} positive />
              <KpiCard label="Saldo em Aberto" value={fmt(totalImpostoAberto)} icon={<AlertCircle className="h-4 w-4" />} negative={totalImpostoAberto > 0} />
              <KpiCard label="Guias em Aberto" value={String(qtdImpostoAberto)} icon={<Calendar className="h-4 w-4" />} />
            </div>

            <Tabs defaultValue="lista_imp" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 bg-muted">
                <TabsTrigger value="lista_imp">Por Competência</TabsTrigger>
                <TabsTrigger value="grafico_imp">Visão Anual</TabsTrigger>
              </TabsList>

              <TabsContent value="lista_imp">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-0">
                    {loadingImpostos ? (
                      <div className="flex items-center justify-center p-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      </div>
                    ) : impostos.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground">
                        Nenhum imposto lançado para {filterYear}.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Competência</TableHead>
                            <TableHead>Imposto</TableHead>
                            <TableHead className="text-right">Total Devido</TableHead>
                            <TableHead className="text-right">Parcelas</TableHead>
                            <TableHead className="text-right">Vlr. Parcela</TableHead>
                            <TableHead>Pagamento</TableHead>
                            <TableHead>Dia Venc.</TableHead>
                            <TableHead className="text-right">Pago</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {impostos.map((imp) => {
                            const saldo = imp.valor_devido - imp.valor_pago;
                            const vlrParcela = imp.valor_parcela || (imp.qtd_parcelas ? imp.valor_devido / imp.qtd_parcelas : imp.valor_devido);
                            return (
                              <TableRow key={imp.id}>
                                <TableCell>{mesLabelFull(imp.competencia)}</TableCell>
                                <TableCell className="font-medium">{IMPOSTO_LABELS[imp.imposto] || imp.imposto}</TableCell>
                                <TableCell className="text-right">{fmt(imp.valor_devido)}</TableCell>
                                <TableCell className="text-right">{imp.qtd_parcelas || 1}x</TableCell>
                                <TableCell className="text-right">{fmt(vlrParcela)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {FORMA_PAG_LABELS[imp.forma_pagamento || "boleto"] || imp.forma_pagamento}
                                  </Badge>
                                </TableCell>
                                <TableCell>{imp.dia_vencimento_fixo ? `Dia ${imp.dia_vencimento_fixo}` : "—"}</TableCell>
                                <TableCell className="text-right text-emerald-600">{fmt(imp.valor_pago)}</TableCell>
                                <TableCell className={`text-right font-medium ${saldo > 0 ? "text-destructive" : ""}`}>{fmt(saldo)}</TableCell>
                                <TableCell>
                                  <Badge variant={statusVariant(imp.status)}>{statusLabel[imp.status] || imp.status}</Badge>
                                </TableCell>
                                <TableCell>
                                  {imp.status !== "pago" && (
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      setSelectedImposto(imp); setShowPaymentImposto(true);
                                    }}>Pagar</Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="font-bold bg-accent/50">
                            <TableCell>TOTAL {filterYear}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">{fmt(totalImpostoDevido)}</TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right text-emerald-600">{fmt(totalImpostoPago)}</TableCell>
                            <TableCell className={`text-right ${totalImpostoAberto > 0 ? "text-destructive" : ""}`}>{fmt(totalImpostoAberto)}</TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="grafico_imp">
                <Card className="border-0 shadow-md">
                  <CardHeader><CardTitle className="text-lg">Impostos por Mês — {filterYear}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={impostoChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="name" className="text-xs" />
                          <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <RTooltip formatter={(value: number) => fmt(value)} />
                          <Legend />
                          <Bar dataKey="simples" name="Simples" fill={IMPOSTO_COLORS.simples} stackId="a" />
                          <Bar dataKey="fgts" name="FGTS" fill={IMPOSTO_COLORS.fgts} stackId="a" />
                          <Bar dataKey="inss" name="INSS" fill={IMPOSTO_COLORS.inss} stackId="a" />
                          <Bar dataKey="iss" name="ISS" fill={IMPOSTO_COLORS.iss} stackId="a" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Payment dialog for impostos */}
        <Dialog open={showPaymentImposto} onOpenChange={setShowPaymentImposto}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento — {selectedImposto ? IMPOSTO_LABELS[selectedImposto.imposto] : ""}</DialogTitle>
            </DialogHeader>
            {selectedImposto && (
              <div className="space-y-4">
                <div className="rounded-lg bg-accent p-3 space-y-1">
                  <div className="flex justify-between text-sm"><span>Devido:</span><span className="font-medium">{fmt(selectedImposto.valor_devido)}</span></div>
                  <div className="flex justify-between text-sm"><span>Parcelas:</span><span className="font-medium">{selectedImposto.qtd_parcelas || 1}x de {fmt((selectedImposto.valor_parcela || selectedImposto.valor_devido / (selectedImposto.qtd_parcelas || 1)))}</span></div>
                  <div className="flex justify-between text-sm"><span>Forma:</span><span className="font-medium">{FORMA_PAG_LABELS[selectedImposto.forma_pagamento || "boleto"]}</span></div>
                  <div className="flex justify-between text-sm"><span>Já pago:</span><span className="font-medium text-emerald-600">{fmt(selectedImposto.valor_pago)}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span>Saldo:</span><span className="text-destructive">{fmt(selectedImposto.valor_devido - selectedImposto.valor_pago)}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Valor *</Label><Input type="number" step="0.01" value={payImpostoForm.valor} onChange={(e) => setPayImpostoForm({ ...payImpostoForm, valor: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Data *</Label><Input type="date" value={payImpostoForm.data} onChange={(e) => setPayImpostoForm({ ...payImpostoForm, data: e.target.value })} /></div>
                </div>
                <Button onClick={handlePayImposto} className="w-full">Registrar Pagamento</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// ==================== DebtDetail ====================
function DebtDetail({ divida, pagamentos, parcelas, onBack, onAddPayment }: {
  divida: Divida; pagamentos: Pagamento[]; parcelas: Parcela[];
  onBack: () => void;
  onAddPayment: (dividaId: string, valor: number, principal: number, juros: number, data: string) => void;
}) {
  const [showPayment, setShowPayment] = useState(false);
  const [payForm, setPayForm] = useState({ valor: "", principal: "", juros: "", data: new Date().toISOString().split("T")[0] });

  const handleSubmitPayment = () => {
    const valor = parseFloat(payForm.valor);
    const principal = parseFloat(payForm.principal) || valor;
    const juros = parseFloat(payForm.juros) || 0;
    if (!valor || valor <= 0) { toast.error("Informe o valor do pagamento"); return; }
    onAddPayment(divida.id, valor, principal, juros, payForm.data);
    setShowPayment(false);
    setPayForm({ valor: "", principal: "", juros: "", data: new Date().toISOString().split("T")[0] });
  };

  const chartData = useMemo(() => {
    return parcelas.map((p) => ({
      name: mesLabel(p.competencia),
      saldo: p.saldo_devedor || 0, amortizacao: p.amortizacao || 0, juros: p.juros || 0,
    }));
  }, [parcelas]);

  const pctPago = divida.saldo_inicial ? ((divida.saldo_inicial - divida.saldo) / divida.saldo_inicial) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{divida.nome || divida.credor}</h1>
          <p className="text-sm text-muted-foreground">{divida.credor} — {divida.tipo === "curto_prazo" ? "Curto Prazo" : "Longo Prazo"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Saldo Devedor" value={fmt(divida.saldo)} icon={<Landmark className="h-4 w-4" />} negative />
        <KpiCard label="Saldo Inicial" value={fmt(divida.saldo_inicial || 0)} icon={<DollarSign className="h-4 w-4" />} />
        <KpiCard label="Amortizado" value={fmt((divida.saldo_inicial || 0) - divida.saldo)} icon={<ArrowDownRight className="h-4 w-4" />} positive />
        <KpiCard label="% Pago" value={`${pctPago.toFixed(1)}%`} icon={<CheckCircle2 className="h-4 w-4" />} positive />
        <KpiCard label="Taxa Mensal" value={divida.taxa_juros ? `${divida.taxa_juros}% a.m.` : "—"} icon={<TrendingDown className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="evolucao" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-muted">
          <TabsTrigger value="evolucao">Evolução do Saldo</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="evolucao" className="space-y-4">
          {chartData.length > 0 ? (
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-lg">Evolução do Saldo Devedor</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <RTooltip formatter={(value: number) => fmt(value)} />
                      <Legend />
                      <Bar dataKey="amortizacao" name="Amortização" fill="hsl(152, 60%, 40%)" stackId="a" />
                      <Bar dataKey="juros" name="Juros" fill="hsl(358, 74%, 44%)" stackId="a" radius={[4, 4, 0, 0]} />
                      <Line dataKey="saldo" name="Saldo Devedor" stroke="hsl(204, 67%, 32%)" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-md">
              <CardContent className="p-12 text-center text-muted-foreground">
                Nenhum cronograma de parcelas cadastrado para esta dívida.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cronograma" className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-lg">Cronograma de Parcelas</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {parcelas.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">Nenhuma parcela prevista cadastrada.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-right">PMT</TableHead>
                      <TableHead className="text-right">Amortização</TableHead>
                      <TableHead className="text-right">Juros</TableHead>
                      <TableHead className="text-right">Saldo Devedor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelas.map((p) => (
                      <TableRow key={p.id} className={p.pago ? "opacity-50" : ""}>
                        <TableCell>{mesLabelFull(p.competencia)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(p.pmt)}</TableCell>
                        <TableCell className="text-right">{p.amortizacao ? fmt(p.amortizacao) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{p.juros ? fmt(p.juros) : "—"}</TableCell>
                        <TableCell className="text-right">{p.saldo_devedor ? fmt(p.saldo_devedor) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.pago ? "secondary" : "outline"}>{p.pago ? "Pago" : "Pendente"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showPayment} onOpenChange={setShowPayment}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />Registrar Pagamento</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Valor Total *</Label><Input type="number" step="0.01" value={payForm.valor} onChange={(e) => setPayForm({ ...payForm, valor: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Data *</Label><Input type="date" value={payForm.data} onChange={(e) => setPayForm({ ...payForm, data: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Principal Amortizado</Label><Input type="number" step="0.01" value={payForm.principal} onChange={(e) => setPayForm({ ...payForm, principal: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Juros Pago</Label><Input type="number" step="0.01" value={payForm.juros} onChange={(e) => setPayForm({ ...payForm, juros: e.target.value })} /></div>
                  </div>
                  <Button onClick={handleSubmitPayment}>Registrar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              {pagamentos.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">Nenhum pagamento registrado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor Pago</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Juros</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{new Date(p.data_pagamento + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(p.valor_pago)}</TableCell>
                        <TableCell className="text-right">{p.principal_amortizado ? fmt(p.principal_amortizado) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{p.juros_pago ? fmt(p.juros_pago) : "—"}</TableCell>
                        <TableCell><Badge variant="outline">{p.origem}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.observacao || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== Helpers ====================
function KpiCard({ label, value, icon, positive, negative }: {
  label: string; value: string; icon: React.ReactNode; positive?: boolean; negative?: boolean;
}) {
  const colorClass = positive ? "text-emerald-600" : negative ? "text-destructive" : "text-foreground";
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <div className="rounded-md bg-accent p-1.5">{icon}</div>
        </div>
        <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function IndicatorRow({ label, value, ref_text, status }: {
  label: string; value: string; ref_text: string; status: "ok" | "alert" | "info";
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{ref_text}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold">{value}</span>
        {status === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        {status === "alert" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
        {status === "info" && <Clock className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );
}
