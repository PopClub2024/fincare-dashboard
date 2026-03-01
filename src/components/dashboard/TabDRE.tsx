import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RTooltip, Line, ComposedChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, Info, ChevronDown, ChevronRight, FileSpreadsheet,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import ReceitaPorCanal from "@/components/dashboard/ReceitaPorCanal";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

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

interface Props {
  dateFrom: Date;
  dateTo: Date;
  filtros?: Record<string, string>;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const EMPTY_FILTROS: Record<string, string> = {};

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

export default function TabDRE({ dateFrom, dateTo, filtros = EMPTY_FILTROS }: Props) {
  const { clinicaId } = useAuth();
  const [data, setData] = useState<DreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [compareValues, setCompareValues] = useState<Record<string, string>>({});
  const [compareMonth, setCompareMonth] = useState("");

  const year = dateFrom.getFullYear();

  useEffect(() => {
    if (!clinicaId) return;
    fetchDre();
  }, [clinicaId, dateFrom, dateTo, filtros]);

  const fetchDre = async () => {
    setLoading(true);
    try {
      // Try live data first
      const { data: result, error } = await supabase.rpc("get_dre", {
        _start_date: format(dateFrom, "yyyy-MM-dd"),
        _end_date: format(dateTo, "yyyy-MM-dd"),
        _filtros: filtros,
      });
      if (error) throw error;
      const live = result as unknown as DreData;

      if (live.cards.rt > 0) {
        setData(live);
      } else {
        // Fallback to historical
        const startYear = dateFrom.getFullYear();
        const startMonth = dateFrom.getMonth() + 1;
        const endYear = dateTo.getFullYear();
        const endMonth = dateTo.getMonth() + 1;

        const { data: histRows } = await supabase
          .from("dre_historico_mensal")
          .select("*")
          .eq("clinica_id", clinicaId)
          .gte("ano", startYear)
          .lte("ano", endYear)
          .order("ano")
          .order("mes");

        if (histRows && histRows.length > 0) {
          setData(historicoToDreData(histRows));
        } else {
          setData(live);
        }
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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const chartData = useMemo(() => {
    if (!data?.mensal) return [];
    return data.mensal.map((m) => ({
      name: m.mes_label,
      RT: m.rt,
      MC: m.mc,
      Resultado: m.resultado,
    }));
  }, [data]);

  const compareDeltas = useMemo(() => {
    if (!compareMonth || !data?.mensal) return null;
    const month = data.mensal.find((m) => m.mes === compareMonth);
    if (!month) return null;

    const lines = [
      { key: "rt", label: "Receita Bruta", sistema: month.rt },
      { key: "impostos", label: "Impostos", sistema: month.impostos },
      { key: "taxa_cartao", label: "Taxa Cartão", sistema: month.taxa_cartao },
      { key: "repasses", label: "Repasses Médicos", sistema: month.repasses },
      { key: "cf", label: "Custo Fixo", sistema: month.cf },
    ];
    return lines.map((l) => {
      const planilha = parseFloat(compareValues[l.key] || "0");
      const delta = l.sistema - planilha;
      const deltaPct = planilha !== 0 ? (delta / planilha) * 100 : 0;
      return { ...l, planilha, delta, deltaPct };
    });
  }, [compareMonth, compareValues, data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground p-4">Sem dados disponíveis.</p>;

  const { cards, mensal } = data;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KpiMini label="Receita Bruta" value={fmt(cards.rt)} icon={<DollarSign className="h-4 w-4" />} formula="RT = Σ transacoes_vendas.valor_bruto no período" />
        <KpiMini label="Impostos LP" value={fmt(cards.impostos)} icon={<TrendingDown className="h-4 w-4" />} negative formula="Impostos = RT × alíquota LP vigente no mês" />
        <KpiMini label="Taxa Cartão" value={fmt(cards.taxa_cartao)} icon={<TrendingDown className="h-4 w-4" />} negative formula="Taxa = Receita_cartão × alíquota vigente" />
        <KpiMini label="Margem Contribuição" value={fmt(cards.mc)} subtitle={fmtPct(cards.mc_pct)} icon={<BarChart3 className="h-4 w-4" />} formula="MC = RT - Impostos - Taxa - Repasses | MC% = MC/RT×100" positive={cards.mc > 0} />
        <KpiMini label="Custo Fixo" value={fmt(cards.cf)} icon={<TrendingDown className="h-4 w-4" />} negative formula="CF = Σ lançamentos mapeados como custo_fixo" />
        <KpiMini label="Resultado" value={fmt(cards.resultado)} subtitle={fmtPct(cards.resultado_pct)} icon={cards.resultado >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} positive={cards.resultado > 0} formula="Resultado = MC - CF | %Resultado = Resultado/RT×100" />
      </div>

      {/* Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">DRE Mensal — Evolução</CardTitle>
          <Dialog open={showCompare} onOpenChange={setShowCompare}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Comparar com Planilha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Comparar com Planilha</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Mês</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={compareMonth} onChange={(e) => setCompareMonth(e.target.value)}>
                    <option value="">Selecione...</option>
                    {mensal.map((m) => <option key={m.mes} value={m.mes}>{m.mes_label}</option>)}
                  </select>
                </div>
                {["rt", "impostos", "taxa_cartao", "repasses", "cf"].map((key) => (
                  <div key={key} className="space-y-1">
                    <Label className="capitalize">{key === "rt" ? "Receita Bruta" : key === "taxa_cartao" ? "Taxa Cartão" : key === "cf" ? "Custo Fixo" : key === "impostos" ? "Impostos" : "Repasses Médicos"}</Label>
                    <Input type="number" placeholder="Valor da planilha" value={compareValues[key] || ""} onChange={(e) => setCompareValues({ ...compareValues, [key]: e.target.value })} />
                  </div>
                ))}
                {compareDeltas && (
                  <div className="mt-4 rounded-lg border p-3">
                    <p className="text-sm font-semibold mb-2">Resultado da Comparação</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Linha</TableHead>
                          <TableHead className="text-right">Sistema</TableHead>
                          <TableHead className="text-right">Planilha</TableHead>
                          <TableHead className="text-right">Delta</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compareDeltas.map((d) => (
                          <TableRow key={d.key}>
                            <TableCell className="text-sm">{d.label}</TableCell>
                            <TableCell className="text-right text-sm">{fmt(d.sistema)}</TableCell>
                            <TableCell className="text-right text-sm">{fmt(d.planilha)}</TableCell>
                            <TableCell className={`text-right text-sm font-medium ${Math.abs(d.deltaPct) > 0.5 ? "text-destructive" : "text-emerald-600"}`}>{fmt(d.delta)}</TableCell>
                            <TableCell className={`text-right text-sm ${Math.abs(d.deltaPct) > 0.5 ? "text-destructive" : "text-emerald-600"}`}>{fmtPct(d.deltaPct)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-2">✅ Aceito se delta ≤ 0,5% ou ≤ R$ 1,00</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip formatter={(value: number) => fmt(value)} />
                <Legend />
                <Bar dataKey="RT" name="Receita Bruta" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.3} />
                <Bar dataKey="MC" name="Margem Contrib." fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                <Line dataKey="Resultado" name="Resultado" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* DRE Table */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">Demonstrativo de Resultado (DRE)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[220px]">Indicador</TableHead>
                {mensal.map((m) => <TableHead key={m.mes} className="text-right min-w-[120px]">{m.mes_label}</TableHead>)}
                <TableHead className="text-right min-w-[130px] font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* RT */}
              <DreTableRow label="Receita Bruta (RT)" values={mensal.map((m) => m.rt)} total={cards.rt} bold />

              {/* Impostos - expandível */}
              <DreTableRow label="(-) Impostos LP" values={mensal.map((m) => m.impostos)} total={cards.impostos} negative expandable expanded={expandedRows.has("impostos")} onToggle={() => toggleRow("impostos")} />
              {expandedRows.has("impostos") && mensal.some((m) => m.imposto_info?.percentual) && (
                <TableRow className="bg-muted/30">
                  <TableCell className="sticky left-0 bg-muted/30 z-10 pl-8 text-xs text-muted-foreground">
                    {mensal[0]?.imposto_info?.nome || "LP"} ({mensal[0]?.imposto_info?.percentual}% desde {mensal[0]?.imposto_info?.vigente_de})
                  </TableCell>
                  {mensal.map((m) => (
                    <TableCell key={m.mes} className="text-right text-xs text-muted-foreground">
                      {m.imposto_info?.percentual ? `${m.imposto_info.percentual}%` : m.imposto_info?.alerta ? "⚠️" : "—"}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              )}

              {/* Taxa Cartão - expandível */}
              <DreTableRow label="(-) Taxa Cartão" values={mensal.map((m) => m.taxa_cartao)} total={cards.taxa_cartao} negative expandable expanded={expandedRows.has("taxa")} onToggle={() => toggleRow("taxa")} />
              {expandedRows.has("taxa") && (
                <TableRow className="bg-muted/30">
                  <TableCell className="sticky left-0 bg-muted/30 z-10 pl-8 text-xs text-muted-foreground">
                    {mensal[0]?.taxa_info?.nome || "Taxa"} ({mensal[0]?.taxa_info?.percentual}% s/ receita cartão)
                  </TableCell>
                  {mensal.map((m) => (
                    <TableCell key={m.mes} className="text-right text-xs text-muted-foreground">
                      {m.taxa_info?.percentual ? `${m.taxa_info.percentual}% s/ ${fmt(m.receita_cartao)}` : "—"}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              )}

              {/* Repasses */}
              <DreTableRow label="(-) Repasses Médicos (CV)" values={mensal.map((m) => m.repasses)} total={cards.repasses} negative />

              {/* MC */}
              <DreTableRow label="= Margem de Contribuição" values={mensal.map((m) => m.mc)} total={cards.mc} bold highlight />
              <DreTableRow label="% MC sobre RT" values={mensal.map((m) => m.mc_pct)} total={cards.mc_pct} percentage />

              {/* CF */}
              <DreTableRow label="(-) Custo Fixo Total" values={mensal.map((m) => m.cf)} total={cards.cf} negative />

              {/* Resultado */}
              <DreTableRow label="= Resultado Líquido" values={mensal.map((m) => m.resultado)} total={cards.resultado} bold highlight />
              <DreTableRow label="% Resultado sobre RT" values={mensal.map((m) => m.resultado_pct)} total={cards.resultado_pct} percentage />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Receita por Canal */}
      {clinicaId && <ReceitaPorCanal clinicaId={clinicaId} ano={year} compact />}
    </div>
  );
}

// ===================== Sub-components =====================

function KpiMini({ label, value, subtitle, icon, formula, positive, negative }: {
  label: string; value: string; subtitle?: string; icon: React.ReactNode; formula?: string; positive?: boolean; negative?: boolean;
}) {
  const colorClass = positive ? "text-emerald-600" : negative ? "text-destructive" : "text-foreground";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</p>
              <div className="rounded-md bg-accent p-1.5">{icon}</div>
            </div>
            <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </CardContent>
        </Card>
      </TooltipTrigger>
      {formula && (
        <TooltipContent className="max-w-xs">
          <div className="flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <p className="text-xs">{formula}</p>
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

function DreTableRow({ label, values, total, bold, negative, highlight, percentage, expandable, expanded, onToggle }: {
  label: string; values: number[]; total: number; bold?: boolean; negative?: boolean; highlight?: boolean; percentage?: boolean; expandable?: boolean; expanded?: boolean; onToggle?: () => void;
}) {
  const rowClass = highlight ? "bg-accent/50 font-semibold" : bold ? "font-semibold" : "";
  const formatValue = (v: number) => {
    if (percentage) return fmtPct(v);
    return fmt(negative ? -Math.abs(v) : v);
  };
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
