import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, Line, ComposedChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval } from "date-fns";
import { toast } from "sonner";
import { Calendar, DollarSign, CreditCard, Banknote, Landmark } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

type Granularity = "diario" | "semanal" | "mensal";

interface VendaCaixa {
  data_competencia: string;
  valor_bruto: number;
  forma_pagamento_enum: string | null;
  status_recebimento: string;
  convenio_id: string | null;
}

interface CaixaPeriodo {
  label: string;
  key: string;
  dinheiro: number;
  pix: number;
  cartao_credito: number;
  cartao_debito: number;
  convenio: number;
  outros: number;
  total: number;
}

export default function CaixaDiaria({ dateFrom, dateTo }: Props) {
  const { clinicaId } = useAuth();
  const [vendas, setVendas] = useState<VendaCaixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>("diario");

  useEffect(() => {
    if (!clinicaId) return;
    setLoading(true);
    supabase
      .from("transacoes_vendas")
      .select("data_competencia, valor_bruto, forma_pagamento_enum, status_recebimento, convenio_id")
      .eq("clinica_id", clinicaId)
      .gte("data_competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("data_competencia", format(dateTo, "yyyy-MM-dd"))
      .order("data_competencia", { ascending: true })
      .limit(5000)
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setVendas((data as unknown as VendaCaixa[]) || []);
        setLoading(false);
      });
  }, [clinicaId, dateFrom, dateTo]);

  const periodos = useMemo((): CaixaPeriodo[] => {
    if (vendas.length === 0) return [];

    const groupBy = (key: string, v: VendaCaixa) => {
      if (granularity === "diario") return v.data_competencia;
      if (granularity === "semanal") {
        const d = new Date(v.data_competencia + "T12:00:00");
        const ws = startOfWeek(d, { weekStartsOn: 1 });
        return format(ws, "yyyy-MM-dd");
      }
      return v.data_competencia.substring(0, 7);
    };

    const formatLabel = (key: string) => {
      if (granularity === "diario") {
        const d = new Date(key + "T12:00:00");
        return format(d, "dd/MM");
      }
      if (granularity === "semanal") {
        const ws = new Date(key + "T12:00:00");
        const we = endOfWeek(ws, { weekStartsOn: 1 });
        return `${format(ws, "dd/MM")} - ${format(we, "dd/MM")}`;
      }
      const [y, m] = key.split("-");
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return `${months[parseInt(m) - 1]}/${y.slice(2)}`;
    };

    const map = new Map<string, Omit<CaixaPeriodo, "label" | "key">>();
    vendas.forEach((v) => {
      const k = groupBy(v.data_competencia, v);
      const e = map.get(k) || { dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0, convenio: 0, outros: 0, total: 0 };
      e.total += v.valor_bruto;

      if (v.convenio_id) {
        e.convenio += v.valor_bruto;
      } else {
        switch (v.forma_pagamento_enum) {
          case "dinheiro": e.dinheiro += v.valor_bruto; break;
          case "pix": e.pix += v.valor_bruto; break;
          case "cartao_credito": e.cartao_credito += v.valor_bruto; break;
          case "cartao_debito": e.cartao_debito += v.valor_bruto; break;
          default: e.outros += v.valor_bruto; break;
        }
      }
      map.set(k, e);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, label: formatLabel(key), ...v }));
  }, [vendas, granularity]);

  const totals = useMemo(() => {
    return periodos.reduce((acc, p) => ({
      dinheiro: acc.dinheiro + p.dinheiro,
      pix: acc.pix + p.pix,
      cartao_credito: acc.cartao_credito + p.cartao_credito,
      cartao_debito: acc.cartao_debito + p.cartao_debito,
      convenio: acc.convenio + p.convenio,
      outros: acc.outros + p.outros,
      total: acc.total + p.total,
    }), { dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0, convenio: 0, outros: 0, total: 0 });
  }, [periodos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (vendas.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sem dados de caixa Feegow no período.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-base font-semibold">Caixa Feegow</h4>
          <Badge variant="outline" className="text-xs">Integrado</Badge>
        </div>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="diario">Diário</SelectItem>
            <SelectItem value="semanal">Semanal</SelectItem>
            <SelectItem value="mensal">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        <MiniCard icon={<DollarSign className="h-3.5 w-3.5" />} label="Total" value={fmt(totals.total)} />
        <MiniCard icon={<Banknote className="h-3.5 w-3.5" />} label="Dinheiro" value={fmt(totals.dinheiro)} />
        <MiniCard icon={<Landmark className="h-3.5 w-3.5" />} label="PIX" value={fmt(totals.pix)} />
        <MiniCard icon={<CreditCard className="h-3.5 w-3.5" />} label="Créd." value={fmt(totals.cartao_credito)} />
        <MiniCard icon={<CreditCard className="h-3.5 w-3.5" />} label="Déb." value={fmt(totals.cartao_debito)} />
        <MiniCard icon={<Landmark className="h-3.5 w-3.5" />} label="Convênio" value={fmt(totals.convenio)} />
        <MiniCard icon={<DollarSign className="h-3.5 w-3.5" />} label="Outros" value={fmt(totals.outros)} />
      </div>

      {/* Chart */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={periodos}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs" angle={granularity === "diario" ? -45 : 0} textAnchor={granularity === "diario" ? "end" : "middle"} height={granularity === "diario" ? 60 : 30} />
                <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="dinheiro" name="Dinheiro" fill="hsl(152, 60%, 40%)" stackId="a" />
                <Bar dataKey="pix" name="PIX" fill="hsl(180, 50%, 40%)" stackId="a" />
                <Bar dataKey="cartao_credito" name="Cartão Créd." fill="hsl(204, 67%, 32%)" stackId="a" />
                <Bar dataKey="cartao_debito" name="Cartão Déb." fill="hsl(204, 67%, 52%)" stackId="a" />
                <Bar dataKey="convenio" name="Convênio" fill="hsl(38, 92%, 50%)" stackId="a" radius={[4, 4, 0, 0]} />
                <Line dataKey="total" name="Total" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10">Período</TableHead>
                <TableHead className="text-right">Dinheiro</TableHead>
                <TableHead className="text-right">PIX</TableHead>
                <TableHead className="text-right">Créd.</TableHead>
                <TableHead className="text-right">Déb.</TableHead>
                <TableHead className="text-right">Convênio</TableHead>
                <TableHead className="text-right">Outros</TableHead>
                <TableHead className="text-right font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodos.map((p) => (
                <TableRow key={p.key}>
                  <TableCell className="sticky left-0 bg-card z-10 font-medium whitespace-nowrap">{p.label}</TableCell>
                  <TableCell className="text-right text-sm">{p.dinheiro > 0 ? fmt(p.dinheiro) : "—"}</TableCell>
                  <TableCell className="text-right text-sm">{p.pix > 0 ? fmt(p.pix) : "—"}</TableCell>
                  <TableCell className="text-right text-sm">{p.cartao_credito > 0 ? fmt(p.cartao_credito) : "—"}</TableCell>
                  <TableCell className="text-right text-sm">{p.cartao_debito > 0 ? fmt(p.cartao_debito) : "—"}</TableCell>
                  <TableCell className="text-right text-sm">{p.convenio > 0 ? fmt(p.convenio) : "—"}</TableCell>
                  <TableCell className="text-right text-sm">{p.outros > 0 ? fmt(p.outros) : "—"}</TableCell>
                  <TableCell className="text-right text-sm font-bold">{fmt(p.total)}</TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell className="sticky left-0 bg-muted/50 z-10 font-bold">TOTAL</TableCell>
                <TableCell className="text-right">{fmt(totals.dinheiro)}</TableCell>
                <TableCell className="text-right">{fmt(totals.pix)}</TableCell>
                <TableCell className="text-right">{fmt(totals.cartao_credito)}</TableCell>
                <TableCell className="text-right">{fmt(totals.cartao_debito)}</TableCell>
                <TableCell className="text-right">{fmt(totals.convenio)}</TableCell>
                <TableCell className="text-right">{fmt(totals.outros)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totals.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="text-muted-foreground">{icon}</div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <p className="text-sm font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
