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
  Tooltip as RTooltip, Line, ComposedChart, AreaChart, Area,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Landmark, TrendingDown, DollarSign, CalendarDays, Plus, ChevronLeft,
  AlertTriangle, CheckCircle2, Clock, ArrowDownRight,
} from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

interface Divida {
  id: string;
  nome: string | null;
  credor: string;
  tipo: string;
  descricao: string | null;
  saldo: number;
  saldo_inicial: number | null;
  taxa_juros: number | null;
  custo_efetivo: number | null;
  data_inicio: string | null;
  data_vencimento: string | null;
  ativo: boolean;
}

interface Pagamento {
  id: string;
  data_pagamento: string;
  valor_pago: number;
  principal_amortizado: number | null;
  juros_pago: number | null;
  origem: string;
  observacao: string | null;
}

interface Parcela {
  id: string;
  competencia: string;
  pmt: number;
  amortizacao: number | null;
  juros: number | null;
  saldo_devedor: number | null;
  pago: boolean;
}

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

  useEffect(() => {
    if (!clinicaId) return;
    fetchDividas();
  }, [clinicaId]);

  const fetchDividas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dividas")
      .select("*")
      .eq("clinica_id", clinicaId!)
      .eq("ativo", true)
      .order("saldo", { ascending: false });
    setDividas((data as any[]) || []);
    setLoading(false);
  };

  const fetchPagamentos = async (dividaId: string) => {
    const { data } = await supabase
      .from("divida_pagamentos")
      .select("*")
      .eq("divida_id", dividaId)
      .order("data_pagamento", { ascending: false });
    setPagamentos((data as any[]) || []);
  };

  const fetchParcelas = async (dividaId: string) => {
    const { data } = await supabase
      .from("divida_parcelas_previstas")
      .select("*")
      .eq("divida_id", dividaId)
      .order("competencia");
    setParcelas((data as any[]) || []);
  };

  const handleSelectDivida = (d: Divida) => {
    setSelectedDivida(d);
    fetchPagamentos(d.id);
    fetchParcelas(d.id);
  };

  const handleCreateDebt = async () => {
    if (!newDebt.nome || !newDebt.credor || !newDebt.saldo_inicial) {
      toast.error("Preencha nome, credor e saldo inicial");
      return;
    }
    const saldoInicial = parseFloat(newDebt.saldo_inicial);
    const { error } = await supabase.from("dividas").insert({
      clinica_id: clinicaId!,
      nome: newDebt.nome,
      credor: newDebt.credor,
      tipo: newDebt.tipo as any,
      saldo_inicial: saldoInicial,
      saldo: saldoInicial,
      taxa_juros: newDebt.taxa_juros ? parseFloat(newDebt.taxa_juros) : null,
      data_inicio: newDebt.data_inicio || null,
      data_vencimento: newDebt.data_vencimento || null,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Dívida criada!"); setShowNewDebt(false); fetchDividas(); }
  };

  const handleAddPayment = async (dividaId: string, valor: number, principal: number, juros: number, data: string) => {
    const { error } = await supabase.from("divida_pagamentos").insert({
      clinica_id: clinicaId!,
      divida_id: dividaId,
      data_pagamento: data,
      valor_pago: valor,
      principal_amortizado: principal,
      juros_pago: juros,
      origem: "manual",
    } as any);
    if (error) { toast.error(error.message); return; }

    // Update saldo
    await supabase.from("dividas").update({
      saldo: Math.max(0, (selectedDivida?.saldo || 0) - principal),
    } as any).eq("id", dividaId);

    toast.success("Pagamento registrado!");
    fetchDividas();
    fetchPagamentos(dividaId);
  };

  // KPIs
  const totalSaldo = dividas.reduce((s, d) => s + d.saldo, 0);
  const totalInicial = dividas.reduce((s, d) => s + (d.saldo_inicial || d.saldo), 0);
  const custoMedio = useMemo(() => {
    const weighted = dividas.reduce((s, d) => s + (d.taxa_juros || 0) * d.saldo, 0);
    return totalSaldo > 0 ? weighted / totalSaldo : 0;
  }, [dividas, totalSaldo]);
  const amortizado = totalInicial - totalSaldo;

  if (selectedDivida) {
    return (
      <DashboardLayout>
        <DebtDetail
          divida={selectedDivida}
          pagamentos={pagamentos}
          parcelas={parcelas}
          onBack={() => setSelectedDivida(null)}
          onAddPayment={handleAddPayment}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Endividamento</h1>
            <p className="text-sm text-muted-foreground">Controle de empréstimos, financiamentos e parcelamentos</p>
          </div>
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Endividamento Total" value={fmt(totalSaldo)} icon={<Landmark className="h-4 w-4" />} negative />
          <KpiCard label="Custo Médio Mensal" value={fmtPct(custoMedio)} icon={<TrendingDown className="h-4 w-4" />} />
          <KpiCard label="Total Amortizado" value={fmt(amortizado)} icon={<DollarSign className="h-4 w-4" />} positive />
          <KpiCard label="Contratos Ativos" value={String(dividas.length)} icon={<CalendarDays className="h-4 w-4" />} />
        </div>

        {/* Debt List */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Contratos Ativos</CardTitle>
          </CardHeader>
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
                          ? `${new Date(d.data_inicio + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })} → ${new Date(d.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Detalhes</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total */}
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

        {/* Health Indicators */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">📊 Indicadores de Saúde Financeira</CardTitle>
            <CardDescription>Baseados na análise de endividamento — dados da planilha consolidada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <IndicatorRow label="Comprometimento da Receita (PMT/RT)" value="4.09%" ref_text="< 15% saudável" status="ok" />
              <IndicatorRow label="Comprometimento da MC (PMT/MC)" value="11.69%" ref_text="< 30% saudável" status="ok" />
              <IndicatorRow label="DSCR — Cobertura do Serviço da Dívida" value="1.96x" ref_text="> 1,25x saudável" status="ok" />
              <IndicatorRow label="Custo Médio Ponderado (mensal)" value={fmtPct(custoMedio)} ref_text="Menor = melhor" status="info" />
              <IndicatorRow label="Relação Juros/Principal" value="48.1%" ref_text="Menor = melhor" status="alert" />
              <IndicatorRow label="Último Vencimento" value="ABR/2029" ref_text="38 meses restantes" status="info" />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// ==================== DebtDetail ====================
function DebtDetail({ divida, pagamentos, parcelas, onBack, onAddPayment }: {
  divida: Divida;
  pagamentos: Pagamento[];
  parcelas: Parcela[];
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

  // Chart data from parcelas
  const chartData = useMemo(() => {
    return parcelas.map((p) => ({
      name: new Date(p.competencia + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      saldo: p.saldo_devedor || 0,
      amortizacao: p.amortizacao || 0,
      juros: p.juros || 0,
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

      {/* Summary cards */}
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

        {/* Evolution */}
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
                      <Bar dataKey="amortizacao" name="Amortização" fill="hsl(152, 60%, 40%)" stackId="a" radius={[0, 0, 0, 0]} />
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

        {/* Schedule */}
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
                        <TableCell>{new Date(p.competencia + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(p.pmt)}</TableCell>
                        <TableCell className="text-right">{p.amortizacao ? fmt(p.amortizacao) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{p.juros ? fmt(p.juros) : "—"}</TableCell>
                        <TableCell className="text-right">{p.saldo_devedor ? fmt(p.saldo_devedor) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={p.pago ? "secondary" : "outline"}>
                            {p.pago ? "Pago" : "Pendente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments */}
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
