import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart, Activity, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDreKpis } from "@/hooks/useDreKpis";
import { useCashKpis } from "@/hooks/useCashKpis";
import { Badge } from "@/components/ui/badge";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  formula?: string;
  fonte?: string;
}

function KpiCard({ title, value, subtitle, trend, icon, formula, fonte }: KpiCardProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="border-0 shadow-md transition-shadow hover:shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="rounded-lg bg-accent p-2">{icon}</div>
                {trend !== undefined && (
                  <span className={`flex items-center text-xs font-medium ${trend >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {trend >= 0 ? <TrendingUp className="mr-0.5 h-3 w-3" /> : <TrendingDown className="mr-0.5 h-3 w-3" />}
                    {Math.abs(trend).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            {fonte && <Badge variant="outline" className="mt-2 text-[10px]">{fonte}</Badge>}
          </CardContent>
        </Card>
      </TooltipTrigger>
      {formula && <TooltipContent className="max-w-xs"><p className="text-xs">{formula}</p></TooltipContent>}
    </Tooltip>
  );
}

interface Props {
  dateFrom: Date;
  dateTo: Date;
}

export default function KpiCards({ dateFrom, dateTo }: Props) {
  const { data: dre, loading: dreLoading } = useDreKpis(dateFrom, dateTo);
  const { data: cash, loading: cashLoading } = useCashKpis(dateFrom, dateTo);

  const loading = dreLoading || cashLoading;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="h-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const dreCards = dre?.cards;
  const cashCards = cash?.cards;
  const fonte = dreCards?.fonte === "historico" ? "📊 Histórico" : undefined;

  const pe = dreCards?.pe || 0;
  const mcPct = dreCards?.mc_pct || 0;

  const kpis: KpiCardProps[] = [
    {
      title: "Receita Líquida",
      value: fmt(dreCards?.rt || 0),
      icon: <DollarSign className="h-4 w-4 text-secondary" />,
      formula: "RL = Receita Bruta − Descontos − Impostos",
      fonte,
    },
    {
      title: "EBITDA",
      value: fmt((dreCards?.mc || 0)),
      subtitle: `MC ${mcPct}%`,
      icon: <BarChart3 className="h-4 w-4 text-primary" />,
      formula: "EBITDA ≈ MC = RT − Impostos − Taxa Cartão − Repasses Médicos",
      fonte,
    },
    {
      title: "Margem Líquida",
      value: `${dreCards?.resultado_pct || 0}%`,
      subtitle: fmt(dreCards?.resultado || 0),
      icon: <PieChart className="h-4 w-4 text-secondary" />,
      formula: "ML% = Resultado ÷ RT × 100",
      fonte,
    },
    {
      title: "MC% / Ponto Equilíbrio",
      value: `${mcPct}% / ${fmt(pe)}`,
      icon: <Activity className="h-4 w-4 text-primary" />,
      formula: "MC% = (RT − CSV) ÷ RT × 100 | PE = CF ÷ MC%",
      fonte,
    },
    {
      title: "Fluxo de Caixa",
      value: fmt(cashCards?.saldo_final || 0),
      subtitle: `E: ${fmt(cashCards?.entradas || 0)} | S: ${fmt(cashCards?.saidas || 0)}`,
      icon: <DollarSign className="h-4 w-4 text-secondary" />,
      formula: "Saldo = Saldo Inicial + Entradas − Saídas no período",
      fonte: cash?.has_bank_data ? "🏦 Banco" : cash?.has_live_data ? "📋 Live" : "📊 Histórico",
    },
    {
      title: "Conciliação",
      value: `${cashCards?.pct_conciliacao || 0}%`,
      subtitle: cash?.has_bank_data ? `${fmt(cashCards?.entradas_conciliadas || 0)} conciliado` : "Importe extratos",
      icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
      formula: "% = Transações conciliadas ÷ Total de transações × 100",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}
