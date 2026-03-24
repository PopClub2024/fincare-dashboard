import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RTooltip, Line, ComposedChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import EditRecordDialog, { FieldDef } from "@/components/admin/EditRecordDialog";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, Info, ChevronDown, ChevronRight, CalendarDays, ArrowLeftRight, Pencil,
} from "lucide-react";
import { format, subYears, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReceitaPorCanal from "@/components/dashboard/ReceitaPorCanal";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface DreMonth {
  mes: string;
  mes_label: string;
  rt: number;
  impostos: number;
  taxa_cartao: number;
  repasses: number;
  mc: number;
  mc_pct: number;
  cf: number;
  resultado: number;
  resultado_pct: number;
  receita_cartao: number;
  imposto_info: any;
  taxa_info: any;
}

interface DreCards {
  rt: number;
  impostos: number;
  taxa_cartao: number;
  repasses: number;
  mc: number;
  mc_pct: number;
  cf: number;
  resultado: number;
  resultado_pct: number;
}

interface DreData {
  cards: DreCards;
  mensal: DreMonth[];
}

function historicoToDreData(rows: any[]): DreData {
  const mensal: DreMonth[] = rows.map((r) => ({
    mes: `${r.ano}-${String(r.mes).padStart(2, "0")}`,
    mes_label: `${MONTH_NAMES[r.mes - 1]}/${String(r.ano).slice(2)}`,
    rt: Number(r.rt),
    impostos: Number(r.impostos),
    taxa_cartao: Number(r.taxa_cartao),
    repasses: Number(r.repasses),
    mc: Number(r.mc),
    mc_pct: Number(r.mc_pct),
    cf: Number(r.cf),
    resultado: Number(r.resultado),
    resultado_pct: Number(r.resultado_pct),
    receita_cartao: 0,
    imposto_info: r.regime_tributario ? { nome: r.regime_tributario } : {},
    taxa_info: {},
  }));

  const cards: DreCards = {
    rt: mensal.reduce((s, m) => s + m.rt, 0),
    impostos: mensal.reduce((s, m) => s + m.impostos, 0),
    taxa_cartao: mensal.reduce((s, m) => s + m.taxa_cartao, 0),
    repasses: mensal.reduce((s, m) => s + m.repasses, 0),
    mc: mensal.reduce((s, m) => s + m.mc, 0),
    mc_pct: 0,
    cf: mensal.reduce((s, m) => s + m.cf, 0),
    resultado: mensal.reduce((s, m) => s + m.resultado, 0),
    resultado_pct: 0,
  };
  const totalRt = cards.rt;
  cards.mc_pct = totalRt > 0 ? Math.round((cards.mc / totalRt) * 1000) / 10 : 0;
  cards.resultado_pct = totalRt > 0 ? Math.round((cards.resultado / totalRt) * 1000) / 10 : 0;

  return { cards, mensal };
}

async function fetchDreYear(clinicaId: string, year: number): Promise<DreData | null> {
  const { data: liveResult, error: liveError } = await supabase.rpc("get_dre", {
    _start_date: `${year}-01-01`,
    _end_date: `${year}-12-31`,
    _filtros: {},
  });

  if (!liveError && liveResult) {
    const live = liveResult as unknown as DreData;
    if (live.cards.rt > 0) return live;
  }

  const { data: histRows, error: histError } = await supabase
    .from("dre_historico_mensal")
    .select("*")
    .eq("clinica_id", clinicaId)
    .eq("ano", year)
    .order("mes");

  if (!histError && histRows && histRows.length > 0) {
    return historicoToDreData(histRows);
  }

  return liveResult ? (liveResult as unknown as DreData) : null;
}

const DRE_HIST_FIELDS: FieldDef[] = [
  { key: "rt", label: "Receita Bruta (RT)", type: "number" },
  { key: "impostos", label: "Impostos LP", type: "number" },
  { key: "taxa_cartao", label: "Taxa Cartão", type: "number" },
  { key: "repasses", label: "Repasses Médicos (CV)", type: "number" },
  { key: "mc", label: "Margem de Contribuição", type: "number" },
  { key: "mc_pct", label: "MC %", type: "number" },
  { key: "cf", label: "Custo Fixo", type: "number" },
  { key: "resultado", label: "Resultado", type: "number" },
  { key: "resultado_pct", label: "Resultado %", type: "number" },
];

export default function DRE() {
  const { clinicaId } = useAuth();
  const isAdmin = useIsAdmin();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [compareYear, setCompareYear] = useState(currentYear - 1);
  const [data, setData] = useState<DreData | null>(null);
  const [compareData, setCompareData] = useState<DreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Admin edit state
  const [histRecords, setHistRecords] = useState<any[]>([]);
  const [editingRecord, setEditingRecord] = useState<any>(null);

  useEffect(() => {
    if (!clinicaId) return;
    fetchBothYears();
  }, [clinicaId, year, compareYear]);

  const fetchBothYears = async () => {
    setLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        fetchDreYear(clinicaId!, year),
        fetchDreYear(clinicaId!, compareYear),
      ]);
      setData(res1);
      setCompareData(res2);
      
      // Also fetch raw historico records for admin editing
      if (isAdmin) {
        const { data: hist } = await supabase
          .from("dre_historico_mensal")
          .select("*")
          .eq("clinica_id", clinicaId!)
          .eq("ano", year)
          .order("mes");
        setHistRecords(hist || []);
      }
    } catch (e: any) {
      toast.error("Erro ao carregar DRE: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getHistRecordForMonth = (mesStr: string) => {
    const [y, m] = mesStr.split("-").map(Number);
    return histRecords.find((r) => r.ano === y && r.mes === m);
  };

  const monthlyComparison = useMemo(() => {
    if (!data?.mensal) return [];
    const compMap = new Map<number, DreMonth>();
    compareData?.mensal?.forEach((m) => {
      const monthIdx = parseInt(m.mes.split("-")[1]) - 1;
      compMap.set(monthIdx, m);
    });

    return data.mensal.map((m) => {
      const monthIdx = parseInt(m.mes.split("-")[1]) - 1;
      const prev = compMap.get(monthIdx);
      return {
        month: MONTH_NAMES[monthIdx],
        monthIdx,
        current: m,
        previous: prev || null,
      };
    });
  }, [data, compareData]);

  const chartData = useMemo(() => {
    return monthlyComparison.map((item) => ({
      name: item.month,
      [`RT ${year}`]: item.current.rt,
      [`RT ${compareYear}`]: item.previous?.rt || 0,
      [`Resultado ${year}`]: item.current.resultado,
      [`Resultado ${compareYear}`]: item.previous?.resultado || 0,
    }));
  }, [monthlyComparison, year, compareYear]);

  const momData = useMemo(() => {
    if (!data?.mensal || data.mensal.length < 2) return [];
    return data.mensal.map((m, i) => {
      const prev = i > 0 ? data.mensal[i - 1] : null;
      const rtVar = prev && prev.rt > 0 ? ((m.rt - prev.rt) / prev.rt) * 100 : 0;
      const mcVar = prev && prev.mc > 0 ? ((m.mc - prev.mc) / prev.mc) * 100 : 0;
      const resVar = prev && prev.resultado !== 0 ? ((m.resultado - prev.resultado) / Math.abs(prev.resultado)) * 100 : 0;
      return {
        mes: m.mes_label,
        rt: m.rt,
        rt_var: rtVar,
        mc: m.mc,
        mc_var: mcVar,
        mc_pct: m.mc_pct,
        resultado: m.resultado,
        resultado_var: resVar,
        resultado_pct: m.resultado_pct,
      };
    });
  }, [data]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">DRE — Demonstrativo de Resultado</h1>
            <p className="text-sm text-muted-foreground">Análise mensal e comparativo anual por competência</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <Select value={String(compareYear)} onValueChange={(v) => setCompareYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {data && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Receita Bruta" value={fmt(data.cards.rt)} prevValue={compareData ? fmt(compareData.cards.rt) : undefined} variation={compareData && compareData.cards.rt > 0 ? ((data.cards.rt - compareData.cards.rt) / compareData.cards.rt) * 100 : undefined} />
            <KpiCard label="Impostos" value={fmt(data.cards.impostos)} negative prevValue={compareData ? fmt(compareData.cards.impostos) : undefined} />
            <KpiCard label="Taxa Cartão" value={fmt(data.cards.taxa_cartao)} negative prevValue={compareData ? fmt(compareData.cards.taxa_cartao) : undefined} />
            <KpiCard label="Margem Contribuição" value={fmt(data.cards.mc)} subtitle={fmtPct(data.cards.mc_pct)} positive={data.cards.mc > 0} variation={compareData && compareData.cards.mc > 0 ? ((data.cards.mc - compareData.cards.mc) / compareData.cards.mc) * 100 : undefined} />
            <KpiCard label="Custo Fixo" value={fmt(data.cards.cf)} negative prevValue={compareData ? fmt(compareData.cards.cf) : undefined} />
            <KpiCard label="Resultado" value={fmt(data.cards.resultado)} subtitle={fmtPct(data.cards.resultado_pct)} positive={data.cards.resultado > 0} variation={compareData && compareData.cards.resultado !== 0 ? ((data.cards.resultado - compareData.cards.resultado) / Math.abs(compareData.cards.resultado)) * 100 : undefined} />
          </div>
        )}

        <Tabs defaultValue="mensal" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-muted">
            <TabsTrigger value="mensal">Análise Mensal</TabsTrigger>
            <TabsTrigger value="canais">Receita por Canal</TabsTrigger>
            <TabsTrigger value="mom">Mês a Mês</TabsTrigger>
            <TabsTrigger value="yoy">Comparativo Anual</TabsTrigger>
          </TabsList>

          {/* Tab: Análise Mensal */}
          <TabsContent value="mensal" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">DRE Mensal — {year}</CardTitle>
                  {isAdmin && histRecords.length > 0 && (
                    <Badge variant="outline" className="gap-1 text-xs"><Pencil className="h-3 w-3" />Clique no mês para editar</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">Indicador</TableHead>
                      {data?.mensal.map((m) => (
                        <TableHead key={m.mes} className="text-right min-w-[110px]">
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
                    {data && (
                      <>
                        <DreRow label="Receita Bruta (RT)" values={data.mensal.map((m) => m.rt)} total={data.cards.rt} bold />
                        <DreRow label="(-) Impostos LP" values={data.mensal.map((m) => m.impostos)} total={data.cards.impostos} negative expandable expanded={expandedRows.has("imp")} onToggle={() => toggleRow("imp")} />
                        {expandedRows.has("imp") && data.mensal.some((m) => m.imposto_info?.percentual || m.imposto_info?.nome) && (
                          <TableRow className="bg-muted/30">
                            <TableCell className="sticky left-0 bg-muted/30 z-10 pl-8 text-xs text-muted-foreground">
                              {data.mensal[0]?.imposto_info?.nome || "LP"} {data.mensal[0]?.imposto_info?.percentual ? `(${data.mensal[0].imposto_info.percentual}%)` : ""}
                            </TableCell>
                            {data.mensal.map((m) => (
                              <TableCell key={m.mes} className="text-right text-xs text-muted-foreground">
                                {m.imposto_info?.percentual ? `${m.imposto_info.percentual}%` : m.imposto_info?.nome || "⚠️"}
                              </TableCell>
                            ))}
                            <TableCell />
                          </TableRow>
                        )}
                        <DreRow label="(-) Taxa Cartão" values={data.mensal.map((m) => m.taxa_cartao)} total={data.cards.taxa_cartao} negative expandable expanded={expandedRows.has("taxa")} onToggle={() => toggleRow("taxa")} />
                        {expandedRows.has("taxa") && (
                          <TableRow className="bg-muted/30">
                            <TableCell className="sticky left-0 bg-muted/30 z-10 pl-8 text-xs text-muted-foreground">
                              {data.mensal[0]?.taxa_info?.nome || "Taxa"} {data.mensal[0]?.taxa_info?.percentual ? `(${data.mensal[0].taxa_info.percentual}%)` : ""}
                            </TableCell>
                            {data.mensal.map((m) => (
                              <TableCell key={m.mes} className="text-right text-xs text-muted-foreground">
                                {m.taxa_info?.percentual ? `${m.taxa_info.percentual}% s/ ${fmt(m.receita_cartao)}` : "—"}
                              </TableCell>
                            ))}
                            <TableCell />
                          </TableRow>
                        )}
                        <DreRow label="(-) Repasses Médicos (CV)" values={data.mensal.map((m) => m.repasses)} total={data.cards.repasses} negative />
                        <DreRow label="= Margem de Contribuição" values={data.mensal.map((m) => m.mc)} total={data.cards.mc} bold highlight />
                        <DreRow label="% MC sobre RT" values={data.mensal.map((m) => m.mc_pct)} total={data.cards.mc_pct} percentage />
                        <DreRow label="(-) Custo Fixo Total" values={data.mensal.map((m) => m.cf)} total={data.cards.cf} negative />
                        <DreRow label="= Resultado Líquido" values={data.mensal.map((m) => m.resultado)} total={data.cards.resultado} bold highlight />
                        <DreRow label="% Resultado sobre RT" values={data.mensal.map((m) => m.resultado_pct)} total={data.cards.resultado_pct} percentage />
                      </>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Receita por Canal */}
          <TabsContent value="canais" className="space-y-4">
            {clinicaId && <ReceitaPorCanal clinicaId={clinicaId} ano={year} />}
          </TabsContent>

          {/* Tab: Mês a Mês (MoM) */}
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
                      <RTooltip formatter={(value: number, name: string) => name.includes("%") || name.includes("var") ? fmtPct(value) : fmt(value)} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="rt" name="Receita Bruta" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.3} />
                      <Bar yAxisId="left" dataKey="resultado" name="Resultado" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" dataKey="mc_pct" name="MC %" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
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
                      <TableHead className="text-right">RT</TableHead>
                      <TableHead className="text-right">Var. RT</TableHead>
                      <TableHead className="text-right">MC</TableHead>
                      <TableHead className="text-right">MC %</TableHead>
                      <TableHead className="text-right">Var. MC</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                      <TableHead className="text-right">Res. %</TableHead>
                      <TableHead className="text-right">Var. Res.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {momData.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium">{m.mes}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(m.rt)}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${i === 0 ? "text-muted-foreground" : m.rt_var >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {i === 0 ? "—" : `${m.rt_var >= 0 ? "+" : ""}${fmtPct(m.rt_var)}`}
                        </TableCell>
                        <TableCell className="text-right text-sm">{fmt(m.mc)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtPct(m.mc_pct)}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${i === 0 ? "text-muted-foreground" : m.mc_var >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {i === 0 ? "—" : `${m.mc_var >= 0 ? "+" : ""}${fmtPct(m.mc_var)}`}
                        </TableCell>
                        <TableCell className={`text-right text-sm ${m.resultado >= 0 ? "" : "text-destructive"}`}>{fmt(m.resultado)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtPct(m.resultado_pct)}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${i === 0 ? "text-muted-foreground" : m.resultado_var >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {i === 0 ? "—" : `${m.resultado_var >= 0 ? "+" : ""}${fmtPct(m.resultado_var)}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Comparativo YoY */}
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
                      <Bar dataKey={`RT ${year}`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={`RT ${compareYear}`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.3} />
                      <Line dataKey={`Resultado ${year}`} stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                      <Line dataKey={`Resultado ${compareYear}`} stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} opacity={0.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader><CardTitle className="text-lg">DRE Comparativo por Linha</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[120px]">Mês</TableHead>
                      <TableHead className="text-right">RT {year}</TableHead>
                      <TableHead className="text-right">RT {compareYear}</TableHead>
                      <TableHead className="text-right">Δ RT</TableHead>
                      <TableHead className="text-right">MC {year}</TableHead>
                      <TableHead className="text-right">MC {compareYear}</TableHead>
                      <TableHead className="text-right">Δ MC</TableHead>
                      <TableHead className="text-right">Res. {year}</TableHead>
                      <TableHead className="text-right">Res. {compareYear}</TableHead>
                      <TableHead className="text-right">Δ Res.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyComparison.map((item) => {
                      const prevRt = item.previous?.rt || 0;
                      const prevMc = item.previous?.mc || 0;
                      const prevRes = item.previous?.resultado || 0;
                      const deltaRt = prevRt > 0 ? ((item.current.rt - prevRt) / prevRt) * 100 : 0;
                      const deltaMc = prevMc > 0 ? ((item.current.mc - prevMc) / prevMc) * 100 : 0;
                      const deltaRes = prevRes !== 0 ? ((item.current.resultado - prevRes) / Math.abs(prevRes)) * 100 : 0;

                      return (
                        <TableRow key={item.month}>
                          <TableCell className="sticky left-0 bg-card z-10 font-medium">{item.month}</TableCell>
                          <TableCell className="text-right text-sm">{item.current.rt > 0 ? fmt(item.current.rt) : "—"}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{prevRt > 0 ? fmt(prevRt) : "—"}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${!prevRt ? "text-muted-foreground" : deltaRt >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {!prevRt || !item.current.rt ? "—" : `${deltaRt >= 0 ? "+" : ""}${fmtPct(deltaRt)}`}
                          </TableCell>
                          <TableCell className="text-right text-sm">{item.current.mc !== 0 ? fmt(item.current.mc) : "—"}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{prevMc !== 0 ? fmt(prevMc) : "—"}</TableCell>
                          <TableCell className={`text-right text-sm font-medium ${!prevMc ? "text-muted-foreground" : deltaMc >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {!prevMc || !item.current.mc ? "—" : `${deltaMc >= 0 ? "+" : ""}${fmtPct(deltaMc)}`}
                          </TableCell>
                          <TableCell className={`text-right text-sm ${item.current.resultado < 0 ? "text-destructive" : ""}`}>
                            {item.current.rt > 0 ? fmt(item.current.resultado) : "—"}
                          </TableCell>
                          <TableCell className={`text-right text-sm text-muted-foreground ${prevRes < 0 ? "text-destructive/70" : ""}`}>
                            {prevRt > 0 ? fmt(prevRes) : "—"}
                          </TableCell>
                          <TableCell className={`text-right text-sm font-medium ${!prevRes ? "text-muted-foreground" : deltaRes >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {!prevRes || !item.current.rt ? "—" : `${deltaRes >= 0 ? "+" : ""}${fmtPct(deltaRes)}`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {data && compareData && (
                      <TableRow className="font-bold bg-accent/50">
                        <TableCell className="sticky left-0 bg-accent/50 z-10">TOTAL</TableCell>
                        <TableCell className="text-right">{fmt(data.cards.rt)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(compareData.cards.rt)}</TableCell>
                        <TableCell className={`text-right ${compareData.cards.rt > 0 ? (((data.cards.rt - compareData.cards.rt) / compareData.cards.rt) * 100 >= 0 ? "text-emerald-600" : "text-destructive") : ""}`}>
                          {compareData.cards.rt > 0 ? `${((data.cards.rt - compareData.cards.rt) / compareData.cards.rt * 100) >= 0 ? "+" : ""}${fmtPct((data.cards.rt - compareData.cards.rt) / compareData.cards.rt * 100)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">{fmt(data.cards.mc)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(compareData.cards.mc)}</TableCell>
                        <TableCell className={`text-right ${compareData.cards.mc > 0 ? (((data.cards.mc - compareData.cards.mc) / compareData.cards.mc) * 100 >= 0 ? "text-emerald-600" : "text-destructive") : ""}`}>
                          {compareData.cards.mc > 0 ? `${((data.cards.mc - compareData.cards.mc) / compareData.cards.mc * 100) >= 0 ? "+" : ""}${fmtPct((data.cards.mc - compareData.cards.mc) / compareData.cards.mc * 100)}` : "—"}
                        </TableCell>
                        <TableCell className={`text-right ${data.cards.resultado < 0 ? "text-destructive" : ""}`}>{fmt(data.cards.resultado)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(compareData.cards.resultado)}</TableCell>
                        <TableCell className={`text-right ${compareData.cards.resultado !== 0 ? (((data.cards.resultado - compareData.cards.resultado) / Math.abs(compareData.cards.resultado)) * 100 >= 0 ? "text-emerald-600" : "text-destructive") : ""}`}>
                          {compareData.cards.resultado !== 0 ? `${((data.cards.resultado - compareData.cards.resultado) / Math.abs(compareData.cards.resultado) * 100) >= 0 ? "+" : ""}${fmtPct((data.cards.resultado - compareData.cards.resultado) / Math.abs(compareData.cards.resultado) * 100)}` : "—"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Admin Edit Dialog */}
      {editingRecord && (
        <EditRecordDialog
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
          title={`DRE — ${MONTH_NAMES[editingRecord.mes - 1]}/${editingRecord.ano}`}
          table="dre_historico_mensal"
          recordId={editingRecord.id}
          fields={DRE_HIST_FIELDS}
          initialValues={editingRecord}
          onSaved={fetchBothYears}
        />
      )}
    </DashboardLayout>
  );
}

// ============ Sub-components ============

function KpiCard({ label, value, subtitle, prevValue, variation, positive, negative }: {
  label: string; value: string; subtitle?: string; prevValue?: string; variation?: number; positive?: boolean; negative?: boolean;
}) {
  const colorClass = positive ? "text-emerald-600" : negative ? "text-destructive" : "text-foreground";
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate mb-1">{label}</p>
        <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {variation !== undefined && variation !== 0 && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${variation >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {variation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {variation >= 0 ? "+" : ""}{fmtPct(variation)} YoY
          </div>
        )}
        {prevValue && !variation && (
          <p className="text-xs text-muted-foreground mt-1">Ant: {prevValue}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DreRow({ label, values, total, bold, negative, highlight, percentage, expandable, expanded, onToggle }: {
  label: string; values: number[]; total: number; bold?: boolean; negative?: boolean; highlight?: boolean; percentage?: boolean; expandable?: boolean; expanded?: boolean; onToggle?: () => void;
}) {
  const rowClass = highlight ? "bg-accent/50 font-semibold" : bold ? "font-semibold" : "";
  const formatValue = (v: number) => percentage ? fmtPct(v) : fmt(negative ? -Math.abs(v) : v);
  const valueColor = (v: number) => {
    if (percentage) return "";
    if (v < 0 || negative) return "text-destructive";
    return "";
  };

  return (
    <TableRow className={rowClass}>
      <TableCell className={`sticky left-0 bg-card z-10 ${highlight ? "bg-accent/50" : ""}`}>
        <div className="flex items-center gap-1">
          {expandable && (
            <button onClick={onToggle} className="p-0.5 hover:bg-muted rounded">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}
          <span className="text-sm">{label}</span>
        </div>
      </TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className={`text-right text-sm ${valueColor(v)}`}>
          {v === 0 && !percentage ? "—" : formatValue(v)}
        </TableCell>
      ))}
      <TableCell className={`text-right text-sm font-bold ${valueColor(total)}`}>
        {formatValue(total)}
      </TableCell>
    </TableRow>
  );
}
