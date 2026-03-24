import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RTooltip, Line, ComposedChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import EditRecordDialog, { FieldDef } from "@/components/admin/EditRecordDialog";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, CalendarDays, ArrowLeftRight, Pencil,
} from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface CaixaMonth {
  mes: number;
  ano: number;
  mes_label: string;
  entradas_op: number;
  recuperacoes: number;
  mao_obra: number;
  custos_var: number;
  custos_fix: number;
  marketing: number;
  impostos: number;
  emprestimos: number;
  aporte: number;
  retirada: number;
  saldo_op: number;
  saldo_final: number;
  total_entradas: number;
  total_saidas: number;
}

interface CaixaData {
  mensal: CaixaMonth[];
  cards: {
    entradas: number;
    saidas: number;
    saldo_op: number;
    saldo_final: number;
    emprestimos: number;
    aporte: number;
    retirada: number;
  };
}

function historicoToCaixaData(rows: any[]): CaixaData {
  const mensal: CaixaMonth[] = rows.map((r) => {
    const entradas_op = Number(r.entradas_operacionais) || 0;
    const recuperacoes = Number(r.recuperacoes_glosa) || 0;
    const mao_obra = Number(r.saidas_mao_obra) || 0;
    const custos_var = Number(r.saidas_custos_variaveis) || 0;
    const custos_fix = Number(r.saidas_custos_fixos) || 0;
    const marketing = Number(r.saidas_marketing) || 0;
    const impostos = Number(r.saidas_impostos) || 0;
    const emprestimos = Number(r.saidas_emprestimos) || 0;
    const aporte = Number(r.aporte_nao_operacional) || 0;
    const retirada = Number(r.retirada_nao_operacional) || 0;
    const total_entradas = entradas_op + recuperacoes;
    const total_saidas = mao_obra + custos_var + custos_fix + marketing + impostos;
    return {
      mes: r.mes,
      ano: r.ano,
      mes_label: `${MONTH_NAMES[r.mes - 1]}/${String(r.ano).slice(2)}`,
      entradas_op, recuperacoes, mao_obra, custos_var, custos_fix, marketing,
      impostos, emprestimos, aporte, retirada,
      saldo_op: Number(r.saldo_operacional) || 0,
      saldo_final: Number(r.saldo_final) || 0,
      total_entradas, total_saidas,
    };
  });

  const sum = (fn: (m: CaixaMonth) => number) => mensal.reduce((s, m) => s + fn(m), 0);

  return {
    mensal,
    cards: {
      entradas: sum((m) => m.total_entradas),
      saidas: sum((m) => m.total_saidas),
      saldo_op: sum((m) => m.saldo_op),
      saldo_final: sum((m) => m.saldo_final),
      emprestimos: sum((m) => m.emprestimos),
      aporte: sum((m) => m.aporte),
      retirada: sum((m) => m.retirada),
    },
  };
}

async function fetchCaixaYear(clinicaId: string, year: number): Promise<CaixaData | null> {
  const { data: histRows, error } = await supabase
    .from("caixa_historico_mensal")
    .select("*")
    .eq("clinica_id", clinicaId)
    .eq("ano", year)
    .order("mes");

  if (error || !histRows || histRows.length === 0) return null;
  return historicoToCaixaData(histRows);
}

const CAIXA_HIST_FIELDS: FieldDef[] = [
  { key: "entradas_operacionais", label: "Entradas Operacionais", type: "number" },
  { key: "recuperacoes_glosa", label: "Recuperações de Glosa", type: "number" },
  { key: "saidas_mao_obra", label: "Mão de Obra", type: "number" },
  { key: "saidas_custos_variaveis", label: "Custos Variáveis", type: "number" },
  { key: "saidas_custos_fixos", label: "Custos Fixos", type: "number" },
  { key: "saidas_marketing", label: "Marketing", type: "number" },
  { key: "saidas_impostos", label: "Impostos", type: "number" },
  { key: "saidas_emprestimos", label: "Empréstimos", type: "number" },
  { key: "aporte_nao_operacional", label: "Aporte", type: "number" },
  { key: "retirada_nao_operacional", label: "Retirada", type: "number" },
  { key: "saldo_operacional", label: "Saldo Operacional", type: "number" },
  { key: "saldo_final", label: "Saldo Final", type: "number" },
];

export default function FluxoDeCaixa() {
  const { clinicaId } = useAuth();
  const isAdmin = useIsAdmin();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [compareYear, setCompareYear] = useState(currentYear - 1);
  const [data, setData] = useState<CaixaData | null>(null);
  const [compareData, setCompareData] = useState<CaixaData | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin edit state
  const [histRecords, setHistRecords] = useState<any[]>([]);
  const [editingRecord, setEditingRecord] = useState<any>(null);

  const fetchData = () => {
    if (!clinicaId) return;
    setLoading(true);
    const promises: Promise<any>[] = [
      fetchCaixaYear(clinicaId, year),
      fetchCaixaYear(clinicaId, compareYear),
    ];
    Promise.all(promises)
      .then(([res1, res2, hist]) => {
        setData(res1);
        setCompareData(res2);
        if (hist) setHistRecords(hist);
      })
      .catch((e: any) => toast.error("Erro ao carregar fluxo de caixa: " + e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [clinicaId, year, compareYear]);

  const getHistRecordForMonth = (mes: number) => {
    return histRecords.find((r) => r.mes === mes);
  };

  // Monthly comparison for YoY
  const monthlyComparison = useMemo(() => {
    if (!data?.mensal) return [];
    const compMap = new Map<number, CaixaMonth>();
    compareData?.mensal?.forEach((m) => compMap.set(m.mes, m));

    return data.mensal.map((m) => ({
      month: MONTH_NAMES[m.mes - 1],
      monthIdx: m.mes,
      current: m,
      previous: compMap.get(m.mes) || null,
    }));
  }, [data, compareData]);

  // Chart data for YoY
  const chartData = useMemo(() => {
    return monthlyComparison.map((item) => ({
      name: item.month,
      [`Entradas ${year}`]: item.current.total_entradas,
      [`Entradas ${compareYear}`]: item.previous?.total_entradas || 0,
      [`Saldo ${year}`]: item.current.saldo_final,
      [`Saldo ${compareYear}`]: item.previous?.saldo_final || 0,
    }));
  }, [monthlyComparison, year, compareYear]);

  // MoM data
  const momData = useMemo(() => {
    if (!data?.mensal || data.mensal.length < 2) return [];
    return data.mensal.map((m, i) => {
      const prev = i > 0 ? data.mensal[i - 1] : null;
      const entVar = prev && prev.total_entradas > 0 ? ((m.total_entradas - prev.total_entradas) / prev.total_entradas) * 100 : 0;
      const saidVar = prev && prev.total_saidas > 0 ? ((m.total_saidas - prev.total_saidas) / prev.total_saidas) * 100 : 0;
      const saldoVar = prev && prev.saldo_final !== 0 ? ((m.saldo_final - prev.saldo_final) / Math.abs(prev.saldo_final)) * 100 : 0;
      return {
        mes: m.mes_label,
        entradas: m.total_entradas,
        entradas_var: entVar,
        saidas: m.total_saidas,
        saidas_var: saidVar,
        saldo_op: m.saldo_op,
        saldo_final: m.saldo_final,
        saldo_var: saldoVar,
      };
    });
  }, [data]);

  // Evolution chart for MoM
  const momChartData = useMemo(() => {
    return momData.map((m) => ({
      name: m.mes,
      Entradas: m.entradas,
      Saídas: m.saidas,
      "Saldo Final": m.saldo_final,
    }));
  }, [momData]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const ROWS: Array<{ key: keyof CaixaMonth; label: string; positive?: boolean; negative?: boolean; bold?: boolean; highlight?: boolean }> = [
    { key: "entradas_op", label: "➕ Entradas Operacionais", positive: true, bold: true },
    { key: "recuperacoes", label: "➕ Recuperações de Glosa", positive: true },
    { key: "mao_obra", label: "➖ Mão de Obra", negative: true },
    { key: "custos_var", label: "➖ Custos Variáveis", negative: true },
    { key: "custos_fix", label: "➖ Custos Fixos", negative: true },
    { key: "marketing", label: "➖ Marketing", negative: true },
    { key: "impostos", label: "➖ Impostos", negative: true },
    { key: "saldo_op", label: "= Saldo Operacional", bold: true, highlight: true },
    { key: "emprestimos", label: "➖ Empréstimos", negative: true },
    { key: "aporte", label: "➕ Aporte", positive: true },
    { key: "retirada", label: "➖ Retirada", negative: true },
    { key: "saldo_final", label: "= Saldo Final", bold: true, highlight: true },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fluxo de Caixa</h1>
            <p className="text-sm text-muted-foreground">Análise mensal e comparativo anual — regime de caixa</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <Select value={String(compareYear)} onValueChange={(v) => setCompareYear(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI Cards */}
        {data && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              label="Total Entradas"
              value={fmt(data.cards.entradas)}
              icon={<ArrowUpRight className="h-4 w-4" />}
              positive
              variation={compareData && compareData.cards.entradas > 0 ? ((data.cards.entradas - compareData.cards.entradas) / compareData.cards.entradas) * 100 : undefined}
            />
            <KpiCard
              label="Total Saídas"
              value={fmt(data.cards.saidas)}
              icon={<ArrowDownRight className="h-4 w-4" />}
              negative
              variation={compareData && compareData.cards.saidas > 0 ? ((data.cards.saidas - compareData.cards.saidas) / compareData.cards.saidas) * 100 : undefined}
            />
            <KpiCard
              label="Saldo Operacional"
              value={fmt(data.cards.saldo_op)}
              icon={<DollarSign className="h-4 w-4" />}
              positive={data.cards.saldo_op > 0}
              negative={data.cards.saldo_op < 0}
            />
            <KpiCard
              label="Empréstimos"
              value={fmt(data.cards.emprestimos)}
              icon={<ArrowDownRight className="h-4 w-4" />}
              negative
            />
            <KpiCard
              label="Aporte / Retirada"
              value={fmt(data.cards.aporte - data.cards.retirada)}
              icon={<DollarSign className="h-4 w-4" />}
              positive={data.cards.aporte > data.cards.retirada}
              negative={data.cards.aporte < data.cards.retirada}
            />
            <KpiCard
              label="Saldo Final"
              value={fmt(data.cards.saldo_final)}
              icon={data.cards.saldo_final >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              positive={data.cards.saldo_final > 0}
              negative={data.cards.saldo_final < 0}
              variation={compareData && compareData.cards.saldo_final !== 0 ? ((data.cards.saldo_final - compareData.cards.saldo_final) / Math.abs(compareData.cards.saldo_final)) * 100 : undefined}
            />
          </div>
        )}

        <Tabs defaultValue="mensal" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="mensal">Análise Mensal</TabsTrigger>
            <TabsTrigger value="mom">Mês a Mês</TabsTrigger>
            <TabsTrigger value="yoy">Comparativo Anual</TabsTrigger>
          </TabsList>

          {/* Tab: Análise Mensal */}
          <TabsContent value="mensal" className="space-y-4">
            {/* Chart */}
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-lg">Fluxo de Caixa — {year}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={momChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <RTooltip formatter={(value: number) => fmt(value)} />
                      <Legend />
                      <Bar dataKey="Entradas" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} opacity={0.8} />
                      <Bar dataKey="Saídas" fill="hsl(358, 74%, 44%)" radius={[4, 4, 0, 0]} opacity={0.8} />
                      <Line dataKey="Saldo Final" stroke="hsl(204, 67%, 32%)" strokeWidth={2} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Detalhamento Mensal — {year}</CardTitle>
                  {isAdmin && histRecords.length > 0 && (
                    <Badge variant="outline" className="gap-1 text-xs"><Pencil className="h-3 w-3" />Clique no mês para editar</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[220px]">Categoria</TableHead>
                      {data?.mensal.map((m) => (
                        <TableHead key={`${m.ano}-${m.mes}`} className="text-right min-w-[110px]">
                          <div className="flex items-center justify-end gap-1">
                            {m.mes_label}
                            {isAdmin && getHistRecordForMonth(m.mes) && (
                              <button
                                onClick={() => setEditingRecord(getHistRecordForMonth(m.mes))}
                                className="p-0.5 rounded hover:bg-accent"
                                title="Editar mês"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                              </button>
                            )}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-right min-w-[120px] font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data && ROWS.map((row) => {
                      const values = data.mensal.map((m) => m[row.key] as number);
                      const total = values.reduce((s, v) => s + v, 0);
                      return (
                        <CaixaRow
                          key={row.key}
                          label={row.label}
                          values={values}
                          total={total}
                          bold={row.bold}
                          positive={row.positive}
                          negative={row.negative}
                          highlight={row.highlight}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Mês a Mês */}
          <TabsContent value="mom" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-lg">Variação Mês a Mês — {year}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={momData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mes" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                      <RTooltip formatter={(value: number, name: string) => name.includes("var") || name.includes("%") ? fmtPct(value) : fmt(value)} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="entradas" name="Entradas" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} opacity={0.6} />
                      <Bar yAxisId="left" dataKey="saidas" name="Saídas" fill="hsl(358, 74%, 44%)" radius={[4, 4, 0, 0]} opacity={0.6} />
                      <Line yAxisId="left" dataKey="saldo_final" name="Saldo Final" stroke="hsl(204, 67%, 32%)" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-lg">Variação Mensal (MoM)</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10">Mês</TableHead>
                      <TableHead className="text-right">Entradas</TableHead>
                      <TableHead className="text-right">Var. Ent.</TableHead>
                      <TableHead className="text-right">Saídas</TableHead>
                      <TableHead className="text-right">Var. Saíd.</TableHead>
                      <TableHead className="text-right">Saldo Op.</TableHead>
                      <TableHead className="text-right">Saldo Final</TableHead>
                      <TableHead className="text-right">Var. Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {momData.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium">{m.mes}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(m.entradas)}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${i === 0 ? "text-muted-foreground" : m.entradas_var >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {i === 0 ? "—" : `${m.entradas_var >= 0 ? "+" : ""}${fmtPct(m.entradas_var)}`}
                        </TableCell>
                        <TableCell className="text-right text-sm">{fmt(m.saidas)}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${i === 0 ? "text-muted-foreground" : m.saidas_var <= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {i === 0 ? "—" : `${m.saidas_var >= 0 ? "+" : ""}${fmtPct(m.saidas_var)}`}
                        </TableCell>
                        <TableCell className={`text-right text-sm ${m.saldo_op >= 0 ? "" : "text-destructive"}`}>{fmt(m.saldo_op)}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${m.saldo_final >= 0 ? "" : "text-destructive"}`}>{fmt(m.saldo_final)}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${i === 0 ? "text-muted-foreground" : m.saldo_var >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {i === 0 ? "—" : `${m.saldo_var >= 0 ? "+" : ""}${fmtPct(m.saldo_var)}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Comparativo Anual (YoY) */}
          <TabsContent value="yoy" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-lg">Comparativo {year} vs {compareYear}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <RTooltip formatter={(value: number) => fmt(value)} />
                      <Legend />
                      <Bar dataKey={`Entradas ${year}`} fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={`Entradas ${compareYear}`} fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} opacity={0.3} />
                      <Line dataKey={`Saldo ${year}`} stroke="hsl(204, 67%, 32%)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line dataKey={`Saldo ${compareYear}`} stroke="hsl(204, 67%, 32%)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} opacity={0.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-lg">Fluxo de Caixa Comparativo por Linha</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[120px]">Mês</TableHead>
                      <TableHead className="text-right">Entradas {year}</TableHead>
                      <TableHead className="text-right">Entradas {compareYear}</TableHead>
                      <TableHead className="text-right">Δ Ent.</TableHead>
                      <TableHead className="text-right">Saídas {year}</TableHead>
                      <TableHead className="text-right">Saídas {compareYear}</TableHead>
                      <TableHead className="text-right">Δ Saíd.</TableHead>
                      <TableHead className="text-right">Saldo {year}</TableHead>
                      <TableHead className="text-right">Saldo {compareYear}</TableHead>
                      <TableHead className="text-right">Δ Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyComparison.map((item) => {
                      const pe = item.previous?.total_entradas || 0;
                      const ps = item.previous?.total_saidas || 0;
                      const pf = item.previous?.saldo_final || 0;
                      const de = pe > 0 ? ((item.current.total_entradas - pe) / pe) * 100 : 0;
                      const ds = ps > 0 ? ((item.current.total_saidas - ps) / ps) * 100 : 0;
                      const df = pf !== 0 ? ((item.current.saldo_final - pf) / Math.abs(pf)) * 100 : 0;

                      return (
                        <TableRow key={item.month}>
                          <TableCell className="sticky left-0 bg-card z-10 font-medium">{item.month}</TableCell>
                          <TableCell className="text-right text-sm">{item.current.total_entradas > 0 ? fmt(item.current.total_entradas) : "—"}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{pe > 0 ? fmt(pe) : "—"}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${!pe ? "text-muted-foreground" : de >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {!pe || !item.current.total_entradas ? "—" : `${de >= 0 ? "+" : ""}${fmtPct(de)}`}
                          </TableCell>
                          <TableCell className="text-right text-sm">{item.current.total_saidas > 0 ? fmt(item.current.total_saidas) : "—"}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{ps > 0 ? fmt(ps) : "—"}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${!ps ? "text-muted-foreground" : ds <= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {!ps || !item.current.total_saidas ? "—" : `${ds >= 0 ? "+" : ""}${fmtPct(ds)}`}
                          </TableCell>
                          <TableCell className={`text-right text-sm ${item.current.saldo_final < 0 ? "text-destructive" : ""}`}>
                            {fmt(item.current.saldo_final)}
                          </TableCell>
                          <TableCell className={`text-right text-sm text-muted-foreground ${pf < 0 ? "text-destructive/70" : ""}`}>
                            {pf !== 0 ? fmt(pf) : "—"}
                          </TableCell>
                          <TableCell className={`text-right text-sm font-medium ${!pf ? "text-muted-foreground" : df >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {!pf ? "—" : `${df >= 0 ? "+" : ""}${fmtPct(df)}`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Totals */}
                    {data && compareData && (
                      <TableRow className="font-bold bg-accent/50">
                        <TableCell className="sticky left-0 bg-accent/50 z-10">TOTAL</TableCell>
                        <TableCell className="text-right">{fmt(data.cards.entradas)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(compareData.cards.entradas)}</TableCell>
                        <DeltaCell current={data.cards.entradas} previous={compareData.cards.entradas} />
                        <TableCell className="text-right">{fmt(data.cards.saidas)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(compareData.cards.saidas)}</TableCell>
                        <DeltaCell current={data.cards.saidas} previous={compareData.cards.saidas} invert />
                        <TableCell className={`text-right ${data.cards.saldo_final < 0 ? "text-destructive" : ""}`}>{fmt(data.cards.saldo_final)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(compareData.cards.saldo_final)}</TableCell>
                        <DeltaCell current={data.cards.saldo_final} previous={compareData.cards.saldo_final} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {!data && !loading && (
          <p className="text-sm text-muted-foreground p-4">Sem dados de fluxo de caixa disponíveis para {year}.</p>
        )}
      </div>

      {/* Admin Edit Dialog */}
      {editingRecord && (
        <EditRecordDialog
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
          title={`Caixa — ${MONTH_NAMES[editingRecord.mes - 1]}/${editingRecord.ano}`}
          table="caixa_historico_mensal"
          recordId={editingRecord.id}
          fields={CAIXA_HIST_FIELDS}
          initialValues={editingRecord}
          onSaved={fetchData}
        />
      )}
    </DashboardLayout>
  );
}

// ============ Sub-components ============

function KpiCard({ label, value, icon, positive, negative, variation }: {
  label: string; value: string; icon: React.ReactNode; positive?: boolean; negative?: boolean; variation?: number;
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
        {variation !== undefined && variation !== 0 && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${variation >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {variation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {variation >= 0 ? "+" : ""}{fmtPct(variation)} YoY
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CaixaRow({ label, values, total, bold, positive, negative, highlight }: {
  label: string; values: number[]; total: number; bold?: boolean; positive?: boolean; negative?: boolean; highlight?: boolean;
}) {
  const textClass = positive ? "text-emerald-600" : negative ? "text-destructive" : "text-foreground";
  return (
    <TableRow className={highlight ? "bg-muted/50 font-semibold" : ""}>
      <TableCell className={`sticky left-0 bg-card z-10 text-sm ${bold ? "font-semibold" : ""} ${highlight ? "bg-muted/50" : ""}`}>
        {label}
      </TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className={`text-right text-sm ${bold ? "font-semibold" : ""} ${v !== 0 ? textClass : "text-muted-foreground"}`}>
          {v !== 0 ? fmt(v) : "—"}
        </TableCell>
      ))}
      <TableCell className={`text-right text-sm font-bold ${total !== 0 ? textClass : "text-muted-foreground"}`}>
        {total !== 0 ? fmt(total) : "—"}
      </TableCell>
    </TableRow>
  );
}

function DeltaCell({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (!previous) return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const isGood = invert ? delta <= 0 : delta >= 0;
  return (
    <TableCell className={`text-right text-sm font-medium ${isGood ? "text-emerald-600" : "text-destructive"}`}>
      {delta >= 0 ? "+" : ""}{fmtPct(delta)}
    </TableCell>
  );
}
