import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Tooltip as RTooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Receipt, DollarSign, AlertCircle, CheckCircle2, Plus, Calendar,
} from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface ImpostoDevido {
  id: string;
  imposto: string;
  competencia: string;
  valor_devido: number;
  valor_pago: number;
  status: string;
  vencimento: string | null;
}

interface ImpostoPagamento {
  id: string;
  impostos_devidos_id: string;
  data_pagamento: string;
  valor_pago: number;
  origem: string;
}

const IMPOSTO_LABELS: Record<string, string> = {
  simples: "Simples Nacional",
  fgts: "FGTS",
  inss: "INSS",
  iss: "ISS",
};

const IMPOSTO_COLORS: Record<string, string> = {
  simples: "hsl(204, 67%, 42%)",
  fgts: "hsl(152, 60%, 40%)",
  inss: "hsl(32, 85%, 50%)",
  iss: "hsl(280, 60%, 50%)",
};

export default function Impostos() {
  const { clinicaId } = useAuth();
  const [impostos, setImpostos] = useState<ImpostoDevido[]>([]);
  const [pagamentos, setPagamentos] = useState<ImpostoPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedImposto, setSelectedImposto] = useState<ImpostoDevido | null>(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [newForm, setNewForm] = useState({
    imposto: "simples", competencia: "", valor_devido: "", vencimento: "",
  });
  const [payForm, setPayForm] = useState({
    valor: "", data: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (!clinicaId) return;
    fetchImpostos();
  }, [clinicaId, filterYear]);

  const fetchImpostos = async () => {
    setLoading(true);
    const startDate = `${filterYear}-01-01`;
    const endDate = `${filterYear}-12-31`;
    const { data } = await supabase
      .from("impostos_devidos")
      .select("*")
      .eq("clinica_id", clinicaId!)
      .gte("competencia", startDate)
      .lte("competencia", endDate)
      .order("competencia", { ascending: false });
    setImpostos((data as any[]) || []);
    setLoading(false);
  };

  const fetchPagamentos = async (impostoId: string) => {
    const { data } = await supabase
      .from("imposto_pagamentos")
      .select("*")
      .eq("impostos_devidos_id", impostoId)
      .order("data_pagamento", { ascending: false });
    setPagamentos((data as any[]) || []);
  };

  const handleCreate = async () => {
    if (!newForm.competencia || !newForm.valor_devido) {
      toast.error("Preencha competência e valor devido");
      return;
    }
    const competencia = newForm.competencia + "-01"; // YYYY-MM-01
    const { error } = await supabase.from("impostos_devidos").insert({
      clinica_id: clinicaId!,
      imposto: newForm.imposto as any,
      competencia,
      valor_devido: parseFloat(newForm.valor_devido),
      vencimento: newForm.vencimento || null,
    } as any);
    if (error) {
      if (error.message.includes("duplicate")) toast.error("Já existe lançamento para este imposto/competência");
      else toast.error(error.message);
    } else {
      toast.success("Imposto lançado!");
      setShowNew(false);
      setNewForm({ imposto: "simples", competencia: "", valor_devido: "", vencimento: "" });
      fetchImpostos();
    }
  };

  const handlePayment = async () => {
    if (!selectedImposto || !payForm.valor) { toast.error("Informe o valor"); return; }
    const valor = parseFloat(payForm.valor);

    const { error } = await supabase.from("imposto_pagamentos").insert({
      clinica_id: clinicaId!,
      impostos_devidos_id: selectedImposto.id,
      data_pagamento: payForm.data,
      valor_pago: valor,
      origem: "manual",
    } as any);
    if (error) { toast.error(error.message); return; }

    // Update valor_pago and status
    const newPago = selectedImposto.valor_pago + valor;
    const newStatus = newPago >= selectedImposto.valor_devido - 0.01 ? "pago" : newPago > 0 ? "parcial" : "aberto";
    await supabase.from("impostos_devidos").update({
      valor_pago: newPago,
      status: newStatus,
    } as any).eq("id", selectedImposto.id);

    toast.success("Pagamento registrado!");
    setShowPayment(false);
    setPayForm({ valor: "", data: new Date().toISOString().split("T")[0] });
    fetchImpostos();
  };

  // KPIs
  const totalDevido = impostos.reduce((s, i) => s + i.valor_devido, 0);
  const totalPago = impostos.reduce((s, i) => s + i.valor_pago, 0);
  const totalAberto = totalDevido - totalPago;
  const qtdAberto = impostos.filter((i) => i.status !== "pago").length;

  // Chart data by month
  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const label = new Date(filterYear, i).toLocaleDateString("pt-BR", { month: "short" });
      return { name: label, simples: 0, fgts: 0, inss: 0, iss: 0 };
    });
    impostos.forEach((imp) => {
      const month = new Date(imp.competencia + "T12:00:00").getMonth();
      const key = imp.imposto as keyof typeof months[0];
      if (key in months[month]) {
        (months[month] as any)[key] += imp.valor_devido;
      }
    });
    return months;
  }, [impostos, filterYear]);

  const statusVariant = (s: string) => {
    switch (s) {
      case "pago": return "secondary" as const;
      case "parcial": return "default" as const;
      default: return "outline" as const;
    }
  };
  const statusLabel: Record<string, string> = { aberto: "Aberto", parcial: "Parcial", pago: "Pago" };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Impostos a Pagar</h1>
            <p className="text-sm text-muted-foreground">Controle de obrigações tributárias por competência</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2026, 2025, 2024].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={showNew} onOpenChange={setShowNew}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />Lançar Imposto</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Lançar Imposto Devido</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Imposto</Label>
                      <Select value={newForm.imposto} onValueChange={(v) => setNewForm({ ...newForm, imposto: v })}>
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
                      <Input type="month" value={newForm.competencia} onChange={(e) => setNewForm({ ...newForm, competencia: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Valor Devido *</Label>
                      <Input type="number" step="0.01" value={newForm.valor_devido} onChange={(e) => setNewForm({ ...newForm, valor_devido: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Vencimento</Label>
                      <Input type="date" value={newForm.vencimento} onChange={(e) => setNewForm({ ...newForm, vencimento: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={handleCreate}>Lançar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Devido" value={fmt(totalDevido)} icon={<Receipt className="h-4 w-4" />} />
          <KpiCard label="Total Pago" value={fmt(totalPago)} icon={<CheckCircle2 className="h-4 w-4" />} positive />
          <KpiCard label="Saldo em Aberto" value={fmt(totalAberto)} icon={<AlertCircle className="h-4 w-4" />} negative={totalAberto > 0} />
          <KpiCard label="Guias em Aberto" value={String(qtdAberto)} icon={<Calendar className="h-4 w-4" />} />
        </div>

        <Tabs defaultValue="lista" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="lista">Por Competência</TabsTrigger>
            <TabsTrigger value="grafico">Visão Anual</TabsTrigger>
          </TabsList>

          <TabsContent value="lista">
            <Card className="border-0 shadow-md">
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : impostos.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    Nenhum imposto lançado para {filterYear}. Clique em "Lançar Imposto" para começar.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead>Imposto</TableHead>
                        <TableHead className="text-right">Devido</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {impostos.map((imp) => {
                        const saldo = imp.valor_devido - imp.valor_pago;
                        return (
                          <TableRow key={imp.id}>
                            <TableCell>{new Date(imp.competencia + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</TableCell>
                            <TableCell className="font-medium">{IMPOSTO_LABELS[imp.imposto] || imp.imposto}</TableCell>
                            <TableCell className="text-right">{fmt(imp.valor_devido)}</TableCell>
                            <TableCell className="text-right text-emerald-600">{fmt(imp.valor_pago)}</TableCell>
                            <TableCell className={`text-right font-medium ${saldo > 0 ? "text-destructive" : ""}`}>{fmt(saldo)}</TableCell>
                            <TableCell>{imp.vencimento ? new Date(imp.vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(imp.status)}>{statusLabel[imp.status] || imp.status}</Badge>
                            </TableCell>
                            <TableCell>
                              {imp.status !== "pago" && (
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setSelectedImposto(imp);
                                  setShowPayment(true);
                                  fetchPagamentos(imp.id);
                                }}>Pagar</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Total row */}
                      <TableRow className="font-bold bg-accent/50">
                        <TableCell>TOTAL {filterYear}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">{fmt(totalDevido)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{fmt(totalPago)}</TableCell>
                        <TableCell className={`text-right ${totalAberto > 0 ? "text-destructive" : ""}`}>{fmt(totalAberto)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grafico">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-lg">Impostos por Mês — {filterYear}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
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

        {/* Payment dialog */}
        <Dialog open={showPayment} onOpenChange={setShowPayment}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Registrar Pagamento — {selectedImposto ? IMPOSTO_LABELS[selectedImposto.imposto] : ""}
              </DialogTitle>
            </DialogHeader>
            {selectedImposto && (
              <div className="space-y-4">
                <div className="rounded-lg bg-accent p-3">
                  <div className="flex justify-between text-sm">
                    <span>Devido:</span><span className="font-medium">{fmt(selectedImposto.valor_devido)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Já pago:</span><span className="font-medium text-emerald-600">{fmt(selectedImposto.valor_pago)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span>Saldo:</span><span className="text-destructive">{fmt(selectedImposto.valor_devido - selectedImposto.valor_pago)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Valor *</Label><Input type="number" step="0.01" value={payForm.valor} onChange={(e) => setPayForm({ ...payForm, valor: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Data *</Label><Input type="date" value={payForm.data} onChange={(e) => setPayForm({ ...payForm, data: e.target.value })} /></div>
                </div>
                <Button onClick={handlePayment} className="w-full">Registrar Pagamento</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

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
