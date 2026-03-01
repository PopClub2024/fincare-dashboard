import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, { DashboardFilterValues, defaultFilters } from "@/components/dashboard/DashboardFilters";
import KpiCards from "@/components/dashboard/KpiCards";
import TabDRE from "@/components/dashboard/TabDRE";
import TabCaixa from "@/components/dashboard/TabCaixa";
import TabCapitalGiro from "@/components/dashboard/TabCapitalGiro";
import TabAR from "@/components/dashboard/TabAR";
import TabAP from "@/components/dashboard/TabAP";
import TabOperacional from "@/components/dashboard/TabOperacional";
import TabGrowth from "@/components/dashboard/TabGrowth";
import TabProducao from "@/components/dashboard/TabProducao";
import {
  FileBarChart, Wallet, FileText, PieChart, ArrowDownCircle,
  ArrowUpCircle, Activity, TrendingUp,
} from "lucide-react";

const tabs = [
  { value: "dre", label: "DRE", icon: FileBarChart },
  { value: "caixa", label: "Caixa", icon: Wallet },
  { value: "producao", label: "Produção", icon: FileText },
  { value: "capital", label: "Capital Giro", icon: PieChart },
  { value: "ar", label: "AR / Aging", icon: ArrowDownCircle },
  { value: "ap", label: "AP", icon: ArrowUpCircle },
  { value: "operacional", label: "Operacional", icon: Activity },
  { value: "growth", label: "Growth", icon: TrendingUp },
];

export default function DashboardCFO() {
  const [filters, setFilters] = useState<DashboardFilterValues>(defaultFilters);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard CFO</h1>
          <p className="text-sm text-muted-foreground">Visão financeira consolidada da clínica</p>
        </div>

        <DashboardFilters filters={filters} onFilterChange={setFilters} />
        <KpiCards dateFrom={filters.dateFrom} dateTo={filters.dateTo} />

        {/* Tabs */}
        <Tabs defaultValue="dre" className="space-y-4">
          <TabsList className="inline-flex h-9 w-full justify-start gap-0.5 overflow-x-auto rounded-lg bg-muted p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dre"><TabDRE dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="caixa"><TabCaixa dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="producao"><TabProducao dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="capital"><TabCapitalGiro dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="ar"><TabAR dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="ap"><TabAP dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="operacional"><TabOperacional dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="growth"><TabGrowth /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
