import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useCashKpis } from "@/hooks/useCashKpis";
import { AlertTriangle, Clock, CheckCircle, DollarSign } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

interface ARByForma {
  forma_pagamento_enum: string | null;
  total: number;
  count: number;
}

interface ARByConvenio {
  convenio_nome: string | null;
  total: number;
  count: number;
}

export default function TabAR({ dateFrom, dateTo }: Props) {
  const { clinicaId } = useAuth();
  const { data: cashData, loading: cashLoading } = useCashKpis(dateFrom, dateTo);
  const [arByForma, setArByForma] = useState<ARByForma[]>([]);
  const [arByConvenio, setArByConvenio] = useState<ARByConvenio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicaId) return;
    fetchARDetails();
  }, [clinicaId, dateFrom, dateTo]);

  const fetchARDetails = async () => {
    setLoading(true);
    try {
      // AR by forma_pagamento
      const { data: vendas } = await supabase
        .from("transacoes_vendas")
        .select("forma_pagamento_enum, valor_bruto, convenio_id, data_prevista_recebimento")
        .eq("clinica_id", clinicaId!)
        .in("status_recebimento", ["a_receber", "inadimplente"])
        .lte("data_competencia", format(dateTo, "yyyy-MM-dd"));

      if (vendas) {
        // Group by forma_pagamento
        const byForma: Record<string, { total: number; count: number }> = {};
        vendas.forEach((v) => {
          const key = v.forma_pagamento_enum || "não informado";
          if (!byForma[key]) byForma[key] = { total: 0, count: 0 };
          byForma[key].total += Number(v.valor_bruto);
          byForma[key].count += 1;
        });
        setArByForma(
          Object.entries(byForma)
            .map(([k, v]) => ({ forma_pagamento_enum: k, ...v }))
            .sort((a, b) => b.total - a.total)
        );
      }

      // AR by convenio
      const { data: vendasConv } = await supabase
        .from("transacoes_vendas")
        .select("valor_bruto, convenio_id, convenios(nome)")
        .eq("clinica_id", clinicaId!)
        .in("status_recebimento", ["a_receber", "inadimplente"])
        .lte("data_competencia", format(dateTo, "yyyy-MM-dd"));

      if (vendasConv) {
        const byConv: Record<string, { total: number; count: number }> = {};
        vendasConv.forEach((v: any) => {
          const key = v.convenios?.nome || "Particular";
          if (!byConv[key]) byConv[key] = { total: 0, count: 0 };
          byConv[key].total += Number(v.valor_bruto);
          byConv[key].count += 1;
        });
        setArByConvenio(
          Object.entries(byConv)
            .map(([k, v]) => ({ convenio_nome: k, ...v }))
            .sort((a, b) => b.total - a.total)
        );
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || cashLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const cards = cashData?.cards;
  const aging = cashData?.aging;
  const hasAR = cards && cards.ar_total > 0;
  const hasAgingData = aging && Object.values(aging).some((v) => v > 0);

  const agingData = aging
    ? [
        { faixa: "0-7 dias", valor: aging["0_7"] || 0, color: "hsl(204, 67%, 32%)" },
        { faixa: "8-15 dias", valor: aging["8_15"] || 0, color: "hsl(204, 67%, 42%)" },
        { faixa: "16-30 dias", valor: aging["16_30"] || 0, color: "hsl(38, 92%, 50%)" },
        { faixa: "31-60 dias", valor: aging["31_60"] || 0, color: "hsl(38, 72%, 40%)" },
        { faixa: "61-90 dias", valor: aging["61_90"] || 0, color: "hsl(358, 74%, 54%)" },
        { faixa: "90+ dias", valor: aging["90_plus"] || 0, color: "hsl(358, 74%, 44%)" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AR Total</p>
              <div className="rounded-md bg-accent p-1.5"><DollarSign className="h-4 w-4" /></div>
            </div>
            <p className="text-lg font-bold text-foreground">{fmt(cards?.ar_total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AR Vencido</p>
              <div className="rounded-md bg-destructive/10 p-1.5"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
            </div>
            <p className="text-lg font-bold text-destructive">{fmt(cards?.ar_vencido ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AR a Vencer</p>
              <div className="rounded-md bg-emerald-100 p-1.5"><Clock className="h-4 w-4 text-emerald-600" /></div>
            </div>
            <p className="text-lg font-bold text-emerald-600">{fmt(cards?.ar_a_vencer ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {!hasAR && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-semibold">Sem valores a receber em aberto</p>
            <p className="text-sm text-muted-foreground mt-1">
              Registre vendas no sistema ou sincronize com o Feegow para visualizar contas a receber.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Aging Chart */}
      {hasAgingData && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Aging de Recebíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="faixa" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Bar dataKey="valor" name="Valor" radius={[4, 4, 0, 0]}>
                    {agingData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AR by Forma de Pagamento */}
      {arByForma.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">AR por Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arByForma.map((item) => (
                  <TableRow key={item.forma_pagamento_enum}>
                    <TableCell className="text-sm font-medium">{formatFormaPgto(item.forma_pagamento_enum)}</TableCell>
                    <TableCell className="text-right text-sm">{item.count}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(item.total)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {cards?.ar_total ? `${((item.total / cards.ar_total) * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* AR by Convênio */}
      {arByConvenio.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">AR por Convênio / Canal</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convênio</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arByConvenio.map((item) => (
                  <TableRow key={item.convenio_nome}>
                    <TableCell className="text-sm font-medium">{item.convenio_nome}</TableCell>
                    <TableCell className="text-right text-sm">{item.count}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(item.total)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {cards?.ar_total ? `${((item.total / cards.ar_total) * 100).toFixed(1)}%` : "—"}
                    </TableCell>
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

function formatFormaPgto(fp: string | null): string {
  const map: Record<string, string> = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    convenio_nf: "Convênio (NF)",
    cartao_credito: "Cartão de Crédito",
    cartao_debito: "Cartão de Débito",
    "não informado": "Não informado",
  };
  return map[fp || ""] || fp || "—";
}
