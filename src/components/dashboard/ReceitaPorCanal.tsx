import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CHANNEL_COLORS = [
  "hsl(204, 67%, 32%)",
  "hsl(152, 55%, 40%)",
  "hsl(38, 85%, 50%)",
  "hsl(0, 65%, 50%)",
  "hsl(270, 55%, 50%)",
  "hsl(190, 60%, 45%)",
  "hsl(330, 55%, 50%)",
  "hsl(60, 65%, 45%)",
  "hsl(100, 50%, 40%)",
  "hsl(220, 55%, 55%)",
  "hsl(15, 70%, 50%)",
  "hsl(175, 50%, 40%)",
  "hsl(290, 40%, 55%)",
  "hsl(45, 75%, 45%)",
  "hsl(240, 45%, 55%)",
];

interface CanalData {
  canal: string;
  mes: number;
  valor: number;
}

interface Props {
  clinicaId: string;
  ano: number;
  compact?: boolean;
}

export default function ReceitaPorCanal({ clinicaId, ano, compact = false }: Props) {
  const [data, setData] = useState<CanalData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicaId) return;
    fetchCanais();
  }, [clinicaId, ano]);

  const fetchCanais = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("receita_canal_mensal")
      .select("canal, mes, valor")
      .eq("clinica_id", clinicaId)
      .eq("ano", ano)
      .order("canal")
      .order("mes");

    if (!error && rows) {
      setData(rows as CanalData[]);
    }
    setLoading(false);
  };

  const { canais, months, canalTotals, monthTotals, grandTotal, chartData } = useMemo(() => {
    const canalSet = new Set<string>();
    const monthSet = new Set<number>();
    const map = new Map<string, Map<number, number>>();

    data.forEach((d) => {
      canalSet.add(d.canal);
      monthSet.add(d.mes);
      if (!map.has(d.canal)) map.set(d.canal, new Map());
      map.get(d.canal)!.set(d.mes, d.valor);
    });

    const canais = Array.from(canalSet).sort();
    const months = Array.from(monthSet).sort((a, b) => a - b);

    const canalTotals = new Map<string, number>();
    canais.forEach((c) => {
      const total = Array.from(map.get(c)?.values() || []).reduce((s, v) => s + v, 0);
      canalTotals.set(c, total);
    });

    // Sort canais by total descending
    canais.sort((a, b) => (canalTotals.get(b) || 0) - (canalTotals.get(a) || 0));

    const monthTotals = new Map<number, number>();
    months.forEach((m) => {
      let total = 0;
      canais.forEach((c) => { total += map.get(c)?.get(m) || 0; });
      monthTotals.set(m, total);
    });

    const grandTotal = Array.from(canalTotals.values()).reduce((s, v) => s + v, 0);

    const chartData = months.map((m) => {
      const entry: Record<string, any> = { name: MONTH_NAMES[m - 1] };
      canais.forEach((c) => { entry[c] = map.get(c)?.get(m) || 0; });
      return entry;
    });

    return { canais, months, canalTotals, monthTotals, grandTotal, chartData, map };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Sem dados de receita por canal para {ano}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stacked Bar Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Faturamento por Canal — {ano}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value), name]}
                  labelClassName="font-semibold"
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                {canais.map((canal, i) => (
                  <Bar
                    key={canal}
                    dataKey={canal}
                    stackId="a"
                    fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]}
                    radius={i === canais.length - 1 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Channel Table */}
      {!compact && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Receita por Canal — Detalhamento</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[180px]">Canal</TableHead>
                  {months.map((m) => (
                    <TableHead key={m} className="text-right min-w-[100px]">{MONTH_NAMES[m - 1]}</TableHead>
                  ))}
                  <TableHead className="text-right min-w-[120px] font-bold">Total</TableHead>
                  <TableHead className="text-right min-w-[60px]">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {canais.map((canal) => {
                  const total = canalTotals.get(canal) || 0;
                  const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                  return (
                    <TableRow key={canal}>
                      <TableCell className="sticky left-0 bg-card z-10 text-sm font-medium">{canal}</TableCell>
                      {months.map((m) => {
                        const val = (data as any[]).find((d: CanalData) => d.canal === canal && d.mes === m)?.valor || 0;
                        return (
                          <TableCell key={m} className="text-right text-sm">
                            {val > 0 ? fmt(val) : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right text-sm font-bold">{fmt(total)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold bg-accent/50">
                  <TableCell className="sticky left-0 bg-accent/50 z-10">TOTAL</TableCell>
                  {months.map((m) => (
                    <TableCell key={m} className="text-right">{fmt(monthTotals.get(m) || 0)}</TableCell>
                  ))}
                  <TableCell className="text-right">{fmt(grandTotal)}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
