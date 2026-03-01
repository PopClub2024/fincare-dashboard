import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart, Activity, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useDreKpis } from "@/hooks/useDreKpis";
import { useCashKpis } from "@/hooks/useCashKpis";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  accent?: "primary" | "secondary" | "success" | "warning" | "destructive";
}

function KpiCard({ title, value, subtitle, trend, icon, formula, fonte, accent = "primary" }: KpiCardProps) {
  const accentStyles: Record<string, string> = {
    primary: "from-primary/10 to-transparent border-primary/20",
    secondary: "from-secondary/10 to-transparent border-secondary/20",
    success: "from-emerald-500/10 to-transparent border-emerald-500/20",
    warning: "from-amber-500/10 to-transparent border-amber-500/20",
    destructive: "from-destructive/10 to-transparent border-destructive/20",
  };

  const iconStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className={cn(
          "overflow-hidden border bg-gradient-to-br shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
          accentStyles[accent]
        )}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
                <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
                {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className={cn("rounded-lg p-2", iconStyles[accent])}>{icon}</div>
                {trend !== undefined && (
                  <span className={cn(
                    "flex items-center gap-0.5 text-[11px] font-semibold",
                    trend >= 0 ? "text-emerald-600" : "text-destructive"
                  )}>
                    {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(trend).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            {fonte && (
              <Badge variant="outline" className="mt-2 h-5 border-border/50 text-[9px] font-medium">
                {fonte}
              </Badge>
            )}
          </CardContent>
        </Card>
      </TooltipTrigger>
      {formula && <TooltipContent className="max-w-xs"><p className="text-xs">{formula}</p></TooltipContent>}
    </Tooltip>
  );
}

function KpiSkeleton() {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </CardContent>
    </Card>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
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
      icon: <DollarSign className="h-4 w-4" />,
      formula: "RL = Receita Bruta − Descontos − Impostos",
      fonte,
      accent: "secondary",
    },
    {
      title: "EBITDA",
      value: fmt(dreCards?.mc || 0),
      subtitle: `MC ${mcPct}%`,
      icon: <BarChart3 className="h-4 w-4" />,
      formula: "EBITDA ≈ MC = RT − Impostos − Taxa Cartão − Repasses Médicos",
      fonte,
      accent: "primary",
    },
    {
      title: "Margem Líquida",
      value: `${dreCards?.resultado_pct || 0}%`,
      subtitle: fmt(dreCards?.resultado || 0),
      icon: <PieChart className="h-4 w-4" />,
      formula: "ML% = Resultado ÷ RT × 100",
      fonte,
      accent: (dreCards?.resultado || 0) >= 0 ? "success" : "destructive",
    },
    {
      title: "Ponto Equilíbrio",
      value: fmt(pe),
      subtitle: `MC ${mcPct}%`,
      icon: <Activity className="h-4 w-4" />,
      formula: "PE = CF ÷ MC%",
      fonte,
      accent: "warning",
    },
    {
      title: "Fluxo de Caixa",
      value: fmt(cashCards?.saldo_final || 0),
      subtitle: `E: ${fmt(cashCards?.entradas || 0)} | S: ${fmt(cashCards?.saidas || 0)}`,
      icon: <DollarSign className="h-4 w-4" />,
      formula: "Saldo = Saldo Inicial + Entradas − Saídas no período",
      fonte: cash?.has_bank_data ? "🏦 Banco" : cash?.has_live_data ? "📋 Live" : "📊 Histórico",
      accent: (cashCards?.saldo_final || 0) >= 0 ? "success" : "destructive",
    },
    {
      title: "Conciliação",
      value: `${cashCards?.pct_conciliacao || 0}%`,
      subtitle: cash?.has_bank_data ? `${fmt(cashCards?.entradas_conciliadas || 0)} conciliado` : "Importe extratos",
      icon: <CheckCircle2 className="h-4 w-4" />,
      formula: "% = Transações conciliadas ÷ Total × 100",
      accent: "secondary",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}
