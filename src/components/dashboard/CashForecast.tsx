import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, ComposedChart, Line } from "recharts";
import { useCashForecast } from "@/hooks/useCashForecast";
import { CalendarClock, ArrowUpRight, ArrowDownRight } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

export default function CashForecast({ dateFrom, dateTo }: Props) {
  const { data, loading } = useCashForecast(dateFrom, dateTo);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const { previsao_entradas, saidas_programadas, total_a_receber, total_particular, total_convenio, resumo_canal } = data;

  // Merge entradas + saidas for chart
  const weekMap = new Map<string, { label: string; entradas: number; saidas: number; particular: number; convenio: number }>();
  previsao_entradas.forEach((e) => {
    weekMap.set(e.semana, {
      label: e.semana_label,
      entradas: e.total,
      saidas: 0,
      particular: e.particular,
      convenio: e.convenio,
    });
  });
  saidas_programadas.forEach((s) => {
    const existing = weekMap.get(s.semana);
    if (existing) {
      existing.saidas = s.total;
    } else {
      weekMap.set(s.semana, { label: s.semana_label, entradas: 0, saidas: s.total, particular: 0, convenio: 0 });
    }
  });
  const chartData = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total a Receber</p>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-lg font-bold text-foreground">{fmt(total_a_receber)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Particular</p>
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-emerald-600">{fmt(total_particular)}</p>
            <p className="text-xs text-muted-foreground">D+1 / PIX imediato</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Convênio</p>
              <ArrowDownRight className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-lg font-bold text-amber-600">{fmt(total_convenio)}</p>
            <p className="text-xs text-muted-foreground">Prazo de repasse do convênio</p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Chart */}
      {chartData.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Projeção Semanal: Entradas vs Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="particular" name="Particular" fill="hsl(204, 67%, 32%)" stackId="ent" />
                  <Bar dataKey="convenio" name="Convênio" fill="hsl(152, 60%, 40%)" stackId="ent" radius={[4, 4, 0, 0]} />
                  <Line dataKey="saidas" name="Saídas Programadas" stroke="hsl(358, 74%, 44%)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalhe por Convênio */}
      {resumo_canal.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Previsão por Pagador</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pagador</TableHead>
                  <TableHead className="text-right">Prazo</TableHead>
                  <TableHead className="text-right">Faturado</TableHead>
                  <TableHead className="text-right">Recebido</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Consultas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo_canal.map((c) => (
                  <TableRow key={c.convenio}>
                    <TableCell className="font-medium">{c.convenio}</TableCell>
                    <TableCell className="text-right">{c.prazo_repasse_dias != null ? `${c.prazo_repasse_dias}d` : "D+1"}</TableCell>
                    <TableCell className="text-right">{fmt(c.total_faturado)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmt(c.recebido)}</TableCell>
                    <TableCell className="text-right text-amber-600">{fmt(c.pendente)}</TableCell>
                    <TableCell className="text-right">{c.qtd_consultas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
