import { TrendingUp, TrendingDown, DollarSign, BarChart3, PieChart, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  formula?: string;
}

function KpiCard({ title, value, subtitle, trend, icon, formula }: KpiCardProps) {
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
                  <span className={`flex items-center text-xs font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {trend >= 0 ? <TrendingUp className="mr-0.5 h-3 w-3" /> : <TrendingDown className="mr-0.5 h-3 w-3" />}
                    {Math.abs(trend).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TooltipTrigger>
      {formula && <TooltipContent className="max-w-xs"><p className="text-xs">{formula}</p></TooltipContent>}
    </Tooltip>
  );
}

export default function KpiCards() {
  const kpis: KpiCardProps[] = [
    { title: "Receita Líquida", value: "R$ 0,00", icon: <DollarSign className="h-4 w-4 text-secondary" />, formula: "RL = Receita Bruta − Descontos − Impostos" },
    { title: "EBITDA", value: "R$ 0,00", icon: <BarChart3 className="h-4 w-4 text-primary" />, formula: "EBITDA = RL − CSV − Custos Variáveis − Custos Fixos + Depreciação/Amortização" },
    { title: "Margem Líquida", value: "0%", icon: <PieChart className="h-4 w-4 text-secondary" />, formula: "ML% = Lucro Líquido ÷ RL × 100" },
    { title: "MC% / Ponto Equilíbrio", value: "0% / R$ 0", icon: <Activity className="h-4 w-4 text-primary" />, formula: "MC% = (RL − CSV) ÷ RL × 100 | PE = CF ÷ MC%" },
    { title: "Fluxo de Caixa", value: "R$ 0,00", icon: <DollarSign className="h-4 w-4 text-secondary" />, formula: "Saldo = Entradas − Saídas no período" },
    { title: "Conciliação", value: "0%", icon: <Activity className="h-4 w-4 text-primary" />, formula: "% = Transações conciliadas ÷ Total de transações × 100" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}
