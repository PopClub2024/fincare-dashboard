import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useConvenioKpis } from "@/hooks/useConvenioKpis";
import { DollarSign, FileText, AlertTriangle, TrendingUp, Percent, ArrowDownRight } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
  convenioId: string | null;
}

export default function ConvenioVisaoGeral({ dateFrom, dateTo, convenioId }: Props) {
  const { data, loading } = useConvenioKpis(dateFrom, dateTo, convenioId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const cards = data?.cards;
  const glosas = data?.glosas;
  const mensal = data?.mensal || [];
  const porConvenio = data?.por_convenio || [];

  const kpis = [
    { label: "Faturado (Feegow)", value: cards?.faturado_feegow, icon: DollarSign, color: "text-secondary" },
    { label: "Enviado (Manual)", value: cards?.enviado, icon: FileText, color: "text-foreground" },
    { label: "Liberado", value: cards?.liberado, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Glosa Real", value: glosas?.total_glosado, icon: AlertTriangle, color: "text-destructive" },
    { label: "% Glosa", value: glosas?.pct_glosa, icon: Percent, color: "text-destructive", isPercent: true },
    { label: "A Receber", value: cards?.a_receber, icon: ArrowDownRight, color: "text-secondary" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </p>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className={`text-lg font-bold ${kpi.color}`}>
                {kpi.isPercent
                  ? `${(kpi.value ?? 0).toFixed(1)}%`
                  : fmt(kpi.value ?? 0)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico mensal: faturado x enviado x liberado */}
      {mensal.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Faturado × Enviado × Liberado (mensal)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes_label" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="faturado" name="Faturado" fill="hsl(204, 67%, 32%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="enviado" name="Enviado" fill="hsl(210, 15%, 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="liberado" name="Liberado" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking por convênio */}
      {porConvenio.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Ranking por Convênio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Convênio</th>
                    <th className="pb-2 text-right font-medium">Prazo</th>
                    <th className="pb-2 text-right font-medium">Faturado</th>
                    <th className="pb-2 text-right font-medium">Enviado</th>
                    <th className="pb-2 text-right font-medium">Liberado</th>
                    <th className="pb-2 text-right font-medium">A Receber</th>
                    <th className="pb-2 text-right font-medium">NFs</th>
                  </tr>
                </thead>
                <tbody>
                  {porConvenio.map((c: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 font-medium">{c.convenio}</td>
                      <td className="py-2 text-right text-muted-foreground">{c.prazo_repasse_dias}d</td>
                      <td className="py-2 text-right">{fmt(c.faturado)}</td>
                      <td className="py-2 text-right">{fmt(c.enviado)}</td>
                      <td className="py-2 text-right text-emerald-600">{fmt(c.liberado)}</td>
                      <td className="py-2 text-right text-secondary font-medium">{fmt(c.a_receber)}</td>
                      <td className="py-2 text-right text-muted-foreground">{c.qtd_nfs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {mensal.length === 0 && porConvenio.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-semibold">Sem dados de faturamento</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre NFs na aba "Faturamento / NFs" ou sincronize dados do Feegow na aba "Produção".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
