import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, { DashboardFilterValues, defaultFilters } from "@/components/dashboard/DashboardFilters";
import KpiCards from "@/components/dashboard/KpiCards";
import TabDRE from "@/components/dashboard/TabDRE";
import TabCaixa from "@/components/dashboard/TabCaixa";
import TabCapitalGiro from "@/components/dashboard/TabCapitalGiro";
import TabOperacional from "@/components/dashboard/TabOperacional";
import TabGrowth from "@/components/dashboard/TabGrowth";

export default function DashboardCFO() {
  const [filters, setFilters] = useState<DashboardFilterValues>(defaultFilters);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard CFO</h1>
          <p className="text-sm text-muted-foreground">Visão financeira consolidada da clínica</p>
        </div>

        <DashboardFilters filters={filters} onFilterChange={setFilters} />
        <KpiCards />

        <Tabs defaultValue="dre" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 bg-muted">
            <TabsTrigger value="dre">DRE</TabsTrigger>
            <TabsTrigger value="caixa">Caixa</TabsTrigger>
            <TabsTrigger value="capital">Capital de Giro</TabsTrigger>
            <TabsTrigger value="operacional">Operacional</TabsTrigger>
            <TabsTrigger value="growth">Growth</TabsTrigger>
          </TabsList>

          <TabsContent value="dre"><TabDRE /></TabsContent>
          <TabsContent value="caixa"><TabCaixa /></TabsContent>
          <TabsContent value="capital"><TabCapitalGiro /></TabsContent>
          <TabsContent value="operacional"><TabOperacional /></TabsContent>
          <TabsContent value="growth"><TabGrowth /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
