import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { Activity, DollarSign, TrendingUp, UserX, Stethoscope, FlaskConical, Syringe, CheckCircle2 } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

interface VendaRow {
  id: string;
  feegow_id: string | null;
  data_competencia: string;
  procedimento: string | null;
  especialidade: string | null;
  valor_bruto: number;
  forma_pagamento: string | null;
  status_recebimento: string;
  observacao: string | null;
  data_prevista_recebimento: string | null;
  status_presenca: string | null;
  convenio_id: string | null;
  quantidade: number;
  medicos: { nome: string } | null;
  pacientes: { nome: string } | null;
  convenios: { nome: string; prazo_repasse_dias: number | null } | null;
}

const COLORS = [
  "hsl(204, 67%, 32%)", "hsl(152, 60%, 40%)", "hsl(38, 92%, 50%)",
  "hsl(280, 60%, 50%)", "hsl(358, 74%, 44%)", "hsl(180, 50%, 40%)",
];

export default function TabProducao({ dateFrom, dateTo }: Props) {
  const { clinicaId } = useAuth();
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [baixaDialog, setBaixaDialog] = useState<VendaRow | null>(null);
  const [baixaLoading, setBaixaLoading] = useState(false);
  const [baixaObs, setBaixaObs] = useState("");
  const [baixaData, setBaixaData] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (!clinicaId) return;
    setLoading(true);
    supabase
      .from("transacoes_vendas")
      .select("id, feegow_id, data_competencia, procedimento, especialidade, valor_bruto, forma_pagamento, status_recebimento, data_prevista_recebimento, status_presenca, convenio_id, quantidade, observacao, medicos(nome), pacientes(nome), convenios(nome, prazo_repasse_dias)")
      .eq("clinica_id", clinicaId)
      .gte("data_competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("data_competencia", format(dateTo, "yyyy-MM-dd"))
      .not("feegow_id", "like", "inv_%")
      .order("data_competencia", { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setVendas((data as unknown as VendaRow[]) || []);
        setLoading(false);
      });
  }, [clinicaId, dateFrom, dateTo]);

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
      setVendas((prev) =>
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

  // Classify production type from procedimento/especialidade
  const classifyTipo = (v: VendaRow): string => {
    const proc = (v.procedimento || "").toLowerCase();
    const esp = (v.especialidade || "").toLowerCase();
    if (proc.includes("exame") || proc.includes("laborat") || proc.includes("hemograma") || proc.includes("raio") || proc.includes("ultrassom") || proc.includes("eletro") || proc.includes("holter") || proc.includes("mapa") || proc.includes("espiro")) return "exame";
    if (proc.includes("procedimento") || proc.includes("cirurg") || proc.includes("biops") || proc.includes("sutur") || proc.includes("drenag") || proc.includes("cauteriz")) return "procedimento";
    return "consulta";
  };

  const vendasFiltradas = useMemo(() => {
    if (filtroTipo === "todos") return vendas;
    return vendas.filter((v) => classifyTipo(v) === filtroTipo);
  }, [vendas, filtroTipo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalAtendimentos = vendasFiltradas.length;
  const receitaBruta = vendasFiltradas.reduce((s, c) => s + c.valor_bruto, 0);
  const ticketMedio = totalAtendimentos > 0 ? receitaBruta / totalAtendimentos : 0;
  const faltas = vendasFiltradas.filter((c) => c.status_presenca === "faltou").length;
  const taxaFalta = totalAtendimentos > 0 ? (faltas / totalAtendimentos) * 100 : 0;
  const totalQuantidade = vendasFiltradas.reduce((s, c) => s + (c.quantidade || 1), 0);

  // Production by type
  const tipoMap = new Map<string, { qtd: number; receita: number }>();
  vendas.forEach((v) => {
    const tipo = classifyTipo(v);
    const e = tipoMap.get(tipo) || { qtd: 0, receita: 0 };
    e.qtd++;
    e.receita += v.valor_bruto;
    tipoMap.set(tipo, e);
  });
  const tipoData = Array.from(tipoMap.entries()).map(([tipo, v]) => ({
    name: tipo === "consulta" ? "Consultas" : tipo === "exame" ? "Exames" : "Procedimentos",
    value: v.receita,
    qtd: v.qtd,
  }));

  // Revenue by doctor
  const medicoMap = new Map<string, number>();
  vendasFiltradas.forEach((c) => {
    const nome = (c.medicos as any)?.nome || "Sem profissional";
    medicoMap.set(nome, (medicoMap.get(nome) || 0) + c.valor_bruto);
  });
  const medicoData = Array.from(medicoMap.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Revenue by channel (monthly)
  const canalMap = new Map<string, { particular: number; convenio: number }>();
  vendasFiltradas.forEach((c) => {
    const mes = c.data_competencia.substring(0, 7);
    const entry = canalMap.get(mes) || { particular: 0, convenio: 0 };
    if (c.convenio_id) entry.convenio += c.valor_bruto;
    else entry.particular += c.valor_bruto;
    canalMap.set(mes, entry);
  });
  const canalData = Array.from(canalMap.entries())
    .map(([mes, v]) => ({ mes, ...v }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  // Revenue by specialty
  const espMap = new Map<string, number>();
  vendasFiltradas.forEach((c) => {
    const esp = c.especialidade || "Geral";
    espMap.set(esp, (espMap.get(esp) || 0) + c.valor_bruto);
  });
  const espData = Array.from(espMap.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Payer detail
  const convMap = new Map<string, { prazo: number | null; faturado: number; recebido: number; pendente: number; qtd: number }>();
  vendasFiltradas.forEach((c) => {
    const nome = c.convenio_id ? ((c.convenios as any)?.nome || "Convênio") : "Particular";
    const prazo = c.convenio_id ? (c.convenios as any)?.prazo_repasse_dias : null;
    const entry = convMap.get(nome) || { prazo, faturado: 0, recebido: 0, pendente: 0, qtd: 0 };
    entry.faturado += c.valor_bruto;
    entry.qtd++;
    if (c.status_recebimento === "recebido") entry.recebido += c.valor_bruto;
    else entry.pendente += c.valor_bruto;
    convMap.set(nome, entry);
  });
  const convData = Array.from(convMap.entries())
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.faturado - a.faturado);

  const statusBadge = (status: string) => {
    switch (status) {
      case "recebido": return <Badge className="bg-emerald-100 text-emerald-700 border-0">Recebido</Badge>;
      case "a_receber": return <Badge className="bg-amber-100 text-amber-700 border-0">A Receber</Badge>;
      case "inadimplente": return <Badge variant="destructive">Inadimplente</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const tipoBadge = (v: VendaRow) => {
    const tipo = classifyTipo(v);
    switch (tipo) {
      case "exame": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Exame</Badge>;
      case "procedimento": return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Procedimento</Badge>;
      default: return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Consulta</Badge>;
    }
  };

  const tipoIcon = (tipo: string) => {
    switch (tipo) {
      case "exame": return <FlaskConical className="h-4 w-4" />;
      case "procedimento": return <Syringe className="h-4 w-4" />;
      default: return <Stethoscope className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo de atendimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="consulta">Consultas</SelectItem>
            <SelectItem value="exame">Exames</SelectItem>
            <SelectItem value="procedimento">Procedimentos</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Fonte: Feegow (transações sincronizadas)</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard icon={<Activity className="h-4 w-4" />} label="Total Atendimentos" value={totalAtendimentos.toString()} />
        <SummaryCard icon={<DollarSign className="h-4 w-4" />} label="Receita Bruta" value={fmt(receitaBruta)} />
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Ticket Médio" value={fmt(ticketMedio)} />
        <SummaryCard icon={<Activity className="h-4 w-4" />} label="Qtd Procedimentos" value={totalQuantidade.toString()} />
        <SummaryCard icon={<UserX className="h-4 w-4" />} label="Taxa de Falta" value={`${taxaFalta.toFixed(1)}%`} negative={taxaFalta > 10} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Production by Type (Pie) */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-lg">Produção por Tipo</CardTitle></CardHeader>
          <CardContent>
            {tipoData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tipoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {tipoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(v: number, name: string, props: any) => [fmt(v), `${name} (${props.payload.qtd} atend.)`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Channel */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-lg">Receita por Canal (Mensal)</CardTitle></CardHeader>
          <CardContent>
            {canalData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={canalData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="particular" name="Particular" fill="hsl(204, 67%, 32%)" stackId="a" />
                    <Bar dataKey="convenio" name="Convênio" fill="hsl(152, 60%, 40%)" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Specialty */}
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-lg">Receita por Especialidade</CardTitle></CardHeader>
          <CardContent>
            {espData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={espData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" className="text-xs" width={120} />
                    <RechartsTooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" name="Receita" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Doctor */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">Receita por Profissional (Top 10)</CardTitle></CardHeader>
        <CardContent>
          {medicoData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={medicoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nome" className="text-xs" width={160} />
                  <RechartsTooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="total" name="Receita" fill="hsl(204, 67%, 32%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          )}
        </CardContent>
      </Card>

      {/* Payer Detail */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">Detalhe por Pagador</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pagador</TableHead>
                <TableHead className="text-right">Prazo Repasse</TableHead>
                <TableHead className="text-right">Faturado</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Pendente</TableHead>
                <TableHead className="text-right">Atendimentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convData.map((c) => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right">{c.prazo != null ? `${c.prazo}d` : "D+1"}</TableCell>
                  <TableCell className="text-right">{fmt(c.faturado)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{fmt(c.recebido)}</TableCell>
                  <TableCell className="text-right text-amber-600">{fmt(c.pendente)}</TableCell>
                  <TableCell className="text-right">{c.qtd}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Production Table */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">Produção Realizada</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Procedimento</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead className="text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasFiltradas.slice(0, 50).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap">{c.data_competencia}</TableCell>
                  <TableCell>{tipoBadge(c)}</TableCell>
                  <TableCell>{(c.pacientes as any)?.nome || "—"}</TableCell>
                  <TableCell>{(c.medicos as any)?.nome || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{c.procedimento || "—"}</TableCell>
                  <TableCell>{c.convenio_id ? (c.convenios as any)?.nome || "Convênio" : "Particular"}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(c.valor_bruto)}</TableCell>
                  <TableCell>{statusBadge(c.status_recebimento)}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.data_prevista_recebimento || "—"}</TableCell>
                  <TableCell className="text-center">
                    {c.status_recebimento === "a_receber" || c.status_recebimento === "inadimplente" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => {
                          setBaixaDialog(c);
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
              ))}
            </TableBody>
          </Table>
          {vendasFiltradas.length > 50 && (
            <p className="text-xs text-muted-foreground p-3 text-center">Exibindo 50 de {vendasFiltradas.length} registros</p>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Baixa Manual */}
      <Dialog open={!!baixaDialog} onOpenChange={(open) => !open && setBaixaDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Baixa Manual de Receita</DialogTitle>
            <DialogDescription>
              Confirmar recebimento de {baixaDialog ? fmt(baixaDialog.valor_bruto) : ""}
              {baixaDialog?.procedimento ? ` — ${baixaDialog.procedimento}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Paciente</Label>
                <p className="text-sm font-medium">{baixaDialog ? (baixaDialog.pacientes as any)?.nome || "—" : ""}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Pagador</Label>
                <p className="text-sm font-medium">
                  {baixaDialog?.convenio_id ? (baixaDialog.convenios as any)?.nome || "Convênio" : "Particular"}
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="baixa-data">Data do recebimento</Label>
              <Input
                id="baixa-data"
                type="date"
                value={baixaData}
                onChange={(e) => setBaixaData(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="baixa-obs">Observação (opcional)</Label>
              <Textarea
                id="baixa-obs"
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

function SummaryCard({ icon, label, value, negative }: { icon: React.ReactNode; label: string; value: string; negative?: boolean }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="rounded-md bg-accent p-1.5">{icon}</div>
        </div>
        <p className={`text-lg font-bold ${negative ? "text-destructive" : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
