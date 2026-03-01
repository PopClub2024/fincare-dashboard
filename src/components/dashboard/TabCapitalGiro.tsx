import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useCashKpis } from "@/hooks/useCashKpis";
import { AlertTriangle, CheckCircle, DollarSign, TrendingUp, TrendingDown } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

export default function TabCapitalGiro({ dateFrom, dateTo }: Props) {
  const { data, loading } = useCashKpis(dateFrom, dateTo);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground p-4">Sem dados disponíveis.</p>;

  const { cards, aging } = data;
  const ncgPositive = cards.ncg >= 0;

  const agingData = [
    { faixa: "0-7d", valor: aging["0_7"] || 0 },
    { faixa: "8-15d", valor: aging["8_15"] || 0 },
    { faixa: "16-30d", valor: aging["16_30"] || 0 },
    { faixa: "31-60d", valor: aging["31_60"] || 0 },
    { faixa: "61-90d", valor: aging["61_90"] || 0 },
    { faixa: "90+d", valor: aging["90_plus"] || 0 },
  ];

  const hasAgingData = agingData.some((d) => d.valor > 0);

  const compositionData = [
    { name: "Caixa", valor: cards.saldo_final },
    { name: "AR", valor: cards.ar_total },
    { name: "AP", valor: -cards.ap_total },
    { name: "Capital Giro", valor: cards.capital_giro },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CapitalCard label="Contas a Receber (AR)" value={cards.ar_total} icon={<TrendingUp className="h-4 w-4" />} positive />
        <CapitalCard label="Contas a Pagar (AP)" value={cards.ap_total} icon={<TrendingDown className="h-4 w-4" />} negative />
        <CapitalCard
          label="NCG"
          value={cards.ncg}
          icon={ncgPositive ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          positive={ncgPositive}
          negative={!ncgPositive}
          subtitle={ncgPositive ? "Necessidade positiva" : "⚠️ Necessidade negativa"}
        />
        <CapitalCard
          label="Capital de Giro"
          value={cards.capital_giro}
          icon={<DollarSign className="h-4 w-4" />}
          positive={cards.capital_giro > 0}
          negative={cards.capital_giro < 0}
          subtitle="Caixa + AR - AP"
        />
      </div>

      {/* NCG Risk Indicator */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            {ncgPositive ? (
              <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle className="h-3 w-3 mr-1" /> NCG Positiva
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" /> NCG Negativa — Atenção
              </Badge>
            )}
            <p className="text-sm text-muted-foreground">
              {ncgPositive
                ? "A clínica tem mais a receber do que a pagar. Capital de giro saudável."
                : "A clínica tem mais obrigações do que recebíveis. Avaliar necessidade de capital."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Composition Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Composição do Capital de Giro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compositionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => fmt(value)} />
                <Bar dataKey="valor" name="Valor" radius={[4, 4, 0, 0]}>
                  {compositionData.map((entry, index) => (
                    <Cell key={index} fill={entry.valor >= 0 ? "hsl(152, 60%, 40%)" : "hsl(358, 74%, 44%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Aging */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Aging de Recebíveis</CardTitle>
        </CardHeader>
        <CardContent>
          {hasAgingData ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="faixa" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Bar dataKey="valor" name="Valor" fill="hsl(204, 67%, 32%)" radius={[4, 4, 0, 0]}>
                    {agingData.map((entry, index) => (
                      <Cell key={index} fill={index >= 4 ? "hsl(358, 74%, 44%)" : index >= 2 ? "hsl(38, 92%, 50%)" : "hsl(204, 67%, 32%)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sem dados de aging disponíveis. Configure prazos de recebimento e registre vendas para visualizar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AR Vencido</p>
            <p className="mt-1 text-2xl font-bold text-destructive">{fmt(cards.ar_vencido)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cards.ar_total > 0 ? `${((cards.ar_vencido / cards.ar_total) * 100).toFixed(1)}% do total` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AR a Vencer</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{fmt(cards.ar_a_vencer)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saldo de Caixa</p>
            <p className={`mt-1 text-2xl font-bold ${cards.saldo_final >= 0 ? "text-foreground" : "text-destructive"}`}>
              {fmt(cards.saldo_final)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CapitalCard({ label, value, icon, positive, negative, subtitle }: {
  label: string; value: number; icon: React.ReactNode; positive?: boolean; negative?: boolean; subtitle?: string;
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
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
