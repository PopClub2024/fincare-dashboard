import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, BarChart, Bar, Legend, ComposedChart, Line } from "recharts";
import { useCashKpis, CashKpisData } from "@/hooks/useCashKpis";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import CashForecast from "./CashForecast";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

export default function TabCaixa({ dateFrom, dateTo }: Props) {
  const { data, loading } = useCashKpis(dateFrom, dateTo);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data || data.mensal.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Sem dados de caixa disponíveis para o período.</p>;
  }

  const { cards, mensal, top_saidas } = data;

  const chartData = mensal.map((m) => ({
    name: m.mes_label,
    Entradas: m.entradas,
    Saídas: m.saidas,
    Saldo: m.saldo,
  }));

  const hasBreakdown = mensal.some((m) => m.mao_obra !== undefined);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CashCard label="Saldo Inicial" value={cards.saldo_inicial} icon={<DollarSign className="h-4 w-4" />} />
        <CashCard label="Total Entradas" value={cards.entradas} icon={<ArrowUpRight className="h-4 w-4" />} positive />
        <CashCard label="Total Saídas" value={cards.saidas} icon={<ArrowDownRight className="h-4 w-4" />} negative />
        <CashCard
          label="Saldo Final"
          value={cards.saldo_final}
          icon={cards.saldo_final >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          positive={cards.saldo_final > 0}
          negative={cards.saldo_final < 0}
        />
      </div>

      {!data.has_live_data && (
        <Badge variant="outline" className="text-xs">
          📊 Dados históricos (planilha consolidada)
        </Badge>
      )}

      {(data as any).has_bank_data && (
        <Badge variant="outline" className="text-xs">
          🏦 Dados reais do extrato bancário
        </Badge>
      )}

      {/* Cash Flow Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Fluxo de Caixa Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => fmt(value)} />
                <Legend />
                <Bar dataKey="Entradas" name="Entradas" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} opacity={0.8} />
                <Bar dataKey="Saídas" name="Saídas" fill="hsl(358, 74%, 44%)" radius={[4, 4, 0, 0]} opacity={0.8} />
                <Line dataKey="Saldo" name="Saldo Acum." stroke="hsl(204, 67%, 32%)" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Table */}
      {hasBreakdown && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Detalhamento Mensal por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">Categoria</TableHead>
                  {mensal.map((m) => (
                    <TableHead key={m.mes} className="text-right min-w-[110px]">{m.mes_label}</TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px] font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <BreakdownRow label="➕ Entradas Operacionais" values={mensal.map((m) => m.entradas_op ?? 0)} bold positive />
                <BreakdownRow label="➕ Recuperações Glosa" values={mensal.map((m) => m.recuperacoes ?? 0)} positive />
                <BreakdownRow label="➖ Mão de Obra" values={mensal.map((m) => m.mao_obra ?? 0)} negative />
                <BreakdownRow label="➖ Custos Variáveis" values={mensal.map((m) => m.custos_var ?? 0)} negative />
                <BreakdownRow label="➖ Custos Fixos" values={mensal.map((m) => m.custos_fix ?? 0)} negative />
                <BreakdownRow label="➖ Marketing" values={mensal.map((m) => m.marketing ?? 0)} negative />
                <BreakdownRow label="➖ Impostos" values={mensal.map((m) => m.impostos ?? 0)} negative />
                <BreakdownRow label="➖ Empréstimos" values={mensal.map((m) => m.emprestimos ?? 0)} negative />
                <BreakdownRow label="= Saldo Operacional" values={mensal.map((m) => m.saldo_op ?? 0)} bold />
                <BreakdownRow label="➕ Aporte" values={mensal.map((m) => m.aporte ?? 0)} positive />
                <BreakdownRow label="➖ Retirada" values={mensal.map((m) => m.retirada ?? 0)} negative />
                <BreakdownRow label="= Saldo Final" values={mensal.map((m) => m.saldo_final ?? m.saldo)} bold highlight />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Top Saídas */}
      {top_saidas && top_saidas.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Top Saídas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top_saidas.map((s) => ({ name: s.categoria || "Sem categoria", total: s.total }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" className="text-xs" width={180} />
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Bar dataKey="total" name="Total" fill="hsl(358, 74%, 44%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Forecast */}
      <Separator />
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">📈 Previsão de Caixa</h3>
        <CashForecast dateFrom={dateFrom} dateTo={dateTo} />
      </div>
    </div>
  );
}

function CashCard({ label, value, icon, positive, negative }: {
  label: string; value: number; icon: React.ReactNode; positive?: boolean; negative?: boolean;
}) {
  const colorClass = positive ? "text-emerald-600" : negative ? "text-destructive" : "text-foreground";
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <div className="rounded-md bg-accent p-1.5">{icon}</div>
        </div>
        <p className={`text-lg font-bold ${colorClass}`}>{fmt(value)}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ label, values, bold, positive, negative, highlight }: {
  label: string; values: number[]; bold?: boolean; positive?: boolean; negative?: boolean; highlight?: boolean;
}) {
  const total = values.reduce((s, v) => s + v, 0);
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
